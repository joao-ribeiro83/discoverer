import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/discoverer_neo'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16).default('dev-only-insecure-secret-change-me'),
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

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // 32+ char key used for AES-256-GCM encryption of stored credentials.
  ENCRYPTION_KEY: z.string().min(32).default('dev-only-insecure-encryption-key-change-me'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error((z as any).prettifyError(parsed.error));
  process.exit(1);
}

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
};
export type Config = typeof config;
