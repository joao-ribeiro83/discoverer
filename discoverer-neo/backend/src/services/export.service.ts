import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { and, desc, eq, lt, isNotNull } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { exportJobs, maps, mapPageSetup } from '../db/schema.js';
import { exportQueue, type ExportJobData } from '../queues/export.queue.js';
import { errorMessage, type ResultColumn, type ResultTotalsGroup } from './map-execution.service.js';
import { getRun, readBatches } from './map-run.store.js';
import { writeXlsx } from './exporters/excel-exporter.js';
import { writeCsv } from './exporters/csv-exporter.js';
import { writePdf, type PdfExportRequest } from './exporters/pdf-exporter.js';
import type { ExportHeading, ExportSource, ExportWriteResult } from './exporters/types.js';
import { resolveHeading } from './map.service.js';
import {
  createWorksheetRowBuilder,
  formatTotalsRowRecord,
  interpolateTotalLabel,
  applySuppression,
  type DisplayRow,
} from './exporters/worksheet-rows.js';
import { totalLabelsFor, type ExportLocale } from './exporters/total-labels.js';
import { cellText } from './exporters/types.js';

// ---------------------------------------------------------------------------
// Exports are durable, queued work.
//
// The job row in `export_jobs` is the record of truth a client polls; BullMQ
// owns scheduling, retries and concurrency. The two are deliberately split:
// Redis holds only recent job history, while the table outlives it so an
// export can still be found (and re-downloaded) days later.
// ---------------------------------------------------------------------------

export type ExportFormat = 'XLSX' | 'CSV' | 'PDF';
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
  /** Locale for a grand/subtotal row's label text. Defaults to `en`. */
  locale?: ExportLocale;
  /** PDF only: page size, orientation and the columns to print. */
  pdf?: PdfExportRequest;
}

export interface ExportJobRecord {
  id: string;
  mapId: string;
  /** Set by the list query only (a join on maps); null once the map is deleted. */
  mapName?: string | null;
  requestedBy: string;
  format: ExportFormat;
  status: ExportJobStatus;
  progress: number;
  rowCount: number | null;
  /**
   * True when the source run was itself capped (`map_runs.truncated`) —
   * the file is a complete write of every row the run stored, but the run
   * may not hold every row the map would otherwise return. Surfaced rather
   * than silently dropped now that export has no independent, uncapped
   * query of its own (Task 4.3 moved rows off Oracle and onto the run).
   */
  truncated: boolean;
  filePath: string | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export type ExportJobPatch = Partial<
  Pick<
    ExportJobRecord,
    'status' | 'progress' | 'rowCount' | 'truncated' | 'filePath' | 'errorMessage' | 'completedAt'
  >
>;

// ---------------------------------------------------------------------------
// Injectable dependencies (real implementations by default; mocked in tests)
// ---------------------------------------------------------------------------

export interface ExportJobDeps {
  createJob(input: {
    mapId: string;
    requestedBy: string;
    format: ExportFormat;
  }): Promise<ExportJobRecord>;
  updateJob(id: string, patch: ExportJobPatch): Promise<void>;
  getJob(id: string): Promise<ExportJobRecord | null>;
  listJobs(userId: string, limit: number): Promise<ExportJobRecord[]>;
  /**
   * Hands the streaming source to the format's writer. `mapId` and `locale`
   * are only used by PDF — to look up `map_page_setup`/the map's own name,
   * and to format the `&D` header/footer placeholder — XLSX/CSV ignore both.
   */
  writeExportFile(
    source: ExportSource,
    format: ExportFormat,
    filePath: string,
    mapId: string,
    onRows?: (rows: number) => void,
    locale?: ExportLocale,
    heading?: ExportHeading,
    pdf?: PdfExportRequest,
  ): Promise<ExportWriteResult>;
  /**
   * The map's heading text with the run's parameter values substituted, for
   * the file's document header. Optional so a test's minimal deps object
   * still works; production always supplies it.
   */
  resolveHeading?(mapId: string, parameters: Record<string, unknown>): Promise<ExportHeading>;
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
    truncated: row.truncated,
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
    .select({ job: exportJobs, mapName: maps.name })
    .from(exportJobs)
    .leftJoin(maps, eq(maps.id, exportJobs.mapId))
    .where(eq(exportJobs.requestedBy, userId))
    .orderBy(desc(exportJobs.createdAt))
    .limit(limit);
  return rows.map(({ job, mapName }) => ({ ...rowToRecord(job), mapName }));
}

async function defaultWriteExportFile(
  source: ExportSource,
  format: ExportFormat,
  filePath: string,
  mapId: string,
  onRows?: (rows: number) => void,
  locale?: ExportLocale,
  heading?: ExportHeading,
  pdf?: PdfExportRequest,
): Promise<ExportWriteResult> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  switch (format) {
    case 'XLSX':
      return writeXlsx(filePath, source, { onRows, heading });
    case 'CSV':
      return writeCsv(filePath, source, { onRows, heading });
    case 'PDF': {
      const [map] = await db.select({ name: maps.name }).from(maps).where(eq(maps.id, mapId)).limit(1);
      const [setup] = await db
        .select()
        .from(mapPageSetup)
        .where(eq(mapPageSetup.mapId, mapId))
        .limit(1);
      return writePdf(filePath, source, {
        onRows,
        pageSetup: setup ?? null,
        title: map?.name ?? 'Export',
        locale,
        heading,
        request: pdf ?? null,
      });
    }
  }
}

