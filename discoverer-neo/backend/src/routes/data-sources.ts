import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  list,
  softDelete,
  testConnection,
} from '../services/data-source.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  connectionType: z.enum(['oracle', 'postgres']),
  host: z.string().max(255).optional(),
  port: z.number().int().positive().optional(),
  serviceName: z.string().max(255).optional(),
  sid: z.string().max(64).optional(),
  username: z.string().max(255).optional(),
  passwordEnc: z.string().min(1).optional(),
  connectionString: z.string().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  connectionType: z.enum(['oracle', 'postgres']).optional(),
  host: z.string().max(255).optional(),
  port: z.number().int().positive().optional(),
  serviceName: z.string().max(255).optional(),
  sid: z.string().max(64).optional(),
  username: z.string().max(255).optional(),
  passwordEnc: z.string().min(1).nullable().optional(),
  connectionString: z.string().nullable().optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const safeDataSourceSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    connectionType: { type: 'string', enum: ['oracle', 'postgres'] },
    host: { type: ['string', 'null'] },
    port: { type: ['integer', 'null'] },
    serviceName: { type: ['string', 'null'] },
    sid: { type: ['string', 'null'] },
    username: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    hasPassword: { type: 'boolean' },
    hasConnectionString: { type: 'boolean' },
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function dataSourcesRoutes(fastify: FastifyInstance) {
  // GET /api/data-sources — list all (admin + manager)
  fastify.get(
    '/api/data-sources',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Data Sources'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: safeDataSourceSchema },
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const sources = await list();
      return reply.code(200).send({ data: sources });
    },
  );

  // GET /api/data-sources/:id — get one (admin + manager)
  fastify.get(
    '/api/data-sources/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Data Sources'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: safeDataSourceSchema },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const source = await getById(parsed.data.id);
      if (!source) {
        return reply.code(404).send({ error: 'Data source not found' });
      }

      return reply.code(200).send({ data: source });
    },
  );

  // POST /api/data-sources — create (admin only)
  fastify.post(
    '/api/data-sources',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Data Sources'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'connectionType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            connectionType: { type: 'string', enum: ['oracle', 'postgres'] },
            host: { type: 'string', maxLength: 255 },
            port: { type: 'integer' },
            serviceName: { type: 'string', maxLength: 255 },
            sid: { type: 'string', maxLength: 64 },
            username: { type: 'string', maxLength: 255 },
            passwordEnc: { type: 'string', minLength: 1 },
            connectionString: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: safeDataSourceSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          409: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
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

      const existing = await list();
      if (existing.some((s) => s.name === parsed.data.name)) {
        return reply.code(409).send({
          error: `A data source with name "${parsed.data.name}" already exists`,
        });
      }

      const source = await create(parsed.data);
      return reply.code(201).send({ data: source });
    },
  );

  // PUT /api/data-sources/:id — update (admin only)
  fastify.put(
    '/api/data-sources/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Data Sources'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            connectionType: { type: 'string', enum: ['oracle', 'postgres'] },
            host: { type: 'string', maxLength: 255 },
            port: { type: 'integer' },
            serviceName: { type: 'string', maxLength: 255 },
            sid: { type: 'string', maxLength: 64 },
            username: { type: 'string', maxLength: 255 },
            passwordEnc: { type: ['string', 'null'] },
            connectionString: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: safeDataSourceSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          404: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      const source = await update(paramParsed.data.id, bodyParsed.data);
      if (!source) {
        return reply.code(404).send({ error: 'Data source not found' });
      }

      return reply.code(200).send({ data: source });
    },
  );

  // DELETE /api/data-sources/:id — soft delete (admin only)
  fastify.delete(
    '/api/data-sources/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Data Sources'],
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
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Data source not found' });
      }

      return reply.code(200).send({
        data: { message: 'Data source deactivated' },
      });
    },
  );

  // POST /api/data-sources/:id/test — test connection (admin + manager)
  fastify.post(
    '/api/data-sources/:id/test',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Data Sources'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  message: { type: 'string' },
                  latencyMs: { type: 'integer' },
                },
              },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const result = await testConnection(parsed.data.id);
      return reply.code(200).send({ data: result });
    },
  );
}
