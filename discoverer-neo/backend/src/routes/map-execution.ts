import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { loadMapWithAccess } from './maps.js';
import { resolveHeading } from '../services/map.service.js';
import { SqlGenerationError, planDraft } from '../services/sql-generator.js';
import {
  executeMap,
  explainMap,
  getExecutionHistory,
  MapExecutionError,
  type ExecutionErrorKind,
} from '../services/map-execution.service.js';
import { drillToDetail, DrillNotAvailableError } from '../services/drill.service.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CalculatedFieldSchema = z.object({
  name: z.string().min(1).max(255),
  formula: z.string().min(1).max(4000),
  displayOrder: z.number().int().optional(),
});

// Exported so routes/map-runs.ts's request-run body can reuse the same
// calculated-fields rule (max 50) rather than duplicating it and risking drift.
export const ExecuteBodySchema = z.object({
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

/**
 * The generated SQL and the execution plan are administrator views of a map,
 * not parts of its result. Both name the schema behind it. Exported so
 * routes/map-runs.ts's admin-only `sql` field and `all=true` gate use the
 * same check rather than a second copy.
 */
export function isAdmin(request: { user?: unknown }): boolean {
  return (request.user as { role?: string } | undefined)?.role === 'ADMIN';
}

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const DrillBodySchema = z.object({
  parameters: z.record(z.string(), z.unknown()).optional(),
  /** The clicked row's column-alias → value pairs, from the same result columns `/execute` returned. */
  rowValues: z.record(z.string(), z.unknown()),
});

// JSON schemas for Fastify's built-in param validation.
const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
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

/**
 * Translate a thrown execution error into a JSON response. Returns true when
 * handled. `correlationId` (the request id) is echoed back so a user can
 * quote it when reporting a failure (BE-11) — `MapExecutionError.message` is
 * already the kind's generic text, never the driver's raw one (SEC-07).
 */
function handleExecutionError(reply: FastifyReply, err: unknown, correlationId: string): boolean {
  if (err instanceof MapExecutionError) {
    const statusCode = KIND_STATUS[err.kind];
    reply.code(statusCode).send({ error: err.message, statusCode, kind: err.kind, correlationId });
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
        if (handleExecutionError(reply, err, request.id)) return;
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
            correlationId: request.id,
          },
        );
        // The heading carries `&Date`, `&Time` and `&<ParamName>` tokens. Only
        // here are the real values known, so only here can they be printed.
        const heading = await resolveHeading(map.id, parsed.data.parameters ?? {});
        // The generated SQL names every table, column and predicate behind the
        // map — the schema detail SEC-07 keeps out of an ordinary user's reach
        // in error messages. It was going to everyone. Administrators only.
        const { sql: _generatedSql, ...rest } = result;
        const visible = isAdmin(request) ? result : rest;
        return { data: { ...visible, heading } };
      } catch (err) {
        if (handleExecutionError(reply, err, request.id)) return;
        throw err;
      }
    },
  );

  // POST /api/maps/:id/drill-to-detail — Discoverer's "Drill to Detail": given
  // a rendered row, re-run the worksheet with aggregation stripped and that
  // row's values pinned as conditions, so the user sees the raw rows behind
  // a total or grouped figure. Hierarchy-based drill up/down has no data in
  // this estate and is refused (`refuseHierarchyDrill`) rather than guessed.
  fastify.post(
    '/api/maps/:id/drill-to-detail',
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

      const parsed = DrillBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Invalid request body', details: parsed.error.issues });
      }

      const user = request.user as { sub: string };
      try {
        const result = await drillToDetail(
          map.id,
          parsed.data.parameters ?? {},
          user.sub,
          parsed.data.rowValues,
          { correlationId: request.id },
        );
        return { data: result };
      } catch (err) {
        if (err instanceof DrillNotAvailableError) {
          return reply.code(400).send({ error: err.message, statusCode: 400, kind: 'CONFIG' });
        }
        if (handleExecutionError(reply, err, request.id)) return;
        throw err;
      }
    },
  );

  // POST /api/maps/:id/explain — Oracle's execution plan for this map.
  //
  // Administrator-only, like the generated SQL it is a plan of: it names the
  // tables, indexes and predicates behind the map. Nothing is run against the
  // real data — EXPLAIN PLAN reads the statement, it does not execute it.
  fastify.post(
    '/api/maps/:id/explain',
    {
      preHandler: [fastify.authenticate, fastify.authorizeAdmin],
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
        const result = await explainMap(map.id, parsed.data.parameters ?? {}, user.sub, {
          timeoutMs: parsed.data.timeoutMs,
          correlationId: request.id,
        });
        return { data: result };
      } catch (err) {
        if (handleExecutionError(reply, err, request.id)) return;
        throw err;
      }
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
