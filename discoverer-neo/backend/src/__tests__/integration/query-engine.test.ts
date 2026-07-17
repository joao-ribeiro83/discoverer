import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import type { Connection } from 'oracledb';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  folders,
  items,
  joins,
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  mapCalculatedFields,
  queryExecutionLog,
  type Item,
  type Folder,
} from '../../db/schema.js';
import {
  executeMap,
  executeMapAsync,
  getExecutionStatus,
  MapExecutionError,
  resolveDataSourceId,
  defaultDeps,
  _resetAsyncState,
  type MapExecutionDeps,
  type ExecuteOptions,
} from '../../services/map-execution.service.js';
import {
  loadMapDefinition,
  generateSql,
} from '../../services/sql-generator.js';
import {
  createTestUser,
  createTestDataSource,
  createTestBusinessArea,
  cleanupIntegrationUsers,
} from './test-helper.js';

// ===========================================================================
// End-to-end query-engine integration tests
//
// Exercises the full pipeline against the real Postgres metadata database:
//   real map/folder/item/join fixtures
//     -> real loadMapDefinition (DB)
//     -> real generateSql (SQL generator)
//     -> real parameter resolution + execution-log write
//     -> map-execution.service, with ONLY the Oracle driver layer mocked.
//
// The Oracle driver is mocked exactly the way map-execution.test.ts does it:
// a fake `oracledb` Connection is injected through MapExecutionDeps.getConnection
// so no real Oracle database is required. Everything up to (and after) that
// connection is the production code path.
// ===========================================================================

// ---------------------------------------------------------------------------
// Oracle driver fakes (same shape as map-execution.test.ts)
// ---------------------------------------------------------------------------

/** A fake Connection whose `execute` returns a plain row array. */
function makeRowsConn(
  rows: Record<string, unknown>[],
  metaData?: Array<{ name: string }>,
): { conn: Connection; execute: jest.Mock; raw: Record<string, unknown> } {
  const md =
    metaData ??
    (rows[0] ? Object.keys(rows[0]).map((name) => ({ name })) : []);
  const execute = jest.fn(async () => ({ rows, metaData: md })) as jest.Mock;
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute,
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, execute, raw };
}

/** A fake Connection whose `execute` rejects with the supplied error. */
function makeFailingConn(err: unknown): {
  conn: Connection;
  execute: jest.Mock;
} {
  const execute = jest.fn(async () => {
    throw err;
  }) as jest.Mock;
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute,
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, execute };
}

/** A fake Connection that streams rows through a result set (async path). */
function makeResultSetConn(
  rows: Record<string, unknown>[],
  metaData?: Array<{ name: string }>,
): { conn: Connection; execute: jest.Mock } {
  const md =
    metaData ??
    (rows[0] ? Object.keys(rows[0]).map((name) => ({ name })) : []);
  let cursor = 0;
  const resultSet = {
    getRows: jest.fn(async (n: number) => {
      const slice = rows.slice(cursor, cursor + n);
      cursor += slice.length;
      return slice;
    }),
    close: jest.fn(async () => {}),
  };
  const execute = jest.fn(async () => ({ resultSet, metaData: md })) as jest.Mock;
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute,
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, execute };
}

/**
 * Wrap a fake connection in the production dependency bundle: the REAL
 * prepareQuery (loadMapDefinition + generateSql + parameter resolution) and the
 * REAL recordExecution (writes query_execution_log), with only connection
 * acquisition/release stubbed to hand out our fake Oracle connection.
 */
function execDeps(
  conn: Connection,
  overrides: Partial<MapExecutionDeps> = {},
): MapExecutionDeps {
  return {
    ...defaultDeps(),
    getConnection: jest.fn(async () => conn) as MapExecutionDeps['getConnection'],
    releaseConnection: jest.fn(async () => {}) as MapExecutionDeps['releaseConnection'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reusable helpers requested by the task
// ---------------------------------------------------------------------------

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

/** Assert generated SQL contains an expected fragment (whitespace-insensitive). */
function assertSqlContains(sql: string, expected: string): void {
  expect(norm(sql)).toContain(norm(expected));
}

async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 2000, stepMs = 5 } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

// ---------------------------------------------------------------------------
// Direct DB fixture inserts (full control over columns test-helper omits)
// ---------------------------------------------------------------------------

let adminId: string;
let dsId: string;
let baId: string;

interface Fixture {
  sales: Folder;
  customers: Folder;
  region: Item;
  amount: Item;
  orderDate: Item;
  custIdSales: Item;
  custKey: Item;
  custName: Item;
}
let fx: Fixture;

async function insertFolder(cfg: {
  name: string;
  tableName?: string | null;
  tableOwner?: string | null;
  folderType?: Folder['folderType'];
  customSql?: string | null;
}): Promise<Folder> {
  const [row] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: cfg.name,
      folderType: cfg.folderType ?? 'TABLE',
      tableName: cfg.tableName ?? cfg.name,
      tableOwner: cfg.tableOwner ?? 'APP',
      customSql: cfg.customSql ?? null,
      dataSourceId: dsId,
      createdBy: adminId,
    })
    .returning();
  if (!row) throw new Error(`Failed to insert folder ${cfg.name}`);
  return row;
}

