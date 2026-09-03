import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { inArray, like, sql } from 'drizzle-orm';

import {
  checkFormulaCompileRate,
  checkSqlGeneration,
  createMigrationWriter,
  createTargetDb,
  runMigration,
  type MigrationWriter,
} from '@discoverer-neo/core/migration';
import { eul5Db, mockExecutor } from '@discoverer-neo/core/testing';

import { getApp } from './test-helper.js';
import { db } from '../../db/index.js';
import {
  businessAreas,
  customFunctions,
  folders,
  hierarchies,
  hierarchyLevels,
  items,
  joins,
  mapCalculatedFields,
  mapConditions,
  mapItems,
  mapLayouts,
  mapPageSetup,
  mapParameters,
  mapTotals,
  maps,
  userBusinessAreaGrants,
  users,
} from '../../db/schema.js';
import { generateSqlForMap } from '../../services/sql-generator.js';
import { bucketFormula } from '../../services/formula-bucket.js';

// ===========================================================================
// The four seam tests (Phase 1.3).
//
// Every other suite in this repository verifies one component against its own
// fixtures. None spans migration and execution, which is how 1 654 passing
// tests coexisted with an estate where zero of 923 maps could run
// (AUDIT_TESTING_ASSESSMENT.md §2). These tests run the shared verifier —
// `@discoverer-neo/core`'s `migration-verify` — across that seam.
//
// They exercise the CONTRACT against a small fixture migration, so CI catches
// a regression. The BASELINE numbers come from the same verifier run against
// the real estate: `npm run verify --workspace backend`. A green run here does
// not mean the real database is healthy, and is not meant to.
// ===========================================================================

// A valid-UUID prefix no other fixture uses, so this suite's rows can be
// counted, verified and deleted precisely. Distinct from migration-audit's.
const PREFIX = '5ea11e57-0000-4000-8000-';

function scopedIdFactory() {
  let n = 0;
  return () => `${PREFIX}${String((n += 1)).padStart(12, '0')}`;
}

const FIXED_NOW = () => new Date('2026-09-03T00:00:00.000Z');

// The EUL5 fixture mints these UNIQUE natural keys; clean them defensively in
// case an interrupted run left them behind.
const FIXTURE_BA_NAMES = ['Sales Analysis', 'Migrated Workbooks'];
const FIXTURE_EMAILS = ['migration@migrated.local', 'jsmith@migrated.local', 'mjones@migrated.local'];

const idLike = (col: unknown) => like(sql`${col}::text`, `${PREFIX}%`);

function realTarget(): { writer: MigrationWriter; close: () => Promise<void> } {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set for the seam tests');
  const target = createTargetDb({ connectionString });
  return { writer: createMigrationWriter(target.db), close: target.close };
}

/** Delete every row this suite wrote, children before parents. */
async function cleanup(): Promise<void> {
  await db.delete(userBusinessAreaGrants).where(idLike(userBusinessAreaGrants.id));
  await db.delete(mapTotals).where(idLike(mapTotals.id));
  await db.delete(mapConditions).where(idLike(mapConditions.id));
  await db.delete(mapParameters).where(idLike(mapParameters.id));
  await db.delete(mapCalculatedFields).where(idLike(mapCalculatedFields.id));
  await db.delete(mapLayouts).where(idLike(mapLayouts.id));
  await db.delete(mapPageSetup).where(idLike(mapPageSetup.id));
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
  await db.delete(businessAreas).where(inArray(businessAreas.name, FIXTURE_BA_NAMES));
  await db.delete(users).where(inArray(users.email, FIXTURE_EMAILS));
  try {
    await db.execute(sql`DELETE FROM migration_log WHERE run_id LIKE ${PREFIX + '%'}`);
  } catch {
    // migration_log is created by the first real run's ensureSchema — ignore.
  }
}

