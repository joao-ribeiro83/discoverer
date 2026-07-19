import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import {
  executeMap,
  executeMapAsync,
  getExecutionStatus,
  cancelExecution,
  resolveDataSourceId,
  MapExecutionError,
  _resetAsyncState,
  type MapExecutionDeps,
  type PreparedQuery,
} from '../services/map-execution.service.js';
import type { MapDefinition } from '../types/sql.js';

// ---------------------------------------------------------------------------
// Fixtures & fakes
// ---------------------------------------------------------------------------

const USER_ID = 'user-1';
const MAP_ID = 'map-1';

function makePrepared(overrides: Partial<PreparedQuery> = {}): PreparedQuery {
  return {
    sql: 'SELECT "F"."AMOUNT" AS "C1"\nFROM "S"."SALES" "F"\nWHERE "F"."REGION" = :p_region',
    bindParams: { p_region: 'EAST' },
    columns: [{ alias: 'C1', label: 'Amount', isAggregate: false }],
    dataSourceId: 'ds-1',
    ...overrides,
  };
}

/** A fake oracledb Connection whose `execute` returns a plain row array. */
function makeRowsConn(
  rows: Record<string, unknown>[],
  metaData: Array<{ name: string }> = [{ name: 'C1' }],
) {
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute: jest.fn(async () => ({ rows, metaData })),
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { raw, conn: raw as unknown as Connection };
}

/** A fake Connection whose `execute` rejects. */
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

/** A fake Connection that streams rows via a result set (async path). */
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

/**
 * A fake Connection whose `execute` never settles until `break()` is called,
 * at which point it rejects with an ORA-01013 (cancel) error.
 */
function makeHangingConn() {
  let rejectExec: (reason: unknown) => void = () => {};
  const execPromise = new Promise((_resolve, reject) => {
    rejectExec = reject;
  });
  const brk = jest.fn(async () => {
    const err = Object.assign(
      new Error('ORA-01013: user requested cancel of current operation'),
      { code: 'ORA-01013' },
    );
    rejectExec(err);
  });
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute: jest.fn(() => execPromise),
    break: brk,
    close: jest.fn(async () => {}),
  };
  return { raw, conn: raw as unknown as Connection };
}

function makeDeps(
  conn: Connection,
  overrides: Partial<MapExecutionDeps> = {},
): {
  deps: MapExecutionDeps;
  prepareQuery: jest.Mock;
  getConnection: jest.Mock;
  releaseConnection: jest.Mock;
  recordExecution: jest.Mock;
} {
  const prepared = makePrepared();
  const prepareQuery = jest.fn(async () => prepared) as jest.Mock;
  const getConnection = jest.fn(async () => conn) as jest.Mock;
  const releaseConnection = jest.fn(async () => {}) as jest.Mock;
  const recordExecution = jest.fn(async () => {}) as jest.Mock;
  const deps = {
    prepareQuery,
    getConnection,
    releaseConnection,
    recordExecution,
    ...overrides,
  } as unknown as MapExecutionDeps;
  return { deps, prepareQuery, getConnection, releaseConnection, recordExecution };
}

async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 2000, stepMs = 5 } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out');
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

beforeEach(() => {
  _resetAsyncState();
});

// ---------------------------------------------------------------------------
// Synchronous execution
// ---------------------------------------------------------------------------

