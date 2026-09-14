/**
 * Operator entry point for the scheduled-workbook backfill (Phase 7.2).
 *
 *   npx tsx src/scripts/import-schedules.ts <dataSourceId> [--live] [schemaOwner]
 *
 * Defaults to a dry run: reports what it would create and writes nothing.
 * `--live` performs the import. Every schedule this creates is disabled
 * (`isActive: false`) regardless of mode — `--live` only decides whether
 * rows are written, never whether they start out enabled.
 */

import { importSchedules } from '../services/schedule-import.service.js';

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const live = process.argv.includes('--live');
  const schemaOwner = process.argv.slice(3).find((a) => !a.startsWith('--'));
  if (!dataSourceId) {
    throw new Error('usage: import-schedules.ts <dataSourceId> [--live] [schemaOwner]');
  }

  console.log(live ? 'LIVE run — schedules will be created (disabled).\n' : 'Dry run — nothing will be written.\n');

  const result = await importSchedules(dataSourceId, { dryRun: !live, schemaOwner });

  console.log(`reports seen: ${result.reportsSeen}, sheets seen: ${result.sheetsSeen}`);
  console.log(`schedules ${live ? 'created' : 'plannable'}: ${result.scheduled} (all disabled)`);
  console.log(`schedule parameters written: ${result.parametersWritten}`);
  console.log(`historical runs written: ${result.historicalRunsWritten}`);
  console.log(`planner refusals: ${result.plannerRefusals}`);
  if (result.warnings.length > 0) {
    console.log(`\nwarnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  [${w.reason}] BR_ID ${w.brId} (${w.brName}): ${w.detail}`);
    }
  }
  console.log(`\nduration: ${(result.durationMs / 1000).toFixed(1)}s`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
