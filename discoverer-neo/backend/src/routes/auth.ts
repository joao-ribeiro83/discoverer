import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { config } from '../config.js';
import { getSessionUser } from '../services/user.service.js';
import { log as writeAuditEntry } from '../services/audit.service.js';

// ---------------------------------------------------------------------------
// Refresh sessions
//
// A refresh token is `<sid>.<secret>`, separate from the access token. Redis
// holds `auth:session:<sid>` = `<userId>:<sha256(secret)>`, expiring
// REFRESH_TOKEN_TTL_SECONDS after login. Each refresh swaps in a new secret
// and keeps the key's TTL: the token rotates, the session never outlives its
// login. Logout, or refreshing a deprovisioned account, deletes the key.
// ---------------------------------------------------------------------------

const sessionKey = (sid: string) => `auth:session:${sid}`;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newSecret = () => randomBytes(32).toString('base64url');

// Compare-and-swap, so two refreshes racing with one token cannot both win.
const ROTATE_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL') end return nil";

async function openSession(fastify: FastifyInstance, userId: string) {
  const sid = randomUUID();
  const secret = newSecret();
  await fastify.redis.set(
    sessionKey(sid),
    `${userId}:${sha256(secret)}`,
    'EX',
    config.REFRESH_TOKEN_TTL_SECONDS,
  );
  return { sid, refreshToken: `${sid}.${secret}` };
}

// ---------------------------------------------------------------------------
// Login throttling (SEC-05)
//
// Failed logins are counted per IP and per account in fixed windows. Per-IP
// alone is beaten by rotating addresses; per-account alone lets anyone lock a
// known user out. So:
//   - only failures count, so an office behind one NAT is not throttled by
//     its own good logins;
//   - an account lock is temporary, is set NX (failing while locked never
//     extends it), and is audited;
//   - an address that logged in to the account successfully in the last 30
//     days is not held by the account lock — the attacker cannot keep the
//     real user out — though it is still held by the per-IP limit.
// Account keys hold sha256(email), never the address, so Redis and logs carry
// nothing a guesser typed.
// ---------------------------------------------------------------------------

const KNOWN_ADDRESS_SECONDS = 30 * 24 * 60 * 60;
const throttleKeys = (ip: string, email: string) => {
  const account = sha256(email.trim().toLowerCase());
  return {
    ipFailures: `auth:login:fail:ip:${ip}`,
    accountFailures: `auth:login:fail:acct:${account}`,
    lock: `auth:login:lock:${account}`,
    knownAddress: `auth:login:known:${account}:${ip}`,
  };
};
type ThrottleKeys = ReturnType<typeof throttleKeys>;

/** Seconds the caller must wait, or 0 when the attempt may proceed. */
async function loginBlockedFor(fastify: FastifyInstance, keys: ThrottleKeys): Promise<number> {
  const [ipFailures, lockTtl, known] = await Promise.all([
    fastify.redis.get(keys.ipFailures),
    fastify.redis.ttl(keys.lock),
    fastify.redis.exists(keys.knownAddress),
  ]);
  if (Number(ipFailures) >= config.LOGIN_MAX_FAILURES_PER_IP) {
    return Math.max(1, await fastify.redis.ttl(keys.ipFailures));
  }
  return lockTtl > 0 && !known ? lockTtl : 0;
}

