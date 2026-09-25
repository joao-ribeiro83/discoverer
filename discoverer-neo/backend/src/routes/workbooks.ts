import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteWorkbook,
  duplicateWorkbook,
  listWorkbookShares,
  listWorkbooksWithMaps,
  revokeWorkbookShare,
  shareWorkbook,
} from '../services/workbook.service.js';
import { MapValidationError } from '../services/map.service.js';

const IdParamSchema = z.object({ id: z.string().uuid() });
const UserParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
const ShareBodySchema = z.object({
  userId: z.string().uuid(),
  permissionLevel: z.enum(['VIEW', 'EDIT', 'EXPORT']),
});
const DuplicateBodySchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

export default function workbookRoutes(fastify: FastifyInstance) {
  // GET /api/workbooks — workbook browse view (Phase 7.1b). Visibility is
  // exactly GET /api/maps?scope=all's entitlement set; this only groups it.
  fastify.get(
    '/api/workbooks',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Workbooks'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.user as { sub: string; role: string };
      const data = await listWorkbooksWithMaps(user);
      return { data };
    },
  );

  // POST /api/workbooks/:id/duplicate — "Save As" for a whole workbook. Open
  // to any role: `duplicateWorkbook` applies the per-map copy rule to each
  // worksheet, the same rule POST /api/maps/:id/duplicate uses.
  fastify.post(
    '/api/workbooks/:id/duplicate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Workbooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const params = IdParamSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Invalid workbook id' });

      const body = DuplicateBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: body.error.issues });
      }

      const user = request.user as { sub: string; role: string };
      const result = await duplicateWorkbook(params.data.id, user, body.data.name);
      if (result.status === 'not_found') {
        return reply.code(404).send({ error: 'Workbook not found' });
      }
      if (result.status === 'refused') {
        return reply.code(403).send({
          error: 'Forbidden',
          details: `Copying needs "CREATE" permission for every worksheet. Refused: ${result.refused.join(', ')}`,
        });
      }
      return reply.code(201).send({ data: result.workbook });
    },
  );

  // DELETE /api/workbooks/:id — soft-delete every worksheet, then the workbook.
  // Open to any role: `deleteWorkbook` applies the per-map DELETE rule to each
  // worksheet, the same rule DELETE /api/maps/:id uses.
  fastify.delete(
    '/api/workbooks/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Workbooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const params = IdParamSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Invalid workbook id' });

      const user = request.user as { sub: string; role: string };
      const result = await deleteWorkbook(params.data.id, user);
      if (result.status === 'not_found') {
        return reply.code(404).send({ error: 'Workbook not found' });
      }
      if (result.status === 'refused') {
        return reply.code(403).send({
          error: 'Forbidden',
          details: `Deleting needs "DELETE" permission for every worksheet. Refused: ${result.refused.join(', ')}`,
        });
      }
      return { data: { deleted: result.deleted } };
    },
  );

  // GET /api/workbooks/:id/shares — who holds this workbook, and how much of it.
  fastify.get(
    '/api/workbooks/:id/shares',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Workbooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const params = IdParamSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Invalid workbook id' });

      const user = request.user as { sub: string; role: string };
      return { data: await listWorkbookShares(params.data.id, user) };
    },
  );

  // POST /api/workbooks/:id/shares — hand the whole workbook to one person.
  //
  // Discoverer shared a workbook, never a single worksheet, so this is the
  // shape an administrator actually works in. It fans out to one `map_shares`
  // row per worksheet; the per-map routes still exist for finer control.
  // Admin and manager only — `shareWorkbook` re-checks each worksheet.
  fastify.post(
    '/api/workbooks/:id/shares',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Workbooks'],
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
            permissionLevel: { type: 'string', enum: ['VIEW', 'EDIT', 'EXPORT'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = IdParamSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Invalid workbook id' });

      const body = ShareBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: body.error.issues });
      }

      const user = request.user as { sub: string; role: string };
      try {
        const result = await shareWorkbook(
          params.data.id,
          body.data.userId,
          body.data.permissionLevel,
          user,
        );
        if (result.shared === 0 && result.refused.length === 0) {
          return reply.code(404).send({ error: 'Workbook not found' });
        }
        return reply.code(201).send({ data: result });
      } catch (err) {
        if (err instanceof MapValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // DELETE /api/workbooks/:id/shares/:userId — take the whole workbook back.
  fastify.delete(
    '/api/workbooks/:id/shares/:userId',
    {
      preHandler: [fastify.authenticate, fastify.authorize('ADMIN', 'MANAGER')],
      schema: {
        tags: ['Workbooks'],
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
      const params = UserParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

      const user = request.user as { sub: string; role: string };
      const result = await revokeWorkbookShare(params.data.id, params.data.userId, user);
      if (result.revoked === 0) {
        return reply.code(404).send({ error: 'No share to revoke on that workbook' });
      }
      return { data: result };
    },
  );
}
