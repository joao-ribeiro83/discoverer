import fs from 'node:fs';
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'oracledb';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { parseString } from 'fast-csv';
import { db } from '../../db/index.js';
import {
  folders,
  items,
  maps,
  mapItems,
  exportJobs,
  schedules,
  scheduledResults,
  type Item,
  type Folder,
} from '../../db/schema.js';
import {
  createExportJob,
  processExportJob,
  failExportJob,
  getExportJob,
  cleanupOldExports,
  buildExportFilePath,
  EXPORT_DIR,
  type ExportJobDeps,
} from '../../services/export.service.js';
import {
  processScheduleRun,
  getExecutionHistory,
  computeNextRunTime,
  buildScheduleResultFilePath,
  type SchedulerDeps,
  type ScheduleOutputFormat,
} from '../../services/scheduler.service.js';
import { defaultExportDeps } from '../../services/export.service.js';
import { defaultSchedulerDeps } from '../../services/scheduler.service.js';
import { exportQueue, closeExportQueue, type ExportJobData } from '../../queues/export.queue.js';
import {
  schedulerQueue,
  closeSchedulerQueue,
  RUN_SCHEDULE_JOB,
} from '../../queues/scheduler.queue.js';
import {
  getApp,
  closeApp,
  createTestUser,
  createTestDataSource,
  createTestBusinessArea,
  loginAndGetToken,
  authenticatedRequest,
  cleanupIntegrationUsers,
} from './test-helper.js';

// ===========================================================================
// Export + scheduling integration tests.
//
// The layer export.test.ts / scheduler.test.ts deliberately skip: real Postgres
// rows, real Fastify routes end-to-end (auth / ownership / permission), and real
// BullMQ/Redis queuing. Only the Oracle driver is faked, injected through the
// service DI seam exactly as query-engine.test.ts does it — everything up to and
// after that connection is production code (real prepareQuery / loadMapDefinition
// / generateSql, real DB writes, real file writers, real queue).
// ===========================================================================

// ---------------------------------------------------------------------------
// Oracle driver fakes (same shape as query-engine.test.ts / export.test.ts)
// ---------------------------------------------------------------------------

/** A fake Connection that streams rows through a result set (the export path). */
function makeResultSetConn(rows: Record<string, unknown>[], metaData?: Array<{ name: string }>) {
  const md =
    metaData ?? (rows[0] ? Object.keys(rows[0]).map((name) => ({ name })) : []);
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
    execute: jest.fn(async () => ({ resultSet, metaData: md })),
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, resultSet };
}

/** A fake Connection whose `execute` rejects — models an Oracle-side fault. */
function makeFailingConn(err: unknown): { conn: Connection } {
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute: jest.fn(async () => {
      throw err;
    }),
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection };
}

/**
 * Production export deps with only the Oracle connection faked: real
 * prepareQuery (loadMapDefinition + generateSql), real job-row store (Postgres),
 * real file writer. `enqueue` defaults to a no-op so helper-created rows do not
 * pollute the real queue; tests that assert on queuing use the route (real
 * enqueue) explicitly.
 */
function exportDeps(conn: Connection, overrides: Partial<ExportJobDeps> = {}): ExportJobDeps {
  return {
    ...defaultExportDeps(),
    getConnection: (async () => conn),
    releaseConnection: (async () => {}),
    enqueue: (async () => {}),
    ...overrides,
  };
}

/** Production scheduler deps with only the Oracle connection faked. */
function schedulerDeps(conn: Connection, overrides: Partial<SchedulerDeps> = {}): SchedulerDeps {
  return {
    ...defaultSchedulerDeps(),
    getConnection: (async () => conn),
    releaseConnection: (async () => {}),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// File readers — prove the bytes we ship actually open cleanly.
// ---------------------------------------------------------------------------

async function readXlsx(buffer: Buffer): Promise<{ headers: unknown[]; dataRowCount: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet('Data')!;
  const headers = (sheet.getRow(1).values as unknown[]).slice(1); // drop the 1-based hole
  return { headers, dataRowCount: sheet.actualRowCount - 1 };
}

function readCsv(text: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    parseString(text, { headers: true })
      .on('error', reject)
      .on('data', (r: Record<string, string>) => rows.push(r))
      .on('end', () => resolve(rows));
  });
}

