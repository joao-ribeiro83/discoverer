import fp from 'fastify-plugin';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
} from 'prom-client';

// ---------------------------------------------------------------------------
// Metrics.
//
// The minimum needed to answer one question: does running the export worker
// in-process degrade API responsiveness? `collectDefaultMetrics` supplies
// `nodejs_eventloop_lag_seconds` (and its p50/p90/p99 variants) for free — read
// against the export queue gauges below, that shows whether a long-running
// export is starving request handling, which is the evidence for moving the
// worker to its own container rather than guessing.
// ---------------------------------------------------------------------------

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  // Tuned for an API where anything past a second is already a problem.
  buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const exportQueueDepth = new Gauge({
  name: 'export_queue_jobs',
  help: 'Export jobs in the queue by state',
  labelNames: ['state'],
  registers: [registry],
});

const exportJobsTotal = new Counter({
  name: 'export_jobs_total',
  help: 'Export jobs finished, by outcome',
  labelNames: ['outcome'],
  registers: [registry],
});

export function setExportQueueDepth(counts: Record<string, number>): void {
  for (const [state, value] of Object.entries(counts)) {
    exportQueueDepth.set({ state }, value);
  }
}

export function recordExportOutcome(outcome: 'completed' | 'failed'): void {
  exportJobsTotal.inc({ outcome });
}

export default fp(
  async (fastify) => {
    fastify.addHook('onResponse', (request, reply, done) => {
      // `routeOptions.url` is the route *pattern* ('/api/exports/:jobId'), not
      // the resolved path — labelling with the latter would mint a new time
      // series per job id and blow up cardinality.
      const route = request.routeOptions?.url ?? 'unknown';
      httpRequestDuration.observe(
        {
          method: request.method,
          route,
          status_code: String(reply.statusCode),
        },
        reply.elapsedTime / 1000,
      );
      done();
    });

    // Unauthenticated on purpose: a scrape endpoint must be reachable by
    // Prometheus, which does not hold a JWT. It exposes no business data, and
    // is expected to be reachable only from inside the compose network — do
    // not route it through the public ingress.
    fastify.get(
      '/metrics',
      { schema: { tags: ['Health'], hide: true } },
      async (_request, reply) => {
        reply.header('content-type', registry.contentType);
        return reply.send(await registry.metrics());
      },
    );
  },
  { name: 'metrics' },
);
