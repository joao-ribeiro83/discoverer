import type { FastifyInstance } from 'fastify';
import { listWorkbooksWithMaps } from '../services/workbook.service.js';

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
}
