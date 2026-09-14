import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loadMapWithAccess } from './maps.js';
import {
  listForMap,
  create,
  update,
  remove,
  ConditionalFormatValidationError,
} from '../services/conditional-format.service.js';

const OperatorSchema = z.enum(['=', '<>', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN', 'IS_NULL']);
const TargetSchema = z.enum(['CELL', 'ROW']);

const CreateSchema = z.object({
  name: z.string().max(255).nullish(),
  mapItemId: z.string().uuid(),
  target: TargetSchema,
  operator: OperatorSchema,
  value: z.string().max(4000).nullable(),
  backgroundColor: z.string().max(32).nullish(),
  textColor: z.string().max(32).nullish(),
  isBold: z.boolean().optional(),
  isItalic: z.boolean().optional(),
  isUnderline: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

const UpdateSchema = CreateSchema.partial();

const formatParamsSchema = {
  type: 'object',
  required: ['id', 'formatId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    formatId: { type: 'string', format: 'uuid' },
  },
} as const;

function toResponse(row: {
  id: string;
  mapId: string;
  name: string | null;
  mapItemId: string | null;
  target: string;
  operator: string | null;
  value: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  displayOrder: number;
}) {
  return {
    id: row.id,
    mapId: row.mapId,
    name: row.name,
    mapItemId: row.mapItemId,
    target: row.target,
    operator: row.operator,
    value: row.value,
    backgroundColor: row.backgroundColor,
    textColor: row.textColor,
    isBold: row.isBold,
    isItalic: row.isItalic,
    isUnderline: row.isUnderline,
    displayOrder: row.displayOrder,
  };
}

/**
 * Conditional formats (Discoverer's Exceptions) — cell/row highlighting rules
 * a worksheet defines. Kept off the general `PUT /api/maps/:id` on purpose
 * (see `map.service.ts`'s `AnchoredChildren`): that endpoint replaces every
 * map item on save, and these rules anchor on one, so a plain save would
 * silently delete them. This gives them their own lifecycle instead.
 */
export default function conditionalFormatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/maps/:id/conditional-formats',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Maps'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;
      const rows = await listForMap(map.id);
      return { data: rows.map(toResponse) };
    },
  );

  fastify.post(
    '/api/maps/:id/conditional-formats',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Maps'], security: [{ bearerAuth: [] }] },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;
      const parsed = CreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }
      try {
        const row = await create(map.id, parsed.data);
        return reply.code(201).send({ data: toResponse(row) });
      } catch (err) {
        if (err instanceof ConditionalFormatValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.put(
    '/api/maps/:id/conditional-formats/:formatId',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Maps'], security: [{ bearerAuth: [] }], params: formatParamsSchema },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;
      const { formatId } = request.params as { formatId: string };
      const parsed = UpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }
      try {
        const row = await update(map.id, formatId, parsed.data);
        if (!row) return reply.code(404).send({ error: 'Conditional format not found' });
        return { data: toResponse(row) };
      } catch (err) {
        if (err instanceof ConditionalFormatValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/api/maps/:id/conditional-formats/:formatId',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Maps'], security: [{ bearerAuth: [] }], params: formatParamsSchema },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EDIT');
      if (!map) return;
      const { formatId } = request.params as { formatId: string };
      const deleted = await remove(map.id, formatId);
      if (!deleted) return reply.code(404).send({ error: 'Conditional format not found' });
      return reply.code(204).send();
    },
  );
}
