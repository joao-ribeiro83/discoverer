import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Connection } from 'oracledb';
import ExcelJS from 'exceljs';
import { parseFile } from 'fast-csv';
import {
  createExportJob,
  processExportJob,
  failExportJob,
  getExportJob,
  listExportJobs,
  downloadExport,
  cleanupOldExports,
  buildExportFilePath,
  streamingProgress,
  ExportNotReadyError,
  ExportFileMissingError,
  type ExportJobDeps,
  type ExportJobRecord,
  type ExportJobPatch,
  type ExportFormat,
  type CleanupDeps,
} from '../services/export.service.js';
import { attemptsExhausted } from '../workers/export.worker.js';
import { writeXlsx, excelNumberFormat, sheetNameFor } from '../services/exporters/excel-exporter.js';
import { writeCsv } from '../services/exporters/csv-exporter.js';
import type { ExportSource } from '../services/exporters/types.js';
import type { PreparedQuery, ResultColumn } from '../services/map-execution.service.js';
import { EXPORT_JOB_OPTIONS, type ExportJobData } from '../queues/export.queue.js';
import type { Job } from 'bullmq';

// ---------------------------------------------------------------------------
// Fixtures & fakes.
//
// Hermetic: no Postgres, Oracle or Redis. The job row store, the Oracle
// connection and the queue are all faked, but the exporters are exercised for
// real against the filesystem — a mocked file writer would prove nothing about
// whether the .xlsx/.csv we ship is actually valid.
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

/** A fake Connection that streams rows via a result set. */
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

/** In-memory fake of the `export_jobs` table. */
class FakeJobStore {
  jobs = new Map<string, ExportJobRecord>();
  private seq = 0;

