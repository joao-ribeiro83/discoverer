import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listByBusinessArea,
  softDelete,
  autoSuggestJoins,
} from '../services/join.service.js';
import {
  requireBusinessAreaAccess,
  requireFolderAccess,
  requireJoinAccess,
} from '../middleware/business-area-auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

// No `FULL`. It was only ever reachable because `join_type` was stored, and it
// was stored from a column that does not carry a join type. The flag pair that
// would mean a full outer join is a refusal (D-038).
const JoinTypeEnum = z.enum(['INNER', 'LEFT', 'RIGHT']);

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  leftFolderId: z.string().uuid(),
  rightFolderId: z.string().uuid(),
  leftItemId: z.string().uuid().nullable().optional(),
  rightItemId: z.string().uuid().nullable().optional(),
  joinType: JoinTypeEnum,
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  leftFolderId: z.string().uuid().optional(),
  rightFolderId: z.string().uuid().optional(),
  leftItemId: z.string().uuid().nullable().optional(),
  rightItemId: z.string().uuid().nullable().optional(),
  joinType: JoinTypeEnum.optional(),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

const BaIdParamSchema = z.object({
  baId: z.string().uuid(),
});

const FolderIdParamSchema = z.object({
  folderId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const joinSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    leftFolderId: { type: 'string' },
    rightFolderId: { type: 'string' },
    leftItemId: { type: ['string', 'null'] },
    rightItemId: { type: ['string', 'null'] },
    joinType: { type: 'string', enum: ['INNER', 'LEFT', 'RIGHT'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
  },
} as const;

const joinWithDetailsSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    leftFolderId: { type: 'string' },
    rightFolderId: { type: 'string' },
    leftItemId: { type: ['string', 'null'] },
    rightItemId: { type: ['string', 'null'] },
    joinType: { type: 'string', enum: ['INNER', 'LEFT', 'RIGHT'] },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string' },
    leftFolderName: { type: 'string' },
    rightFolderName: { type: 'string' },
    leftItemName: { type: ['string', 'null'] },
    rightItemName: { type: ['string', 'null'] },
    businessAreaId: { type: 'string' },
  },
} as const;

const joinSuggestionSchema = {
  type: 'object',
  properties: {
    leftFolderId: { type: 'string' },
    rightFolderId: { type: 'string' },
    leftItemId: { type: 'string' },
    rightItemId: { type: 'string' },
    leftColumnName: { type: 'string' },
    rightColumnName: { type: 'string' },
    suggestedJoinType: { type: 'string', enum: ['INNER', 'LEFT', 'RIGHT'] },
    reason: { type: 'string' },
  },
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function joinRoutes(fastify: FastifyInstance) {
  // GET /api/business-areas/:baId/joins — list joins in a business area
  fastify.get(
    '/api/business-areas/:baId/joins',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Joins'],
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
              data: { type: 'array', items: joinWithDetailsSchema },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = BaIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid business area ID format' });
      }

      const joinList = await listByBusinessArea(parsed.data.baId);
      return reply.code(200).send({ data: joinList });
    },
  );

  // GET /api/joins/:id — get one join.
  //
  // Grant-scoped: a join row names the column pair that relates two tables.
  fastify.get(
    '/api/joins/:id',
    {
      preHandler: [fastify.authenticate, requireJoinAccess('VIEW')],
      schema: {
        tags: ['Joins'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: joinWithDetailsSchema },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid join ID format' });
      }

      const join = await getById(parsed.data.id);
      if (!join) {
        return reply.code(404).send({ error: 'Join not found' });
      }

      return reply.code(200).send({ data: join });
    },
  );

  // POST /api/business-areas/:baId/joins — create join
  fastify.post(
    '/api/business-areas/:baId/joins',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('CREATE')],
      schema: {
        tags: ['Joins'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['name', 'leftFolderId', 'rightFolderId', 'joinType'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            leftFolderId: { type: 'string', format: 'uuid' },
            rightFolderId: { type: 'string', format: 'uuid' },
            leftItemId: { type: ['string', 'null'], format: 'uuid' },
            rightItemId: { type: ['string', 'null'], format: 'uuid' },
            joinType: { type: 'string', enum: ['INNER', 'LEFT', 'RIGHT'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: joinSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
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
        const join = await create({
          name: bodyParsed.data.name,
          leftFolderId: bodyParsed.data.leftFolderId,
          rightFolderId: bodyParsed.data.rightFolderId,
          leftItemId: bodyParsed.data.leftItemId,
          rightItemId: bodyParsed.data.rightItemId,
          joinType: bodyParsed.data.joinType,
        });

        return reply.code(201).send({ data: join });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('does not exist') ||
          message.includes('does not belong')
        ) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // PUT /api/joins/:id — update join
  fastify.put(
    '/api/joins/:id',
    {
      preHandler: [fastify.authenticate, requireJoinAccess('EDIT')],
      schema: {
        tags: ['Joins'],
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
            leftFolderId: { type: 'string', format: 'uuid' },
            rightFolderId: { type: 'string', format: 'uuid' },
            leftItemId: { type: ['string', 'null'], format: 'uuid' },
            rightItemId: { type: ['string', 'null'], format: 'uuid' },
            joinType: { type: 'string', enum: ['INNER', 'LEFT', 'RIGHT'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: joinSchema },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: {},
            },
          },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid join ID format' });
      }

      const bodyParsed = UpdateBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      try {
        const join = await update(paramParsed.data.id, bodyParsed.data);
        if (!join) {
          return reply.code(404).send({ error: 'Join not found' });
        }

        return reply.code(200).send({ data: join });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('does not exist') || message.includes('does not belong')) {
          return reply.code(400).send({ error: message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/joins/:id — soft delete
  fastify.delete(
    '/api/joins/:id',
    {
      preHandler: [fastify.authenticate, requireJoinAccess('DELETE')],
      schema: {
        tags: ['Joins'],
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
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid join ID format' });
      }

      const deleted = await softDelete(parsed.data.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Join not found' });
      }

      return reply.code(200).send({
        data: { message: 'Join deactivated' },
      });
    },
  );

  // GET /api/folders/:folderId/joins/suggestions — auto-suggest joins
  fastify.get(
    '/api/folders/:folderId/joins/suggestions',
    {
      preHandler: [fastify.authenticate, requireFolderAccess('VIEW')],
      schema: {
        tags: ['Joins'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['folderId'],
          properties: { folderId: { type: 'string', format: 'uuid' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: joinSuggestionSchema },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const parsed = FolderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid folder ID format' });
      }

      try {
        const suggestions = await autoSuggestJoins(parsed.data.folderId);
        return reply.code(200).send({ data: suggestions });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('does not exist')) {
          return reply.code(404).send({ error: message });
        }
        throw err;
      }
    },
  );
}
