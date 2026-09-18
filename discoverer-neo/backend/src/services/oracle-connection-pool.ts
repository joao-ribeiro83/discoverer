import type { Connection, Pool } from 'oracledb';
import { config } from '../config.js';
import * as dataSourceService from './data-source.service.js';
import { importOracleDb, type OracleDbModule } from './oracle-driver.js';
import { resolveSafeHost } from '../lib/host-safety.js';

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
// Oracle server version gate (D-019)
// ---------------------------------------------------------------------------

/**
 * Floor for every Oracle source this app talks to. Below 12.1, thin mode
 * cannot even authenticate (pre-12.1 password verifiers), and this app has
 * never run against, or been asked to support, anything older — a capability
 * table for a second version this estate does not have would be speculative
 * generality (D-019). Revisit if a source below this floor is ever real.
 *
 * Numeric encoding matches oracledb's own `oracleServerVersion`: for version
 * a.b.c.d.e it is (100000000*a) + (1000000*b) + (10000*c) + (100*d) + e.
 */
const MIN_ORACLE_SERVER_VERSION = 1_201_000_000; // 12.1.0.0.0
const MIN_ORACLE_SERVER_VERSION_STRING = '12.1.0.0.0';

/**
 * Refuse a connection to an Oracle server below the supported floor, loudly
 * and by name — not a silent fallback and not a capability table. Pure
 * function over the version oracledb reports, so it is testable without a
 * live Oracle connection (same shape as config.ts's assertProductionSecrets).
 */
export function assertSupportedOracleVersion(
  serverVersion: number,
  serverVersionString: string,
): void {
  if (serverVersion >= MIN_ORACLE_SERVER_VERSION) return;
  throw new OraclePoolError(
    `Oracle Database ${serverVersionString} is below the minimum supported ` +
      `version ${MIN_ORACLE_SERVER_VERSION_STRING} (D-019). Pre-12.1 servers ` +
      `use a password verifier node-oracledb thin mode cannot authenticate ` +
      `against; upgrade the database, or point this data source at a 12.1+ server.`,
  );
}


// ---------------------------------------------------------------------------
// Driver loading (dynamic, cached)
// ---------------------------------------------------------------------------

// The driver is imported dynamically (see loadOracleDb), so the module value
// is typed by `OracleDbModule` — a type-only alias that names the module
// without emitting a require for it.
let oracledbModule: OracleDbModule | null = null;
let clientInitialized = false;
// A failed thick-mode init is sticky. Without this, the flag would be set
// before the attempt and the *next* caller would skip init and silently get a
// thin-mode connection — so only the first request after boot would fail, and
// a deployment misconfigured for a pre-12.1 database would look healthy right
// up until it returned wrong results.
let clientInitError: OracleDriverError | null = null;

