import { describe, it, expect, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import {
  createSchedule,
  updateSchedule,
  getSchedule,
  listSchedulesForMap,
  listSchedulesForUser,
  deleteSchedule,
  toggleSchedule,
  triggerNow,
  getNextRunTime,
  computeNextRunTime,
  validateCronExpression,
  validateTimezone,
  getExecutionHistory,
  getScheduledResult,
  processScheduleRun,
  recordScheduleFailure,
  buildScheduleResultFilePath,
  ScheduleValidationError,
  ScheduleRunError,
  type SchedulerDeps,
  type ScheduleRecord,
  type ScheduledResultRecord,
  type CreateScheduleInput,
} from '../../services/scheduler.service.js';
import type { PreparedQuery, ResultColumn } from '../../services/map-execution.service.js';
import type { ExportSource } from '../../services/exporters/types.js';

// ---------------------------------------------------------------------------
// Fixtures & fakes.
//
// Hermetic: no Postgres, Oracle, or Redis. The schedule/result stores and the
// BullMQ job-scheduler operations are faked; the Oracle connection is faked
// the same way map-execution.test.ts/export.test.ts do it.
// ---------------------------------------------------------------------------

const USER_ID = 'user-1';
const MAP_ID = 'map-1';

function makePrepared(overrides: Partial<PreparedQuery> = {}): PreparedQuery {
  return {
    sql: 'SELECT "F"."AMOUNT" AS "C1"\nFROM "S"."SALES" "F"',
    bindParams: {},
    columns: [{ alias: 'C1', label: 'Amount', isAggregate: false }],
    dataSourceId: 'ds-1',
    ...overrides,
  };
}

function makeResultSetConn(
  rows: Record<string, unknown>[],
  metaData: Array<{ name: string }> = [{ name: 'C1' }],
) {
  let cursor = 0;
  const resultSet = {
    getRows: jest.fn(async (n: number) => {
      const slice = rows.slice(cursor, cursor + n);
      cursor += slice.length;
      return slice;
    }),
    close: jest.fn(async () => {}),
  };
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute: jest.fn(async () => ({ resultSet, metaData })),
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { raw, conn: raw as unknown as Connection, resultSet };
}

function makeFailingConn(err: unknown) {
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute: jest.fn(async () => {
      throw err;
    }),
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { raw, conn: raw as unknown as Connection };
}

/** In-memory fake of the `schedules` + `schedule_parameters` tables. */
class FakeScheduleStore {
  rows = new Map<string, ScheduleRecord>();
  private seq = 0;

  insertSchedule = async (
    input: CreateScheduleInput & { createdBy: string },
  ): Promise<ScheduleRecord> => {
    this.seq += 1;
    const now = new Date();
    const record: ScheduleRecord = {
      id: `sch-${this.seq}`,
      mapId: input.mapId,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone ?? 'UTC',
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      outputFormat: input.outputFormat,
      isActive: input.isActive ?? true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      parameters: input.parameters ?? [],
    };
    this.rows.set(record.id, record);
    return { ...record };
  };

  updateScheduleRow = async (
    id: string,
    patch: Partial<CreateScheduleInput>,
  ): Promise<ScheduleRecord | null> => {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated: ScheduleRecord = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.cronExpression !== undefined ? { cronExpression: patch.cronExpression } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      ...(patch.validFrom !== undefined ? { validFrom: patch.validFrom } : {}),
      ...(patch.validUntil !== undefined ? { validUntil: patch.validUntil } : {}),
      ...(patch.outputFormat !== undefined ? { outputFormat: patch.outputFormat } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.parameters !== undefined ? { parameters: patch.parameters } : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return { ...updated };
  };

  getScheduleRow = async (id: string): Promise<ScheduleRecord | null> => {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  };

  listByMap = async (mapId: string): Promise<ScheduleRecord[]> =>
    [...this.rows.values()].filter((r) => r.mapId === mapId);

  listByUser = async (userId: string): Promise<ScheduleRecord[]> =>
    [...this.rows.values()].filter((r) => r.createdBy === userId);

  deleteScheduleRow = async (id: string): Promise<boolean> => this.rows.delete(id);
}

/** In-memory fake of the `scheduled_results` table. */
class FakeResultStore {
  rows: ScheduledResultRecord[] = [];

  insertResult = async (
    input: Omit<ScheduledResultRecord, 'id' | 'executedAt'> & { id: string; executedAt: Date },
  ): Promise<ScheduledResultRecord> => {
    const record: ScheduledResultRecord = { ...input };
    this.rows.push(record);
    return { ...record };
  };

  listResults = async (scheduleId: string, limit: number): Promise<ScheduledResultRecord[]> =>
    this.rows
      .filter((r) => r.scheduleId === scheduleId)
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, limit);

  getResult = async (scheduleId: string, resultId: string): Promise<ScheduledResultRecord | null> =>
    this.rows.find((r) => r.scheduleId === scheduleId && r.id === resultId) ?? null;
}

function makeDeps(
  conn: Connection,
  overrides: Partial<SchedulerDeps> = {},
): {
  deps: SchedulerDeps;
  scheduleStore: FakeScheduleStore;
  resultStore: FakeResultStore;
  prepareQuery: jest.Mock;
  getConnection: jest.Mock;
  releaseConnection: jest.Mock;
  writeResultFile: jest.Mock;
  upsertJob: jest.Mock;
  removeJob: jest.Mock;
  enqueueManual: jest.Mock;
  notify: jest.Mock;
  drained: Record<string, unknown>[];
} {
  const prepared = makePrepared();
  const scheduleStore = new FakeScheduleStore();
  const resultStore = new FakeResultStore();
  const prepareQuery = jest.fn(async () => prepared) as jest.Mock;
  const getConnection = jest.fn(async () => conn) as jest.Mock;
  const releaseConnection = jest.fn(async () => {}) as jest.Mock;
  const drained: Record<string, unknown>[] = [];
  const writeResultFile = jest.fn(async (source: unknown) => {
    for await (const batch of (source as ExportSource).batches) drained.push(...batch);
    return { rowCount: drained.length };
  }) as jest.Mock;
  const upsertJob = jest.fn(async () => {}) as jest.Mock;
  const removeJob = jest.fn(async () => {}) as jest.Mock;
  const enqueueManual = jest.fn(async () => {}) as jest.Mock;
  const notify = jest.fn(async () => {}) as jest.Mock;

  const deps = {
    insertSchedule: scheduleStore.insertSchedule,
    updateScheduleRow: scheduleStore.updateScheduleRow,
    getScheduleRow: scheduleStore.getScheduleRow,
    listByMap: scheduleStore.listByMap,
    listByUser: scheduleStore.listByUser,
    deleteScheduleRow: scheduleStore.deleteScheduleRow,
    insertResult: resultStore.insertResult,
    listResults: resultStore.listResults,
    getResult: resultStore.getResult,
    upsertJob,
    removeJob,
    enqueueManual,
    prepareQuery,
    getConnection,
    releaseConnection,
    writeResultFile,
    notify,
    ...overrides,
  } as unknown as SchedulerDeps;

  return {
    deps,
    scheduleStore,
    resultStore,
    prepareQuery,
    getConnection,
    releaseConnection,
    writeResultFile,
    upsertJob,
    removeJob,
    enqueueManual,
    notify,
    drained,
  };
}

function createInput(over: Partial<CreateScheduleInput> = {}): CreateScheduleInput {
  return {
    mapId: MAP_ID,
    name: 'Daily sales report',
    cronExpression: '0 9 * * *',
    timezone: 'UTC',
    outputFormat: 'CSV',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Cron / timezone validation
// ---------------------------------------------------------------------------

describe('validateCronExpression', () => {
  it('accepts a well-formed expression', () => {
    expect(validateCronExpression('0 9 * * *')).toEqual({ valid: true });
  });

  it('rejects a malformed expression with a readable error', () => {
    const result = validateCronExpression('not a cron expression');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('validateTimezone', () => {
  it('accepts a real IANA zone', () => {
    expect(validateTimezone('America/New_York')).toBe(true);
  });

  it('rejects a made-up zone', () => {
    expect(validateTimezone('Not/A_Zone')).toBe(false);
  });
});

describe('computeNextRunTime', () => {
  it('computes the next occurrence honouring the timezone', () => {
    const next = computeNextRunTime('0 9 * * *', 'America/New_York', {
      currentDate: new Date('2026-07-17T00:00:00Z'),
    });
    // 09:00 America/New_York on 2026-07-17 is 13:00 UTC (EDT, UTC-4).
    expect(next?.toISOString()).toBe('2026-07-17T13:00:00.000Z');
  });

  it('returns null once the validity window has already closed', () => {
    const next = computeNextRunTime('0 9 * * *', 'UTC', {
      currentDate: new Date('2026-07-17T00:00:00Z'),
      validUntil: new Date('2026-07-16T00:00:00Z'),
    });
    expect(next).toBeNull();
  });

  it('returns null for an invalid expression instead of throwing', () => {
    expect(computeNextRunTime('garbage', 'UTC')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

describe('createSchedule', () => {
  it('persists the schedule and registers its recurring job', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, upsertJob } = makeDeps(conn);

    const schedule = await createSchedule(createInput(), USER_ID, deps);

    expect(schedule.mapId).toBe(MAP_ID);
    expect(schedule.isActive).toBe(true);
    expect(upsertJob).toHaveBeenCalledWith(
      schedule.id,
      '0 9 * * *',
      'UTC',
      null,
      null,
    );
  });

  it('persists parameter presets', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);

    const schedule = await createSchedule(
      createInput({ parameters: [{ paramName: 'REGION', paramValue: 'EAST' }] }),
      USER_ID,
      deps,
    );

    expect(schedule.parameters).toEqual([{ paramName: 'REGION', paramValue: 'EAST' }]);
  });

  it('does not register a job for a schedule created disabled', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, upsertJob, removeJob } = makeDeps(conn);

    await createSchedule(createInput({ isActive: false }), USER_ID, deps);

    expect(upsertJob).not.toHaveBeenCalled();
    expect(removeJob).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid cron expression before touching the store', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, scheduleStore } = makeDeps(conn);

    await expect(
      createSchedule(createInput({ cronExpression: 'nonsense' }), USER_ID, deps),
    ).rejects.toThrow(ScheduleValidationError);
    expect(scheduleStore.rows.size).toBe(0);
  });

  it('rejects an unknown timezone', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);

    await expect(
      createSchedule(createInput({ timezone: 'Nowhere/Fake' }), USER_ID, deps),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rejects validFrom on or after validUntil', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);

    await expect(
      createSchedule(
        createInput({
          validFrom: new Date('2026-08-01T00:00:00Z'),
          validUntil: new Date('2026-07-01T00:00:00Z'),
        }),
        USER_ID,
        deps,
      ),
    ).rejects.toThrow(ScheduleValidationError);
  });

  it('rolls back the row if registering the job scheduler fails', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, scheduleStore } = makeDeps(conn, {
      upsertJob: jest.fn(async () => {
        throw new Error('Redis unavailable');
      }) as unknown as SchedulerDeps['upsertJob'],
    });

    await expect(createSchedule(createInput(), USER_ID, deps)).rejects.toThrow(
      'Redis unavailable',
    );
    expect(scheduleStore.rows.size).toBe(0);
  });
});

describe('updateSchedule / getSchedule / list', () => {
  it('updates fields and re-syncs the recurring job from the resulting row', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, upsertJob } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);
    upsertJob.mockClear();

    const updated = await updateSchedule(
      schedule.id,
      { cronExpression: '0 */6 * * *', timezone: 'Europe/Berlin' },
      deps,
    );

    expect(updated?.cronExpression).toBe('0 */6 * * *');
    expect(upsertJob).toHaveBeenCalledWith(schedule.id, '0 */6 * * *', 'Europe/Berlin', null, null);
  });

  it('returns null for a missing schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    expect(await updateSchedule('nope', { name: 'x' }, deps)).toBeNull();
    expect(await getSchedule('nope', deps)).toBeNull();
  });

  it('lists schedules by map and by user', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    await createSchedule(createInput({ name: 'A' }), USER_ID, deps);
    await createSchedule(createInput({ name: 'B' }), 'user-2', deps);

    expect((await listSchedulesForMap(MAP_ID, deps)).length).toBe(2);
    expect((await listSchedulesForUser(USER_ID, deps)).map((s) => s.name)).toEqual(['A']);
  });
});

