import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { loadMapWithAccess } from './maps.js';
import { isAdmin } from './map-execution.js';
import { getById, canAccessMap, type MapAction } from '../services/map.service.js';
import { getRun } from '../services/map-run.store.js';
import {
  createExportJob,
  getExportJob,
  listExportJobs,
  downloadExport,
  ExportNotReadyError,
  ExportFileMissingError,
  type ExportJobRecord,
} from '../services/export.service.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ExportBodySchema = z.object({
  format: z.enum(['XLSX', 'CSV', 'PDF']),
  /** The completed run this export reads its rows from. */
  runId: z.string().uuid(),
  /** Locale for a grand/subtotal row's label text. Defaults to `en`. */
  locale: z.enum(['en', 'es-ES', 'fr-FR', 'pt-PT']).optional(),
  /** PDF only: page size, orientation and which result columns to print. */
  pdf: z
    .object({
      pageSize: z.enum(['A4', 'A3', 'LETTER']).optional(),
      orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).optional(),
      columns: z.array(z.string().min(1).max(255)).max(500).optional(),
    })
    .optional(),
});

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const jobParamsSchema = {
  type: 'object',
  required: ['jobId'],
  properties: { jobId: { type: 'string', format: 'uuid' } },
} as const;

const listQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  },
} as const;

/** 200 body of GET /api/exports. Every field of `toResponse` must be listed:
 * fast-json-stringify drops any property the schema does not name. */
const listResponseSchema = {
  200: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            mapId: { type: 'string' },
            mapName: { type: 'string', nullable: true },
            format: { type: 'string', enum: ['XLSX', 'CSV', 'PDF'] },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] },
            progress: { type: 'integer' },
            rowCount: { type: 'integer', nullable: true },
            truncated: { type: 'boolean' },
            errorMessage: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    },
  },
} as const;

/** Shape returned to clients — `filePath` is server-side detail. */
function toResponse(job: ExportJobRecord) {
  return {
    jobId: job.id,
    mapId: job.mapId,
    mapName: job.mapName ?? null,
    format: job.format,
    status: job.status,
    progress: job.progress,
    rowCount: job.rowCount,
    truncated: job.truncated,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

/**
 * Resolve a job the caller is entitled to act on, or send the error response.
 *
 * Two checks, deliberately:
 *
 * 1. The caller must OWN the job. An export file is generated under the
 *    requesting user's row-level security context (`prepareQuery` resolves
 *    security predicates from the user id), so one user's file may contain rows
 *    another user must never see — even when both hold EXPORT on the map.
 *    Ownership is therefore the primary gate, not map permission.
 * 2. The caller must STILL hold the required permission on the map, so access
 *    revoked after the job was created also revokes the download.
 *
 * A job belonging to someone else is reported as 404 rather than 403: job ids
 * are not secrets to be confirmed.
 */
async function loadOwnJob(
  request: FastifyRequest,
  reply: FastifyReply,
  action: MapAction,
): Promise<ExportJobRecord | null> {
  const { jobId } = request.params as { jobId: string };
  const user = request.user as { sub: string; role: string };

  const job = await getExportJob(jobId);
  if (!job || job.requestedBy !== user.sub) {
    reply.code(404).send({ error: 'Export job not found' });
    return null;
  }

  const map = await getById(job.mapId);
  if (!map) {
    reply.code(404).send({ error: 'Map not found' });
    return null;
  }

  if (!(await canAccessMap(user, map, action))) {
    reply.code(403).send({
      error: 'Forbidden',
      details: `You do not have "${action}" access to this map`,
    });
    return null;
  }

  return job;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Data export to file (XLSX/CSV).
 *
 * Creation is map-scoped (`POST /api/maps/:id/export`) because it needs a map
 * to export. Everything afterwards is keyed by the globally-unique job id, so
 * it lives at the top level — which is also what lets `GET /api/exports` list a
 * user's jobs across every map.
 *
 * Note the sibling `GET /api/maps/:id/export` in `maps.ts` exports the map's
 * *definition* as XML, not its data. Fastify allows a GET and a POST on the
 * same path, so the two coexist.
 */
export default function exportRoutes(fastify: FastifyInstance) {
  // POST /api/maps/:id/export — queue a background export job.
  fastify.post(
    '/api/maps/:id/export',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Export'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'EXPORT');
      if (!map) return;

      const parsed = ExportBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string; role: string };

      // A run is exportable only when it is the caller's own (or the caller
      // is an admin), belongs to this map, has finished, and has not expired
      // — a single 409 that names none of those reasons, so a run id is not
      // confirmed either way (same rule `loadOwnJob` applies to a job id).
      const run = await getRun(parsed.data.runId);
      if (
        !run ||
        (run.requestedBy !== user.sub && !isAdmin(request)) ||
        run.mapId !== map.id ||
        run.status !== 'COMPLETED' ||
        run.expiresAt.getTime() <= Date.now()
      ) {
        return reply.code(409).send({ error: 'RUN_NOT_EXPORTABLE' });
      }

      const { jobId } = await createExportJob(map.id, parsed.data.format, user.sub, run.id, {
        locale: parsed.data.locale,
        pdf: parsed.data.format === 'PDF' ? parsed.data.pdf : undefined,
      });
      return reply.code(202).send({ data: { jobId, status: 'PENDING' } });
    },
  );

  // GET /api/exports — the caller's own export jobs, newest first.
  fastify.get(
    '/api/exports',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Export'],
        security: [{ bearerAuth: [] }],
        querystring: listQuerySchema,
        response: listResponseSchema,
      },
    },
    async (request) => {
      const user = request.user as { sub: string };
      const { limit } = request.query as { limit?: number };
      const jobs = await listExportJobs(user.sub, limit ?? 50);
      return { data: jobs.map(toResponse) };
    },
  );

  // GET /api/exports/:jobId — status poll.
  fastify.get(
    '/api/exports/:jobId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Export'],
        security: [{ bearerAuth: [] }],
        params: jobParamsSchema,
      },
    },
    async (request, reply) => {
      // VIEW is enough to watch progress: it reveals nothing but status.
      const job = await loadOwnJob(request, reply, 'VIEW');
      if (!job) return;
      return { data: toResponse(job) };
    },
  );

  // GET /api/exports/:jobId/download — stream the finished file.
  fastify.get(
    '/api/exports/:jobId/download',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Export'],
        security: [{ bearerAuth: [] }],
        params: jobParamsSchema,
      },
    },
    async (request, reply) => {
      const job = await loadOwnJob(request, reply, 'EXPORT');
      if (!job) return;

      try {
        const { stream, filename, contentType } = downloadExport(job);
        reply.header('content-type', contentType);
        reply.header('content-disposition', `attachment; filename="${filename}"`);
        return reply.send(stream);
      } catch (err) {
        if (err instanceof ExportNotReadyError) {
          return reply.code(409).send({ error: err.message, status: err.status });
        }
        if (err instanceof ExportFileMissingError) {
          return reply.code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
