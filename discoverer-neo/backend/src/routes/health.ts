import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { getOracleClientStatus } from '../services/oracle-connection-pool.js';

/** Version — kept in sync with package.json. */
const version = '0.1.0';

async function checkDatabase(): Promise<'connected' | 'disconnected'> {
  try {
    await db.execute(sql`SELECT 1`);
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

/**
 * ioredis queues and retries a command against a down Redis rather than
 * rejecting it (no `maxRetriesPerRequest`/connect timeout is set on the
 * client in plugins/redis.ts) — found running docker-compose.prod against a
 * stopped Redis, where an unbounded `ping()` turned a readiness check into a
 * 504 tens of seconds later instead of the prompt 503 an orchestrator needs.
 * Bounding the wait here, rather than reconfiguring the shared client, keeps
 * the client's own reconnect behaviour (used elsewhere) untouched.
 */
const REDIS_PING_TIMEOUT_MS = 2000;

async function checkRedis(fastify: FastifyInstance): Promise<'connected' | 'disconnected'> {
  try {
    await Promise.race([
      fastify.redis.ping(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error('Redis ping timed out')), REDIS_PING_TIMEOUT_MS),
      ),
    ]);
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

const readinessSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
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
};

export default function healthRoutes(fastify: FastifyInstance) {
  // Readiness — can this instance actually serve traffic. Registered at
  // /health (container healthchecks, and the infra-facing path nginx proxies
  // straight to the backend) and /api/health (frontend dev proxy, which
  // forwards /api/* without rewriting). Returns 503 when Postgres or Redis is
  // unreachable (INF-02) — an orchestrator or load balancer must stop routing
  // to an instance that cannot actually do its job, not see a bare 200.
  for (const path of ['/health', '/api/health'] as const) {
    fastify.get(
      path,
      {
        schema: {
          tags: ['Health'],
          response: { 200: readinessSchema, 503: readinessSchema },
        },
      },
      async (_request, reply) => {
        const [database, redis] = await Promise.all([
          checkDatabase(),
          checkRedis(fastify),
        ]);
        const ready = database === 'connected' && redis === 'connected';
        if (!ready) reply.code(503);

        return {
          status: ready ? 'ok' : 'degraded',
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

  // Liveness — is the process itself still running and able to respond, with
  // no dependency checks. A Postgres or Redis outage must not make an
  // orchestrator kill and restart a backend that would come back up just as
  // unable to reach them; that decision belongs to readiness (/health) above.
  for (const path of ['/live', '/api/live'] as const) {
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
                uptime: { type: 'number' },
              },
            },
          },
        },
      },
      () => ({ status: 'ok' as const, uptime: process.uptime() }),
    );
  }
}
