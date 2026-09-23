import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from './export.queue.js';

export const MAP_RUN_QUEUE_NAME = 'map-runs';
export const RUN_MAP_JOB = 'run-map';

/** Payload of a `map-runs` job. The `map_runs` row holds everything else. */
export interface MapRunJobData {
  runId: string;
}

const MAP_RUN_JOB_OPTIONS: JobsOptions = {
  // No retry: a retry would re-run Oracle for a user who may already have hit
  // Cancel. A failure is recorded on the run row instead.
  attempts: 1,
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 24 * 3_600, count: 1_000 },
};

let queue: Queue<MapRunJobData> | undefined;

/** Lazily-created singleton so importing this module never opens a socket. */
export function mapRunQueue(): Queue<MapRunJobData> {
  queue ??= new Queue<MapRunJobData>(MAP_RUN_QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: MAP_RUN_JOB_OPTIONS,
  });
  return queue;
}

/** jobId = runId, so enqueueing the same run twice is a no-op. */
export async function enqueueRun(runId: string): Promise<void> {
  await mapRunQueue().add(RUN_MAP_JOB, { runId }, { jobId: runId });
}

export async function closeMapRunQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
