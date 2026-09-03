import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { authorize, authorizeAdmin } from '../middleware/authorize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'auth-test@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Auth Test User';

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

async function cleanupTestUsers() {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, 'admin-test@example.com'));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await cleanupTestUsers();
  await app.close();
});

beforeEach(async () => {
  await cleanupTestUsers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('returns 200 with token and user on valid credentials', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.token).toBeDefined();
    expect(typeof body.data.token).toBe('string');
    expect(body.data.user).toEqual({
      id: expect.any(String),
      email: TEST_EMAIL,
      name: TEST_NAME,
      role: 'USER',
      locale: 'en',
      theme: 'light',
      colorPalette: 'navy',
      // Clients branch on this to force the change screen; an ordinary
      // account is false. See docs/migration/user-credentials.md.
      mustChangePassword: false,
    });
  });

  it('returns 401 on invalid password', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: 'WrongPassword!' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('returns 401 on non-existent email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'doesnotexist@example.com', password: 'any' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('returns 400 on invalid request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    const { token } = loginRes.json().data;

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({
      id: expect.any(String),
      email: TEST_EMAIL,
      name: TEST_NAME,
      role: 'USER',
      locale: 'en',
      theme: 'light',
      colorPalette: 'navy',
    });
  });

  it('returns 401 without token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 with invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid-token-here' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('Authorization (role-based access)', () => {
  it('non-admin user cannot access admin-only routes', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'USER');

    // Routes cannot be added to a listening instance, so the temporary
    // admin-only route goes on a fresh app built for this test.
    const testApp = await buildApp();
    try {
      testApp.get(
        '/api/auth/_test/admin-only',
        { preHandler: [testApp.authenticate, authorizeAdmin] },
        async () => ({ data: 'admin-only' }),
      );

      const loginRes = await testApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      const { token } = loginRes.json().data;

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/auth/_test/admin-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: 'Forbidden',
        details: 'Requires one of roles: ADMIN',
      });
    } finally {
      await testApp.close();
    }
  });

  it('admin user can access admin-only routes', async () => {
    await createTestUser('admin-test@example.com', TEST_PASSWORD, 'ADMIN');

    const testApp = await buildApp();
    try {
      testApp.get(
        '/api/auth/_test/admin-access',
        { preHandler: [testApp.authenticate, authorizeAdmin] },
        async () => ({ data: 'admin-content' }),
      );

      const loginRes = await testApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'admin-test@example.com', password: TEST_PASSWORD },
      });
      const { token } = loginRes.json().data;

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/auth/_test/admin-access',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toBe('admin-content');
    } finally {
      await testApp.close();
    }
  });

  it('authorize allows multiple roles', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'MANAGER');

    const testApp = await buildApp();
    try {
      testApp.get(
        '/api/auth/_test/multi-role',
        { preHandler: [testApp.authenticate, authorize('ADMIN', 'MANAGER')] },
        async () => ({ data: 'manager-content' }),
      );

      const loginRes = await testApp.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      const { token } = loginRes.json().data;

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/auth/_test/multi-role',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    } finally {
      await testApp.close();
    }
  });

  it('admin user has ADMIN role', async () => {
    await createTestUser('admin-test@example.com', TEST_PASSWORD, 'ADMIN');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin-test@example.com', password: TEST_PASSWORD },
    });

    const { token, user } = loginRes.json().data;
    expect(user.role).toBe('ADMIN');

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(meRes.json().data.role).toBe('ADMIN');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new valid token', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    const { token } = loginRes.json().data;

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { token },
    });

    expect(refreshRes.statusCode).toBe(200);
    const newToken = refreshRes.json().data.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(token);

    // Verify the new token works
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${newToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.email).toBe(TEST_EMAIL);
  });

  it('returns 401 with invalid token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { token: 'completely-invalid-token' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('invalidates the token so it can no longer be used', async () => {
    await createTestUser(TEST_EMAIL, TEST_PASSWORD);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    const { token } = loginRes.json().data;

    // Verify token works before logout
    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meBefore.statusCode).toBe(200);

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Verify token no longer works
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meAfter.statusCode).toBe(401);
    expect(meAfter.json()).toEqual({ error: 'Token has been revoked' });
  });

  it('returns 401 without token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).toBe(401);
  });
});
