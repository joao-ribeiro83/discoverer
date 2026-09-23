/**
 * Map run store integration tests (Task 1.3).
 *
 * Exercises `services/map-run.store.ts` directly against the real test
 * Postgres — no Fastify app, no BullMQ, no Oracle. Seeds one user (plus a
 * second user for the per-user FIFO claim cases) and one map the way
 * `schedules.test.ts` does.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from '@jest/globals';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, maps, mapRuns, mapRunBatches } from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import {
  createRun,
  getRun,
  findReusableRun,
  claimRun,
  appendBatch,
  completeRun,
  failRun,
  cancelIfQueued,
  listRuns,
  readRows,
  readBatches,
  deleteRun,
  cleanupExpiredRuns,
  type CreateRunInput,
} from '../../services/map-run.store.js';

const OWNER_EMAIL = 'run-store-owner@example.com';
const OTHER_EMAIL = 'run-store-other@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let ownerId: string;
let otherId: string;
let mapId: string;

async function createTestUser(email: string) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Run Store Test', role: 'USER' })
    .returning();
  return user!;
}

async function cleanup() {
  for (const email of [OWNER_EMAIL, OTHER_EMAIL]) {
    // Cascades: users -> maps (created_by) -> map_runs (map_id) -> map_run_batches,
    // and users -> map_runs (requested_by) -> map_run_batches directly.
    await db.delete(users).where(eq(users.email, email));
  }
}

function baseInput(overrides: Partial<CreateRunInput> = {}): CreateRunInput {
  return {
    mapId,
    requestedBy: ownerId,
    kind: 'LIVE',
    runKey: `key-${Math.random().toString(36).slice(2)}`,
    parameters: {},
    calculatedFields: [],
    expiresAt: new Date(Date.now() + 3600_000),
    ...overrides,
  };
}

beforeAll(async () => {
  await cleanup();

  const owner = await createTestUser(OWNER_EMAIL);
  const other = await createTestUser(OTHER_EMAIL);
  ownerId = owner.id;
  otherId = other.id;

  const [map] = await db
    .insert(maps)
    .values({ name: 'Run Store Map', mapType: 'TABLE', createdBy: ownerId })
    .returning();
  mapId = map!.id;
});

afterAll(async () => {
  await cleanup();
});

// Every test creates its own runs against the shared map/users; wipe them
// between tests so claim/reuse/cleanup cases never see a prior test's rows.
afterEach(async () => {
  await db.delete(mapRuns).where(eq(mapRuns.mapId, mapId));
});

describe('createRun / getRun', () => {
  it('creates a run and reads it back by id', async () => {
    const created = await createRun(
      baseInput({
        runKey: 'key-create-get',
        parameters: { a: 1 },
        calculatedFields: [{ alias: 'x' }],
      }),
    );

    expect(created.status).toBe('QUEUED');
    expect(created.mapId).toBe(mapId);
    expect(created.requestedBy).toBe(ownerId);
    expect(created.runKey).toBe('key-create-get');

    const fetched = await getRun(created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.parameters).toEqual({ a: 1 });
    expect(fetched?.calculatedFields).toEqual([{ alias: 'x' }]);
  });

  it('returns null for an unknown id', async () => {
    expect(await getRun('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('findReusableRun', () => {
  it('returns a COMPLETED run that has not expired', async () => {
    const run = await createRun(baseInput({ runKey: 'key-reuse-completed' }));
    await completeRun(run.id, {
      columns: [],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 10,
      sqlText: 'SELECT 1',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const found = await findReusableRun('key-reuse-completed');
    expect(found?.id).toBe(run.id);
    expect(found?.status).toBe('COMPLETED');
  });

  it('ignores an expired COMPLETED run', async () => {
    const run = await createRun(baseInput({ runKey: 'key-reuse-expired' }));
    await completeRun(run.id, {
      columns: [],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 10,
      sqlText: 'SELECT 1',
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await findReusableRun('key-reuse-expired')).toBeNull();
  });

  it('returns a QUEUED run for the same key (dedupe)', async () => {
    const run = await createRun(baseInput({ runKey: 'key-reuse-queued' }));
    const found = await findReusableRun('key-reuse-queued');
    expect(found?.id).toBe(run.id);
    expect(found?.status).toBe('QUEUED');
  });
});

describe('claimRun (per-user FIFO)', () => {
  it('claims a QUEUED run when nothing blocks it', async () => {
    const run = await createRun(baseInput({ runKey: 'claim-clean' }));
    expect(await claimRun(run.id)).toBe(true);
    const after = await getRun(run.id);
    expect(after?.status).toBe('RUNNING');
    expect(after?.startedAt).not.toBeNull();
  });

  it('refuses when the same user already has a RUNNING run', async () => {
    const running = await createRun(baseInput({ runKey: 'claim-running-blocker' }));
    expect(await claimRun(running.id)).toBe(true);

    const queued = await createRun(baseInput({ runKey: 'claim-blocked-by-running' }));
    expect(await claimRun(queued.id)).toBe(false);
    expect((await getRun(queued.id))?.status).toBe('QUEUED');
  });

  it('refuses when an older QUEUED run exists for the same user', async () => {
    const older = await createRun(baseInput({ runKey: 'claim-older' }));
    const newer = await createRun(baseInput({ runKey: 'claim-newer' }));

    expect(await claimRun(newer.id)).toBe(false);
    expect((await getRun(newer.id))?.status).toBe('QUEUED');
    // The older one is still claimable — proves the block is FIFO order, not a blanket refusal.
    expect(await claimRun(older.id)).toBe(true);
  });

  it('allows a different user to claim independently', async () => {
    const ownerRunning = await createRun(baseInput({ runKey: 'claim-owner-running' }));
    expect(await claimRun(ownerRunning.id)).toBe(true);

    const otherQueued = await createRun(
      baseInput({ requestedBy: otherId, runKey: 'claim-other-user' }),
    );
    expect(await claimRun(otherQueued.id)).toBe(true);
  });

  it('breaks a created_at tie on id, so exactly one of two identically-timestamped runs claims', async () => {
    const a = await createRun(baseInput({ runKey: 'claim-tie-a' }));
    const b = await createRun(baseInput({ runKey: 'claim-tie-b' }));
    // created_at = now() is the transaction start time — two runs inserted in
    // one transaction would tie for real. Force the tie explicitly here.
    const tie = new Date('2026-09-21T12:00:00.000Z');
    await db.update(mapRuns).set({ createdAt: tie }).where(eq(mapRuns.id, a.id));
    await db.update(mapRuns).set({ createdAt: tie }).where(eq(mapRuns.id, b.id));

    const [lowerId, higherId] = [a.id, b.id].sort() as [string, string];

    // The higher id loses the tie-break and must be refused while the lower one is still QUEUED.
    expect(await claimRun(higherId)).toBe(false);
    expect((await getRun(higherId))?.status).toBe('QUEUED');

    expect(await claimRun(lowerId)).toBe(true);
  });
});

describe('appendBatch / readRows', () => {
  it('reads a slice spanning two batches in order', async () => {
    const run = await createRun(baseInput({ runKey: 'rows-span' }));
    for (let seq = 0; seq < 3; seq++) {
      const batch = Array.from({ length: 1000 }, (_, i) => ({ n: seq * 1000 + i }));
      await appendBatch(run.id, seq, batch);
    }

    const rows = await readRows(run.id, 1500, 700);
    expect(rows).toHaveLength(700);
    expect(rows[0]).toEqual({ n: 1500 });
    expect(rows[699]).toEqual({ n: 2199 });
  });

  it('returns an empty array when the offset is past the end', async () => {
    const run = await createRun(baseInput({ runKey: 'rows-past-end' }));
    await appendBatch(run.id, 0, [{ n: 1 }, { n: 2 }]);

    expect(await readRows(run.id, 100, 10)).toEqual([]);
  });
});

describe('readBatches', () => {
  it('yields batches ordered by seq, one at a time', async () => {
    const run = await createRun(baseInput({ runKey: 'batches-order' }));
    // Insert out of order to prove the read orders by seq, not insertion order.
    await appendBatch(run.id, 1, [{ n: 'b' }]);
    await appendBatch(run.id, 0, [{ n: 'a' }]);
    await appendBatch(run.id, 2, [{ n: 'c' }]);

    const collected: Record<string, unknown>[][] = [];
    for await (const batch of readBatches(run.id)) {
      collected.push(batch);
    }
    expect(collected).toEqual([[{ n: 'a' }], [{ n: 'b' }], [{ n: 'c' }]]);
  });

  it('throws instead of silently skipping a batch that disappears mid-read', async () => {
    // Models a run getting swept (cleanupExpiredRuns) between listing the
    // seqs a read will cover and fetching each one's rows — a torn read
    // must fail loudly, not hand back a shorter, silently truncated result.
    const run = await createRun(baseInput({ runKey: 'batches-torn-read' }));
    await appendBatch(run.id, 0, [{ n: 'a' }]);
    await appendBatch(run.id, 1, [{ n: 'b' }]);

    const iterator = readBatches(run.id);
    // Consume the first (real) batch normally...
    expect((await iterator.next()).value).toEqual([{ n: 'a' }]);
    // ...then the second batch vanishes before it is read.
    await db
      .delete(mapRunBatches)
      .where(and(eq(mapRunBatches.runId, run.id), eq(mapRunBatches.seq, 1)));

    await expect(iterator.next()).rejects.toThrow(/seq 1/);
  });
});

describe('cancelIfQueued', () => {
  it('cancels a QUEUED run', async () => {
    const run = await createRun(baseInput({ runKey: 'cancel-queued' }));
    expect(await cancelIfQueued(run.id)).toBe(true);
    expect((await getRun(run.id))?.status).toBe('CANCELLED');
  });

  it('does nothing to a RUNNING run', async () => {
    const run = await createRun(baseInput({ runKey: 'cancel-running' }));
    await claimRun(run.id);
    expect(await cancelIfQueued(run.id)).toBe(false);
    expect((await getRun(run.id))?.status).toBe('RUNNING');
  });
});

describe('failRun', () => {
  it('marks a run FAILED with the given message and expiry', async () => {
    const run = await createRun(baseInput({ runKey: 'fail-run' }));
    const expiresAt = new Date(Date.now() + 3600_000);
    await failRun(run.id, { status: 'FAILED', errorMessage: 'boom', expiresAt });

    const after = await getRun(run.id);
    expect(after?.status).toBe('FAILED');
    expect(after?.errorMessage).toBe('boom');
    expect(after?.completedAt).not.toBeNull();
  });
});

describe('listRuns', () => {
  it('orders results newest first', async () => {
    const first = await createRun(baseInput({ runKey: 'list-first' }));
    const second = await createRun(baseInput({ runKey: 'list-second' }));

    const runs = await listRuns({ requestedBy: ownerId, mapId, limit: 10 });
    const ids = runs.map((r) => r.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});

describe('deleteRun', () => {
  it('deletes a run and cascades its batches', async () => {
    const run = await createRun(baseInput({ runKey: 'delete-cascade' }));
    await appendBatch(run.id, 0, [{ n: 1 }]);

    expect(await deleteRun(run.id)).toBe(true);
    expect(await getRun(run.id)).toBeNull();

    const batchRows = await db
      .select()
      .from(mapRunBatches)
      .where(eq(mapRunBatches.runId, run.id));
    expect(batchRows).toHaveLength(0);
  });

  it('returns false for an unknown id', async () => {
    expect(await deleteRun('00000000-0000-4000-8000-000000000000')).toBe(false);
  });
});

describe('cleanupExpiredRuns', () => {
  it('deletes expired terminal runs (cascading batches), fails stale QUEUED/RUNNING runs, and leaves fresh ones alone', async () => {
    const now = new Date('2026-09-21T12:00:00Z');

    const expiredCompleted = await createRun(
      baseInput({ runKey: 'cleanup-expired-completed', expiresAt: new Date(now.getTime() - 1000) }),
    );
    await completeRun(expiredCompleted.id, {
      columns: [],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 1,
      sqlText: null,
      expiresAt: new Date(now.getTime() - 1000),
    });
    await appendBatch(expiredCompleted.id, 0, [{ n: 1 }]);

    const staleQueued = await createRun(baseInput({ runKey: 'cleanup-stale-queued' }));
    await db
      .update(mapRuns)
      .set({ createdAt: new Date(now.getTime() - 25 * 3600_000) })
      .where(eq(mapRuns.id, staleQueued.id));

    const freshQueued = await createRun(baseInput({ runKey: 'cleanup-fresh-queued' }));

    const result = await cleanupExpiredRuns(now);
    expect(result.deleted).toBe(1);
    expect(result.staleFailed).toBe(1);

    expect(await getRun(expiredCompleted.id)).toBeNull();
    const batchRows = await db
      .select()
      .from(mapRunBatches)
      .where(eq(mapRunBatches.runId, expiredCompleted.id));
    expect(batchRows).toHaveLength(0);

    const staleAfter = await getRun(staleQueued.id);
    expect(staleAfter?.status).toBe('FAILED');
    expect(staleAfter?.errorMessage).toBe('stale');
    expect(staleAfter?.completedAt).not.toBeNull();

    const freshAfter = await getRun(freshQueued.id);
    expect(freshAfter?.status).toBe('QUEUED');
  });
});
