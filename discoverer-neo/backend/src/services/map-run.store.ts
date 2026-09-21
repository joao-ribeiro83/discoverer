/**
 * Map run store (Task 1.3) — Drizzle data access for `map_runs` /
 * `map_run_batches`. No BullMQ, no Oracle: this is the persistence layer the
 * run service (Stage 2) and the worker build on.
 *
 * `claimRun` and `cleanupExpiredRuns` drop to `db.execute(sql\`...\`)` because
 * their correctness depends on one atomic statement, not on however Drizzle's
 * query builder happens to compose clauses. `claimRun`'s SQL is copied from
 * the plan's "Spec > Per-user sequential execution", `$1` becoming a
 * `${runId}` bind, with one deliberate deviation from the spec text (see the
 * comment at its second `NOT EXISTS` — controller ruling, fix round 1).
 */
import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapRuns, mapRunBatches } from '../db/schema.js';
import type { ResultColumn } from './map-execution.service.js';

export type RunKind = 'LIVE' | 'SCHEDULED';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type MapRunRow = typeof mapRuns.$inferSelect;

export interface CreateRunInput {
  mapId: string;
  requestedBy: string;
  kind: RunKind;
  scheduleId?: string;
  runKey: string;
  parameters: Record<string, unknown>;
  calculatedFields: unknown[];
  expiresAt: Date;
}

export async function createRun(input: CreateRunInput): Promise<MapRunRow> {
  const [row] = await db
    .insert(mapRuns)
    .values({
      mapId: input.mapId,
      requestedBy: input.requestedBy,
      kind: input.kind,
      scheduleId: input.scheduleId,
      runKey: input.runKey,
      parameters: input.parameters,
      calculatedFields: input.calculatedFields,
      expiresAt: input.expiresAt,
    })
    .returning();
  return row!;
}

// COMPLETED & not expired, or QUEUED/RUNNING (dedupe); newest first.
export async function findReusableRun(runKey: string, now: Date = new Date()): Promise<MapRunRow | null> {
  const [row] = await db
    .select()
    .from(mapRuns)
    .where(
      and(
        eq(mapRuns.runKey, runKey),
        or(
          and(eq(mapRuns.status, 'COMPLETED'), gt(mapRuns.expiresAt, now)),
          inArray(mapRuns.status, ['QUEUED', 'RUNNING']),
        ),
      ),
    )
    .orderBy(desc(mapRuns.createdAt))
    .limit(1);
  return row ?? null;
}

// Spec > Per-user sequential execution — verbatim, `$1` replaced with `${runId}`.
export async function claimRun(runId: string): Promise<boolean> {
  const result = await db.execute(sql`
    UPDATE map_runs r SET status = 'RUNNING', started_at = now()
    WHERE r.id = ${runId} AND r.status = 'QUEUED'
      AND NOT EXISTS (SELECT 1 FROM map_runs o WHERE o.requested_by = r.requested_by AND o.status = 'RUNNING')
      -- created_at = now() is the transaction start time, so two runs inserted in one transaction tie; break the tie on id so exactly one worker's claim wins.
      AND NOT EXISTS (SELECT 1 FROM map_runs o WHERE o.requested_by = r.requested_by AND o.status = 'QUEUED' AND (o.created_at < r.created_at OR (o.created_at = r.created_at AND o.id < r.id)))
    RETURNING r.id;
  `);
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}

export async function appendBatch(runId: string, seq: number, rows: Record<string, unknown>[]): Promise<void> {
  await db.insert(mapRunBatches).values({ runId, seq, rows, rowCount: rows.length });
}

export async function completeRun(
  runId: string,
  r: {
    columns: ResultColumn[];
    decoration: Record<string, unknown>;
    rowCount: number;
    truncated: boolean;
    executionTimeMs: number;
    sqlText: string | null;
    expiresAt: Date;
  },
): Promise<void> {
  await db
    .update(mapRuns)
    .set({
      status: 'COMPLETED',
      columns: r.columns,
      decoration: r.decoration,
      rowCount: r.rowCount,
      truncated: r.truncated,
      executionTimeMs: r.executionTimeMs,
      sqlText: r.sqlText,
      completedAt: new Date(),
      expiresAt: r.expiresAt,
    })
    .where(eq(mapRuns.id, runId));
}

export async function failRun(
  runId: string,
  r: { status: 'FAILED' | 'CANCELLED'; errorMessage: string | null; expiresAt: Date },
): Promise<void> {
  await db
    .update(mapRuns)
    .set({
      status: r.status,
      errorMessage: r.errorMessage,
      completedAt: new Date(),
      expiresAt: r.expiresAt,
    })
    .where(eq(mapRuns.id, runId));
}

export async function cancelIfQueued(runId: string): Promise<boolean> {
  const result = await db
    .update(mapRuns)
    .set({ status: 'CANCELLED', completedAt: new Date() })
    .where(and(eq(mapRuns.id, runId), eq(mapRuns.status, 'QUEUED')))
    .returning({ id: mapRuns.id });
  return result.length > 0;
}

