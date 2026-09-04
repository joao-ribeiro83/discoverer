import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { create, update, getById, getByEmail, list, remove, search } from '../services/user.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const RoleEnum = z.enum(['ADMIN', 'MANAGER', 'USER', 'VIEWER']);

const CreateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: RoleEnum.optional(),
});

const UpdateBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().min(1).max(255).optional(),
  role: RoleEnum.optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: {},
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function userRoutes(fastify: FastifyInstance) {
  // All user-management endpoints are admin-only.
  const adminPreHandler = [fastify.authenticate, fastify.authorizeAdmin];

  // GET /api/users/search?q= — any authenticated user may search for a
  // teammate to share a map with. Deliberately NOT admin-gated (unlike every
  // other route below) and returns only {id, name, email}.
  fastify.get(
    '/api/users/search',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: { q: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
            },
          },
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      const results = await search(q ?? '', request.user.sub);
      return reply.code(200).send({ data: results });
    },
  );

  // GET /api/users — list all
  fastify.get(
    '/api/users',
    {
      preHandler: adminPreHandler,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'array', items: userSchema } },
          },
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (_request, reply) => {
      const rows = await list();
      return reply.code(200).send({ data: rows });
    },
  );

  // GET /api/users/:id — get one
  fastify.get(
    '/api/users/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: { type: 'object', properties: { data: userSchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid user ID format' });
      }

      const user = await getById(parsed.data.id);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.code(200).send({ data: user });
    },
  );

  // POST /api/users — create
  fastify.post(
    '/api/users',
    {
      preHandler: adminPreHandler,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] },
          },
        },
        response: {
          201: { type: 'object', properties: { data: userSchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = CreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }

      const existing = await getByEmail(parsed.data.email);
      if (existing) {
        return reply.code(409).send({ error: `A user with email "${parsed.data.email}" already exists` });
      }

      const user = await create(parsed.data);
      return reply.code(201).send({ data: user });
    },
  );

  // PUT /api/users/:id — update
  fastify.put(
    '/api/users/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] },
          },
        },
        response: {
          200: { type: 'object', properties: { data: userSchema } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid user ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      if (bodyParsed.data.email) {
        const existing = await getByEmail(bodyParsed.data.email);
        if (existing && existing.id !== paramParsed.data.id) {
          return reply.code(409).send({ error: `A user with email "${bodyParsed.data.email}" already exists` });
        }
      }

      const user = await update(paramParsed.data.id, bodyParsed.data);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.code(200).send({ data: user });
    },
  );

  // DELETE /api/users/:id — hard delete
  fastify.delete(
    '/api/users/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'object', properties: { message: { type: 'string' } } } },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid user ID format' });
      }

      if (request.user.sub === parsed.data.id) {
        return reply.code(400).send({ error: 'You cannot delete your own account' });
      }

      const deleted = await remove(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return reply.code(200).send({ data: { message: 'User deleted' } });
    },
  );
}