async function insertItem(cfg: {
  folder: Folder;
  name: string;
  columnName: string;
  dataType?: string;
  itemType?: Item['itemType'];
}): Promise<Item> {
  const [row] = await db
    .insert(items)
    .values({
      folderId: cfg.folder.id,
      name: cfg.name,
      itemType: cfg.itemType ?? 'CI',
      columnName: cfg.columnName,
      dataType: cfg.dataType ?? 'VARCHAR2',
      createdBy: adminId,
    })
    .returning();
  if (!row) throw new Error(`Failed to insert item ${cfg.name}`);
  return row;
}

async function insertJoin(cfg: {
  name: string;
  left: Folder;
  leftItem: Item;
  right: Folder;
  rightItem: Item;
  joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}): Promise<void> {
  await db.insert(joins).values({
    name: cfg.name,
    leftFolderId: cfg.left.id,
    rightFolderId: cfg.right.id,
    leftItemId: cfg.leftItem.id,
    rightItemId: cfg.rightItem.id,
    joinType: cfg.joinType ?? 'INNER',
  });
}

// ---------------------------------------------------------------------------
// createTestMap — assemble a full map (items/conditions/params/calc fields)
// ---------------------------------------------------------------------------

interface MapItemSpec {
  item: Item;
  displayOrder?: number;
  displayName?: string;
  aggFunction?: string;
  sortDirection?: 'ASC' | 'DESC';
  sortOrder?: number;
}
interface ConditionSpec {
  item: Item;
  operator:
    | '='
    | '<>'
    | '>'
    | '<'
    | '>='
    | '<='
    | 'LIKE'
    | 'IN'
    | 'BETWEEN'
    | 'IS_NULL';
  value?: string;
  conditionType?: 'STATIC' | 'PARAMETER';
  paramName?: string;
  displayOrder?: number;
}
interface ParamSpec {
  name: string;
  paramType?: string;
  defaultValue?: string | null;
  isRequired?: boolean;
}
interface CalcFieldSpec {
  name: string;
  formula: string;
  displayOrder?: number;
}
interface CreateMapConfig {
  name?: string;
  items: MapItemSpec[];
  conditions?: ConditionSpec[];
  parameters?: ParamSpec[];
  calculatedFields?: CalcFieldSpec[];
}

async function createTestMap(config: CreateMapConfig): Promise<string> {
  const [map] = await db
    .insert(maps)
    .values({
      name: config.name ?? `QE Map ${Date.now()}`,
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: adminId,
    })
    .returning();
  if (!map) throw new Error('Failed to insert map');

  await db.insert(mapItems).values(
    config.items.map((spec, i) => ({
      mapId: map.id,
      itemId: spec.item.id,
      displayOrder: spec.displayOrder ?? i,
      displayName: spec.displayName ?? null,
      aggFunction: spec.aggFunction ?? null,
      sortDirection: spec.sortDirection ?? null,
      sortOrder: spec.sortOrder ?? null,
    })),
  );

  if (config.conditions?.length) {
    await db.insert(mapConditions).values(
      config.conditions.map((spec, i) => ({
        mapId: map.id,
        itemId: spec.item.id,
        operator: spec.operator,
        value: spec.value ?? null,
        paramName: spec.paramName ?? null,
        conditionType: spec.conditionType ?? 'STATIC',
        displayOrder: spec.displayOrder ?? i,
      })),
    );
  }

  if (config.parameters?.length) {
    await db.insert(mapParameters).values(
      config.parameters.map((spec) => ({
        mapId: map.id,
        name: spec.name,
        paramType: spec.paramType ?? 'STRING',
        defaultValue: spec.defaultValue ?? null,
        isRequired: spec.isRequired ?? false,
      })),
    );
  }

  if (config.calculatedFields?.length) {
    await db.insert(mapCalculatedFields).values(
      config.calculatedFields.map((spec, i) => ({
        mapId: map.id,
        name: spec.name,
        formula: spec.formula,
        displayOrder: spec.displayOrder ?? i,
      })),
    );
  }

  return map.id;
}

