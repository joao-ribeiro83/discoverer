import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getById as getMapById, canAccessMap } from '../services/map.service.js';
import {
  createSchedule,
  updateSchedule,
  getSchedule,
  listSchedulesForMap,
  listSchedulesForUser,
  deleteSchedule,
  toggleSchedule,
  triggerNow,
  getNextRunTime,
  getExecutionHistory,
  getScheduledResult,
  ScheduleValidationError,
  type ScheduleRecord,
} from '../services/scheduler.service.js';
import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ParameterValueSchema = z.object({
  paramName: z.string().min(1).max(255),
  // `.optional()` covers a client omitting the field; normalised to null
  // (ScheduleParameterValue has no `undefined` variant) since the two mean
  // the same thing here — no preset value for this parameter.
  paramValue: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  cronExpression: z.string().min(1).max(255),
  timezone: z.string().min(1).max(128).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  outputFormat: z.enum(['XLSX', 'CSV']),
  isActive: z.boolean().optional(),
  parameters: z.array(ParameterValueSchema).max(100).optional(),
});

const UpdateBodySchema = CreateBodySchema.partial();

const ToggleBodySchema = z.object({ isActive: z.boolean() });

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const mapIdParamsSchema = {
  type: 'object',
  required: ['mapId'],
  properties: { mapId: { type: 'string', format: 'uuid' } },
} as const;

const resultParamsSchema = {
  type: 'object',
  required: ['id', 'resultId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    resultId: { type: 'string', format: 'uuid' },
  },
} as const;

const historyQuerySchema = {
  type: 'object',
  properties: { limit: { type: 'integer', minimum: 1, maximum: 200 } },
} as const;

/** Shape returned to clients, with a computed `nextRunAt` convenience field. */
function toResponse(schedule: ScheduleRecord, nextRunAt: Date | null) {
  return {
    id: schedule.id,
    mapId: schedule.mapId,
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    timezone: schedule.timezone,
    validFrom: schedule.validFrom,
    validUntil: schedule.validUntil,
    outputFormat: schedule.outputFormat,
    isActive: schedule.isActive,
    createdBy: schedule.createdBy,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    parameters: schedule.parameters,
    nextRunAt,
  };
}

async function withNextRun(schedule: ScheduleRecord) {
  return toResponse(schedule, await getNextRunTime(schedule.id));
}

/**
 * Load a schedule the caller owns (or is admin for), or send the error
 * response. Ownership — not live map access — is the primary gate: a schedule
 * a user created should stay manageable even if their map permission is later
 * narrowed, mirroring how a user's own export jobs remain visible to them.
 * `requireMapAccess` re-checks live SCHEDULE access on the underlying map for
 * actions (like triggering a run) where an operable map genuinely matters.
 */
async function loadOwnSchedule(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: { requireMapAccess?: boolean } = {},
): Promise<ScheduleRecord | null> {
  const { id } = request.params as { id: string };
  const user = request.user as { sub: string; role: string };

  const schedule = await getSchedule(id);
  if (!schedule) {
    reply.code(404).send({ error: 'Schedule not found' });
    return null;
  }

  const isOwner = schedule.createdBy === user.sub || user.role === 'ADMIN';
  if (!isOwner) {
    reply.code(403).send({ error: 'Forbidden', details: 'You do not own this schedule' });
    return null;
  }

  if (opts.requireMapAccess) {
    const map = await getMapById(schedule.mapId);
    if (!map || !(await canAccessMap(user, map, 'SCHEDULE'))) {
      reply.code(409).send({
        error: 'The underlying map is no longer accessible for scheduling',
      });
      return null;
    }
  }

  return schedule;
}

