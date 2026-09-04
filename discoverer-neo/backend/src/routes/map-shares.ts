import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listShares,
  shareWith,
  revokeShare,
  MapValidationError,
} from '../services/map.service.js';
import { loadMapWithAccess } from './maps.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const SharePermissionEnum = z.enum(['VIEW', 'EDIT', 'EXPORT']);

const CreateShareBodySchema = z.object({
  userId: z.string().uuid(),
  permissionLevel: SharePermissionEnum,
});

const UpdateShareBodySchema = z.object({
  permissionLevel: SharePermissionEnum,
});

const ShareParamSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Routes
//
// Sharing is managed by the map owner (or an admin). Access is enforced by
// loadMapWithAccess with the EDIT action plus an owner/admin check, so a
// user who merely received an EDIT share cannot re-share the map.
// ---------------------------------------------------------------------------

export default function mapShareRoutes(fastify: FastifyInstance) {
  // GET /api/maps/:id/shares — list shares
  fastify.get(
    '/api/maps/:id/shares',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Shares'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;

      const data = await listShares(map.id);
      return { data };
    },
  );

  // POST /api/maps/:id/shares — share with a user (upsert)
  fastify.post(
    '/api/maps/:id/shares',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Shares'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;

      const user = request.user as { sub: string; role: string };
      if (user.role !== 'ADMIN' && map.createdBy !== user.sub) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'Only the map owner or an admin can manage sharing',
        });
      }

      const parsed = CreateShareBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      try {
        const share = await shareWith(
          map.id,
          parsed.data.userId,
          parsed.data.permissionLevel,
          user.sub,
        );
        return reply.code(201).send({ data: share });
      } catch (err) {
        if (err instanceof MapValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // PUT /api/maps/:id/shares/:userId — change a share's permission level
  fastify.put(
    '/api/maps/:id/shares/:userId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Shares'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;

      const user = request.user as { sub: string; role: string };
      if (user.role !== 'ADMIN' && map.createdBy !== user.sub) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'Only the map owner or an admin can manage sharing',
        });
      }

      const params = ShareParamSchema.parse(request.params);
      const parsed = UpdateShareBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      try {
        const share = await shareWith(
          map.id,
          params.userId,
          parsed.data.permissionLevel,
          user.sub,
        );
        return { data: share };
      } catch (err) {
        if (err instanceof MapValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/maps/:id/shares/:userId — revoke a share
  fastify.delete(
    '/api/maps/:id/shares/:userId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Shares'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;

      const user = request.user as { sub: string; role: string };
      if (user.role !== 'ADMIN' && map.createdBy !== user.sub) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'Only the map owner or an admin can manage sharing',
        });
      }

      const params = ShareParamSchema.parse(request.params);
      const removed = await revokeShare(map.id, params.userId);
      if (!removed) {
        return reply.code(404).send({ error: 'Share not found' });
      }
      return { data: { revoked: true } };
    },
  );
}
