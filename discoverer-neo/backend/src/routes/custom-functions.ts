import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listAll,
  softDelete,
  CustomFunctionValidationError,
} from '../services/custom-function.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const FunctionTypeEnum = z.enum(['SQL', 'PLSQL', 'PACKAGE']);

const ParameterSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  functionType: FunctionTypeEnum,
  parameters: z.array(ParameterSchema).optional(),
  returnType: z.string().max(64).optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  functionType: FunctionTypeEnum.optional(),
  parameters: z.array(ParameterSchema).nullable().optional(),
  returnType: z.string().max(64).nullable().optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const customFunctionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
    parameters: {},
    returnType: { type: ['string', 'null'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
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

export default function customFunctionRoutes(fastify: FastifyInstance) {
  // All custom-function endpoints require authentication and ADMIN/MANAGER role.
  const adminManagerPreHandler = [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')];

  // GET /api/custom-functions — list all
  fastify.get(
    '/api/custom-functions',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: customFunctionSchema },
            },
          },
          401: errorResponse,
        },
      },
    },
    async (_request, reply) => {
      const list = await listAll();
      return reply.code(200).send({ data: list });
    },
  );

  // GET /api/custom-functions/:id — get one
  fastify.get(
    '/api/custom-functions/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const fn = await getById(parsed.data.id);
      if (!fn) {
        return reply.code(404).send({ error: 'Custom function not found' });
      }

      return reply.code(200).send({ data: fn });
    },
  );

  // POST /api/custom-functions — register
  fastify.post(
    '/api/custom-functions',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'functionType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
            parameters: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string', minLength: 1 },
                  type: { type: 'string', minLength: 1 },
                  required: { type: 'boolean' },
                  defaultValue: {},
                },
              },
            },
            returnType: { type: 'string', maxLength: 64 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
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

      try {
        const fn = await create(parsed.data);
        return reply.code(201).send({ data: fn });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof CustomFunctionValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );

  // PUT /api/custom-functions/:id — update
  fastify.put(
    '/api/custom-functions/:id',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
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
            description: { type: ['string', 'null'] },
            functionType: { type: 'string', enum: ['SQL', 'PLSQL', 'PACKAGE'] },
            parameters: {
              type: ['array', 'null'],
              items: {
                type: 'object',
                required: ['name', 'type'],
                properties: {
                  name: { type: 'string', minLength: 1 },
                  type: { type: 'string', minLength: 1 },
                  required: { type: 'boolean' },
                  defaultValue: {},
                },
              },
            },
            returnType: { type: ['string', 'null'], maxLength: 64 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: customFunctionSchema },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const fn = await update(paramParsed.data.id, bodyParsed.data);
        if (!fn) {
          return reply.code(404).send({ error: 'Custom function not found' });
        }

        return reply.code(200).send({ data: fn });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof CustomFunctionValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );

  // DELETE /api/custom-functions/:id — soft delete
  fastify.delete(
    '/api/custom-functions/:id',
    {
      preHandler: adminManagerPreHandler,
      schema: {
        tags: ['Custom Functions'],
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
              data: { type: 'object', properties: { message: { type: 'string' } } },
            },
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
        return reply.code(400).send({ error: 'Invalid custom function ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Custom function not found' });
      }

      return reply.code(200).send({
        data: { message: 'Custom function deactivated' },
      });
    },
  );
}
