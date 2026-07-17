import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import {
  users,
  businessAreas,
  userBusinessAreaGrants,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'BA Test User';

async function createTestUser(
  email: string,
  password: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: TEST_NAME, role })
    .returning();
  return user!;
}

async function getBaByName(name: string) {
  const [row] = await db
    .select()
    .from(businessAreas)
    .where(eq(businessAreas.name, name))
    .limit(1);
  return row;
}

async function cleanupTestData() {
  // Clean grants first (FK onDelete cascade handles most, but be explicit).
  await db.delete(userBusinessAreaGrants);
  await db.delete(businessAreas);
  await db.delete(users).where(eq(users.email, 'ba-admin@example.com'));
  await db.delete(users).where(eq(users.email, 'ba-user@example.com'));
  await db.delete(users).where(eq(users.email, 'ba-manager@example.com'));
  await db.delete(users).where(eq(users.email, 'ba-viewer@example.com'));
  await db.delete(users).where(eq(users.email, 'ba-other@example.com'));
}

async function loginAndReturnToken(
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return res.json().data.token as string;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

beforeEach(async () => {
  await cleanupTestData();
});

// ---------------------------------------------------------------------------
// Tests: CRUD
// ---------------------------------------------------------------------------

describe('POST /api/business-areas', () => {
  it('creates a business area (admin only)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Finance Reports',
        description: 'Quarterly financial reports',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Finance Reports');
    expect(body.data.description).toBe('Quarterly financial reports');
    expect(body.data.isActive).toBe(true);
    expect(body.data.createdBy).toBeDefined();
  });

  it('returns 400 on invalid request body', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 403 when a non-admin user tries to create', async () => {
    await createTestUser('ba-manager@example.com', TEST_PASSWORD, 'MANAGER');
    const token = await loginAndReturnToken('ba-manager@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Should Fail' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Forbidden');
  });

  it('returns 401 without a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      payload: { name: 'No Auth' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/business-areas', () => {
  it('admin sees all business areas', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    // Create two business areas
    await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Area A' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Area B' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
  });

  it('non-admin sees only granted business areas', async () => {
    const admin = await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    // Create two business areas as admin
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Granted Area' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Private Area' },
    });

    const grantedAreaId = createRes1.json().data.id as string;

    // Create a regular user and grant access to only one area.
    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    const userToken = await loginAndReturnToken('ba-user@example.com', TEST_PASSWORD);

    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${grantedAreaId}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('Granted Area');
  });

  it('user with no grants sees empty list', async () => {
    await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    const token = await loginAndReturnToken('ba-user@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas',
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/business-areas/:id', () => {
  it('returns a single business area with grants (admin)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Area' },
    });

    const id = createRes.json().data.id as string;

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(id);
    expect(body.data.name).toBe('Test Area');
    expect(Array.isArray(body.data.grants)).toBe(true);
    expect(Array.isArray(body.data.permissions)).toBe(true);
  });

  it('returns 404 for non-existent id', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('Business area not found');
  });

  it('returns 400 for invalid UUID', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/business-areas/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('PUT /api/business-areas/:id', () => {
  it('updates a business area (admin)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Original Name', description: 'Original desc' },
    });

    const id = createRes.json().data.id as string;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Updated Name', description: 'Updated desc' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.description).toBe('Updated desc');
  });

  it('allows user with EDIT grant to update', async () => {
    const admin = await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Editable Area' },
    });

    const id = createRes.json().data.id as string;

    // Grant EDIT permission to a regular user.
    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'EDIT' },
    });

    const userToken = await loginAndReturnToken('ba-user@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'User Updated' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('User Updated');
  });

  it('returns 403 for user with only VIEW grant', async () => {
    const admin = await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'No Edit Area' },
    });

    const id = createRes.json().data.id as string;

    // Grant VIEW only.
    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    const userToken = await loginAndReturnToken('ba-user@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Should Fail' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for non-existent business area', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/business-areas/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Ghost' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api/business-areas/:id', () => {
  it('soft-deactivates a business area (admin only)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'To Delete' },
    });

    const id = createRes.json().data.id as string;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().data.message).toBe('Business area deactivated');

    // Verify the row still exists but is_active is false.
    const ba = await getBaByName('To Delete');
    expect(ba).toBeDefined();
    expect(ba!.isActive).toBe(false);
  });

  it('returns 404 for non-existent business area', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/business-areas/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when a non-admin user tries to delete', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Protected Area' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser('ba-manager@example.com', TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken('ba-manager@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: Grants
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:id/grants', () => {
  it('grants access to a user (admin only)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Grant Test Area' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');

    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'EDIT' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.userId).toBe(user.id);
    expect(body.data.permissionLevel).toBe('EDIT');
    expect(body.data.userEmail).toBe('ba-user@example.com');
  });

  it('returns 403 when non-admin tries to grant', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'No Grant Area' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser('ba-manager@example.com', TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken('ba-manager@example.com', TEST_PASSWORD);

    const user = await createTestUser('ba-other@example.com', TEST_PASSWORD, 'USER');

    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for non-existent business area', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');

    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas/00000000-0000-0000-0000-000000000000/grants',
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('upserts (updates) an existing grant', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Upsert Grant Area' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');

    // Grant VIEW first.
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    // Grant EDIT on same user/ba — should not create duplicate.
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'EDIT' },
    });

    // Verify there are exactly 2 grants (VIEW + EDIT).
    const grantsRes = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(grantsRes.statusCode).toBe(200);
    const grants = grantsRes.json().data;
    expect(grants.length).toBe(2);
  });
});

