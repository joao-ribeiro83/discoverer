import path from 'node:path';
import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Connection } from 'oracledb';
import cronParserPkg from 'cron-parser';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { schedules, scheduleParameters, scheduledResults } from '../db/schema.js';
import {
  defaultDeps,
  openRowStream,
  buildColumns,
  errorMessage,
  DEFAULT_TIMEOUT_MS,
  type MapExecutionDeps,
  type ResultColumn,
} from './map-execution.service.js';
import { writeXlsx } from './exporters/excel-exporter.js';
import { writeCsv } from './exporters/csv-exporter.js';
import type { ExportSource, ExportWriteResult } from './exporters/types.js';
import {
  upsertScheduleJob,
  removeScheduleJob,
  enqueueManualTrigger,
} from '../queues/scheduler.queue.js';

// cron-parser's CJS build has no statically-detectable named exports, so
// Node's ESM interop only exposes `default` (the same shape node-oracledb
// hits — see the oracle-driver.ts gotcha noted in session 4.1's history).
const { parseExpression } = cronParserPkg;

// ---------------------------------------------------------------------------
// Cron-driven schedules.
//
// BullMQ's Job Scheduler API (`upsertJobScheduler`) owns *when* a schedule
// fires — it already understands cron patterns, timezones, and a validity
// window (startDate/endDate map directly onto validFrom/validUntil), so this
// module does not reimplement a polling loop. `cron-parser` (a BullMQ
// dependency already, so no new transitive surface) is used here only for the
// read-only concerns BullMQ's queue API can't answer without a live Redis:
// validating an expression before it's saved, and previewing the next run
// time for the UI.
// ---------------------------------------------------------------------------

export type ScheduleOutputFormat = 'XLSX' | 'CSV';
export type ScheduleRunStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface ScheduleParameterValue {
  paramName: string;
  paramValue: string | null;
}

export interface ScheduleRecord {
  id: string;
  mapId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  validFrom: Date | null;
  validUntil: Date | null;
  outputFormat: ScheduleOutputFormat;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  parameters: ScheduleParameterValue[];
}

export interface CreateScheduleInput {
  mapId: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
  outputFormat: ScheduleOutputFormat;
  isActive?: boolean;
  parameters?: ScheduleParameterValue[];
}

export type UpdateScheduleInput = Partial<Omit<CreateScheduleInput, 'mapId'>>;

export interface ScheduledResultRecord {
  id: string;
  scheduleId: string;
  executedAt: Date;
  rowCount: number | null;
  filePath: string | null;
  executionTimeMs: number | null;
  status: ScheduleRunStatus;
  errorMessage: string | null;
}

export class ScheduleValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ScheduleValidationError';
  }
}

/** Thrown by `processScheduleRun` on a genuine execution fault, carrying
 * enough context for the worker to record it once BullMQ's retries are
 * exhausted (see `recordScheduleFailure`). */
