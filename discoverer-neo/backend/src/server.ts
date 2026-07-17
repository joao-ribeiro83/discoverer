import { buildApp } from './app.js';
import { config } from './config.js';
import { verifyOracleClient } from './services/oracle-connection-pool.js';

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

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
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