// ---------------------------------------------------------------------------
// Fixtures — real map/folder/item rows via Drizzle (mirrors query-engine.test).
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let adminId: string;
let adminToken: string;
let dsId: string;
let baId: string;
let sales: Folder;
let region: Item;
let amount: Item;

/** Files this run wrote under the storage dirs; removed after each test. */
const createdFiles: string[] = [];
function trackFile(p: string): string {
  createdFiles.push(p);
  return p;
}

async function insertFolder(name: string): Promise<Folder> {
  const [row] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name,
      folderType: 'TABLE',
      tableName: name,
      tableOwner: 'APP',
      dataSourceId: dsId,
      createdBy: adminId,
    })
    .returning();
  return row!;
}

async function insertItem(cfg: {
  folder: Folder;
  name: string;
  columnName: string;
  dataType?: string;
}): Promise<Item> {
  const [row] = await db
    .insert(items)
    .values({
      folderId: cfg.folder.id,
      name: cfg.name,
      itemType: 'CI',
      columnName: cfg.columnName,
      dataType: cfg.dataType ?? 'VARCHAR2',
      createdBy: adminId,
    })
    .returning();
  return row!;
}

/** Assemble a minimal TABLE map over the given items and return its id. */
async function createTestMap(itemList: Item[], name = `EXP Map ${Date.now()}`): Promise<string> {
  const [map] = await db
    .insert(maps)
    .values({ name, mapType: 'TABLE', businessAreaId: baId, createdBy: adminId })
    .returning();
  await db.insert(mapItems).values(
    itemList.map((item, i) => ({ mapId: map!.id, itemId: item.id, displayOrder: i })),
  );
  return map!.id;
}

/** The default two-column map ([Region, Amount]) most tests use. */
async function regionAmountMap(name?: string): Promise<string> {
  return createTestMap([region, amount], name);
}

/** Rows + matching metaData for the [Region, Amount] map. */
function regionAmountRows(n: number): {
  rows: Record<string, unknown>[];
  metaData: Array<{ name: string }>;
} {
  const rows = Array.from({ length: n }, (_, i) => ({
    REGION: `R${i % 5}`,
    AMOUNT: i,
  }));
  return { rows, metaData: [{ name: 'REGION' }, { name: 'AMOUNT' }] };
}

function jobDataFor(jobId: string, mapId: string, format: 'XLSX' | 'CSV'): ExportJobData {
  return { exportJobId: jobId, mapId, format, requestedBy: adminId };
}

async function insertScheduleRow(cfg: {
  mapId: string;
  createdBy?: string;
  outputFormat?: ScheduleOutputFormat;
  isActive?: boolean;
  validFrom?: Date | null;
  validUntil?: Date | null;
  cronExpression?: string;
  timezone?: string;
}): Promise<string> {
  const [row] = await db
    .insert(schedules)
    .values({
      mapId: cfg.mapId,
      name: 'Test schedule',
      cronExpression: cfg.cronExpression ?? '0 9 * * *',
      timezone: cfg.timezone ?? 'UTC',
      validFrom: cfg.validFrom ?? null,
      validUntil: cfg.validUntil ?? null,
      outputFormat: cfg.outputFormat ?? 'CSV',
      isActive: cfg.isActive ?? true,
      createdBy: cfg.createdBy ?? adminId,
    })
    .returning();
  return row!.id;
}

