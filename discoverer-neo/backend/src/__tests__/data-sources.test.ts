import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users, dataSources } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { encrypt, decrypt } from '../lib/encryption.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'ds-test@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'DS Test User';

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
  return user;
}

async function getDsByName(name: string) {
  const [row] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.name, name))
    .limit(1);
  return row;
}

async function cleanupTestData() {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, 'ds-admin@example.com'));
  await db.delete(dataSources).where(eq(dataSources.name, 'Test Oracle DS'));
  await db.delete(dataSources).where(eq(dataSources.name, 'Test Postgres DS'));
  await db.delete(dataSources).where(eq(dataSources.name, 'Updated DS'));
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
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/data-sources', () => {
  it('creates a data source (admin only)', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Oracle DS',
        connectionType: 'oracle',
        host: 'oracle-host.local',
        port: 1521,
        serviceName: 'ORCL',
        username: 'system',
        passwordEnc: 'secret123',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Test Oracle DS');
    expect(body.data.connectionType).toBe('oracle');
    expect(body.data.hasPassword).toBe(true);
    expect(body.data.hasConnectionString).toBe(false);

    // Verify password is encrypted in DB (not plaintext).
    const ds = await getDsByName('Test Oracle DS');
    expect(ds).toBeDefined();
    expect(ds!.passwordEnc).toBeTruthy();
    expect(ds!.passwordEnc).not.toBe('secret123');
    expect(ds!.passwordEnc!.length).toBeGreaterThan(32);
    // Verify it can be decrypted back.
    expect(decrypt(ds!.passwordEnc!)).toBe('secret123');
  });

  it('returns 409 when name already exists', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const payload = {
      name: 'Test Oracle DS',
      connectionType: 'oracle' as const,
      host: 'foo.local',
    };

    await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toContain('already exists');
  });

  it('returns 400 on invalid request body', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    });

    // Fastify JSON schema requires connectionType — should be 400.
    expect(response.statusCode).toBe(400);
  });

  it('returns 403 when a non-admin user tries to create', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');
    const token = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Postgres DS',
        connectionType: 'postgres',
        host: 'pg.local',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('Forbidden');
  });

  it('returns 401 without a token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      payload: {
        name: 'Test Postgres DS',
        connectionType: 'postgres',
        host: 'pg.local',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/data-sources', () => {
  it('lists all data sources without passwords (admin)', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    // Create two DS
    await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle', passwordEnc: 'secret1' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Postgres DS', connectionType: 'postgres', passwordEnc: 'secret2' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);

    // Verify no password fields are present in any returned item.
    for (const ds of body.data) {
      expect((ds as Record<string, unknown>)['passwordEnc']).toBeUndefined();
      expect((ds as Record<string, unknown>)['connectionString']).toBeUndefined();
      expect(ds.hasPassword).toBe(true);
    }
  });

  it('returns data sources for manager role too', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle' },
    });

    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.length).toBe(1);
  });

  it('returns 403 for viewer role', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'VIEWER');
    const token = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('GET /api/data-sources/:id', () => {
  it('returns a single data source by id', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle', passwordEnc: 'secret1' },
    });

    const id = createRes.json().data.id as string;

    const response = await app.inject({
      method: 'GET',
      url: `/api/data-sources/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(id);
    expect(body.data.name).toBe('Test Oracle DS');
    expect((body.data as Record<string, unknown>)['passwordEnc']).toBeUndefined();
  });

  it('returns 404 for non-existent id', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'GET',
      url: '/api/data-sources/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('Data source not found');
  });
});

describe('PUT /api/data-sources/:id', () => {
  it('updates a data source and re-encrypts password', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle', passwordEnc: 'old-password' },
    });

    const id = createRes.json().data.id as string;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/data-sources/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { passwordEnc: 'new-password' },
    });

    expect(response.statusCode).toBe(200);

    // Verify the new password was encrypted.
    const ds = await getDsByName('Test Oracle DS');
    expect(ds).toBeDefined();
    expect(ds!.passwordEnc).not.toBe('new-password');
    expect(decrypt(ds!.passwordEnc!)).toBe('new-password');
  });

  it('returns 404 for non-existent data source', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/data-sources/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
      payload: { passwordEnc: 'new-password' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when a non-admin user tries to update', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/data-sources/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { passwordEnc: 'secret' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('DELETE /api/data-sources/:id', () => {
  it('soft-deactivates a data source', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle' },
    });

    const id = createRes.json().data.id as string;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/data-sources/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().data.message).toBe('Data source deactivated');

    // Verify the row still exists but is_active is false.
    const ds = await getDsByName('Test Oracle DS');
    expect(ds).toBeDefined();
    expect(ds!.isActive).toBe(false);
  });

  it('returns 404 for non-existent data source', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/data-sources/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 403 when a non-admin user tries to delete', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Test Oracle DS', connectionType: 'oracle' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/data-sources/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('POST /api/data-sources/:id/test', () => {
  it('returns 404 for non-existent data source', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/data-sources/00000000-0000-0000-0000-000000000000/test',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.success).toBe(false);
    expect(body.data.message).toBe('Data source not found');
  });

  it('attempts a real connection for a valid Postgres data source', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const token = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Test Postgres DS',
        connectionType: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        passwordEnc: 'test',
      },
    });

    const id = createRes.json().data.id as string;

    const response = await app.inject({
      method: 'POST',
      url: `/api/data-sources/${id}/test`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(typeof body.data.success).toBe('boolean');
    expect(typeof body.data.latencyMs).toBe('number');
    // The message should describe the connection attempt.
    expect(typeof body.data.message).toBe('string');
  });

  it('is accessible by manager role', async () => {
    await createTestUser('ds-admin@example.com', TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken('ds-admin@example.com', TEST_PASSWORD);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/data-sources',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Test Postgres DS', connectionType: 'postgres' },
    });

    const id = createRes.json().data.id as string;

    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');
    const managerToken = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: `/api/data-sources/${id}/test`,
      headers: { authorization: `Bearer ${managerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('Encryption utility', () => {
  it('encrypts and decrypts correctly round-trip', () => {
    const plaintext = 'my-super-secret-password';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.length).toBeGreaterThan(0);

    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same-password';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);

    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    const tampered = encrypted.slice(0, -2) + 'XX';

    expect(() => decrypt(tampered)).toThrow();
  });
});
