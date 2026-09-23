/**
 * Map run processor body (Task 2.4). The BullMQ worker (workers/map-run.worker.ts)
 * only calls `processMapRun`; everything here is testable without Redis.
 *
 * Claim the run (per-user FIFO, see map-run.store.ts `claimRun`), stream its
 * Oracle rows into `map_run_batches`, then stamp the result and its expiry.
 * A failure is recorded on the run row, never thrown to BullMQ: the job has a
 * single attempt, and the row is what the user polls.
 */
import { eq } from 'drizzle-orm';
import type { Connection } from 'oracledb';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { schedules, scheduledResults } from '../db/schema.js';
import { liveExpiry, scheduledExpiry } from '../lib/map-run-key.js';
import { SqlGenerationError, type RefusalCode } from '../types/sql.js';
import { resolveHeading } from './map.service.js';
import type { CalcFieldInput } from './calculated-field-evaluator.js';
import {
  applyCalculatedFields,
  buildColumns,
  defaultDeps as defaultExecutionDeps,
  DEFAULT_TIMEOUT_MS,
  isTimeoutError,
  openRowStream,
  runTotalsQueries,
  safeRecord,
  wrapExecutionError,
  type ExecutionErrorKind,
  type MapExecutionDeps,
  type PreparedQuery,
} from './map-execution.service.js';
import * as store from './map-run.store.js';
import type { MapRunRow } from './map-run.store.js';

/**
 * The run's failure, as recorded into `map_runs.decoration.error` (fix round
 * 1): a `REFUSED` kind always carries `refusal` — the same code/details the
 * old synchronous `/execute` route put in its HTTP response (D-036). Every
 * other kind is a genuine failure with no next step to explain.
 */
export interface RunErrorDecoration {
  kind: ExecutionErrorKind | 'REFUSED';
  refusal?: { code: RefusalCode; details?: unknown };
}

export type ClaimOutcome = 'ran' | 'busy' | 'gone';

export interface InsertScheduledResultInput {
  scheduleId: string;
  runId: string;
  executedAt: Date;
  rowCount: number | null;
  executionTimeMs: number | null;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  errorMessage: string | null;
  /** Always null — a scheduled run's rows live in `map_run_batches`, not a file. */
  filePath: null;
}

export interface RunnerDeps extends MapExecutionDeps {
  claimRun: typeof store.claimRun;
  getRun: typeof store.getRun;
  appendBatch: typeof store.appendBatch;
  completeRun: typeof store.completeRun;
  failRun: typeof store.failRun;
  openRowStream: typeof openRowStream;
  /** The worksheet heading (`&Date`, `&Time`, `&<ParamName>`) resolved with this run's own parameters — same source `/execute` reads it from. */
  resolveHeading: typeof resolveHeading;
  loadRetentionDays: (scheduleId: string) => Promise<number | null>;
  /** Task 4.2: the schedule-history row a SCHEDULED run leaves behind, once it completes or fails. */
  insertScheduledResult: (input: InsertScheduledResultInput) => Promise<void>;
  limits: { maxRows: number; batchSize: number; liveTtlHours: number; failRetryMs: number };
  now: () => Date;
}

function defaultRunnerDeps(): RunnerDeps {
  return {
    ...defaultExecutionDeps(),
    claimRun: store.claimRun,
    getRun: store.getRun,
    appendBatch: store.appendBatch,
    completeRun: store.completeRun,
    failRun: store.failRun,
    openRowStream,
    resolveHeading,
    loadRetentionDays: async (scheduleId) => {
      const [row] = await db
        .select({ days: schedules.resultRetentionDays })
        .from(schedules)
        .where(eq(schedules.id, scheduleId));
      return row?.days ?? null;
    },
    insertScheduledResult: async (input) => {
      await db.insert(scheduledResults).values(input);
    },
    limits: {
      maxRows: config.MAP_RUN_MAX_ROWS,
      batchSize: config.MAP_RUN_BATCH_SIZE,
      liveTtlHours: config.MAP_RUN_LIVE_TTL_HOURS,
      failRetryMs: 2_000,
    },
    now: () => new Date(),
  };
}

