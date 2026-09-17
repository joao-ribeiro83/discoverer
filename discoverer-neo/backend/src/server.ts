import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { buildApp } from './app.js';
import { config } from './config.js';
import { verifyOracleClient } from './services/oracle-connection-pool.js';
import { db, pool as postgresPool } from './db/index.js';
import { users } from './db/schema.js';
import { seed } from './db/seed.js';

/** Max time to let in-flight requests (and onClose hooks) finish before forcing exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const app = await buildApp();

  // Applies pending Drizzle migrations, then seeds the admin account when the
  // database has no users yet. Runs on every boot — migrate is a no-op once
  // caught up, and the seed only fires on a genuinely empty `users` table —
  // so a container restart against an already-provisioned database is a
  // no-op too. Without this, a fresh `docker compose up --build` starts the
  // API against an empty, unmigrated database and admin@discoverer.local
  // never gets created.
  await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (Number(row?.count ?? 0) === 0) {
    app.log.info('No users found — seeding initial admin account');
    await seed();
  }

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
