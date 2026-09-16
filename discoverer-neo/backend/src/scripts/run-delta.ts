/**
 * Operator entry point for the incremental delta (Phase 9.2) on a deployment
 * where the EUL password lives only in `data_sources` — it connects the way
 * the migration API does, so no plain-text credential file is ever written.
 *
 *   docker exec discoverer-neo-backend sh -c \
 *     'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/run-delta.ts <dataSourceId> [--live] [--json] [schemaOwner]'
 *
 * Defaults to a dry run. `--live` applies the delta in one transaction and then
 * runs the verifier. Take a backup first (`scripts/backup.sh`).
 *
 * Same operation as `dn-migrate delta --target <url>` — see
 * `migrate/src/services/delta.ts`.
 */

import {
  closeAllPools,
  commandDelta,
  commandVerify,
  createDeltaDb,
  createTargetDb,
} from '@discoverer-neo/core/migration';

import { config } from '../config.js';
import { defaultDeps } from '../services/migration.service.js';

const dataSourceId = process.argv[2];
const live = process.argv.includes('--live');
const json = process.argv.includes('--json');
const schemaOwner = process.argv.slice(3).find((a) => !a.startsWith('--'));
if (!dataSourceId) throw new Error('usage: run-delta.ts <dataSourceId> [--live] [--json] [schemaOwner]');

const deps = defaultDeps();
const source = deps.makeSource(await deps.loadConnection(dataSourceId));
const target = createTargetDb({ connectionString: config.DATABASE_URL });
const io = { out: (line: string) => console.log(line), err: (line: string) => console.error(line) };

try {
  process.exitCode = await commandDelta(
    source,
    createDeltaDb(target.db),
    (compile) => commandVerify(target.db, { json, compile }, io),
    {
      readOptions: schemaOwner ? { schemaOwner } : {},
      version: 'auto',
      dryRun: !live,
      json,
      dataSourceId,
    },
    io,
  );
} finally {
  await target.close();
  await closeAllPools();
}
