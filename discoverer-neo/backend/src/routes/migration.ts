/**
 * Migration routes — admin-only endpoints driving the EUL migration pipeline.
 *
 * The source Oracle credentials are never accepted over HTTP: a request names
 * a registered `data_sources` row and the service decrypts its stored password
 * (see `migration.service.ts`). The migration target is always this backend's
 * own database.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  MigrationError,
  analyzeSource,
  detectVersion,
  getJob,
  listJobs,
  startMapReimport,
  startMigration,
} from '../services/migration.service.js';
import { invalidateAll } from '../lib/metadata-cache.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const SourceBodySchema = z.object({
  dataSourceId: z.string().uuid(),
  schemaOwner: z.string().min(1).max(128).optional(),
});

const RunBodySchema = SourceBodySchema.extend({
  dryRun: z.boolean().optional(),
  // Accept either case from the UI; normalized below.
  version: z.enum(['auto', 'eul4', 'eul5', 'EUL4', 'EUL5']).optional(),
});

/** A maps re-import takes no version override — it reads what the target was migrated from. */
const ReimportMapsBodySchema = SourceBodySchema.extend({
  dryRun: z.boolean().optional(),
});

const JobParamsSchema = z.object({ jobId: z.string().uuid() });

function normalizeVersion(value: string | undefined): 'auto' | 'EUL4' | 'EUL5' {
  if (!value) return 'auto';
  const upper = value.toUpperCase();
  if (upper === 'EUL4' || upper === 'EUL5') return upper;
  return 'auto';
}

// ---------------------------------------------------------------------------
// Response schemas (loose: these payloads are deeply nested reports, and a
// strict schema would silently strip fields the UI needs)
// ---------------------------------------------------------------------------

const errorResponse = {
  type: 'object',
  properties: { error: { type: 'string' } },
} as const;

const looseData = {
  type: 'object',
  properties: { data: { type: 'object', additionalProperties: true } },
  additionalProperties: true,
} as const;

const looseDataArray = {
  type: 'object',
  properties: {
    data: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
  additionalProperties: true,
} as const;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function migrationRoutes(fastify: FastifyInstance) {
  const adminPreHandler = [fastify.authenticate, fastify.authorizeAdmin];
  const tags = ['Migration'];
  const security = [{ bearerAuth: [] }];

  // POST /api/migration/detect — detect the EUL version of a data source
  fastify.post(
    '/api/migration/detect',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: looseData,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = SourceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'A valid dataSourceId is required' });
      }
      try {
        const version = await detectVersion(parsed.data);
        return reply.code(200).send({ data: version });
      } catch (err) {
        if (err instanceof MigrationError) return reply.code(err.statusCode).send({ error: err.message });
        request.log.error({ err }, 'EUL version detection failed');
        return reply.code(400).send({
          error: `EUL detection failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  // POST /api/migration/analyze — full assessment report for a data source
  fastify.post(
    '/api/migration/analyze',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: looseData,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = SourceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'A valid dataSourceId is required' });
      }
      try {
        const report = await analyzeSource(parsed.data);
        return reply.code(200).send({ data: report });
      } catch (err) {
        if (err instanceof MigrationError) return reply.code(err.statusCode).send({ error: err.message });
        request.log.error({ err }, 'EUL analysis failed');
        return reply.code(400).send({
          error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  // POST /api/migration/run — start a migration (or dry run); returns a job
  fastify.post(
    '/api/migration/run',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          202: looseData,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = RunBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'A valid dataSourceId is required' });
      }
      const userId = request.user?.sub;
      if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

      try {
        const job = startMigration({
          dataSourceId: parsed.data.dataSourceId,
          schemaOwner: parsed.data.schemaOwner,
          dryRun: parsed.data.dryRun === true,
          version: normalizeVersion(parsed.data.version),
          startedBy: userId,
          // The job writes metadata directly, well after this request returns.
          onSettled: () => invalidateAll(fastify.redis),
        });
        return reply.code(202).send({ data: job });
      } catch (err) {
        if (err instanceof MigrationError) return reply.code(err.statusCode).send({ error: err.message });
        request.log.error({ err }, 'Failed to start migration');
        return reply.code(400).send({
          error: `Failed to start migration: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  // POST /api/migration/reimport-maps — rebuild the migrated maps in place
  //
  // Separate from /run because a Neo database accepts exactly one full
  // migration: a target whose maps are empty (migrated before the tool could
  // read DOC_DOCUMENT) cannot be fixed by re-running it. See
  // `startMapReimport` — this replaces only the maps, and is destructive for
  // edits made to a migrated map since the original run.
  fastify.post(
    '/api/migration/reimport-maps',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          202: looseData,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = ReimportMapsBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'A valid dataSourceId is required' });
      }
      const userId = request.user?.sub;
      if (!userId) return reply.code(401).send({ error: 'Unauthenticated' });

      try {
        const job = startMapReimport({
          dataSourceId: parsed.data.dataSourceId,
          schemaOwner: parsed.data.schemaOwner,
          dryRun: parsed.data.dryRun === true,
          startedBy: userId,
          onSettled: () => invalidateAll(fastify.redis),
        });
        return reply.code(202).send({ data: job });
      } catch (err) {
        if (err instanceof MigrationError) {
          return reply.code(err.statusCode).send({ error: err.message });
        }
        request.log.error({ err }, 'Failed to start map re-import');
        return reply.code(400).send({
          error: `Failed to start map re-import: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  // GET /api/migration/jobs — recent migration jobs (newest first)
  fastify.get(
    '/api/migration/jobs',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: { 200: looseDataArray, 401: errorResponse, 403: errorResponse },
      },
    },
    async (_request, reply) => {
      return reply.code(200).send({ data: listJobs() });
    },
  );

  // GET /api/migration/jobs/:jobId — poll one job's progress/logs/result
  fastify.get(
    '/api/migration/jobs/:jobId',
    {
      preHandler: adminPreHandler,
      schema: {
        tags,
        security,
        response: {
          200: looseData,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const parsed = JobParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid job ID format' });
      }
      const job = getJob(parsed.data.jobId);
      if (!job) return reply.code(404).send({ error: 'Migration job not found' });
      return reply.code(200).send({ data: job });
    },
  );
}
