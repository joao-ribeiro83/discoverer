/**
 * Re-encrypt every stored credential from one ENCRYPTION_KEY to another.
 *
 *   OLD_ENCRYPTION_KEY='<current>' NEW_ENCRYPTION_KEY='<new>' \
 *     npx tsx src/scripts/rotate-encryption-key.ts [--dry-run] [--allow-undecryptable]
 *
 * The full runbook — back up first, generate, dry-run, rotate, install, verify —
 * is in docs/deployment/configuration.md. Read it before running this.
 *
 * `data_sources.password_enc` is the only encrypted column in the schema:
 * `encrypt`/`decrypt` have no other call site. If that changes, this script
 * has to grow with it or a rotation will silently leave the new column behind.
 *
 * Safety properties, in order of how much they matter:
 *
 *  - Everything is decrypted BEFORE anything is written. A row that will not
 *    open under the old key aborts the run, because the likeliest cause is a
 *    wrong old key — and rotating on a wrong old key destroys every password
 *    in the table with no way back except retyping them.
 *  - Each new ciphertext is decrypted back under the new key before it is
 *    allowed to replace the old one. GCM's auth tag makes that a proof, not
 *    an inference.
 *  - One transaction. A crash halfway leaves the whole set on the old key,
 *    which the old key still opens.
 *  - No plaintext is ever printed, logged or written to disk.
 */

import { decryptWith, deriveKey, encryptWith } from '../lib/encryption.js';
import { pool } from '../db/index.js';

interface Row {
  id: string;
  name: string;
  password_enc: string;
}

function requireKey(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set and at least 32 characters long`);
  }
  return value;
}

async function main(): Promise<number> {
  const dryRun = process.argv.includes('--dry-run');
  const allowUndecryptable = process.argv.includes('--allow-undecryptable');

  const oldKey = deriveKey(requireKey('OLD_ENCRYPTION_KEY'));
  const newKey = deriveKey(requireKey('NEW_ENCRYPTION_KEY'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE: nothing may register or edit a data source mid-rotation and
    // have its brand-new ciphertext written under the old key.
    const { rows } = await client.query<Row>(
      `SELECT id, name, password_enc
         FROM data_sources
        WHERE password_enc IS NOT NULL AND password_enc <> ''
        ORDER BY name
        FOR UPDATE`,
    );

    console.log(`Found ${rows.length} stored credential(s).`);

    // Phase 1 — decrypt everything before writing anything.
    const rotated: { id: string; name: string; ciphertext: string }[] = [];
    const failed: Row[] = [];

    for (const row of rows) {
      let plaintext: string;
      try {
        plaintext = decryptWith(oldKey, row.password_enc);
      } catch {
        failed.push(row);
        continue;
      }

      const ciphertext = encryptWith(newKey, plaintext);
      // Prove the rewrite before trusting it.
      if (decryptWith(newKey, ciphertext) !== plaintext) {
        throw new Error(`Re-encrypted credential for "${row.name}" did not round-trip`);
      }
      rotated.push({ id: row.id, name: row.name, ciphertext });
    }

    if (failed.length > 0) {
      for (const row of failed) {
        console.error(`  ✗ will not decrypt under OLD_ENCRYPTION_KEY: ${row.name} (${row.id})`);
      }
      if (!allowUndecryptable) {
        throw new Error(
          `${failed.length} credential(s) did not decrypt. Either OLD_ENCRYPTION_KEY ` +
            'is wrong — in which case rotating would destroy every password — or ' +
            'those rows never held valid ciphertext. Inspect them, then re-run ' +
            'with --allow-undecryptable to rotate the rest and leave them untouched.',
        );
      }
      console.warn(`Leaving ${failed.length} undecryptable credential(s) untouched.`);
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`Dry run: ${rotated.length} credential(s) would be re-encrypted.`);
      return failed.length > 0 && !allowUndecryptable ? 1 : 0;
    }

    // Phase 2 — write.
    for (const row of rotated) {
      await client.query('UPDATE data_sources SET password_enc = $1 WHERE id = $2', [
        row.ciphertext,
        row.id,
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ Re-encrypted ${rotated.length} credential(s) under the new key.`);
    console.log('Now set ENCRYPTION_KEY to the new value and restart the backend.');
    return 0;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {
      // The connection may already be gone; the abort is what matters.
    });
    throw err;
  } finally {
    client.release();
  }
}

main()
  .then(async (code) => {
    await pool.end();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    console.error('❌ Rotation aborted, nothing was changed.');
    console.error(err instanceof Error ? err.message : err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