async function drainQueues(): Promise<void> {
  try {
    await exportQueue().obliterate({ force: true });
  } catch {
    /* queue may not have been opened */
  }
  try {
    await schedulerQueue().obliterate({ force: true });
  } catch {
    /* queue may not have been opened */
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await getApp();
  await cleanupIntegrationUsers();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await drainQueues();
  await closeExportQueue();
  await closeSchedulerQueue();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();

  const admin = await createTestUser(`int-exp-${Date.now()}@test.com`, 'Pw123456!', 'ADMIN');
  adminId = admin.id;
  adminToken = await loginAndGetToken(app, admin.email, 'Pw123456!');

  const ds = await createTestDataSource(`Oracle DS ${Date.now()}`, 'oracle');
  dsId = ds.id;

  const ba = await createTestBusinessArea(`EXP BA ${Date.now()}`, adminId);
  baId = ba.id;

  sales = await insertFolder('SALES');
  region = await insertItem({ folder: sales, name: 'Region', columnName: 'REGION' });
  amount = await insertItem({
    folder: sales,
    name: 'Amount',
    columnName: 'AMOUNT',
    dataType: 'NUMBER',
  });
});

afterEach(async () => {
  for (const f of createdFiles) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      /* best effort */
    }
  }
  createdFiles.length = 0;
  await drainQueues();
});

// ===========================================================================
// EXPORT — HTTP route wiring
// ===========================================================================

