import type * as PgNamespace from 'pg';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources, type DataSource, type NewDataSource } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { importOracleDb, type OracleDbModule } from './oracle-driver.js';

// Shape returned to API clients — never includes the decrypted password.
export type SafeDataSource = Omit<DataSource, 'passwordEnc' | 'connectionString'> & {
  hasPassword: boolean;
  hasConnectionString: boolean;
};

function toSafe(ds: DataSource): SafeDataSource {
  const { passwordEnc: _p, connectionString: _c, ...rest } = ds;
  return {
    ...rest,
    hasPassword: !!ds.passwordEnc,
    hasConnectionString: !!ds.connectionString,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(
  data: Omit<NewDataSource, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SafeDataSource> {
  const values: NewDataSource = {
    ...data,
    passwordEnc: data.passwordEnc ? encrypt(data.passwordEnc) : null,
  };

  const [row] = await db.insert(dataSources).values(values).returning();
  return toSafe(row as DataSource);
}

export async function update(
  id: string,
  data: Partial<Omit<NewDataSource, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<SafeDataSource | null> {
  const values: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  // Re-encrypt password only when it is being changed.
  if (data.passwordEnc !== undefined) {
    values.passwordEnc = data.passwordEnc ? encrypt(data.passwordEnc) : null;
  }

  const [row] = await db
    .update(dataSources)
    .set(values)
    .where(eq(dataSources.id, id))
    .returning();

  return row ? toSafe(row) : null;
}

export async function getById(
  id: string,
  opts: { includeSecrets?: boolean } = {},
): Promise<(SafeDataSource & { password?: string; connectionString?: string }) | null> {
  const [row] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, id))
    .limit(1);

  if (!row) return null;

  const safe = toSafe(row);

  if (opts.includeSecrets) {
    return {
      ...safe,
      password: row.passwordEnc ? decrypt(row.passwordEnc) : undefined,
      connectionString: row.connectionString ?? undefined,
    };
  }

  return safe;
}

export async function list(): Promise<SafeDataSource[]> {
  const rows = await db.select().from(dataSources).orderBy(dataSources.name);
  return rows.map(toSafe);
}

export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(dataSources)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(dataSources.id, id))
    .returning({ id: dataSources.id });

  return !!row;
}

// ---------------------------------------------------------------------------
// Connection testing
// ---------------------------------------------------------------------------

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

/**
 * Attempt to connect to the data source and run a simple verification query.
 */
export async function testConnection(id: string): Promise<ConnectionTestResult> {
  const [ds] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, id))
    .limit(1);

  if (!ds) {
    return { success: false, message: 'Data source not found', latencyMs: 0 };
  }

  const start = performance.now();

  if (ds.connectionType === 'oracle') {
    return testOracleConnection(ds, start);
  }
  if (ds.connectionType === 'postgres') {
    return testPostgresConnection(ds, start);
  }

  return {
    success: false,
    message: `Unsupported connection type: ${ds.connectionType as string}`,
    latencyMs: 0,
  };
}

async function testOracleConnection(
  ds: DataSource,
  start: number,
): Promise<ConnectionTestResult> {
  let oracledb: OracleDbModule | null = null;
  try {
    oracledb = await importOracleDb();
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: 'Oracle driver (oracledb) is not installed',
      latencyMs,
    };
  }

  // Decrypt password for the connection attempt.
  const password = ds.passwordEnc ? decrypt(ds.passwordEnc) : '';
  const connectString =
    ds.connectionString || `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${ds.serviceName || ds.sid})))`;

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: ds.username ?? undefined,
      password,
      connectString,
    });
    await conn.execute('SELECT 1 FROM DUAL');
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: true,
      message: 'Connection established successfully',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Oracle connection failed: ${message}`, latencyMs };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        // Ignore close errors.
      }
    }
  }
}

async function testPostgresConnection(
  ds: DataSource,
  start: number,
): Promise<ConnectionTestResult> {
  let pg: typeof PgNamespace | null = null;
  try {
    pg = await import('pg');
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      message: 'PostgreSQL driver (pg) is not installed',
      latencyMs,
    };
  }

  const password = ds.passwordEnc ? decrypt(ds.passwordEnc) : '';
  const connectionString = ds.connectionString || (() => {
    const host = ds.host ?? 'localhost';
    const port = ds.port ?? 5432;
    const user = ds.username ?? '';
    return `postgresql://${user}${password ? `:${password}` : ''}@${host}:${port}/postgres`;
  })();

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    await client.query('SELECT 1');
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: true,
      message: 'Connection established successfully',
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Postgres connection failed: ${message}`,
      latencyMs,
    };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore close errors.
    }
  }
}