/**
 * Run a map end-to-end through executeMap with a fake Oracle connection that
 * returns `rows`. Returns the ExecuteResult plus the SQL/binds the driver
 * actually received (captured off the fake connection).
 */
async function executeTestMap(
  mapId: string,
  params: Record<string, unknown> = {},
  {
    rows = [],
    metaData,
    options = {},
    userId = adminId,
    deps,
  }: {
    rows?: Record<string, unknown>[];
    metaData?: Array<{ name: string }>;
    options?: ExecuteOptions;
    userId?: string;
    deps?: MapExecutionDeps;
  } = {},
) {
  const { conn, execute } = makeRowsConn(rows, metaData);
  const result = await executeMap(
    mapId,
    params,
    userId,
    options,
    deps ?? execDeps(conn),
  );
  const call = (execute.mock.calls[0] ?? []) as [
    string,
    Record<string, unknown>,
  ];
  return { result, sql: call[0] ?? '', binds: call[1] ?? {}, execute };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await cleanupIntegrationUsers();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
});

beforeEach(async () => {
  _resetAsyncState();
  await cleanupIntegrationUsers();

  const admin = await createTestUser(
    `int-qe-${Date.now()}@test.com`,
    'Pw123456!',
    'ADMIN',
  );
  adminId = admin.id;

  const ds = await createTestDataSource(`Oracle DS ${Date.now()}`, 'oracle');
  dsId = ds.id;

  const ba = await createTestBusinessArea(`QE BA ${Date.now()}`, adminId);
  baId = ba.id;

  const sales = await insertFolder({ name: 'SALES' });
  const customers = await insertFolder({ name: 'CUSTOMERS' });

  const region = await insertItem({
    folder: sales,
    name: 'Region',
    columnName: 'REGION',
  });
  const amount = await insertItem({
    folder: sales,
    name: 'Amount',
    columnName: 'AMOUNT',
    dataType: 'NUMBER',
  });
  const orderDate = await insertItem({
    folder: sales,
    name: 'Order Date',
    columnName: 'ORDER_DATE',
    dataType: 'DATE',
  });
  const custIdSales = await insertItem({
    folder: sales,
    name: 'Customer Id',
    columnName: 'CUSTOMER_ID',
    dataType: 'NUMBER',
  });
  const custKey = await insertItem({
    folder: customers,
    name: 'Customer Key',
    columnName: 'CUSTOMER_ID',
    dataType: 'NUMBER',
  });
  const custName = await insertItem({
    folder: customers,
    name: 'Customer Name',
    columnName: 'CUSTOMER_NAME',
  });

  await insertJoin({
    name: 'SALES_CUSTOMERS',
    left: sales,
    leftItem: custIdSales,
    right: customers,
    rightItem: custKey,
    joinType: 'INNER',
  });

  fx = {
    sales,
    customers,
    region,
    amount,
    orderDate,
    custIdSales,
    custKey,
    custName,
  };
});

// ===========================================================================
// Scenario 1 — simple table map (3 items, no conditions)
// ===========================================================================

describe('Scenario 1: simple table map', () => {
  it('generates SQL, mock-executes, and returns the rows', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }, { item: fx.amount }, { item: fx.orderDate }],
    });

    const rows = [
      { REGION: 'EAST', AMOUNT: 100, ORDER_DATE: '2026-01-01' },
      { REGION: 'WEST', AMOUNT: 250, ORDER_DATE: '2026-02-01' },
    ];
    const { result, sql, binds } = await executeTestMap(mapId, {}, { rows });

    assertSqlContains(sql, 'SELECT');
    assertSqlContains(sql, 'f1."REGION"');
    assertSqlContains(sql, 'f1."AMOUNT"');
    assertSqlContains(sql, 'FROM "APP"."SALES" f1');
    // Only the pagination probe bind is present (no conditions on this map).
    expect(Object.keys(binds).filter((k) => /^c\d/.test(k))).toHaveLength(0);

    expect(result.rows).toEqual(rows);
    expect(result.rowCount).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.columns.map((c) => c.label)).toEqual([
      'Region',
      'Amount',
      'Order Date',
    ]);
  });
});