describe('executeMap (synchronous)', () => {
  it('returns rows, columns, and metadata for a successful execution', async () => {
    const { conn } = makeRowsConn([{ C1: 10 }, { C1: 20 }]);
    const { deps, releaseConnection, recordExecution } = makeDeps(conn);

    const result = await executeMap(MAP_ID, { region: 'EAST' }, USER_ID, {}, deps);

    expect(result.rows).toEqual([{ C1: 10 }, { C1: 20 }]);
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.columns).toEqual([
      { name: 'C1', label: 'Amount', isAggregate: false },
    ]);
    expect(typeof result.executionTimeMs).toBe('number');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);

    // Connection always returned to the pool.
    expect(releaseConnection).toHaveBeenCalledTimes(1);
    // Logged as a success.
    expect(recordExecution).toHaveBeenCalledTimes(1);
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({
      status: 'SUCCESS',
      rowCount: 2,
      mapId: MAP_ID,
      executedBy: USER_ID,
    });
  });

  it('forwards bind parameters and the row cap to the driver', async () => {
    const { conn, raw } = makeRowsConn([{ C1: 1 }]);
    const { deps } = makeDeps(conn);

    await executeMap(MAP_ID, { region: 'EAST' }, USER_ID, {}, deps);

    const execute = raw.execute as jest.Mock;
    const [sql, binds, options] = execute.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { maxRows: number },
    ];
    expect(sql).toContain('SELECT');
    expect(binds).toEqual({ p_region: 'EAST' });
    // maxRows probes one extra row (1000 + 1) to detect truncation.
    expect(options.maxRows).toBe(1001);
    // Statement timeout applied (default 30s).
    expect(raw.callTimeout).toBe(30_000);
  });

  it('truncates at MAX_SYNC_ROWS and flags the result', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ C1: i }));
    const { conn } = makeRowsConn(rows);
    const { deps, recordExecution } = makeDeps(conn);

    const result = await executeMap(MAP_ID, {}, USER_ID, {}, deps);

    expect(result.rows).toHaveLength(1000);
    expect(result.rowCount).toBe(1000);
    expect(result.truncated).toBe(true);
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ rowCount: 1000 });
  });

  it('maps a driver timeout to a TIMEOUT error and logs it', async () => {
    const timeoutErr = Object.assign(
      new Error('DPI-1067: call timeout of 30000 ms exceeded'),
      { code: 'DPI-1067' },
    );
    const { conn } = makeFailingConn(timeoutErr);
    const { deps, releaseConnection, recordExecution } = makeDeps(conn);

    await expect(
      executeMap(MAP_ID, {}, USER_ID, {}, deps),
    ).rejects.toMatchObject({ kind: 'TIMEOUT' });

    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ status: 'TIMEOUT' });
    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('maps a generic query error to a QUERY error and logs FAILED', async () => {
    const err = new Error('ORA-00942: table or view does not exist');
    const { conn } = makeFailingConn(err);
    const { deps, recordExecution } = makeDeps(conn);

    let caught: unknown;
    try {
      await executeMap(MAP_ID, {}, USER_ID, {}, deps);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MapExecutionError);
    expect((caught as MapExecutionError).kind).toBe('QUERY');

    expect(recordExecution.mock.calls[0]![0]).toMatchObject({
      status: 'FAILED',
      errorMessage: 'ORA-00942: table or view does not exist',
    });
  });

  it('surfaces a connection-acquire failure as CONNECT without releasing', async () => {
    const { conn } = makeRowsConn([]);
    const getConnection = jest.fn(async () => {
      throw new Error('pool exhausted');
    }) as jest.Mock;
    const { deps, releaseConnection, recordExecution } = makeDeps(conn, {
      getConnection: getConnection as unknown as MapExecutionDeps['getConnection'],
    });

    await expect(executeMap(MAP_ID, {}, USER_ID, {}, deps)).rejects.toMatchObject({
      kind: 'CONNECT',
    });

    expect(releaseConnection).not.toHaveBeenCalled();
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ status: 'FAILED' });
  });

  it('clamps a caller-supplied timeout above the maximum', async () => {
    const { conn, raw } = makeRowsConn([{ C1: 1 }]);
    const { deps } = makeDeps(conn);

    await executeMap(MAP_ID, {}, USER_ID, { timeoutMs: 999_999 }, deps);

    expect(raw.callTimeout).toBe(30_000);
  });
});

// ---------------------------------------------------------------------------
// Asynchronous execution
// ---------------------------------------------------------------------------