  createJob = async (input: {
    mapId: string;
    requestedBy: string;
    format: ExportFormat;
  }): Promise<ExportJobRecord> => {
    this.seq += 1;
    const record: ExportJobRecord = {
      id: `job-${this.seq}`,
      mapId: input.mapId,
      requestedBy: input.requestedBy,
      format: input.format,
      status: 'PENDING',
      progress: 0,
      rowCount: null,
      filePath: null,
      errorMessage: null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.jobs.set(record.id, record);
    return { ...record };
  };

  updateJob = async (id: string, patch: ExportJobPatch): Promise<void> => {
    const existing = this.jobs.get(id);
    if (!existing) return;
    this.jobs.set(id, { ...existing, ...patch });
  };

  getJob = async (id: string): Promise<ExportJobRecord | null> => {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  };

  listJobs = async (userId: string, limit: number): Promise<ExportJobRecord[]> => {
    return [...this.jobs.values()]
      .filter((j) => j.requestedBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  };
}

function makeDeps(
  conn: Connection,
  overrides: Partial<ExportJobDeps> = {},
): {
  deps: ExportJobDeps;
  store: FakeJobStore;
  prepareQuery: jest.Mock;
  getConnection: jest.Mock;
  releaseConnection: jest.Mock;
  writeExportFile: jest.Mock;
  enqueue: jest.Mock;
  /** Rows the fake writer consumed from the streaming source. */
  drained: Record<string, unknown>[];
} {
  const prepared = makePrepared();
  const store = new FakeJobStore();
  const prepareQuery = jest.fn(async () => prepared) as jest.Mock;
  const getConnection = jest.fn(async () => conn) as jest.Mock;
  const releaseConnection = jest.fn(async () => {}) as jest.Mock;
  // Drains the source the way a real writer does, and keeps what it saw so
  // tests can assert on the rows that would have been written. (Re-iterating
  // `source.batches` afterwards yields nothing — it is a one-shot generator.)
  const drained: Record<string, unknown>[] = [];
  const writeExportFile = jest.fn(async (source: unknown) => {
    for await (const batch of (source as ExportSource).batches) drained.push(...batch);
    return { rowCount: drained.length };
  }) as jest.Mock;
  const enqueue = jest.fn(async () => {}) as jest.Mock;

  const deps = {
    prepareQuery,
    getConnection,
    releaseConnection,
    createJob: store.createJob,
    updateJob: store.updateJob,
    getJob: store.getJob,
    listJobs: store.listJobs,
    writeExportFile,
    enqueue,
    ...overrides,
  } as unknown as ExportJobDeps;

  return {
    deps,
    store,
    prepareQuery,
    getConnection,
    releaseConnection,
    writeExportFile,
    enqueue,
    drained,
  };
}

function jobData(over: Partial<ExportJobData> = {}): ExportJobData {
  return {
    exportJobId: 'job-1',
    mapId: MAP_ID,
    format: 'CSV',
    requestedBy: USER_ID,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// createExportJob — enqueue only; the worker does the work.
// ---------------------------------------------------------------------------

describe('createExportJob', () => {
  it('creates a PENDING row and enqueues a job carrying its id', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, enqueue } = makeDeps(conn);

    const { jobId } = await createExportJob(MAP_ID, 'XLSX', USER_ID, {}, deps);

    const job = await getExportJob(jobId, deps);
    expect(job).not.toBeNull();
    expect(job!.status).toBe('PENDING');
    expect(job!.progress).toBe(0);
    expect(job!.rowCount).toBeNull();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]).toEqual({
      exportJobId: jobId,
      mapId: MAP_ID,
      format: 'XLSX',
      requestedBy: USER_ID,
      parameters: undefined,
      calculatedFields: undefined,
    });
  });

  it('forwards parameters and calculated fields onto the queued job', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, enqueue } = makeDeps(conn);

    await createExportJob(
      MAP_ID,
      'CSV',
      USER_ID,
      {
        parameters: { region: 'EAST' },
        calculatedFields: [{ name: 'DOUBLED', formula: 'C1 * 2' }],
      },
      deps,
    );

    const data = enqueue.mock.calls[0]![0] as ExportJobData;
    expect(data.parameters).toEqual({ region: 'EAST' });
    expect(data.calculatedFields).toEqual([{ name: 'DOUBLED', formula: 'C1 * 2' }]);
  });

  it('fails the row when queueing fails, rather than leaving it PENDING forever', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn, {
      enqueue: jest.fn(async () => {
        throw new Error('Redis unavailable');
      }) as unknown as ExportJobDeps['enqueue'],
    });

    await expect(createExportJob(MAP_ID, 'CSV', USER_ID, {}, deps)).rejects.toThrow(
      'Redis unavailable',
    );

    const [job] = await listExportJobs(USER_ID, 10, deps);
    expect(job!.status).toBe('FAILED');
    expect(job!.errorMessage).toContain('Could not queue export');
  });

  it('does no query work at creation time — that is the worker’s job', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps, prepareQuery, getConnection } = makeDeps(conn);

    await createExportJob(MAP_ID, 'CSV', USER_ID, {}, deps);

    expect(prepareQuery).not.toHaveBeenCalled();
    expect(getConnection).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// processExportJob — what the worker runs.
// ---------------------------------------------------------------------------

