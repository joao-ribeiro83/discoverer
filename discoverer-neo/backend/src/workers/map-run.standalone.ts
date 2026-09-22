import { pino } from 'pino';
import { config } from '../config.js';
import { closeMapRunQueue } from '../queues/map-run.queue.js';
import { startMapRunWorker } from './map-run.worker.js';

// ---------------------------------------------------------------------------
// Standalone map-run worker entrypoint (`npm run worker:map-runs`).
//
// Same rationale as export.standalone.ts: moving map runs off the API box is
// then a deploy-config change (MAP_RUN_WORKER_ENABLED=false on the API, run
// this as its own service) rather than a code change.
// ---------------------------------------------------------------------------

const logger = pino({ level: config.LOG_LEVEL, name: 'map-run-worker' });

const handle = startMapRunWorker(logger);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down map-run worker');
  try {
    await handle.close();
    await closeMapRunQueue();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during map-run worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
