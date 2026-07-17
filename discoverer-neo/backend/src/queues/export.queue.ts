import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { config } from '../config.js';
import type { CalcFieldInput } from '../services/calculated-field-evaluator.js';

export const EXPORT_QUEUE_NAME = 'exports';

/** Payload of an `exports` job. Kept small — it is serialised into Redis. */
export interface ExportJobData {
  /** The `export_jobs` row this job writes its progress and result to. */
  exportJobId: string;
  mapId: string;
  format: 'XLSX' | 'CSV';
  requestedBy: string;
  parameters?: Record<string, unknown>;
  calculatedFields?: CalcFieldInput[];
}

export const EXPORT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  // A failed export is usually a transient Oracle/network fault, so back off
  // rather than hammering a struggling database with immediate retries.
  backoff: { type: 'exponential', delay: 5_000 },
  // Keep a bounded history: the durable record of an export lives in the
  // `export_jobs` table, so Redis only needs enough to debug recent activity.
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 24 * 3_600, count: 1_000 },
};

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the connection used by a
 * Worker; sharing one options object keeps the Queue and Worker consistent.
 */
export function redisConnection(): ConnectionOptions {
  return { url: config.REDIS_URL, maxRetriesPerRequest: null };
}

let queue: Queue<ExportJobData> | undefined;

/** Lazily-created singleton so importing this module never opens a socket. */
export function exportQueue(): Queue<ExportJobData> {
  queue ??= new Queue<ExportJobData>(EXPORT_QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: EXPORT_JOB_OPTIONS,
  });
  return queue;
}

export async function closeExportQueue(): Promise<void> {
  await queue?.close();
  queue = undefined;
}
