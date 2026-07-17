import { Worker, type Job } from 'bullmq';
import { config } from '../config.js';
import {
  EXPORT_QUEUE_NAME,
  redisConnection,
  type ExportJobData,
} from '../queues/export.queue.js';
import {
  processExportJob,
  failExportJob,
  cleanupOldExports,
} from '../services/export.service.js';
import { recordExportOutcome, setExportQueueDepth } from '../plugins/metrics.js';

// ---------------------------------------------------------------------------
// The export worker.
//
// Runs in the API process by default (see `EXPORT_WORKER_ENABLED`), but nothing
// here reaches into Fastify: `startExportWorker` is self-contained so
// `workers/export.standalone.ts` can run the identical code in its own
// container. Splitting them is then a deploy-config change, not a rewrite.
// ---------------------------------------------------------------------------

export interface ExportWorkerHandle {
  worker: Worker<ExportJobData>;
  /** Stops the retention sweep and drains in-flight jobs. */
  close(): Promise<void>;
}

/**
 * The logging surface this worker needs. Structurally satisfied by both a bare
 * pino logger (standalone entrypoint) and Fastify's `app.log` (in-process), so
 * neither host has to be cast to the other's type.
 */
export interface WorkerLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * Whether BullMQ will retry this job. Only once it won't do we mark the row
 * FAILED — surfacing a transient fault that a retry then fixes would be a lie
 * to whoever is watching the status.
 *
 * Exported for testing: this predicate decides whether a user sees a failure,
 * so it is worth pinning independently of a live Redis.
 */
export function attemptsExhausted(
  job: Pick<Job<ExportJobData>, 'attemptsMade' | 'opts'> | undefined,
): boolean {
  if (!job) return true;
  const max = job.opts.attempts ?? 1;
  return job.attemptsMade >= max;
}

export function startExportWorker(logger: WorkerLogger): ExportWorkerHandle {
  const worker = new Worker<ExportJobData>(
    EXPORT_QUEUE_NAME,
    async (job: Job<ExportJobData>) => {
      const result = await processExportJob(job.data);
      // Mirror onto the BullMQ job so `/metrics` and any queue UI agree with
      // the `export_jobs` row.
      await job.updateProgress(100);
      return result;
    },
    {
      connection: redisConnection(),
      // Explicit, and intentionally well below the Oracle pool's 10-per-data-
      // source ceiling: each export holds a connection for its whole duration,
      // so unbounded concurrency here would starve interactive map execution.
      concurrency: config.EXPORT_WORKER_CONCURRENCY,
    },
  );

  worker.on('completed', (job, result: { rowCount?: number } | undefined) => {
    recordExportOutcome('completed');
    logger.info(
      { jobId: job.id, rowCount: result?.rowCount },
      'Export job completed',
    );
  });

  worker.on('failed', (job, err) => {
    const exhausted = attemptsExhausted(job);
    logger.error(
      {
        jobId: job?.id,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts.attempts,
        willRetry: !exhausted,
        err,
      },
      'Export job attempt failed',
    );

    if (!job || !exhausted) return;
    recordExportOutcome('failed');
    void failExportJob(job.data.exportJobId, err.message).catch((markErr: unknown) => {
      logger.error({ jobId: job.id, err: markErr }, 'Could not mark export FAILED');
    });
  });

  worker.on('error', (err) => {
    // Connection-level faults arrive here rather than on a job.
    logger.error({ err }, 'Export worker error');
  });

  // Retention sweep. `unref` so a pending timer never holds the process open.
  const cleanupTimer = setInterval(
    () => {
      void cleanupOldExports()
        .then(({ deleted, errors }) => {
          if (deleted || errors) {
            logger.info({ deleted, errors }, 'Export retention sweep finished');
          }
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Export retention sweep failed');
        });
    },
    config.EXPORT_CLEANUP_INTERVAL_MINUTES * 60 * 1000,
  );
  cleanupTimer.unref();

  // Queue-depth gauges, so event-loop lag can be read against real load.
  const metricsTimer = setInterval(() => {
    void worker.client
      .then(async () => {
        const { exportQueue } = await import('../queues/export.queue.js');
        const counts = await exportQueue().getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
        );
        setExportQueueDepth(counts);
      })
      .catch(() => {
        // Metrics are advisory; never let them disturb the worker.
      });
  }, 15_000);
  metricsTimer.unref();

  logger.info(
    { concurrency: config.EXPORT_WORKER_CONCURRENCY },
    'Export worker started',
  );

  return {
    worker,
    close: async () => {
      clearInterval(cleanupTimer);
      clearInterval(metricsTimer);
      await worker.close();
    },
  };
}
