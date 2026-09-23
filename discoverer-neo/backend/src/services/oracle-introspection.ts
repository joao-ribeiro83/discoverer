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
  /** `ALL_COL_COMMENTS.COMMENTS`, the item description a folder import prefills. */
  comments: string | null;
}

export interface IntrospectedTable {
  tableName: string;
  tableOwner: string;
  /** TABLE or VIEW — a folder built on it takes the same type. */
  objectType: 'TABLE' | 'VIEW';
  /** `ALL_TAB_COMMENTS.COMMENTS`. */
  comments: string | null;
  columns: IntrospectedColumn[];
}

// ---------------------------------------------------------------------------
// Redis cache helpers
// ---------------------------------------------------------------------------

// Suffix bumped when the cached shape changes, so a stale entry from an
// older build is simply missed rather than read back with fields absent.
const CACHE_PREFIX = 'oracle:introspection:v2:';
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
 * Connect to Oracle and introspect the schema's tables AND views
 * (ALL_OBJECTS + ALL_TAB_COLUMNS, with ALL_TAB_COMMENTS/ALL_COL_COMMENTS).
 * Returns a list of accessible objects with their columns.
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
  // Every table and view the connecting user owns. A Discoverer folder sits
  // on either, so listing ALL_TABLES alone made views impossible to pick.
  const tableResult = await conn.execute(
    `SELECT o.OBJECT_NAME AS TABLE_NAME, o.OWNER, o.OBJECT_TYPE, c.COMMENTS
       FROM ALL_OBJECTS o
       LEFT JOIN ALL_TAB_COMMENTS c ON c.OWNER = o.OWNER AND c.TABLE_NAME = o.OBJECT_NAME
      WHERE o.OWNER = :owner AND o.OBJECT_TYPE IN ('TABLE', 'VIEW')
      ORDER BY o.OBJECT_NAME`,
    { owner: conn.user?.toUpperCase() ?? '' },
    { outFormat: OUT_FORMAT_OBJECT },
  );

  const tables: IntrospectedTable[] = [];

  for (const row of tableResult.rows as Array<{
    TABLE_NAME: string;
    OWNER: string;
    OBJECT_TYPE: string;
    COMMENTS: string | null;
  }>) {
    tables.push({
      tableName: row.TABLE_NAME,
      tableOwner: row.OWNER,
      objectType: row.OBJECT_TYPE === 'VIEW' ? 'VIEW' : 'TABLE',
      comments: row.COMMENTS?.trim() || null,
      columns: await fetchColumns(conn, row.OWNER, row.TABLE_NAME),
    });
  }

  return tables;
}

async function fetchColumns(
  conn: Connection,
  owner: string,
  tableName: string,
): Promise<IntrospectedColumn[]> {
  const colResult = await conn.execute(
    `SELECT c.COLUMN_NAME, c.DATA_TYPE, c.DATA_LENGTH, c.NULLABLE, cc.COMMENTS
       FROM ALL_TAB_COLUMNS c
       LEFT JOIN ALL_COL_COMMENTS cc
         ON cc.OWNER = c.OWNER AND cc.TABLE_NAME = c.TABLE_NAME AND cc.COLUMN_NAME = c.COLUMN_NAME
      WHERE c.TABLE_NAME = :tableName AND c.OWNER = :owner
      ORDER BY c.COLUMN_ID`,
    { tableName, owner },
    { outFormat: OUT_FORMAT_OBJECT },
  );

  return (colResult.rows as Array<{
    COLUMN_NAME: string;
    DATA_TYPE: string;
    DATA_LENGTH: number | null;
    NULLABLE: string;
    COMMENTS: string | null;
  }>).map((col) => ({
    columnName: col.COLUMN_NAME,
    dataType: col.DATA_TYPE,
    dataLength: col.DATA_LENGTH ?? null,
    nullable: col.NULLABLE === 'Y',
    comments: col.COMMENTS?.trim() || null,
  }));
}

/**
 * Read named tables/views live — no cache, any owner the connecting user can
 * see (a migrated folder often sits in another schema than the data source
 * user, which `introspectSchema` does not list). One connection for the lot.
 * A missing object maps to null. `owner` null means the connecting user.
 */
