import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { inArray, like, sql } from 'drizzle-orm';

import {
  dryRun,
  checkFormulaCompileRate,
  checkReconciliation,
  checkReferentialClosure,
  checkMeasureSet,
  EXPECTED_LOSS_ALLOWANCES,
  type ExpectedLossAllowance,
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
  dataSources,
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
// The five seam tests (Phase 1.3; seam 5 added by Phase 3.1).
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

// You migrate FROM a data source that already exists in the target — the
// migrator never creates one. Every migrated folder points at it, and without
// it no map on those folders can execute, however good its SQL.
const DATA_SOURCE_ID = `${PREFIX}000000009001`;
const DATA_SOURCE_NAME = 'seam-test source';

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
  await db.delete(dataSources).where(inArray(dataSources.name, [DATA_SOURCE_NAME]));
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
    await db.insert(dataSources).values({
      id: DATA_SOURCE_ID,
      name: DATA_SOURCE_NAME,
      connectionType: 'oracle',
      host: 'localhost',
      port: 1521,
      serviceName: 'SEAMTEST',
    });
    const { writer, close } = realTarget();
    try {
      await runMigration({
        source: mockExecutor(eul5Db()),
        writer,
        dataSourceId: DATA_SOURCE_ID,
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

  // -------------------------------------------------------------------------
  // Seam 3 — referential closure
  // -------------------------------------------------------------------------
  describe('seam 3: every map reference resolves inside the query scope', () => {
    it('holds the invariants foreign keys already guarantee', async () => {
      const result = await checkReferentialClosure(db, { mapIdPrefix: PREFIX });

      expect(result.metrics.references).toBeGreaterThan(0);
      // These four are FK-backed, so a non-zero here means the constraint is
      // gone, not that the data drifted. Gated, not pinned.
      expect(result.metrics.unresolvedItem).toBe(0);
      expect(result.metrics.unresolvedFolder).toBe(0);
      expect(result.metrics.unresolvedDataSource).toBe(0);
      expect(result.metrics.strayTotals).toBe(0);
      // One map, one data source. A map spanning two cannot be one statement.
      expect(result.metrics.mapsSpanningDataSources).toBe(0);
      expect(result.metrics.mapsWithNoColumns).toBe(0);
    });

    it('stamps every migrated folder with the data source it came from', async () => {
      const result = await checkReferentialClosure(db, { mapIdPrefix: PREFIX });

      // This was the defect the seam found: the migration knew which data
      // source it was reading and never wrote it down, so `resolveDataSourceId`
      // threw "no data source configured on its folders" for every map — even
      // one whose SQL generated cleanly. Gated at zero now, not pinned.
      expect(result.metrics.folderWithoutDataSource).toBe(0);
      expect(result.metrics.references).toBeGreaterThan(0);
    });

    it('warns when no data source is supplied, rather than migrating quietly', async () => {
      // The CLI can migrate metadata before the source is registered in the
      // target. That is allowed, and it produces an estate where nothing runs,
      // so the run has to say so — this warning is the only signal an operator
      // gets before someone opens a map and finds it will not execute.
      //
      // A dry run, because Neo holds one migration per database and refuses a
      // second: the warning is computed on both paths.
      const { writer, close } = realTarget();
      try {
        const result = await dryRun({
          source: mockExecutor(eul5Db()),
          writer,
          deps: { genId: scopedIdFactory(), now: FIXED_NOW },
        });
        const warning = result.warnings.find((w) => w.code === 'FOLDERS_WITHOUT_DATA_SOURCE');
        expect(warning).toBeDefined();
        expect(warning!.message).toContain('refuse to execute');
      } finally {
        await close();
      }
    }, 60_000);

    it('detects a map that is closed over nothing', async () => {
      // Negative control. A map with no columns satisfies every FK and can
      // never execute, so closure has to count it rather than call it clean.
      const [ba] = await db.select().from(businessAreas).where(idLike(businessAreas.id)).limit(1);
      const [owner] = await db.select().from(users).where(idLike(users.id)).limit(1);
      const emptyMapId = `${PREFIX}777700000001`;
      await db.insert(maps).values({
        id: emptyMapId,
        name: 'seam-test columnless map',
        mapType: 'TABLE',
        businessAreaId: ba!.id,
        createdBy: owner!.id,
      });

      try {
        const result = await checkReferentialClosure(db, { mapIdPrefix: PREFIX });
        expect(result.metrics.mapsWithNoColumns).toBe(1);
        expect(result.findings.join(' | ')).toContain('mapsWithNoColumns');
        expect(result.status).toBe('FAIL');
      } finally {
        await db.delete(maps).where(inArray(maps.id, [emptyMapId]));
      }
    });
  });

  // -------------------------------------------------------------------------
  // Seam 4 — source <-> target reconciliation
  // -------------------------------------------------------------------------
  describe('seam 4: target counts match the declared expectations', () => {
    // Scoped to this suite's own rows, because the checked-in declaration
    // counts whole tables and would see the live estate here.
    const FIXTURE_ALLOWANCES: ExpectedLossAllowance[] = [
      { concept: 'business areas', table: 'business_areas', sourceCount: 2, expectedTarget: 3,
        why: 'One real BA plus the synthetic workbook host.', explained: true },
      { concept: 'folders', table: 'folders', sourceCount: 2, expectedTarget: 2,
        why: 'Carried across whole.', explained: true },
      { concept: 'items', table: 'items', sourceCount: 3, expectedTarget: 3,
        why: 'Carried across whole.', explained: true },
      { concept: 'hierarchies', table: 'hierarchies', sourceCount: 1, expectedTarget: 1,
        why: 'The EUL5 fixture carries the business-area column EUL4 lacks.', explained: true },
    ];

    it('passes when every concept matches its declaration', async () => {
      const result = await checkReconciliation(db, {
        mapIdPrefix: PREFIX,
        allowances: FIXTURE_ALLOWANCES,
      });

      expect(result.metrics.drifted).toBe(0);
      expect(result.metrics.matched).toBe(FIXTURE_ALLOWANCES.length);
      expect(result.status).toBe('PASS');
    });

    it('fails on drift in either direction, and says which way', async () => {
      // Negative control. A declaration nobody can fail is a declaration that
      // records nothing.
      const short = await checkReconciliation(db, {
        mapIdPrefix: PREFIX,
        allowances: [{ ...FIXTURE_ALLOWANCES[1]!, expectedTarget: 99 }],
      });
      expect(short.status).toBe('FAIL');
      expect(short.findings.join(' | ')).toContain('short by 97');

      // Over-by matters too: a phase that recovers rows and leaves the
      // declaration stale is how an allowance becomes permanent.
      const over = await checkReconciliation(db, {
        mapIdPrefix: PREFIX,
        allowances: [{ ...FIXTURE_ALLOWANCES[1]!, expectedTarget: 0 }],
      });
      expect(over.status).toBe('FAIL');
      expect(over.findings.join(' | ')).toContain('over by 2');
    });

    it('counts allowances whose cause was never established', async () => {
      const result = await checkReconciliation(db, {
        mapIdPrefix: PREFIX,
        allowances: [
          { concept: 'grants', table: 'user_business_area_grants', sourceCount: 138,
            expectedTarget: 0, why: 'cause never established', explained: false },
        ],
      });
      // An unexplained gap must be visible as its own number, or it becomes
      // indistinguishable from an accepted one.
      expect(result.metrics.unexplainedAllowances).toBe(1);
      // 138 declared at source minus the 3 grants this fixture wrote.
      expect(result.metrics.rowsLostToAllowances).toBe(135);
    });

    it('refuses to interpolate anything that is not a bare table name', async () => {
      await expect(
        checkReconciliation(db, {
          allowances: [
            { concept: 'injected', table: 'users; DROP TABLE users', sourceCount: null,
              expectedTarget: 0, why: 'never', explained: true },
          ],
        }),
      ).rejects.toThrow('not a bare table name');
    });

    it('keeps the checked-in declaration well formed', () => {
      expect(EXPECTED_LOSS_ALLOWANCES.length).toBeGreaterThan(0);
      for (const a of EXPECTED_LOSS_ALLOWANCES) {
        expect(a.table).toMatch(/^[a-z_][a-z0-9_]*$/);
        expect(a.expectedTarget).toBeGreaterThanOrEqual(0);
        // Every gap carries a stated reason, whether or not it is understood.
        expect(a.why.length).toBeGreaterThan(10);
        // A loss of more than 1% of the source names the phase that recovers
        // it. Below that the rows are genuinely gone (7 unattributable totals),
        // and inventing a recovery phase for them would be a lie.
        const lost = a.sourceCount === null ? 0 : a.sourceCount - a.expectedTarget;
        if (a.sourceCount !== null && lost > a.sourceCount * 0.01) {
          expect(a.recoveredBy).toBeTruthy();
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Seam 5 — the measure set the fan-trap guard reads
  // -------------------------------------------------------------------------
  describe('seam 5: the estate carries a measure set the fan-trap guard can see', () => {
    /**
     * The guard's step 0 is `if |M| = 0: flat plan, STOP`. An estate where no
     * column carries an aggregate classifies every query that way, and the
     * guard ships present, unit-tested and structurally inert. This seam is
     * what makes that state loud instead of green.
     *
     * The fixture worksheet is deliberately two axis items over no measure —
     * the same shape seam 3 relies on — so it is exactly the inert estate, and
     * the seam must say so. That is asserted first, against real Postgres, so
     * the FILTER-and-enum SQL is exercised on both verdicts.
     */
    it('reports the inert estate as a FAIL, naming why', async () => {
      const result = await checkMeasureSet(db, { mapIdPrefix: PREFIX });

      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('|M| = 0');
      expect(result.metrics.columns).toBeGreaterThan(0);
      expect(result.metrics.withAggregate).toBe(0);
    });

    it('passes once a column is a measure carrying an aggregate', async () => {
      const [column] = await db
        .select({ id: mapItems.id })
        .from(mapItems)
        .where(idLike(mapItems.id))
        .limit(1);
      if (!column) throw new Error('fixture wrote no map columns');

      // Restored in `finally`: every other seam in this file reads these rows,
      // and a test that leaves the fixture altered is a test that breaks its
      // neighbours depending on run order.
      try {
        await db
          .update(mapItems)
          .set({ axisType: 'MEASURE', aggFunction: 'SUM' })
          .where(inArray(mapItems.id, [column.id]));

        const result = await checkMeasureSet(db, { mapIdPrefix: PREFIX });
        expect(result.status).toBe('PASS');
        expect(result.metrics).toMatchObject({ measure: 1, withAggregate: 1, mapsWithAMeasure: 1 });
        expect(result.metrics.measuresWithoutAggregate).toBe(0);
      } finally {
        await db
          .update(mapItems)
          .set({ axisType: 'AXIS', aggFunction: null })
          .where(inArray(mapItems.id, [column.id]));
      }
    });

    // 0012_constrain_agg_function.sql. `agg_function` feeds `select-clause.ts`
    // and the guard's measure set; a name outside Neo's five is a throw or a
    // measure that cannot be re-aggregated, so the database refuses it rather
    // than storing free text.
    it('refuses an aggregate function Neo cannot run', async () => {
      const [column] = await db
        .select({ id: mapItems.id })
        .from(mapItems)
        .where(idLike(mapItems.id))
        .limit(1);
      if (!column) throw new Error('fixture wrote no map columns');

      // Drizzle rewraps the driver error, so the constraint name is on the
      // cause rather than the message — assert the write is refused AND that
      // nothing landed, which is the property that matters either way.
      await expect(
        db
          .update(mapItems)
          .set({ aggFunction: 'COUNT DISTINCT' })
          .where(inArray(mapItems.id, [column.id])),
      ).rejects.toThrow();

      const [after] = await db
        .select({ agg: mapItems.aggFunction })
        .from(mapItems)
        .where(inArray(mapItems.id, [column.id]));
      expect(after?.agg).toBeNull();
    });
  });

  describe('declared losses', () => {
    it('keeps the checked-in declaration well formed', () => {
      expect(EXPECTED_LOSS_ALLOWANCES.length).toBeGreaterThan(0);
      for (const a of EXPECTED_LOSS_ALLOWANCES) {
        expect(a.table).toMatch(/^[a-z_][a-z0-9_]*$/);
        expect(a.expectedTarget).toBeGreaterThanOrEqual(0);
        // Every gap carries a stated reason, whether or not it is understood.
        expect(a.why.length).toBeGreaterThan(10);
        // A loss of more than 1% of the source names the phase that recovers
        // it. Below that the rows are genuinely gone (7 unattributable totals),
        // and inventing a recovery phase for them would be a lie.
        const lost = a.sourceCount === null ? 0 : a.sourceCount - a.expectedTarget;
        if (a.sourceCount !== null && lost > a.sourceCount * 0.01) {
          expect(a.recoveredBy).toBeTruthy();
        }
      }
    });
  });
});