describe('processExportJob', () => {
  it('streams rows to a file and completes the job with a row count', async () => {
    const { conn } = makeResultSetConn([{ C1: 10 }, { C1: 20 }]);
    const { deps, store, writeExportFile, releaseConnection } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'XLSX' });

    const result = await processExportJob(jobData({ format: 'XLSX' }), deps);

    expect(result.rowCount).toBe(2);
    expect(result.filePath).toBe(buildExportFilePath('job-1', 'XLSX'));

    const job = await getExportJob('job-1', deps);
    expect(job!.status).toBe('COMPLETED');
    expect(job!.progress).toBe(100);
    expect(job!.rowCount).toBe(2);
    expect(job!.filePath).toBe(buildExportFilePath('job-1', 'XLSX'));
    expect(job!.completedAt).not.toBeNull();

    const [source, format, filePath] = writeExportFile.mock.calls[0] as [
      ExportSource,
      string,
      string,
    ];
    expect(source.columns).toEqual([
      { name: 'C1', label: 'Amount', isAggregate: false, dataType: undefined, formatMask: undefined, columnWidth: undefined },
    ]);
    expect(format).toBe('XLSX');
    expect(filePath).toBe(buildExportFilePath('job-1', 'XLSX'));

    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('marks the job PROCESSING before doing any work', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const seen: string[] = [];
    const store = new FakeJobStore();
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    const { deps } = makeDeps(conn, {
      createJob: store.createJob,
      getJob: store.getJob,
      listJobs: store.listJobs,
      updateJob: async (id, patch) => {
        if (patch.status) seen.push(patch.status);
        await store.updateJob(id, patch);
      },
    });

    await processExportJob(jobData(), deps);
    expect(seen).toEqual(['PROCESSING', 'COMPLETED']);
  });

  it('throws (so BullMQ can retry) when the query fails, and still releases the connection', async () => {
    const { conn } = makeFailingConn(new Error('ORA-00942: table or view does not exist'));
    const { deps, store, releaseConnection } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await expect(processExportJob(jobData(), deps)).rejects.toThrow('ORA-00942');

    // Deliberately NOT marked FAILED here: an attempt failing is not terminal.
    const job = await getExportJob('job-1', deps);
    expect(job!.status).toBe('PROCESSING');
    expect(releaseConnection).toHaveBeenCalledTimes(1);
  });

  it('throws without writing a file when the connection cannot be acquired', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, store, writeExportFile, releaseConnection } = makeDeps(conn, {
      getConnection: jest.fn(async () => {
        throw new Error('pool exhausted');
      }) as unknown as ExportJobDeps['getConnection'],
    });
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await expect(processExportJob(jobData(), deps)).rejects.toThrow('pool exhausted');
    expect(writeExportFile).not.toHaveBeenCalled();
    expect(releaseConnection).not.toHaveBeenCalled();
  });

  it('throws when prepareQuery rejects (e.g. bad map config)', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, store } = makeDeps(conn, {
      prepareQuery: jest.fn(async () => {
        throw new Error('This map has no data source configured');
      }) as unknown as ExportJobDeps['prepareQuery'],
    });
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await expect(processExportJob(jobData(), deps)).rejects.toThrow(
      'no data source configured',
    );
  });

  it('closes the DB cursor even when the writer throws mid-stream', async () => {
    const { conn, resultSet } = makeResultSetConn([{ C1: 1 }, { C1: 2 }]);
    const { deps, store } = makeDeps(conn, {
      writeExportFile: jest.fn(async () => {
        throw new Error('disk full');
      }) as unknown as ExportJobDeps['writeExportFile'],
    });
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await expect(processExportJob(jobData(), deps)).rejects.toThrow('disk full');
    // Releasing a connection with an open cursor leaks it (eventually
    // ORA-01000), so this must happen regardless of how the export ended.
    expect(resultSet.close).toHaveBeenCalled();
  });

  it('applies ad-hoc calculated fields to the streamed columns and rows', async () => {
    const { conn } = makeResultSetConn([{ C1: 10 }, { C1: 20 }]);
    const { deps, store, writeExportFile, drained } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await processExportJob(
      jobData({ calculatedFields: [{ name: 'DOUBLED', formula: 'C1 * 2' }] }),
      deps,
    );

    const source = writeExportFile.mock.calls[0]![0] as ExportSource;
    expect(source.columns.map((c) => c.name)).toEqual(['C1', 'DOUBLED']);

    // Evaluated per batch as they stream, not over a buffered result set.
    expect(drained).toEqual([
      { C1: 10, DOUBLED: 20 },
      { C1: 20, DOUBLED: 40 },
    ]);
  });

  it('rejects a bad calculated-field formula before reading any row', async () => {
    const { conn, resultSet } = makeResultSetConn([{ C1: 1 }]);
    const { deps, store } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await expect(
      processExportJob(
        jobData({ calculatedFields: [{ name: 'BAD', formula: 'C1 +' }] }),
        deps,
      ),
    ).rejects.toThrow();

    expect(resultSet.getRows).not.toHaveBeenCalled();
  });

  it('forwards parameters to prepareQuery with no row limit', async () => {
    const { conn } = makeResultSetConn([{ C1: 1 }]);
    const { deps, store, prepareQuery } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await processExportJob(jobData({ parameters: { region: 'EAST' } }), deps);

    // An export must not inherit the interactive row cap.
    expect(prepareQuery).toHaveBeenCalledWith(MAP_ID, { region: 'EAST' }, USER_ID);
  });

  it('reports progress that rises but never reaches 100 until completion', async () => {
    const rows = Array.from({ length: 25_000 }, (_, i) => ({ C1: i }));
    const { conn } = makeResultSetConn(rows);
    const progress: number[] = [];
    const store = new FakeJobStore();
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    const { deps } = makeDeps(conn, {
      createJob: store.createJob,
      getJob: store.getJob,
      listJobs: store.listJobs,
      updateJob: async (id, patch) => {
        if (patch.progress !== undefined) progress.push(patch.progress);
        await store.updateJob(id, patch);
      },
      // Use the real CSV writer's progress cadence via a temp file.
      writeExportFile: async (source, _format, _filePath, onRows) => {
        const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'progress-'));
        try {
          return await writeCsv(path.join(dir, 'p.csv'), source, { onRows });
        } finally {
          await fsp.rm(dir, { recursive: true, force: true });
        }
      },
    });

    await processExportJob(jobData(), deps);

    const beforeDone = progress.slice(0, -1);
    expect(beforeDone.length).toBeGreaterThan(1);
    expect(Math.max(...beforeDone)).toBeLessThan(100);
    // Monotonic: a bar that goes backwards is worse than no bar.
    for (let i = 1; i < beforeDone.length; i += 1) {
      expect(beforeDone[i]!).toBeGreaterThanOrEqual(beforeDone[i - 1]!);
    }
    expect(progress.at(-1)).toBe(100);
  });
});

