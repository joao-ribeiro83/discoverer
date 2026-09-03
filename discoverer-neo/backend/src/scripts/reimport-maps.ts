/**
 * Operator entry point for the maps-only re-import, for a deployment where
 * calling the admin API is inconvenient (no session to hand, or a run long
 * enough that an HTTP client would time out waiting to watch it).
 *
 *   npx tsx src/scripts/reimport-maps.ts <dataSourceId> [--live] [schemaOwner]
 *
 * Defaults to a dry run: it reports what it would replace and rebuild and
 * writes nothing. `--live` performs the replacement.
 *
 * Same operation as POST /api/migration/reimport-maps — see
 * `migration.service.ts` for why the maps are re-importable when a full
 * migration is not, and what it deletes.
 */

import { startMapReimport, getJob } from '../services/migration.service.js';
import type { MigrationJob } from '../services/migration.service.js';

async function waitForJob(jobId: string): Promise<MigrationJob> {
  for (;;) {
    const job = getJob(jobId);
    if (job && job.status !== 'RUNNING') return job;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const live = process.argv.includes('--live');
  const schemaOwner = process.argv.slice(3).find((a) => !a.startsWith('--'));
  if (!dataSourceId) {
    throw new Error('usage: reimport-maps.ts <dataSourceId> [--live] [schemaOwner]');
  }

  console.log(live ? 'LIVE run — maps will be replaced.\n' : 'Dry run — nothing will be written.\n');

  const started = startMapReimport({
    dataSourceId,
    schemaOwner,
    dryRun: !live,
    startedBy: 'cli',
  });

  let printed = 0;
  const tick = setInterval(() => {
    const job = getJob(started.id);
    if (!job) return;
    for (const line of job.logs.slice(printed)) {
      console.log(`  [${line.level}] ${line.phase}: ${line.message}`);
    }
    printed = job.logs.length;
  }, 250);

  const job = await waitForJob(started.id);
  clearInterval(tick);
  for (const line of job.logs.slice(printed)) {
    console.log(`  [${line.level}] ${line.phase}: ${line.message}`);
  }

  console.log(`\nstatus: ${job.status}`);
  if (job.error) console.log(`error: ${job.error}`);
  if (job.mapsResult) {
    const {
      replacedMaps,
      planned,
      written,
      unresolvedItems,
      unresolvedConditions,
      unresolvedTotals,
      inexpressibleConditions,
      durationMs,
    } = job.mapsResult;
    console.log(`replaced maps: ${replacedMaps}`);
    console.log(`planned: ${JSON.stringify(planned)}`);
    console.log(`written: ${JSON.stringify(written)}`);
    console.log(
      `unresolved columns: ${unresolvedItems}, conditions on a missing item: ${unresolvedConditions}, ` +
        `totals on a missing column: ${unresolvedTotals}, ` +
        `conditions Neo cannot express: ${inexpressibleConditions}`,
    );
    console.log(`duration: ${(durationMs / 1000).toFixed(1)}s`);
  }
  process.exit(job.status === 'COMPLETED' ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
