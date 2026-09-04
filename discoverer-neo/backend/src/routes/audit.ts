import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getEntityHistory,
  getStats,
  getUserActivity,
  query,
} from '../services/audit.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const StatsQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const EntityParamsSchema = z.object({
  type: z.string().min(1),
  id: z.string().uuid(),
});

const UserParamsSchema = z.object({ id: z.string().uuid() });
const UserQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() });

// ---------------------------------------------------------------------------
// JSON response shapes
// ---------------------------------------------------------------------------

const entrySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string', nullable: true },
    userName: { type: 'string', nullable: true },
    userEmail: { type: 'string', nullable: true },
    action: { type: 'string' },
    entityType: { type: 'string' },
    entityId: { type: 'string', nullable: true },
    details: {},
    ipAddress: { type: 'string', nullable: true },
    createdAt: { type: 'string' },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: { error: { type: 'string' }, details: {} },
} as const;

// ---------------------------------------------------------------------------
// Routes — admin-only: the audit trail covers every user's activity.
// ---------------------------------------------------------------------------

export default function auditRoutes(fastify: FastifyInstance) {
  const adminPreHandler = [fastify.authenticate, fastify.authorizeAdmin];
  const tags = ['Audit'];
  const security = [{ bearerAuth: [] }];

  // GET /api/audit — filterable query over the full log
  fastify.get(
    '/api/audit',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: entrySchema },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = QuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }
      const { limit = 50, offset = 0, ...filters } = parsed.data;
      const result = await query({ ...filters, limit, offset });
      return reply.code(200).send({ ...result, limit, offset });
    },
  );

  // GET /api/audit/stats — aggregate counts (per day / per user / per action)
  fastify.get(
    '/api/audit/stats',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  totalActions: { type: 'number' },
                  byDay: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { date: { type: 'string' }, count: { type: 'number' } },
                    },
                  },
                  byUser: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        userId: { type: 'string', nullable: true },
                        userName: { type: 'string', nullable: true },
                        count: { type: 'number' },
                      },
                    },
                  },
                  byActionType: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { action: { type: 'string' }, count: { type: 'number' } },
                    },
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
      const parsed = StatsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
      }
      const stats = await getStats(parsed.data.dateFrom, parsed.data.dateTo);
      return reply.code(200).send({ data: stats });
    },
  );

  // GET /api/audit/entity/:type/:id — full history for one entity
  fastify.get(
    '/api/audit/entity/:type/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: entrySchema } } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = EntityParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid entity type/id' });
      }
      const rows = await getEntityHistory(parsed.data.type, parsed.data.id);
      return reply.code(200).send({ data: rows });
    },
  );

  // GET /api/audit/user/:id — recent activity by one user
  fastify.get(
    '/api/audit/user/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: entrySchema } } },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = UserParamsSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid user ID format' });
      }
      const queryParsed = UserQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply.code(400).send({ error: 'Invalid limit' });
      }
      const rows = await getUserActivity(paramParsed.data.id, queryParsed.data.limit);
      return reply.code(200).send({ data: rows });
    },
  );
}