export class ScheduleRunError extends Error {
  constructor(
    message: string,
    public elapsedMs: number,
    public kind: 'TIMEOUT' | 'FAILED',
    public override cause?: unknown,
  ) {
    super(message);
    this.name = 'ScheduleRunError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CronValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate a cron expression, independent of any schedule row or Redis. */
export function validateCronExpression(expression: string): CronValidationResult {
  try {
    parseExpression(expression);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: errorMessage(err) };
  }
}

/** Validate an IANA timezone name via the platform's own zone database. */
export function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the next fire time for a cron expression/timezone, honouring an
 * optional validity window. Returns null once the expression has no further
 * occurrence in the window (or is invalid) — a "no more runs" answer, not an
 * error, since a UI showing "next run" should just render nothing then.
 */
export function computeNextRunTime(
  cronExpression: string,
  timezone: string,
  opts: { validFrom?: Date | null; validUntil?: Date | null; currentDate?: Date } = {},
): Date | null {
  try {
    const interval = parseExpression(cronExpression, {
      tz: timezone,
      currentDate: opts.currentDate ?? new Date(),
      ...(opts.validFrom ? { startDate: opts.validFrom } : {}),
      ...(opts.validUntil ? { endDate: opts.validUntil } : {}),
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

function validateScheduleInput(input: {
  cronExpression: string;
  timezone: string;
  validFrom?: Date | null;
  validUntil?: Date | null;
}): void {
  const cron = validateCronExpression(input.cronExpression);
  if (!cron.valid) {
    throw new ScheduleValidationError(`Invalid cron expression: ${cron.error}`);
  }
  if (!validateTimezone(input.timezone)) {
    throw new ScheduleValidationError(`Unknown timezone: "${input.timezone}"`);
  }
  if (
    input.validFrom &&
    input.validUntil &&
    input.validFrom.getTime() >= input.validUntil.getTime()
  ) {
    throw new ScheduleValidationError('validFrom must be before validUntil');
  }
}

// ---------------------------------------------------------------------------
// Injectable dependencies (real implementations by default; mocked in tests)
// ---------------------------------------------------------------------------

export interface SchedulerDeps {
  insertSchedule(
    input: CreateScheduleInput & { createdBy: string },
  ): Promise<ScheduleRecord>;
  updateScheduleRow(
    id: string,
    patch: UpdateScheduleInput,
  ): Promise<ScheduleRecord | null>;
  getScheduleRow(id: string): Promise<ScheduleRecord | null>;
  listByMap(mapId: string): Promise<ScheduleRecord[]>;
  listByUser(userId: string): Promise<ScheduleRecord[]>;
  deleteScheduleRow(id: string): Promise<boolean>;

  insertResult(
    input: Omit<ScheduledResultRecord, 'id' | 'executedAt'> & {
      id: string;
      executedAt: Date;
    },
  ): Promise<ScheduledResultRecord>;
  listResults(scheduleId: string, limit: number): Promise<ScheduledResultRecord[]>;
  getResult(scheduleId: string, resultId: string): Promise<ScheduledResultRecord | null>;

  upsertJob(
    scheduleId: string,
    cronExpression: string,
    timezone: string,
    validFrom: Date | null,
    validUntil: Date | null,
  ): Promise<void>;
  removeJob(scheduleId: string): Promise<void>;
  enqueueManual(scheduleId: string, triggeredBy: string): Promise<void>;

  prepareQuery: MapExecutionDeps['prepareQuery'];
  getConnection: MapExecutionDeps['getConnection'];
  releaseConnection: MapExecutionDeps['releaseConnection'];
  writeResultFile(
    source: ExportSource,
    format: ScheduleOutputFormat,
    filePath: string,
  ): Promise<ExportWriteResult>;
  /**
   * Best-effort notification hook. No SMTP/mail provider exists in this repo
   * yet, so the default just no-ops — this is the seam a later session wires
   * up to a real transport, without any caller needing to change.
   */
  notify(schedule: ScheduleRecord, outcome: ScheduleRunNotification): Promise<void>;
}

export interface ScheduleRunNotification {
  status: ScheduleRunStatus;
  rowCount: number | null;
  filePath: string | null;
  errorMessage: string | null;
}

function rowToRecord(
  row: typeof schedules.$inferSelect,
  parameters: ScheduleParameterValue[],
): ScheduleRecord {
  return {
    id: row.id,
    mapId: row.mapId,
    name: row.name,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    outputFormat: row.outputFormat,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parameters,
  };
}

function resultRowToRecord(
  row: typeof scheduledResults.$inferSelect,
): ScheduledResultRecord {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    executedAt: row.executedAt,
    rowCount: row.rowCount,
    filePath: row.filePath,
    executionTimeMs: row.executionTimeMs,
    status: row.status,
    errorMessage: row.errorMessage,
  };
}

async function fetchParameters(scheduleId: string): Promise<ScheduleParameterValue[]> {
  const rows = await db
    .select()
    .from(scheduleParameters)
    .where(eq(scheduleParameters.scheduleId, scheduleId));
  return rows.map((r) => ({ paramName: r.paramName, paramValue: r.paramValue }));
}

async function defaultInsertSchedule(
  input: CreateScheduleInput & { createdBy: string },
): Promise<ScheduleRecord> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schedules)
      .values({
        mapId: input.mapId,
        name: input.name,
        cronExpression: input.cronExpression,
        timezone: input.timezone ?? 'UTC',
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        outputFormat: input.outputFormat,
        isActive: input.isActive ?? true,
        createdBy: input.createdBy,
      })
      .returning();

    const params = input.parameters ?? [];
    if (params.length > 0) {
      await tx.insert(scheduleParameters).values(
        params.map((p) => ({
          scheduleId: row!.id,
          paramName: p.paramName,
          paramValue: p.paramValue,
        })),
      );
    }

    return rowToRecord(row!, params);
  });
}

