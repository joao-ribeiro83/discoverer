import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { and, eq, gte, inArray, like, sql } from 'drizzle-orm';

import {
  createMigrationWriter,
  createTargetDb,
  dryRun,
  runMigration,
  TARGET_TABLE_ORDER,
  type MigrationWriter,
  type TargetTable,
} from '@discoverer-neo/migrate';
import { eul5Db, mockExecutor } from '@discoverer-neo/migrate/testing';

import { getApp } from './test-helper.js';
import { db } from '../../db/index.js';
import {
  auditLog,
  businessAreas,
  customFunctions,
  folders,
  hierarchies,
  hierarchyLevels,
  items,
  joins,
  mapItems,
  maps,
  userBusinessAreaGrants,
  users,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import * as auditService from '../../services/audit.service.js';

// ===========================================================================
// Migration (real Postgres) + audit-trail integration tests (Session 5.7)
//
// MIGRATION: reads a mock Oracle EUL5 source (the migrate package's own
// fixtures — no real Oracle) and runs the real transform/FK-resolution/write
// pipeline into the REAL Postgres target through the production Drizzle writer.
// To stay isolated from the shared dev DB, every migrated row is minted with a
// recognisable UUID prefix (see PREFIX) so it can be counted and cleaned up
// precisely; the target DB otherwise expects to be fresh.
//
// AUDIT: drives the real Fastify app and asserts the global audit plugin logged
// the mutating security / sharing / migration / auth requests with the right
// entityType / entityId / userId, and that the query/history/stats reads work.
// ===========================================================================

// ---------------------------------------------------------------------------
// Migration: deterministic id minting with a scoped prefix.
// ---------------------------------------------------------------------------

// A valid-UUID prefix that no other fixture in this repo uses, so we can find
// and delete exactly the rows this migration wrote.
const PREFIX = 'a5757a5c-0000-4000-8000-';
function scopedIdFactory() {
  let n = 0;
  return () => {
    n += 1;
    return `${PREFIX}${String(n).padStart(12, '0')}`;
  };
}
const FIXED_NOW = () => new Date('2026-07-19T00:00:00.000Z');

// Distinctive names/emails the EUL5 fixture produces — cleaned defensively in
// case business_areas.name / users.email (both UNIQUE) linger from a prior run.
const MIGRATED_BA_NAMES = ['Sales Analysis', 'Migrated Workbooks'];
const MIGRATED_EMAILS = ['migration@migrated.local', 'jsmith@migrated.local', 'mjones@migrated.local'];

function realTarget(): { writer: MigrationWriter; close: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set for the migration integration test');
  const target = createTargetDb({ connectionString });
  return { writer: createMigrationWriter(target.db), close: target.close };
}

const idLike = (col: unknown) => like(sql`${col}::text`, `${PREFIX}%`);

/** Delete every row this suite's migration wrote, in reverse FK order. */
async function cleanupMigratedRows(): Promise<void> {
  // Reverse dependency order so children go before parents.
  await db.delete(userBusinessAreaGrants).where(idLike(userBusinessAreaGrants.id));
  await db.delete(mapItems).where(idLike(mapItems.id));
  await db.delete(maps).where(idLike(maps.id));
  await db.delete(customFunctions).where(idLike(customFunctions.id));
  await db.delete(hierarchyLevels).where(idLike(hierarchyLevels.id));
  await db.delete(hierarchies).where(idLike(hierarchies.id));
  await db.delete(joins).where(idLike(joins.id));
  await db.delete(items).where(idLike(items.id));
  await db.delete(folders).where(idLike(folders.id));
  await db.delete(businessAreas).where(idLike(businessAreas.id));
  await db.delete(users).where(idLike(users.id));
  // Belt-and-braces: remove any stragglers by their unique natural keys.
  await db.delete(businessAreas).where(inArray(businessAreas.name, MIGRATED_BA_NAMES));
  await db.delete(users).where(inArray(users.email, MIGRATED_EMAILS));
  // migration_log rows the writer appended (own table; may not exist yet).
  try {
    await db.execute(sql`DELETE FROM migration_log WHERE run_id LIKE ${PREFIX + '%'}`);
  } catch {
    // Table not created until the first real run's ensureSchema — ignore.
  }
}

async function countPrefixed(table: TargetTable): Promise<number> {
  const map: Record<TargetTable, ReturnType<typeof sql>> = {
    users: sql`SELECT count(*)::int AS c FROM users WHERE id::text LIKE ${PREFIX + '%'}`,
    business_areas: sql`SELECT count(*)::int AS c FROM business_areas WHERE id::text LIKE ${PREFIX + '%'}`,
    folders: sql`SELECT count(*)::int AS c FROM folders WHERE id::text LIKE ${PREFIX + '%'}`,
    items: sql`SELECT count(*)::int AS c FROM items WHERE id::text LIKE ${PREFIX + '%'}`,
    joins: sql`SELECT count(*)::int AS c FROM joins WHERE id::text LIKE ${PREFIX + '%'}`,
    hierarchies: sql`SELECT count(*)::int AS c FROM hierarchies WHERE id::text LIKE ${PREFIX + '%'}`,
    hierarchy_levels: sql`SELECT count(*)::int AS c FROM hierarchy_levels WHERE id::text LIKE ${PREFIX + '%'}`,
    custom_functions: sql`SELECT count(*)::int AS c FROM custom_functions WHERE id::text LIKE ${PREFIX + '%'}`,
    maps: sql`SELECT count(*)::int AS c FROM maps WHERE id::text LIKE ${PREFIX + '%'}`,
    map_items: sql`SELECT count(*)::int AS c FROM map_items WHERE id::text LIKE ${PREFIX + '%'}`,
    user_business_area_grants: sql`SELECT count(*)::int AS c FROM user_business_area_grants WHERE id::text LIKE ${PREFIX + '%'}`,
  };
  const result = (await db.execute(map[table])) as unknown as { rows: Array<{ c: number }> };
  return result.rows[0]?.c ?? 0;
}

describe('EUL migration into REAL Postgres', () => {
  beforeAll(async () => {
    await getApp(); // ensure the DB pool/schema are initialised
    await cleanupMigratedRows();
  });

  afterAll(async () => {
    await cleanupMigratedRows();
  });

  it('dry run validates without writing any row to the target', async () => {
    const { writer, close } = realTarget();
    try {
      const result = await dryRun({
        source: mockExecutor(eul5Db()),
        writer,
        deps: { genId: scopedIdFactory(), now: FIXED_NOW },
      });

      expect(result.dryRun).toBe(true);
      expect(result.runId).toBeNull();
      expect(result.version.version).toBe('EUL5');
      // Planned counts are computed…
      expect(result.planned.business_areas).toBeGreaterThan(0);
      expect(result.planned.items).toBe(2);
      // …but nothing landed in Postgres.
      for (const table of TARGET_TABLE_ORDER) {
        expect(result.inserted[table]).toBe(0);
        expect(await countPrefixed(table)).toBe(0);
      }
    } finally {
      await close();
    }
  });

  it('full run lands every entity type in Postgres and reconciles counts', async () => {
    const { writer, close } = realTarget();
    try {
      const result = await runMigration({
        source: mockExecutor(eul5Db()),
        writer,
        deps: { genId: scopedIdFactory(), now: FIXED_NOW },
      });

      expect(result.dryRun).toBe(false);
      expect(result.version.version).toBe('EUL5');
      expect(result.runId).toMatch(/^a5757a5c-/);
      // Post-migration reconciliation passed (baseline+inserted == actual).
      expect(result.validation?.valid).toBe(true);

      // Every entity type actually present in Postgres, per the EUL5 fixture:
      // 2 grantees (JSMITH, MJONES) + the synthetic migration user.
      expect(await countPrefixed('users')).toBe(3);
      // 1 real BA (Sales Analysis) + 1 synthetic workbook-host BA.
      expect(await countPrefixed('business_areas')).toBe(2);
      expect(await countPrefixed('folders')).toBe(2);
      // EXP 300 (CI) + 301 (CU) migrate; 302 (SM security condition) does not.
      expect(await countPrefixed('items')).toBe(2);
      expect(await countPrefixed('joins')).toBe(1);
      expect(await countPrefixed('hierarchies')).toBe(1);
      expect(await countPrefixed('hierarchy_levels')).toBe(2);
      expect(await countPrefixed('custom_functions')).toBe(1);
      expect(await countPrefixed('maps')).toBe(1);
      expect(await countPrefixed('user_business_area_grants')).toBe(2);
    } finally {
      await close();
    }

    // Content check: the migrated business area and folder carry their source
    // names, and the join type survived (LEFT from the EUL fixture).
    const migratedBa = await db
      .select()
      .from(businessAreas)
      .where(eq(businessAreas.name, 'Sales Analysis'));
    expect(migratedBa).toHaveLength(1);

    const migratedFolders = await db
      .select({ name: folders.name })
      .from(folders)
      .where(like(sql`${folders.id}::text`, `${PREFIX}%`));
    expect(migratedFolders.map((f) => f.name)).toEqual(
      expect.arrayContaining(['Invoice Headers', 'Sales Summary']),
    );

    const migratedJoins = await db
      .select({ joinType: joins.joinType })
      .from(joins)
      .where(like(sql`${joins.id}::text`, `${PREFIX}%`));
    expect(migratedJoins[0]?.joinType).toBe('LEFT');
  });

  it('re-running into the now-populated target is rejected (fresh-target invariant)', async () => {
    // The migrator expects a FRESH Discoverer Neo target: the synthetic
    // migration@migrated.local user (and the deterministic ids) collide with
    // the previous run on a UNIQUE constraint, so the whole data transaction
    // rolls back rather than double-inserting. This is the correct
    // "idempotency" behaviour for this tool — a second run into a non-empty
    // target reports the already-migrated condition, it does not silently
    // duplicate. (To truly re-migrate, the target must first be reset.)
    const { writer, close } = realTarget();
    try {
      await expect(
        runMigration({
          source: mockExecutor(eul5Db()),
          writer,
          deps: { genId: scopedIdFactory(), now: FIXED_NOW },
        }),
      ).rejects.toThrow(/already contains a migration|duplicate key|unique/i);

      // The first run's rows are still intact — the failed run rolled back and
      // did not corrupt or duplicate anything.
      expect(await countPrefixed('users')).toBe(3);
      expect(await countPrefixed('business_areas')).toBe(2);
    } finally {
      await close();
    }
  });
});

// ===========================================================================
// Audit trail — the global plugin logs mutating security / sharing / migration
// / auth requests; the audit API filters and reports them.
// ===========================================================================

const PW = 'SecurePass123!';
const NS = 'int57-audit';
const ADMIN_EMAIL = `${NS}-admin@test.com`;
const USER_EMAIL = `${NS}-user@test.com`;
const BA_NAME = 'Int57 Audit Business Area';

let app: FastifyInstance;
let adminId: string;
let adminToken: string;

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

/**
 * The audit plugin writes fire-and-forget in an `onSend` hook, so a row may not
 * be committed the instant the HTTP response returns. Poll until `predicate`
 * holds (or time out), rather than assuming synchronous persistence.
 */
async function eventually<T>(
  produce: () => Promise<T>,
  predicate: (value: T) => boolean,
  { timeoutMs = 3000, stepMs = 25 } = {},
): Promise<T> {
  const start = Date.now();
  let value = await produce();
  while (!predicate(value)) {
    if (Date.now() - start > timeoutMs) return value;
    await new Promise((r) => setTimeout(r, stepMs));
    value = await produce();
  }
  return value;
}

async function createUser(email: string, role: 'ADMIN' | 'USER') {
  const passwordHash = await hashPassword(PW);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: `Audit ${role}`, role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PW },
  });
  return res.json().data.token as string;
}