describe('streamingProgress', () => {
  it('is monotonic, starts at the streaming floor and never reaches the ceiling', () => {
    expect(streamingProgress(0)).toBe(10);
    expect(streamingProgress(1_000_000_000)).toBeLessThanOrEqual(90);

    let prev = -1;
    for (const rows of [0, 1_000, 50_000, 250_000, 1_000_000, 10_000_000]) {
      const p = streamingProgress(rows);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

// ---------------------------------------------------------------------------
// failExportJob — the worker's terminal path.
// ---------------------------------------------------------------------------

describe('failExportJob', () => {
  it('records the error and stamps completedAt', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, store } = makeDeps(conn);
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });

    await failExportJob('job-1', 'ORA-12541: TNS:no listener', deps);

    const job = await getExportJob('job-1', deps);
    expect(job!.status).toBe('FAILED');
    expect(job!.errorMessage).toContain('ORA-12541');
    expect(job!.completedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('getExportJob / listExportJobs', () => {
  it('returns null for an unknown job id', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps } = makeDeps(conn);
    expect(await getExportJob('does-not-exist', deps)).toBeNull();
  });

  it('lists only the requesting user’s jobs, newest first', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, store } = makeDeps(conn);

    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });
    await new Promise((r) => setTimeout(r, 2));
    await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'XLSX' });
    await store.createJob({ mapId: MAP_ID, requestedBy: 'someone-else', format: 'CSV' });

    const jobs = await listExportJobs(USER_ID, 50, deps);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.requestedBy === USER_ID)).toBe(true);
    expect(jobs[0]!.format).toBe('XLSX');
  });

  it('honours the limit', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, store } = makeDeps(conn);
    for (let i = 0; i < 5; i += 1) {
      await store.createJob({ mapId: MAP_ID, requestedBy: USER_ID, format: 'CSV' });
    }
    expect(await listExportJobs(USER_ID, 3, deps)).toHaveLength(3);
  });
});

describe('buildExportFilePath', () => {
  it('derives the extension from the format', () => {
    expect(buildExportFilePath('job-1', 'XLSX')).toMatch(/job-1\.xlsx$/);
    expect(buildExportFilePath('job-1', 'CSV')).toMatch(/job-1\.csv$/);
  });
});

// ---------------------------------------------------------------------------
// Real file output.
//
// These write and then read back actual files: the point is to prove the bytes
// we hand a user open cleanly, which a mocked writer cannot tell us.
// ---------------------------------------------------------------------------

