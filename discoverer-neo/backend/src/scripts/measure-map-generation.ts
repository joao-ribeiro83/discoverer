/**
 * How much of the estate generates SQL, and what the rest refuses on.
 *
 * READ ONLY. Loads every active map's definition and calls the pure generator;
 * it never writes and never opens an Oracle connection. Phase 1.1 recorded its
 * output as the baseline; Phase 3.4 re-runs it to show the fan-trap planner
 * moved maps out of `MULTI_FOLDER_AGGREGATE` and into `OK`.
 *
 *   npx tsx src/scripts/measure-map-generation.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { maps } from '../db/schema.js';
import { generateSql, loadMapDefinition } from '../services/sql-generator.js';
import { effectiveFolderSet } from '../lib/sql/folder-set.js';

/** Buckets, most specific first — the first matching pattern wins. */
const REASONS: Array<{ bucket: string; test: RegExp }> = [
  {
    bucket: 'MULTI_FOLDER_AGGREGATE',
    test: /Multi-folder aggregate queries are refused/,
  },
  { bucket: 'NO_JOIN_PATH', test: /No join path connects/ },
  { bucket: 'UNKNOWN_ITEM_REFERENCE', test: /Unknown item reference/ },
  {
    bucket: 'UNPARSEABLE_FORMULA',
    test: /at position \d+|Unexpected|Circular formula/,
  },
  { bucket: 'NO_COLUMNS', test: /selects no columns|references no folders/ },
  { bucket: 'BAD_AGGREGATE', test: /Unsupported aggregate function/ },
  {
    bucket: 'FOLDER_NOT_QUERYABLE',
    test: /has no underlying table|custom SQL/,
  },
  {
    bucket: 'MISSING_METADATA',
    test: /not found|has neither a column nor a formula/,
  },
];

function bucketFor(message: string): string {
  return REASONS.find((r) => r.test.test(message))?.bucket ?? 'OTHER';
}

async function main(): Promise<void> {
  const rows = await db
    .select({ id: maps.id, name: maps.name })
    .from(maps)
    .where(eq(maps.isActive, true));

  const counts = new Map<string, number>();
  const examples = new Map<string, string>();
  let singleFolderOk = 0;
  let multiFolderOk = 0;

  for (const row of rows) {
    try {
      const def = await loadMapDefinition(row.id);
      const folderCount = new Set(
        effectiveFolderSet(def).columnBearingFolderIds,
      ).size;
      generateSql(def);
      counts.set('OK', (counts.get('OK') ?? 0) + 1);
      if (folderCount > 1) multiFolderOk += 1;
      else singleFolderOk += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const bucket = bucketFor(message);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      if (!examples.has(bucket)) examples.set(bucket, `${row.name}: ${message}`);
    }
  }

  const total = rows.length;
  console.log(`active maps: ${total}`);
  console.log(`  OK (single folder): ${singleFolderOk}`);
  console.log(`  OK (multi folder, no aggregate): ${multiFolderOk}`);
  for (const [bucket, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    if (bucket === 'OK') continue;
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`  ${bucket}: ${count} (${pct}%)`);
    console.log(`      e.g. ${examples.get(bucket)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
