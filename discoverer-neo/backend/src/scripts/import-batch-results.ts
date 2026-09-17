/**
 * Operator entry point for the batch-result backfill (Phase 9.3 follow-up).
 * Run *after* `import-schedules.ts` — this attaches historical row data to
 * the schedules that script already created.
 *
 *   npx tsx src/scripts/import-batch-results.ts <dataSourceId> [--live] [schemaOwner]
 *
 * Defaults to a dry run: reports what it would migrate and writes nothing.
 * `--live` writes the result files and `scheduled_results` rows.
 */

import { importBatchResults } from '../services/batch-result-import.service.js';

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const live = process.argv.includes('--live');
  const schemaOwner = process.argv.slice(3).find((a) => !a.startsWith('--'));
  if (!dataSourceId) {
    throw new Error('usage: import-batch-results.ts <dataSourceId> [--live] [schemaOwner]');
  }

  console.log(live ? 'LIVE run — result files and rows will be written.\n' : 'Dry run — nothing will be written.\n');

  const result = await importBatchResults(dataSourceId, { dryRun: !live, schemaOwner });

  console.log(`result tables discovered: ${result.tablesDiscovered}`);
  console.log(`matched to a migrated schedule: ${result.tablesMatched}`);
  console.log(`rows ${live ? 'migrated' : 'that would be migrated'}: ${result.rowsMigrated}`);
  console.log(`scheduled_results rows ${live ? 'written' : 'that would be written'}: ${result.resultsWritten}`);
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
