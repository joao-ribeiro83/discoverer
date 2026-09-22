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
import { schedules } from '../db/schema.js';
import { liveExpiry, scheduledExpiry } from '../lib/map-run-key.js';
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

export type ClaimOutcome = 'ran' | 'busy' | 'gone';

export interface RunnerDeps extends MapExecutionDeps {
  claimRun: typeof store.claimRun;
  getRun: typeof store.getRun;
  appendBatch: typeof store.appendBatch;
  completeRun: typeof store.completeRun;
  failRun: typeof store.failRun;
  openRowStream: typeof openRowStream;
  loadRetentionDays: (scheduleId: string) => Promise<number | null>;
  limits: { maxRows: number; batchSize: number; liveTtlHours: number };
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
    loadRetentionDays: async (scheduleId) => {
      const [row] = await db
        .select({ days: schedules.resultRetentionDays })
        .from(schedules)
        .where(eq(schedules.id, scheduleId));
      return row?.days ?? null;
    },
    limits: {
      maxRows: config.MAP_RUN_MAX_ROWS,
      batchSize: config.MAP_RUN_BATCH_SIZE,
      liveTtlHours: config.MAP_RUN_LIVE_TTL_HOURS,
    },
    now: () => new Date(),
  };
}

// Lifecycles: any failed run is kept 24 h as history.
const FAILED_TTL_MS = 24 * 60 * 60 * 1000;
// Lifecycles: SCHEDULED default when the schedule is gone.
const DEFAULT_RETENTION_DAYS = 30;

export async function processMapRun(
  runId: string,
  deps: RunnerDeps = defaultRunnerDeps(),
): Promise<ClaimOutcome> {
  if (!(await deps.claimRun(runId))) {
    // Refused either because this user has an earlier run (wait and retry) or
    // because the run is no longer QUEUED — cancelled or deleted (drop the job).
    const run = await deps.getRun(runId);
    return run?.status === 'QUEUED' ? 'busy' : 'gone';
  }
  const run = await deps.getRun(runId);
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
    const decoration = {
      ...(prepared.groupBreakAliases?.length ? { groupBreakAliases: prepared.groupBreakAliases } : {}),
      ...(totalsRun.groups.length ? { totals: totalsRun.groups } : {}),
      ...(prepared.conditionalFormats?.length ? { conditionalFormats: prepared.conditionalFormats } : {}),
      ...(warnings.length ? { warnings } : {}),
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
  } catch (err) {
    // SEC-07: wrapExecutionError logs the raw driver error (ORA- text) server
    // side and hands back only the kind's generic message for the row.
    const kind: ExecutionErrorKind = isTimeoutError(err)
      ? 'TIMEOUT'
      : prepared && !conn
        ? 'CONNECT'
        : 'QUERY';
    const wrapped = wrapExecutionError(err, kind, runId);
    const now = deps.now();
    await deps.failRun(runId, {
      status: 'FAILED',
      errorMessage: wrapped.message,
      expiresAt: new Date(now.getTime() + FAILED_TTL_MS),
    });
    await safeRecord(deps, {
      mapId: run.mapId,
      executedBy: run.requestedBy,
      executionTimeMs: now.getTime() - start,
      rowCount: null,
      sqlText: prepared?.sql ?? null,
      planDecision: prepared?.planDecision,
      errorMessage: wrapped.message,
      status: wrapped.kind === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
    });
  } finally {
    if (prepared && conn) await deps.releaseConnection(prepared.dataSourceId, conn);
  }
  return 'ran';
}
