/**
 * Schedule HTTP route tests.
 *
 * Exercises the Fastify route handlers in `src/routes/schedules.ts` end-to-end
 * against real Postgres (schedule/result rows) and the real BullMQ scheduler
 * queue (Redis is up in this environment). Oracle is never touched: none of
 * these routes execute a query — that path is covered at the service level in
 * scheduler.test.ts. Focus here is auth, param validation, ownership, and
 * error-code mapping.
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
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import {
  users,
  businessAreas,
  folders,
  items,
  maps,
  schedules,
  scheduleParameters,
  scheduledResults,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { removeScheduleJob, closeSchedulerQueue } from '../queues/scheduler.queue.js';

let app: FastifyInstance;

const ADMIN_EMAIL = 'sched-admin@example.com';
const OWNER_EMAIL = 'sched-owner@example.com';
const OTHER_EMAIL = 'sched-other@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken: string;
let ownerToken: string;
let otherToken: string;

let ownerId: string;
let baId: string;
let mapId: string;

const createdScheduleIds = new Set<string>();

async function createTestUser(
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Sched Test', role })
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
  await db.delete(scheduledResults);
  await db.delete(scheduleParameters);
  await db.delete(schedules);
  await db.delete(maps);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(businessAreas).where(eq(businessAreas.name, 'Sched Test BA'));
  for (const email of [ADMIN_EMAIL, OWNER_EMAIL, OTHER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

/** Create a schedule via the API and remember its id for teardown. */
async function createScheduleViaApi(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/maps/${mapId}/schedules`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: 'Nightly',
      cronExpression: '0 0 * * *',
      outputFormat: 'CSV',
      ...overrides,
    },
  });
  const id = res.json().data.id as string;
  createdScheduleIds.add(id);
  return id;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanup();

  await createTestUser(ADMIN_EMAIL, 'ADMIN');
  const owner = await createTestUser(OWNER_EMAIL, 'USER');
  await createTestUser(OTHER_EMAIL, 'USER');
  ownerId = owner.id;

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: 'Sched Test BA', description: 'BA for schedule tests' })
    .returning();
  baId = ba!.id;

  // A map the owner created — canAccessMap short-circuits on createdBy, so the
  // owner has every action (including SCHEDULE) without any BA grant.
  const [map] = await db
    .insert(maps)
    .values({
      name: 'Sched Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  mapId = map!.id;

  adminToken = await login(ADMIN_EMAIL);
  ownerToken = await login(OWNER_EMAIL);
  otherToken = await login(OTHER_EMAIL);
});

afterAll(async () => {
  for (const id of createdScheduleIds) {
    await removeScheduleJob(id).catch(() => {});
  }
  await cleanup();
  await closeSchedulerQueue();
  await app.close();
});

// ---------------------------------------------------------------------------
// GET/POST /api/maps/:mapId/schedules
// ---------------------------------------------------------------------------

describe('map-scoped schedule routes', () => {
  it('401s without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/schedules`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('404s listing schedules for an unknown map', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/maps/00000000-0000-4000-8000-000000000000/schedules',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Map not found');
  });

  it('403s listing schedules for a map the caller cannot SCHEDULE', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/schedules`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates and lists a schedule on a map (owner)', async () => {
    const id = await createScheduleViaApi(ownerToken, { name: 'List Me' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/schedules`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const names = (res.json().data as Array<{ id: string; nextRunAt: unknown }>).map(
      (s) => s.id,
    );
    expect(names).toContain(id);
    // nextRunAt is computed for an active schedule.
    const entry = (res.json().data as Array<{ id: string; nextRunAt: unknown }>).find(
      (s) => s.id === id,
    );
    expect(entry!.nextRunAt).not.toBeNull();
  });

  it('404s creating a schedule on an unknown map', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/maps/00000000-0000-4000-8000-000000000000/schedules',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'X', cronExpression: '0 0 * * *', outputFormat: 'CSV' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('403s creating a schedule without SCHEDULE access', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/schedules`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { name: 'X', cronExpression: '0 0 * * *', outputFormat: 'CSV' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('400s on an invalid request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/schedules`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: '', cronExpression: '0 0 * * *', outputFormat: 'PDF' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid request body');
  });

  it('400s on an invalid cron expression (service validation)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/schedules`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Bad Cron',
        cronExpression: 'not a cron',
        outputFormat: 'CSV',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/cron/i);
  });

  it('admin can create a schedule on any map', async () => {
    const id = await createScheduleViaApi(adminToken, { name: 'Admin Sched' });
    expect(id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// /api/schedules and /api/schedules/:id
// ---------------------------------------------------------------------------

describe('user-scoped schedule routes', () => {
  it('lists the caller’s own schedules', async () => {
    await createScheduleViaApi(ownerToken, { name: 'Mine' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
    expect(res.json().data.length).toBeGreaterThan(0);
  });

  it('gets a single schedule the caller owns', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('400s on a non-uuid schedule id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules/not-a-uuid',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s on an unknown schedule id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/schedules/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('403s reading a schedule the caller does not own', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin can read a schedule owned by someone else', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PUT / DELETE / toggle / trigger
// ---------------------------------------------------------------------------

describe('schedule mutation routes', () => {
  it('updates a schedule', async () => {
    const id = await createScheduleViaApi(ownerToken, { name: 'Before' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: 'After', cronExpression: '30 2 * * *' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('After');
    expect(res.json().data.cronExpression).toBe('30 2 * * *');
  });

  it('400s updating with an invalid body', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { outputFormat: 'NONSENSE' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400s updating to an invalid cron (service validation)', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { cronExpression: 'still not valid' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/cron/i);
  });

  it('403s updating a schedule the caller does not own', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { name: 'Hijack' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('toggles a schedule active/inactive', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const off = await app.inject({
      method: 'POST',
      url: `/api/schedules/${id}/toggle`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    expect(off.statusCode).toBe(200);
    expect(off.json().data.isActive).toBe(false);
    // A disabled schedule reports no next run.
    expect(off.json().data.nextRunAt).toBeNull();
  });

  it('400s toggling with an invalid body', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/schedules/${id}/toggle`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('triggers a run now (202)', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/schedules/${id}/trigger`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().data.queued).toBe(true);
  });

  it('409s triggering a disabled schedule', async () => {
    const id = await createScheduleViaApi(ownerToken);
    await app.inject({
      method: 'POST',
      url: `/api/schedules/${id}/toggle`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/schedules/${id}/trigger`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('deletes a schedule', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/schedules/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
    createdScheduleIds.delete(id);
  });
});

// ---------------------------------------------------------------------------
// History + result download
// ---------------------------------------------------------------------------

describe('schedule history + result download', () => {
  it('returns execution history (empty by default)', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}/history?limit=5`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it('downloads a successful result file', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const tmpFile = path.join(os.tmpdir(), `sched-result-${id}.csv`);
    fs.writeFileSync(tmpFile, 'a,b\n1,2\n');
    const [result] = await db
      .insert(scheduledResults)
      .values({
        scheduleId: id,
        rowCount: 1,
        filePath: tmpFile,
        executionTimeMs: 12,
        status: 'SUCCESS',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}/results/${result!.id}/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.body).toContain('a,b');
    fs.unlinkSync(tmpFile);
  });

  it('404s downloading a result whose file no longer exists', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const [result] = await db
      .insert(scheduledResults)
      .values({
        scheduleId: id,
        rowCount: 1,
        filePath: path.join(os.tmpdir(), `missing-${id}.csv`),
        executionTimeMs: 12,
        status: 'SUCCESS',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}/results/${result!.id}/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('404s downloading an unknown result', async () => {
    const id = await createScheduleViaApi(ownerToken);
    const res = await app.inject({
      method: 'GET',
      url: `/api/schedules/${id}/results/00000000-0000-4000-8000-000000000000/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