// Lifecycles: any failed run is kept 24 h as history.
const FAILED_TTL_MS = 24 * 60 * 60 * 1000;
// Lifecycles: SCHEDULED default when the schedule is gone.
const DEFAULT_RETENTION_DAYS = 30;

/**
 * The job has one attempt, so a lost failRun write would leave the row RUNNING
 * and block this user's FIFO until the stale sweep. Try a few times first.
 * ponytail: 3 tries over ~6 s; an outage longer than that still falls to the sweep.
 */
async function recordFailure(
  deps: RunnerDeps,
  runId: string,
  errorMessage: string,
  decoration?: RunErrorDecoration,
): Promise<void> {
  const r = {
    status: 'FAILED' as const,
    errorMessage,
    expiresAt: new Date(deps.now().getTime() + FAILED_TTL_MS),
    ...(decoration ? { decoration: { error: decoration } } : {}),
  };
  for (let attempt = 1; ; attempt++) {
    try {
      await deps.failRun(runId, r);
      return;
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((res) => setTimeout(res, deps.limits.failRetryMs * attempt));
    }
  }
}

/** Best effort: a lost schedule-history write must never re-mark an
 * already-recorded run outcome (completeRun/failRun already ran). */
async function safeInsertScheduledResult(
  deps: RunnerDeps,
  input: InsertScheduledResultInput,
): Promise<void> {
  try {
    await deps.insertScheduledResult(input);
  } catch (err) {
    // eslint-disable-next-line no-console -- no injected logger, same as map-execution.service.ts.
    console.error(`[map-run:${input.runId}] could not record schedule history`, err);
  }
}

