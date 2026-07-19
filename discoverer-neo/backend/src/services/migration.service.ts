/**
 * Migration service — drives the `@discoverer-neo/migrate` pipeline from the
 * API so an admin can detect, analyse and run an EUL migration from the UI.
 *
 * Two deliberate design points:
 *
 *  - **Credentials come from the registered data source**, never from the
 *    request. The UI picks an existing `data_sources` row and the password is
 *    decrypted here via `lib/encryption.ts`; no Oracle credential is ever
 *    accepted over HTTP, logged, or returned to a client.
 *  - **The target is this backend's own database.** The migrator writes into
 *    `config.DATABASE_URL` through its own short-lived pool (the migrate
 *    package owns its Drizzle schema), so there is no ambiguity about where a
 *    migration lands and no target connection to configure.
 *
 * Jobs run in-process with an in-memory registry, mirroring the async patterns
 * already used by `map-execution.service.ts` and `export.service.ts`. A
 * migration is a rare, heavyweight admin operation, so exactly one may run at
 * a time; the durable record of what happened is the `migration_log` table the
 * migrator itself writes.
 */

import { randomUUID } from 'node:crypto';

import {
  createExecutor,
  createMigrationWriter,
  createTargetDb,
  detectEulVersion,
  generateAssessmentReport,
  readEulSchema,
  runMigration,
  TARGET_TABLE_ORDER,
} from '@discoverer-neo/migrate';
import type {
  AssessmentReport,
  EulConnectionConfig,
  EulSource,
  EulVersionInfo,
  MigrationEvent,
  MigrationResult,
  MigrationWriter,
} from '@discoverer-neo/migrate';
import { eq } from 'drizzle-orm';

import { config } from '../config.js';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Status codes a MigrationError can carry (kept as literals so Fastify's
 *  response-schema-derived `reply.code()` union accepts them directly). */
export type MigrationErrorStatus = 400 | 401 | 403 | 404 | 409;

export class MigrationError extends Error {
  readonly statusCode: MigrationErrorStatus;

