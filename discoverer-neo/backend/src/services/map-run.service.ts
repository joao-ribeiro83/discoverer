/**
 * Map run service (Task 2.3): request a run — re-using a still-valid result
 * when one exists — and cancel a queued one. The worker (map-run.runner.ts)
 * does the Oracle work; this only writes the row and enqueues it.
 */
import { buildRunKey } from '../lib/map-run-key.js';
import { enqueueRun, mapRunQueue } from '../queues/map-run.queue.js';
import type { CalcFieldInput } from './calculated-field-evaluator.js';
import * as store from './map-run.store.js';
import type { MapRunRow, RunKind } from './map-run.store.js';
import { loadMapDefinition } from './sql-generator.js';

export interface RequestRunInput {
  mapId: string;
  userId: string;
  kind: RunKind;
  parameters?: Record<string, unknown>;
  calculatedFields?: CalcFieldInput[];
  scheduleId?: string;
  force?: boolean;
}

export interface RequestRunResult {
  run: MapRunRow;
  reused: boolean;
}

export interface MapRunServiceDeps {
  findReusableRun: typeof store.findReusableRun;
  createRun: typeof store.createRun;
  getRun: typeof store.getRun;
  cancelIfQueued: typeof store.cancelIfQueued;
  failRun: typeof store.failRun;
  loadMapUpdatedAt: (mapId: string) => Promise<Date>;
  enqueueRun: (runId: string) => Promise<void>;
  removeJob: (runId: string) => Promise<void>;
  now: () => Date;
}

function defaultDeps(): MapRunServiceDeps {
  return {
    findReusableRun: store.findReusableRun,
    createRun: store.createRun,
    getRun: store.getRun,
    cancelIfQueued: store.cancelIfQueued,
    failRun: store.failRun,
    loadMapUpdatedAt: async (mapId) => (await loadMapDefinition(mapId)).map.updatedAt,
    enqueueRun,
    removeJob: async (runId) => {
      await mapRunQueue().remove(runId);
    },
    now: () => new Date(),
  };
}

// Placeholder until completion stamps the real expiry, so the sweeper's
// stale rule still covers a run that is never claimed.
const PLACEHOLDER_TTL_MS = 24 * 60 * 60 * 1000;

export async function requestRun(
  input: RequestRunInput,
  deps: MapRunServiceDeps = defaultDeps(),
): Promise<RequestRunResult> {
  const parameters = input.parameters ?? {};
  const calculatedFields = input.calculatedFields ?? [];
  const now = deps.now();
  const runKey = buildRunKey({
    mapId: input.mapId,
    userId: input.userId,
    parameters,
    calculatedFields,
    mapUpdatedAt: await deps.loadMapUpdatedAt(input.mapId),
  });

  if (!input.force) {
    const hit = await deps.findReusableRun(runKey, now);
    if (hit) return { run: hit, reused: true };
  }

  const run = await deps.createRun({
    mapId: input.mapId,
    requestedBy: input.userId,
    kind: input.kind,
    scheduleId: input.scheduleId,
    runKey,
    parameters,
    calculatedFields,
    expiresAt: new Date(now.getTime() + PLACEHOLDER_TTL_MS),
  });
  try {
    await deps.enqueueRun(run.id);
  } catch (err) {
    // A QUEUED row with no job would block this user's FIFO until the stale sweep.
    await deps.failRun(run.id, {
      status: 'FAILED',
      errorMessage: 'The run could not be queued.',
      expiresAt: new Date(now.getTime() + PLACEHOLDER_TTL_MS),
    });
    throw err;
  }
  return { run, reused: false };
}

export async function cancelRun(
  runId: string,
  deps: MapRunServiceDeps = defaultDeps(),
): Promise<'cancelled' | 'not_queued' | 'not_found'> {
  if (await deps.cancelIfQueued(runId)) {
    // Best effort: a job the worker already holds is ended by the runner,
    // which sees the run is no longer QUEUED.
    await deps.removeJob(runId).catch(() => undefined);
    return 'cancelled';
  }
  return (await deps.getRun(runId)) ? 'not_queued' : 'not_found';
}