export async function processMapRun(
  runId: string,
  deps: RunnerDeps = defaultRunnerDeps(),
): Promise<ClaimOutcome> {
  let claimed = false;
  let run: MapRunRow | null;
  try {
    claimed = await deps.claimRun(runId);
    run = await deps.getRun(runId);
  } catch (err) {
    // eslint-disable-next-line no-console -- no injected logger, same as map-execution.service.ts.
    console.error(`[map-run:${runId}] store error before start`, err);
    // Not claimed: the row is still QUEUED, so retry the job shortly rather
    // than let it die and leave a jobless QUEUED row blocking this user.
    if (!claimed) return 'busy';
    await recordFailure(deps, runId, 'The run could not be started.');
    return 'ran';
  }
  // Refused either because this user has an earlier run (wait and retry) or
  // because the run is no longer QUEUED — cancelled or deleted (drop the job).
  if (!claimed) return run?.status === 'QUEUED' ? 'busy' : 'gone';
  if (!run || run.status !== 'RUNNING') return 'gone';

  const { maxRows, batchSize, liveTtlHours } = deps.limits;
  const start = deps.now().getTime();
  let prepared: PreparedQuery | undefined;
  let conn: Connection | undefined;

  try {
    prepared = await deps.prepareQuery(
      run.mapId,
      run.parameters as Record<string, unknown>,
      run.requestedBy,
      maxRows + 1,
    );
    conn = await deps.getConnection(prepared.dataSourceId);
    conn.callTimeout = DEFAULT_TIMEOUT_MS;

    const calcs = run.calculatedFields as CalcFieldInput[];
    const stream = await deps.openRowStream(conn, prepared, batchSize);
    const baseColumns = buildColumns(prepared.columns, stream.metaData);
    const { columns } = applyCalculatedFields([], baseColumns, calcs);
    let seq = 0;
    let rowCount = 0;
    let truncated = false;
    try {
      for await (const batch of stream.batches) {
        let rows = batch;
        if (rowCount + rows.length > maxRows) {
          rows = rows.slice(0, maxRows - rowCount);
          truncated = true;
        }
        if (rows.length > 0) {
          await deps.appendBatch(runId, seq++, applyCalculatedFields(rows, baseColumns, calcs).rows);
          rowCount += rows.length;
        }
        if (truncated) break;
      }
    } finally {
      await stream.close();
    }

    // Totals run on the same connection, over the whole filtered set.
    const totalsRun = prepared.totals?.length
      ? await runTotalsQueries(conn, prepared.totals, runId)
      : { groups: [], warnings: [] };
    const warnings = [...(prepared.warnings ?? []), ...totalsRun.warnings];
    // The heading carries `&Date`, `&Time` and `&<ParamName>` tokens resolved
    // with this run's own parameters — same source the old synchronous
    // `/execute` read it from (fix round 1: the viewer lost it when it moved
    // to reading a stored run instead of that response).
    const heading = await deps.resolveHeading(
      run.mapId,
      run.parameters as Record<string, unknown>,
      deps.now(),
    );
    const decoration = {
      ...(prepared.groupBreakAliases?.length ? { groupBreakAliases: prepared.groupBreakAliases } : {}),
      ...(totalsRun.groups.length ? { totals: totalsRun.groups } : {}),
      ...(prepared.conditionalFormats?.length ? { conditionalFormats: prepared.conditionalFormats } : {}),
      ...(warnings.length ? { warnings } : {}),
      heading: { title: heading.title, description: heading.description },
    };

    const now = deps.now();
    const executionTimeMs = now.getTime() - start;
    const expiresAt =
      run.kind === 'LIVE'
        ? liveExpiry(now, liveTtlHours)
        : scheduledExpiry(
            now,
            (run.scheduleId ? await deps.loadRetentionDays(run.scheduleId) : null) ??
              DEFAULT_RETENTION_DAYS,
          );
    await deps.completeRun(runId, {
      columns,
      decoration,
      rowCount,
      truncated,
      executionTimeMs,
      sqlText: prepared.sql,
      expiresAt,
    });
    await safeRecord(deps, {
      mapId: run.mapId,
      executedBy: run.requestedBy,
      executionTimeMs,
      rowCount,
      sqlText: prepared.sql,
      planDecision: prepared.planDecision,
      errorMessage: null,
      status: 'SUCCESS',
    });
    if (run.scheduleId) {
      await safeInsertScheduledResult(deps, {
        scheduleId: run.scheduleId,
        runId,
        executedAt: now,
        rowCount,
        executionTimeMs,
        status: 'SUCCESS',
        errorMessage: null,
        filePath: null,
      });
    }
  } catch (err) {
    // A `SqlGenerationError` is either a deliberate refusal (D-036 — carries
    // a `code`) or a generation-time config problem, never a driver error —
    // its message is already curated to be safe, same as the old synchronous
    // `/execute` route (`handleExecutionError` in routes/map-execution.ts)
    // treated it. Anything else is the general driver-error path, unchanged.
    // SEC-07: wrapExecutionError logs the raw driver error (ORA- text) server
    // side and hands back only the kind's generic message for the row.
    let message: string;
    let errorKind: ExecutionErrorKind | 'REFUSED';
    let refusal: RunErrorDecoration['refusal'];
    if (err instanceof SqlGenerationError) {
      message = err.message;
      if (err.code) {
        errorKind = 'REFUSED';
        refusal = { code: err.code, details: err.details };
      } else {
        errorKind = 'CONFIG';
      }
    } else {
      const kind: ExecutionErrorKind = isTimeoutError(err)
        ? 'TIMEOUT'
        : prepared && !conn
          ? 'CONNECT'
          : 'QUERY';
      const wrapped = wrapExecutionError(err, kind, runId);
      message = wrapped.message;
      errorKind = wrapped.kind;
    }
    const now = deps.now();
    const executionTimeMs = now.getTime() - start;
    await recordFailure(deps, runId, message, { kind: errorKind, ...(refusal ? { refusal } : {}) });
    await safeRecord(deps, {
      mapId: run.mapId,
      executedBy: run.requestedBy,
      executionTimeMs,
      rowCount: null,
      sqlText: prepared?.sql ?? null,
      planDecision: prepared?.planDecision,
      errorMessage: message,
      status: errorKind === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
    });
    if (run.scheduleId) {
      await safeInsertScheduledResult(deps, {
        scheduleId: run.scheduleId,
        runId,
        executedAt: now,
        rowCount: null,
        executionTimeMs,
        status: errorKind === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
        errorMessage: message,
        filePath: null,
      });
    }
  } finally {
    if (prepared && conn) await deps.releaseConnection(prepared.dataSourceId, conn);
  }
  return 'ran';
}
