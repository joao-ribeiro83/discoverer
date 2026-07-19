import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../queues/export.queue.js';
import { SCHEDULER_QUEUE_NAME, type ScheduleJobData } from '../queues/scheduler.queue.js';
import {
  processScheduleRun,
  recordScheduleFailure,
  ScheduleRunError,
} from '../services/scheduler.service.js';
import { recordScheduleOutcome } from '../plugins/metrics.js';

// ---------------------------------------------------------------------------
// The scheduler worker.
//
// Runs in the API process by default (EXPORT_WORKER_ENABLED's sibling flag,
// SCHEDULER_WORKER_ENABLED), with a standalone entrypoint ready in
// `scheduler.standalone.ts` — identical split rationale as the export worker.
// ---------------------------------------------------------------------------

export interface SchedulerWorkerHandle {
  worker: Worker<ScheduleJobData>;
  close(): Promise<void>;
}

export interface WorkerLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/** Mirrors export.worker.ts's `attemptsExhausted` — only fail the row once BullMQ won't retry. */
export function attemptsExhausted(
  job: Pick<Job<ScheduleJobData>, 'attemptsMade' | 'opts'> | undefined,
): boolean {
  if (!job) return true;
  const max = job.opts.attempts ?? 1;
  return job.attemptsMade >= max;
}

export function startSchedulerWorker(logger: WorkerLogger): SchedulerWorkerHandle {
  const worker = new Worker<ScheduleJobData>(
    SCHEDULER_QUEUE_NAME,
    async (job: Job<ScheduleJobData>) => {
      return processScheduleRun(job.data.scheduleId, {
        manual: job.data.manual,
        triggeredBy: job.data.triggeredBy,
      });
    },
    {
      connection: redisConnection(),
      // A scheduled run holds an Oracle connection for its duration just like
      // an export; kept modest for the same reason (map-execution's pool cap
      // is per data source, worker concurrency is global).
      concurrency: 3,
    },
  );

  worker.on('completed', (job, result: { skipped: boolean; rowCount?: number } | undefined) => {
    recordScheduleOutcome(result?.skipped ? 'skipped' : 'completed');
    logger.info(
      { scheduleId: job.data.scheduleId, skipped: result?.skipped, rowCount: result?.rowCount },
      'Schedule run finished',
    );
  });

  worker.on('failed', (job, err) => {
    const exhausted = attemptsExhausted(job);
    logger.error(
      {
        scheduleId: job?.data.scheduleId,
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts.attempts,
        willRetry: !exhausted,
        err,
      },
      'Schedule run attempt failed',
    );

    if (!job || !exhausted) return;
    recordScheduleOutcome('failed');

    const { elapsedMs, kind } = err instanceof ScheduleRunError
      ? { elapsedMs: err.elapsedMs, kind: err.kind }
      : { elapsedMs: 0, kind: 'FAILED' as const };

    void recordScheduleFailure(job.data.scheduleId, err.message, elapsedMs, kind).catch(
      (markErr: unknown) => {
        logger.error({ scheduleId: job.data.scheduleId, err: markErr }, 'Could not record schedule failure');
      },
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Scheduler worker error');
  });

  logger.info({}, 'Scheduler worker started');

  return {
    worker,
    close: () => worker.close(),
  };
}
