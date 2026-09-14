/**
 * Decrypt a data source's stored password and write it, alone, to a file
 * under `credentials/` (bind-mounted to the host) — the one input
 * `dump-corpus.ps1` needs that this repo cannot otherwise hand to a Windows
 * process without an interactive prompt.
 *
 *   npx tsx src/scripts/export-datasource-password.ts <dataSourceId> <filename>
 *
 * The caller must delete the file immediately after use — this script only
 * writes it.
 */
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'node:fs';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';

async function main() {
  const dataSourceId = process.argv[2];
  const filename = process.argv[3];
  if (!dataSourceId || !filename) {
    throw new Error('usage: export-datasource-password.ts <dataSourceId> <filename>');
  }
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('data source not found');
  if (!ds.passwordEnc) throw new Error('data source has no stored password');

  const outPath = `${process.env.CREDENTIALS_DIR ?? '/app/credentials'}/${filename}`;
  writeFileSync(outPath, decrypt(ds.passwordEnc), { mode: 0o600 });
  console.log(`wrote ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