describe('POST /api/maps/:id/export', () => {
  it('creates a PENDING row, enqueues a real BullMQ job, and GET reflects it', async () => {
    const mapId = await regionAmountMap();

    const res = await authenticatedRequest(app, 'POST', `/api/maps/${mapId}/export`, adminToken, {
      format: 'CSV',
    });
    expect(res.statusCode).toBe(202);
    const { jobId, status } = res.json().data;
    expect(jobId).toBeTruthy();
    expect(status).toBe('PENDING');

    // The row exists in Postgres and is PENDING.
    const poll = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}`,
      adminToken,
    );
    expect(poll.statusCode).toBe(200);
    expect(poll.json().data).toMatchObject({
      jobId,
      mapId,
      format: 'CSV',
      status: 'PENDING',
      progress: 0,
    });

    // And a job carrying that id was really queued (worker is off in tests).
    const queued = await exportQueue().getJob(jobId);
    expect(queued).toBeTruthy();
    expect(queued!.data.mapId).toBe(mapId);

    // It appears in the caller's own list too.
    const list = await authenticatedRequest(app, 'GET', '/api/exports', adminToken);
    expect(list.json().data.some((j: { jobId: string }) => j.jobId === jobId)).toBe(true);
  });

  it('rejects a body without a format with 400', async () => {
    const mapId = await regionAmountMap();
    const res = await authenticatedRequest(app, 'POST', `/api/maps/${mapId}/export`, adminToken, {
      parameters: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ===========================================================================
// EXPORT — processExportJob lifecycle against real Postgres
// ===========================================================================

describe('processExportJob (Oracle mocked, real Postgres rows)', () => {
  it('drives PENDING -> PROCESSING -> COMPLETED with progress reaching 100', async () => {
    const mapId = await regionAmountMap();
    const { rows, metaData } = regionAmountRows(3);
    const { conn } = makeResultSetConn(rows, metaData);
    const deps = exportDeps(conn);

    const { jobId } = await createExportJob(mapId, 'CSV', adminId, {}, deps);
    trackFile(buildExportFilePath(jobId, 'CSV'));

    const before = await getExportJob(jobId, deps);
    expect(before!.status).toBe('PENDING');

    const result = await processExportJob(jobDataFor(jobId, mapId, 'CSV'), deps);
    expect(result.rowCount).toBe(3);

    const after = await getExportJob(jobId, deps);
    expect(after!.status).toBe('COMPLETED');
    expect(after!.progress).toBe(100);
    expect(after!.rowCount).toBe(3);
    expect(after!.filePath).toBe(buildExportFilePath(jobId, 'CSV'));
    expect(after!.completedAt).not.toBeNull();
  });

  it('exercises the streaming/batching path for a few thousand rows', async () => {
    const mapId = await regionAmountMap();
    const { rows, metaData } = regionAmountRows(3000);
    const { conn, resultSet } = makeResultSetConn(rows, metaData);
    const deps = exportDeps(conn);

    const { jobId } = await createExportJob(mapId, 'CSV', adminId, {}, deps);
    const filePath = trackFile(buildExportFilePath(jobId, 'CSV'));

    const result = await processExportJob(jobDataFor(jobId, mapId, 'CSV'), deps);
    expect(result.rowCount).toBe(3000);

    // openRowStream pulls 1,000-row batches, so this is >1 getRows call plus the
    // terminating empty read — i.e. the batching loop, not a single fetch.
    expect(resultSet.getRows.mock.calls.length).toBeGreaterThan(3);

    const parsed = await readCsv(fs.readFileSync(filePath, 'utf8'));
    expect(parsed).toHaveLength(3000);
    expect(Object.keys(parsed[0]!)).toEqual(['Region', 'Amount']);
  });

  it('two concurrent exports both complete with no cross-job state leakage', async () => {
    const mapId = await regionAmountMap();

    const a = makeResultSetConn(regionAmountRows(4).rows, [
      { name: 'REGION' },
      { name: 'AMOUNT' },
    ]);
    const b = makeResultSetConn(regionAmountRows(9).rows, [
      { name: 'REGION' },
      { name: 'AMOUNT' },
    ]);
    const depsA = exportDeps(a.conn);
    const depsB = exportDeps(b.conn);

    const jobA = await createExportJob(mapId, 'CSV', adminId, {}, depsA);
    const jobB = await createExportJob(mapId, 'XLSX', adminId, {}, depsB);
    trackFile(buildExportFilePath(jobA.jobId, 'CSV'));
    trackFile(buildExportFilePath(jobB.jobId, 'XLSX'));

    const [resA, resB] = await Promise.all([
      processExportJob(jobDataFor(jobA.jobId, mapId, 'CSV'), depsA),
      processExportJob(jobDataFor(jobB.jobId, mapId, 'XLSX'), depsB),
    ]);

    expect(resA.rowCount).toBe(4);
    expect(resB.rowCount).toBe(9);

    const rowA = await getExportJob(jobA.jobId, depsA);
    const rowB = await getExportJob(jobB.jobId, depsB);
    expect(rowA!.status).toBe('COMPLETED');
    expect(rowA!.rowCount).toBe(4);
    expect(rowB!.status).toBe('COMPLETED');
    expect(rowB!.rowCount).toBe(9);
  });
});

// ===========================================================================
// EXPORT — download route (file validity + not-ready + ownership)
// ===========================================================================

describe('GET /api/exports/:jobId/download', () => {
  async function completeExport(format: 'XLSX' | 'CSV', rowN = 3): Promise<string> {
    const mapId = await regionAmountMap();
    const { rows, metaData } = regionAmountRows(rowN);
    const { conn } = makeResultSetConn(rows, metaData);
    const deps = exportDeps(conn);
    const { jobId } = await createExportJob(mapId, format, adminId, {}, deps);
    trackFile(buildExportFilePath(jobId, format));
    await processExportJob(jobDataFor(jobId, mapId, format), deps);
    return jobId;
  }

  it('streams a valid XLSX readable by ExcelJS with the right shape', async () => {
    const jobId = await completeExport('XLSX', 5);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const { headers, dataRowCount } = await readXlsx(res.rawPayload);
    expect(headers).toEqual(['Region', 'Amount']);
    expect(dataRowCount).toBe(5);
  });

  it('streams a valid CSV parseable by fast-csv with the right shape', async () => {
    const jobId = await completeExport('CSV', 4);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const parsed = await readCsv(res.rawPayload.toString('utf8'));
    expect(parsed).toHaveLength(4);
    expect(Object.keys(parsed[0]!)).toEqual(['Region', 'Amount']);
  });

  it('returns 409 for a PENDING (not-yet-ready) job', async () => {
    const mapId = await regionAmountMap();
    const { conn } = makeResultSetConn([]);
    const deps = exportDeps(conn);
    const { jobId } = await createExportJob(mapId, 'CSV', adminId, {}, deps);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(409);
  });

  it('ends FAILED with an errorMessage on an Oracle fault, and download is 409', async () => {
    const mapId = await regionAmountMap();
    const { conn } = makeFailingConn(new Error('ORA-00942: table or view does not exist'));
    const deps = exportDeps(conn);
    const { jobId } = await createExportJob(mapId, 'CSV', adminId, {}, deps);

    // The worker's split: processExportJob throws (BullMQ would retry); the
    // terminal FAILED write is failExportJob's job once attempts are exhausted.
    await expect(processExportJob(jobDataFor(jobId, mapId, 'CSV'), deps)).rejects.toThrow(
      'ORA-00942',
    );
    await failExportJob(jobId, 'ORA-00942: table or view does not exist', deps);

    const row = await getExportJob(jobId, deps);
    expect(row!.status).toBe('FAILED');
    expect(row!.errorMessage).toContain('ORA-00942');

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(409);
  });

  it('hides another user’s job as 404 on both poll and download', async () => {
    const jobId = await completeExport('CSV', 2);

    const other = await createTestUser(`int-other-${Date.now()}@test.com`, 'Pw123456!', 'USER');
    const otherToken = await loginAndGetToken(app, other.email, 'Pw123456!');

    const poll = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}`,
      otherToken,
    );
    expect(poll.statusCode).toBe(404);

    const dl = await authenticatedRequest(
      app,
      'GET',
      `/api/exports/${jobId}/download`,
      otherToken,
    );
    expect(dl.statusCode).toBe(404);
  });
});

