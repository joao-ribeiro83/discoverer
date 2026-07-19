import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

let app: FastifyInstance;

const TEST_PASSWORD = 'SecurePass123!';
const SEARCHER_EMAIL = 'users-search-me@example.com';
const MATCH_EMAIL = 'users-search-match@example.com';
const OTHER_EMAIL = 'users-search-noise@example.com';
const ADMIN_EMAIL = 'users-admin@example.com';
// Users created by the admin-CRUD tests, cleaned up alongside the fixtures.
const CREATED_EMAIL = 'users-created@example.com';
const CREATED_EMAIL_2 = 'users-created-2@example.com';

let searcherToken: string;
let adminToken: string;
let adminUserId: string;
let matchUserId: string;

async function createTestUser(
  email: string,
  name: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
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
  for (const email of [
    SEARCHER_EMAIL,
    MATCH_EMAIL,
    OTHER_EMAIL,
    ADMIN_EMAIL,
    CREATED_EMAIL,
    CREATED_EMAIL_2,
  ]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await cleanupTestData();

  await createTestUser(SEARCHER_EMAIL, 'Searching Sam');
  const match = await createTestUser(MATCH_EMAIL, 'Findable Fiona');
  await createTestUser(OTHER_EMAIL, 'Unrelated Una');
  const admin = await createTestUser(ADMIN_EMAIL, 'Admin Ada', 'ADMIN');

  matchUserId = match.id;
  adminUserId = admin.id;
  searcherToken = await login(SEARCHER_EMAIL);
  adminToken = await login(ADMIN_EMAIL);
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

describe('GET /api/users/search', () => {
  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=findable',
    });
    expect(res.statusCode).toBe(401);
  });

  it('is available to a non-admin user (unlike GET /api/users)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=findable',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.some((u: { id: string }) => u.id === matchUserId)).toBe(true);
  });

  it('matches by email substring too', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=search-match',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.some((u: { id: string }) => u.id === matchUserId)).toBe(true);
  });

  it('excludes the requesting user from their own results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=searching',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.every((u: { id: string }) => u.id !== undefined)).toBe(true);
    expect(data.some((u: { email: string }) => u.email === SEARCHER_EMAIL)).toBe(false);
  });

  it('returns only id/name/email, never a password hash or role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=fiona',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    const { data } = res.json();
    const hit = data.find((u: { id: string }) => u.id === matchUserId);
    expect(hit).toBeDefined();
    expect(Object.keys(hit).sort()).toEqual(['email', 'id', 'name']);
  });

  it('returns an empty array for a blank query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Admin user management CRUD
// ---------------------------------------------------------------------------

describe('GET /api/users (admin list)', () => {
  it('403s for a non-admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${searcherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists users for an admin, without password hashes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(Array.isArray(data)).toBe(true);
    for (const u of data as Array<Record<string, unknown>>) {
      expect(u['passwordHash']).toBeUndefined();
    }
  });
});

describe('GET /api/users/:id (admin)', () => {
  it('400s on a malformed id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s for an unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns a single user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/users/${matchUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(matchUserId);
  });
});

describe('POST /api/users (admin create)', () => {
  it('400s on an invalid body (short password)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: CREATED_EMAIL, password: 'short', name: 'New User' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: CREATED_EMAIL,
        password: 'SecurePass123!',
        name: 'New User',
        role: 'MANAGER',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.email).toBe(CREATED_EMAIL);
    expect(res.json().data.role).toBe('MANAGER');
    expect(res.json().data.passwordHash).toBeUndefined();
  });

  it('409s creating a duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: CREATED_EMAIL,
        password: 'SecurePass123!',
        name: 'Dup',
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('PUT /api/users/:id (admin update)', () => {
  let targetId: string;

  it('creates a target to update', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: CREATED_EMAIL_2,
        password: 'SecurePass123!',
        name: 'To Update',
      },
    });
    targetId = res.json().data.id as string;
    expect(targetId).toBeTruthy();
  });

  it('400s on a malformed id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400s on an invalid body', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s updating an unknown user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Ghost' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('409s updating to an email owned by another user', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: CREATED_EMAIL },
    });
    expect(res.statusCode).toBe(409);
  });

  it('updates name, role, and password', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Updated Name', role: 'VIEWER', password: 'NewSecurePass1!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Name');
    expect(res.json().data.role).toBe('VIEWER');
  });
});

describe('DELETE /api/users/:id (admin delete)', () => {
  it('400s on a malformed id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('400s deleting your own account', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${adminUserId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/your own account/i);
  });

  it('404s deleting an unknown user', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a user', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'users-to-delete@example.com',
        password: 'SecurePass123!',
        name: 'Delete Me',
      },
    });
    const id = created.json().data.id as string;
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/users/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('User deleted');
  });
});