describe('exporters', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'export-test-'));
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  const columns: ResultColumn[] = [
    { name: 'REGION', label: 'Region', isAggregate: false, dataType: 'VARCHAR2' },
    {
      name: 'AMOUNT',
      label: 'Amount',
      isAggregate: true,
      dataType: 'NUMBER',
      formatMask: '999,999.00',
    },
    {
      name: 'SOLD_ON',
      label: 'Sold On',
      isAggregate: false,
      dataType: 'DATE',
      formatMask: 'YYYY-MM-DD',
    },
  ];

  /** Values chosen to break naive writers: quotes, commas, newlines, nulls. */
  const NASTY = 'He said "hi", then\nleft';

  function source(rows: Record<string, unknown>[], batchSize = 100): ExportSource {
    return {
      columns,
      batches: (async function* () {
        for (let i = 0; i < rows.length; i += batchSize) {
          yield rows.slice(i, i + batchSize);
        }
      })(),
    };
  }

  const sampleRows = [
    { REGION: 'East', AMOUNT: 1234.5, SOLD_ON: new Date(Date.UTC(2026, 0, 15)) },
    { REGION: NASTY, AMOUNT: 0, SOLD_ON: new Date(Date.UTC(2026, 1, 2)) },
    { REGION: null, AMOUNT: null, SOLD_ON: null },
  ];

  describe('writeXlsx', () => {
    it('produces an .xlsx that reads back with correct headers, values and formats', async () => {
      const file = path.join(dir, 'out.xlsx');
      const result = await writeXlsx(file, source(sampleRows));
      expect(result.rowCount).toBe(3);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const sheet = wb.getWorksheet('Data')!;

      expect(sheet.getRow(1).values).toEqual([
        undefined,
        'Region',
        'Amount',
        'Sold On',
      ]);
      // header + the two rows that carry content. The trailing all-null row is
      // legitimately not encoded — see the null-row test below.
      expect(sheet.actualRowCount).toBe(3);

      expect(sheet.getRow(2).getCell(1).value).toBe('East');
      expect(sheet.getRow(2).getCell(2).value).toBe(1234.5);
      expect(sheet.getRow(2).getCell(3).value).toBeInstanceOf(Date);

      // Round-trips embedded quotes/commas/newlines without mangling them.
      expect(sheet.getRow(3).getCell(1).value).toBe(NASTY);

      expect(sheet.getRow(4).getCell(1).value).toBeNull();

      // Oracle mask -> Excel numFmt, applied to the column.
      expect(sheet.getColumn(2).style?.numFmt).toBe('###,###.00');
      expect(sheet.getColumn(3).style?.numFmt).toBe('yyyy-mm-dd');
    });

    it('keeps an all-null row in its slot instead of shifting later rows up', async () => {
      // A row of nothing but nulls carries no cells, so the format omits its
      // <row> element entirely. That is correct — but only as long as the rows
      // after it keep their positions, otherwise the export silently loses a
      // row and every subsequent one is misaligned.
      const file = path.join(dir, 'nulls.xlsx');
      const result = await writeXlsx(
        file,
        source([
          { REGION: 'first', AMOUNT: 1, SOLD_ON: null },
          { REGION: null, AMOUNT: null, SOLD_ON: null },
          { REGION: 'third', AMOUNT: 3, SOLD_ON: null },
        ]),
      );
      expect(result.rowCount).toBe(3);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const sheet = wb.getWorksheet('Data')!;

      expect(sheet.getRow(2).getCell(1).value).toBe('first');
      expect(sheet.getRow(3).getCell(1).value).toBeNull();
      expect(sheet.getRow(4).getCell(1).value).toBe('third');
    });

    it('writes an openable workbook for an empty result', async () => {
      const file = path.join(dir, 'empty.xlsx');
      const result = await writeXlsx(file, source([]));
      expect(result.rowCount).toBe(0);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      const sheet = wb.getWorksheet('Data');
      expect(sheet).toBeDefined();
      expect(sheet!.getRow(1).values).toEqual([undefined, 'Region', 'Amount', 'Sold On']);
    });

    it('streams a large result without buffering it', async () => {
      const rows = Array.from({ length: 20_000 }, (_, i) => ({
        REGION: `r${i % 7}`,
        AMOUNT: i,
        SOLD_ON: new Date(Date.UTC(2026, 0, 1)),
      }));
      const file = path.join(dir, 'big.xlsx');
      const result = await writeXlsx(file, source(rows, 1_000));
      expect(result.rowCount).toBe(20_000);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      expect(wb.getWorksheet('Data')!.rowCount).toBe(20_001);
    });

    it('splits a crosstab across one sheet per value', async () => {
      const rows = Array.from({ length: 30 }, (_, i) => ({
        REGION: `R${i % 3}`,
        AMOUNT: i,
        SOLD_ON: null,
      }));
      const file = path.join(dir, 'ct.xlsx');
      const result = await writeXlsx(file, source(rows), { sheetByColumn: 'REGION' });

      expect(result.sheets).toEqual(['R0', 'R1', 'R2']);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      // 30 rows over 3 values -> 10 data rows + header each.
      expect(wb.getWorksheet('R0')!.rowCount).toBe(11);
      expect(wb.getWorksheet('R2')!.rowCount).toBe(11);
    });

    it('honours a configured column width over the sampled fit', async () => {
      const file = path.join(dir, 'width.xlsx');
      const withWidth: ResultColumn[] = [
        { ...columns[0]!, columnWidth: 42 },
        columns[1]!,
        columns[2]!,
      ];
      await writeXlsx(file, { columns: withWidth, batches: source(sampleRows).batches });

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(file);
      expect(wb.getWorksheet('Data')!.getColumn(1).width).toBe(42);
    });
  });

  describe('sheetNameFor', () => {
    it('strips characters Excel rejects, including newlines', () => {
      expect(sheetNameFor('a/b\\c:d?e*f[g]h', new Set())).toBe('a b c d e f g h');
      expect(sheetNameFor('two\nlines', new Set())).toBe('two lines');
    });

    it('caps at 31 characters and de-duplicates collisions', () => {
      const taken = new Set<string>();
      const first = sheetNameFor('x'.repeat(40), taken);
      expect(first).toHaveLength(31);
      taken.add(first);

      const second = sheetNameFor('x'.repeat(40), taken);
      expect(second).not.toBe(first);
      expect(second.length).toBeLessThanOrEqual(31);
    });

    it('substitutes a name for blank values and the reserved History', () => {
      expect(sheetNameFor(null, new Set())).toBe('(blank)');
      expect(sheetNameFor('', new Set())).toBe('(blank)');
      expect(sheetNameFor('History', new Set())).toBe('History_');
    });
  });

  describe('excelNumberFormat', () => {
    it('converts Oracle masks it understands', () => {
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'NUMBER', formatMask: '999,999.00' })).toBe('###,###.00');
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'DATE', formatMask: 'DD-MON-YYYY' })).toBe('dd-mmm-yyyy');
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'DATE', formatMask: 'YYYY-MM-DD HH24:MI:SS' })).toBe('yyyy-mm-dd hh:mm:ss');
    });

    it('falls back to a type default rather than emitting an invalid format', () => {
      // An unconvertible mask must not become a corrupt numFmt.
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'DATE', formatMask: 'totally bogus' })).toBe('yyyy-mm-dd');
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'NUMBER', formatMask: 'nonsense!!' })).toBeUndefined();
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'TIMESTAMP(6)' })).toBe('yyyy-mm-dd hh:mm:ss');
      expect(excelNumberFormat({ name: 'a', label: 'a', isAggregate: false, dataType: 'VARCHAR2' })).toBeUndefined();
    });
  });

  describe('writeCsv', () => {
    async function readCsv(file: string): Promise<Record<string, string>[]> {
      return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];
        parseFile(file, { headers: true })
          .on('error', reject)
          .on('data', (r: Record<string, string>) => rows.push(r))
          .on('end', () => resolve(rows));
      });
    }

    it('produces a CSV that reads back with correct headers and escaping', async () => {
      const file = path.join(dir, 'out.csv');
      const result = await writeCsv(file, source(sampleRows));
      expect(result.rowCount).toBe(3);

      const rows = await readCsv(file);
      expect(rows).toHaveLength(3);
      expect(Object.keys(rows[0]!)).toEqual(['Region', 'Amount', 'Sold On']);
      expect(rows[0]).toEqual({ Region: 'East', Amount: '1234.5', 'Sold On': '2026-01-15' });

      // Quotes, commas and newlines survive a round trip.
      expect(rows[1]!.Region).toBe(NASTY);

      // Nulls render as empty, not the string "null".
      expect(rows[2]).toEqual({ Region: '', Amount: '', 'Sold On': '' });
    });

    it('writes a UTF-8 BOM so Excel does not mangle non-ASCII text', async () => {
      const file = path.join(dir, 'bom.csv');
      await writeCsv(file, {
        columns,
        batches: (async function* () {
          yield [{ REGION: 'Ünïcodé — ✓', AMOUNT: 1, SOLD_ON: null }];
        })(),
      });

      const raw = fs.readFileSync(file);
      expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(raw.toString('utf8')).toContain('Ünïcodé — ✓');
    });

    it('has no row limit', async () => {
      const rows = Array.from({ length: 50_000 }, (_, i) => ({
        REGION: `r${i}`,
        AMOUNT: i,
        SOLD_ON: null,
      }));
      const file = path.join(dir, 'many.csv');
      const result = await writeCsv(file, source(rows, 1_000));
      expect(result.rowCount).toBe(50_000);
      expect(await readCsv(file)).toHaveLength(50_000);
    });
  });
});