describe('executeMapAsync (background job)', () => {
  it('creates a job and completes with the streamed result', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }, { C1: 2 }, { C1: 3 }]);
    const { deps, releaseConnection, recordExecution } = makeDeps(conn);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    expect(jobId).toBeTruthy();

    await waitFor(() => getExecutionStatus(jobId)?.status === 'COMPLETED');

    const job = getExecutionStatus(jobId)!;
    expect(job.rowCount).toBe(3);
    expect(job.result?.rows).toHaveLength(3);
    expect(job.result?.columns).toEqual([
      { name: 'C1', label: 'Amount', isAggregate: false },
    ]);
    expect(typeof job.executionTimeMs).toBe('number');
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ status: 'SUCCESS' });
    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('returns null status for an unknown job id', () => {
    expect(getExecutionStatus('does-not-exist')).toBeNull();
  });

  it('cancels a running execution and logs it', async () => {
    const { conn, raw } = makeHangingConn();
    const { deps, releaseConnection, recordExecution } = makeDeps(conn);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);

    // Wait until the query is actually in flight.
    await waitFor(() => (raw.execute as jest.Mock).mock.calls.length > 0);

    const outcome = await cancelExecution(jobId);
    expect(outcome).toEqual({ cancelled: true, status: 'CANCELLED' });
    expect(raw.break).toHaveBeenCalledTimes(1);

    await waitFor(() => getExecutionStatus(jobId)?.finishedAt !== undefined);

    const job = getExecutionStatus(jobId)!;
    expect(job.status).toBe('CANCELLED');
    expect(releaseConnection).toHaveBeenCalledTimes(1);
    // Cancellation is persisted as FAILED (no CANCELLED value in the log enum).
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Execution cancelled by user',
    });
  });

  it('returns null when cancelling an unknown job', async () => {
    expect(await cancelExecution('nope')).toBeNull();
  });

  it('reports cancelled=false when the job already finished', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps } = makeDeps(conn);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'COMPLETED');

    const outcome = await cancelExecution(jobId);
    expect(outcome).toEqual({ cancelled: false, status: 'COMPLETED' });
  });

  it('settles as TIMEOUT when the async query times out', async () => {
    const timeoutErr = Object.assign(
      new Error('DPI-1067: call timeout of 30000 ms exceeded'),
      { code: 'DPI-1067' },
    );
    const { conn } = makeFailingConn(timeoutErr);
    const { deps, recordExecution, releaseConnection } = makeDeps(conn);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'TIMEOUT');

    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ status: 'TIMEOUT' });
    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('settles as FAILED on a generic async query error', async () => {
    const { conn } = makeFailingConn(
      new Error('ORA-00942: table or view does not exist'),
    );
    const { deps, recordExecution } = makeDeps(conn);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'FAILED');

    const job = getExecutionStatus(jobId)!;
    expect(job.error).toMatch(/ORA-00942/);
    expect(recordExecution.mock.calls[0]![0]).toMatchObject({ status: 'FAILED' });
  });

  it('settles as FAILED when the connection cannot be acquired', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const getConnection = jest.fn(async () => {
      throw new Error('ORA-12541: no listener');
    }) as unknown as MapExecutionDeps['getConnection'];
    const { deps } = makeDeps(conn, { getConnection });

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'FAILED');

    expect(getExecutionStatus(jobId)!.error).toMatch(/ORA-12541/);
  });

  it('settles as FAILED when prepareQuery fails', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const prepareQuery = jest.fn(async () => {
      throw new Error('bad map definition');
    }) as unknown as MapExecutionDeps['prepareQuery'];
    const { deps } = makeDeps(conn, { prepareQuery });

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'FAILED');

    expect(getExecutionStatus(jobId)!.error).toMatch(/bad map definition/);
  });

  it('completes via the no-result-set fallback (execute returns plain rows)', async () => {
    // A driver that returns rows directly with no result set exercises
    // openRowStream's fallback branch.
    const raw: Record<string, unknown> = {
      callTimeout: undefined,
      execute: jest.fn(async () => ({
        rows: [{ C1: 5 }, { C1: 6 }],
        metaData: [{ name: 'C1' }],
      })),
      break: jest.fn(async () => {}),
      close: jest.fn(async () => {}),
    };
    const { deps } = makeDeps(raw as unknown as Connection);

    const { jobId } = await executeMapAsync(MAP_ID, {}, USER_ID, {}, deps);
    await waitFor(() => getExecutionStatus(jobId)?.status === 'COMPLETED');

    const job = getExecutionStatus(jobId)!;
    expect(job.rowCount).toBe(2);
    expect(job.result?.rows).toEqual([{ C1: 5 }, { C1: 6 }]);
  });
});

