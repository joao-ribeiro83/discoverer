/**
 * Standalone Oracle connectivity for the migration tool.
 *
 * The migrate workspace connects straight to a *source* Discoverer database
 * from CLI-supplied connection details — it deliberately does not depend on
 * the backend's data-source registry or its pool manager. The pooling and
 * driver-interop patterns mirror `backend/src/services/oracle-connection-pool.ts`.
 */

import type { BindParameters, Connection, Pool } from 'oracledb';
import type * as OracleDbNamespace from 'oracledb';

/**
 * The oracledb module's full (callable) API surface. A type-only namespace
 * import so the runtime CJS/ESM interop below stays the single load path.
 */
export type OracleDbModule = typeof OracleDbNamespace;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface EulConnectionConfig {
  user: string;
  password: string;
  /** Full connect string; when absent it is built from host/port/serviceName|sid. */
  connectString?: string;
  host?: string;
  port?: number;
  serviceName?: string;
  sid?: string;
  /** Schema that owns the EUL tables. Defaults to the connected user. */
  schemaOwner?: string;
}

/**
 * Executes a SQL statement and returns rows as objects keyed by UPPERCASE
 * column name (node-oracledb OUT_FORMAT_OBJECT convention). Read functions
 * and the version detector depend only on this signature, which is what
 * keeps the whole layer hermetically testable without a real Oracle.
 */
export type OracleExecutor = (
  sql: string,
  binds?: Record<string, unknown>,
) => Promise<Array<Record<string, unknown>>>;

/** Either live connection details or an already-built executor (tests). */
export type EulSource = EulConnectionConfig | OracleExecutor;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EulConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EulConnectionError';
  }
}

export class EulQueryError extends Error {
  readonly sql: string;
  readonly cause?: unknown;

  constructor(message: string, sql: string, cause?: unknown) {
    super(message);
    this.name = 'EulQueryError';
    this.sql = sql;
    this.cause = cause;
  }
}

/**
 * Stringify an unknown DB value without '[object Object]' surprises.
 * Oracle rows are typed as unknown; catalog/identity values are expected to
 * be strings, so anything else is serialized defensively.
 */
export function dbString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  const serialized: string | undefined = JSON.stringify(value);
  return serialized ?? '';
}

/** ORA-00942: table or view does not exist. */
export function isTableNotFoundError(err: unknown): boolean {
  const message =
    err instanceof EulQueryError
      ? String(err.cause instanceof Error ? err.cause.message : err.message)
      : err instanceof Error
        ? err.message
        : String(err);
  return message.includes('ORA-00942');
}

// ---------------------------------------------------------------------------
// Driver loading
// ---------------------------------------------------------------------------

/**
 * node-oracledb ships as CommonJS: under ESM the entire callable API
 * (createPool, getConnection, …) lands on `.default` while the statically
 * detectable classes appear as named exports. The unwrap is load-bearing —
 * without it every driver method is `undefined`. Same interop gotcha as the
 * backend's `oracle-driver.ts` (and cron-parser / node-sql-parser before it).
 */
export async function importOracleDb(): Promise<OracleDbModule> {
  const ns = (await import('oracledb')) as unknown as {
    default?: OracleDbModule;
  };
  return ns.default ?? (ns as unknown as OracleDbModule);
}

let oracledbModule: OracleDbModule | null = null;
let clientInitialized = false;

/**
 * Has the Oracle Instant Client already been loaded into this process?
 *
 * The driver refuses a second `initOracleClient` two different ways, and both
 * mean the same harmless thing — the client is loaded:
 *
 * - `already been initialized`, when the second call passes the same arguments;
 * - **`NJS-090: initOracleClient() was already called with different
 *   arguments`**, when it does not.
 *
 * The second one is the case that actually happens here. `reimport-maps` runs
 * inside the backend, whose pool initialises with `{ libDir: <configured> }`,
 * and then the migrator's own init runs with `{}` because this workspace reads
 * `ORACLE_CLIENT_PATH` from the environment and the container does not set it.
 * Only the first form was tolerated, so the re-import failed at the read step
 * with a message telling the operator to set a variable that would not have
 * fixed anything.
 *
 * Matching on "already" rather than on the code covers both, and is the right
 * shape of test: whichever wording the driver uses, the client is there.
 *
 * `oracle-connection-pool.ts` keeps its own copy of this regex rather than
 * importing this one. That is not drift by accident: the pool is request-path
 * code and `no-restricted-imports` forbids it reaching into the migration
 * pipeline, which is a rule worth more than one shared regex.
 */
export function isAlreadyInitialized(err: unknown): boolean {
  return /already been initialized|already called/i.test(String(err));
}

/**
 * Switch the driver into thick mode when `ORACLE_THICK_MODE` says to.
 *
 * Thin mode is the default and needs no Oracle Instant Client, but it cannot
 * authenticate against every password verifier: a 12c-era account raises
 * `NJS-116: password verifier type 0x939 is not supported by node-oracledb in
 * Thin mode`. This estate's EUL account is one of those, so without thick mode
 * `dn-migrate` cannot read the source at all — the migration itself only ever
 * ran because the backend's own pool initialises the client and this one did
 * not.
 *
 * Same contract as `backend/src/services/oracle-connection-pool.ts`, kept here
 * rather than shared because that module reads the backend's validated config
 * and this workspace has none — the CLI is configured by flags and `.env`.
 */
