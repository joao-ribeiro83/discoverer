import { buildApp } from './app.js';
import { config } from './config.js';
import { verifyOracleClient } from './services/oracle-connection-pool.js';
import { pool as postgresPool } from './db/index.js';

/** Max time to let in-flight requests (and onClose hooks) finish before forcing exit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  const app = await buildApp();

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