describe('toggleSchedule', () => {
  it('disabling removes the recurring job; re-enabling re-registers it', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, upsertJob, removeJob } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);
    upsertJob.mockClear();

    const disabled = await toggleSchedule(schedule.id, false, deps);
    expect(disabled?.isActive).toBe(false);
    expect(removeJob).toHaveBeenCalledWith(schedule.id);

    const reenabled = await toggleSchedule(schedule.id, true, deps);
    expect(reenabled?.isActive).toBe(true);
    expect(upsertJob).toHaveBeenCalledWith(
      schedule.id,
      schedule.cronExpression,
      schedule.timezone,
      null,
      null,
    );
  });
});

describe('deleteSchedule', () => {
  it('unregisters the job and removes the row', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, removeJob, scheduleStore } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);

    const deleted = await deleteSchedule(schedule.id, deps);

    expect(deleted).toBe(true);
    expect(removeJob).toHaveBeenCalledWith(schedule.id);
    expect(scheduleStore.rows.has(schedule.id)).toBe(false);
  });

  it('returns false for an unknown schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    expect(await deleteSchedule('nope', deps)).toBe(false);
  });
});

describe('triggerNow', () => {
  it('enqueues a manual run for an active schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, enqueueManual } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);

    const result = await triggerNow(schedule.id, USER_ID, deps);

    expect(result).toEqual({ queued: true });
    expect(enqueueManual).toHaveBeenCalledWith(schedule.id, USER_ID);
  });

  it('refuses to trigger a disabled schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, enqueueManual } = makeDeps(conn);
    const schedule = await createSchedule(createInput({ isActive: false }), USER_ID, deps);

    await expect(triggerNow(schedule.id, USER_ID, deps)).rejects.toThrow(ScheduleValidationError);
    expect(enqueueManual).not.toHaveBeenCalled();
  });

  it('throws for an unknown schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    await expect(triggerNow('nope', USER_ID, deps)).rejects.toThrow(ScheduleValidationError);
  });
});

