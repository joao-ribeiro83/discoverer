/**
 * Map-runs HTTP route tests (`src/routes/map-runs.ts`).
 *
 * No map-run worker runs during these tests (`MAP_RUN_WORKER_ENABLED` is off
 * under `NODE_ENV=test`, the same default `export-routes.test.ts` relies on),
 * so a requested run simply stays QUEUED — enough to cover creation, re-use,
 * listing, ownership/admin gates and cancellation. Rows pagination, the
 * "not completed yet" and "expired" branches are seeded directly through
 * `services/map-run.store.ts`, the way `map-run-store.test.ts` does, since
 * getting a run to COMPLETED for real needs the worker (covered at the
 * service level elsewhere).
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import { users, maps, mapRuns, mapShares } from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import { closeMapRunQueue } from '../../queues/map-run.queue.js';
import { createRun, completeRun, appendBatch } from '../../services/map-run.store.js';

let app: FastifyInstance;

const OWNER_EMAIL = 'mr-owner@example.com';
const OTHER_EMAIL = 'mr-other@example.com';
const ADMIN_EMAIL = 'mr-admin@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let ownerToken: string;
let otherToken: string;
let adminToken: string;
let ownerId: string;
let otherId: string;
let mapId: string;

async function createTestUser(email: string, role: 'ADMIN' | 'USER' = 'USER') {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'MR Test', role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  return res.json().data.token as string;
}

async function cleanup() {
  // Cascades: users -> maps (created_by) -> map_runs (map_id) -> map_run_batches,
  // and users -> map_runs (requested_by) -> map_run_batches directly.
  for (const email of [OWNER_EMAIL, OTHER_EMAIL, ADMIN_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanup();

  const owner = await createTestUser(OWNER_EMAIL);
  const other = await createTestUser(OTHER_EMAIL);
  await createTestUser(ADMIN_EMAIL, 'ADMIN');
  ownerId = owner.id;
  otherId = other.id;

  const [map] = await db
    .insert(maps)
    .values({ name: 'MR Test Map', mapType: 'TABLE', createdBy: ownerId })
    .returning();
  mapId = map!.id;

  ownerToken = await login(OWNER_EMAIL);
  otherToken = await login(OTHER_EMAIL);
  adminToken = await login(ADMIN_EMAIL);
});

afterAll(async () => {
  await cleanup();
  await closeMapRunQueue();
  await app.close();
});

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe('POST /api/maps/:id/runs', () => {
  it('202s a new run and re-uses it (200) on an identical request', async () => {
    const first = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/runs`,
      headers: auth(ownerToken),
      payload: {},
    });
    expect(first.statusCode).toBe(202);
    const firstBody = first.json();
    expect(firstBody.data.status).toBe('QUEUED');
    expect(firstBody.data.mapId).toBe(mapId);
    expect(firstBody.data.mapName).toBe('MR Test Map');

    const second = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/runs`,
      headers: auth(ownerToken),
      payload: {},
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.id).toBe(firstBody.data.id);
  });
});

describe('GET/DELETE /api/runs/:id — ownership and admin', () => {
  it('hides another user\'s run (404) but lets an admin see it (200)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/runs`,
      headers: auth(ownerToken),
      payload: { force: true },
    });
    expect(created.statusCode).toBe(202);
    const runId = created.json().data.id as string;

    const asOwner = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: auth(ownerToken),
    });
    expect(asOwner.statusCode).toBe(200);

    const asOther = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: auth(otherToken),
    });
    expect(asOther.statusCode).toBe(404);

    const asAdmin = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: auth(adminToken),
    });
    expect(asAdmin.statusCode).toBe(200);
    expect(asAdmin.json().data.id).toBe(runId);
  });

  it('cancels a QUEUED run', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/runs`,
      headers: auth(ownerToken),
      payload: { force: true },
    });
    const runId = created.json().data.id as string;

    const cancelled = await app.inject({
      method: 'DELETE',
      url: `/api/runs/${runId}`,
      headers: auth(ownerToken),
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().data).toEqual({ cancelled: true });

    const after = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: auth(ownerToken),
    });
    expect(after.json().data.status).toBe('CANCELLED');
  });

  it('deletes a terminal (COMPLETED) run and its batches', async () => {
    const run = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `delete-completed-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await completeRun(run.id, {
      columns: [{ name: 'IDX', label: 'Idx', isAggregate: false }],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 5,
      sqlText: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await appendBatch(run.id, 0, [{ IDX: 1 }]);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/runs/${run.id}`,
      headers: auth(ownerToken),
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toEqual({ cancelled: false, deleted: true });

    const after = await app.inject({
      method: 'GET',
      url: `/api/runs/${run.id}`,
      headers: auth(ownerToken),
    });
    expect(after.statusCode).toBe(404);
  });

  it('409s RUN_IN_PROGRESS for a RUNNING run instead of deleting it', async () => {
    const run = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `delete-running-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    // No worker runs in this suite, so claim the row directly the way the
    // worker's `claimRun` would — status RUNNING, still holding an in-flight
    // (fake, here) Oracle query.
    await db.update(mapRuns).set({ status: 'RUNNING', startedAt: new Date() }).where(eq(mapRuns.id, run.id));

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/runs/${run.id}`,
      headers: auth(ownerToken),
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RUN_IN_PROGRESS');

    // The row must still exist — the whole point is FIFO isn't broken by a
    // deleted-out-from-under-it RUNNING run.
    const stillThere = await app.inject({
      method: 'GET',
      url: `/api/runs/${run.id}`,
      headers: auth(ownerToken),
    });
    expect(stillThere.statusCode).toBe(200);
    expect(stillThere.json().data.status).toBe('RUNNING');
  });
});

describe('GET /api/runs — list', () => {
  it('403s all=true for a non-admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/runs?all=true',
      headers: auth(ownerToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists only the caller\'s own runs, even on a map they can view; admin all=true sees them', async () => {
    // OTHER can VIEW the map, so only the requestedBy filter can hide the run.
    const [share] = await db
      .insert(mapShares)
      .values({ mapId, sharedWithUserId: otherId, permissionLevel: 'VIEW', sharedBy: ownerId })
      .returning();
    try {
      const created = await app.inject({
        method: 'POST',
        url: `/api/maps/${mapId}/runs`,
        headers: auth(ownerToken),
        payload: { force: true },
      });
      const runId = created.json().data.id as string;

      const ids = async (token: string, url: string) =>
        ((await app.inject({ method: 'GET', url, headers: auth(token) })).json().data as {
          id: string;
        }[]).map((r) => r.id);

      expect(await ids(otherToken, '/api/runs')).not.toContain(runId);
      expect(await ids(ownerToken, '/api/runs')).toContain(runId);
      expect(await ids(adminToken, '/api/runs?all=true')).toContain(runId);
    } finally {
      await db.delete(mapShares).where(eq(mapShares.id, share!.id));
    }
  });

  it('leaves columns, decoration and sql out of list entries; GET /api/runs/:id keeps them', async () => {
    const run = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `list-summary-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await completeRun(run.id, {
      columns: [{ name: 'IDX', label: 'Idx', isAggregate: false }],
      decoration: { totals: [{ IDX: 1 }] },
      rowCount: 1,
      truncated: false,
      executionTimeMs: 5,
      sqlText: 'SELECT 1 FROM dual',
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const list = await app.inject({ method: 'GET', url: '/api/runs?all=true', headers: auth(adminToken) });
    const entry = (list.json().data as Record<string, unknown>[]).find((r) => r.id === run.id)!;
    expect(entry.columns).toBeNull();
    expect(entry.decoration).toBeNull();
    expect(entry).not.toHaveProperty('sql');
    expect(entry.rowCount).toBe(1);

    const one = await app.inject({ method: 'GET', url: `/api/runs/${run.id}`, headers: auth(adminToken) });
    expect(one.json().data.columns).toHaveLength(1);
    expect(one.json().data.decoration).toEqual({ totals: [{ IDX: 1 }] });
    expect(one.json().data.sql).toBe('SELECT 1 FROM dual');
  });
});

describe('GET /api/runs/:id/rows', () => {
  it('409s before completion, 410s once expired, and pages across batches once seeded', async () => {
    // Not yet completed.
    const queued = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `rows-not-done-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const notDone = await app.inject({
      method: 'GET',
      url: `/api/runs/${queued.id}/rows`,
      headers: auth(ownerToken),
    });
    expect(notDone.statusCode).toBe(409);
    expect(notDone.json().error).toBe('RUN_NOT_COMPLETED');

    // Completed but expired.
    const expired = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `rows-expired-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await completeRun(expired.id, {
      columns: [{ name: 'IDX', label: 'Idx', isAggregate: false }],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 5,
      sqlText: 'SELECT 1',
      expiresAt: new Date(Date.now() - 1_000),
    });
    const expiredRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${expired.id}/rows`,
      headers: auth(ownerToken),
    });
    expect(expiredRes.statusCode).toBe(410);

    // Completed, not expired, 3 000 rows across 3 batches of 1 000: offset
    // 1500/limit 700 must span batch 1 (rows 1500-1999) and batch 2 (2000-2199).
    const paged = await createRun({
      mapId,
      requestedBy: ownerId,
      kind: 'LIVE',
      runKey: `rows-paged-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await completeRun(paged.id, {
      columns: [{ name: 'IDX', label: 'Idx', isAggregate: false }],
      decoration: {},
      rowCount: 3000,
      truncated: false,
      executionTimeMs: 5,
      sqlText: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    for (let batch = 0; batch < 3; batch++) {
      const rows = Array.from({ length: 1000 }, (_, i) => ({ IDX: batch * 1000 + i }));
      await appendBatch(paged.id, batch, rows);
    }

    const page = await app.inject({
      method: 'GET',
      url: `/api/runs/${paged.id}/rows?offset=1500&limit=700`,
      headers: auth(ownerToken),
    });
    expect(page.statusCode).toBe(200);
    const rows = page.json().data as { IDX: number }[];
    expect(rows).toHaveLength(700);
    expect(rows[0]!.IDX).toBe(1500);
    expect(rows[rows.length - 1]!.IDX).toBe(2199);
  });
});

describe('SEC-002: a run is invisible to anyone but its owner/admin', () => {
  it('404s every /runs/:id route for another user, GET-by-id-scan style', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/runs`,
      headers: auth(ownerToken),
      payload: { force: true },
    });
    const runId = created.json().data.id as string;

    const attempts: { method: 'GET' | 'DELETE'; url: string }[] = [
      { method: 'GET', url: `/api/runs/${runId}` },
      { method: 'GET', url: `/api/runs/${runId}/rows` },
      { method: 'DELETE', url: `/api/runs/${runId}` },
    ];
    // OTHER can VIEW the map, so each 404 must come from the ownership check,
    // not from canAccessMap.
    const [share] = await db
      .insert(mapShares)
      .values({ mapId, sharedWithUserId: otherId, permissionLevel: 'VIEW', sharedBy: ownerId })
      .returning();
    try {
      for (const { method, url } of attempts) {
        const res = await app.inject({ method, url, headers: auth(otherToken) });
        expect(res.statusCode).toBe(404);
      }
    } finally {
      await db.delete(mapShares).where(eq(mapShares.id, share!.id));
    }

    // The scan's DELETE attempt must not have actually removed anything —
    // confirms the 404 above was a real refusal, not a delete-then-404 miss.
    const stillThere = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}`,
      headers: auth(ownerToken),
    });
    expect(stillThere.statusCode).toBe(200);
  });

  it('hides a run\'s rows and its entry in the list once the owner\'s map share is revoked', async () => {
    const [share] = await db
      .insert(mapShares)
      .values({ mapId, sharedWithUserId: otherId, permissionLevel: 'VIEW', sharedBy: ownerId })
      .returning();

    const run = await createRun({
      mapId,
      requestedBy: otherId,
      kind: 'LIVE',
      runKey: `share-revoked-${randomUUID()}`,
      parameters: {},
      calculatedFields: [],
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await completeRun(run.id, {
      columns: [{ name: 'IDX', label: 'Idx', isAggregate: false }],
      decoration: {},
      rowCount: 1,
      truncated: false,
      executionTimeMs: 5,
      sqlText: null,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await appendBatch(run.id, 0, [{ IDX: 1 }]);

    // Still shared: OTHER (the run's own owner) can read it.
    const beforeRevoke = await app.inject({
      method: 'GET',
      url: `/api/runs/${run.id}/rows`,
      headers: auth(otherToken),
    });
    expect(beforeRevoke.statusCode).toBe(200);

    await db.delete(mapShares).where(eq(mapShares.id, share!.id));

    const afterRevoke = await app.inject({
      method: 'GET',
      url: `/api/runs/${run.id}/rows`,
      headers: auth(otherToken),
    });
    expect(afterRevoke.statusCode).toBe(404);

    const list = await app.inject({
      method: 'GET',
      url: '/api/runs',
      headers: auth(otherToken),
    });
    expect(list.statusCode).toBe(200);
    const ids = (list.json().data as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(run.id);
  });
});

describe('removed async execution routes', () => {
  it('404s — they were replaced by map runs', async () => {
    const jobId = randomUUID();
    const postAsync = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: auth(ownerToken),
    });
    expect(postAsync.statusCode).toBe(404);

    const getStatus = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/executions/${jobId}`,
      headers: auth(ownerToken),
    });
    expect(getStatus.statusCode).toBe(404);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${mapId}/executions/${jobId}`,
      headers: auth(ownerToken),
    });
    expect(del.statusCode).toBe(404);
  });
});