// ---------------------------------------------------------------------------
// Ad-hoc calculated fields (post-query evaluation)
// ---------------------------------------------------------------------------

describe('executeMap with ad-hoc calculated fields', () => {
  it('appends calculated columns to the rows and column list', async () => {
    const { conn } = makeRowsConn(
      [{ C1: 10 }, { C1: 20 }],
      [{ name: 'C1' }],
    );
    const { deps } = makeDeps(conn);

    const result = await executeMap(
      MAP_ID,
      {},
      USER_ID,
      { calculatedFields: [{ name: 'DOUBLED', formula: 'C1 * 2' }] },
      deps,
    );

    expect(result.columns.map((c) => c.name)).toEqual(['C1', 'DOUBLED']);
    expect(result.rows).toEqual([
      { C1: 10, DOUBLED: 20 },
      { C1: 20, DOUBLED: 40 },
    ]);
    expect(result.rowCount).toBe(2);
  });

  it('resolves a calculated field reference by the column label', async () => {
    // makePrepared labels C1 as "Amount".
    const { conn } = makeRowsConn([{ C1: 21 }], [{ name: 'C1' }]);
    const { deps } = makeDeps(conn);

    const result = await executeMap(
      MAP_ID,
      {},
      USER_ID,
      { calculatedFields: [{ name: 'CALC', formula: '[Amount] * 2' }] },
      deps,
    );

    expect(result.rows).toEqual([{ C1: 21, CALC: 42 }]);
  });

  it('maps a malformed ad-hoc formula to a CONFIG error', async () => {
    const { conn } = makeRowsConn([{ C1: 10 }], [{ name: 'C1' }]);
    const { deps } = makeDeps(conn);

    await expect(
      executeMap(
        MAP_ID,
        {},
        USER_ID,
        { calculatedFields: [{ name: 'BAD', formula: 'C1 +' }] },
        deps,
      ),
    ).rejects.toMatchObject({ kind: 'CONFIG' });
  });
});

// ---------------------------------------------------------------------------
// Data-source resolution
// ---------------------------------------------------------------------------

describe('resolveDataSourceId', () => {
  function defWith(dataSourceIds: (string | null)[]): MapDefinition {
    return {
      items: dataSourceIds.map((dataSourceId) => ({
        mapItem: {},
        item: {},
        folder: { dataSourceId },
      })),
      conditions: [],
    } as unknown as MapDefinition;
  }

  it('returns the single data source the map targets', () => {
    expect(resolveDataSourceId(defWith(['ds-1', 'ds-1']))).toBe('ds-1');
  });

  it('throws CONFIG when no folder has a data source', () => {
    expect(() => resolveDataSourceId(defWith([null]))).toThrow(MapExecutionError);
    try {
      resolveDataSourceId(defWith([null]));
    } catch (e) {
      expect((e as MapExecutionError).kind).toBe('CONFIG');
    }
  });

  it('throws CONFIG when the map spans multiple data sources', () => {
    try {
      resolveDataSourceId(defWith(['ds-1', 'ds-2']));
      throw new Error('expected to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MapExecutionError);
      expect((e as MapExecutionError).kind).toBe('CONFIG');
    }
  });
});
