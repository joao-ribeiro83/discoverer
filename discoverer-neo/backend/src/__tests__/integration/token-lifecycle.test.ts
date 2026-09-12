import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, like } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { createTestUser, getApp, loginAndGetToken } from './test-helper.js';

// Phase 6.1 — a session must end when the account behind it changes.
// SEC-01: refresh ignored the logout blacklist, copied the role from the
// presented token, and let its 7-day grace window renew itself forever.

const PREFIX = 'token-lifecycle-';
const PASSWORD = 'LifecyclePass123!';

let app: FastifyInstance;
let seq = 0;

beforeAll(async () => {
  app = await getApp();
});

afterEach(async () => {
  await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

async function userWithToken(role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${PREFIX}${Date.now()}-${seq++}@test.com`;
  const user = await createTestUser(email, PASSWORD, role);
  return { user, email, token: await loginAndGetToken(app, email, PASSWORD) };
}

const refresh = (token: string) =>
  app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { token } });

const get = (url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

describe('refresh reads the account, not the token', () => {
  it('refuses a user deactivated after the token was issued — and so does every other route', async () => {
    const { user, token } = await userWithToken();
    const admin = await userWithToken('ADMIN');

    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${user.id}`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.isActive).toBe(false);

    // Effective session lifetime after deprovisioning: zero. The very next
    // request is refused, not the one after the token expires.
    expect((await get('/api/auth/me', token)).statusCode).toBe(401);
    expect((await refresh(token)).statusCode).toBe(401);
  });

  it('refuses a deleted user', async () => {
    const { user, token } = await userWithToken();
    await db.delete(users).where(eq(users.id, user.id));

    expect((await refresh(token)).statusCode).toBe(401);
    expect((await get('/api/auth/me', token)).statusCode).toBe(401);
  });

  it('refreshes a demoted user at the new role, and the old token loses the old role at once', async () => {
    const { user, token } = await userWithToken('ADMIN');
    expect((await get('/api/users', token)).statusCode).toBe(200);

    await db.update(users).set({ role: 'USER' }).where(eq(users.id, user.id));

    expect((await get('/api/users', token)).statusCode).toBe(403);

    const res = await refresh(token);
    expect(res.statusCode).toBe(200);
    expect(app.jwt.decode<{ role: string }>(res.json().data.token)?.role).toBe('USER');
  });

  it('refuses a deactivated user at login', async () => {
    const { user, email } = await userWithToken();
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid email or password' });
  });
});

describe('refresh honours revocation', () => {
  it('rejects a token blacklisted by logout', async () => {
    const { token } = await userWithToken();

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);

    const res = await refresh(token);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Token has been revoked' });
  });

  it('cannot be refreshed indefinitely past its original issue', async () => {
    const { user } = await userWithToken();
    const now = Math.floor(Date.now() / 1000);
    // A token refreshed weekly: its own exp is fresh, its login was 15 days ago.
    const token = app.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      oiat: now - 15 * 24 * 60 * 60,
    });

    const res = await refresh(token);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Session expired' });
  });

  it('carries the original issue time forward instead of renewing it', async () => {
    const { token } = await userWithToken();
    const original = app.jwt.decode<{ iat: number }>(token)!.iat;

    const res = await refresh(token);
    expect(res.statusCode).toBe(200);
    expect(app.jwt.decode<{ oiat: number }>(res.json().data.token)?.oiat).toBe(original);
  });
});

describe('migrated accounts', () => {
  it('still cannot log in with the !migrat sentinel hash', async () => {
    const email = `${PREFIX}migrated-${Date.now()}@test.com`;
    // The value migrate writes (MIGRATED_USER_PASSWORD_HASH). Not a bcrypt
    // hash, so no password can ever match it.
    await db.insert(users).values({
      email,
      passwordHash: '!migrated-no-login',
      name: 'Migrated',
    });

    for (const password of ['!migrated-no-login', '', 'anything']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: password || 'x' },
      });
      expect(res.statusCode).toBe(401);
    }
  });
});