function sendValidationError(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof ScheduleValidationError) {
    reply.code(400).send({ error: err.message, details: err.details });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function scheduleRoutes(fastify: FastifyInstance) {
  // GET /api/maps/:mapId/schedules — schedules configured on a map.
  fastify.get(
    '/api/maps/:mapId/schedules',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: mapIdParamsSchema },
    },
    async (request, reply) => {
      const { mapId } = request.params as { mapId: string };
      const map = await getMapById(mapId);
      if (!map) return reply.code(404).send({ error: 'Map not found' });

      const user = request.user as { sub: string; role: string };
      if (!(await canAccessMap(user, map, 'SCHEDULE'))) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'You do not have "SCHEDULE" access to this map',
        });
      }

      const list = await listSchedulesForMap(mapId);
      return { data: await Promise.all(list.map(withNextRun)) };
    },
  );

  // POST /api/maps/:mapId/schedules — create a schedule on a map.
  fastify.post(
    '/api/maps/:mapId/schedules',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: mapIdParamsSchema },
    },
    async (request, reply) => {
      const { mapId } = request.params as { mapId: string };
      const map = await getMapById(mapId);
      if (!map) return reply.code(404).send({ error: 'Map not found' });

      const user = request.user as { sub: string; role: string };
      if (!(await canAccessMap(user, map, 'SCHEDULE'))) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'You do not have "SCHEDULE" access to this map',
        });
      }

      const parsed = CreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      try {
        const schedule = await createSchedule({ ...parsed.data, mapId: map.id }, user.sub);
        return reply.code(201).send({ data: await withNextRun(schedule) });
      } catch (err) {
        if (sendValidationError(reply, err)) return;
        throw err;
      }
    },
  );

  // GET /api/schedules — the caller's own schedules, across every map.
  fastify.get(
    '/api/schedules',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }] },
    },
    async (request) => {
      const user = request.user as { sub: string };
      const list = await listSchedulesForUser(user.sub);
      return { data: await Promise.all(list.map(withNextRun)) };
    },
  );

  // GET /api/schedules/:id — a single schedule.
  fastify.get(
    '/api/schedules/:id',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: idParamsSchema },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply);
      if (!schedule) return;
      return { data: await withNextRun(schedule) };
    },
  );

  // PUT /api/schedules/:id — update a schedule.
  fastify.put(
    '/api/schedules/:id',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: idParamsSchema },
    },
    async (request, reply) => {
      const existing = await loadOwnSchedule(request, reply);
      if (!existing) return;

      const parsed = UpdateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      try {
        const updated = await updateSchedule(existing.id, parsed.data);
        if (!updated) return reply.code(404).send({ error: 'Schedule not found' });
        return { data: await withNextRun(updated) };
      } catch (err) {
        if (sendValidationError(reply, err)) return;
        throw err;
      }
    },
  );

  // DELETE /api/schedules/:id
  fastify.delete(
    '/api/schedules/:id',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: idParamsSchema },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply);
      if (!schedule) return;

      const deleted = await deleteSchedule(schedule.id);
      return { data: { deleted } };
    },
  );

  // POST /api/schedules/:id/toggle — enable/disable.
  fastify.post(
    '/api/schedules/:id/toggle',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: idParamsSchema },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply);
      if (!schedule) return;

      const parsed = ToggleBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const updated = await toggleSchedule(schedule.id, parsed.data.isActive);
      if (!updated) return reply.code(404).send({ error: 'Schedule not found' });
      return { data: await withNextRun(updated) };
    },
  );

  // POST /api/schedules/:id/trigger — run now, outside the cron cadence.
  fastify.post(
    '/api/schedules/:id/trigger',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: idParamsSchema },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply, { requireMapAccess: true });
      if (!schedule) return;

      const user = request.user as { sub: string };
      try {
        const result = await triggerNow(schedule.id, user.sub);
        return reply.code(202).send({ data: result });
      } catch (err) {
        if (err instanceof ScheduleValidationError) {
          return reply.code(409).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // GET /api/schedules/:id/history — recent execution results.
  fastify.get(
    '/api/schedules/:id/history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        querystring: historyQuerySchema,
      },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply);
      if (!schedule) return;

      const { limit } = request.query as { limit?: number };
      const data = await getExecutionHistory(schedule.id, limit ?? 20);
      return { data };
    },
  );

  // GET /api/schedules/:id/results/:resultId/download — download a result file.
  fastify.get(
    '/api/schedules/:id/results/:resultId/download',
    {
      preHandler: [fastify.authenticate],
      schema: { tags: ['Schedules'], security: [{ bearerAuth: [] }], params: resultParamsSchema },
    },
    async (request, reply) => {
      const schedule = await loadOwnSchedule(request, reply);
      if (!schedule) return;

      const { resultId } = request.params as { resultId: string };
      const result = await getScheduledResult(schedule.id, resultId);
      if (!result || result.status !== 'SUCCESS' || !result.filePath) {
        return reply.code(404).send({ error: 'Result not found or not available' });
      }
      if (!fs.existsSync(result.filePath)) {
        return reply.code(404).send({ error: 'Result file no longer exists' });
      }

      const ext = result.filePath.endsWith('.xlsx') ? 'xlsx' : 'csv';
      const contentType =
        ext === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8';

      reply.header('content-type', contentType);
      reply.header(
        'content-disposition',
        `attachment; filename="schedule-${schedule.id}-${resultId}.${ext}"`,
      );
      return reply.send(fs.createReadStream(result.filePath));
    },
  );
}
