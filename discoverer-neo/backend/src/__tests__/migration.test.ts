/**
 * Migration API + service tests.
 *
 * The HTTP layer is exercised against the real app (auth, validation, error
 * mapping). The pipeline itself is exercised at the service level with
 * injected dependencies — a mock Oracle source and an in-memory target, both
 * reused from `@discoverer-neo/core/testing` — so no Oracle is needed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { eq } from 'drizzle-orm';

import { createFakeWriter, eul4Db, eul5Db, mockExecutor } from '@discoverer-neo/core/testing';
import type { EulConnectionConfig } from '@discoverer-neo/core/migration';

import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { dataSources, users } from '../db/schema.js';
import { encrypt } from '../lib/encryption.js';
import { hashPassword } from '../lib/password.js';
import {
  MigrationError,
  loadEulConnection,
  getJob,
  resetJobs,
  startMapReimport,
  startMigration,
} from '../services/migration.service.js';
import type { MigrationDeps, MigrationJob } from '../services/migration.service.js';

let app: FastifyInstance;

const TEST_PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'migration-admin@example.com';
const USER_EMAIL = 'migration-user@example.com';
const ORACLE_DS = 'migration-test-oracle';
const ORACLE_DS_CONNSTR = 'migration-test-oracle-connstr';
const PG_DS = 'migration-test-postgres';
const NO_PASSWORD_DS = 'migration-test-nopass';

let adminToken: string;
let userToken: string;
let oracleDsId: string;
let oracleConnStrDsId: string;
let pgDsId: string;
let noPasswordDsId: string;

async function createUser(email: string, role: 'ADMIN' | 'USER') {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: email, role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  // Matches the sibling suites' convention; fastify's inject json() is `any`,
  // and the no-unsafe-* / no-unnecessary-type-assertion rules conflict here.
  return res.json().data.token as string;
}

async function cleanup() {
  for (const email of [ADMIN_EMAIL, USER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
  for (const name of [ORACLE_DS, ORACLE_DS_CONNSTR, PG_DS, NO_PASSWORD_DS]) {
    await db.delete(dataSources).where(eq(dataSources.name, name));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await cleanup();

  await createUser(ADMIN_EMAIL, 'ADMIN');
  await createUser(USER_EMAIL, 'USER');
  adminToken = await login(ADMIN_EMAIL);
  userToken = await login(USER_EMAIL);

  const [oracle] = await db
    .insert(dataSources)
    .values({
      name: ORACLE_DS,
      connectionType: 'oracle',
      host: 'ora.example.com',
      port: 1521,
      serviceName: 'ORCL',
      username: 'EUL5_US',
      passwordEnc: encrypt('secret-password'),
    })
    .returning();
  oracleDsId = oracle!.id;

  const [oracleConnStr] = await db
    .insert(dataSources)
    .values({
      name: ORACLE_DS_CONNSTR,
      connectionType: 'oracle',
      username: 'EUL5_US',
      passwordEnc: encrypt('secret-password'),
      connectionString: 'ora.example.com:1521/ORCL',
    })
    .returning();
  oracleConnStrDsId = oracleConnStr!.id;

  const [pg] = await db
    .insert(dataSources)
    .values({
      name: PG_DS,
      connectionType: 'postgres',
      host: 'pg.example.com',
      port: 5432,
      username: 'neo',
      passwordEnc: encrypt('pw'),
    })
    .returning();
  pgDsId = pg!.id;

  const [noPass] = await db
    .insert(dataSources)
    .values({
      name: NO_PASSWORD_DS,
      connectionType: 'oracle',
      host: 'ora.example.com',
      port: 1521,
      serviceName: 'ORCL',
      username: 'EUL5_US',
    })
    .returning();
  noPasswordDsId = noPass!.id;
});

afterAll(async () => {
  resetJobs();
  await cleanup();
  await app.close();
});

beforeEach(() => {
  resetJobs();
});

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

describe('loadEulConnection', () => {
  it('builds a connection from host/port/serviceName and decrypts the password', async () => {
    const conn = await loadEulConnection(oracleDsId);
    expect(conn).toMatchObject({
      user: 'EUL5_US',
      password: 'secret-password',
      host: 'ora.example.com',
      port: 1521,
      serviceName: 'ORCL',
    });
  });

  it('prefers an explicit connection string when present', async () => {
    const conn = await loadEulConnection(oracleConnStrDsId);
    expect(conn.connectString).toBe('ora.example.com:1521/ORCL');
    expect(conn.host).toBeUndefined();
  });

  it('rejects a non-Oracle data source', async () => {
    await expect(loadEulConnection(pgDsId)).rejects.toBeInstanceOf(MigrationError);
    await expect(loadEulConnection(pgDsId)).rejects.toThrow(/must be an Oracle data source/);
  });

  it('rejects a data source with no stored password', async () => {
    await expect(loadEulConnection(noPasswordDsId)).rejects.toThrow(/no stored password/);
  });

  it('404s for an unknown data source', async () => {
    await expect(
      loadEulConnection('00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ---------------------------------------------------------------------------
// Route auth + validation
// ---------------------------------------------------------------------------

const ROUTES: InjectOptions[] = [
  { method: 'POST', url: '/api/migration/detect', payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' } },
  { method: 'POST', url: '/api/migration/analyze', payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' } },
  { method: 'POST', url: '/api/migration/run', payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' } },
  { method: 'POST', url: '/api/migration/reimport-maps', payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' } },
  { method: 'GET', url: '/api/migration/jobs' },
];

describe('migration routes — authorization', () => {
  it.each(ROUTES)('$method $url requires authentication', async (route) => {
    const res = await app.inject(route);
    expect(res.statusCode).toBe(401);
  });

  it.each(ROUTES)('$method $url rejects a non-admin user', async (route) => {
    const res = await app.inject({
      ...route,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows an admin to list jobs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/migration/jobs',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

describe('migration routes — validation', () => {
  it('rejects a missing/invalid dataSourceId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/migration/detect',
      payload: { dataSourceId: 'not-a-uuid' },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a missing/invalid dataSourceId on reimport-maps', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/migration/reimport-maps',
      payload: { dataSourceId: 'not-a-uuid' },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s for an unknown data source on detect', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/migration/detect',
      payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('rejects a non-Oracle data source on run', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/migration/run',
      payload: { dataSourceId: pgDsId },
      headers: { authorization: `Bearer ${adminToken}` },
    });
    // The job starts, then fails asynchronously on the connection load; the
    // synchronous guard is only for a concurrent run, so this returns 202.
    expect(res.statusCode).toBe(202);
    const job = res.json().data as MigrationJob;
    const finished = await waitForJob(job.id);
    expect(finished.status).toBe('FAILED');
    expect(finished.error).toMatch(/must be an Oracle data source/);
  });

  it('400s on a malformed job id and 404s on an unknown one', async () => {
    const bad = await app.inject({
      method: 'GET',
      url: '/api/migration/jobs/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(bad.statusCode).toBe(400);

    const missing = await app.inject({
      method: 'GET',
      url: '/api/migration/jobs/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(missing.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Job lifecycle (service level, injected deps)
// ---------------------------------------------------------------------------

async function waitForJob(id: string, timeoutMs = 15000): Promise<MigrationJob> {
  const started = Date.now();
  for (;;) {
    const job = getJob(id);
    if (job && job.status !== 'RUNNING') return job;
    if (Date.now() - started > timeoutMs) throw new Error(`job ${id} did not finish in time`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const CONNECTION: EulConnectionConfig = {
  user: 'EUL5_US',
  password: 'x',
  connectString: 'ora.example.com/ORCL',
};

function testDeps(overrides: Partial<MigrationDeps> = {}) {
  const fake = createFakeWriter();
  let closed = false;
  const deps: MigrationDeps = {
    loadConnection: () => Promise.resolve(CONNECTION),
    makeSource: () => mockExecutor(eul5Db()),
    makeTarget: () => ({
      writer: fake.writer,
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    }),
    ...overrides,
  };
  return { deps, fake, wasClosed: () => closed };
}

describe('startMigration', () => {
  it('runs a migration to completion and reports version, progress and logs', async () => {
    const { deps, fake, wasClosed } = testDeps();
    const started = startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);

    expect(started.status).toBe('RUNNING');
    const job = await waitForJob(started.id);

    expect(job.status).toBe('COMPLETED');
    expect(job.detectedVersion).toBe('EUL5');
    expect(job.progress).toBe(100);
    expect(job.error).toBeNull();
    expect(job.logs.length).toBeGreaterThan(0);
    expect(job.result?.validation?.valid).toBe(true);

    // Rows really landed in the (in-memory) target.
    expect(fake.state.tables.business_areas.length).toBeGreaterThan(0);
    // CO (database items) + CI (created item) — CO is the plain
    // column-backed item the pre-ground-truth reader silently skipped.
    expect(fake.state.tables.items).toHaveLength(3);
    // The target connection is always released.
    expect(wasClosed()).toBe(true);
  });

  it('migrates an EUL4 source and reports EUL4', async () => {
    const { deps, fake } = testDeps({ makeSource: () => mockExecutor(eul4Db()) });
    const started = startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);
    const job = await waitForJob(started.id);

    expect(job.status).toBe('COMPLETED');
    expect(job.detectedVersion).toBe('EUL4');
    // KEY_CONS has no confirmed join-type column, so joins default to INNER.
    expect(fake.state.tables.joins[0]?.joinType).toBe('INNER');
  });

  it('honours a dry run — nothing is written', async () => {
    const { deps, fake } = testDeps();
    const started = startMigration(
      { dataSourceId: oracleDsId, startedBy: 'tester', dryRun: true },
      deps,
    );
    const job = await waitForJob(started.id);

    expect(job.status).toBe('COMPLETED');
    expect(job.dryRun).toBe(true);
    expect(fake.state.tables.business_areas).toHaveLength(0);
    expect(fake.state.ensureSchemaCalls).toBe(0);
    expect(job.result?.planned.business_areas).toBeGreaterThan(0);
  });

  it('records a failure instead of throwing', async () => {
    const { deps, wasClosed } = testDeps({
      makeSource: () => () => Promise.reject(new Error('ORA-01017: invalid username/password')),
    });
    const started = startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);
    const job = await waitForJob(started.id);

    expect(job.status).toBe('FAILED');
    expect(job.error).toMatch(/ORA-01017/);
    expect(job.logs.some((l) => l.level === 'ERROR')).toBe(true);
    expect(wasClosed()).toBe(true);
  });

  it('refuses to start a second migration while one is running', async () => {
    // Hold the first job open until we have asserted the guard.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { deps } = testDeps({
      makeSource: () => {
        const inner = mockExecutor(eul5Db());
        return async (sql, binds) => {
          await gate;
          return inner(sql, binds);
        };
      },
    });

    const first = startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);
    expect(() =>
      startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps),
    ).toThrow(/already running/);

    release();
    const job = await waitForJob(first.id);
    expect(job.status).toBe('COMPLETED');
  });

  it('applies a version override', async () => {
    const { deps } = testDeps();
    const started = startMigration(
      { dataSourceId: oracleDsId, startedBy: 'tester', version: 'EUL4' },
      deps,
    );
    const job = await waitForJob(started.id);

    expect(job.requestedVersion).toBe('EUL4');
    // The fixture is a pure EUL5 schema, so detection wins and warns.
    expect(job.detectedVersion).toBe('EUL5');
    expect(job.logs.some((l) => l.level === 'WARN' && l.message.includes('Requested version EUL4'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Maps-only re-import
// ---------------------------------------------------------------------------

describe('startMapReimport', () => {
  it('rebuilds the maps of a target that has already been migrated', async () => {
    const { deps, fake } = testDeps();
    // Phase 1: the database is migrated.
    const migration = await waitForJob(
      startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps).id,
    );
    expect(migration.status).toBe('COMPLETED');
    const mapsBefore = fake.state.tables.maps.map((m) => m.id);

    // Phase 2: only the maps are re-imported.
    const started = startMapReimport({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);
    expect(started.kind).toBe('MAPS');
    const job = await waitForJob(started.id);

    expect(job.status).toBe('COMPLETED');
    expect(job.progress).toBe(100);
    expect(job.result).toBeNull();
    expect(job.mapsResult?.replacedMaps).toBe(mapsBefore.length);
    expect(job.mapsResult?.written.maps).toBe(mapsBefore.length);
    expect(job.mapsResult?.written.map_items).toBeGreaterThan(0);

    // The maps are new rows, and the rest of the migration is still there.
    expect(fake.state.tables.maps.some((m) => mapsBefore.includes(m.id as string))).toBe(false);
    expect(fake.state.tables.items.length).toBeGreaterThan(0);
    expect(fake.state.tables.folders.length).toBeGreaterThan(0);
  });

  it('honours a dry run', async () => {
    const { deps, fake } = testDeps();
    await waitForJob(startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps).id);
    const mapsBefore = fake.state.tables.maps.map((m) => m.id);

    const job = await waitForJob(
      startMapReimport({ dataSourceId: oracleDsId, startedBy: 'tester', dryRun: true }, deps).id,
    );

    expect(job.status).toBe('COMPLETED');
    expect(job.mapsResult?.written.maps).toBe(0);
    expect(job.mapsResult?.planned.maps).toBeGreaterThan(0);
    expect(fake.state.tables.maps.map((m) => m.id)).toEqual(mapsBefore);
  });

  it('fails cleanly against a database that was never migrated', async () => {
    const { deps } = testDeps();
    const job = await waitForJob(
      startMapReimport({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps).id,
    );

    expect(job.status).toBe('FAILED');
    expect(job.error).toMatch(/Migrated Workbooks|never migrated|full migration/i);
  });

  it('refuses to start while another job is running', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { deps } = testDeps({
      loadConnection: async () => {
        await gate;
        return CONNECTION;
      },
    });

    const first = startMigration({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps);
    expect(() =>
      startMapReimport({ dataSourceId: oracleDsId, startedBy: 'tester' }, deps),
    ).toThrow(/already running/);

    release();
    await waitForJob(first.id);
  });
});
