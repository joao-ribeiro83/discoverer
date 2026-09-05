/**
 * Create the test database and apply every migration to it.
 *
 * Idempotent: safe to re-run, and safe to run when the database already exists.
 * Deliberately refuses to touch a database whose name does not end in `_test`
 * — this script DROPs and recreates schema, so pointing it at a real database
 * would be destructive.
 *
 *   node scripts/setup-test-db.mjs            # create + migrate
 *   node scripts/setup-test-db.mjs --recreate # drop first, for a clean slate
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'drizzle');

const TEST_DB_SUFFIX = '_test';
const DEFAULT_URL =
  'postgres://discoverer:change_me_in_production@localhost:5432/discoverer_neo_test';

const url = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_URL);
const dbName = url.pathname.replace(/^\//, '');

if (!dbName.endsWith(TEST_DB_SUFFIX)) {
  console.error(
    `Refusing to operate on "${dbName}": this script creates and migrates a ` +
      `throwaway database, so its name must end in "${TEST_DB_SUFFIX}".`,
  );
  process.exit(1);
}

const recreate = process.argv.includes('--recreate');

/** Connect to the maintenance database to create/drop the target. */
function adminClient() {
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  return new Client({ connectionString: adminUrl.toString() });
}

async function ensureDatabase() {
  const admin = adminClient();
  await admin.connect();
  try {
    if (recreate) {
      // Terminate stragglers first; DROP DATABASE fails while anyone is
      // connected, and a hung test run is exactly the case this handles.
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      console.log(`dropped ${dbName}`);
    }

    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`created ${dbName}`);
      return true;
    }
    console.log(`${dbName} already exists`);
    return false;
  } finally {
    await admin.end();
  }
}

async function applyMigrations(isFresh) {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort(); // 0000_, 0001_, … lexicographic order is migration order

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      // drizzle-kit separates statements with this marker; splitting lets one
      // already-applied statement be skipped without aborting the whole file.
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      let applied = 0;
      let skipped = 0;
      for (const statement of statements) {
        try {
          await client.query(statement);
          applied += 1;
        } catch (err) {
          // Re-running migrations against an existing database is normal here,
          // so "already exists" is expected. Anything else is a real failure.
          const code = err?.code;
          let benign =
            code === '42P07' || // duplicate_table
            code === '42710' || // duplicate_object (type, constraint)
            code === '42701' || // duplicate_column
            code === '42P16' || // invalid_table_definition (PK already there)
            code === '23505'; // unique_violation on a seed-ish insert

          // Replay-only: an early migration can name a column that a LATER one
          // drops. `0000` adds a foreign key on `joins.left_item_id`; `0014`
          // removes that column, because a join's columns moved to
          // `join_predicates`. Replayed over an already-migrated database, 0000
          // then fails on a column the database is correct not to have.
          //
          // Tolerated ONLY when the database already existed. On a fresh
          // database the files run in order, so a statement naming a column
          // that is not there yet is a genuine ordering bug in a new migration
          // — and CI always starts fresh, which is where that must be caught.
          if (!isFresh && (code === '42703' || code === '42704')) {
            benign = true; // undefined_column / undefined_object
          }

          if (!benign) {
            console.error(`\n${file} failed:\n  ${err.message}\n`);
            throw err;
          }
          skipped += 1;
        }
      }
      console.log(`  ${file}: ${applied} applied, ${skipped} already present`);
    }
  } finally {
    await client.end();
  }
}

const isFresh = await ensureDatabase();
console.log('applying migrations…');
await applyMigrations(isFresh);
console.log(`\ntest database ready: ${dbName}`);
