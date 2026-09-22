import { describe, it, expect, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import { processMapRun, type RunnerDeps } from '../services/map-run.runner.js';
import type { MapRunRow } from '../services/map-run.store.js';
import type { PreparedQuery, RowStream } from '../services/map-execution.service.js';

// Hermetic: no Postgres, Oracle or Redis. Every store and driver call is faked.

const NOW = new Date('2026-09-22T10:00:00Z');
const HOUR = 3_600_000;

function makeRun(overrides: Partial<MapRunRow> = {}): MapRunRow {
  return {
    id: 'run-1',
    mapId: 'map-1',
    requestedBy: 'user-1',
    kind: 'LIVE',
    scheduleId: null,
    runKey: 'key',
    parameters: { p: 1 },
    calculatedFields: [],
    status: 'RUNNING',
    columns: null,
    decoration: null,
    rowCount: null,
    truncated: false,
    executionTimeMs: null,
    sqlText: null,
    errorMessage: null,
    createdAt: NOW,
    startedAt: NOW,
    completedAt: null,
    expiresAt: new Date(NOW.getTime() + 24 * HOUR),
    ...overrides,
  };
}

const prepared: PreparedQuery = {
  sql: 'SELECT 1 AS "C1" FROM DUAL',
  bindParams: {},
  columns: [{ alias: 'C1', label: 'One', isAggregate: false }],
  dataSourceId: 'ds-1',
};

function rows(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({ C1: i }));
}

function makeDeps(opts: { claimed?: boolean; run?: MapRunRow | null; rows?: number; fail?: Error } = {}) {
  const conn = {} as Connection;
  const batches: Array<{ seq: number; size: number }> = [];
  const deps = {
    claimRun: jest.fn(async () => opts.claimed ?? true),
    getRun: jest.fn(async () => (opts.run === undefined ? makeRun() : opts.run)),
    prepareQuery: jest.fn(async () => prepared),
    getConnection: jest.fn(async () => conn),
    releaseConnection: jest.fn(async () => undefined),
    recordExecution: jest.fn(async () => undefined),
    openRowStream: jest.fn(async (_c: Connection, _p: PreparedQuery, batchSize?: number): Promise<RowStream> => {
      if (opts.fail) throw opts.fail;
      const all = rows(opts.rows ?? 0);
      async function* gen() {
        for (let i = 0; i < all.length; i += batchSize!) yield all.slice(i, i + batchSize!);
      }
      return { metaData: [{ name: 'C1' }], batches: gen(), close: async () => undefined };
    }),
    appendBatch: jest.fn(async (_id: string, seq: number, r: Record<string, unknown>[]) => {
      batches.push({ seq, size: r.length });
    }),
    completeRun: jest.fn(async () => undefined),
    failRun: jest.fn(async () => undefined),
    loadRetentionDays: jest.fn(async () => 10),
    limits: { maxRows: 100_000, batchSize: 1000, liveTtlHours: 24, failRetryMs: 0 },
    now: () => NOW,
  } satisfies RunnerDeps;
  return { deps, batches, conn };
}

describe('processMapRun', () => {
  it('returns busy and touches no Oracle dep when the claim is refused and the run is still QUEUED', async () => {
    const { deps } = makeDeps({ claimed: false, run: makeRun({ status: 'QUEUED' }) });
    await expect(processMapRun('run-1', deps)).resolves.toBe('busy');
    expect(deps.prepareQuery).not.toHaveBeenCalled();
    expect(deps.getConnection).not.toHaveBeenCalled();
  });

  it('returns gone when the claim is refused because the run was cancelled', async () => {
    const { deps } = makeDeps({ claimed: false, run: makeRun({ status: 'CANCELLED' }) });
    await expect(processMapRun('run-1', deps)).resolves.toBe('gone');
    expect(deps.prepareQuery).not.toHaveBeenCalled();
  });

  it('writes 2 500 rows as batches 1000/1000/500 and completes untruncated', async () => {
    const { deps, batches, conn } = makeDeps({ rows: 2500 });
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.prepareQuery).toHaveBeenCalledWith('map-1', { p: 1 }, 'user-1', 100_001);
    expect(batches).toEqual([
      { seq: 0, size: 1000 },
      { seq: 1, size: 1000 },
      { seq: 2, size: 500 },
    ]);
    expect(deps.completeRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        rowCount: 2500,
        truncated: false,
        sqlText: prepared.sql,
        expiresAt: new Date(NOW.getTime() + 24 * HOUR),
      }),
    );
    expect(deps.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUCCESS', rowCount: 2500, executedBy: 'user-1' }),
    );
    expect(deps.releaseConnection).toHaveBeenCalledWith('ds-1', conn);
  });

  it('stops at the row cap and marks the run truncated', async () => {
    const { deps, batches } = makeDeps({ rows: 2500 });
    deps.limits = { ...deps.limits, maxRows: 1500 };
    await processMapRun('run-1', deps);
    expect(batches).toEqual([
      { seq: 0, size: 1000 },
      { seq: 1, size: 500 },
    ]);
    expect(deps.completeRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ rowCount: 1500, truncated: true }),
    );
  });

  it('fails the run with a sanitised message and releases the connection when Oracle throws', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps, conn } = makeDeps({ fail: new Error('ORA-00942: table or view does not exist') });
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.failRun).toHaveBeenCalledWith('run-1', {
      status: 'FAILED',
      errorMessage: expect.not.stringContaining('ORA-') as unknown as string,
      expiresAt: new Date(NOW.getTime() + 24 * HOUR),
    });
    expect(deps.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: expect.not.stringContaining('ORA-') }),
    );
    expect(deps.completeRun).not.toHaveBeenCalled();
    expect(deps.releaseConnection).toHaveBeenCalledWith('ds-1', conn);
    consoleError.mockRestore();
  });

  it('retries the job (busy) when the claim itself throws, so a DB blip does not strand a QUEUED run', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps } = makeDeps();
    deps.claimRun.mockRejectedValue(new Error('connection terminated'));
    await expect(processMapRun('run-1', deps)).resolves.toBe('busy');
    expect(deps.failRun).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('fails a claimed run whose row cannot be read, instead of leaving it RUNNING', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps } = makeDeps();
    deps.getRun.mockRejectedValue(new Error('connection terminated'));
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.failRun).toHaveBeenCalledWith('run-1', expect.objectContaining({ status: 'FAILED' }));
    expect(deps.prepareQuery).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('retries failRun when recording the failure hits a DB blip', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps } = makeDeps({ fail: new Error('ORA-03113: end-of-file on communication channel') });
    deps.failRun.mockRejectedValueOnce(new Error('connection terminated'));
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.failRun).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it('gives a SCHEDULED run the schedule retention as its expiry', async () => {
    const { deps } = makeDeps({ rows: 3, run: makeRun({ kind: 'SCHEDULED', scheduleId: 'sched-1' }) });
    await processMapRun('run-1', deps);
    expect(deps.loadRetentionDays).toHaveBeenCalledWith('sched-1');
    expect(deps.completeRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ expiresAt: new Date(NOW.getTime() + 10 * 24 * HOUR) }),
    );
  });
});