// ---------------------------------------------------------------------------
// downloadExport
// ---------------------------------------------------------------------------

describe('downloadExport', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'download-test-'));
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  function completedJob(filePath: string, format: ExportFormat = 'CSV'): ExportJobRecord {
    return {
      id: 'job-1',
      mapId: MAP_ID,
      requestedBy: USER_ID,
      format,
      status: 'COMPLETED',
      progress: 100,
      rowCount: 1,
      filePath,
      errorMessage: null,
      createdAt: new Date(),
      completedAt: new Date(),
    };
  }

  it('streams the file with the right content type and filename', async () => {
    const file = path.join(dir, 'x.csv');
    await fsp.writeFile(file, 'Region\nEast\n');

    const { stream, filename, contentType } = downloadExport(completedJob(file));
    expect(contentType).toBe('text/csv; charset=utf-8');
    expect(filename).toBe(`map-${MAP_ID}-export.csv`);

    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('Region\nEast\n');
  });

  it('uses the spreadsheet content type for XLSX', async () => {
    const file = path.join(dir, 'x.xlsx');
    await fsp.writeFile(file, 'stub');
    const { filename, contentType } = downloadExport(completedJob(file, 'XLSX'));
    expect(contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(filename).toMatch(/\.xlsx$/);
  });

  it('refuses a job that has not completed', () => {
    const job = { ...completedJob('/nope.csv'), status: 'PROCESSING' as const };
    expect(() => downloadExport(job)).toThrow(ExportNotReadyError);
  });

  it('reports a completed job whose file has been reclaimed', () => {
    const job = completedJob(path.join(dir, 'gone.csv'));
    expect(() => downloadExport(job)).toThrow(ExportFileMissingError);
  });
});