async function cleanupAudit(): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, [ADMIN_EMAIL, USER_EMAIL]));
  const ids = existing.map((u) => u.id);
  if (ids.length) {
    await db.delete(auditLog).where(inArray(auditLog.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  await db.delete(businessAreas).where(eq(businessAreas.name, BA_NAME));
}

describe('audit trail across mutating routes', () => {
  let createdBaId: string;
  // A timestamp taken just before this suite's mutations, for date-range tests.
  let sinceIso: string;

  beforeAll(async () => {
    app = await getApp();
    await cleanupAudit();

    adminId = (await createUser(ADMIN_EMAIL, 'ADMIN')).id;
    await createUser(USER_EMAIL, 'USER');
    sinceIso = new Date(Date.now() - 1000).toISOString();
    adminToken = await login(ADMIN_EMAIL); // logs POST /api/auth/login

    // A mutating security-policy create (POST /api/security/policies) so we can
    // assert the plugin captured it with the derived entityType 'policies'.
    const baRes = await app.inject({
      method: 'POST',
      url: '/api/business-areas',
      headers: authHeaders(adminToken),
      payload: { name: BA_NAME, description: 'audit ba' },
    });
    createdBaId = baRes.json().data.id as string;
  }, 60_000);

  afterAll(async () => {
    await cleanupAudit();
  });

  it('logs a business-area create with entityType/entityId/userId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/audit/entity/business-areas/${createdBaId}`,
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const entry = (res.json().data as Array<{ action: string; entityType: string; entityId: string; userId: string; userEmail: string }>)
      .find((e) => e.action === 'POST /api/business-areas');
    expect(entry).toBeDefined();
    expect(entry?.entityType).toBe('business-areas');
    expect(entry?.entityId).toBe(createdBaId);
    expect(entry?.userId).toBe(adminId);
    expect(entry?.userEmail).toBe(ADMIN_EMAIL);
  });

  it('logs the login as an authentication event keyed to the user', async () => {
    const rows = await auditService.getUserActivity(adminId, 100);
    const login = rows.find((r) => r.action === 'POST /api/auth/login');
    expect(login).toBeDefined();
    expect(login?.userId).toBe(adminId);
    // The password must never be persisted in the details blob.
    expect(JSON.stringify(login?.details)).not.toContain(PW);
  });

  it('logs a security-policy mutation with entityType "policies"', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Int57 audit policy',
        rules: [{ targetId: createdBaId, targetType: 'BUSINESS_AREA', sqlPredicate: "REGION = 'EMEA'" }],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const policyId = createRes.json().data.id as string;

    const { data } = await eventually(
      () => auditService.query({ userId: adminId, entityType: 'policies' }),
      (r) => r.data.some((e) => e.action === 'POST /api/security/policies'),
    );
    const entry = data.find((e) => e.action === 'POST /api/security/policies');
    expect(entry).toBeDefined();
    expect(entry?.entityId).toBe(policyId);

    // cleanup this policy
    await app.inject({
      method: 'DELETE',
      url: `/api/security/policies/${policyId}`,
      headers: authHeaders(adminToken),
    });
  });

  it('logs a migration run request (entityType "migration")', async () => {
    // The run fails asynchronously (the data source does not exist), but the
    // HTTP request itself is a mutation and must be audited regardless.
    const res = await app.inject({
      method: 'POST',
      url: '/api/migration/run',
      headers: authHeaders(adminToken),
      payload: { dataSourceId: '00000000-0000-4000-8000-000000000000' },
    });
    expect([202, 400, 404, 409]).toContain(res.statusCode);

    const { data } = await eventually(
      () => auditService.query({ userId: adminId, entityType: 'migration' }),
      (r) => r.data.some((e) => e.action === 'POST /api/migration/run'),
    );
    const entry = data.find((e) => e.action === 'POST /api/migration/run');
    expect(entry).toBeDefined();
  });

  it('does NOT log pure GET reads', async () => {
    await app.inject({ method: 'GET', url: '/api/business-areas', headers: authHeaders(adminToken) });
    const rows = await auditService.getUserActivity(adminId, 200);
    expect(rows.some((r) => r.action.startsWith('GET '))).toBe(false);
  });

  it('filters by entity type', async () => {
    const { data } = await auditService.query({ userId: adminId, entityType: 'business-areas' });
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.every((e) => e.entityType === 'business-areas')).toBe(true);
  });

  it('filters by user', async () => {
    const { data } = await auditService.query({ userId: adminId });
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.every((e) => e.userId === adminId)).toBe(true);
  });

  it('filters by date range', async () => {
    const since = new Date(sinceIso);
    const rows = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, adminId), gte(auditLog.createdAt, since)));
    // Every mutation in this suite happened after `since`.
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // A window entirely in the future returns nothing for this user.
    const future = await auditService.query({
      userId: adminId,
      dateFrom: new Date(Date.now() + 3_600_000),
    });
    expect(future.total).toBe(0);
  });

  it('entity history returns all changes for one entity, newest first', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/business-areas/${createdBaId}`,
      headers: authHeaders(adminToken),
      payload: { description: 'updated for audit' },
    });

    const history = await eventually(
      () => auditService.getEntityHistory('business-areas', createdBaId),
      (h) => h.length >= 2,
    );
    expect(history.length).toBeGreaterThanOrEqual(2); // create + update
    const times = history.map((h) => new Date(h.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(history.some((h) => h.action === 'POST /api/business-areas')).toBe(true);
    expect(history.some((h) => h.action.startsWith('PUT /api/business-areas'))).toBe(true);
  });

  it('stats aggregate totals, per-user and per-action', async () => {
    const stats = await auditService.getStats(new Date(sinceIso));
    expect(stats.totalActions).toBeGreaterThanOrEqual(1);
    expect(stats.byActionType.some((a) => a.action === 'POST /api/business-areas')).toBe(true);
    expect(stats.byUser.some((u) => u.userId === adminId)).toBe(true);
  });

  it('the audit API requires the ADMIN role', async () => {
    const userToken = await login(USER_EMAIL);
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit',
      headers: authHeaders(userToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
