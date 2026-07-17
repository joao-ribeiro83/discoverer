import { pino } from 'pino';
import { config } from '../config.js';
import { closeExportQueue } from '../queues/export.queue.js';
import { startExportWorker } from './export.worker.js';

// ---------------------------------------------------------------------------
// Standalone export worker entrypoint (`npm run worker`).
//
// The same `startExportWorker` the API process uses, hosted in a bare process
// instead. This exists so moving exports off the API box is a deploy-config
// change — set `EXPORT_WORKER_ENABLED=false` on the API and run this as its own
// service — rather than a code change made under pressure.
//
// Whether that split is warranted is a question for the event-loop-lag metric
// (`nodejs_eventloop_lag_seconds`), not for guesswork: an in-process worker
// competes with request handling, and this is the escape hatch if it shows.
// ---------------------------------------------------------------------------

const logger = pino({ level: config.LOG_LEVEL, name: 'export-worker' });

const handle = startExportWorker(logger);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down export worker');
  try {
    // Lets in-flight exports finish rather than orphaning half-written files.
    await handle.close();
    await closeExportQueue();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during export worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