// ===========================================================================
// EXPORT — retention sweep against real Postgres rows
// ===========================================================================

describe('cleanupOldExports (real exportJobs table)', () => {
  it('deletes expired files and nulls filePath while keeping the row', async () => {
    const mapId = await regionAmountMap();

    const staleFile = trackFile(buildExportFilePath(`stale-${Date.now()}`, 'CSV'));
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.writeFileSync(staleFile, 'Region\nEAST\n');

    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const [stale] = await db
      .insert(exportJobs)
      .values({
        mapId,
        requestedBy: adminId,
        format: 'CSV',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 1,
        filePath: staleFile,
        createdAt: oldDate,
        completedAt: oldDate,
      })
      .returning();

    // A fresh row (created now) must survive the sweep untouched.
    const freshFile = trackFile(buildExportFilePath(`fresh-${Date.now()}`, 'CSV'));
    fs.writeFileSync(freshFile, 'Region\nWEST\n');
    const [fresh] = await db
      .insert(exportJobs)
      .values({
        mapId,
        requestedBy: adminId,
        format: 'CSV',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 1,
        filePath: freshFile,
      })
      .returning();

    const result = await cleanupOldExports(7);
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);

    expect(fs.existsSync(staleFile)).toBe(false);

    // Row survives as history; only its filePath is forgotten.
    const [staleAfter] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, stale!.id));
    expect(staleAfter).toBeTruthy();
    expect(staleAfter!.filePath).toBeNull();
    expect(staleAfter!.status).toBe('COMPLETED');

    // The fresh row and its file are untouched.
    const [freshAfter] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, fresh!.id));
    expect(freshAfter!.filePath).toBe(freshFile);
    expect(fs.existsSync(freshFile)).toBe(true);
  });
});

// ===========================================================================
// SCHEDULING — HTTP route wiring
// ===========================================================================