async function recordLoginFailure(
  fastify: FastifyInstance,
  keys: ThrottleKeys,
  ip: string,
  userId: string | null,
) {
  const window = config.LOGIN_RATE_LIMIT_WINDOW_SECONDS;
  const results = await fastify.redis
    .multi()
    .incr(keys.ipFailures)
    .expire(keys.ipFailures, window, 'NX')
    .incr(keys.accountFailures)
    .expire(keys.accountFailures, window, 'NX')
    .exec();
  const failures = Number(results?.[2]?.[1] ?? 0);
  if (failures < config.LOGIN_LOCKOUT_THRESHOLD) return;

  const locked = await fastify.redis.set(keys.lock, '1', 'EX', config.LOGIN_LOCKOUT_SECONDS, 'NX');
  await fastify.redis.del(keys.accountFailures);
  if (locked !== 'OK') return;

  // No email, no password: the user id (when the account exists) and the IP.
  fastify.log.warn({ userId, ip, failures }, 'login lockout');
  await writeAuditEntry({
    userId,
    action: 'auth.lockout',
    entityType: 'auth',
    entityId: userId,
    details: { failures, lockoutSeconds: config.LOGIN_LOCKOUT_SECONDS },
    ipAddress: ip,
  });
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

/** Floor for a user-chosen password. Temporary ones are longer still. */
const MIN_PASSWORD_LENGTH = 12;

const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(1024),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export default function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  refreshToken: { type: 'string' },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                      locale: { type: 'string' },
                      theme: { type: 'string' },
                      colorPalette: { type: 'string' },
                      mustChangePassword: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          429: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = LoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      const { email, password } = parsed.data;
      const ip = request.ip;
      const keys = throttleKeys(ip, email);

      // Checked before the database and bcrypt, so a throttled guesser costs
      // almost nothing.
      const waitSeconds = await loginBlockedFor(fastify, keys);
      if (waitSeconds > 0) {
        return reply
          .code(429)
          .header('Retry-After', String(waitSeconds))
          .send({ error: 'Too many login attempts. Try again later.' });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        await recordLoginFailure(fastify, keys, ip, null);
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      // Status is checked after the hash compare, so a deactivated account
      // cannot be told apart from a wrong password by timing.
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid || !user.isActive || user.isRole) {
        await recordLoginFailure(fastify, keys, ip, user.id);
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      await fastify.redis
        .multi()
        .del(keys.accountFailures)
        .set(keys.knownAddress, '1', 'EX', KNOWN_ADDRESS_SECONDS)
        .exec();

      const { sid, refreshToken } = await openSession(fastify, user.id);
      const token = await reply.jwtSign(
        { sub: user.id, email: user.email, role: user.role, name: user.name, sid },
        { expiresIn: config.JWT_EXPIRES_IN },
      );

      return reply.code(200).send({
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            locale: user.locale,
            theme: user.theme,
            colorPalette: user.colorPalette,
            // The client uses this to route straight to the change screen.
            // It is not the control — the auth guard is — but it saves the
            // user a pointless 403 on their first request.
            mustChangePassword: user.mustChangePassword,
          },
        },
      });
    },
  );

  // POST /api/auth/refresh
  fastify.post(
    '/api/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 1, maxLength: 1024 },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = RefreshBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      // One answer for every failure: unknown, spent, revoked, expired, or a
      // deprovisioned account. The caller learns nothing about which.
      const invalid = () => reply.code(401).send({ error: 'Invalid refresh token' });

      // No `authenticate` preHandler: an access token is not accepted here at
      // all, expired or not — a blacklisted one simply finds no session.
      const { refreshToken } = parsed.data;
      const dot = refreshToken.indexOf('.');
      if (dot <= 0) return invalid();
      const sid = refreshToken.slice(0, dot);
      const key = sessionKey(sid);

      const stored = await fastify.redis.get(key);
      const [userId, hash] = stored?.split(':') ?? [];
      if (!stored || !userId || hash !== sha256(refreshToken.slice(dot + 1))) {
        return invalid();
      }

      // Role and status are re-read every time, never copied from a token.
      const account = await getSessionUser(userId);
      if (!account) {
        await fastify.redis.del(key);
        return invalid();
      }

      const secret = newSecret();
      const swapped = await fastify.redis.eval(
        ROTATE_SCRIPT,
        1,
        key,
        stored,
        `${userId}:${sha256(secret)}`,
      );
      if (swapped === null) return invalid();

      const token = await reply.jwtSign(
        { sub: account.id, email: account.email, role: account.role, name: account.name, sid },
        { expiresIn: config.JWT_EXPIRES_IN },
      );

      return reply.code(200).send({
        data: { token, refreshToken: `${sid}.${secret}` },
      });
    },
  );

  // POST /api/auth/logout
  fastify.post(
    '/api/auth/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = request.user;
      const token = request.headers.authorization?.replace('Bearer ', '');

      if (token) {
        // Add token to blacklist in Redis with TTL matching token expiry
        const decoded = fastify.jwt.decode<{ exp?: number }>(token);
        const ttl = decoded?.exp
          ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
          : 86400;

        await fastify.redis.setex(
          `token:blacklist:${token}`,
          ttl,
          user?.sub ?? 'unknown',
        );
      }

      // End the session too, or its refresh token would mint new access tokens.
      if (user?.sid) await fastify.redis.del(sessionKey(user.sid));

      return reply.code(200).send({
        data: { message: 'Logged out successfully' },
      });
    },
  );

  // GET /api/auth/me
  fastify.get(
    '/api/auth/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  locale: { type: 'string' },
                  theme: { type: 'string' },
                  colorPalette: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user;

      // locale/theme/colorPalette can change after the JWT was issued, so
      // read them fresh rather than trusting the token payload.
      const [row] = await db
        .select({
          locale: users.locale,
          theme: users.theme,
          colorPalette: users.colorPalette,
          mustChangePassword: users.mustChangePassword,
        })
        .from(users)
        .where(eq(users.id, user.sub))
        .limit(1);

      return reply.code(200).send({
        data: {
          id: user.sub,
          email: user.email,
          name: user.name,
          role: user.role,
          locale: row?.locale ?? 'en',
          theme: row?.theme ?? 'light',
          colorPalette: row?.colorPalette ?? 'navy',
          mustChangePassword: row?.mustChangePassword ?? false,
        },
      });
    },
  );

  // POST /api/auth/change-password
  //
  // Reachable while `must_change_password` is set — it is one of the few
  // routes the auth guard exempts, precisely so a provisioned account can get
  // itself into a usable state and nothing more.
  fastify.post(
    '/api/auth/change-password',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: MIN_PASSWORD_LENGTH },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = ChangePasswordBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }
      const { currentPassword, newPassword } = parsed.data;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.user.sub))
        .limit(1);
      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Re-verify the current password even though the caller holds a valid
      // token: it stops a borrowed or stolen session from silently taking
      // ownership of the account by rotating the credential.
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: 'Current password is incorrect' });
      }

      if (newPassword === currentPassword) {
        return reply.code(400).send({
          error: 'The new password must be different from the current one',
        });
      }

      await db
        .update(users)
        .set({
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // The existing token stays valid: it never encoded the flag, and the
      // guard re-reads it from the database on the next request.
      return reply.code(200).send({
        data: { message: 'Password changed' },
      });
    },
  );
}
