import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, like } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { createTestUser, getApp } from './test-helper.js';

// Phase 6.1 — a session must end when the account behind it changes, and the
// refresh credential must be separate, revocable and single-use.
// SEC-01: refresh ignored the logout blacklist, copied the role from the
// presented token, and let its grace window renew itself forever.
// SEC-12: the access token was its own refresh credential.

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

interface Session {
  token: string;
  refreshToken: string;
}

async function login(email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PASSWORD },
  });
}

async function userWithSession(role: 'ADMIN' | 'USER' = 'USER') {
  const email = `${PREFIX}${Date.now()}-${seq++}@test.com`;
  const user = await createTestUser(email, PASSWORD, role);
  const res = await login(email);
  expect(res.statusCode).toBe(200);
  return { user, email, ...(res.json().data as Session) };
}

const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken } });

const get = (url: string, token: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

const sessionKey = (refreshToken: string) => `auth:session:${refreshToken.split('.')[0]}`;

describe('deprovisioning ends the session', () => {
  it('refuses a user deactivated after the token was issued — on the next request and on refresh', async () => {
    const { user, token, refreshToken } = await userWithSession();
    const admin = await userWithSession('ADMIN');

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
    expect((await refresh(refreshToken)).statusCode).toBe(401);
    expect(await app.redis.exists(sessionKey(refreshToken))).toBe(0);
  });

  it('refuses a deleted user', async () => {
    const { user, token, refreshToken } = await userWithSession();
    await db.delete(users).where(eq(users.id, user.id));

    expect((await refresh(refreshToken)).statusCode).toBe(401);
    expect((await get('/api/auth/me', token)).statusCode).toBe(401);
  });

  it('refreshes a demoted user at the new role, and the old token loses the old role at once', async () => {
    const { user, token, refreshToken } = await userWithSession('ADMIN');
    expect((await get('/api/users', token)).statusCode).toBe(200);

    await db.update(users).set({ role: 'USER' }).where(eq(users.id, user.id));

    expect((await get('/api/users', token)).statusCode).toBe(403);

    const res = await refresh(refreshToken);
    expect(res.statusCode).toBe(200);
    expect(app.jwt.decode<{ role: string }>(res.json().data.token)?.role).toBe('USER');
  });

  it('refuses a deactivated user at login', async () => {
    const { user, email } = await userWithSession();
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const res = await login(email);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid email or password' });
  });
});

describe('refresh tokens are separate, revocable and rotated', () => {
  it('issues a short access token and a separate refresh token', async () => {
    const { token, refreshToken } = await userWithSession();
    const { iat, exp } = app.jwt.decode<{ iat: number; exp: number }>(token)!;

    expect(exp - iat).toBe(15 * 60);
    expect(refreshToken).not.toBe(token);
    expect(await app.redis.ttl(sessionKey(refreshToken))).toBeGreaterThan(7 * 24 * 60 * 60 - 60);
  });

  it('refuses both tokens of a logged-out session', async () => {
    const { token, refreshToken } = await userWithSession();

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);

    expect((await refresh(refreshToken)).statusCode).toBe(401);
    // The blacklisted access token is not a refresh credential either.
    const byAccessToken = await refresh(token);
    expect(byAccessToken.statusCode).toBe(401);
    expect(byAccessToken.json()).toEqual({ error: 'Invalid refresh token' });
  });

  it('refuses a revoked refresh token', async () => {
    const { refreshToken } = await userWithSession();
    await app.redis.del(sessionKey(refreshToken));

    expect((await refresh(refreshToken)).statusCode).toBe(401);
  });

  it('invalidates the previous refresh token on rotation', async () => {
    const { refreshToken: first } = await userWithSession();

    const rotated = await refresh(first);
    expect(rotated.statusCode).toBe(200);
    const second = rotated.json().data.refreshToken as string;
    expect(second).not.toBe(first);

    expect((await refresh(first)).statusCode).toBe(401);
    expect((await refresh(second)).statusCode).toBe(200);
  });

  it('lets only one of two concurrent refreshes spend the same token', async () => {
    const { refreshToken } = await userWithSession();

    const codes = (await Promise.all([refresh(refreshToken), refresh(refreshToken)]))
      .map((r) => r.statusCode)
      .sort();
    expect(codes).toEqual([200, 401]);
  });

  it('keeps the login expiry across rotation, so a session cannot be refreshed forever', async () => {
    const { refreshToken } = await userWithSession();
    const key = sessionKey(refreshToken);
    await app.redis.expire(key, 100);

    const res = await refresh(refreshToken);
    expect(res.statusCode).toBe(200);
    const ttl = await app.redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(100);

    await app.redis.pexpire(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await refresh(res.json().data.refreshToken)).statusCode).toBe(401);
  });

  it('rejects a refresh token with the right session id but the wrong secret', async () => {
    const { refreshToken } = await userWithSession();
    const [sid] = refreshToken.split('.');

    expect((await refresh(`${sid}.forged`)).statusCode).toBe(401);
    expect((await refresh(refreshToken)).statusCode).toBe(200);
  });
});

describe('migrated accounts', () => {
  it('still cannot log in with the !migrat sentinel hash', async () => {
    const email = `${PREFIX}migrated-${Date.now()}@test.com`;
    // The value migrate writes (MIGRATED_USER_PASSWORD_HASH). Not a bcrypt
    // hash, so no password can ever match it.
    await db.insert(users).values({ email, passwordHash: '!migrated-no-login', name: 'Migrated' });

    for (const password of ['!migrated-no-login', PASSWORD]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      expect(res.statusCode).toBe(401);
    }
  });
});