describe('POST /api/maps/:mapId/schedules', () => {
  it('creates a row and returns nextRunAt matching computeNextRunTime', async () => {
    const mapId = await regionAmountMap();

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/maps/${mapId}/schedules`,
      adminToken,
      {
        name: 'Daily sales',
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
        outputFormat: 'CSV',
      },
    );
    expect(res.statusCode).toBe(201);

    const data = res.json().data;
    expect(data.id).toBeTruthy();
    expect(data.cronExpression).toBe('0 9 * * *');

    const expected = computeNextRunTime('0 9 * * *', 'UTC');
    expect(new Date(data.nextRunAt).toISOString()).toBe(expected!.toISOString());

    // Persisted to Postgres.
    const [row] = await db.select().from(schedules).where(eq(schedules.id, data.id));
    expect(row).toBeTruthy();
    expect(row!.mapId).toBe(mapId);
  });

  it('rejects an invalid cron expression with 400', async () => {
    const mapId = await regionAmountMap();

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/maps/${mapId}/schedules`,
      adminToken,
      {
        name: 'Broken',
        cronExpression: 'not a cron expression',
        outputFormat: 'CSV',
      },
    );
    expect(res.statusCode).toBe(400);

    const rows = await db.select().from(schedules).where(eq(schedules.mapId, mapId));
    expect(rows).toHaveLength(0);
  });
});

// ===========================================================================
// SCHEDULING — trigger enqueues onto the real scheduler queue
// ===========================================================================

describe('POST /api/schedules/:id/trigger', () => {
  async function manualJobsFor(scheduleId: string) {
    const jobs = await schedulerQueue().getJobs([
      'waiting',
      'prioritized',
      'delayed',
      'active',
      'paused',
    ]);
    return jobs.filter(
      (j) => j?.name === RUN_SCHEDULE_JOB && j.data?.manual === true && j.data?.scheduleId === scheduleId,
    );
  }

  it('returns 202 and enqueues a manual run for an active schedule', async () => {
    const mapId = await regionAmountMap();
    // Create via the route so the recurring job scheduler is registered for real.
    const created = await authenticatedRequest(
      app,
      'POST',
      `/api/maps/${mapId}/schedules`,
      adminToken,
      { name: 'Trigger me', cronExpression: '0 9 * * *', outputFormat: 'CSV' },
    );
    const scheduleId = created.json().data.id as string;

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/schedules/${scheduleId}/trigger`,
      adminToken,
    );
    expect(res.statusCode).toBe(202);
    expect(res.json().data).toEqual({ queued: true });

    const manual = await manualJobsFor(scheduleId);
    expect(manual).toHaveLength(1);
    expect(manual[0]!.data.triggeredBy).toBe(adminId);
  });

  it('returns 409 and enqueues nothing for a disabled schedule', async () => {
    const mapId = await regionAmountMap();
    const created = await authenticatedRequest(
      app,
      'POST',
      `/api/maps/${mapId}/schedules`,
      adminToken,
      { name: 'Off', cronExpression: '0 9 * * *', outputFormat: 'CSV', isActive: false },
    );
    const scheduleId = created.json().data.id as string;

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/schedules/${scheduleId}/trigger`,
      adminToken,
    );
    expect(res.statusCode).toBe(409);

    expect(await manualJobsFor(scheduleId)).toHaveLength(0);
  });
});

// ===========================================================================
// SCHEDULING — processScheduleRun against real Postgres
// ===========================================================================

