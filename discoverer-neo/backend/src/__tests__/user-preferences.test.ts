import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'prefs-user@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Preferences Test User';

async function createTestUser() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email: TEST_EMAIL, passwordHash, name: TEST_NAME, role: 'USER' })
    .returning();
  return user!;
}

async function cleanupTestData() {
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function loginAndReturnToken(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
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

describe('GET /api/users/me/preferences', () => {
  it('returns default locale/theme/colorPalette for a newly created user', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'en', theme: 'light', colorPalette: 'navy' });
  });

  it('rejects an unauthenticated request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me/preferences',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/users/me/preferences', () => {
  it('updates locale only', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: 'pt-PT' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'pt-PT', theme: 'light', colorPalette: 'navy' });
  });

  it('updates theme only', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { theme: 'dark' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'en', theme: 'dark', colorPalette: 'navy' });
  });

  it('updates colorPalette only', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { colorPalette: 'default' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'en', theme: 'light', colorPalette: 'default' });
  });

  it('updates locale, theme, and colorPalette together', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: 'fr-FR', theme: 'high-contrast', colorPalette: 'default' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'fr-FR', theme: 'high-contrast', colorPalette: 'default' });
  });

  it('rejects an invalid locale', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: 'de-DE' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid theme', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { theme: 'neon' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid colorPalette', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { colorPalette: 'sunset' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty body', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      payload: { locale: 'en' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('persists preferences across requests', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { locale: 'es-ES', theme: 'dark', colorPalette: 'default' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ locale: 'es-ES', theme: 'dark', colorPalette: 'default' });
  });
});

describe('login/me payload', () => {
  it('includes locale, theme, and colorPalette in the login response', async () => {
    await createTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.user).toMatchObject({ locale: 'en', theme: 'light', colorPalette: 'navy' });
  });

  it('includes locale, theme, and colorPalette in the /api/auth/me response', async () => {
    await createTestUser();
    const token = await loginAndReturnToken();

    await app.inject({
      method: 'PATCH',
      url: '/api/users/me/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { theme: 'dark' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ locale: 'en', theme: 'dark', colorPalette: 'navy' });
  });
});