async function defaultUpdateScheduleRow(
  id: string,
  patch: UpdateScheduleInput,
): Promise<ScheduleRecord | null> {
  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.cronExpression !== undefined) values.cronExpression = patch.cronExpression;
    if (patch.timezone !== undefined) values.timezone = patch.timezone;
    if (patch.validFrom !== undefined) values.validFrom = patch.validFrom;
    if (patch.validUntil !== undefined) values.validUntil = patch.validUntil;
    if (patch.outputFormat !== undefined) values.outputFormat = patch.outputFormat;
    if (patch.isActive !== undefined) values.isActive = patch.isActive;

    const [row] = await tx
      .update(schedules)
      .set(values)
      .where(eq(schedules.id, id))
      .returning();
    if (!row) return null;

    if (patch.parameters !== undefined) {
      await tx.delete(scheduleParameters).where(eq(scheduleParameters.scheduleId, id));
      if (patch.parameters.length > 0) {
        await tx.insert(scheduleParameters).values(
          patch.parameters.map((p) => ({
            scheduleId: id,
            paramName: p.paramName,
            paramValue: p.paramValue,
          })),
        );
      }
    }

    const parameters =
      patch.parameters ?? (await tx
        .select()
        .from(scheduleParameters)
        .where(eq(scheduleParameters.scheduleId, id))
      ).map((r) => ({ paramName: r.paramName, paramValue: r.paramValue }));

    return rowToRecord(row, parameters);
  });
}

async function defaultGetScheduleRow(id: string): Promise<ScheduleRecord | null> {
  const [row] = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
  if (!row) return null;
  return rowToRecord(row, await fetchParameters(id));
}

async function defaultListByMap(mapId: string): Promise<ScheduleRecord[]> {
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.mapId, mapId))
    .orderBy(desc(schedules.createdAt));
  return Promise.all(rows.map(async (r) => rowToRecord(r, await fetchParameters(r.id))));
}

async function defaultListByUser(userId: string): Promise<ScheduleRecord[]> {
  const rows = await db
    .select()
    .from(schedules)
    .where(eq(schedules.createdBy, userId))
    .orderBy(desc(schedules.createdAt));
  return Promise.all(rows.map(async (r) => rowToRecord(r, await fetchParameters(r.id))));
}

async function defaultDeleteScheduleRow(id: string): Promise<boolean> {
  const rows = await db.delete(schedules).where(eq(schedules.id, id)).returning();
  return rows.length > 0;
}

async function defaultInsertResult(
  input: Omit<ScheduledResultRecord, 'id' | 'executedAt'> & { id: string; executedAt: Date },
): Promise<ScheduledResultRecord> {
  const [row] = await db
    .insert(scheduledResults)
    .values({
      id: input.id,
      scheduleId: input.scheduleId,
      executedAt: input.executedAt,
      rowCount: input.rowCount,
      filePath: input.filePath,
      executionTimeMs: input.executionTimeMs,
      status: input.status,
      errorMessage: input.errorMessage,
    })
    .returning();
  return resultRowToRecord(row!);
}

