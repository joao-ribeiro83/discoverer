/**
 * Map run routes (Task 3.1) — request a run, list/inspect/cancel it, and page
 * its stored rows. No Oracle here: `services/map-run.service.ts` writes the
 * row and enqueues it, `workers/map-run.worker.ts` does the Oracle work.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { loadMapWithAccess } from './maps.js';
import { canAccessMap, getById, type MapWithDetails } from '../services/map.service.js';
import { ExecuteBodySchema, isAdmin } from './map-execution.js';
import { requestRun, cancelRun } from '../services/map-run.service.js';
import { getRun, listRuns, readRows, deleteRun, type MapRunRow } from '../services/map-run.store.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const RequestRunBodySchema = z.object({
  parameters: z.record(z.string(), z.unknown()).optional(),
  // Reuse the /execute body's rule (max 50) so the two paths never drift.
  calculatedFields: ExecuteBodySchema.shape.calculatedFields,
  force: z.boolean().optional(),
});

const RUN_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
const RUN_KINDS = ['LIVE', 'SCHEDULED'] as const;

const RowsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

const ListQuerySchema = z.object({
  mapId: z.string().uuid().optional(),
  status: z.enum(RUN_STATUSES).optional(),
  kind: z.enum(RUN_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  all: z.coerce.boolean().optional(),
});

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    mapId: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: RUN_STATUSES },
    kind: { type: 'string', enum: RUN_KINDS },
    limit: { type: 'integer', minimum: 1, maximum: 200 },
    all: { type: 'boolean' },
  },
} as const;

const rowsQuerySchema = {
  type: 'object',
  properties: {
    offset: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1, maximum: 1000 },
  },
} as const;

function toRunDto(run: MapRunRow, mapName: string, admin: boolean) {
  return {
    id: run.id,
    mapId: run.mapId,
    mapName,
    kind: run.kind,
    scheduleId: run.scheduleId,
    status: run.status,
    parameters: run.parameters,
    calculatedFields: run.calculatedFields,
    columns: run.columns,
    decoration: run.decoration,
    rowCount: run.rowCount,
    truncated: run.truncated,
    executionTimeMs: run.executionTimeMs,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    expiresAt: run.expiresAt,
    ...(admin ? { sql: run.sqlText } : {}),
  };
}

/**
 * Load a run the caller may act on, or send the error response and return
 * null. A run belonging to someone else is 404, not 403 — same rule
 * `export.ts`'s `loadOwnJob` applies to a job id. Unlike an export job, a
 * revoked map grant also 404s here (not 403): the run's owner loses their own
 * history the moment `canAccessMap` stops holding, same as the rows a
 * download would have produced.
 */
