import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from './plugins/cors.js';
import helmet from './plugins/helmet.js';
import sensible from './plugins/sensible.js';
import swagger from './plugins/swagger.js';
import auth from './plugins/auth.js';
import redis from './plugins/redis.js';
import metrics from './plugins/metrics.js';
import audit from './plugins/audit.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import dataSourcesRoutes from './routes/data-sources.js';
import businessAreasRoutes from './routes/business-areas.js';
import folderRoutes from './routes/folders.js';
import itemRoutes from './routes/items.js';
import joinRoutes from './routes/joins.js';
import hierarchyRoutes from './routes/hierarchies.js';
import customFunctionRoutes from './routes/custom-functions.js';
import userRoutes from './routes/users.js';
import userPreferencesRoutes from './routes/user-preferences.js';
import mapRoutes from './routes/maps.js';
import mapShareRoutes from './routes/map-shares.js';
import mapExecutionRoutes from './routes/map-execution.js';
import exportRoutes from './routes/export.js';
import scheduleRoutes from './routes/schedules.js';
import securityRoutes from './routes/security.js';
import migrationRoutes from './routes/migration.js';
import auditRoutes from './routes/audit.js';
import { closeAll as closeOraclePools } from './services/oracle-connection-pool.js';
import { config } from './config.js';
import { closeExportQueue } from './queues/export.queue.js';
import { startExportWorker, type ExportWorkerHandle } from './workers/export.worker.js';
import { closeSchedulerQueue } from './queues/scheduler.queue.js';
import { startSchedulerWorker, type SchedulerWorkerHandle } from './workers/scheduler.worker.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Global error handler — must be set BEFORE routes are registered:
  // Fastify snapshots the active error handler into each route's context
  // at registration time, so a handler set afterwards never applies.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    request.log.error({ err: error }, 'Unhandled error');

    // Fastify v5 schema-validation failures carry a generic message; the
    // useful part lives in error.validation.
    let message = statusCode >= 500 ? 'Internal Server Error' : error.message;
    if (Array.isArray(error.validation) && error.validation.length > 0) {
      const context = error.validationContext ?? 'body';
      message = error.validation
        .map(
          (v: { instancePath?: string; message?: string }) =>
            `${context}${v.instancePath ?? ''} ${v.message ?? 'is invalid'}`,
        )
        .join('; ');
    }

    reply.code(statusCode).send({
      error: message,
      statusCode,
    });
  });

  // Plugins (order matters: sensible first for error helpers)
  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors);
  await app.register(redis);
  await app.register(auth);
  await app.register(swagger);
  await app.register(metrics);
  await app.register(audit);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(dataSourcesRoutes);
  await app.register(businessAreasRoutes);
  await app.register(folderRoutes);
  await app.register(itemRoutes);
  await app.register(joinRoutes);
  await app.register(hierarchyRoutes);
  await app.register(customFunctionRoutes);
  await app.register(userRoutes);
  await app.register(userPreferencesRoutes);
  await app.register(mapRoutes);
  await app.register(mapShareRoutes);
  await app.register(mapExecutionRoutes);
  await app.register(exportRoutes);
  await app.register(scheduleRoutes);
  await app.register(securityRoutes);
  await app.register(migrationRoutes);
  await app.register(auditRoutes);

  // The export worker runs in this process by default. It is started here
  // rather than in `server.ts` so tests and any other `buildApp` caller get the
  // same lifecycle. Set EXPORT_WORKER_ENABLED=false and run
  // `npm run worker` (src/workers/export.standalone.ts) to host it separately —
  // the worker code is identical either way.
  let exportWorker: ExportWorkerHandle | undefined;
  if (config.EXPORT_WORKER_ENABLED) {
    exportWorker = startExportWorker(app.log);
  }

  // Same in-process-by-default / standalone-ready split as the export worker
  // (see `workers/scheduler.standalone.ts`).
  let schedulerWorker: SchedulerWorkerHandle | undefined;
  if (config.SCHEDULER_WORKER_ENABLED) {
    schedulerWorker = startSchedulerWorker(app.log);
  }

  app.addHook('onClose', async () => {
    // Order matters: let in-flight exports/scheduled runs finish (or at
    // least stop pulling new jobs) before tearing down what they depend on.
    // Redis itself is closed by plugins/redis.ts's own onClose hook, which
    // Fastify runs as part of the same close() call.
    //
    // The Postgres pool (backend/src/db/index.ts) is deliberately NOT closed
    // here: it is a module-level singleton shared by every `buildApp()`
    // instance in a process, and several test files build more than one app
    // per process (see auth.test.ts) and close them independently mid-test —
    // ending the pool from a per-app hook would permanently break every
    // instance after the first close(). It is closed once, for the real
    // process only, in server.ts's shutdown handler.
    app.log.info('Stopping export/scheduler workers...');
    await exportWorker?.close();
    await schedulerWorker?.close();
    await closeExportQueue();
    await closeSchedulerQueue();

    app.log.info('Closing Oracle connection pools...');
    await closeOraclePools();
  });

  return app;
}
