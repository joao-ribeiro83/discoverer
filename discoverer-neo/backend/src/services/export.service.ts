import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { and, desc, eq, lt, isNotNull } from 'drizzle-orm';
import type { Connection } from 'oracledb';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { exportJobs } from '../db/schema.js';
import { exportQueue, type ExportJobData } from '../queues/export.queue.js';
import {
  defaultDeps,
  openRowStream,
  buildColumns,
  applyCalculatedFields,
  errorMessage,
  DEFAULT_TIMEOUT_MS,
  type MapExecutionDeps,
  type ResultColumn,
  type RowStream,
} from './map-execution.service.js';
import { writeXlsx } from './exporters/excel-exporter.js';
import { writeCsv } from './exporters/csv-exporter.js';
import type { ExportSource, ExportWriteResult } from './exporters/types.js';
import type { CalcFieldInput } from './calculated-field-evaluator.js';

// ---------------------------------------------------------------------------
// Exports are durable, queued work.
//
// The job row in `export_jobs` is the record of truth a client polls; BullMQ
// owns scheduling, retries and concurrency. The two are deliberately split:
// Redis holds only recent job history, while the table outlives it so an
// export can still be found (and re-downloaded) days later.
// ---------------------------------------------------------------------------

export type ExportFormat = 'XLSX' | 'CSV';
export type ExportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Where generated export files are written. Gitignored; created on demand.
 *
 * Resolved from `process.cwd()` (the backend package root under `tsx watch`,
 * the container's `WORKDIR /app`, and where jest runs) rather than
 * `import.meta.url`, since ts-jest's per-file transpilation does not
 * consistently honour a `module` override that permits `import.meta`.
 * `EXPORT_DIR` overrides it so the container can point at a mounted volume.
 */
export const EXPORT_DIR =
  config.EXPORT_DIR ?? path.resolve(process.cwd(), 'storage', 'exports');

export interface ExportOptions {
  parameters?: Record<string, unknown>;
  calculatedFields?: CalcFieldInput[];
}

export interface ExportJobRecord {
  id: string;
  mapId: string;
  requestedBy: string;
  format: ExportFormat;
  status: ExportJobStatus;
  progress: number;
  rowCount: number | null;
  filePath: string | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export type ExportJobPatch = Partial<
  Pick<
    ExportJobRecord,
    'status' | 'progress' | 'rowCount' | 'filePath' | 'errorMessage' | 'completedAt'
  >
>;

// ---------------------------------------------------------------------------
// Injectable dependencies (real implementations by default; mocked in tests)
// ---------------------------------------------------------------------------

export interface ExportJobDeps {
  prepareQuery: MapExecutionDeps['prepareQuery'];
  getConnection: MapExecutionDeps['getConnection'];
  releaseConnection: MapExecutionDeps['releaseConnection'];
  createJob(input: {
    mapId: string;
    requestedBy: string;
    format: ExportFormat;
  }): Promise<ExportJobRecord>;
  updateJob(id: string, patch: ExportJobPatch): Promise<void>;
  getJob(id: string): Promise<ExportJobRecord | null>;
  listJobs(userId: string, limit: number): Promise<ExportJobRecord[]>;
  /** Hands the streaming source to the format's writer. */
  writeExportFile(
    source: ExportSource,
    format: ExportFormat,
    filePath: string,
    onRows?: (rows: number) => void,
  ): Promise<ExportWriteResult>;
  /** Enqueue the background job that performs the export. */
  enqueue(data: ExportJobData): Promise<void>;
}

function rowToRecord(row: typeof exportJobs.$inferSelect): ExportJobRecord {
  return {
    id: row.id,
    mapId: row.mapId,
    requestedBy: row.requestedBy,
    format: row.format,
    status: row.status,
    progress: row.progress,
    rowCount: row.rowCount,
    filePath: row.filePath,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

async function defaultCreateJob(input: {
  mapId: string;
  requestedBy: string;
  format: ExportFormat;
}): Promise<ExportJobRecord> {
  const [row] = await db
    .insert(exportJobs)
    .values({
      mapId: input.mapId,
      requestedBy: input.requestedBy,
      format: input.format,
      status: 'PENDING',
      progress: 0,
    })
    .returning();
  return rowToRecord(row!);
}

async function defaultUpdateJob(id: string, patch: ExportJobPatch): Promise<void> {
  await db.update(exportJobs).set(patch).where(eq(exportJobs.id, id));
}

async function defaultGetJob(id: string): Promise<ExportJobRecord | null> {
  const [row] = await db.select().from(exportJobs).where(eq(exportJobs.id, id)).limit(1);
  return row ? rowToRecord(row) : null;
}

async function defaultListJobs(userId: string, limit: number): Promise<ExportJobRecord[]> {
  const rows = await db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.requestedBy, userId))
    .orderBy(desc(exportJobs.createdAt))
    .limit(limit);
  return rows.map(rowToRecord);
}

async function defaultWriteExportFile(
  source: ExportSource,
  format: ExportFormat,
  filePath: string,
  onRows?: (rows: number) => void,
): Promise<ExportWriteResult> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  return format === 'XLSX'
    ? writeXlsx(filePath, source, { onRows })
    : writeCsv(filePath, source, { onRows });
}

async function defaultEnqueue(data: ExportJobData): Promise<void> {
  await exportQueue().add('export', data, { jobId: data.exportJobId });
}

export function defaultExportDeps(): ExportJobDeps {
  const mapDeps = defaultDeps();
  return {
    // Wrapped (rather than passed by reference) so eslint's unbound-method
    // check doesn't flag extracting a method-shorthand interface member as a
    // bare value — these never relied on `this` binding to begin with.
    prepareQuery: (...args) => mapDeps.prepareQuery(...args),
    getConnection: (dataSourceId) => mapDeps.getConnection(dataSourceId),
    releaseConnection: (dataSourceId, conn) => mapDeps.releaseConnection(dataSourceId, conn),
    createJob: defaultCreateJob,
    updateJob: defaultUpdateJob,
    getJob: defaultGetJob,
    listJobs: defaultListJobs,
    writeExportFile: defaultWriteExportFile,
    enqueue: defaultEnqueue,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionFor(format: ExportFormat): string {
  return format === 'XLSX' ? 'xlsx' : 'csv';
}

export function buildExportFilePath(jobId: string, format: ExportFormat): string {
  return path.join(EXPORT_DIR, `${jobId}.${extensionFor(format)}`);
}

async function safeUpdate(
  deps: ExportJobDeps,
  jobId: string,
  patch: ExportJobPatch,
): Promise<void> {
  try {
    await deps.updateJob(jobId, patch);
  } catch {
    // Best-effort progress reporting; never let it mask the real outcome.
  }
}

/** Progress reported once the query is running but before any row is written. */
const PROGRESS_STREAMING_START = 10;
/** Ceiling for the streaming phase; the remainder is finalising the file. */
const PROGRESS_STREAMING_END = 90;
/** Row count at which streaming progress reaches roughly the halfway mark. */
const PROGRESS_HALFWAY_ROWS = 250_000;

/**
 * Map a running row count onto the streaming progress band.
 *
 * The true total is unknowable without a second COUNT(*) over the same query —
 * which for a multi-million-row join can cost as much as the export itself, so
 * it isn't worth paying for a progress bar. Instead this curve rises quickly
 * at first and approaches (without reaching) the ceiling, so the bar always
 * advances and never claims completion early. Callers that want a real
 * quantity should show `rowCount`, which is exact.
 */
export function streamingProgress(rows: number): number {
  const span = PROGRESS_STREAMING_END - PROGRESS_STREAMING_START;
  const ratio = 1 - Math.exp((-rows * Math.LN2) / PROGRESS_HALFWAY_ROWS);
  return Math.min(
    PROGRESS_STREAMING_END,
    Math.round(PROGRESS_STREAMING_START + span * ratio),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record an export request and queue it. Returns as soon as the row exists, so
 * the route can respond 202 immediately.
 */
export async function createExportJob(
  mapId: string,
  format: ExportFormat,
  requestedBy: string,
  options: ExportOptions = {},
  deps: ExportJobDeps = defaultExportDeps(),
): Promise<{ jobId: string }> {
  const job = await deps.createJob({ mapId, requestedBy, format });

  try {
    await deps.enqueue({
      exportJobId: job.id,
      mapId,
      format,
      requestedBy,
      parameters: options.parameters,
      calculatedFields: options.calculatedFields,
    });
  } catch (err) {
    // The row exists but nothing will ever pick it up (Redis down, say) —
    // better to fail it now than leave the client polling PENDING forever.
    await safeUpdate(deps, job.id, {
      status: 'FAILED',
      errorMessage: `Could not queue export: ${errorMessage(err)}`,
      completedAt: new Date(),
    });
    throw err;
  }

  return { jobId: job.id };
}

/**
 * Perform an export end-to-end. Called by the worker, not by request handlers.
 *
 * Throws on failure so BullMQ's retry machinery sees it; marking the row FAILED
 * is the worker's job once attempts are exhausted, since an intermediate
 * failure is not terminal.
 */
export async function processExportJob(
  data: ExportJobData,
  deps: ExportJobDeps = defaultExportDeps(),
): Promise<{ rowCount: number; filePath: string }> {
  const { exportJobId, mapId, format, requestedBy } = data;

  await safeUpdate(deps, exportJobId, {
    status: 'PROCESSING',
    progress: 5,
    // Clear any error left by a previous attempt.
    errorMessage: null,
  });

  // No row limit: an export is precisely the case the interactive caps exist
  // to avoid, and the writers stream rather than buffer.
  const prepared = await deps.prepareQuery(mapId, data.parameters ?? {}, requestedBy);

  const conn: Connection = await deps.getConnection(prepared.dataSourceId);
  let stream: RowStream | undefined;

  try {
    // The per-statement timeout bounds how long Oracle may take to *start*
    // returning rows. It deliberately does not bound the whole export: a
    // legitimate multi-million-row fetch takes far longer than an interactive
    // query is ever allowed to.
    conn.callTimeout = DEFAULT_TIMEOUT_MS;

    stream = await openRowStream(conn, prepared);
    let columns: ResultColumn[] = buildColumns(prepared.columns, stream.metaData);

    // Validate formulas and derive the calculated columns once, before any row
    // is read — `evaluateCalculatedFields` parses up front, so an empty array
    // surfaces a bad formula without touching data.
    const calcFields = data.calculatedFields;
    if (calcFields?.length) {
      columns = applyCalculatedFields([], columns, calcFields).columns;
    }

    await safeUpdate(deps, exportJobId, { progress: PROGRESS_STREAMING_START });
    conn.callTimeout = 0;

    // Calculated fields are scalar-only (the evaluator rejects aggregates), so
    // applying them per batch is equivalent to applying them to the whole set —
    // which is what makes them compatible with streaming at all.
    const batches = calcFields?.length
      ? (async function* () {
          for await (const batch of stream.batches) {
            yield applyCalculatedFields(batch, columns, calcFields).rows;
          }
        })()
      : stream.batches;

    const source: ExportSource = { columns, batches };
    const filePath = buildExportFilePath(exportJobId, format);

    const result = await deps.writeExportFile(source, format, filePath, (rows) => {
      void safeUpdate(deps, exportJobId, { progress: streamingProgress(rows) });
    });

    await deps.updateJob(exportJobId, {
      status: 'COMPLETED',
      progress: 100,
      rowCount: result.rowCount,
      filePath,
      errorMessage: null,
      completedAt: new Date(),
    });

    return { rowCount: result.rowCount, filePath };
  } finally {
    // Close the cursor before handing the connection back: a writer that threw
    // mid-stream may have abandoned the iterator, and releasing a connection
    // with an open cursor leaks it (eventually ORA-01000). `close` is
    // idempotent, so doing this after a clean run is harmless.
    await stream?.close();
    try {
      await deps.releaseConnection(prepared.dataSourceId, conn);
    } catch {
      // A connection we cannot return is the pool's problem to reap, not a
      // reason to fail an otherwise-successful export.
    }
  }
}

/** Mark a job failed. Called by the worker once BullMQ exhausts its attempts. */
export async function failExportJob(
  jobId: string,
  message: string,
  deps: ExportJobDeps = defaultExportDeps(),
): Promise<void> {
  await safeUpdate(deps, jobId, {
    status: 'FAILED',
    errorMessage: message,
    completedAt: new Date(),
  });
}

/** Fetch a job's current state. */
export async function getExportJob(
  jobId: string,
  deps: ExportJobDeps = defaultExportDeps(),
): Promise<ExportJobRecord | null> {
  return deps.getJob(jobId);
}

/** A user's most recent export jobs, newest first. */
export async function listExportJobs(
  userId: string,
  limit = 50,
  deps: ExportJobDeps = defaultExportDeps(),
): Promise<ExportJobRecord[]> {
  return deps.listJobs(userId, limit);
}

export interface ExportDownload {
  stream: NodeJS.ReadableStream;
  filename: string;
  contentType: string;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv; charset=utf-8',
};

export class ExportNotReadyError extends Error {
  constructor(public status: ExportJobStatus) {
    super(`Export is not ready (status: ${status})`);
    this.name = 'ExportNotReadyError';
  }
}

export class ExportFileMissingError extends Error {
  constructor() {
    super('Export file no longer exists');
    this.name = 'ExportFileMissingError';
  }
}

/**
 * Open a completed export for download. Authorization is the caller's
 * responsibility — this only enforces that the file is actually there.
 */
export function downloadExport(job: ExportJobRecord): ExportDownload {
  if (job.status !== 'COMPLETED' || !job.filePath) {
    throw new ExportNotReadyError(job.status);
  }
  if (!exportFileExists(job.filePath)) {
    throw new ExportFileMissingError();
  }
  return {
    stream: fs.createReadStream(job.filePath),
    filename: `map-${job.mapId}-export.${extensionFor(job.format)}`,
    contentType: CONTENT_TYPES[job.format],
  };
}

/** True when the file backing a completed job still exists on disk. */
export function exportFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export interface CleanupDeps {
  /** Jobs older than the cutoff that still claim a file on disk. */
  listExpired(cutoff: Date): Promise<Array<{ id: string; filePath: string }>>;
  removeFile(filePath: string): Promise<void>;
  clearFilePath(id: string): Promise<void>;
}

export function defaultCleanupDeps(): CleanupDeps {
  return {
    listExpired: async (cutoff) => {
      const rows = await db
        .select({ id: exportJobs.id, filePath: exportJobs.filePath })
        .from(exportJobs)
        .where(and(lt(exportJobs.createdAt, cutoff), isNotNull(exportJobs.filePath)));
      return rows.map((r) => ({ id: r.id, filePath: r.filePath! }));
    },
    removeFile: async (filePath) => {
      await fsp.rm(filePath, { force: true });
    },
    clearFilePath: async (id) => {
      await db.update(exportJobs).set({ filePath: null }).where(eq(exportJobs.id, id));
    },
  };
}

/**
 * Delete export files past the retention window and forget their paths.
 *
 * The job rows are kept as history — only the (potentially very large) files
 * are reclaimed. A row whose `filePath` is nulled reads as an expired export
 * rather than one that has gone mysteriously missing.
 */
export async function cleanupOldExports(
  retentionDays: number = config.EXPORT_RETENTION_DAYS,
  now: Date = new Date(),
  deps: CleanupDeps = defaultCleanupDeps(),
): Promise<{ deleted: number; errors: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const stale = await deps.listExpired(cutoff);

  let deleted = 0;
  let errors = 0;

  for (const row of stale) {
    try {
      await deps.removeFile(row.filePath);
      await deps.clearFilePath(row.id);
      deleted += 1;
    } catch {
      // Leave the row's filePath intact so the next sweep retries it. One
      // unlink failure must not abandon the rest of the sweep.
      errors += 1;
    }
  }

  return { deleted, errors };
}