async function defaultEnqueue(data: ExportJobData): Promise<void> {
  await exportQueue().add('export', data, { jobId: data.exportJobId });
}

export function defaultExportDeps(): ExportJobDeps {
  return {
    createJob: defaultCreateJob,
    updateJob: defaultUpdateJob,
    getJob: defaultGetJob,
    listJobs: defaultListJobs,
    writeExportFile: defaultWriteExportFile,
    resolveHeading: (mapId, parameters) => resolveHeading(mapId, parameters),
    enqueue: defaultEnqueue,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionFor(format: ExportFormat): string {
  switch (format) {
    case 'XLSX':
      return 'xlsx';
    case 'PDF':
      return 'pdf';
    case 'CSV':
      return 'csv';
  }
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
  runId: string,
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
      runId,
      locale: options.locale,
      pdf: options.pdf,
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
  const { exportJobId, mapId, format } = data;

  await safeUpdate(deps, exportJobId, {
    status: 'PROCESSING',
    progress: 5,
    // Clear any error left by a previous attempt.
    errorMessage: null,
  });

  // The run already did the Oracle work (and the RLS-bearing query that goes
  // with it) when it was created — an export just reads what it stored. A run
  // gone by the time the worker gets here (deleted, expired and swept) is a
  // terminal fault: nothing to read, no way to make one. The route checks
  // COMPLETED-and-unexpired at enqueue time, but that is a point-in-time
  // check — a retry, or a job that sits in the queue a while, can run well
  // after it, so the worker re-checks rather than trusting it: an expired or
  // still-running run must never produce a "successful", silently truncated
  // file.
  const run = await getRun(data.runId);
  if (!run || run.status !== 'COMPLETED' || run.expiresAt.getTime() <= Date.now()) {
    throw new Error('Run not found or no longer available');
  }

  await safeUpdate(deps, exportJobId, { progress: PROGRESS_STREAMING_START });

  const columns = (run.columns ?? []) as ResultColumn[];
  const decoration = (run.decoration ?? {}) as {
    groupBreakAliases?: string[];
    totals?: ResultTotalsGroup[];
  };
  const groupBreakAliases = decoration.groupBreakAliases ?? [];
  const totalsGroups = decoration.totals ?? [];
  const rawBatches = readBatches(data.runId);

  // A run with group breaks or totals gets its rows interleaved with
  // subtotal/grand-total rows the same way ResultsTable draws them on screen
  // (same placement rules — see exporters/worksheet-rows.ts), pushed one row
  // at a time so the export never holds the result set in memory. The totals
  // themselves were computed once, against Oracle, when the run was created
  // (map-run.runner.ts) and stored on `run.decoration` — export only
  // rebuilds their placement, it never re-queries.
  const labels = totalLabelsFor(data.locale);
  const toRecord = (display: DisplayRow): Record<string, unknown> => {
    if (display.kind === 'data') return applySuppression(display.row, display.suppressed);
    if (display.kind === 'grand') {
      return formatTotalsRowRecord(columns, display.entries, labels.grandTotal);
    }
    const value = cellText(display.breakValue);
    const label = interpolateTotalLabel(
      display.entries[0]?.total.label,
      { value, item: display.breakLabel },
      labels.subtotalFor(value),
    );
    return formatTotalsRowRecord(columns, display.entries, label);
  };

  const batches =
    groupBreakAliases.length > 0 || totalsGroups.length > 0
      ? (async function* () {
          const builder = createWorksheetRowBuilder(groupBreakAliases, totalsGroups);
          for await (const batch of rawBatches) {
            const out: Record<string, unknown>[] = [];
            for (const row of batch) {
              for (const display of builder.pushRow(row)) out.push(toRecord(display));
            }
            if (out.length > 0) yield out;
          }
          const trailing = builder.finish().map(toRecord);
          if (trailing.length > 0) yield trailing;
        })()
      : rawBatches;

  const source: ExportSource = { columns, batches };
  const filePath = buildExportFilePath(exportJobId, format);
  const heading = deps.resolveHeading
    ? await deps.resolveHeading(mapId, (run.parameters ?? {}) as Record<string, unknown>)
    : undefined;

  // Progress writes are chained and awaited before COMPLETED, so a late one
  // can never overwrite progress 100.
  let progressWrite: Promise<unknown> = Promise.resolve();
  const result = await deps.writeExportFile(
    source,
    format,
    filePath,
    mapId,
    (rows) => {
      progressWrite = progressWrite.then(() =>
        safeUpdate(deps, exportJobId, { progress: streamingProgress(rows) }),
      );
    },
    data.locale,
    heading,
    data.pdf,
  );
  await progressWrite;

  await deps.updateJob(exportJobId, {
    status: 'COMPLETED',
    progress: 100,
    rowCount: result.rowCount,
    truncated: run.truncated,
    filePath,
    errorMessage: null,
    completedAt: new Date(),
  });

  return { rowCount: result.rowCount, filePath };
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
  PDF: 'application/pdf',
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
