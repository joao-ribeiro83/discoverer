import type { Connection, Pool } from 'oracledb';
import { config } from '../config.js';
import * as dataSourceService from './data-source.service.js';
import { importOracleDb } from './oracle-driver.js';

/**
 * Oracle connection-pool manager.
 *
 * One pool per data source, created lazily on first use. Thin mode is the
 * default and needs no Oracle Instant Client; nothing here requires thick mode
 * (pools are homogeneous, auth is user/password, queries are plain execute()).
 * Thick mode exists solely for EUL sources older than 12.1, which the thin
 * driver cannot reach, and is opt-in via ORACLE_THICK_MODE.
 *
 * The `oracledb` module is imported dynamically so the process still starts
 * (and non-Oracle features keep working) when the driver or its native
 * dependencies are unavailable.
 */

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

// Pool sizing is environment-tunable (see config.ts) because the right values
// depend on the deployment: how many Oracle sources exist, how many concurrent
// map executions are expected against each, and what the database's own
// session limit allows.
const POOL_MIN = config.ORACLE_POOL_MIN;
const POOL_MAX = config.ORACLE_POOL_MAX;
const POOL_INCREMENT = config.ORACLE_POOL_INCREMENT;
/** Seconds an idle connection may sit in the pool before it is closed. */
const POOL_IDLE_TIMEOUT_SECONDS = config.ORACLE_POOL_IDLE_TIMEOUT_SECONDS;
/** Max ms to wait to acquire a connection (queue + establish). */
const CONNECT_TIMEOUT_MS = config.ORACLE_CONNECT_TIMEOUT_MS;
/** Seconds to let in-flight work drain when closing a pool on shutdown. */
const POOL_DRAIN_SECONDS = 5;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class OracleDriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OracleDriverError';
  }
}

export class OraclePoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OraclePoolError';
  }
}

// ---------------------------------------------------------------------------
// Driver loading (dynamic, cached)
// ---------------------------------------------------------------------------

// The driver is imported dynamically (see loadOracleDb) so this inline
// `typeof import(...)` annotation is the only way to type the module value.
let oracledbModule: typeof import('oracledb') | null = null;
let clientInitialized = false;
// A failed thick-mode init is sticky. Without this, the flag would be set
// before the attempt and the *next* caller would skip init and silently get a
// thin-mode connection — so only the first request after boot would fail, and
// a deployment misconfigured for a pre-12.1 database would look healthy right
// up until it returned wrong results.
let clientInitError: OracleDriverError | null = null;

/** Initialise thick mode once. Thin mode (the default) needs no client. */
function initOracleClientOnce(oracledb: typeof import('oracledb')): void {
  if (clientInitError) throw clientInitError;
  if (clientInitialized) return;

  if (!config.ORACLE_THICK_MODE) {
    clientInitialized = true;
    return;
  }

  try {
    oracledb.initOracleClient({ libDir: config.ORACLE_CLIENT_PATH });
    clientInitialized = true;
  } catch (err) {
    // A second init in the same process throws; that is harmless.
    if (/already been initialized/i.test(String(err))) {
      clientInitialized = true;
      return;
    }
    clientInitError = new OracleDriverError(
      `ORACLE_THICK_MODE is enabled but the Oracle Instant Client at ` +
        `"${config.ORACLE_CLIENT_PATH}" could not be loaded: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Rebuild the image with --build-arg INSTALL_ORACLE_CLIENT=true, or ` +
        `unset ORACLE_THICK_MODE to use thin mode (Oracle Database 12.1+ only).`,
    );
    throw clientInitError;
  }
}

/**
 * Verify thick mode can actually load its client.
 *
 * Init is otherwise lazy — it happens on the first Oracle pool creation, which
 * may be hours after boot. Calling this at startup turns a misconfigured image
 * into an immediate, obvious failure rather than one surfacing mid-request.
 * No-op in thin mode.
 */
export async function verifyOracleClient(): Promise<void> {
  if (!config.ORACLE_THICK_MODE) return;
  await loadOracleDb();
}

/**
 * Point-in-time Oracle client status for `/health`.
 *
 * Cheap and synchronous by design — a health check runs on every liveness
 * probe and must not itself open a connection. `server.ts` calls
 * `verifyOracleClient()` once at startup and exits the process if thick mode
 * is misconfigured, so by the time this is reachable over HTTP the outcome is
 * already settled; this just reports the sticky state recorded then.
 */