// ---------------------------------------------------------------------------
// Retention sweep
// ---------------------------------------------------------------------------

describe('cleanupOldExports', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  const NOW = new Date('2026-07-17T12:00:00Z');

  function makeCleanupDeps(rows: Array<{ id: string; filePath: string }>) {
    const cleared: string[] = [];
    let cutoffSeen: Date | undefined;
    const deps: CleanupDeps = {
      listExpired: async (cutoff) => {
        cutoffSeen = cutoff;
        return rows;
      },
      removeFile: async (filePath) => {
        await fsp.rm(filePath, { force: true });
      },
      clearFilePath: async (id) => {
        cleared.push(id);
      },
    };
    return { deps, cleared, cutoff: () => cutoffSeen };
  }

  it('deletes expired files and forgets their paths', async () => {
    const a = path.join(dir, 'a.csv');
    const b = path.join(dir, 'b.xlsx');
    await fsp.writeFile(a, 'old');
    await fsp.writeFile(b, 'old');

    const { deps, cleared } = makeCleanupDeps([
      { id: 'job-a', filePath: a },
      { id: 'job-b', filePath: b },
    ]);

    const result = await cleanupOldExports(7, NOW, deps);

    expect(result).toEqual({ deleted: 2, errors: 0 });
    expect(fs.existsSync(a)).toBe(false);
    expect(fs.existsSync(b)).toBe(false);
    // The row survives as history; only the file is reclaimed.
    expect(cleared).toEqual(['job-a', 'job-b']);
  });

  it('derives the cutoff from the retention window', async () => {
    const { deps, cutoff } = makeCleanupDeps([]);
    await cleanupOldExports(7, NOW, deps);
    expect(cutoff()).toEqual(new Date('2026-07-10T12:00:00Z'));

    await cleanupOldExports(1, NOW, deps);
    expect(cutoff()).toEqual(new Date('2026-07-16T12:00:00Z'));
  });

  it('keeps sweeping when one file cannot be removed, and retries it next time', async () => {
    const good = path.join(dir, 'good.csv');
    await fsp.writeFile(good, 'x');

    const { cleared } = makeCleanupDeps([]);
    const deps: CleanupDeps = {
      listExpired: async () => [
        { id: 'job-bad', filePath: path.join(dir, 'locked.csv') },
        { id: 'job-good', filePath: good },
      ],
      removeFile: async (filePath) => {
        if (filePath.endsWith('locked.csv')) throw new Error('EBUSY');
        await fsp.rm(filePath, { force: true });
      },
      clearFilePath: async (id) => {
        cleared.push(id);
      },
    };

    const result = await cleanupOldExports(7, NOW, deps);

    expect(result).toEqual({ deleted: 1, errors: 1 });
    expect(fs.existsSync(good)).toBe(false);
    // The failed one keeps its filePath, so the next sweep picks it up again.
    expect(cleared).toEqual(['job-good']);
  });

  it('does nothing when there is nothing expired', async () => {
    const { deps } = makeCleanupDeps([]);
    expect(await cleanupOldExports(7, NOW, deps)).toEqual({ deleted: 0, errors: 0 });
  });
});

