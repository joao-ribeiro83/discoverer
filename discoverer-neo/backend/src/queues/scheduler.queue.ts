import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from './export.queue.js';

export const SCHEDULER_QUEUE_NAME = 'scheduler';
export const RUN_SCHEDULE_JOB = 'run-schedule';

/** Payload of a `scheduler` job — deliberately just an id, resolved fresh from
 * the DB when the job runs so an edited schedule is never executed stale. */
export interface ScheduleJobData {
  scheduleId: string;
  /** True for a user-initiated "Run now"; false for a cron-driven fire. */
  manual: boolean;
  /** The user who requested a manual trigger (absent for cron-driven runs). */
  triggeredBy?: string;
}

export const SCHEDULE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600, count: 1_000 },
};

let queue: Queue<ScheduleJobData> | undefined;

/** Lazily-created singleton so importing this module never opens a socket. */
export function schedulerQueue(): Queue<ScheduleJobData> {
  queue ??= new Queue<ScheduleJobData>(SCHEDULER_QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: SCHEDULE_JOB_OPTIONS,
  });
  return queue;
}

/**
 * Register (or replace) the recurring job that fires this schedule. Uses
 * BullMQ's Job Scheduler API — `startDate`/`endDate` map directly onto the
 * schedule's validity window, so BullMQ itself refuses to enqueue a run
 * outside it; the worker only needs to re-check isActive (a scheduler can be
 * toggled off without touching the window).
 */
export async function upsertScheduleJob(
  scheduleId: string,
  cronExpression: string,
  timezone: string,
  validFrom: Date | null,
  validUntil: Date | null,
): Promise<void> {
  await schedulerQueue().upsertJobScheduler(
    scheduleId,
    {
      pattern: cronExpression,
      tz: timezone,
      ...(validFrom ? { startDate: validFrom } : {}),
      ...(validUntil ? { endDate: validUntil } : {}),
    },
    {
      name: RUN_SCHEDULE_JOB,
      data: { scheduleId, manual: false },
    },
  );
}

/** Unregister a schedule's recurring job. Safe to call even if none exists. */
export async function removeScheduleJob(scheduleId: string): Promise<void> {
  await schedulerQueue().removeJobScheduler(scheduleId);
}

/** Queue a one-off run outside the recurring cadence ("Run now"). */
export async function enqueueManualTrigger(
  scheduleId: string,
  triggeredBy: string,
): Promise<void> {
  await schedulerQueue().add(
    RUN_SCHEDULE_JOB,
    { scheduleId, manual: true, triggeredBy },
    // No jobId dedup here (unlike exports): a user can legitimately fire
    // several manual runs of the same schedule back to back.
  );
}

export async function closeSchedulerQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
