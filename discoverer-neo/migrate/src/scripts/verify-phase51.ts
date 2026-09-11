/**
 * Phase 5.1 live check: what the object-link resolver decides on a real EUL.
 *
 * Reads only. Connection comes in as JSON on EUL_CONN so no credential is
 * written to disk.
 *
 *   EUL_CONN='{"user":"…","password":"…","host":"…","port":1530,"sid":"…"}' \
 *     npx tsx src/scripts/verify-phase51.ts
 */

import { readEulSchema } from '../services/eul-reader.js';
import type { EulConnectionConfig } from '../services/oracle-client.js';
import { transformGrant, transformHierarchy } from '../services/transformers/index.js';

const tally = (xs: string[]): Array<[string, number]> =>
  [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort();

async function main(): Promise<void> {
  const conn = JSON.parse(process.env.EUL_CONN ?? '') as EulConnectionConfig;
  const eul = await readEulSchema(conn);
  const v = eul.version.version;

  const raw = eul.data.hierarchies;
  const hs = raw.map((h) => transformHierarchy(h, v));
  console.log('--- hierarchies ---');
  console.log('source            =', raw.length);
  console.log('outcome           =', tally(hs.map((h) => h.skipReason ?? 'MIGRATED')));
  console.log('resolve >= 1 BA   =', raw.filter((h) => h.businessAreaId !== null).length);
  console.log('span > 1 BA       =', raw.filter((h) => h.spannedBusinessAreaIds.length > 1).length);
  console.log(
    'levels with item  =',
    raw.reduce((n, h) => n + h.nodes.filter((x) => x.itemId !== null).length, 0),
    'of',
    raw.reduce((n, h) => n + h.nodes.length, 0),
  );
  const tpl = raw.filter((h) => h.hierarchyType === 'DBH');
  console.log(
    'DBH templates     =',
    tpl.length,
    '| distinct shapes =',
    [...new Set(tpl.map((t) => t.dateTemplateLevels.map((l) => l.name).join(' > ')))],
  );

  const gs = eul.data.grants.map((g) => transformGrant(g, v));
  const kept = gs.filter((g) => !g.skip);
  console.log('--- grants ---');
  console.log('source            =', gs.length);
  console.log('by level          =', tally(gs.map((g) => g.level)));
  console.log('migrated          =', kept.length);
  console.log('permission levels =', tally(kept.map((g) => g.permissionLevel)));
  console.log(
    'distinct user|BA  =',
    new Set(kept.map((g) => `${g.granteeUsername}|${g.businessAreaSourceId}`)).size,
  );
  console.log(
    'AP_PRIV_LEVEL flagged =',
    gs.flatMap((g) => g.warnings).filter((w) => w.code === 'GRANT_PRIV_LEVEL_UNMAPPED').length,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