// ---------------------------------------------------------------------------
// Worker retry semantics
// ---------------------------------------------------------------------------

describe('attemptsExhausted', () => {
  const opts = (attempts?: number) => ({ attempts }) as Job<ExportJobData>['opts'];

  it('is false while BullMQ will still retry', () => {
    // A failing attempt mid-way must NOT surface as FAILED to the user: the
    // retry may well succeed.
    expect(attemptsExhausted({ attemptsMade: 1, opts: opts(3) })).toBe(false);
    expect(attemptsExhausted({ attemptsMade: 2, opts: opts(3) })).toBe(false);
  });

  it('is true on the final attempt', () => {
    expect(attemptsExhausted({ attemptsMade: 3, opts: opts(3) })).toBe(true);
    expect(attemptsExhausted({ attemptsMade: 4, opts: opts(3) })).toBe(true);
  });

  it('treats a job with no configured attempts as single-shot', () => {
    expect(attemptsExhausted({ attemptsMade: 1, opts: opts(undefined) })).toBe(true);
  });

  it('treats a missing job as terminal', () => {
    expect(attemptsExhausted(undefined)).toBe(true);
  });
});

describe('export queue configuration', () => {
  it('retries three times with backoff', () => {
    // The prompt's contract: failed exports retry, max 3 attempts.
    expect(EXPORT_JOB_OPTIONS.attempts).toBe(3);
    expect(EXPORT_JOB_OPTIONS.backoff).toEqual({ type: 'exponential', delay: 5_000 });
  });

  it('uses the export job id as the BullMQ job id, so a request cannot double-queue', async () => {
    const { conn } = makeResultSetConn([]);
    const { deps, enqueue } = makeDeps(conn);
    const { jobId } = await createExportJob(MAP_ID, 'CSV', USER_ID, {}, deps);
    expect((enqueue.mock.calls[0]![0] as ExportJobData).exportJobId).toBe(jobId);
  });
});
