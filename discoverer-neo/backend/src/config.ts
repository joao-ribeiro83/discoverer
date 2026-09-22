import { z } from 'zod';

/**
 * The published development defaults for the two secrets that protect stored
 * data. Both are printed in this repository, so a production deployment still
 * running on either is running on a public secret.
 *
 * Held in one table so the schema defaults below and `assertProductionSecrets`
 * cannot drift apart — a guard that checks a string the schema no longer uses
 * passes for the wrong reason.
 */
export const INSECURE_DEFAULTS = {
  JWT_SECRET: 'dev-only-insecure-secret-change-me',
  ENCRYPTION_KEY: 'dev-only-insecure-encryption-key-change-me',
} as const;

/** An optional NLS setting: validated when present, absent when blank. */
const optionalNls = (pattern: RegExp, message: string) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().regex(pattern, message).optional(),
  );

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/discoverer_neo'),

  /**
   * Postgres connection-pool ceiling. Defaults to node-postgres' own 10.
   *
   * Exposed because it is the first thing to reach for under load, but note
   * that benchmarking did *not* find it to be the constraint: at 25 concurrent
   * users, raising it to 25 moved p95 by ~11% with metadata caching off, and by
   * nothing measurable with caching on (the cache removes the reads that were
   * competing for connections in the first place). Raise it only for workloads
   * that miss the cache heavily — many distinct business areas, or frequent
   * metadata writes — and measure rather than assuming.
   *
   * Connections are a shared, limited resource: this ceiling, every worker
   * process, and any psql session all draw on Postgres' max_connections (100 by
   * default). Raise the two together, not this alone.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  /** Ms an idle pooled connection is kept before being closed. */
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
  /** Ms to wait for a free connection before failing the request. */
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(10_000),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  /**
   * Read-through Redis caching of EUL metadata (see lib/metadata-cache.ts).
   *
   * On by default. Turn it off to rule the cache out when diagnosing metadata
   * that looks stale — every read then goes straight to Postgres, at the cost
   * of roughly a third of peak throughput under concurrency.
   */
  METADATA_CACHE_ENABLED: z.enum(['true', 'false']).default('true'),
  /** Seconds a cached metadata entry survives without explicit invalidation. */
  METADATA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  JWT_SECRET: z.string().min(16).default(INSECURE_DEFAULTS.JWT_SECRET),
  /** Access token lifetime. Short on purpose: the client renews it with a refresh token. */
  JWT_EXPIRES_IN: z.string().default('15m'),
  /**
   * Session lifetime from login, in seconds. Refresh tokens rotate on every
   * use, but rotation keeps this expiry, so no session outlives it.
   */
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),

  /**
   * Fastify `trustProxy`: "false", "true", a hop count ("1"), or a list of
   * trusted addresses/CIDRs. Behind a reverse proxy, set it so login rate
   * limiting counts the client's IP rather than the proxy's — otherwise one
   * attacker's failures throttle everyone. Never set it while the backend
   * port is also reachable directly: a direct caller could then choose its IP.
   */
  TRUST_PROXY: z.string().default('false'),
  /** Fixed window in which failed logins are counted, per IP and per account. */
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  /** Failed logins from one IP, across all accounts, before that IP gets 429. */
  LOGIN_MAX_FAILURES_PER_IP: z.coerce.number().int().positive().default(100),
  /** Failed logins to one account before it is temporarily locked. */
  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  /** How long a locked account stays locked. It never extends while locked. */
  LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(15 * 60),

  /**
   * What row-level security does with a folder no policy gives the executing
   * user rows on, per policy type (`security_policies.policy_type`, where only
   * `ROW_LEVEL` exists).
   *
   * `CLOSED`, the default, refuses the query: no policy means no rows, and
   * removing or disabling a policy can only ever take rows away. This is Neo's
   * one deliberate incompatibility with Discoverer, whose row-level security
   * failed open (D-090). `OPEN` refuses only a folder that some active policy
   * already targets (D-116) and runs every other folder unfiltered — for a
   * deployment that has not written its policies yet.
   */
  ROW_LEVEL_FAIL_MODE: z.enum(['CLOSED', 'OPEN']).default('CLOSED'),

  /**
   * Use node-oracledb thick mode, which requires the Oracle Instant Client.
   *
   * Thin mode is the default and needs no client, but it cannot connect to
   * databases older than 12.1. Enable this only for legacy EUL sources (11.2
   * and up); it also unlocks native network encryption, LDAP naming, and
   * sqlnet.ora, none of which thin mode reads.
   *
   * The image only carries a client when built with
   * --build-arg INSTALL_ORACLE_CLIENT=true, so turning this on against a
   * default image is a configuration error and fails fast at startup.
   */
  ORACLE_THICK_MODE: z.enum(['true', 'false']).default('false'),
  /** Instant Client directory. Only read when ORACLE_THICK_MODE is enabled. */
  ORACLE_CLIENT_PATH: z.string().default('/opt/oracle/instantclient'),

  /**
   * Oracle connection-pool sizing, applied per data source.
   *
   * These are per-pool, not global: a deployment with four Oracle sources can
   * hold 4 x ORACLE_POOL_MAX sessions open, which has to fit inside the
   * database's own `sessions`/`processes` limits. Size against the number of
   * *concurrent map executions* expected per source, not total users — a map
   * execution holds one connection for the life of the query, and exports hold
   * one for minutes (see EXPORT_WORKER_CONCURRENCY, which claims against the
   * same pool).
   */
  ORACLE_POOL_MIN: z.coerce.number().int().nonnegative().max(100).default(2),
  ORACLE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  ORACLE_POOL_INCREMENT: z.coerce.number().int().positive().max(50).default(1),
  /** Seconds an idle Oracle connection may sit in the pool before closing. */
  ORACLE_POOL_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().nonnegative().default(300),
  /** Max ms to wait to acquire an Oracle connection (queue + establish). */
  ORACLE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  /**
   * NLS settings applied to every Oracle session this app opens.
   *
   * Discoverer ran each user's queries under that user's own NLS, and the
   * formulas its authors wrote assume it. This estate has
   * `TO_NUMBER(REPLACE("PREMIO_MIN", '.', ','))` — swap the dot for a comma,
   * which only reads as a number where the comma IS the decimal separator.
   * The session opened here had `NLS_NUMERIC_CHARACTERS = '.,'`, so the map
   * failed with ORA-01722 on data reading `458.33`, and the client saw only
   * "The query could not be completed".
   *
   * Three named settings rather than free text: an `ALTER SESSION` built from
   * an arbitrary string is an injection surface, and each of these has a shape
   * narrow enough to validate. Unset means "leave the session as the database
   * hands it over", which is the old behaviour.
   */
  //
  // `optionalNls` treats an empty string as absent: compose writes
  // `${VAR:-}` as "", not as an unset variable, so a plain `.optional()`
  // rejects every deployment that simply left the setting alone.
  ORACLE_NLS_NUMERIC_CHARACTERS: optionalNls(
    /^[^0-9+-]{2}$/,
    'must be exactly two characters: decimal separator then group separator',
  ),
  ORACLE_NLS_DATE_FORMAT: optionalNls(
    /^[A-Za-z0-9 ,./:-]{1,40}$/,
    'must be an Oracle date format mask',
  ),
  ORACLE_NLS_DATE_LANGUAGE: optionalNls(
    /^[A-Za-z ]{1,40}$/,
    'must be an Oracle NLS language name',
  ),

  /**
   * How long a map's statement may run on Oracle.
   *
   * These were a pair of hard-coded 30-second constants with no way to raise
   * them, which is not what this application replaces: a Discoverer estate
   * runs reports that take minutes, and scheduled workbooks exist precisely
   * because some take far longer. A 30-second ceiling turns an ordinary
   * end-of-month report into "Query timed out".
   *
   * `QUERY_TIMEOUT_MS` is what a request gets when it asks for nothing;
   * `QUERY_TIMEOUT_MAX_MS` is the ceiling a request may ask for, and 30
   * minutes matches what the estate's own users expect.
   *
   * **This is not a wall-clock limit.** It becomes `connection.callTimeout`,
   * which in thick mode bounds each ROUND TRIP rather than the statement: a
   * query making two round trips under the limit can take twice it in total.
   * Measured — a 5-minute setting let a real map run for ten before Oracle
   * raised ORA-03156. Treat it as "no single round trip may stall for longer
   * than this", and use the background run when a hard bound matters.
   *
   * A long SYNCHRONOUS run also has to survive everything between the browser
   * and the backend — `proxy_read_timeout` in `frontend/nginx.conf` is the one
   * that bites, and it is set to match. For anything genuinely long the
   * background run is the better tool: it polls, so no single request has to
   * stay open at all.
   */
  QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  QUERY_TIMEOUT_MAX_MS: z.coerce.number().int().positive().default(1_800_000),

  /**
   * Seconds a list-of-values page stays cached in Redis.
   *
   * The query behind a pick-list is a `SELECT DISTINCT` over a fact table —
   * 16-27 seconds each, measured. At the previous 120 seconds a person opening
   * the same prompt twice in a sitting paid it twice. The values are a prompt,
   * not an answer: whatever is picked is then queried live.
   */
  LOV_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),

  /**
   * Export jobs processed concurrently by one worker process.
   *
   * Deliberately explicit rather than left to BullMQ's default. Each export
   * holds an Oracle connection for its entire duration (minutes, for a
   * multi-million-row result), and the connection pool is capped at 10 per
   * data source. Worker concurrency is global while pools are per-data-source,
   * so in the worst case every concurrent export targets the same source —
   * meaning this value is effectively a claim against a single pool of 10.
   * Keeping it well under that leaves headroom for interactive map execution,
   * which would otherwise queue behind exports.
   */
  EXPORT_WORKER_CONCURRENCY: z.coerce.number().int().positive().max(8).default(3),
  /**
   * Run the export worker in this process. Disable when running it standalone.
   * Unset means "on, unless this is a test run" — see below.
   */
  EXPORT_WORKER_ENABLED: z.enum(['true', 'false']).optional(),
  /** Days a generated export file is retained before cleanup removes it. */
  EXPORT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  /** How often the retention sweep runs, in minutes. */
  EXPORT_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  /**
   * Directory for generated export files. Defaults to a path under the backend
   * working directory; the container mounts a volume at /app/exports.
   */
  EXPORT_DIR: z.string().optional(),

  /**
   * Run the map-run worker in this process. Disable when running it
   * standalone. Unset means "on, unless this is a test run" — see below.
   */
  MAP_RUN_WORKER_ENABLED: z.enum(['true', 'false']).optional(),
  /** Map-run jobs processed concurrently by one worker process, across all users. */
  MAP_RUN_WORKER_CONCURRENCY: z.coerce.number().int().positive().max(8).default(3),
  /** Hours a live (unsaved) map run's result is kept before expiry; clamped to 24 by liveExpiry. */
  MAP_RUN_LIVE_TTL_HOURS: z.coerce.number().int().positive().default(24),
  /** Row cap a map run's result is truncated to. */
  MAP_RUN_MAX_ROWS: z.coerce.number().int().positive().default(100000),
  /** Rows written per JSONB batch when persisting a map run's result. */
  MAP_RUN_BATCH_SIZE: z.coerce.number().int().positive().default(1000),
  /** How often the map-run cleanup sweep runs, in minutes. */
  MAP_RUN_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  /** Hours after which a QUEUED/RUNNING map run is considered stale and marked FAILED. */
  MAP_RUN_STALE_HOURS: z.coerce.number().int().positive().default(24),

  /**
   * Run the scheduler worker (cron-driven map runs) in this process. Unset
   * means "on, unless this is a test run" — mirrors EXPORT_WORKER_ENABLED,
   * since `buildApp()` is also called by the integration suite.
   */
  SCHEDULER_WORKER_ENABLED: z.enum(['true', 'false']).optional(),
  /**
   * Directory for files produced by scheduled runs. Kept separate from
   * EXPORT_DIR — a scheduled result outlives any single ad-hoc export job and
   * is cleaned up on its own schedule rather than the export retention sweep.
   */
  SCHEDULE_RESULT_DIR: z.string().optional(),

  /**
   * Where the migration writes its temporary-password file.
   *
   * A dedicated directory, NOT shared with EXPORT_DIR or SCHEDULE_RESULT_DIR:
   * those are streamed to users by authenticated download routes, and a file
   * of working credentials must not sit anywhere the app knows how to serve.
   * Bind-mount it to the host so an operator can collect the file and delete
   * it; nothing reads it back.
   */
  CREDENTIALS_DIR: z.string().default('storage/credentials'),

  /**
   * Hours a temporary-password file survives before the sweep deletes it.
   *
   * The file is meant to be read once, distributed, and deleted by hand. It
   * never was: nine of them sat on disk for weeks. So the deletion is now the
   * application's job, and this is the grace period an operator gets to
   * collect one. Shorten it where credentials are distributed promptly.
   */
  CREDENTIAL_FILE_TTL_HOURS: z.coerce.number().int().positive().default(24),

  /**
   * Comma-separated origins allowed to make credentialed cross-origin
   * requests (INF-13). `@fastify/cors` was reflecting whatever `Origin` the
   * caller sent — with `credentials: true`, that lets any site ride a
   * logged-in user's cookies/session. An exact-match allowlist closes it;
   * there is no wildcard mode because credentials require an exact match.
   */
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // 32+ char key used for AES-256-GCM encryption of stored credentials.
  ENCRYPTION_KEY: z.string().min(32).default(INSECURE_DEFAULTS.ENCRYPTION_KEY),
})
  // oracledb rejects a pool whose min exceeds its max, but only when the first
  // pool is built — which may be hours after boot. Catch it at startup instead.
  .refine((c) => c.ORACLE_POOL_MIN <= c.ORACLE_POOL_MAX, {
    message: 'ORACLE_POOL_MIN must not exceed ORACLE_POOL_MAX',
    path: ['ORACLE_POOL_MIN'],
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
  process.exit(1);
}

/**
 * Refuse to run in production on a secret published in this repository.
 *
 * Throws rather than warns: a warning in a container log is a warning nobody
 * reads, and the failure it precedes is silent — every stored Oracle password
 * protected by a key anyone can look up. Development is untouched, so the
 * default stays frictionless where it belongs.
 *
 * A pure function over its input, so the test can assert each default in turn
 * without booting a production process.
 */
export function assertProductionSecrets(env: {
  NODE_ENV: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
}): void {
  if (env.NODE_ENV !== 'production') return;

  const offenders = (
    Object.keys(INSECURE_DEFAULTS) as (keyof typeof INSECURE_DEFAULTS)[]
  ).filter((name) => env[name] === INSECURE_DEFAULTS[name]);
  if (offenders.length === 0) return;

  throw new Error(
    `Refusing to start in production: ${offenders.join(' and ')} ` +
      `${offenders.length === 1 ? 'is' : 'are'} still set to the development ` +
      'default published in this repository. Generate a replacement with ' +
      "'openssl rand -hex 32' and set it in the environment. Changing " +
      'ENCRYPTION_KEY on a deployment that already stores credentials also ' +
      'needs a re-encryption pass first — see docs/deployment/configuration.md.',
  );
}

assertProductionSecrets(parsed.data);

export const config = {
  ...parsed.data,
  ORACLE_THICK_MODE: parsed.data.ORACLE_THICK_MODE === 'true',
  /**
   * Default the in-process worker on everywhere except tests: `buildApp()` is
   * called by the integration suite, and a worker started there would open a
   * Redis connection and start consuming the same queue as a real instance.
   * Set the env var explicitly to override in either direction.
   */
  EXPORT_WORKER_ENABLED:
    parsed.data.EXPORT_WORKER_ENABLED === undefined
      ? parsed.data.NODE_ENV !== 'test'
      : parsed.data.EXPORT_WORKER_ENABLED === 'true',
  MAP_RUN_WORKER_ENABLED:
    parsed.data.MAP_RUN_WORKER_ENABLED === undefined
      ? parsed.data.NODE_ENV !== 'test'
      : parsed.data.MAP_RUN_WORKER_ENABLED === 'true',
  SCHEDULER_WORKER_ENABLED:
    parsed.data.SCHEDULER_WORKER_ENABLED === undefined
      ? parsed.data.NODE_ENV !== 'test'
      : parsed.data.SCHEDULER_WORKER_ENABLED === 'true',
  METADATA_CACHE_ENABLED: parsed.data.METADATA_CACHE_ENABLED === 'true',
  CORS_ALLOWED_ORIGINS: parsed.data.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
};
export type Config = typeof config;