describe('Migration seam tests', () => {
  beforeAll(async () => {
    await getApp(); // initialise the shared pool/schema
    await cleanup();
    const { writer, close } = realTarget();
    try {
      await runMigration({
        source: mockExecutor(eul5Db()),
        writer,
        deps: { genId: scopedIdFactory(), now: FIXED_NOW },
      });
    } finally {
      await close();
    }
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  // -------------------------------------------------------------------------
  // Seam 1 — migration → execution contract
  // -------------------------------------------------------------------------
  describe('seam 1: every migrated map can generate SQL', () => {
    /**
     * Declared baseline, not a target. The EUL5 fixture's one map ("Monthly
     * Sales") spans Invoice Headers and Sales Summary with an aggregate, and
     * the generator refuses multi-folder aggregates until the fan-trap planner
     * lands in Phase 3. Nothing in the suite noticed that before this seam
     * existed. Drop this to 0 when Phase 3 lands; raising it needs a reason.
     */
    const KNOWN_UNGENERATABLE = 1;

    it('measures how many migrated maps generate SQL, and holds the baseline', async () => {
      const result = await checkSqlGeneration(db, {
        mapIdPrefix: PREFIX,
        generateSqlForMap: (mapId) => generateSqlForMap(mapId),
      });

      const { maps: total = 0, generated = 0, failed = 0 } = result.metrics;
      // A fixture that migrated nothing would pass vacuously — the exact
      // failure mode this suite exists to rule out.
      expect(total).toBeGreaterThan(0);
      expect(generated + failed).toBe(total);
      expect(failed).toBeLessThanOrEqual(KNOWN_UNGENERATABLE);
    });

    it('reports FAIL, with the reason, when a map cannot generate SQL', async () => {
      // Negative control. Without it this seam could be a green light wired to
      // nothing — which is what the readiness scorer turned out to be. A map
      // with no columns is the cheapest genuinely ungeneratable map.
      const [ba] = await db.select().from(businessAreas).where(idLike(businessAreas.id)).limit(1);
      const [owner] = await db.select().from(users).where(idLike(users.id)).limit(1);
      const emptyMapId = `${PREFIX}999999999999`;
      await db.insert(maps).values({
        id: emptyMapId,
        name: 'seam-test empty map',
        mapType: 'TABLE',
        businessAreaId: ba!.id,
        createdBy: owner!.id,
      });

      try {
        const result = await checkSqlGeneration(db, {
          mapIdPrefix: PREFIX,
          generateSqlForMap: (mapId) => generateSqlForMap(mapId),
        });

        expect(result.status).toBe('FAIL');
        expect(result.metrics.failed ?? 0).toBe(KNOWN_UNGENERATABLE + 1);
        expect(result.reason).toContain('cannot generate SQL');
        expect(result.findings.join(' | ')).toContain('seam-test empty map');
      } finally {
        await db.delete(maps).where(inArray(maps.id, [emptyMapId]));
      }
    });

    it('never reports PASS when no generator is injected', async () => {
      // SKIPPED must not read as success anywhere downstream.
      const result = await checkSqlGeneration(db, { mapIdPrefix: PREFIX });
      expect(result.status).toBe('SKIPPED');
      expect(result.reason).toContain('backend workspace');
    });
  });

  // -------------------------------------------------------------------------
  // Seam 2 — formula compile rate
  // -------------------------------------------------------------------------
  describe('seam 2: every calculated field compiles or is quarantined with a reason', () => {
    // The EUL5 fixture carries no calculated fields, so the seam would pass
    // vacuously over it. These three cover the buckets the real estate lands
    // in: one that parses, one unrendered Discoverer token (49 027 of them
    // live), and one that is not a formula at all.
    const FIELD_IDS = [
      `${PREFIX}888800000001`,
      `${PREFIX}888800000002`,
      `${PREFIX}888800000003`,
    ];

    beforeAll(async () => {
      const [map] = await db.select().from(maps).where(idLike(maps.id)).limit(1);
      await db.insert(mapCalculatedFields).values([
        { id: FIELD_IDS[0]!, mapId: map!.id, name: 'parses', formula: 'SUM(AMOUNT) * 2', displayOrder: 1 },
        { id: FIELD_IDS[1]!, mapId: map!.id, name: 'token', formula: '[1,1]([6,2])', displayOrder: 2 },
        { id: FIELD_IDS[2]!, mapId: map!.id, name: 'garbage', formula: 'SUM(', displayOrder: 3 },
      ]);
    });

    afterAll(async () => {
      await db.delete(mapCalculatedFields).where(inArray(mapCalculatedFields.id, FIELD_IDS));
    });

    it('buckets every formula, and gates only on FAILED', async () => {
      const result = await checkFormulaCompileRate(db, {
        mapIdPrefix: PREFIX,
        compileFormula: bucketFormula,
      });

      const { formulas = 0, compiledUnverified = 0, quarantined = 0, failed = 0 } = result.metrics;
      expect(formulas).toBe(3);
      // Every formula lands in exactly one bucket — no silent third state.
      expect(compiledUnverified + quarantined + failed + (result.metrics.compiled ?? 0)).toBe(formulas);
      expect(compiledUnverified).toBe(1);
      expect(quarantined).toBe(2);
      // FAILED is the only gated bucket: an unhandled path is our bug.
      expect(failed).toBe(0);
      expect(result.status).toBe('PASS');
    });

    it('states a reason for every quarantined formula', async () => {
      const result = await checkFormulaCompileRate(db, {
        mapIdPrefix: PREFIX,
        compileFormula: bucketFormula,
      });

      // A quarantine without a reason is the unknown this seam exists to
      // delete, so the verifier must never fall back to a placeholder.
      expect(result.findings.join(' | ')).not.toContain('no reason given');
      expect(result.findings.join(' | ')).toContain('unrendered Discoverer');
      expect(result.metrics.distinctReasons).toBe(2);
    });

    it('reports FAIL when the classifier hits a path it does not handle', async () => {
      // Negative control for the one bucket CI gates on.
      const result = await checkFormulaCompileRate(db, {
        mapIdPrefix: PREFIX,
        compileFormula: () => {
          throw new Error('unhandled formula shape');
        },
      });

      expect(result.metrics.failed).toBe(3);
      expect(result.status).toBe('FAIL');
      expect(result.findings.join(' | ')).toContain('classifier threw');
    });

    it('never reports PASS when no compiler is injected', async () => {
      const result = await checkFormulaCompileRate(db, { mapIdPrefix: PREFIX });
      expect(result.status).toBe('SKIPPED');
      // The count is still useful, and still not a pass.
      expect(result.metrics.formulas).toBe(3);
    });
  });
});