describe('DELETE /api/business-areas/:id/grants/:userId', () => {
  it('revokes all grants for a user on a business area (admin only)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Revoke Test Area' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');

    // Grant two permissions.
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user.id, permissionLevel: 'EDIT' },
    });

    // Revoke all.
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/business-areas/${id}/grants/${user.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.message).toContain('Revoked 2 permission(s)');

    // Verify grants are gone.
    const grantsRes = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(grantsRes.json().data.length).toBe(0);
  });

  it('returns 403 when non-admin tries to revoke', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'No Revoke Area' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    await createTestUser('ba-manager@example.com', TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken('ba-manager@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/business-areas/${id}/grants/${user.id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: Permission enforcement
// ---------------------------------------------------------------------------

describe('Permission enforcement', () => {
  it('user without grant cannot access business area', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Restricted Area' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser('ba-other@example.com', TEST_PASSWORD, 'USER');
    const otherToken = await loginAndReturnToken('ba-other@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Forbidden');
  });

  it('user with VIEW grant can access but not edit', async () => {
    const admin = await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'View Only Area' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-viewer@example.com', TEST_PASSWORD, 'USER');
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'VIEW' },
    });

    const userToken = await loginAndReturnToken('ba-viewer@example.com', TEST_PASSWORD);

    // Can view.
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(getRes.statusCode).toBe(200);

    // Cannot edit.
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Hacked' },
    });
    expect(putRes.statusCode).toBe(403);
  });

  it('admin bypasses all permission checks', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Admin Bypass Area' },
    });

    const id = createRes.json().data.id as string;

    // Admin can view without explicit grant.
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);

    // Admin can edit.
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Admin Updated' },
    });
    expect(putRes.statusCode).toBe(200);

    // Admin can list grants.
    const grantsRes = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(grantsRes.statusCode).toBe(200);
  });

  it('user with EDIT grant cannot delete (admin only)', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Edit No Delete' },
    });

    const id = createRes.json().data.id as string;

    const user = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: user.id, permissionLevel: 'DELETE' },
    });

    const userToken = await loginAndReturnToken('ba-user@example.com', TEST_PASSWORD);

    // DELETE route is admin-only, so even DELETE grant cannot delete.
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/business-areas/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(delRes.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/business-areas/:id/users
// ---------------------------------------------------------------------------

describe('GET /api/business-areas/:id/users', () => {
  it('lists users with their permissions', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Users List Area' },
    });

    const id = createRes.json().data.id as string;

    const user1 = await createTestUser('ba-user@example.com', TEST_PASSWORD, 'USER');
    const user2 = await createTestUser('ba-other@example.com', TEST_PASSWORD, 'USER');

    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user1.id, permissionLevel: 'VIEW' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user1.id, permissionLevel: 'EDIT' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${id}/grants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { userId: user2.id, permissionLevel: 'VIEW' },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}/users`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(2);

    const u1 = body.data.find(
      (u: { userId: string }) => u.userId === user1.id,
    );
    expect(u1).toBeDefined();
    expect(u1.permissions).toContain('VIEW');
    expect(u1.permissions).toContain('EDIT');

    const u2 = body.data.find(
      (u: { userId: string }) => u.userId === user2.id,
    );
    expect(u2).toBeDefined();
    expect(u2.permissions).toEqual(['VIEW']);
  });

  it('returns 403 for user without access', async () => {
    await createTestUser('ba-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ba-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'No Access Users' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser('ba-other@example.com', TEST_PASSWORD, 'USER');
    const otherToken = await loginAndReturnToken('ba-other@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${id}/users`,
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});