export async function describeObjects(
  dataSourceId: string,
  refs: ReadonlyArray<{ owner: string | null; name: string }>,
): Promise<Array<IntrospectedTable | null>> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('Data source not found');
  if (ds.connectionType !== 'oracle') {
    throw new Error(`Introspection is only supported for Oracle data sources (got: ${ds.connectionType})`);
  }

  const conn = await getOracleConnection(ds);
  try {
    const out: Array<IntrospectedTable | null> = [];
    for (const ref of refs) {
      // Exact name first, then Oracle's folded upper case — a quoted mixed-case
      // name still matches itself.
      const obj = await conn.execute(
        `SELECT o.OWNER, o.OBJECT_NAME, o.OBJECT_TYPE, c.COMMENTS
           FROM ALL_OBJECTS o
           LEFT JOIN ALL_TAB_COMMENTS c ON c.OWNER = o.OWNER AND c.TABLE_NAME = o.OBJECT_NAME
          WHERE o.OWNER IN (:owner, UPPER(:owner)) AND o.OBJECT_NAME IN (:name, UPPER(:name))
            AND o.OBJECT_TYPE IN ('TABLE', 'VIEW')
          ORDER BY CASE WHEN o.OBJECT_NAME = :name THEN 0 ELSE 1 END`,
        { owner: ref.owner || conn.user || ds.username || '', name: ref.name },
        { outFormat: OUT_FORMAT_OBJECT },
      );
      const row = (obj.rows as Array<{
        OWNER: string;
        OBJECT_NAME: string;
        OBJECT_TYPE: string;
        COMMENTS: string | null;
      }>)[0];
      out.push(
        row
          ? {
              tableName: row.OBJECT_NAME,
              tableOwner: row.OWNER,
              objectType: row.OBJECT_TYPE === 'VIEW' ? 'VIEW' : 'TABLE',
              comments: row.COMMENTS?.trim() || null,
              columns: await fetchColumns(conn, row.OWNER, row.OBJECT_NAME),
            }
          : null,
      );
    }
    return out;
  } finally {
    try {
      await conn.close();
    } catch {
      // Ignore close errors
    }
  }
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

/**
 * Read named functions live, one connection for the lot: every overload of
 * `owner.package.name` in `ALL_ARGUMENTS`, empty when it is gone. `owner` null
 * means the connecting user. Names match exactly, then in Oracle's upper case.
 */
export async function describeFunctions(
  dataSourceId: string,
  refs: ReadonlyArray<{ owner: string | null; packageName: string | null; name: string }>,
): Promise<DatabaseFunction[][]> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('Data source not found');
  if (ds.connectionType !== 'oracle') {
    throw new Error(`Function lookup is only supported for Oracle data sources (got: ${ds.connectionType})`);
  }

  const conn = await getOracleConnection(ds);
  try {
    const out: DatabaseFunction[][] = [];
    for (const ref of refs) {
      const result = await conn.execute(
        `SELECT OWNER, PACKAGE_NAME, OBJECT_NAME, OVERLOAD, ARGUMENT_NAME, POSITION,
                DATA_TYPE, DEFAULTED, IN_OUT
           FROM ALL_ARGUMENTS
          WHERE OWNER IN (:owner, UPPER(:owner)) AND OBJECT_NAME IN (:name, UPPER(:name))
            AND (PACKAGE_NAME IN (:pkg, UPPER(:pkg)) OR (:pkg IS NULL AND PACKAGE_NAME IS NULL))
            AND DATA_LEVEL = 0
          ORDER BY PACKAGE_NAME, OBJECT_NAME, OVERLOAD, POSITION`,
        { owner: ref.owner || conn.user || ds.username || '', name: ref.name, pkg: ref.packageName },
        { outFormat: OUT_FORMAT_OBJECT },
      );
      out.push(groupDatabaseFunctions((result.rows ?? []) as AllArgumentsRow[]));
    }
    return out;
  } finally {
    try {
      await conn.close();
    } catch {
      // Ignore close errors
    }
  }
}
