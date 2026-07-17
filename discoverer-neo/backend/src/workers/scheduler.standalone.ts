import { pino } from 'pino';
import { config } from '../config.js';
import { closeSchedulerQueue } from '../queues/scheduler.queue.js';
import { startSchedulerWorker } from './scheduler.worker.js';

// ---------------------------------------------------------------------------
// Standalone scheduler worker entrypoint (`npm run worker:scheduler`).
//
// Same rationale as export.standalone.ts: moving cron-driven runs off the API
// box is then a deploy-config change (SCHEDULER_WORKER_ENABLED=false on the
// API, run this as its own service) rather than a code change.
// ---------------------------------------------------------------------------

const logger = pino({ level: config.LOG_LEVEL, name: 'scheduler-worker' });

const handle = startSchedulerWorker(logger);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down scheduler worker');
  try {
    await handle.close();
    await closeSchedulerQueue();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during scheduler worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