describe('getNextRunTime', () => {
  it('returns null for a disabled schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    const schedule = await createSchedule(createInput({ isActive: false }), USER_ID, deps);
    expect(await getNextRunTime(schedule.id, deps)).toBeNull();
  });

  it('returns a future date for an active schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);
    const next = await getNextRunTime(schedule.id, deps);
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// processScheduleRun — what the worker runs.
// ---------------------------------------------------------------------------

describe('processScheduleRun', () => {
  it('executes the map, writes a result file, and records SUCCESS history', async () => {
    const { conn } = makeResultSetConn([{ C1: 10 }, { C1: 20 }]);
    const { deps, resultStore, writeResultFile } = makeDeps(conn);
    const schedule = await createSchedule(createInput({ outputFormat: 'XLSX' }), USER_ID, deps);

    const outcome = await processScheduleRun(schedule.id, { manual: false }, deps);

    expect(outcome.skipped).toBe(false);
    if (!outcome.skipped) {
      expect(outcome.rowCount).toBe(2);
      expect(outcome.filePath).toBe(buildScheduleResultFilePath(outcome.resultId, 'XLSX'));
    }

    expect(writeResultFile).toHaveBeenCalledTimes(1);
    const [source, format] = writeResultFile.mock.calls[0] as [ExportSource, string];
    expect(source.columns.map((c: ResultColumn) => c.name)).toEqual(['C1']);
    expect(format).toBe('XLSX');

    const history = await resultStore.listResults(schedule.id, 10);
    expect(history).toHaveLength(1);
    expect(history[0]!.status).toBe('SUCCESS');
    expect(history[0]!.rowCount).toBe(2);
  });

  it('passes schedule parameter presets through to prepareQuery', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, prepareQuery } = makeDeps(conn);
    const schedule = await createSchedule(
      createInput({ parameters: [{ paramName: 'REGION', paramValue: 'EAST' }] }),
      USER_ID,
      deps,
    );

    await processScheduleRun(schedule.id, { manual: false }, deps);

    expect(prepareQuery).toHaveBeenCalledWith(MAP_ID, { REGION: 'EAST' }, USER_ID);
  });

  it('is a no-op for a disabled schedule — nothing executes, nothing is logged', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps, prepareQuery, resultStore } = makeDeps(conn);
    const schedule = await createSchedule(createInput({ isActive: false }), USER_ID, deps);

    const outcome = await processScheduleRun(schedule.id, { manual: false }, deps);

    expect(outcome).toEqual({ skipped: true, reason: 'Schedule is disabled' });
    expect(prepareQuery).not.toHaveBeenCalled();
    expect(await resultStore.listResults(schedule.id, 10)).toHaveLength(0);
  });

  it('skips a cron-driven run outside the validity window', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps, prepareQuery } = makeDeps(conn);
    const schedule = await createSchedule(
      createInput({ validUntil: new Date(Date.now() - 60_000) }),
      USER_ID,
      deps,
    );

    const outcome = await processScheduleRun(schedule.id, { manual: false }, deps);

    expect(outcome.skipped).toBe(true);
    expect(prepareQuery).not.toHaveBeenCalled();
  });

  it('a manual trigger bypasses the validity window', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps, prepareQuery } = makeDeps(conn);
    const schedule = await createSchedule(
      createInput({ validUntil: new Date(Date.now() - 60_000) }),
      USER_ID,
      deps,
    );

    const outcome = await processScheduleRun(schedule.id, { manual: true }, deps);

    expect(outcome.skipped).toBe(false);
    expect(prepareQuery).toHaveBeenCalled();
  });

  it('throws a ScheduleRunError (so BullMQ can retry) when the query fails', async () => {
    const { conn } = makeFailingConn(new Error('ORA-00942: table or view does not exist'));
    const { deps, releaseConnection, resultStore } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);

    await expect(processScheduleRun(schedule.id, { manual: false }, deps)).rejects.toThrow(
      ScheduleRunError,
    );
    // Not logged here — that is recordScheduleFailure's job, called by the
    // worker once BullMQ's retries are exhausted.
    expect(await resultStore.listResults(schedule.id, 10)).toHaveLength(0);
    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('resolves with a "no longer exists" skip for a deleted schedule', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    const outcome = await processScheduleRun('ghost', { manual: false }, deps);
    expect(outcome).toEqual({ skipped: true, reason: 'Schedule no longer exists' });
  });
});