// ===========================================================================
// Scenario 2 — join across two folders
// ===========================================================================

describe('Scenario 2: join across two folders', () => {
  it('emits the correct INNER JOIN clause', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }, { item: fx.custName, displayOrder: 1 }],
    });

    const { sql } = await executeTestMap(
      mapId,
      {},
      { rows: [{ REGION: 'EAST', CUSTOMER_NAME: 'Acme' }] },
    );

    assertSqlContains(
      sql,
      'FROM "APP"."SALES" f1 INNER JOIN "APP"."CUSTOMERS" f2 ON f1."CUSTOMER_ID" = f2."CUSTOMER_ID"',
    );
  });
});

// ===========================================================================
// Scenario 3 — aggregation (SUM) + GROUP BY
// ===========================================================================

describe('Scenario 3: aggregation', () => {
  it('wraps SUM and groups by the non-aggregate column', async () => {
    const mapId = await createTestMap({
      items: [
        { item: fx.region },
        { item: fx.amount, displayOrder: 1, aggFunction: 'SUM' },
      ],
    });

    const { result, sql } = await executeTestMap(
      mapId,
      {},
      { rows: [{ REGION: 'EAST', AMOUNT: 350 }] },
    );

    assertSqlContains(sql, 'SUM(f1."AMOUNT")');
    assertSqlContains(sql, 'GROUP BY f1."REGION"');
    expect(result.columns.find((c) => c.label === 'Amount')?.isAggregate).toBe(
      true,
    );
  });
});

// ===========================================================================
// Scenario 4 — static WHERE conditions
// ===========================================================================

describe('Scenario 4: WHERE conditions', () => {
  it('renders comparison conditions as bind variables', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }, { item: fx.amount, displayOrder: 1 }],
      conditions: [
        { item: fx.region, operator: '=', value: 'EMEA' },
        { item: fx.amount, operator: '>=', value: '100', displayOrder: 1 },
      ],
    });

    const { sql, binds } = await executeTestMap(
      mapId,
      {},
      { rows: [{ REGION: 'EMEA', AMOUNT: 500 }] },
    );

    assertSqlContains(sql, 'WHERE f1."REGION" = :c0 AND f1."AMOUNT" >= :c1');
    expect(binds).toMatchObject({ c0: 'EMEA', c1: 100 });
  });
});

// ===========================================================================
// Scenario 5 — parameter -> bind variable
// ===========================================================================

describe('Scenario 5: parameter execution', () => {
  it('binds a provided parameter value into the query', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }],
      conditions: [
        {
          item: fx.region,
          operator: '=',
          conditionType: 'PARAMETER',
          paramName: 'p_region',
        },
      ],
      parameters: [{ name: 'p_region', paramType: 'STRING' }],
    });

    const { sql, binds, execute } = await executeTestMap(
      mapId,
      { p_region: 'EMEA' },
      { rows: [{ REGION: 'EMEA' }] },
    );

    assertSqlContains(sql, 'f1."REGION" = :p_region');
    expect(binds.p_region).toBe('EMEA');
    // The driver received the bind value.
    const driverBinds = execute.mock.calls[0]![1] as Record<string, unknown>;
    expect(driverBinds.p_region).toBe('EMEA');
  });
});

// ===========================================================================
// Scenario 6 — ad-hoc calculated field (JS evaluator path)
// ===========================================================================

describe('Scenario 6: ad-hoc calculated field', () => {
  it('appends a post-query calculated column to the results', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.amount }],
    });

    const { result } = await executeTestMap(
      mapId,
      {},
      {
        rows: [{ AMOUNT: 10 }, { AMOUNT: 20 }],
        metaData: [{ name: 'AMOUNT' }],
        options: {
          calculatedFields: [{ name: 'DOUBLED', formula: 'AMOUNT * 2' }],
        },
      },
    );

    expect(result.columns.map((c) => c.name)).toContain('DOUBLED');
    expect(result.rows).toEqual([
      { AMOUNT: 10, DOUBLED: 20 },
      { AMOUNT: 20, DOUBLED: 40 },
    ]);
  });

  it('also pushes a STORED calculated field into the SELECT (SQL path)', async () => {
    // The stored-field path is compiled into SQL by the generator; verify both
    // paths coexist end-to-end.
    const mapId = await createTestMap({
      items: [{ item: fx.amount }],
      calculatedFields: [{ name: 'Doubled', formula: 'Amount * 2' }],
    });

    const { sql, result } = await executeTestMap(
      mapId,
      {},
      { rows: [{ AMOUNT: 10, DOUBLED: 20 }] },
    );

    assertSqlContains(sql, 'f1."AMOUNT" * 2 AS DOUBLED');
    expect(result.columns.map((c) => c.label)).toEqual(['Amount', 'Doubled']);
  });
});

