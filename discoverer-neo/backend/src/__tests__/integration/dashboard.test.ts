import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import { users, maps, queryExecutionLog, schedules, scheduledResults } from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';

let app: FastifyInstance;

const OWNER_EMAIL = 'dashboard-owner@example.com';
const OUTSIDER_EMAIL = 'dashboard-outsider@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let ownerToken: string;
let outsiderToken: string;

async function createTestUser(email: string) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Dashboard Test User', role: 'USER' })
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

async function cleanupTestData() {
  await db.delete(scheduledResults);
  await db.delete(schedules);
  await db.delete(queryExecutionLog);
  await db.delete(maps);
  for (const email of [OWNER_EMAIL, OUTSIDER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanupTestData();

  const owner = await createTestUser(OWNER_EMAIL);
  const outsider = await createTestUser(OUTSIDER_EMAIL);

  const [ownerMap] = await db
    .insert(maps)
    .values({ name: 'Owner Map', mapType: 'TABLE', createdBy: owner.id })
    .returning();
  const [outsiderMap] = await db
    .insert(maps)
    .values({ name: 'Outsider Map', mapType: 'TABLE', createdBy: outsider.id })
    .returning();

  // Two executions on the owner's own map, one on a map only the outsider can see.
  await db.insert(queryExecutionLog).values([
    { mapId: ownerMap!.id, executedBy: owner.id, status: 'SUCCESS' },
    { mapId: ownerMap!.id, executedBy: owner.id, status: 'SUCCESS' },
    { mapId: outsiderMap!.id, executedBy: outsider.id, status: 'SUCCESS' },
  ]);

  const [schedule] = await db
    .insert(schedules)
    .values({
      mapId: ownerMap!.id,
      name: 'Nightly',
      cronExpression: '0 0 * * *',
      outputFormat: 'CSV',
      isActive: true,
      createdBy: owner.id,
    })
    .returning();

  await db.insert(scheduledResults).values({ scheduleId: schedule!.id, rowCount: 10, status: 'SUCCESS' });

  ownerToken = await login(OWNER_EMAIL);
  outsiderToken = await login(OUTSIDER_EMAIL);
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

describe('GET /api/dashboard/stats', () => {
  it("counts only the caller's own maps, schedules and results", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/stats',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ totalExecutions: 2, scheduledMaps: 1, scheduledResults: 1 });
  });

  it("never counts another user's executions, schedules or results", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/stats',
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ totalExecutions: 1, scheduledMaps: 0, scheduledResults: 0 });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' });
    expect(res.statusCode).toBe(401);
  });
});