async function loadOwnRun(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ run: MapRunRow; map: MapWithDetails } | null> {
  const { id } = request.params as { id: string };
  const user = request.user as { sub: string; role: string };

  const run = await getRun(id);
  if (!run || (run.requestedBy !== user.sub && !isAdmin(request))) {
    reply.code(404).send({ error: 'Run not found' });
    return null;
  }

  const map = await getById(run.mapId);
  if (!map || !(await canAccessMap(user, map, 'VIEW'))) {
    reply.code(404).send({ error: 'Run not found' });
    return null;
  }

  return { run, map };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function mapRunRoutes(fastify: FastifyInstance) {
  // POST /api/maps/:id/runs — request a run. Re-uses a still-valid result
  // (200) or queues a new one (202); see Spec > "same map, same conditions".
  fastify.post(
    '/api/maps/:id/runs',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Runs'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const parsed = RequestRunBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string };
      const { run, reused } = await requestRun({
        mapId: map.id,
        userId: user.sub,
        kind: 'LIVE',
        parameters: parsed.data.parameters,
        calculatedFields: parsed.data.calculatedFields,
        force: parsed.data.force,
      });
      return reply
        .code(reused ? 200 : 202)
        .send({ data: toRunDto(run, map.name, isAdmin(request)) });
    },
  );

  // GET /api/runs — the caller's own runs, newest first. `all=true` is
  // admin-only: everyone else's runs are otherwise invisible.
  fastify.get(
    '/api/runs',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Runs'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
      },
    },
    async (request, reply) => {
      const parsed = ListQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }
      if (parsed.data.all && !isAdmin(request)) {
        return reply.code(403).send({
          error: 'Forbidden',
          details: 'Only an administrator may list every user\'s runs',
        });
      }

      const user = request.user as { sub: string; role: string };
      const runs = await listRuns({
        requestedBy: parsed.data.all ? undefined : user.sub,
        mapId: parsed.data.mapId,
        status: parsed.data.status,
        kind: parsed.data.kind,
        limit: parsed.data.limit,
      });

      // decoration.totals are real Oracle rows, same as the rows endpoint —
      // a grant revoked after the run finished must hide it here too, not
      // just on GET /api/runs/:id. One getById per distinct map, cached: the
      // list is capped at 200 rows and usually touches far fewer maps.
      // ponytail: filtering after the LIMIT means a caller can see fewer than
      // `limit` rows even when more exist; fine at today's scale, revisit if
      // the list ever needs to paginate reliably past a wall of hidden maps.
      const mapCache = new Map<string, MapWithDetails | null>();
      const visible: { run: MapRunRow; map: MapWithDetails }[] = [];
      for (const run of runs) {
        let map = mapCache.get(run.mapId);
        if (map === undefined) {
          map = await getById(run.mapId);
          mapCache.set(run.mapId, map);
        }
        if (map && (await canAccessMap(user, map, 'VIEW'))) {
          visible.push({ run, map });
        }
      }

      const admin = isAdmin(request);
      return { data: visible.map(({ run, map }) => toRunDto(run, map.name, admin)) };
    },
  );

  // GET /api/runs/:id — one run's status, counts, timings and columns.
  fastify.get(
    '/api/runs/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Runs'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const loaded = await loadOwnRun(request, reply);
      if (!loaded) return;
      return { data: toRunDto(loaded.run, loaded.map.name, isAdmin(request)) };
    },
  );

  // GET /api/runs/:id/rows — a page of the run's stored rows.
  fastify.get(
    '/api/runs/:id/rows',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Runs'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        querystring: rowsQuerySchema,
      },
    },
    async (request, reply) => {
      const loaded = await loadOwnRun(request, reply);
      if (!loaded) return;

      if (loaded.run.status !== 'COMPLETED') {
        return reply.code(409).send({ error: 'RUN_NOT_COMPLETED' });
      }
      if (loaded.run.expiresAt.getTime() <= Date.now()) {
        return reply.code(410).send({ error: 'Run has expired' });
      }

      const parsed = RowsQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid query', details: parsed.error.issues });
      }

      const rows = await readRows(loaded.run.id, parsed.data.offset, parsed.data.limit);
      return { data: rows };
    },
  );

  // DELETE /api/runs/:id — cancel a QUEUED run, or delete a finished one and
  // its batches.
  fastify.delete(
    '/api/runs/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Runs'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const loaded = await loadOwnRun(request, reply);
      if (!loaded) return;

      const result = await cancelRun(loaded.run.id);
      if (result === 'cancelled') {
        return { data: { cancelled: true } };
      }
      if (result === 'not_found') {
        return reply.code(404).send({ error: 'Run not found' });
      }
      // 'not_queued': the run moved on since `loadOwnRun` read it above —
      // re-read its current status rather than trust the stale copy. A
      // RUNNING run still owns an in-flight Oracle query; deleting its row
      // here would let the same user's next QUEUED run get claimed while
      // that orphaned query keeps running, breaking per-user FIFO. Only a
      // terminal run (COMPLETED/FAILED/CANCELLED) is safe to delete.
      const current = await getRun(loaded.run.id);
      if (!current) {
        return reply.code(404).send({ error: 'Run not found' });
      }
      if (current.status === 'RUNNING') {
        return reply.code(409).send({ error: 'RUN_IN_PROGRESS' });
      }
      await deleteRun(loaded.run.id);
      return { data: { cancelled: false, deleted: true } };
    },
  );
}
