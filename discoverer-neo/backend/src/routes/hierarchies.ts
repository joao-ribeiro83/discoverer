import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listByBusinessArea,
  softDelete,
  validateLevels,
  HierarchyValidationError,
} from '../services/hierarchy.service.js';
import {
  requireBusinessAreaAccess,
  requireHierarchyAccess,
} from '../middleware/business-area-auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const LevelInputSchema = z.object({
  levelName: z.string().min(1).max(255),
  itemId: z.string().uuid(),
  levelNumber: z.number().int().min(1),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  levels: z.array(LevelInputSchema).min(1),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  levels: z.array(LevelInputSchema).min(1).optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const BaIdParamSchema = z.object({
  baId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const hierarchyLevelSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    hierarchyId: { type: 'string' },
    levelName: { type: 'string' },
    itemId: { type: 'string' },
    levelNumber: { type: 'integer' },
    createdAt: { type: 'string' },
  },
} as const;

const hierarchySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    businessAreaId: { type: 'string' },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    levels: { type: 'array', items: hierarchyLevelSchema },
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

export default function hierarchyRoutes(fastify: FastifyInstance) {
  // GET /api/business-areas/:baId/hierarchies — list hierarchies in a business area
  fastify.get(
    '/api/business-areas/:baId/hierarchies',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Hierarchies'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
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
                    description: { type: ['string', 'null'] },
                    businessAreaId: { type: 'string' },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = BaIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const list = await listByBusinessArea(parsed.data.baId);
      return reply.code(200).send({ data: list });
    },
  );

  // GET /api/hierarchies/:id — get one with levels.
  //
  // Grant-scoped: the levels name the items they are built from.
  fastify.get(
    '/api/hierarchies/:id',
    {
      preHandler: [fastify.authenticate, requireHierarchyAccess('VIEW')],
      schema: {
        tags: ['Hierarchies'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: hierarchySchema },
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
        return reply.code(400).send({ error: 'Invalid hierarchy ID format' });
      }

      const hierarchy = await getById(parsed.data.id);
      if (!hierarchy) {
        return reply.code(404).send({ error: 'Hierarchy not found' });
      }

      return reply.code(200).send({ data: hierarchy });
    },
  );

  // POST /api/business-areas/:baId/hierarchies — create with levels
  fastify.post(
    '/api/business-areas/:baId/hierarchies',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('CREATE')],
      schema: {
        tags: ['Hierarchies'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['name', 'levels'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
            levels: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['levelName', 'itemId', 'levelNumber'],
                properties: {
                  levelName: { type: 'string', minLength: 1, maxLength: 255 },
                  itemId: { type: 'string', format: 'uuid' },
                  levelNumber: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: hierarchySchema },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = BaIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const bodyParsed = CreateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const hierarchy = await create({
          name: bodyParsed.data.name,
          description: bodyParsed.data.description,
          businessAreaId: paramParsed.data.baId,
          levels: bodyParsed.data.levels,
        });

        return reply.code(201).send({ data: hierarchy });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof HierarchyValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        if (message.includes('does not exist') || message.includes('does not belong')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // PUT /api/hierarchies/:id — update with levels
  fastify.put(
    '/api/hierarchies/:id',
    {
      preHandler: [fastify.authenticate, requireHierarchyAccess('EDIT')],
      schema: {
        tags: ['Hierarchies'],
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
            levels: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['levelName', 'itemId', 'levelNumber'],
                properties: {
                  levelName: { type: 'string', minLength: 1, maxLength: 255 },
                  itemId: { type: 'string', format: 'uuid' },
                  levelNumber: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: hierarchySchema },
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
        return reply.code(400).send({ error: 'Invalid hierarchy ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const hierarchy = await update(paramParsed.data.id, bodyParsed.data);
        if (!hierarchy) {
          return reply.code(404).send({ error: 'Hierarchy not found' });
        }

        return reply.code(200).send({ data: hierarchy });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof HierarchyValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );

  // DELETE /api/hierarchies/:id — soft delete
  fastify.delete(
    '/api/hierarchies/:id',
    {
      preHandler: [fastify.authenticate, requireHierarchyAccess('DELETE')],
      schema: {
        tags: ['Hierarchies'],
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
        return reply.code(400).send({ error: 'Invalid hierarchy ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Hierarchy not found' });
      }

      return reply.code(200).send({
        data: { message: 'Hierarchy deactivated' },
      });
    },
  );

  // POST /api/hierarchies/validate-levels — validate level references without creating
  fastify.post(
    '/api/business-areas/:baId/hierarchies/validate-levels',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Hierarchies'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['levels'],
          properties: {
            levels: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['levelName', 'itemId', 'levelNumber'],
                properties: {
                  levelName: { type: 'string', minLength: 1, maxLength: 255 },
                  itemId: { type: 'string', format: 'uuid' },
                  levelNumber: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean' },
                },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = BaIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const bodyParsed = z
        .object({ levels: z.array(LevelInputSchema).min(1) })
        .safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        await validateLevels(paramParsed.data.baId, bodyParsed.data.levels);
        return reply.code(200).send({ data: { valid: true } });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof HierarchyValidationError) {
          return reply.code(400).send({ error: message, details: err.details });
        }
        throw err;
      }
    },
  );
}