/** Initialise thick mode once. Thin mode (the default) needs no client. */
function initOracleClientOnce(oracledb: OracleDbModule): void {
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
    // A second init in the same process throws; that is harmless, and the
    // driver says so two different ways: `already been initialized` when the
    // arguments match, and `NJS-090: … already called with different
    // arguments` when they do not. Matching on "already" covers both.
    //
    // `isAlreadyInitialized` in `@discoverer-neo/core` is the same predicate.
    // It is deliberately NOT imported: this file is request-path code and
    // `no-restricted-imports` forbids it reaching into the migration
    // pipeline, which is a rule worth more than one shared regex.
    if (/already been initialized|already called/i.test(String(err))) {
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
  warnIfThreadPoolTooSmall();
  await loadOracleDb();
}

/**
 * The `ALTER SESSION` statements this deployment's NLS settings amount to.
 *
 * Built from three separately-validated settings rather than one free-text
 * string, so nothing here can carry SQL: `config.ts` pins each to a shape
 * (two non-numeric characters, a date mask, a language name) and anything else
 * fails at startup. The values are still quoted, because validation is a
 * guard, not a reason to stop quoting.
 *
 * Exported for the test — the statements are the whole behaviour, and the
 * alternative is asserting against a live Oracle.
 */
export function nlsStatements(): string[] {
  const quoted = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const out: string[] = [];
  if (config.ORACLE_NLS_NUMERIC_CHARACTERS) {
    out.push(`ALTER SESSION SET NLS_NUMERIC_CHARACTERS = ${quoted(config.ORACLE_NLS_NUMERIC_CHARACTERS)}`);
  }
  if (config.ORACLE_NLS_DATE_FORMAT) {
    out.push(`ALTER SESSION SET NLS_DATE_FORMAT = ${quoted(config.ORACLE_NLS_DATE_FORMAT)}`);
  }
  if (config.ORACLE_NLS_DATE_LANGUAGE) {
    out.push(`ALTER SESSION SET NLS_DATE_LANGUAGE = ${quoted(config.ORACLE_NLS_DATE_LANGUAGE)}`);
  }
  return out;
}

/**
 * Apply this deployment's NLS to a newly created pooled session.
 *
 * Discoverer ran every query under the author's own NLS, and the formulas it
 * stored assume it — see `ORACLE_NLS_NUMERIC_CHARACTERS` in config.ts for the
 * expression that made this necessary. A session that does not match reads
 * `458.33` as a broken number and the map dies on ORA-01722.
 *
 * Failure is fatal to the session on purpose. Continuing would hand out a
 * connection whose numbers and dates parse differently from every other one,
 * which is worse than not connecting: the query would succeed and be wrong.
 */
function nlsSessionCallback(
  conn: Connection,
  _requestedTag: string,
  callback: (err?: Error) => void,
): void {
  // Callback-style, not async: the driver hands us a callback and expects a
  // void return, so the promise is started here and settled through it.
  void (async () => {
    try {
      for (const statement of nlsStatements()) await conn.execute(statement);
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  })();
}

/**
 * Thick mode runs every Oracle call on a libuv thread pool slot, held for the
 * WHOLE call. Node's default pool is 4 threads, and `getaddrinfo` shares it —
 * so once `ORACLE_POOL_MAX` concurrent queries exceed the pool, the next
 * Postgres connection cannot even resolve its hostname and dies on
 * `connectionTimeoutMillis`.
 *
 * That is not a theoretical failure. Four list-of-values queries running
 * 16-27s each took all four threads; the map execution that arrived next
 * reported `timeout exceeded when trying to connect` against `map_parameters`
 * and returned a 500 — while Postgres sat idle with two connections open. The
 * error names Postgres and the cause is Oracle, which is exactly the kind of
 * thing nobody finds twice.
 *
 * `UV_THREADPOOL_SIZE` is read by libuv when the pool is first used and cannot
 * be set from inside the process, so this warns rather than fixes. Set it in
 * the container environment, at `ORACLE_POOL_MAX` plus headroom for DNS, file
 * and crypto work.
 */
export function warnIfThreadPoolTooSmall(): void {
  const configured = Number(process.env.UV_THREADPOOL_SIZE);
  const threads = Number.isInteger(configured) && configured > 0 ? configured : 4;
  const needed = config.ORACLE_POOL_MAX + 4;
  if (threads >= needed) return;
  console.warn(
    `UV_THREADPOOL_SIZE is ${threads}${process.env.UV_THREADPOOL_SIZE ? '' : ' (Node default)'} ` +
      `but thick-mode Oracle can hold ORACLE_POOL_MAX=${config.ORACLE_POOL_MAX} of them at once. ` +
      `Set UV_THREADPOOL_SIZE>=${needed} in the container environment, or a burst of slow Oracle ` +
      'queries will starve Postgres connections and surface as unrelated 500s.',
  );
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

async function loadOracleDb(): Promise<OracleDbModule> {
  if (oracledbModule) return oracledbModule;
  let mod: OracleDbModule;
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

  // Only the structured host/port form is checked — an explicit connectString
  // is already an admin typing raw Oracle connect syntax, not the accidental
  // SSRF surface this guards against.
  //
  // The connect descriptor is built from the *resolved* address, not
  // `ds.host` — the pool would otherwise re-resolve the hostname itself on
  // every connection it opens, and a DNS answer that was safe at check time
  // is not guaranteed to stay safe (DNS rebinding). Pinning the address here
  // also means the pool never re-resolves DNS again for its lifetime; a
  // legitimate DNS-based failover needs the pool rebuilt (closePool), the
  // same way a credential change already does.
  const host =
    !ds.connectionString && ds.host ? await resolveSafeHost(ds.host) : ds.host;

  const connectString =
    ds.connectionString ||
    `(DESCRIPTION=(ADDRESS=(HOST=${host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${
      ds.serviceName || ds.sid
    })))`;

  try {
    return await oracledb.createPool({
      user: ds.username ?? undefined,
      password: ds.password ?? '',
      connectString,
      // Runs once per newly created session, which is where NLS belongs: set
      // on acquire it would re-run for every query, and set at connect time it
      // would be lost when the pool grows.
      sessionCallback: nlsSessionCallback,
      poolAlias: `ds:${dataSourceId}`,
      poolMin: POOL_MIN,
      poolMax: POOL_MAX,
      poolIncrement: POOL_INCREMENT,
      poolTimeout: POOL_IDLE_TIMEOUT_SECONDS,
      queueTimeout: CONNECT_TIMEOUT_MS,
      // Feeds poolSnapshots()'s waiting/failure/latency fields (INF-10). The
      // driver only tracks these when asked; cheap bookkeeping, and this is
      // the only way to see a queue building up before it times out.
      enableStatistics: true,
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

  // Held in a variable, not inlined into the race: when the timeout wins, this
  // promise is still in flight. Whatever it eventually resolves to is a
  // connection checked out of the pool that nobody holds a reference to and
  // nobody will ever close, so the pool loses that slot permanently (BE-04).
  // Under the estate-wide passes Phases 3 and 4 run, a handful of acquisition
  // timeouts is enough to drain a pool to nothing.
  const acquisition = pool.getConnection();

  let connection: Connection;
  try {
    connection = await Promise.race([acquisition, timeout]);
  } catch (err) {
    acquisitionsTimedOut += 1;
    discardLateAcquisition(acquisition);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  // Version gate (D-019). Checked here, not at pool creation: the pool build
  // above is lazy and opens no socket, so this is the first point a real
  // connection — and therefore a real server version — exists at all.
  // oracledb populates both properties from the connect handshake already in
  // flight, so this costs no extra round trip.
  try {
    assertSupportedOracleVersion(
      connection.oracleServerVersion,
      connection.oracleServerVersionString,
    );
  } catch (err) {
    await connection.close().catch(() => undefined);
    throw err;
  }

  return connection;
}

// ---------------------------------------------------------------------------
// Pool observability (INF-10, pool portion)
// ---------------------------------------------------------------------------

/**
 * Close a connection that turned up after its acquisition already lost the
 * race. Exported so the behaviour can be tested directly — the alternative is
 * an untested fix on the path that hands out every Oracle connection.
 *
 * The rejection handler is not decoration: the race is no longer this
 * promise's only consumer, so without it a failed acquisition would surface as
 * an unhandled rejection and, depending on the Node flags, take the process
 * down.
 */
export function discardLateAcquisition(acquisition: Promise<Connection>): void {
  void acquisition.then(
    (late) => {
      void late.close().catch(() => undefined);
    },
    () => undefined,
  );
}

/**
 * Acquisitions that did not complete in time. A leak of the kind BE-04
 * describes is invisible in a connection count alone — the pool looks busy,
 * not broken — but shows up immediately as this number climbing while
 * throughput does not.
 */
let acquisitionsTimedOut = 0;

export interface OraclePoolSnapshot {
  dataSourceId: string;
  /** Connections the pool currently holds open. */
  open: number;
  /** Of those, the ones currently checked out. */
  inUse: number;
  max: number;
  /** Requests currently queued waiting for a free connection. */
  waiting: number;
  /** Acquisitions that failed (driver/database errors) since pool creation. */
  acquireFailures: number;
  /** Average time (ms) a request spent queued waiting for a connection. */
  avgAcquireMs: number;
}

/**
 * Read every live pool. Cheap and synchronous — `enableStatistics: true` at
 * pool creation makes `getStatistics()` a plain in-memory read, not a network
 * call — so it is safe to call from a Prometheus scrape.
 */
export function poolSnapshots(): OraclePoolSnapshot[] {
  return [...pools.entries()].map(([dataSourceId, pool]) => {
    const stats = pool.getStatistics();
    return {
      dataSourceId,
      open: pool.connectionsOpen,
      inUse: pool.connectionsInUse,
      max: POOL_MAX,
      waiting: stats?.currentQueueLength ?? 0,
      acquireFailures: stats?.failedRequests ?? 0,
      avgAcquireMs: stats?.averageTimeInQueue ?? 0,
    };
  });
}

export function timedOutAcquisitions(): number {
  return acquisitionsTimedOut;
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
