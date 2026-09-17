import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { buildApp } from './app.js';
import { config } from './config.js';
import { verifyOracleClient } from './services/oracle-connection-pool.js';
import { db, pool as postgresPool } from './db/index.js';
import { seed } from './db/seed.js';
import { writeCredentialFile } from './services/credential-file.service.js';
import { generateTemporaryPassword } from './services/migration.service.js';
import type { FastifyInstance } from 'fastify';

/** Max time to let in-flight requests (and onClose hooks) finish before forcing exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Arbitrary fixed key for a Postgres session advisory lock. Scaling to
// multiple backend replicas (docs/deployment/docker.md "Multiple Backend
// Instances") means several processes can call ensureDatabaseReady() at
// once; without serializing them here, two could both see an empty `users`
// table and both run seed()'s destructive delete-then-insert concurrently.
const STARTUP_LOCK_KEY = 7_927_384_950_123;

/**
 * Applies pending Drizzle migrations, then seeds the admin account when the
 * database has no users yet. Runs on every boot — migrate is a no-op once
 * caught up, and the seed only fires on a genuinely empty `users` table — so
 * a restart against an already-provisioned database does nothing. Without
 * this, a fresh `docker compose up --build` starts the API against an
 * empty, unmigrated database and admin@discoverer.local never gets created.
 *
 * The whole sequence runs under a Postgres advisory lock held on a single
 * dedicated connection, so concurrently starting replicas queue up instead
 * of racing: only one can ever be inside the empty-check-then-seed section
 * at a time, and by the time the next one gets the lock the table is no
 * longer empty.
 */
async function ensureDatabaseReady(app: FastifyInstance) {
  const client = await postgresPool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [STARTUP_LOCK_KEY]);

    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });

    const { rows } = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM users',
    );
    if (Number(rows[0]?.count ?? 0) === 0) {
      // A random, single-use password — never the well-known `admin123` that
      // `npm run db:seed` uses for local dev — because this path runs
      // unattended against whatever database a fresh `docker compose up`
      // happens to be pointed at, including a real deployment. Handed off
      // the same way the EUL migration hands off passwords it provisions:
      // a 0600 file in CREDENTIALS_DIR, never logged (credential-file.service.ts).
      const temporaryPassword = generateTemporaryPassword();
      await seed({ password: temporaryPassword, mustChangePassword: true });
      const { path: credentialsFile } = await writeCredentialFile([
        { username: 'admin', email: 'admin@discoverer.local', temporaryPassword },
      ]);
      app.log.warn(
        { credentialsFile },
        'No users found — seeded initial admin account with a one-time password; ' +
          'retrieve it from the credentials file above and change it at first login',
      );
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [STARTUP_LOCK_KEY]);
    client.release();
  }
}

async function main() {
  const app = await buildApp();

  await ensureDatabaseReady(app);

  // Fail fast on an image that has thick mode switched on but carries no
  // Instant Client. Deliberately here rather than in buildApp(), which the
  // integration suite calls — tests should not need a client to build the app.
  try {
    await verifyOracleClient();
    if (config.ORACLE_THICK_MODE) {
      app.log.info(
        { clientPath: config.ORACLE_CLIENT_PATH },
        'Oracle Instant Client loaded (thick mode)',
      );
    }
  } catch (err) {
    app.log.error({ err }, 'Oracle thick mode is enabled but the client is unusable');
    process.exit(1);
  }

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    // A second signal (e.g. an impatient double Ctrl-C) must not re-enter —
    // app.close() is not safely re-callable mid-close.
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info(
      `Received ${signal}, shutting down gracefully (stop accepting new ` +
        `connections, drain in-flight requests, close DB/Redis/Oracle — max ` +
        `${SHUTDOWN_TIMEOUT_MS}ms)...`,
    );

    const forceExitTimer = setTimeout(() => {
      app.log.error(
        `Graceful shutdown did not finish within ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`,
      );
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // Stops the HTTP server from accepting new connections immediately,
      // waits for in-flight requests to complete, then runs every plugin's
      // onClose hook (export/scheduler workers, BullMQ queues, Oracle pools,
      // Redis — see app.ts and plugins/redis.ts).
      await app.close();
      app.log.info('Closing Postgres connection pool...');
      await postgresPool.end();
      clearTimeout(forceExitTimer);
      app.log.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExitTimer);
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void main();
