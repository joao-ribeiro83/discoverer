import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { loadMapWithAccess } from './maps.js';
import { SqlGenerationError, planDraft } from '../services/sql-generator.js';
import {
  executeMap,
  executeMapAsync,
  getExecutionStatus,
  cancelExecution,
  getExecutionHistory,
  MapExecutionError,
  type ExecutionErrorKind,
} from '../services/map-execution.service.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CalculatedFieldSchema = z.object({
  name: z.string().min(1).max(255),
  formula: z.string().min(1).max(4000),
  displayOrder: z.number().int().optional(),
});

const ExecuteBodySchema = z.object({
  parameters: z.record(z.string(), z.unknown()).optional(),
  /** Optional per-request statement timeout (ms); the service clamps it. */
  timeoutMs: z.number().int().positive().optional(),
  /** Ad-hoc calculated columns evaluated on the result rows post-query. */
  calculatedFields: z.array(CalculatedFieldSchema).max(50).optional(),
  /** Row offset for "load more" pagination (sync execute only). */
  offset: z.number().int().min(0).optional(),
});

/**
 * A canvas as the builder holds it. Only the columns are needed: what the
 * planner decides turns on which folders they live in and which of them
 * aggregate, not on the conditions.
 */
const PlanBodySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        aggFunction: z.string().max(64).nullable().optional(),
        axisType: z.enum(['AXIS', 'MEASURE', 'PAGE']).nullable().optional(),
        isHidden: z.boolean().optional(),
      }),
    )
    .max(500),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

// JSON schemas for Fastify's built-in param validation.
const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const jobParamsSchema = {
  type: 'object',
  required: ['id', 'jobId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    jobId: { type: 'string', format: 'uuid' },
  },
} as const;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const KIND_STATUS: Record<ExecutionErrorKind, number> = {
  CONFIG: 400,
  CONNECT: 502,
  TIMEOUT: 504,
  QUERY: 500,
  CANCELLED: 409,
  FORBIDDEN: 403,
};

/** Translate a thrown execution error into a JSON response. Returns true when handled. */
function handleExecutionError(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof MapExecutionError) {
    const statusCode = KIND_STATUS[err.kind];
    reply.code(statusCode).send({ error: err.message, statusCode, kind: err.kind });
    return true;
  }
  if (err instanceof SqlGenerationError) {
    // A coded SqlGenerationError is a deliberate refusal, not a broken map
    // (D-036). It ships its own `kind` so the client renders an explanation
    // with a next step rather than a red error banner.
    if (err.code) {
      reply.code(400).send({
        error: err.message,
        statusCode: 400,
        kind: 'REFUSED',
        code: err.code,
        details: err.details,
      });
      return true;
    }
    reply.code(400).send({ error: err.message, statusCode: 400, kind: 'CONFIG' });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function mapExecutionRoutes(fastify: FastifyInstance) {
  // POST /api/maps/plan — classify a canvas without running it (D-117).
  //
  // The builder calls this as the canvas changes, so a fan-trap refusal is
  // reported while the user is still composing rather than after they press
  // Run, wait for production Oracle, and read an explanation. It touches no
  // data source and returns no rows, so any authenticated user may ask.
  fastify.post(
    '/api/maps/plan',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const parsed = PlanBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }
      if (parsed.data.items.length === 0) {
        return { data: { kind: 'FLAT', decision: 'FLAT(NO_MEASURES)', branches: 0 } };
      }

      try {
        const plan = await planDraft(parsed.data.items);
        return {
          data: {
            kind: plan.kind,
            decision: plan.decision,
            branches: plan.kind === 'REWRITE' ? plan.branches.length : 0,
            ...(plan.kind === 'REFUSE'
              ? { rule: plan.rule, folders: plan.folders, message: plan.message }
              : {}),
          },
        };
      } catch (err) {
        // A definition that cannot even be assembled — an item that no longer
        // exists, a join Neo cannot express — is reported the same way a
        // refusal is. The canvas is still being built; nothing here is fatal.
        if (handleExecutionError(reply, err)) return;
        throw err;
      }
    },
  );

  // POST /api/maps/:id/execute — run synchronously, return the first page.
  fastify.post(
    '/api/maps/:id/execute',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const parsed = ExecuteBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string };
      try {
        const result = await executeMap(
          map.id,
          parsed.data.parameters ?? {},
          user.sub,
          {
            timeoutMs: parsed.data.timeoutMs,
            calculatedFields: parsed.data.calculatedFields,
            offset: parsed.data.offset,
          },
        );
        return { data: result };
      } catch (err) {
        if (handleExecutionError(reply, err)) return;
        throw err;
      }
    },
  );

  // POST /api/maps/:id/execute-async — queue a background execution.
  fastify.post(
    '/api/maps/:id/execute-async',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const parsed = ExecuteBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string };
      const { jobId } = await executeMapAsync(
        map.id,
        parsed.data.parameters ?? {},
        user.sub,
        {
          timeoutMs: parsed.data.timeoutMs,
          calculatedFields: parsed.data.calculatedFields,
        },
      );
      return reply.code(202).send({ data: { jobId } });
    },
  );

  // GET /api/maps/:id/executions/:jobId — async execution status/result.
  fastify.get(
    '/api/maps/:id/executions/:jobId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
        params: jobParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const { jobId } = request.params as { jobId: string };
      const job = getExecutionStatus(jobId);
      // Guard against probing job ids that belong to another map.
      if (!job || job.mapId !== map.id) {
        return reply.code(404).send({ error: 'Execution job not found' });
      }
      return { data: job };
    },
  );

  // DELETE /api/maps/:id/executions/:jobId — cancel a running execution.
  fastify.delete(
    '/api/maps/:id/executions/:jobId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
        params: jobParamsSchema,
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const { jobId } = request.params as { jobId: string };
      const job = getExecutionStatus(jobId);
      if (!job || job.mapId !== map.id) {
        return reply.code(404).send({ error: 'Execution job not found' });
      }

      const outcome = await cancelExecution(jobId);
      return { data: outcome };
    },
  );

  // GET /api/maps/:id/history — recent execution log entries.
  fastify.get(
    '/api/maps/:id/history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Map Execution'],
        security: [{ bearerAuth: [] }],
        params: idParamsSchema,
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 200 } },
        },
      },
    },
    async (request, reply) => {
      const map = await loadMapWithAccess(request, reply, 'VIEW');
      if (!map) return;

      const parsed = HistoryQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid query', details: parsed.error.issues });
      }

      const data = await getExecutionHistory(map.id, parsed.data.limit ?? 20);
      return { data };
    },
  );
}
