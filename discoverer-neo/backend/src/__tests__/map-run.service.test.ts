import { describe, it, expect, jest } from '@jest/globals';
import {
  requestRun,
  cancelRun,
  type MapRunServiceDeps,
} from '../services/map-run.service.js';
import type { CreateRunInput, MapRunRow } from '../services/map-run.store.js';

// Hermetic: no Postgres, no Redis. The store and the queue are faked.

const NOW = new Date('2026-09-22T10:00:00Z');
const MAP_UPDATED = new Date('2026-09-01T00:00:00Z');

function makeRun(overrides: Partial<MapRunRow> = {}): MapRunRow {
  return {
    id: 'run-1',
    mapId: 'map-1',
    requestedBy: 'user-1',
    kind: 'LIVE',
    scheduleId: null,
    runKey: 'key',
    parameters: {},
    calculatedFields: [],
    status: 'COMPLETED',
    columns: null,
    decoration: null,
    rowCount: 10,
    truncated: false,
    executionTimeMs: 5,
    sqlText: null,
    errorMessage: null,
    createdAt: NOW,
    startedAt: NOW,
    completedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 3_600_000),
    ...overrides,
  };
}

function makeDeps(hit: MapRunRow | null = null) {
  const created: CreateRunInput[] = [];
  const deps = {
    findReusableRun: jest.fn(async () => hit),
    createRun: jest.fn(async (input: CreateRunInput) => {
      created.push(input);
      return makeRun({ id: 'run-new', status: 'QUEUED', ...input, scheduleId: input.scheduleId ?? null });
    }),
    getRun: jest.fn(async () => hit),
    cancelIfQueued: jest.fn(async () => false),
    failRun: jest.fn(async () => undefined),
    loadMapUpdatedAt: jest.fn(async () => MAP_UPDATED),
    enqueueRun: jest.fn(async () => undefined),
    removeJob: jest.fn(async () => undefined),
    now: () => NOW,
  } satisfies MapRunServiceDeps;
  return { deps, created };
}

describe('requestRun', () => {
  it('returns a still-valid COMPLETED run without enqueueing', async () => {
    const hit = makeRun();
    const { deps } = makeDeps(hit);
    const result = await requestRun({ mapId: 'map-1', userId: 'user-1', kind: 'LIVE' }, deps);
    expect(result).toEqual({ run: hit, reused: true });
    expect(deps.createRun).not.toHaveBeenCalled();
    expect(deps.enqueueRun).not.toHaveBeenCalled();
  });

  it('creates and enqueues when there is no valid hit (expired runs are not returned by the store)', async () => {
    const { deps, created } = makeDeps(null);
    const result = await requestRun(
      { mapId: 'map-1', userId: 'user-1', kind: 'LIVE', parameters: { p: 1 } },
      deps,
    );
    expect(result.reused).toBe(false);
    expect(result.run.id).toBe('run-new');
    expect(deps.enqueueRun).toHaveBeenCalledWith('run-new');
    expect(created[0]).toMatchObject({
      mapId: 'map-1',
      requestedBy: 'user-1',
      kind: 'LIVE',
      parameters: { p: 1 },
      calculatedFields: [],
      expiresAt: new Date(NOW.getTime() + 24 * 3_600_000),
    });
    expect(created[0]!.runKey).toMatch(/^[0-9a-f]{64}$/);
    expect(deps.findReusableRun).toHaveBeenCalledWith(created[0]!.runKey, NOW);
  });

  it('force creates a new run even when a hit exists', async () => {
    const { deps } = makeDeps(makeRun());
    const result = await requestRun(
      { mapId: 'map-1', userId: 'user-1', kind: 'LIVE', force: true },
      deps,
    );
    expect(result.reused).toBe(false);
    expect(deps.findReusableRun).not.toHaveBeenCalled();
    expect(deps.enqueueRun).toHaveBeenCalledWith('run-new');
  });

  it('returns a QUEUED run with the same key (dedupe)', async () => {
    const hit = makeRun({ status: 'QUEUED' });
    const { deps } = makeDeps(hit);
    const result = await requestRun({ mapId: 'map-1', userId: 'user-1', kind: 'LIVE' }, deps);
    expect(result).toEqual({ run: hit, reused: true });
    expect(deps.enqueueRun).not.toHaveBeenCalled();
  });

  it('passes kind and scheduleId through for a SCHEDULED run, never re-using a LIVE one', async () => {
    const { deps, created } = makeDeps(makeRun());
    await requestRun(
      { mapId: 'map-1', userId: 'user-1', kind: 'SCHEDULED', scheduleId: 'sched-1' },
      deps,
    );
    expect(deps.findReusableRun).not.toHaveBeenCalled();
    expect(created[0]).toMatchObject({ kind: 'SCHEDULED', scheduleId: 'sched-1' });
    expect(deps.enqueueRun).toHaveBeenCalledWith('run-new');
  });

  it('fails the new run when it cannot be enqueued, so it does not block the user', async () => {
    const { deps } = makeDeps(null);
    deps.enqueueRun.mockRejectedValue(new Error('redis down'));
    await expect(
      requestRun({ mapId: 'map-1', userId: 'user-1', kind: 'LIVE' }, deps),
    ).rejects.toThrow('redis down');
    expect(deps.failRun).toHaveBeenCalledWith('run-new', expect.objectContaining({ status: 'FAILED' }));
  });

  it('keys on map.updatedAt, so an edited map misses the old run', async () => {
    const a = makeDeps(null);
    await requestRun({ mapId: 'map-1', userId: 'user-1', kind: 'LIVE' }, a.deps);
    const b = makeDeps(null);
    b.deps.loadMapUpdatedAt.mockResolvedValue(new Date('2026-09-02T00:00:00Z'));
    await requestRun({ mapId: 'map-1', userId: 'user-1', kind: 'LIVE' }, b.deps);
    expect(a.created[0]!.runKey).not.toBe(b.created[0]!.runKey);
  });
});

describe('cancelRun', () => {
  it('cancels a QUEUED run and removes its job', async () => {
    const { deps } = makeDeps(makeRun({ status: 'QUEUED' }));
    deps.cancelIfQueued.mockResolvedValue(true);
    await expect(cancelRun('run-1', deps)).resolves.toBe('cancelled');
    expect(deps.removeJob).toHaveBeenCalledWith('run-1');
  });

  it('reports not_queued for a run past QUEUED', async () => {
    const { deps } = makeDeps(makeRun({ status: 'RUNNING' }));
    await expect(cancelRun('run-1', deps)).resolves.toBe('not_queued');
    expect(deps.removeJob).not.toHaveBeenCalled();
  });

  it('reports not_found for an unknown run', async () => {
    const { deps } = makeDeps(null);
    await expect(cancelRun('run-x', deps)).resolves.toBe('not_found');
  });
});