// ===========================================================================
// Scenario 7 — complex: joins + aggregation + conditions + parameter + calc
// ===========================================================================

describe('Scenario 7: complex combined map', () => {
  it('combines every feature into one query and executes', async () => {
    const mapId = await createTestMap({
      items: [
        { item: fx.custName, displayOrder: 0 },
        {
          item: fx.amount,
          displayOrder: 1,
          aggFunction: 'SUM',
          displayName: 'Total Amount',
          sortDirection: 'DESC',
          sortOrder: 1,
        },
      ],
      conditions: [
        {
          item: fx.region,
          operator: 'IN',
          conditionType: 'PARAMETER',
          paramName: 'p_regions',
        },
        {
          item: fx.orderDate,
          operator: '>=',
          conditionType: 'PARAMETER',
          paramName: 'p_from',
          displayOrder: 1,
        },
      ],
      parameters: [
        { name: 'p_regions', paramType: 'LIST' },
        { name: 'p_from', paramType: 'DATE' },
      ],
      calculatedFields: [{ name: 'Avg Amount', formula: 'AVG([Amount])' }],
    });

    const { result, sql, binds } = await executeTestMap(
      mapId,
      { p_regions: 'EMEA,APAC', p_from: '2026-01-01' },
      { rows: [{ CUSTOMER_NAME: 'Acme', TOTAL_AMOUNT: 900, AVG_AMOUNT: 450 }] },
    );

    assertSqlContains(sql, 'INNER JOIN');
    assertSqlContains(sql, 'SUM(f2."AMOUNT") AS TOTAL_AMOUNT');
    assertSqlContains(sql, 'AVG(f2."AMOUNT") AS AVG_AMOUNT');
    assertSqlContains(sql, 'IN (:p_regions_0, :p_regions_1)');
    assertSqlContains(sql, "TO_DATE(:p_from, 'YYYY-MM-DD')");
    assertSqlContains(sql, 'GROUP BY f1."CUSTOMER_NAME"');
    assertSqlContains(sql, 'ORDER BY 2 DESC');

    expect(binds).toMatchObject({
      p_regions_0: 'EMEA',
      p_regions_1: 'APAC',
      p_from: '2026-01-01',
    });
    expect(result.rowCount).toBe(1);
  });
});

// ===========================================================================
// Scenario 8 — query_execution_log gets a row
// ===========================================================================

describe('Scenario 8: execution logging', () => {
  it('writes a SUCCESS row to query_execution_log', async () => {
    const mapId = await createTestMap({ items: [{ item: fx.region }] });

    await executeTestMap(
      mapId,
      {},
      { rows: [{ REGION: 'EAST' }, { REGION: 'WEST' }] },
    );

    const logs = await db
      .select()
      .from(queryExecutionLog)
      .where(eq(queryExecutionLog.mapId, mapId));

    expect(logs).toHaveLength(1);
    const entry = logs[0]!;
    expect(entry.status).toBe('SUCCESS');
    expect(entry.rowCount).toBe(2);
    expect(entry.executedBy).toBe(adminId);
    expect(entry.sqlText).toContain('SELECT');
    expect(entry.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ===========================================================================
// Scenario 9 — async execution: submit, poll, fetch results
// ===========================================================================

describe('Scenario 9: async execution', () => {
  it('submits a job, polls to completion, and exposes results', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }, { item: fx.amount, displayOrder: 1 }],
    });

    const rows = [
      { REGION: 'EAST', AMOUNT: 1 },
      { REGION: 'WEST', AMOUNT: 2 },
      { REGION: 'NORTH', AMOUNT: 3 },
    ];
    const { conn } = makeResultSetConn(rows);
    const deps = execDeps(conn);

    const { jobId } = await executeMapAsync(mapId, {}, adminId, {}, deps);
    expect(jobId).toBeTruthy();
    // Initially queued/running.
    expect(getExecutionStatus(jobId)?.mapId).toBe(mapId);

    await waitFor(() => getExecutionStatus(jobId)?.status === 'COMPLETED');

    const job = getExecutionStatus(jobId)!;
    expect(job.status).toBe('COMPLETED');
    expect(job.rowCount).toBe(3);
    expect(job.result?.rows).toEqual(rows);

    // Logged as a successful execution too.
    const logs = await db
      .select()
      .from(queryExecutionLog)
      .where(eq(queryExecutionLog.mapId, mapId));
    expect(logs.some((l) => l.status === 'SUCCESS')).toBe(true);
  });
});