  constructor(message: string, statusCode: MigrationErrorStatus = 400) {
    super(message);
    this.name = 'MigrationError';
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Injectable dependencies (tests substitute a mock Oracle + in-memory writer)
// ---------------------------------------------------------------------------

export interface MigrationTargetHandle {
  writer: MigrationWriter;
  close: () => Promise<void>;
}

export interface MigrationDeps {
  /** Resolve a data source id to Oracle connection details. */
  loadConnection: (dataSourceId: string) => Promise<EulConnectionConfig>;
  /** Build an EUL source (a pooled Oracle executor) from those details. */
  makeSource: (connection: EulConnectionConfig) => EulSource;
  /** Open the target (this backend's own database). */
  makeTarget: () => MigrationTargetHandle;
}

/**
 * Load an Oracle data source and decrypt its password. Mirrors the connect
 * string construction in `data-source.service.ts`.
 */
export async function loadEulConnection(dataSourceId: string): Promise<EulConnectionConfig> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new MigrationError('Data source not found', 404);
  if (ds.connectionType !== 'oracle') {
    throw new MigrationError('Migration source must be an Oracle data source', 400);
  }
  if (!ds.username) {
    throw new MigrationError('Data source has no username configured', 400);
  }
  const password = ds.passwordEnc ? decrypt(ds.passwordEnc) : '';
  if (!password) {
    throw new MigrationError('Data source has no stored password; set one before migrating', 400);
  }

  const connection: EulConnectionConfig = { user: ds.username, password };
  if (ds.connectionString) {
    connection.connectString = ds.connectionString;
  } else {
    if (!ds.host || (!ds.serviceName && !ds.sid)) {
      throw new MigrationError(
        'Data source needs either a connection string, or a host plus service name/SID',
        400,
      );
    }
    connection.host = ds.host;
    connection.port = ds.port ?? 1521;
    if (ds.serviceName) connection.serviceName = ds.serviceName;
    if (ds.sid) connection.sid = ds.sid;
  }
  return connection;
}

export function defaultDeps(): MigrationDeps {
  return {
    loadConnection: loadEulConnection,
    makeSource: (connection) => createExecutor(connection),
    makeTarget: () => {
      const target = createTargetDb({ connectionString: config.DATABASE_URL });
      return { writer: createMigrationWriter(target.db), close: target.close };
    },
  };
}

// ---------------------------------------------------------------------------
// Read-only operations
// ---------------------------------------------------------------------------

export interface SourceOptions {
  dataSourceId: string;
  schemaOwner?: string;
}

export async function detectVersion(
  options: SourceOptions,
  deps: MigrationDeps = defaultDeps(),
): Promise<EulVersionInfo> {
  const connection = await deps.loadConnection(options.dataSourceId);
  const source = deps.makeSource(connection);
  return detectEulVersion(source, { schemaOwner: options.schemaOwner });
}

export async function analyzeSource(
  options: SourceOptions,
  deps: MigrationDeps = defaultDeps(),
): Promise<AssessmentReport> {
  const connection = await deps.loadConnection(options.dataSourceId);
  const source = deps.makeSource(connection);
  const eul = await readEulSchema(source, { schemaOwner: options.schemaOwner });
  return generateAssessmentReport(eul);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type MigrationJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface MigrationLogLine {
  level: 'INFO' | 'WARN' | 'ERROR';
  phase: string;
  message: string;
  at: string;
}

export interface MigrationJob {
  id: string;
  status: MigrationJobStatus;
  dataSourceId: string;
  dryRun: boolean;
  requestedVersion: 'auto' | 'EUL4' | 'EUL5';
  detectedVersion: string | null;
  startedBy: string;
  startedAt: string;
  finishedAt: string | null;
  /** 0–100, derived from target tables completed. */
  progress: number;
  currentPhase: string | null;
  logs: MigrationLogLine[];
  /** Number of log lines dropped from the head once the buffer filled. */
  droppedLogs: number;
  result: MigrationResult | null;
  error: string | null;
}

/** Keep memory bounded: a big migration can emit a lot of log lines. */
const MAX_LOG_LINES = 500;
/** How many finished jobs to retain for the UI. */
const MAX_JOBS = 20;

const jobs = new Map<string, MigrationJob>();

function pruneJobs(): void {
  if (jobs.size <= MAX_JOBS) return;
  const ordered = [...jobs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const job of ordered.slice(0, jobs.size - MAX_JOBS)) {
    if (job.status !== 'RUNNING') jobs.delete(job.id);
  }
}

export function getJob(jobId: string): MigrationJob | null {
  return jobs.get(jobId) ?? null;
}

export function listJobs(): MigrationJob[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function hasRunningJob(): boolean {
  return [...jobs.values()].some((j) => j.status === 'RUNNING');
}

/** Test-only: clear the in-memory registry between cases. */
export function resetJobs(): void {
  jobs.clear();
}

export interface StartMigrationOptions extends SourceOptions {
  dryRun?: boolean;
  version?: 'auto' | 'EUL4' | 'EUL5';
  startedBy: string;
  /**
   * Called once the job settles, successfully or not.
   *
   * A migration writes business areas, folders and items directly, bypassing
   * the routes that would otherwise invalidate their cache entries — and it
   * does so long after the HTTP request returned, so the caller cannot simply
   * invalidate inline. The route supplies a hook that drops the metadata cache.
   * Kept as a callback rather than a Redis dependency so the service (and its
   * injected-deps tests) stay free of a cache import. Errors thrown here are
   * swallowed: a failed cache flush must not mark a completed migration failed.
   */
  onSettled?: () => void | Promise<void>;
}

/**
 * Start a migration job. Returns immediately with the job record; poll
 * `getJob(id)` for progress. Only one migration may run at a time.
 */
export function startMigration(
  options: StartMigrationOptions,
  deps: MigrationDeps = defaultDeps(),
): MigrationJob {
  if (hasRunningJob()) {
    throw new MigrationError('A migration is already running; wait for it to finish', 409);
  }

  const job: MigrationJob = {
    id: randomUUID(),
    status: 'RUNNING',
    dataSourceId: options.dataSourceId,
    dryRun: options.dryRun === true,
    requestedVersion: options.version ?? 'auto',
    detectedVersion: null,
    startedBy: options.startedBy,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    progress: 0,
    currentPhase: 'starting',
    logs: [],
    droppedLogs: 0,
    result: null,
    error: null,
  };
  jobs.set(job.id, job);
  pruneJobs();

  const append = (line: MigrationLogLine): void => {
    job.logs.push(line);
    if (job.logs.length > MAX_LOG_LINES) {
      job.logs.shift();
      job.droppedLogs += 1;
    }
  };

  const tableTotal = TARGET_TABLE_ORDER.length;
  const completedTables = new Set<string>();

  const onEvent = (event: MigrationEvent): void => {
    job.currentPhase = event.phase;
    if (event.type === 'progress') {
      completedTables.add(event.phase);
      // Reads/transforms occupy the first 10%; table writes the remaining 90%.
      job.progress = Math.min(99, 10 + Math.round((completedTables.size / tableTotal) * 90));
    } else {
      append({
        level: event.level,
        phase: event.phase,
        message: event.message,
        at: new Date().toISOString(),
      });
      if (event.phase === 'read' && event.message.startsWith('Source is ')) {
        job.detectedVersion = event.message.replace('Source is ', '').split(' ')[0] ?? null;
      }
      if (job.progress < 10) job.progress = 5;
    }
  };

  // Fire-and-forget: the HTTP request returns the job id immediately.
  void (async () => {
    let target: MigrationTargetHandle | null = null;
    try {
      const connection = await deps.loadConnection(options.dataSourceId);
      const source = deps.makeSource(connection);
      target = deps.makeTarget();

      const result = await runMigration({
        source,
        writer: target.writer,
        readOptions: { schemaOwner: options.schemaOwner },
        version: options.version ?? 'auto',
        dryRun: options.dryRun === true,
        onEvent,
      });

      job.result = result;
      job.detectedVersion = result.version.version;
      job.status = 'COMPLETED';
      job.progress = 100;
      job.currentPhase = 'done';
    } catch (err) {
      job.status = 'FAILED';
      job.error = err instanceof Error ? err.message : String(err);
      job.currentPhase = 'failed';
      append({
        level: 'ERROR',
        phase: 'failed',
        message: job.error,
        at: new Date().toISOString(),
      });
    } finally {
      job.finishedAt = new Date().toISOString();
      if (target) {
        try {
          await target.close();
        } catch {
          // The pool is being discarded anyway.
        }
      }
      // Runs on the failure path too: a migration that died partway through
      // may still have committed rows, so the cache is suspect either way.
      try {
        await options.onSettled?.();
      } catch {
        // Best-effort — see StartMigrationOptions.onSettled.
      }
    }
  })();

  return job;
}
