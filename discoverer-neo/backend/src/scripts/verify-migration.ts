/**
 * Run the six seam checks against an already-migrated database (D-070).
 *
 *   npm run verify --workspace @discoverer-neo/backend
 *   npx tsx src/scripts/verify-migration.ts [--json] [--max-maps N] [--samples N] [--compile]
 *
 * The target is whatever `DATABASE_URL` points at — this reads only, and never
 * re-imports, so it is safe to re-run against a live estate as often as you
 * like. It runs POST-COMMIT by construction: there is no transaction here to
 * roll back, because a rollback would destroy the evidence needed to debug.
 *
 * `dn-migrate verify` runs the same verifier, but reports the generator-backed
 * seams SKIPPED: the SQL generator lives in this workspace, which depends on
 * `@discoverer-neo/core` and not the reverse. This entry point is the one that
 * runs all six.
 *
 * Exit code is 0 when the report is VERIFIED and 1 when it is
 * COMPLETED_WITH_BLOCKERS, so CI or a cutover runbook can gate on it.
 */

import { verifyMigration, formatVerifyReport } from '@discoverer-neo/core/migration';

import { db, pool } from '../db/index.js';
import {
  decideMap,
  generateSqlForMap,
  loadMapDefinition,
} from '../services/sql-generator.js';
import { bucketFormula } from '../services/formula-bucket.js';

function numericFlag(name: string): number | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : undefined;
}

async function main(): Promise<void> {
  const report = await verifyMigration(db, {
    generateSqlForMap: (mapId) => generateSqlForMap(mapId),
    compileFormula: bucketFormula,
    // Seam 6: the planner-decision histogram. The decision is taken AFTER
    // generation, because DISCONNECTED and NO_PREDICATE are raised by the
    // emitter — a histogram of planner verdicts alone would file both under
    // FLAT and report a guard doing work it never did (D-031, R-07/B-03).
    planMap: async (mapId) => decideMap(await loadMapDefinition(mapId)),
    maxMaps: numericFlag('--max-maps'),
    sampleLimit: numericFlag('--samples'),
    // `--compile` was documented above but never passed, so this entry point
    // reported the formula partition and published nothing — a maps re-import
    // left `compile_status` NULL until someone ran the CLI instead.
    writeCompileStatus: process.argv.includes('--compile'),
  });

  // The report carries the database NAME only — never the connection string,
  // and nothing from `data_sources`, whose rows hold source credentials.
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatVerifyReport(report));

  process.exitCode = report.status === 'VERIFIED' ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
