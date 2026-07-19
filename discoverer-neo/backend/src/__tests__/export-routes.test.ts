/**
 * Export HTTP route tests (`src/routes/export.ts`).
 *
 * Exercises the Fastify handlers against real Postgres (`export_jobs`) and the
 * real BullMQ export queue (Redis is up). No export worker runs during the
 * test, so a queued job simply stays PENDING — enough to cover creation, the
 * status poll, listing, the not-ready download branch, and the ownership /
 * permission gates. The actual file-producing pipeline is covered by
 * export.test.ts at the service level.
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
  maps,
  exportJobs,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { closeExportQueue } from '../queues/export.queue.js';

let app: FastifyInstance;

const ADMIN_EMAIL = 'exp-admin@example.com';
const OWNER_EMAIL = 'exp-owner@example.com';
const OTHER_EMAIL = 'exp-other@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let ownerToken: string;
let otherToken: string;
let ownerId: string;
let baId: string;
let mapId: string;

async function createTestUser(
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Export Test', role })
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
  await db.delete(exportJobs);
  await db.delete(maps);
  await db.delete(businessAreas).where(eq(businessAreas.name, 'Export Test BA'));
  for (const email of [ADMIN_EMAIL, OWNER_EMAIL, OTHER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
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
    .values({ name: 'Export Test BA' })
    .returning();
  baId = ba!.id;

  const [map] = await db
    .insert(maps)
    .values({
      name: 'Export Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  mapId = map!.id;

  ownerToken = await login(OWNER_EMAIL);
  otherToken = await login(OTHER_EMAIL);
});

afterAll(async () => {
  await cleanup();
  await closeExportQueue();
  await app.close();
});

describe('POST /api/maps/:id/export', () => {
  it('401s without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('404s exporting an unknown map', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/maps/00000000-0000-4000-8000-000000000000/export',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('403s exporting a map the caller cannot access', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('400s on an invalid body (bad format)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'PDF' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid request body');
  });

  it('queues an export job (202, PENDING)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        format: 'CSV',
        parameters: { p_region: 'EMEA' },
        calculatedFields: [{ name: 'Double', formula: 'AMOUNT * 2' }],
      },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().data.status).toBe('PENDING');
    expect(res.json().data.jobId).toBeTruthy();
  });
});

describe('GET /api/exports and /api/exports/:jobId', () => {
  it('lists the caller’s export jobs', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'XLSX' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/exports?limit=10',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThan(0);
    // filePath is server-side detail and must not leak.
    for (const job of res.json().data as Array<Record<string, unknown>>) {
      expect(job['filePath']).toBeUndefined();
    }
  });

  it('polls a job status', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV' },
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'GET',
      url: `/api/exports/${jobId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.jobId).toBe(jobId);
  });

  it('404s polling someone else’s job (id is not confirmed)', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV' },
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'GET',
      url: `/api/exports/${jobId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('400s on a non-uuid job id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exports/not-a-uuid',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s on an unknown job id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/exports/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/exports/:jobId/download', () => {
  it('409s downloading a job that is not yet complete', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV' },
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'GET',
      url: `/api/exports/${jobId}/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('streams a completed export file', async () => {
    const tmpFile = path.join(os.tmpdir(), `export-dl-${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, 'x,y\n3,4\n');
    const [job] = await db
      .insert(exportJobs)
      .values({
        mapId,
        requestedBy: ownerId,
        format: 'CSV',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 1,
        filePath: tmpFile,
        completedAt: new Date(),
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/exports/${job!.id}/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.body).toContain('x,y');
    fs.unlinkSync(tmpFile);
  });

  it('404s downloading a completed job whose file has been removed', async () => {
    const [job] = await db
      .insert(exportJobs)
      .values({
        mapId,
        requestedBy: ownerId,
        format: 'CSV',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 1,
        filePath: path.join(os.tmpdir(), `export-gone-${Date.now()}.csv`),
        completedAt: new Date(),
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/exports/${job!.id}/download`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
