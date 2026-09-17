import type { Redis } from 'ioredis';
import type { Connection } from 'oracledb';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources, type DataSource } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb, type OracleDbModule } from './oracle-driver.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntrospectedColumn {
  columnName: string;
  dataType: string;
  dataLength: number | null;
  nullable: boolean;
}

export interface IntrospectedTable {
  tableName: string;
  tableOwner: string;
  columns: IntrospectedColumn[];
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'oracle:introspection:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * node-oracledb's OUT_FORMAT_OBJECT constant. Hard-coded so this service stays
 * driver-agnostic (and unit-testable without the native module); the value is
 * a stable part of the oracledb public API. See map-execution.service.ts,
 * which follows the same convention.
 */
const OUT_FORMAT_OBJECT = 4002;

function cacheKey(dataSourceId: string): string {
  return `${CACHE_PREFIX}${dataSourceId}`;
}

async function getCached(
  redis: Redis,
  dataSourceId: string,
): Promise<IntrospectedTable[] | null> {
  const raw = await redis.get(cacheKey(dataSourceId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IntrospectedTable[];
  } catch {
    return null;
  }
}

async function setCached(
  redis: Redis,
  dataSourceId: string,
  tables: IntrospectedTable[],
): Promise<void> {
  await redis.setex(cacheKey(dataSourceId), CACHE_TTL_SECONDS, JSON.stringify(tables));
}

/** Flush cached introspection data for a data source (call after schema changes). */
export async function invalidateCache(
  redis: Redis,
  dataSourceId: string,
): Promise<void> {
  await redis.del(cacheKey(dataSourceId));
}

// ---------------------------------------------------------------------------
// Oracle connection helper
// ---------------------------------------------------------------------------

async function getOracleConnection(ds: DataSource) {
  let oracledb: OracleDbModule;
  try {
    oracledb = await importOracleDb();
  } catch {
    throw new Error('Oracle driver (oracledb) is not installed');
  }

  const password = ds.passwordEnc ? decrypt(ds.passwordEnc) : '';
  const connectString =
    ds.connectionString ||
    `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${ds.serviceName || ds.sid})))`;

  const conn = await oracledb.getConnection({
    user: ds.username ?? undefined,
    password,
    connectString,
  });

  return conn;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to Oracle and introspect ALL_TABLES + ALL_TAB_COLUMNS.
 * Returns a list of accessible tables with their columns.
 * Results are cached in Redis for 5 minutes.
 */
export async function introspectSchema(
  dataSourceId: string,
  redis: Redis,
): Promise<IntrospectedTable[]> {
  // Check cache first
  const cached = await getCached(redis, dataSourceId);
  if (cached) return cached;

  const [ds] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);

  if (!ds) {
    throw new Error('Data source not found');
  }

  if (ds.connectionType !== 'oracle') {
    throw new Error(`Introspection is only supported for Oracle data sources (got: ${ds.connectionType})`);
  }

  let conn;
  try {
    conn = await getOracleConnection(ds);
    const tables = await fetchAllTables(conn);
    await setCached(redis, dataSourceId, tables);
    return tables;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Oracle introspection failed: ${message}`);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

async function fetchAllTables(conn: Connection): Promise<IntrospectedTable[]> {
  // First, get all table names owned by the specified user (or accessible)
  const tableResult = await conn.execute(
    `SELECT TABLE_NAME, OWNER FROM ALL_TABLES WHERE OWNER = :owner ORDER BY TABLE_NAME`,
    { owner: conn.user?.toUpperCase() ?? '' },
    { outFormat: OUT_FORMAT_OBJECT },
  );

  const tables: IntrospectedTable[] = [];

  for (const row of tableResult.rows as Array<{ TABLE_NAME: string; OWNER: string }>) {
    const tableName = row.TABLE_NAME;
    const tableOwner = row.OWNER;

    // Get columns for this table
    const colResult = await conn.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
       FROM ALL_TAB_COLUMNS
       WHERE TABLE_NAME = :tableName AND OWNER = :owner
       ORDER BY COLUMN_ID`,
      { tableName, owner: tableOwner },
      { outFormat: OUT_FORMAT_OBJECT },
    );

    const columns: IntrospectedColumn[] = (colResult.rows as Array<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      DATA_LENGTH: number | null;
      NULLABLE: string;
    }>).map((col) => ({
      columnName: col.COLUMN_NAME,
      dataType: col.DATA_TYPE,
      dataLength: col.DATA_LENGTH ?? null,
      nullable: col.NULLABLE === 'Y',
    }));

    tables.push({ tableName, tableOwner, columns });
  }

