import type { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources, type DataSource } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';

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
  let oracledb: typeof import('oracledb');
  try {
    oracledb = await import('oracledb');
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

async function fetchAllTables(conn: any): Promise<IntrospectedTable[]> {
  // First, get all table names owned by the specified user (or accessible)
  const tableResult = await conn.execute(
    `SELECT TABLE_NAME, OWNER FROM ALL_TABLES WHERE OWNER = :owner ORDER BY TABLE_NAME`,
    { owner: (conn as any).user?.toUpperCase() ?? '' },
    { outFormat: 2 }, // OBJECT format
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
      { tableName, tableOwner },
      { outFormat: 2 },
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
