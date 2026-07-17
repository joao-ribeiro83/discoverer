import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  list,
  softDelete,
  grantAccess,
  revokeAccess,
  getUserGrants,
  getBusinessAreaUsers,
  getUserPermissionLevels,
  type PermissionLevel,
} from '../services/business-area.service.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
});

const GrantBodySchema = z.object({
  userId: z.string().uuid(),
  permissionLevel: z.enum([
    'CREATE',
    'EDIT',
    'DELETE',
    'EXPORT',
    'SCHEDULE',
    'VIEW',
  ]),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// JSON schema shapes (for Fastify serialization / docs)
// ---------------------------------------------------------------------------

const businessAreaSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    createdBy: { type: ['string', 'null'] },
    createdAt: { type: 'string' },
    updatedBy: { type: ['string', 'null'] },
    updatedAt: { type: 'string' },
    isActive: { type: 'boolean' },
  },
} as const;

const grantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    userEmail: { type: 'string' },
    userName: { type: ['string', 'null'] },
    permissionLevel: {
      type: 'string',
      enum: ['CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SCHEDULE', 'VIEW'],
    },
    grantedBy: { type: ['string', 'null'] },
    grantedAt: { type: 'string' },
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

export default async function businessAreasRoutes(fastify: FastifyInstance) {
  // Ensure the decorator exists (idempotent if registered twice).
  if (!fastify.hasDecorator('requireBusinessAreaAccess')) {
    fastify.decorate(
      'requireBusinessAreaAccess',
      (permissionLevel: PermissionLevel) =>
        async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
          const user = request.user;
          if (!user) {
            return reply.code(401).send({ error: 'Unauthorized' });
          }
          if (user.role === 'ADMIN') return;

          const params = request.params as Record<string, string>;
          const businessAreaId = params?.id ?? params?.baId;
          if (!businessAreaId) {
            return reply.code(400).send({
              error: 'Business area ID is required in route params',
            });
          }

          const { userHasPermission } = await import('../services/business-area.service.js');
          const { hasPermission } = await userHasPermission(
            user.sub,
            businessAreaId,
            permissionLevel,
          );

          if (!hasPermission) {
            return reply.code(403).send({
              error: 'Forbidden',
              details: `Requires "${permissionLevel}" permission for this business area`,
            });
          }
        },
    );
  }

  // GET /api/business-areas — list all
  // Admins see all; authenticated users see only their granted business areas.
  fastify.get(
    '/api/business-areas',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Business Areas'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: businessAreaSchema },
            },
          },
          401: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;

      if (user.role === 'ADMIN') {
        const areas = await list();
        return reply.code(200).send({ data: areas });
      }

      // Non-admins: list business areas they have any grant on.
      const grants = await getUserGrants(user.sub);
      const areaIds = [...new Set(grants.map((g) => g.businessAreaId))];

      if (areaIds.length === 0) {
        return reply.code(200).send({ data: [] });
      }

      const { inArray } = await import('drizzle-orm');
      const { db } = await import('../db/index.js');
      const { businessAreas } = await import('../db/schema.js');

      const areas = await db
        .select()
        .from(businessAreas)
        .where(
          inArray(businessAreas.id, areaIds),
        )
        .orderBy(businessAreas.name);

      return reply.code(200).send({ data: areas });
    },
  );

  // GET /api/business-areas/:id — get one (requires VIEW grant or admin)
  fastify.get(
    '/api/business-areas/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Business Areas'],
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
                  ...businessAreaSchema.properties,
                  grants: { type: 'array', items: grantSchema },
                  permissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
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
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const area = await getById(parsed.data.id, { includeGrants: true });
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      const user = request.user!;
      const permissions =
        user.role === 'ADMIN'
          ? ['CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SCHEDULE', 'VIEW']
          : await getUserPermissionLevels(user.sub, parsed.data.id);

      return reply.code(200).send({
        data: { ...area, permissions },
      });
    },
  );

  // POST /api/business-areas — create (admin only)
  fastify.post(
    '/api/business-areas',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Business Areas'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: businessAreaSchema },
          },
          400: errorResponse,
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

      const user = request.user!;
      const area = await create(parsed.data, user.sub);
      return reply.code(201).send({ data: area });
    },
  );

  // PUT /api/business-areas/:id — update (admin or EDIT grant)
  fastify.put(
    '/api/business-areas/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('EDIT')],
      schema: {
        tags: ['Business Areas'],
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
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { data: businessAreaSchema },
          },
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
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

      const area = await update(paramParsed.data.id, bodyParsed.data);
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      return reply.code(200).send({ data: area });
    },
  );

  // DELETE /api/business-areas/:id — soft delete (admin only)
  fastify.delete(
    '/api/business-areas/:id',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Business Areas'],
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
                properties: { message: { type: 'string' } },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
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
        return reply.code(404).send({ error: 'Business area not found' });
      }

      return reply.code(200).send({
        data: { message: 'Business area deactivated' },
      });
    },
  );

  // GET /api/business-areas/:id/grants — list grants (admin or any member)
  fastify.get(
    '/api/business-areas/:id/grants',
    {
      preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Business Areas'],
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
              data: { type: 'array', items: grantSchema },
            },
          },
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const area = await getById(parsed.data.id, { includeGrants: true });
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      return reply.code(200).send({ data: area.grants });
    },
  );

  // POST /api/business-areas/:id/grants — grant access (admin only)
  fastify.post(
    '/api/business-areas/:id/grants',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Business Areas'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['userId', 'permissionLevel'],
          properties: {
            userId: { type: 'string', format: 'uuid' },
            permissionLevel: {
              type: 'string',
              enum: ['CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SCHEDULE', 'VIEW'],
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { data: grantSchema },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = IdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const bodyParsed = GrantBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: bodyParsed.error.flatten(),
        });
      }

      // Verify business area exists.
      const area = await getById(paramParsed.data.id);
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      const user = request.user!;
      const grant = await grantAccess(
        paramParsed.data.id,
        bodyParsed.data.userId,
        bodyParsed.data.permissionLevel,
        user.sub,
      );

      // Fetch user info for the response.
      const { db } = await import('../db/index.js');
      const { users } = await import('../db/schema.js');
      const { eq } = await import('drizzle-orm');
      const [targetUser] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, bodyParsed.data.userId))
        .limit(1);

      return reply.code(201).send({
        data: {
          id: grant.id,
          userId: grant.userId,
          userEmail: targetUser?.email ?? '',
          userName: targetUser?.name ?? null,
          permissionLevel: grant.permissionLevel,
          grantedBy: grant.grantedBy,
          grantedAt: grant.grantedAt,
        },
      });
    },
  );

  // DELETE /api/business-areas/:id/grants/:userId — revoke access (admin only)
  fastify.delete(
    '/api/business-areas/:id/grants/:userId',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
      schema: {
        tags: ['Business Areas'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: { message: { type: 'string' } },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const paramParsed = z
        .object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
        })
        .safeParse(request.params);

      if (!paramParsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      // Verify business area exists.
      const area = await getById(paramParsed.data.id);
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      const revoked = await revokeAccess(
        paramParsed.data.id,
        paramParsed.data.userId,
      );

      return reply.code(200).send({
        data: {
          message: revoked > 0
            ? `Revoked ${revoked} permission(s) for user`
            : 'No grants found for user on this business area',
        },
      });
    },
  );

  // GET /api/business-areas/:id/users — list users with access (admin or member)
  fastify.get(
    '/api/business-areas/:id/users',
    {
      preHandler: [fastify.authenticate, fastify.requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Business Areas'],
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
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: ['string', 'null'] },
                    permissions: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['CREATE', 'EDIT', 'DELETE', 'EXPORT', 'SCHEDULE', 'VIEW'],
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = IdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid ID format' });
      }

      const area = await getById(parsed.data.id);
      if (!area) {
        return reply.code(404).send({ error: 'Business area not found' });
      }

      const users = await getBusinessAreaUsers(parsed.data.id);
      return reply.code(200).send({ data: users });
    },
  );
}