  return tables;
}

/**
 * Get detailed column info for a specific table.
 */
export async function getTableInfo(
  dataSourceId: string,
  tableName: string,
  tableOwner: string,
  redis: Redis,
): Promise<IntrospectedTable | null> {
  // Use full introspection (cached) and filter
  const allTables = await introspectSchema(dataSourceId, redis);
  return allTables.find(
    (t) =>
      t.tableName.toUpperCase() === tableName.toUpperCase() &&
      t.tableOwner.toUpperCase() === tableOwner.toUpperCase(),
  ) ?? null;
}

/**
 * Check if a specific table exists in the Oracle schema.
 */
export async function testTableExists(
  dataSourceId: string,
  tableName: string,
  tableOwner: string,
  redis: Redis,
): Promise<boolean> {
  const allTables = await introspectSchema(dataSourceId, redis);
  return allTables.some(
    (t) =>
      t.tableName.toUpperCase() === tableName.toUpperCase() &&
      t.tableOwner.toUpperCase() === tableOwner.toUpperCase(),
  );
}

// ---------------------------------------------------------------------------
// Database functions (for registering a custom function)
// ---------------------------------------------------------------------------

export interface DatabaseFunctionParameter {
  name: string;
  /** `TEXT` / `NUMBER` / `DATE`, or Oracle's own type name when none fits. */
  type: string;
  required: boolean;
  /** `ALL_ARGUMENTS.POSITION` — 1 is the first argument. */
  position: number;
}

export interface DatabaseFunction {
  owner: string;
  packageName: string | null;
  name: string;
  /** `ALL_ARGUMENTS.OVERLOAD` — which of a package's same-named functions. */
  overload: string | null;
  returnType: string;
  parameters: DatabaseFunctionParameter[];
  /**
   * False when SQL cannot call it: an OUT argument, or a PL/SQL-only type
   * (BOOLEAN, RECORD, a collection, a cursor). `reason` says which.
   */
  callableFromSql: boolean;
  reason: string | null;
}

export interface AllArgumentsRow {
  OWNER: string;
  PACKAGE_NAME: string | null;
  OBJECT_NAME: string;
  OVERLOAD: string | null;
  ARGUMENT_NAME: string | null;
  POSITION: number;
  DATA_TYPE: string | null;
  DEFAULTED: string | null;
  IN_OUT: string;
}

/** Most functions one search returns; the rest are reported as truncated. */
export const DATABASE_FUNCTION_LIMIT = 200;
/** `ALL_ARGUMENTS` rows read per search — one row per argument. */
const ALL_ARGUMENTS_ROW_LIMIT = 5000;

const PLSQL_ONLY_TYPE = /^(PL\/SQL |TABLE$|VARRAY$|REF CURSOR$|OBJECT$|UNDEFINED$)/;

/** Oracle's type name in the vocabulary items and migrated functions use. */
export function neoDataType(oracleType: string): string {
  if (/^(N?VARCHAR2?|N?CHAR|N?CLOB|LONG)$/.test(oracleType)) return 'TEXT';
  if (/^(NUMBER|FLOAT|INTEGER|BINARY_(INTEGER|FLOAT|DOUBLE)|PLS_INTEGER)$/.test(oracleType)) return 'NUMBER';
  if (/^(DATE|TIMESTAMP)/.test(oracleType)) return 'DATE';
  return oracleType;
}

/**
 * Group `ALL_ARGUMENTS` rows (ordered by package, name, overload, position)
 * into functions. A procedure has no POSITION 0 return row and is dropped.
 */