export function getOracleClientStatus(): 'thin' | 'thick_ready' | 'thick_unavailable' {
  if (!config.ORACLE_THICK_MODE) return 'thin';
  return clientInitError ? 'thick_unavailable' : 'thick_ready';
}

async function loadOracleDb(): Promise<typeof import('oracledb')> {
  if (oracledbModule) return oracledbModule;
  let mod: typeof import('oracledb');
  try {
    mod = await importOracleDb();
  } catch {
    throw new OracleDriverError('Oracle driver (oracledb) is not installed');
  }
  initOracleClientOnce(mod);
  oracledbModule = mod;
  return mod;
}

// ---------------------------------------------------------------------------
// Pool registry
// ---------------------------------------------------------------------------

const pools = new Map<string, Pool>();
/** De-duplicates concurrent create-pool requests for the same data source. */
const pending = new Map<string, Promise<Pool>>();

async function buildPool(dataSourceId: string): Promise<Pool> {
  const oracledb = await loadOracleDb();

  const ds = await dataSourceService.getById(dataSourceId, { includeSecrets: true });
  if (!ds) {
    throw new OraclePoolError(`Data source "${dataSourceId}" not found`);
  }
  if (ds.connectionType !== 'oracle') {
    throw new OraclePoolError(
      `Data source "${ds.name}" is not an Oracle connection (got: ${ds.connectionType})`,
    );
  }

  const connectString =
    ds.connectionString ||
    `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${
      ds.serviceName || ds.sid
    })))`;

  try {
    return await oracledb.createPool({
      user: ds.username ?? undefined,
      password: ds.password ?? '',
      connectString,
      poolAlias: `ds:${dataSourceId}`,
      poolMin: POOL_MIN,
      poolMax: POOL_MAX,
      poolIncrement: POOL_INCREMENT,
      poolTimeout: POOL_IDLE_TIMEOUT_SECONDS,
      queueTimeout: CONNECT_TIMEOUT_MS,
    });
  } catch (err) {
    throw new OraclePoolError(
      `Failed to create Oracle connection pool for "${ds.name}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/** Get (creating on first use) the pool for a data source. */
export async function getPool(dataSourceId: string): Promise<Pool> {
  const existing = pools.get(dataSourceId);
  if (existing) return existing;

  const inFlight = pending.get(dataSourceId);
  if (inFlight) return inFlight;

  const promise = buildPool(dataSourceId)
    .then((pool) => {
      pools.set(dataSourceId, pool);
      return pool;
    })
    .finally(() => {
      pending.delete(dataSourceId);
    });

  pending.set(dataSourceId, promise);
  return promise;
}

/**
 * Acquire a pooled connection. Rejects with OraclePoolError if a connection
 * cannot be obtained within CONNECT_TIMEOUT_MS (the pool's own queueTimeout
 * covers waiting for a free slot; the race guards the whole acquire path).
 */
export async function getConnection(dataSourceId: string): Promise<Connection> {
  const pool = await getPool(dataSourceId);

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new OraclePoolError(
          `Timed out acquiring an Oracle connection after ${CONNECT_TIMEOUT_MS}ms`,
        ),
      );
    }, CONNECT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([pool.getConnection(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Return a connection to its pool. Never throws. */
export async function releaseConnection(
  _dataSourceId: string,
  connection: Connection,
): Promise<void> {
  try {
    await connection.close();
  } catch {
    // Connection may already be broken/closed — nothing actionable here.
  }
}

/** Close a single pool (e.g. after the data source's credentials change). */
export async function closePool(dataSourceId: string): Promise<void> {
  const pool = pools.get(dataSourceId);
  if (!pool) return;
  pools.delete(dataSourceId);
  try {
    await pool.close(POOL_DRAIN_SECONDS);
  } catch {
    // Ignore — the pool is being discarded regardless.
  }
}

/** Close every pool. Call on graceful shutdown. */
export async function closeAll(): Promise<void> {
  const all = [...pools.values()];
  pools.clear();
  await Promise.all(
    all.map((pool) =>
      pool.close(POOL_DRAIN_SECONDS).catch(() => {
        /* ignore close errors during shutdown */
      }),
    ),
  );
}

/** Number of live pools — exposed for diagnostics/health checks. */
export function poolCount(): number {
  return pools.size;
}