describe('recordScheduleFailure', () => {
  it('inserts a FAILED result row with the elapsed time and message', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, resultStore } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);

    await recordScheduleFailure(schedule.id, 'ORA-12154: TNS could not resolve', 4200, 'FAILED', deps);

    const [entry] = await resultStore.listResults(schedule.id, 10);
    expect(entry?.status).toBe('FAILED');
    expect(entry?.executionTimeMs).toBe(4200);
    expect(entry?.errorMessage).toContain('TNS could not resolve');
    expect(entry?.rowCount).toBeNull();
    expect(entry?.filePath).toBeNull();
  });
});

describe('getExecutionHistory / getScheduledResult', () => {
  it('returns recent runs newest first, capped at the requested limit', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, resultStore } = makeDeps(conn);
    const schedule = await createSchedule(createInput(), USER_ID, deps);

    await resultStore.insertResult({
      id: 'r1',
      scheduleId: schedule.id,
      executedAt: new Date('2026-07-01T00:00:00Z'),
      rowCount: 5,
      filePath: '/tmp/r1.csv',
      executionTimeMs: 100,
      status: 'SUCCESS',
      errorMessage: null,
    });
    await resultStore.insertResult({
      id: 'r2',
      scheduleId: schedule.id,
      executedAt: new Date('2026-07-02T00:00:00Z'),
      rowCount: null,
      filePath: null,
      executionTimeMs: 50,
      status: 'FAILED',
      errorMessage: 'boom',
    });

    const history = await getExecutionHistory(schedule.id, 20, deps);
    expect(history.map((r) => r.id)).toEqual(['r2', 'r1']);

    const single = await getScheduledResult(schedule.id, 'r1', deps);
    expect(single?.status).toBe('SUCCESS');
  });
});
