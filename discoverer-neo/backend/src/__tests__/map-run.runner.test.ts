import { describe, it, expect, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import { processMapRun, requestCancel, type RunnerDeps } from '../services/map-run.runner.js';
import type { MapRunRow } from '../services/map-run.store.js';
import type { PreparedQuery, RowStream } from '../services/map-execution.service.js';
import { SqlGenerationError } from '../types/sql.js';

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

function makeDeps(
  opts: { claimed?: boolean; run?: MapRunRow | null; rows?: number; fail?: Error } = {},
) {
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
    resolveHeading: jest.fn(async () => ({
      title: 'Sales',
      description: 'Sales by Region',
      parameters: [],
      runAt: NOW,
    })),
    loadRetentionDays: jest.fn(async () => 10),
    insertScheduledResult: jest.fn(async () => undefined),
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

  // Fix round 1, IMPORTANT 4: the viewer lost the post-run heading
  // (`&Date`/`&<ParamName>` tokens) when it moved from reading `/execute`'s
  // response to reading a stored run — the runner has to put it somewhere
  // the run row carries, which is `decoration` (no new column).
  it('resolves the heading with this run\'s own parameters and stores it in decoration', async () => {
    const { deps } = makeDeps({ rows: 1 });
    await processMapRun('run-1', deps);
    expect(deps.resolveHeading).toHaveBeenCalledWith('map-1', { p: 1 }, NOW);
    expect(deps.completeRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        decoration: expect.objectContaining({
          heading: { title: 'Sales', description: 'Sales by Region' },
        }),
      }),
    );
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
      decoration: { error: { kind: 'QUERY' } },
    });
    expect(deps.recordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: expect.not.stringContaining('ORA-') }),
    );
    expect(deps.completeRun).not.toHaveBeenCalled();
    expect(deps.releaseConnection).toHaveBeenCalledWith('ds-1', conn);
    consoleError.mockRestore();
  });

  it('records CANCELLED, not FAILED, when requestCancel interrupts a run mid-stream', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps, conn } = makeDeps();
    deps.openRowStream.mockImplementationOnce(async () => {
      async function* gen(): AsyncGenerator<Record<string, unknown>[]> {
        yield rows(1);
        // The connection is registered by the time a batch is mid-flight —
        // this is what the cancel route's requestCancel() call does for real.
        expect(requestCancel('run-1')).toBe(true);
        throw Object.assign(new Error('ORA-01013: user requested cancel of current operation'), {
          code: 'ORA-01013',
        });
      }
      return { metaData: [{ name: 'C1' }], batches: gen(), close: async () => undefined };
    });
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.failRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ status: 'CANCELLED', decoration: { error: { kind: 'CANCELLED' } } }),
    );
    expect(deps.completeRun).not.toHaveBeenCalled();
    expect(deps.releaseConnection).toHaveBeenCalledWith('ds-1', conn);
    // A cancel not asked for must never be misclassified, even with the same
    // ORA-01013 code — requestCancel is what marks it as ours to claim.
    expect(requestCancel('run-1')).toBe(false);
    consoleError.mockRestore();
  });

  it('requestCancel returns false for a run with no connection registered in this process', () => {
    expect(requestCancel('some-other-run')).toBe(false);
  });

  // Fix round 1, IMPORTANT 3: a coded SqlGenerationError is a deliberate
  // refusal (D-036), not a broken map — the old synchronous `/execute` route
  // sent its `kind`/`code`/`details` back in the HTTP response; a queued run
  // has no response, so the runner writes the same shape into `decoration`
  // instead (controller ruling: no new column).
  it('records a REFUSED run with its code and details when the planner declines, not a generic failure', async () => {
    const { deps } = makeDeps();
    deps.prepareQuery.mockRejectedValueOnce(
      new SqlGenerationError(
        'This query fans out from more than one folder at once',
        { folders: ['Sales', 'Sales Lines'] },
        'FAN_TRAP_R4',
      ),
    );
    await expect(processMapRun('run-1', deps)).resolves.toBe('ran');
    expect(deps.failRun).toHaveBeenCalledWith('run-1', {
      status: 'FAILED',
      errorMessage: 'This query fans out from more than one folder at once',
      expiresAt: new Date(NOW.getTime() + 24 * HOUR),
      decoration: {
        error: {
          kind: 'REFUSED',
          refusal: { code: 'FAN_TRAP_R4', details: { folders: ['Sales', 'Sales Lines'] } },
        },
      },
    });
    expect(deps.completeRun).not.toHaveBeenCalled();
    // A refusal is not an Oracle connection — nothing to release.
    expect(deps.releaseConnection).not.toHaveBeenCalled();
  });

  it('records a codeless SqlGenerationError as CONFIG, not REFUSED', async () => {
    const { deps } = makeDeps();
    deps.prepareQuery.mockRejectedValueOnce(new SqlGenerationError('No usable join path'));
    await processMapRun('run-1', deps);
    expect(deps.failRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        errorMessage: 'No usable join path',
        decoration: { error: { kind: 'CONFIG' } },
      }),
    );
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

  it('a SCHEDULED run inserts a scheduled_results row on completion, with no file', async () => {
    const { deps } = makeDeps({ rows: 3, run: makeRun({ kind: 'SCHEDULED', scheduleId: 'sched-1' }) });
    await processMapRun('run-1', deps);
    expect(deps.insertScheduledResult).toHaveBeenCalledWith({
      scheduleId: 'sched-1',
      runId: 'run-1',
      executedAt: NOW,
      rowCount: 3,
      executionTimeMs: 0,
      status: 'SUCCESS',
      errorMessage: null,
      filePath: null,
    });
  });

  it('a SCHEDULED run inserts a FAILED scheduled_results row when Oracle throws', async () => {
    const { deps } = makeDeps({
      fail: new Error('ORA-00942: table or view does not exist'),
      run: makeRun({ kind: 'SCHEDULED', scheduleId: 'sched-1' }),
    });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await processMapRun('run-1', deps);
    expect(deps.insertScheduledResult).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'sched-1',
        runId: 'run-1',
        rowCount: null,
        status: 'FAILED',
        errorMessage: expect.not.stringContaining('ORA-'),
        filePath: null,
      }),
    );
    consoleError.mockRestore();
  });

  it('does not touch scheduled_results for a LIVE run', async () => {
    const { deps } = makeDeps({ rows: 3 });
    await processMapRun('run-1', deps);
    expect(deps.insertScheduledResult).not.toHaveBeenCalled();
  });
});
