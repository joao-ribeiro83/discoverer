/**
 * Run the four seam checks against an already-migrated database (D-070).
 *
 *   npm run verify --workspace @discoverer-neo/backend
 *   npx tsx src/scripts/verify-migration.ts [--json] [--max-maps N] [--samples N]
 *
 * The target is whatever `DATABASE_URL` points at — this reads only, and never
 * re-imports, so it is safe to re-run against a live estate as often as you
 * like. It runs POST-COMMIT by construction: there is no transaction here to
 * roll back, because a rollback would destroy the evidence needed to debug.
 *
 * `dn-migrate verify` runs the same verifier, but reports the generator-backed
 * seams SKIPPED: the SQL generator lives in this workspace, which depends on
 * `@discoverer-neo/core` and not the reverse. This entry point is the one that
 * runs all four.
 *
 * Exit code is 0 when the report is VERIFIED and 1 when it is
 * COMPLETED_WITH_BLOCKERS, so CI or a cutover runbook can gate on it.
 */

import { verifyMigration, formatVerifyReport } from '@discoverer-neo/core/migration';

import { db, pool } from '../db/index.js';
import { generateSqlForMap } from '../services/sql-generator.js';
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
    maxMaps: numericFlag('--max-maps'),
    sampleLimit: numericFlag('--samples'),
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
