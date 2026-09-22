import { DelayedError, Worker, type Job } from 'bullmq';
import { config } from '../config.js';
import { redisConnection } from '../queues/export.queue.js';
import { MAP_RUN_QUEUE_NAME, mapRunQueue, type MapRunJobData } from '../queues/map-run.queue.js';
import { processMapRun } from '../services/map-run.runner.js';
import { cleanupExpiredRuns } from '../services/map-run.store.js';
import { setMapRunQueueDepth } from '../plugins/metrics.js';
import type { WorkerLogger } from './export.worker.js';

// ---------------------------------------------------------------------------
// The map-run worker. Same in-process-by-default / standalone-ready split as
// the export worker (see `workers/map-run.standalone.ts`).
// ---------------------------------------------------------------------------

export interface MapRunWorkerHandle {
  /** Stops the expiry sweep and drains in-flight jobs. */
  close(): Promise<void>;
}

const BUSY_RETRY_MS = 2_000;

export function startMapRunWorker(logger: WorkerLogger): MapRunWorkerHandle {
  const worker = new Worker<MapRunJobData>(
    MAP_RUN_QUEUE_NAME,
    async (job: Job<MapRunJobData>, token?: string) => {
      const outcome = await processMapRun(job.data.runId);
      if (outcome === 'busy') {
        // The same user has a run in flight or an older one queued: park this
        // job and try again. DelayedError tells BullMQ it is not a failure.
        // ponytail: 2 s re-poll; move to a per-user BullMQ group if the queue ever holds thousands of waiting runs
        await job.moveToDelayed(Date.now() + BUSY_RETRY_MS, token);
        throw new DelayedError();
      }
      return outcome;
    },
    {
      connection: redisConnection(),
      // Across users; each running job holds one Oracle connection.
      concurrency: config.MAP_RUN_WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    // The runner records query failures on the run row; reaching here means
    // the store itself failed, so the row may still say RUNNING until the
    // stale sweep.
    logger.error({ jobId: job?.id, err }, 'Map-run job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Map-run worker error');
  });

  // Expiry sweep. `unref` so a pending timer never holds the process open.
  const cleanupTimer = setInterval(
    () => {
      void cleanupExpiredRuns(new Date(), config.MAP_RUN_STALE_HOURS)
        .then(({ deleted, staleFailed }) => {
          if (deleted || staleFailed) {
            logger.info({ deleted, staleFailed }, 'Map-run expiry sweep finished');
          }
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Map-run expiry sweep failed');
        });
    },
    config.MAP_RUN_CLEANUP_INTERVAL_MINUTES * 60 * 1000,
  );
  cleanupTimer.unref();

  // Queue-depth gauges, so event-loop lag can be read against real load.
  const metricsTimer = setInterval(() => {
    void mapRunQueue()
      .getJobCounts('waiting', 'active', 'delayed', 'failed')
      .then(setMapRunQueueDepth)
      .catch(() => {
        // Metrics are advisory; never let them disturb the worker.
      });
  }, 15_000);
  metricsTimer.unref();

  logger.info(
    { concurrency: config.MAP_RUN_WORKER_CONCURRENCY },
    'Map-run worker started',
  );

  return {
    close: async () => {
      clearInterval(cleanupTimer);
      clearInterval(metricsTimer);
      await worker.close();
    },
  };
}