describe('processScheduleRun (Oracle mocked, real Postgres)', () => {
  it('skips a cron-driven run past validUntil and writes no result; a manual run bypasses it', async () => {
    const mapId = await regionAmountMap();
    const scheduleId = await insertScheduleRow({
      mapId,
      validUntil: new Date(Date.now() - 60_000),
    });

    const { conn } = makeResultSetConn(regionAmountRows(2).rows, [
      { name: 'REGION' },
      { name: 'AMOUNT' },
    ]);
    const deps = schedulerDeps(conn);

    const skipped = await processScheduleRun(scheduleId, { manual: false }, deps);
    expect(skipped.skipped).toBe(true);

    const none = await db
      .select()
      .from(scheduledResults)
      .where(eq(scheduledResults.scheduleId, scheduleId));
    expect(none).toHaveLength(0);

    // A manual "run now" is a deliberate action and bypasses the window.
    const ran = await processScheduleRun(scheduleId, { manual: true }, deps);
    expect(ran.skipped).toBe(false);
    if (!ran.skipped) trackFile(buildScheduleResultFilePath(ran.resultId, 'CSV'));

    const after = await db
      .select()
      .from(scheduledResults)
      .where(eq(scheduledResults.scheduleId, scheduleId));
    expect(after).toHaveLength(1);
  });

  it('inserts a SUCCESS result row with a file on disk; getExecutionHistory returns it', async () => {
    const mapId = await regionAmountMap();
    const scheduleId = await insertScheduleRow({ mapId, outputFormat: 'XLSX' });

    const { rows, metaData } = regionAmountRows(6);
    const { conn } = makeResultSetConn(rows, metaData);
    const deps = schedulerDeps(conn);

    const outcome = await processScheduleRun(scheduleId, { manual: false }, deps);
    expect(outcome.skipped).toBe(false);
    if (outcome.skipped) throw new Error('expected a run');

    trackFile(outcome.filePath);
    expect(outcome.rowCount).toBe(6);
    expect(outcome.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(fs.existsSync(outcome.filePath)).toBe(true);
    expect(outcome.filePath).toBe(buildScheduleResultFilePath(outcome.resultId, 'XLSX'));

    const [dbRow] = await db
      .select()
      .from(scheduledResults)
      .where(eq(scheduledResults.id, outcome.resultId));
    expect(dbRow!.status).toBe('SUCCESS');
    expect(dbRow!.rowCount).toBe(6);

    const history = await getExecutionHistory(scheduleId);
    expect(history).toHaveLength(1);
    expect(history[0]!.id).toBe(outcome.resultId);
    expect(history[0]!.status).toBe('SUCCESS');
  });
});

// ===========================================================================
// SCHEDULING — result download route (combined: manual run -> download)
// ===========================================================================

describe('GET /api/schedules/:id/results/:resultId/download', () => {
  async function runAndGet(format: ScheduleOutputFormat, rowN: number) {
    const mapId = await regionAmountMap();
    const scheduleId = await insertScheduleRow({ mapId, outputFormat: format });
    const { rows, metaData } = regionAmountRows(rowN);
    const { conn } = makeResultSetConn(rows, metaData);
    const outcome = await processScheduleRun(scheduleId, { manual: true }, schedulerDeps(conn));
    if (outcome.skipped) throw new Error('expected a run');
    trackFile(outcome.filePath);
    return { scheduleId, resultId: outcome.resultId };
  }

  it('streams a scheduled XLSX result end-to-end with the spreadsheet content-type', async () => {
    const { scheduleId, resultId } = await runAndGet('XLSX', 5);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/schedules/${scheduleId}/results/${resultId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const { headers, dataRowCount } = await readXlsx(res.rawPayload);
    expect(headers).toEqual(['Region', 'Amount']);
    expect(dataRowCount).toBe(5);
  });

  it('streams a scheduled CSV result end-to-end with the csv content-type', async () => {
    const { scheduleId, resultId } = await runAndGet('CSV', 3);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/schedules/${scheduleId}/results/${resultId}/download`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const parsed = await readCsv(res.rawPayload.toString('utf8'));
    expect(parsed).toHaveLength(3);
    expect(Object.keys(parsed[0]!)).toEqual(['Region', 'Amount']);
  });

  it('hides another user’s schedule result as 403 (non-owner)', async () => {
    const { scheduleId, resultId } = await runAndGet('CSV', 1);

    const other = await createTestUser(`int-nonowner-${Date.now()}@test.com`, 'Pw123456!', 'USER');
    const otherToken = await loginAndGetToken(app, other.email, 'Pw123456!');

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/schedules/${scheduleId}/results/${resultId}/download`,
      otherToken,
    );
    expect(res.statusCode).toBe(403);
  });
});
