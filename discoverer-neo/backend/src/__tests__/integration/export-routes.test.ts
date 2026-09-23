/**
 * Export HTTP route tests (`src/routes/export.ts`).
 *
 * Exercises the Fastify handlers against real Postgres (`export_jobs`,
 * `map_runs`) and the real BullMQ export queue (Redis is up). No export
 * worker runs during the test, so a queued job simply stays PENDING — enough
 * to cover creation, the status poll, listing, the not-ready download
 * branch, and the ownership / permission gates. The actual file-producing
 * pipeline is covered by export.test.ts at the service level.
 *
 * Task 4.3: an export is now requested against a completed `map_runs` row,
 * not free-form parameters/calculatedFields — so every POST here first seeds
 * a run via `services/map-run.store.ts` the way the runner would leave one.
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
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import {
  users,
  businessAreas,
  maps,
  exportJobs,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import { closeExportQueue } from '../../queues/export.queue.js';
import { createRun, completeRun } from '../../services/map-run.store.js';

let app: FastifyInstance;

const ADMIN_EMAIL = 'exp-admin@example.com';
const OWNER_EMAIL = 'exp-owner@example.com';
const OTHER_EMAIL = 'exp-other@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken: string;
let ownerToken: string;
let otherToken: string;
let ownerId: string;
let otherId: string;
let baId: string;
let mapId: string;
let otherMapId: string;

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

/** Seeds a `map_runs` row the way the runner would leave one. Defaults to a
 * COMPLETED, unexpired run owned by `ownerId` for `mapId`. */
async function seedRun(
  cfg: {
    mapId: string;
    requestedBy: string;
    status?: 'QUEUED' | 'COMPLETED';
    expiresAt?: Date;
  },
): Promise<string> {
  const run = await createRun({
    mapId: cfg.mapId,
    requestedBy: cfg.requestedBy,
    kind: 'LIVE',
    runKey: `export-route-${Math.random().toString(36).slice(2)}`,
    parameters: {},
    calculatedFields: [],
    expiresAt: cfg.expiresAt ?? new Date(Date.now() + 3_600_000),
  });
  if ((cfg.status ?? 'COMPLETED') === 'COMPLETED') {
    await completeRun(run.id, {
      columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
      decoration: {},
      rowCount: 0,
      truncated: false,
      executionTimeMs: 1,
      sqlText: null,
      expiresAt: cfg.expiresAt ?? new Date(Date.now() + 3_600_000),
    });
  }
  return run.id;
}

/** Shorthand for the common case: the owner's own COMPLETED run on `mapId`. */
async function seedOwnerRun(): Promise<string> {
  return seedRun({ mapId, requestedBy: ownerId });
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
  const other = await createTestUser(OTHER_EMAIL, 'USER');
  ownerId = owner.id;
  otherId = other.id;

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

  const [otherMap] = await db
    .insert(maps)
    .values({
      name: 'Export Map (other)',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  otherMapId = otherMap!.id;

  adminToken = await login(ADMIN_EMAIL);
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
      payload: { format: 'DOCX' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid request body');
  });

  it('400s on a body missing runId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid request body');
  });

  it('409s with RUN_NOT_EXPORTABLE for a run requested by another user', async () => {
    const runId = await seedRun({ mapId, requestedBy: otherId });
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RUN_NOT_EXPORTABLE');
  });

  it('409s with RUN_NOT_EXPORTABLE for a run that belongs to a different map', async () => {
    const runId = await seedRun({ mapId: otherMapId, requestedBy: ownerId });
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RUN_NOT_EXPORTABLE');
  });

  it('409s with RUN_NOT_EXPORTABLE for a QUEUED run', async () => {
    const runId = await seedRun({ mapId, requestedBy: ownerId, status: 'QUEUED' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RUN_NOT_EXPORTABLE');
  });

  it('409s with RUN_NOT_EXPORTABLE for an expired run', async () => {
    const runId = await seedRun({
      mapId,
      requestedBy: ownerId,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('RUN_NOT_EXPORTABLE');
  });

  it('queues an export job (202, PENDING) for a COMPLETED run the caller owns', async () => {
    const runId = await seedOwnerRun();
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().data.status).toBe('PENDING');
    expect(res.json().data.jobId).toBeTruthy();
  });

  it('lets an admin export another user’s run (202)', async () => {
    const runId = await seedRun({ mapId, requestedBy: ownerId });
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { format: 'CSV', runId },
    });
    expect(res.statusCode).toBe(202);
  });
});

describe('GET /api/exports and /api/exports/:jobId', () => {
  it('lists the caller’s export jobs', async () => {
    const runId = await seedOwnerRun();
    await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'XLSX', runId },
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
    // The page names the map from this field; it cannot rely on the caller's
    // own map list, which misses maps shared through a group or an admin's view.
    const mine = (res.json().data as Array<Record<string, unknown>>).find((j) => j['mapId'] === mapId);
    expect(mine?.['mapName']).toBe('Export Map');
    expect(Date.parse(mine?.['createdAt'] as string)).not.toBeNaN();
  });

  it('documents every list field in the OpenAPI spec', () => {
    const spec = app.swagger() as unknown as {
      paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema: { properties: { data: { items: { properties: Record<string, unknown> } } } } }> }> }>>;
    };
    const item = spec.paths['/api/exports']!['get']!.responses['200']!.content!['application/json']!.schema
      .properties.data.items.properties;
    expect(Object.keys(item).sort()).toEqual(
      ['completedAt', 'createdAt', 'errorMessage', 'format', 'jobId', 'mapId', 'mapName', 'progress', 'rowCount', 'status', 'truncated'],
    );
  });

  it('polls a job status', async () => {
    const runId = await seedOwnerRun();
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
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
    const runId = await seedOwnerRun();
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
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
    const runId = await seedOwnerRun();
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { format: 'CSV', runId },
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