async function defaultListResults(
  scheduleId: string,
  limit: number,
): Promise<ScheduledResultRecord[]> {
  const rows = await db
    .select()
    .from(scheduledResults)
    .where(eq(scheduledResults.scheduleId, scheduleId))
    .orderBy(desc(scheduledResults.executedAt))
    .limit(limit);
  return rows.map(resultRowToRecord);
}

async function defaultGetResult(
  scheduleId: string,
  resultId: string,
): Promise<ScheduledResultRecord | null> {
  const [row] = await db
    .select()
    .from(scheduledResults)
    .where(and(eq(scheduledResults.id, resultId), eq(scheduledResults.scheduleId, scheduleId)))
    .limit(1);
  return row ? resultRowToRecord(row) : null;
}

async function defaultWriteResultFile(
  source: ExportSource,
  format: ScheduleOutputFormat,
  filePath: string,
): Promise<ExportWriteResult> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  return format === 'XLSX' ? writeXlsx(filePath, source) : writeCsv(filePath, source);
}

export function defaultSchedulerDeps(): SchedulerDeps {
  const mapDeps = defaultDeps();
  return {
    insertSchedule: defaultInsertSchedule,
    updateScheduleRow: defaultUpdateScheduleRow,
    getScheduleRow: defaultGetScheduleRow,
    listByMap: defaultListByMap,
    listByUser: defaultListByUser,
    deleteScheduleRow: defaultDeleteScheduleRow,
    insertResult: defaultInsertResult,
    listResults: defaultListResults,
    getResult: defaultGetResult,
    upsertJob: upsertScheduleJob,
    removeJob: removeScheduleJob,
    enqueueManual: enqueueManualTrigger,
    prepareQuery: (...args) => mapDeps.prepareQuery(...args),
    getConnection: (dataSourceId) => mapDeps.getConnection(dataSourceId),
    releaseConnection: (dataSourceId, conn) => mapDeps.releaseConnection(dataSourceId, conn),
    writeResultFile: defaultWriteResultFile,
    notify: () => Promise.resolve(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionFor(format: ScheduleOutputFormat): string {
  return format === 'XLSX' ? 'xlsx' : 'csv';
}

export const SCHEDULE_RESULT_DIR =
  config.SCHEDULE_RESULT_DIR ??
  path.resolve(process.cwd(), 'storage', 'scheduled-results');

export function buildScheduleResultFilePath(
  resultId: string,
  format: ScheduleOutputFormat,
): string {
  return path.join(SCHEDULE_RESULT_DIR, `${resultId}.${extensionFor(format)}`);
}

/** Reconcile the BullMQ recurring job with a schedule's current row state. */
async function syncScheduleJob(deps: SchedulerDeps, schedule: ScheduleRecord): Promise<void> {
  if (schedule.isActive) {
    await deps.upsertJob(
      schedule.id,
      schedule.cronExpression,
      schedule.timezone,
      schedule.validFrom,
      schedule.validUntil,
    );
  } else {
    await deps.removeJob(schedule.id);
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createSchedule(
  input: CreateScheduleInput,
  createdBy: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord> {
  validateScheduleInput({
    cronExpression: input.cronExpression,
    timezone: input.timezone ?? 'UTC',
    validFrom: input.validFrom,
    validUntil: input.validUntil,
  });

  const schedule = await deps.insertSchedule({ ...input, createdBy });

  try {
    await syncScheduleJob(deps, schedule);
  } catch (err) {
    // A schedule row with no recurring job behind it would silently never
    // run — better to fail the request than leave that orphan behind.
    await deps.deleteScheduleRow(schedule.id).catch(() => {});
    throw err;
  }

  return schedule;
}

export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord | null> {
  const existing = await deps.getScheduleRow(id);
  if (!existing) return null;

  validateScheduleInput({
    cronExpression: input.cronExpression ?? existing.cronExpression,
    timezone: input.timezone ?? existing.timezone,
    validFrom: input.validFrom !== undefined ? input.validFrom : existing.validFrom,
    validUntil: input.validUntil !== undefined ? input.validUntil : existing.validUntil,
  });

  const updated = await deps.updateScheduleRow(id, input);
  if (!updated) return null;

  // Re-derived from the full row rather than diffed field-by-field: whatever
  // changed (cron, tz, window, or just isActive), the queue must end up
  // matching the row exactly, and upsert/remove are both idempotent.
  await syncScheduleJob(deps, updated);

  return updated;
}

export async function getSchedule(
  id: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord | null> {
  return deps.getScheduleRow(id);
}

export async function listSchedulesForMap(
  mapId: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord[]> {
  return deps.listByMap(mapId);
}

export async function listSchedulesForUser(
  userId: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord[]> {
  return deps.listByUser(userId);
}

export async function deleteSchedule(
  id: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<boolean> {
  // Unregister the recurring job before the row disappears — if this throws,
  // the row (and thus the schedule) still exists and the caller can retry.
  await deps.removeJob(id);
  return deps.deleteScheduleRow(id);
}

export async function toggleSchedule(
  id: string,
  isActive: boolean,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRecord | null> {
  const updated = await deps.updateScheduleRow(id, { isActive });
  if (!updated) return null;
  await syncScheduleJob(deps, updated);
  return updated;
}

/** Queue an immediate one-off run, bypassing the cron cadence. */
export async function triggerNow(
  id: string,
  triggeredBy: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<{ queued: boolean }> {
  const schedule = await deps.getScheduleRow(id);
  if (!schedule) {
    throw new ScheduleValidationError('Schedule not found');
  }
  if (!schedule.isActive) {
    throw new ScheduleValidationError('Cannot trigger a disabled schedule');
  }

  await deps.enqueueManual(id, triggeredBy);
  return { queued: true };
}

/** Preview when a schedule (or a not-yet-saved cron/tz/window combination) next fires. */
export async function getNextRunTime(
  id: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<Date | null> {
  const schedule = await deps.getScheduleRow(id);
  if (!schedule || !schedule.isActive) return null;
  return computeNextRunTime(schedule.cronExpression, schedule.timezone, {
    validFrom: schedule.validFrom,
    validUntil: schedule.validUntil,
  });
}

export async function getExecutionHistory(
  scheduleId: string,
  limit = 20,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduledResultRecord[]> {
  const capped = Math.min(Math.max(Math.floor(limit) || 20, 1), 200);
  return deps.listResults(scheduleId, capped);
}

export async function getScheduledResult(
  scheduleId: string,
  resultId: string,
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduledResultRecord | null> {
  return deps.getResult(scheduleId, resultId);
}

// ---------------------------------------------------------------------------
// Execution (called by the worker)
// ---------------------------------------------------------------------------

export type ScheduleRunOutcome =
  | { skipped: true; reason: string }
  | {
      skipped: false;
      resultId: string;
      rowCount: number;
      filePath: string;
      executionTimeMs: number;
    };

function isWithinWindow(schedule: ScheduleRecord, now: Date): boolean {
  if (schedule.validFrom && now < schedule.validFrom) return false;
  if (schedule.validUntil && now > schedule.validUntil) return false;
  return true;
}

/**
 * Run one firing of a schedule end-to-end: resolve the map + preset
 * parameters, execute, write the result file, and log the outcome.
 *
 * Throws `ScheduleRunError` on a genuine execution fault so BullMQ's retry
 * machinery sees it — the worker decides when attempts are exhausted and
 * calls `recordScheduleFailure` at that point (mirrors export.service.ts's
 * processExportJob/failExportJob split). A disabled schedule or one outside
 * its validity window is not a fault: it resolves with `{ skipped: true }`
 * and nothing is written to `scheduled_results`.
 */
export async function processScheduleRun(
  scheduleId: string,
  opts: { manual: boolean; triggeredBy?: string } = { manual: false },
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<ScheduleRunOutcome> {
  const schedule = await deps.getScheduleRow(scheduleId);
  if (!schedule) {
    return { skipped: true, reason: 'Schedule no longer exists' };
  }
  if (!schedule.isActive) {
    return { skipped: true, reason: 'Schedule is disabled' };
  }
  // The validity window gates the *cron* cadence (BullMQ's startDate/endDate
  // already enforce it, so this is defence in depth); a manual "run now" is a
  // deliberate user action and is allowed to bypass it.
  if (!opts.manual && !isWithinWindow(schedule, new Date())) {
    return { skipped: true, reason: 'Outside the schedule’s validity window' };
  }

  const parameterValues: Record<string, unknown> = {};
  for (const p of schedule.parameters) {
    if (p.paramValue != null) parameterValues[p.paramName] = p.paramValue;
  }

  const start = Date.now();
  const resultId = randomUUID();

  let prepared;
  try {
    prepared = await deps.prepareQuery(schedule.mapId, parameterValues, schedule.createdBy);
  } catch (err) {
    throw new ScheduleRunError(errorMessage(err), Date.now() - start, 'FAILED', err);
  }

  let conn: Connection;
  try {
    conn = await deps.getConnection(prepared.dataSourceId);
  } catch (err) {
    throw new ScheduleRunError(errorMessage(err), Date.now() - start, 'FAILED', err);
  }

  try {
    conn.callTimeout = DEFAULT_TIMEOUT_MS;
    const stream = await openRowStream(conn, prepared);
    const columns: ResultColumn[] = buildColumns(prepared.columns, stream.metaData);
    conn.callTimeout = 0;

    const filePath = buildScheduleResultFilePath(resultId, schedule.outputFormat);
    const result = await deps.writeResultFile(
      { columns, batches: stream.batches },
      schedule.outputFormat,
      filePath,
    );

    const executionTimeMs = Date.now() - start;
    await deps.insertResult({
      id: resultId,
      scheduleId,
      executedAt: new Date(),
      rowCount: result.rowCount,
      filePath,
      executionTimeMs,
      status: 'SUCCESS',
      errorMessage: null,
    });

    await deps
      .notify(schedule, {
        status: 'SUCCESS',
        rowCount: result.rowCount,
        filePath,
        errorMessage: null,
      })
      .catch(() => {
        // Notification failure must never mask a successful run.
      });

    return {
      skipped: false,
      resultId,
      rowCount: result.rowCount,
      filePath,
      executionTimeMs,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    const timedOut = /call\s*timeout|timed?\s*out|DPI-1067/i.test(errorMessage(err));
    throw new ScheduleRunError(errorMessage(err), elapsed, timedOut ? 'TIMEOUT' : 'FAILED', err);
  } finally {
    try {
      await deps.releaseConnection(prepared.dataSourceId, conn);
    } catch {
      // A connection we cannot return is the pool's problem to reap.
    }
  }
}

/** Record a run as failed once BullMQ has exhausted its retry attempts. */
export async function recordScheduleFailure(
  scheduleId: string,
  message: string,
  elapsedMs: number,
  kind: 'TIMEOUT' | 'FAILED' = 'FAILED',
  deps: SchedulerDeps = defaultSchedulerDeps(),
): Promise<void> {
  const schedule = await deps.getScheduleRow(scheduleId);
  const resultId = randomUUID();
  await deps.insertResult({
    id: resultId,
    scheduleId,
    executedAt: new Date(),
    rowCount: null,
    filePath: null,
    executionTimeMs: elapsedMs,
    status: kind,
    errorMessage: message,
  });

  if (schedule) {
    await deps
      .notify(schedule, { status: kind, rowCount: null, filePath: null, errorMessage: message })
      .catch(() => {});
  }
}
