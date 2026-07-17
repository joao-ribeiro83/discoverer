import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  create,
  update,
  getById,
  listByBusinessArea,
  listByUser,
  listSharedWithUser,
  softDelete,
  duplicate,
  exportAsXml,
  canAccessMap,
  MapValidationError,
  type MapAction,
} from '../services/map.service.js';
import { userHasPermission } from '../services/business-area.service.js';
import { requireBusinessAreaAccess } from '../middleware/business-area-auth.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const MapTypeEnum = z.enum(['TABLE', 'CROSSTAB', 'PAGE_DETAIL', 'CHART']);
const OperatorEnum = z.enum([
  '=',
  '<>',
  '>',
  '<',
  '>=',
  '<=',
  'LIKE',
  'IN',
  'BETWEEN',
  'IS_NULL',
]);

const MapItemInputSchema = z.object({
  itemId: z.string().uuid(),
  displayOrder: z.number().int().min(0).optional(),
  displayName: z.string().max(255).nullable().optional(),
  formatMask: z.string().max(255).nullable().optional(),
  aggFunction: z.string().max(64).nullable().optional(),
  sortDirection: z.enum(['ASC', 'DESC']).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  columnWidth: z.number().int().positive().nullable().optional(),
});

const MapConditionInputSchema = z.object({
  itemId: z.string().uuid(),
  operator: OperatorEnum,
  value: z.string().nullable().optional(),
  paramName: z.string().max(255).nullable().optional(),
  conditionType: z.enum(['PARAMETER', 'STATIC']),
  groupId: z.string().uuid().nullable().optional(),
  logicOperator: z.enum(['AND', 'OR']).optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const MapParameterInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[A-Za-z][A-Za-z0-9_]*$/,
      'Parameter names must start with a letter and contain only letters, digits, and underscores',
    ),
  paramType: z.enum(['STRING', 'NUMBER', 'DATE', 'LIST']),
  defaultValue: z.string().nullable().optional(),
  isRequired: z.boolean().optional(),
});

const MapCalculatedFieldInputSchema = z.object({
  name: z.string().min(1).max(255),
  formula: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  mapType: MapTypeEnum,
  isPublic: z.boolean().optional(),
  items: z.array(MapItemInputSchema).min(1),
  conditions: z.array(MapConditionInputSchema).optional(),
  parameters: z.array(MapParameterInputSchema).optional(),
  calculatedFields: z.array(MapCalculatedFieldInputSchema).optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  mapType: MapTypeEnum.optional(),
  isPublic: z.boolean().optional(),
  items: z.array(MapItemInputSchema).min(1).optional(),
  conditions: z.array(MapConditionInputSchema).optional(),
  parameters: z.array(MapParameterInputSchema).optional(),
  calculatedFields: z.array(MapCalculatedFieldInputSchema).optional(),
});

const DuplicateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

const IdParamSchema = z.object({ id: z.string().uuid() });
const BaIdParamSchema = z.object({ baId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Shared handler helpers
// ---------------------------------------------------------------------------

/**
 * Load the map and verify the user may perform `action` on it.
 * Sends 404/403 and returns null when access is denied.
 */
export async function loadMapWithAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  action: MapAction,
) {
  const params = IdParamSchema.safeParse(request.params);
  if (!params.success) {
    reply.code(400).send({ error: 'Invalid map id' });
    return null;
  }

  const map = await getById(params.data.id);
  if (!map) {
    reply.code(404).send({ error: 'Map not found' });
    return null;
  }

  const user = request.user as { sub: string; role: string };
  const allowed = await canAccessMap(user, map, action);
  if (!allowed) {
    reply.code(403).send({
      error: 'Forbidden',
      details: `You do not have "${action}" access to this map`,
    });
    return null;
  }

  return map;
}

function sendValidationError(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof MapValidationError) {
    reply.code(400).send({ error: err.message, details: err.details });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function mapRoutes(fastify: FastifyInstance) {
  // GET /api/business-areas/:baId/maps — list maps in a business area
  fastify.get(
    '/api/business-areas/:baId/maps',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('VIEW')],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => {
      const { baId } = BaIdParamSchema.parse(request.params);
      const data = await listByBusinessArea(baId);
      return { data };
    },
  );

  // GET /api/maps — the current user's maps (own + shared with them)
  fastify.get(
    '/api/maps',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.user as { sub: string };
      const [mine, shared] = await Promise.all([
        listByUser(user.sub),
        listSharedWithUser(user.sub),
      ]);
      return { data: { mine, shared } };
    },
  );

  // GET /api/maps/:id — full map definition
  fastify.get(
    '/api/maps/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;
      return { data: map };
    },
  );

  // POST /api/business-areas/:baId/maps — create a map
  fastify.post(
    '/api/business-areas/:baId/maps',
    {
      preHandler: [fastify.authenticate, requireBusinessAreaAccess('CREATE')],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['baId'],
          properties: { baId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const { baId } = BaIdParamSchema.parse(request.params);
      const parsed = CreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string };
      try {
        const map = await create(
          { ...parsed.data, businessAreaId: baId },
          user.sub,
        );
        return reply.code(201).send({ data: map });
      } catch (err) {
        if (sendValidationError(reply, err)) return;
        throw err;
      }
    },
  );

  // PUT /api/maps/:id — update a map (replaces child collections if provided)
  fastify.put(
    '/api/maps/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
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

      const parsed = UpdateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      try {
        const updated = await update(map.id, parsed.data);
        return { data: updated };
      } catch (err) {
        if (sendValidationError(reply, err)) return;
        throw err;
      }
    },
  );

  // DELETE /api/maps/:id — soft delete
  fastify.delete(
    '/api/maps/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'DELETE');
      if (!map) return;

      await softDelete(map.id);
      return { data: { deleted: true } };
    },
  );

  // POST /api/maps/:id/duplicate — deep copy
  fastify.post(
    '/api/maps/:id/duplicate',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const user = request.user as { sub: string; role: string };
      // Duplicating creates a new map, so the user also needs create
      // rights in the business area (owners and admins always may).
      if (user.role !== 'ADMIN' && map.createdBy !== user.sub) {
        const { hasPermission } = await userHasPermission(
          user.sub,
          map.businessAreaId,
          'CREATE',
        );
        if (!hasPermission) {
          return reply.code(403).send({
            error: 'Forbidden',
            details: 'Duplicating requires "CREATE" permission in the business area',
          });
        }
      }

      const parsed = DuplicateBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const copy = await duplicate(map.id, user.sub, parsed.data.name);
      return reply.code(201).send({ data: copy });
    },
  );

  // GET /api/maps/:id/export — map definition as XML
  fastify.get(
    '/api/maps/:id/export',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Maps'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EXPORT');
      if (!map) return;

      const xml = await exportAsXml(map.id);
      return reply
        .header('content-type', 'application/xml; charset=utf-8')
        .header(
          'content-disposition',
          `attachment; filename="map-${map.id}.xml"`,
        )
        .send(xml);
    },
  );
}
