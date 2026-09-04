import type { FastifyInstance } from 'fastify';
import { count, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { queryExecutionLog, scheduledResults } from '../db/schema.js';
import { listAll } from '../services/map.service.js';
import { listSchedulesForUser } from '../services/scheduler.service.js';

/**
 * GET /api/dashboard/stats — the four KPI numbers on the dashboard, scoped to
 * what the caller may see. Reuses `listAll`/`listSchedulesForUser` (the same
 * entitlement rules as the Maps and Schedules pages) rather than an unscoped
 * count, so a non-admin never sees another user's totals.
 */
export default function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/dashboard/stats',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const user = request.user as { sub: string; role: string };

      const [visibleMaps, mySchedules] = await Promise.all([
        listAll(user),
        listSchedulesForUser(user.sub),
      ]);
      const mapIds = visibleMaps.map((m) => m.id);
      const scheduleIds = mySchedules.map((s) => s.id);

      const [executionRow, resultRow] = await Promise.all([
        mapIds.length
          ? db
              .select({ value: count() })
              .from(queryExecutionLog)
              .where(inArray(queryExecutionLog.mapId, mapIds))
          : [{ value: 0 }],
        scheduleIds.length
          ? db
              .select({ value: count() })
              .from(scheduledResults)
              .where(inArray(scheduledResults.scheduleId, scheduleIds))
          : [{ value: 0 }],
      ]);

      const scheduledMaps = new Set(
        mySchedules.filter((s) => s.isActive).map((s) => s.mapId),
      ).size;

      return {
        data: {
          totalExecutions: executionRow[0]?.value ?? 0,
          scheduledMaps,
          scheduledResults: resultRow[0]?.value ?? 0,
        },
      };
    },
  );
}
