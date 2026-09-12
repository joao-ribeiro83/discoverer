import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { and, eq, like } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { auditLog, users } from '../../db/schema.js';
import { config } from '../../config.js';
import { createTestUser, getApp } from './test-helper.js';

// Phase 6.1 / SEC-05 — login is rate-limited per IP and per account, with a
// temporary, audited lockout that an attacker cannot use to keep the real
// user out.

const PREFIX = 'login-throttle-';
const PASSWORD = 'ThrottlePass123!';
const DEFAULTS = {
  LOGIN_MAX_FAILURES_PER_IP: config.LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_LOCKOUT_THRESHOLD: config.LOGIN_LOCKOUT_THRESHOLD,
  LOGIN_LOCKOUT_SECONDS: config.LOGIN_LOCKOUT_SECONDS,
};

let app: FastifyInstance;
let seq = 0;
// Documentation range (RFC 5737): never a real client, never 127.0.0.1, so
// these tests and the rest of the suite cannot throttle each other.
const newIp = () => `203.0.113.${(seq++ % 250) + 1}`;
const newEmail = () => `${PREFIX}${Date.now()}-${seq++}@test.com`;

beforeAll(async () => {
  app = await getApp();
});

afterEach(async () => {
  Object.assign(config, DEFAULTS);
  const keys = await app.redis.keys('auth:login:*');
  if (keys.length > 0) await app.redis.del(...keys);
  await db.delete(users).where(like(users.email, `${PREFIX}%`));
});

const login = (email: string, password: string, ip: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
    remoteAddress: ip,
  });

async function fail(email: string, ip: string, times: number) {
  for (let i = 0; i < times; i++) {
    expect((await login(email, 'WrongPassword!', ip)).statusCode).toBe(401);
  }
}

describe('per-account lockout', () => {
  it('locks after N failures, from any new address, and audits the lock', async () => {
    const email = newEmail();
    const user = await createTestUser(email, PASSWORD);

    await fail(email, newIp(), config.LOGIN_LOCKOUT_THRESHOLD);

    // Even the right password, from an address this account never used.
    const res = await login(email, PASSWORD, newIp());
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);

    const events = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, 'auth.lockout'), eq(auditLog.userId, user.id)));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain(email);
  });

  it('expires', async () => {
    config.LOGIN_LOCKOUT_SECONDS = 1;
    const email = newEmail();
    await createTestUser(email, PASSWORD);

    await fail(email, newIp(), config.LOGIN_LOCKOUT_THRESHOLD);
    const ip = newIp();
    expect((await login(email, PASSWORD, ip)).statusCode).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await login(email, PASSWORD, ip)).statusCode).toBe(200);
  });

  it('cannot keep the real user out: an address that logged in before still gets in', async () => {
    const email = newEmail();
    await createTestUser(email, PASSWORD);
    const home = newIp();
    expect((await login(email, PASSWORD, home)).statusCode).toBe(200);

    await fail(email, newIp(), config.LOGIN_LOCKOUT_THRESHOLD);

    expect((await login(email, PASSWORD, newIp())).statusCode).toBe(429);
    expect((await login(email, PASSWORD, home)).statusCode).toBe(200);
  });

  it('does not extend while locked, however long the attacker keeps trying', async () => {
    const email = newEmail();
    await createTestUser(email, PASSWORD);
    await fail(email, newIp(), config.LOGIN_LOCKOUT_THRESHOLD);

    const lockKey = (await app.redis.keys('auth:login:lock:*'))[0]!;
    await app.redis.expire(lockKey, 30);
    for (let i = 0; i < 10; i++) {
      expect((await login(email, 'WrongPassword!', newIp())).statusCode).toBe(429);
    }
    expect(await app.redis.ttl(lockKey)).toBeLessThanOrEqual(30);
  });

  it('a successful login clears the failure count', async () => {
    const email = newEmail();
    await createTestUser(email, PASSWORD);
    const ip = newIp();

    await fail(email, ip, config.LOGIN_LOCKOUT_THRESHOLD - 1);
    expect((await login(email, PASSWORD, ip)).statusCode).toBe(200);
    await fail(email, newIp(), config.LOGIN_LOCKOUT_THRESHOLD - 1);

    expect((await login(email, PASSWORD, newIp())).statusCode).toBe(200);
  });
});

describe('per-IP limit', () => {
  it('throttles one address after N failures across different accounts, and only that address', async () => {
    config.LOGIN_MAX_FAILURES_PER_IP = 3;
    const email = newEmail();
    await createTestUser(email, PASSWORD);
    const attacker = newIp();

    // Different, non-existent accounts: no single account reaches its lock.
    for (let i = 0; i < 3; i++) {
      expect((await login(newEmail(), 'guess', attacker)).statusCode).toBe(401);
    }

    const blocked = await login(email, PASSWORD, attacker);
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await login(email, PASSWORD, newIp())).statusCode).toBe(200);
  });
});

describe('rate-limit state is not a leak', () => {
  it('never stores the email or password in a Redis key or value', async () => {
    const email = newEmail();
    await createTestUser(email, PASSWORD);
    const ip = newIp();
    await fail(email, ip, config.LOGIN_LOCKOUT_THRESHOLD);
    expect((await login(email, PASSWORD, ip)).statusCode).toBe(429);

    const keys = await app.redis.keys('auth:login:*');
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const value = (await app.redis.type(key)) === 'string' ? await app.redis.get(key) : '';
      expect(`${key} ${value}`).not.toContain(email);
      expect(`${key} ${value}`).not.toContain('WrongPassword');
    }
  });
});
