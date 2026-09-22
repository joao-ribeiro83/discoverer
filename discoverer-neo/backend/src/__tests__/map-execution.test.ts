import { describe, it, expect, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import {
  executeMap,
  resolveDataSourceId,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MapExecutionError,
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
    // The default, not a literal: it is environment-tunable now.
    expect(raw.callTimeout).toBe(DEFAULT_TIMEOUT_MS);
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

  it('maps a generic query error to a QUERY error and logs FAILED, without the raw driver text (SEC-07)', async () => {
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
    expect((caught as MapExecutionError).message).not.toMatch(/ORA-/);

    const recorded = recordExecution.mock.calls[0]![0] as { errorMessage: string | null };
    expect(recorded).toMatchObject({ status: 'FAILED' });
    expect(recorded.errorMessage).not.toMatch(/ORA-/);
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

    await executeMap(MAP_ID, {}, USER_ID, { timeoutMs: MAX_TIMEOUT_MS + 1 }, deps);

    expect(raw.callTimeout).toBe(MAX_TIMEOUT_MS);
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
