import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import { auditLog, businessAreas, users } from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';

let app: FastifyInstance;

const TEST_PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'audit-admin@example.com';
const VIEWER_EMAIL = 'audit-viewer@example.com';
const BA_NAME = 'Audit Test Business Area';

let adminId: string;
let adminToken: string;
let viewerToken: string;
let createdBaId: string;

async function createTestUser(email: string, name: string, role: 'ADMIN' | 'VIEWER') {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name, role })
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
  await db.delete(businessAreas).where(eq(businessAreas.name, BA_NAME));
  for (const email of [ADMIN_EMAIL, VIEWER_EMAIL]) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      await db.delete(auditLog).where(eq(auditLog.userId, user.id));
    }
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await cleanupTestData();

  const admin = await createTestUser(ADMIN_EMAIL, 'Audit Admin', 'ADMIN');
  await createTestUser(VIEWER_EMAIL, 'Audit Viewer', 'VIEWER');
  adminId = admin.id;

  adminToken = await login(ADMIN_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);

  // A mutating request to generate a real audit entry to query against.
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/business-areas',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: BA_NAME, description: 'created for audit tests' },
  });
  createdBaId = createRes.json().data.id as string;
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

describe('audit plugin — automatic logging', () => {
  it('records an entry for a mutating admin request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/entity/business-areas/${createdBaId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    const entry = data.find((e: { action: string }) => e.action === 'POST /api/business-areas');
    expect(entry).toBeDefined();
    expect(entry.entityType).toBe('business-areas');
    expect(entry.entityId).toBe(createdBaId);
    expect(entry.userId).toBe(adminId);
    expect(entry.userEmail).toBe(ADMIN_EMAIL);
  });

  it('records login as an authentication event, keyed to the logged-in user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/user/${adminId}?limit=50`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    const entry = data.find((e: { action: string }) => e.action === 'POST /api/auth/login');
    expect(entry).toBeDefined();
    expect(entry.userId).toBe(adminId);
  });

  it('redacts the password field from a logged request body', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/user/${adminId}?limit=50`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { data } = res.json();
    const entry = data.find((e: { action: string }) => e.action === 'POST /api/auth/login');
    expect(entry.details.body.password).toBe('[REDACTED]');
    expect(JSON.stringify(entry.details)).not.toContain(TEST_PASSWORD);
  });

  it('does not log a pure read (GET) request', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/user/${adminId}?limit=200`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { data } = res.json();
    expect(data.some((e: { action: string }) => e.action.startsWith('GET '))).toBe(false);
  });
});

describe('GET /api/audit', () => {
  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('requires the ADMIN role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('filters by entityType and reports a total', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit?entityType=business-areas&userId=${adminId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.every((e: { entityType: string }) => e.entityType === 'business-areas')).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('rejects an invalid filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit?userId=not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/audit/stats', () => {
  it('aggregates totals, per-day, per-user, and per-action counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit/stats',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.totalActions).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.byDay)).toBe(true);
    expect(Array.isArray(data.byUser)).toBe(true);
    expect(Array.isArray(data.byActionType)).toBe(true);
    expect(
      data.byActionType.some((a: { action: string }) => a.action === 'POST /api/business-areas'),
    ).toBe(true);
  });
});

describe('GET /api/audit/entity/:type/:id', () => {
  it('returns full history for one entity, newest first', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${createdBaId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { description: 'updated for audit tests' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/entity/business-areas/${createdBaId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.length).toBeGreaterThanOrEqual(2);
    const timestamps = data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});

describe('GET /api/audit/user/:id', () => {
  it('rejects a non-uuid id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit/user/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });
});