export async function getRun(runId: string): Promise<MapRunRow | null> {
  const [row] = await db.select().from(mapRuns).where(eq(mapRuns.id, runId));
  return row ?? null;
}

export async function listRuns(f: {
  requestedBy?: string;
  mapId?: string;
  status?: RunStatus;
  kind?: RunKind;
  limit: number;
}): Promise<MapRunRow[]> {
  const conditions = [
    f.requestedBy ? eq(mapRuns.requestedBy, f.requestedBy) : undefined,
    f.mapId ? eq(mapRuns.mapId, f.mapId) : undefined,
    f.status ? eq(mapRuns.status, f.status) : undefined,
    f.kind ? eq(mapRuns.kind, f.kind) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  return db
    .select()
    .from(mapRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(mapRuns.createdAt))
    .limit(f.limit);
}

// Slices rows across batches without assuming a batch size: reads each
// batch's denormalised `row_count` (never the `rows` JSONB itself — pulling
// that in just to call jsonb_array_length on it would make Postgres
// detoast/decompress every batch of the run on every page read), finds which
// batches overlap [offset, offset + limit), fetches only those, then slices
// in JS. MAP_RUN_BATCH_SIZE isn't defined until a later task and may end up
// configurable, so this must not hardcode 1000.
export async function readRows(runId: string, offset: number, limit: number): Promise<Record<string, unknown>[]> {
  const lengths = await db
    .select({ seq: mapRunBatches.seq, rowCount: mapRunBatches.rowCount })
    .from(mapRunBatches)
    .where(eq(mapRunBatches.runId, runId))
    .orderBy(mapRunBatches.seq);

  const startOffsetBySeq = new Map<number, number>();
  const wantedSeqs: number[] = [];
  let cursor = 0;
  for (const { seq, rowCount } of lengths) {
    const batchStart = cursor;
    const batchEnd = cursor + rowCount;
    startOffsetBySeq.set(seq, batchStart);
    if (batchEnd > offset && batchStart < offset + limit) {
      wantedSeqs.push(seq);
    }
    cursor = batchEnd;
  }
  if (wantedSeqs.length === 0) return [];

  const batchRows = await db
    .select({ seq: mapRunBatches.seq, rows: mapRunBatches.rows })
    .from(mapRunBatches)
    .where(and(eq(mapRunBatches.runId, runId), inArray(mapRunBatches.seq, wantedSeqs)))
    .orderBy(mapRunBatches.seq);

  const result: Record<string, unknown>[] = [];
  for (const batch of batchRows) {
    const batchStart = startOffsetBySeq.get(batch.seq)!;
    const rows = batch.rows as Record<string, unknown>[];
    for (let i = 0; i < rows.length; i++) {
      const globalIndex = batchStart + i;
      if (globalIndex >= offset && globalIndex < offset + limit) {
        result.push(rows[i]!);
      }
    }
  }
  return result;
}

// One batch at a time, ordered by seq — never loads the whole run into memory.
export async function* readBatches(runId: string): AsyncGenerator<Record<string, unknown>[]> {
  const seqRows = await db
    .select({ seq: mapRunBatches.seq })
    .from(mapRunBatches)
    .where(eq(mapRunBatches.runId, runId))
    .orderBy(mapRunBatches.seq);

  for (const { seq } of seqRows) {
    const [batch] = await db
      .select({ rows: mapRunBatches.rows })
      .from(mapRunBatches)
      .where(and(eq(mapRunBatches.runId, runId), eq(mapRunBatches.seq, seq)));
    yield (batch?.rows as Record<string, unknown>[] | undefined) ?? [];
  }
}

export async function deleteRun(runId: string): Promise<boolean> {
  const result = await db.delete(mapRuns).where(eq(mapRuns.id, runId)).returning({ id: mapRuns.id });
  return result.length > 0;
}

// (a) terminal runs past expiry are deleted (batches cascade via FK).
// (b) QUEUED/RUNNING runs stuck for MAP_RUN_STALE_HOURS (24h here — the config
// key lands in a later task) are marked FAILED so a crashed worker doesn't
// leave a run stuck forever. `now` is a bind, never SQL `now()`, so a test can
// drive it deterministically.
export async function cleanupExpiredRuns(now: Date = new Date()): Promise<{ deleted: number; staleFailed: number }> {
  const deletedResult = await db.execute(sql`
    DELETE FROM map_runs
    WHERE expires_at < ${now} AND status IN ('COMPLETED', 'FAILED', 'CANCELLED')
    RETURNING id
  `);
  const deleted = (deletedResult as unknown as { rows: unknown[] }).rows.length;

  const staleCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const staleResult = await db.execute(sql`
    UPDATE map_runs
    SET status = 'FAILED', error_message = 'stale', completed_at = ${now}, expires_at = ${staleExpiresAt}
    WHERE status IN ('QUEUED', 'RUNNING') AND created_at < ${staleCutoff}
    RETURNING id
  `);
  const staleFailed = (staleResult as unknown as { rows: unknown[] }).rows.length;

  return { deleted, staleFailed };
}