function initThickModeOnce(oracledb: OracleDbModule): void {
  if (clientInitialized) return;
  clientInitialized = true;

  if (process.env.ORACLE_THICK_MODE !== 'true') return;

  try {
    const libDir = process.env.ORACLE_CLIENT_PATH;
    oracledb.initOracleClient(libDir ? { libDir } : {});
  } catch (err) {
    if (isAlreadyInitialized(err)) return;
    throw new EulConnectionError(
      'ORACLE_THICK_MODE is enabled but the Oracle Instant Client could not be ' +
        `loaded: ${err instanceof Error ? err.message : String(err)}. Set ` +
        'ORACLE_CLIENT_PATH to the client directory, or unset ORACLE_THICK_MODE ' +
        'to use thin mode (which cannot authenticate every password verifier).',
    );
  }
}

async function loadOracleDb(): Promise<OracleDbModule> {
  if (oracledbModule) return oracledbModule;
  try {
    oracledbModule = await importOracleDb();
  } catch {
    throw new EulConnectionError('Oracle driver (oracledb) is not installed');
  }
  initThickModeOnce(oracledbModule);
  // Driver-global (not a per-execute option): EUL workbook XML lives in
  // LONG/CLOB columns — fetch them as strings instead of Lob streams.
  oracledbModule.fetchAsString = [oracledbModule.CLOB];
  return oracledbModule;
}

// ---------------------------------------------------------------------------
// Pooling (one pool per distinct user@connectString)
// ---------------------------------------------------------------------------

const POOL_MIN = 0;
const POOL_MAX = 4;
const POOL_IDLE_TIMEOUT_SECONDS = 120;
const QUEUE_TIMEOUT_MS = 10_000;
const POOL_DRAIN_SECONDS = 5;

const pools = new Map<string, Promise<Pool>>();

export function buildConnectString(config: EulConnectionConfig): string {
  if (config.connectString) return config.connectString;
  if (!config.host || (!config.serviceName && !config.sid)) {
    throw new EulConnectionError(
      'Connection config needs either connectString, or host plus serviceName/sid',
    );
  }
  return (
    `(DESCRIPTION=(ADDRESS=(HOST=${config.host})(PORT=${config.port ?? 1521})` +
    `(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${config.serviceName ?? config.sid})))`
  );
}

function poolKey(config: EulConnectionConfig): string {
  return `${config.user}@${buildConnectString(config)}`;
}

async function getPool(config: EulConnectionConfig): Promise<Pool> {
  const key = poolKey(config);
  const existing = pools.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const oracledb = await loadOracleDb();
    try {
      return await oracledb.createPool({
        user: config.user,
        password: config.password,
        connectString: buildConnectString(config),
        poolMin: POOL_MIN,
        poolMax: POOL_MAX,
        poolIncrement: 1,
        poolTimeout: POOL_IDLE_TIMEOUT_SECONDS,
        queueTimeout: QUEUE_TIMEOUT_MS,
      });
    } catch (err) {
      throw new EulConnectionError(
        `Failed to create Oracle pool for "${config.user}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  })();

  // A failed pool creation must not stay cached, or every later call fails
  // with the stale error even after e.g. the password is corrected.
  pools.set(
    key,
    promise.catch((err: unknown) => {
      pools.delete(key);
      throw err;
    }),
  );
  return promise;
}

export async function getConnection(config: EulConnectionConfig): Promise<Connection> {
  const pool = await getPool(config);
  try {
    return await pool.getConnection();
  } catch (err) {
    throw new EulConnectionError(
      `Failed to acquire an Oracle connection: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Close every pool. Call once when the migration run finishes. */
export async function closeAllPools(): Promise<void> {
  const all = [...pools.values()];
  pools.clear();
  await Promise.all(
    all.map((p) =>
      p
        .then((pool) => pool.close(POOL_DRAIN_SECONDS))
        .catch(() => {
          /* pool is being discarded regardless */
        }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

/**
 * Build an OracleExecutor over a pooled connection. Each execute() acquires
 * and releases its own connection, so an executor can be long-lived and used
 * concurrently. LONG and CLOB columns are fetched as strings (EUL workbook
 * XML lives in a LONG column).
 */
export function createExecutor(config: EulConnectionConfig): OracleExecutor {
  return async (sql, binds) => {
    const oracledb = await loadOracleDb();
    const connection = await getConnection(config);
    try {
      const result = await connection.execute<Record<string, unknown>>(
        sql,
        // Bind values are plain scalars here; oracledb's BindParameters type
        // is narrower than Record<string, unknown> but accepts them at runtime.
        (binds ?? {}) as BindParameters,
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return result.rows ?? [];
    } catch (err) {
      if (err instanceof EulConnectionError) throw err;
      throw new EulQueryError(
        `Oracle query failed: ${err instanceof Error ? err.message : String(err)}`,
        sql,
        err,
      );
    } finally {
      try {
        await connection.close();
      } catch {
        // Connection may already be broken — nothing actionable.
      }
    }
  };
}

/** Normalize an EulSource (config or ready-made executor) to an executor. */
export function resolveExecutor(source: EulSource): OracleExecutor {
  return typeof source === 'function' ? source : createExecutor(source);
}
