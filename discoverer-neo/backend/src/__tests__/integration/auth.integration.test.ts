import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createTestUser,
  loginAndGetToken,
  cleanupIntegrationUsers,
} from './test-helper.js';

let app: FastifyInstance;

const USER_EMAIL = `int-auth-user@test.com`;
const USER_PASSWORD = 'UserPass123!';

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('returns 200 with token and user on valid credentials', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: USER_EMAIL, password: USER_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe(USER_EMAIL);
    expect(body.data.user.role).toBe('USER');
  });

  it('returns 401 on invalid password', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: USER_EMAIL, password: 'wrong' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Invalid email or password');
  });

  it('returns 401 on non-existent user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'noone@test.com', password: 'any' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/auth/refresh', () => {
  it('returns a new valid token on refresh', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');
    const token = await loginAndGetToken(app, USER_EMAIL, USER_PASSWORD);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { token },
    });

    expect(res.statusCode).toBe(200);
    const newToken = res.json().data.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(token);

    // Verify the new token works
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${newToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.email).toBe(USER_EMAIL);
  });

  it('returns 401 with invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { token: 'invalid-token' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout', () => {
  it('blacklists the token so it can no longer be used', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');
    const token = await loginAndGetToken(app, USER_EMAIL, USER_PASSWORD);

    // Token works before logout
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

    // Token revoked
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meAfter.statusCode).toBe(401);
    expect(meAfter.json().error).toBe('Token has been revoked');
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');
    const token = await loginAndGetToken(app, USER_EMAIL, USER_PASSWORD);

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.email).toBe(USER_EMAIL);
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Full auth flow (login → me → refresh → me → logout → me 401)
// ---------------------------------------------------------------------------

describe('Full auth flow', () => {
  it('login → me → refresh → me → logout → me(401)', async () => {
    await createTestUser(USER_EMAIL, USER_PASSWORD, 'USER');

    // 1. Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: USER_EMAIL, password: USER_PASSWORD },
    });
    expect(loginRes.statusCode).toBe(200);
    const token1 = loginRes.json().data.token;

    // 2. Me works
    const me1 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(me1.statusCode).toBe(200);

    // 3. Refresh
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { token: token1 },
    });
    expect(refreshRes.statusCode).toBe(200);
    const token2 = refreshRes.json().data.token;

    // 4. Me works with new token
    const me2 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(me2.statusCode).toBe(200);

    // 5. Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(logoutRes.statusCode).toBe(200);

    // 6. Me fails
    const me3 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(me3.statusCode).toBe(401);
  });
});
