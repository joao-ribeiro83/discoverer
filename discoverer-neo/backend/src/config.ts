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
  JWT_EXPIRES_IN: z.string().default('7d'),

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
  SCHEDULER_WORKER_ENABLED:
    parsed.data.SCHEDULER_WORKER_ENABLED === undefined
      ? parsed.data.NODE_ENV !== 'test'
      : parsed.data.SCHEDULER_WORKER_ENABLED === 'true',
  METADATA_CACHE_ENABLED: parsed.data.METADATA_CACHE_ENABLED === 'true',
};
export type Config = typeof config;