export function groupDatabaseFunctions(rows: readonly AllArgumentsRow[]): DatabaseFunction[] {
  const groups = new Map<string, AllArgumentsRow[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.OWNER, row.PACKAGE_NAME, row.OBJECT_NAME, row.OVERLOAD]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const functions: DatabaseFunction[] = [];
  for (const group of groups.values()) {
    const ret = group.find((r) => r.POSITION === 0);
    if (!ret?.DATA_TYPE) continue;
    // A no-argument subprogram still carries one POSITION 1 row with no name.
    const args = group
      .filter((r) => r.POSITION > 0 && r.ARGUMENT_NAME !== null)
      .sort((a, b) => a.POSITION - b.POSITION);

    let reason: string | null = null;
    const outArg = args.find((a) => a.IN_OUT !== 'IN');
    const plsqlType = [ret, ...args].find((a) => PLSQL_ONLY_TYPE.test(a.DATA_TYPE ?? 'UNDEFINED'));
    if (outArg) reason = `argument ${outArg.ARGUMENT_NAME} is ${outArg.IN_OUT}`;
    else if (plsqlType) reason = `${plsqlType.ARGUMENT_NAME ?? 'return value'} is ${plsqlType.DATA_TYPE ?? 'of unknown type'}`;

    functions.push({
      owner: ret.OWNER,
      packageName: ret.PACKAGE_NAME,
      name: ret.OBJECT_NAME,
      overload: ret.OVERLOAD,
      returnType: neoDataType(ret.DATA_TYPE),
      parameters: args.map((a) => ({
        name: a.ARGUMENT_NAME!,
        type: neoDataType(a.DATA_TYPE ?? 'UNDEFINED'),
        required: a.DEFAULTED !== 'Y',
        position: a.POSITION,
      })),
      callableFromSql: reason === null,
      reason,
    });
  }
  return functions;
}

/**
 * Search the functions a data source can see, for registering one as a custom
 * function. Read-only: `ALL_ARGUMENTS` only, every input bound.
 */
export async function searchDatabaseFunctions(
  dataSourceId: string,
  options: { owner?: string; search?: string },
): Promise<{ owner: string; functions: DatabaseFunction[]; truncated: boolean }> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('Data source not found');
  if (ds.connectionType !== 'oracle') {
    throw new Error(`Function search is only supported for Oracle data sources (got: ${ds.connectionType})`);
  }

  const owner = (options.owner?.trim() || ds.username || '').toUpperCase();
  // The user's text is a literal, not a pattern: escape LIKE's own wildcards.
  const search = (options.search ?? '').trim().toUpperCase().replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${search}%`;

  let conn;
  try {
    conn = await getOracleConnection(ds);
    const result = await conn.execute(
      `SELECT * FROM (
         SELECT OWNER, PACKAGE_NAME, OBJECT_NAME, OVERLOAD, ARGUMENT_NAME, POSITION,
                DATA_TYPE, DEFAULTED, IN_OUT
           FROM ALL_ARGUMENTS
          WHERE OWNER = :owner AND DATA_LEVEL = 0
            AND (OBJECT_NAME LIKE :pattern ESCAPE '\\' OR PACKAGE_NAME LIKE :pattern ESCAPE '\\')
          ORDER BY PACKAGE_NAME, OBJECT_NAME, OVERLOAD, POSITION
       ) WHERE ROWNUM <= :maxRows`,
      { owner, pattern, maxRows: ALL_ARGUMENTS_ROW_LIMIT + 1 },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const rows = (result.rows ?? []) as AllArgumentsRow[];
    const rowCapHit = rows.length > ALL_ARGUMENTS_ROW_LIMIT;
    // A cut can split the last function's arguments, so that one is dropped.
    let functions = groupDatabaseFunctions(rows.slice(0, ALL_ARGUMENTS_ROW_LIMIT));
    if (rowCapHit) functions = functions.slice(0, -1);
    const truncated = rowCapHit || functions.length > DATABASE_FUNCTION_LIMIT;
    return { owner, functions: functions.slice(0, DATABASE_FUNCTION_LIMIT), truncated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Oracle function search failed: ${message}`);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