// ===========================================================================
// Scenario 10 — missing required parameter -> CONFIG error
// ===========================================================================

describe('Scenario 10: missing required parameter', () => {
  it('rejects with a CONFIG error when a required parameter is absent', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }],
      conditions: [
        {
          item: fx.region,
          operator: '=',
          conditionType: 'PARAMETER',
          paramName: 'p_region',
        },
      ],
      parameters: [
        { name: 'p_region', paramType: 'STRING', isRequired: true },
      ],
    });

    let caught: unknown;
    try {
      // No parameter value supplied.
      await executeTestMap(mapId, {}, { rows: [] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MapExecutionError);
    expect((caught as MapExecutionError).kind).toBe('CONFIG');
    expect((caught as MapExecutionError).message).toMatch(/p_region/);
  });
});

// ===========================================================================
// Scenario 11 — timeout -> TIMEOUT error
// ===========================================================================

describe('Scenario 11: statement timeout', () => {
  it('maps a driver call-timeout to MapExecutionError kind=TIMEOUT', async () => {
    const mapId = await createTestMap({ items: [{ item: fx.region }] });

    // The real callTimeout is enforced by the native Oracle driver, which is
    // mocked here; emulate it exactly as the driver surfaces it — a DPI-1067
    // rejection after the call is aborted (same approach as map-execution.test.ts).
    const timeoutErr = Object.assign(
      new Error('DPI-1067: call timeout of 30000 ms exceeded'),
      { code: 'DPI-1067' },
    );
    const { conn } = makeFailingConn(timeoutErr);
    const deps = execDeps(conn);

    let caught: unknown;
    try {
      await executeMap(mapId, {}, adminId, { timeoutMs: 1000 }, deps);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MapExecutionError);
    expect((caught as MapExecutionError).kind).toBe('TIMEOUT');

    // Logged as TIMEOUT.
    const logs = await db
      .select()
      .from(queryExecutionLog)
      .where(eq(queryExecutionLog.mapId, mapId));
    expect(logs[0]?.status).toBe('TIMEOUT');
  });
});

// ===========================================================================
// Scenario 12 — row security predicate injected into WHERE
// ===========================================================================

describe('Scenario 12: row-level security predicate', () => {
  it('injects a configured security predicate into the WHERE clause', async () => {
    const mapId = await createTestMap({
      items: [{ item: fx.region }],
      conditions: [{ item: fx.region, operator: '=', value: 'EMEA' }],
    });

    // Row-level policy evaluation is a later session; defaultPrepareQuery wires
    // an (empty) securityPredicates resolver. To verify end-to-end injection now,
    // supply a prepareQuery that runs the REAL loadMapDefinition + generateSql
    // with a security predicate set via SqlGenerationOptions.securityPredicates.
    const predicate = 'f1."REGION" = \'EMEA\'';
    const prepareQuery: MapExecutionDeps['prepareQuery'] = async (
      id,
      params,
      _userId,
      rowLimit,
    ) => {
      const def = await loadMapDefinition(id);
      const dataSourceId = resolveDataSourceId(def);
      const generated = generateSql(def, {
        parameterValues: params,
        securityPredicates: [predicate],
        rowLimit,
      });
      return {
        sql: generated.sql,
        bindParams: generated.bindParams,
        columns: generated.columns,
        dataSourceId,
      };
    };

    const { conn, execute } = makeRowsConn([{ REGION: 'EMEA' }]);
    const deps = execDeps(conn, { prepareQuery });

    await executeMap(mapId, {}, adminId, {}, deps);

    const sql = execute.mock.calls[0]![0] as string;
    // Both the map's own condition and the security predicate are present.
    assertSqlContains(sql, 'f1."REGION" = :c0');
    assertSqlContains(sql, 'AND (f1."REGION" = \'EMEA\')');
  });
});
