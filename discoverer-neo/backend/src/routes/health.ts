import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { getOracleClientStatus } from '../services/oracle-connection-pool.js';

/** Version — kept in sync with package.json. */
const version = '0.1.0';

export default function healthRoutes(fastify: FastifyInstance) {
  // Registered at /health (container healthchecks) and /api/health
  // (frontend dev proxy, which forwards /api/* without rewriting).
  for (const path of ['/health', '/api/health'] as const) {
  fastify.get(
    path,
    {
      schema: {
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              version: { type: 'string' },
              uptime: { type: 'number' },
              database: { type: 'string', enum: ['connected', 'disconnected'] },
              redis: { type: 'string', enum: ['connected', 'disconnected'] },
              oracleClient: {
                type: 'string',
                enum: ['thin', 'thick_ready', 'thick_unavailable'],
              },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => {
      // Test database connectivity
      let database: 'connected' | 'disconnected' = 'disconnected';
      try {
        await db.execute(sql`SELECT 1`);
        database = 'connected';
      } catch {
        database = 'disconnected';
      }

      // Test Redis connectivity
      let redis: 'connected' | 'disconnected' = 'disconnected';
      try {
        await fastify.redis.ping();
        redis = 'connected';
      } catch {
        redis = 'disconnected';
      }

      return {
        status: 'ok' as const,
        version,
        uptime: process.uptime(),
        database,
        redis,
        oracleClient: getOracleClientStatus(),
        timestamp: new Date().toISOString(),
      };
    },
  );
  }
}
