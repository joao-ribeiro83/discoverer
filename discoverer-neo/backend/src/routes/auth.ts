import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { verifyPassword } from '../lib/password.js';
import { config } from '../config.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshBodySchema = z.object({
  token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export default async function authRoutes(fastify: FastifyInstance) {
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
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

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const token = await reply.jwtSign(
        { sub: user.id, email: user.email, role: user.role, name: user.name },
        { expiresIn: config.JWT_EXPIRES_IN },
      );

      return reply.code(200).send({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
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
          required: ['token'],
          properties: {
            token: { type: 'string', minLength: 1 },
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

      const { token } = parsed.data;

      // Verify the token, ignoring expiration to allow refresh of expired
      // tokens within a 7-day window.
      let payload: { sub: string; email: string; role: string; exp?: number };
      try {
        payload = fastify.jwt.verify<{
          sub: string;
          email: string;
          role: string;
          exp?: number;
        }>(token, { ignoreExpiration: true });
      } catch {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      // Reject tokens expired more than 7 days ago
      if (typeof payload.exp !== 'number') {
        return reply.code(401).send({ error: 'Invalid token' });
      }

      const now = Math.floor(Date.now() / 1000);
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;

      if (payload.exp + sevenDaysInSeconds < now) {
        return reply.code(401).send({ error: 'Token expired' });
      }

      const newToken = await reply.jwtSign(
        { sub: payload.sub, email: payload.email, role: payload.role },
        { expiresIn: config.JWT_EXPIRES_IN },
      );

      return reply.code(200).send({
        data: {
          token: newToken,
        },
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

      return reply.code(200).send({
        data: {
          id: user.sub,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    },
  );
}
