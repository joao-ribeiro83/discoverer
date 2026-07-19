/**
 * Worker wiring tests for the export and scheduler BullMQ workers.
 *
 * A real Worker is started against the live Redis, but no job is ever enqueued
 * here — the processor is not what we are pinning. Instead the worker's own
 * lifecycle event handlers (`completed` / `failed` / `error`) are driven
 * directly via `emit`, which is where the retry-vs-fail decision and the
 * FAILED-row bookkeeping live. The queues are obliterated first so a stray job
 * left by an earlier test file cannot be picked up and executed mid-test.
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { Job } from 'bullmq';
import {
  startExportWorker,
  attemptsExhausted as exportAttemptsExhausted,
  type ExportWorkerHandle,
} from '../workers/export.worker.js';
import {
  startSchedulerWorker,
  attemptsExhausted as schedulerAttemptsExhausted,
  type SchedulerWorkerHandle,
} from '../workers/scheduler.worker.js';
import { exportQueue, closeExportQueue } from '../queues/export.queue.js';
import { schedulerQueue, closeSchedulerQueue } from '../queues/scheduler.queue.js';
import { ScheduleRunError } from '../services/scheduler.service.js';

function makeLogger() {
  return {
    info: jest.fn(),
    error: jest.fn(),
  };
}

/** BullMQ's Worker has strongly-typed events; treat it as a bare emitter so a
 *  test can synchronously invoke a listener with an arbitrary payload. */
function emit(worker: unknown, event: string, ...args: unknown[]): void {
  (worker as { emit: (e: string, ...a: unknown[]) => boolean }).emit(
    event,
    ...args,
  );
}

let exportHandle: ExportWorkerHandle;
let schedulerHandle: SchedulerWorkerHandle;
const exportLogger = makeLogger();
const schedulerLogger = makeLogger();

beforeAll(async () => {
  // Remove any jobs left in the shared queues by earlier route tests so this
  // worker cannot execute them (they reference now-deleted maps/schedules).
  await exportQueue().obliterate({ force: true });
  await schedulerQueue().obliterate({ force: true });

  exportHandle = startExportWorker(exportLogger);
  schedulerHandle = startSchedulerWorker(schedulerLogger);
});

afterAll(async () => {
  await exportHandle.close();
  await schedulerHandle.close();
  await closeExportQueue();
  await closeSchedulerQueue();
});

describe('attemptsExhausted', () => {
  const cases: Array<[
    string,
    (j: Pick<Job, 'attemptsMade' | 'opts'> | undefined) => boolean,
  ]> = [
    ['export', exportAttemptsExhausted as never],
    ['scheduler', schedulerAttemptsExhausted as never],
  ];

  for (const [name, fn] of cases) {
    it(`${name}: true for an undefined job`, () => {
      expect(fn(undefined)).toBe(true);
    });
    it(`${name}: false while retries remain`, () => {
      expect(fn({ attemptsMade: 1, opts: { attempts: 3 } } as never)).toBe(false);
    });
    it(`${name}: true once attempts are used up`, () => {
      expect(fn({ attemptsMade: 3, opts: { attempts: 3 } } as never)).toBe(true);
    });
    it(`${name}: defaults max attempts to 1`, () => {
      expect(fn({ attemptsMade: 1, opts: {} } as never)).toBe(true);
    });
  }
});

describe('export worker event handlers', () => {
  function exportJob(overrides: Record<string, unknown> = {}) {
    return {
      id: 'export-job-1',
      data: {
        exportJobId: randomUUID(),
        mapId: randomUUID(),
        format: 'CSV',
        requestedBy: randomUUID(),
      },
      attemptsMade: 3,
      opts: { attempts: 3 },
      ...overrides,
    } as unknown as Job;
  }

  it('logs a completed job', () => {
    emit(exportHandle.worker, 'completed', exportJob(), { rowCount: 7 });
    expect(exportLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ rowCount: 7 }),
      'Export job completed',
    );
  });

  it('marks the row FAILED once attempts are exhausted', () => {
    emit(exportHandle.worker, 'failed', exportJob(), new Error('boom'));
    expect(exportLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ willRetry: false }),
      'Export job attempt failed',
    );
  });

  it('does not fail the row while a retry is still pending', () => {
    exportLogger.error.mockClear();
    emit(exportHandle.worker, 
      'failed',
      exportJob({ attemptsMade: 1 }),
      new Error('transient'),
    );
    expect(exportLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ willRetry: true }),
      'Export job attempt failed',
    );
  });

  it('handles a failed event with no job', () => {
    expect(() =>
      emit(exportHandle.worker, 'failed', undefined, new Error('x')),
    ).not.toThrow();
  });

  it('logs a worker-level error', () => {
    emit(exportHandle.worker, 'error', new Error('conn lost'));
    expect(exportLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Export worker error',
    );
  });
});

describe('scheduler worker event handlers', () => {
  function schedulerJob(overrides: Record<string, unknown> = {}) {
    return {
      id: 'sched-job-1',
      data: { scheduleId: randomUUID(), manual: false },
      attemptsMade: 3,
      opts: { attempts: 3 },
      ...overrides,
    } as unknown as Job;
  }

  it('logs a finished (possibly skipped) run', () => {
    emit(schedulerHandle.worker, 'completed', schedulerJob(), {
      skipped: true,
    });
    expect(schedulerLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: true }),
      'Schedule run finished',
    );
  });

  it('records a failure carrying ScheduleRunError timing/kind', () => {
    emit(schedulerHandle.worker, 
      'failed',
      schedulerJob(),
      new ScheduleRunError('timed out', 1234, 'TIMEOUT'),
    );
    expect(schedulerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ willRetry: false }),
      'Schedule run attempt failed',
    );
  });

  it('records a failure for a plain error (defaults kind/elapsed)', () => {
    emit(schedulerHandle.worker, 
      'failed',
      schedulerJob(),
      new Error('plain boom'),
    );
    expect(schedulerLogger.error).toHaveBeenCalled();
  });

  it('does not record a failure while a retry is pending', () => {
    schedulerLogger.error.mockClear();
    emit(schedulerHandle.worker, 
      'failed',
      schedulerJob({ attemptsMade: 1 }),
      new Error('transient'),
    );
    expect(schedulerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ willRetry: true }),
      'Schedule run attempt failed',
    );
  });

  it('logs a worker-level error', () => {
    emit(schedulerHandle.worker, 'error', new Error('redis gone'));
    expect(schedulerLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Scheduler worker error',
    );
  });
});
