/**
 * Jest setup: point every test run at a dedicated test database, and refuse to
 * run against anything else.
 *
 * Why this exists: the suites here clean up with unscoped `DELETE FROM`, which
 * is correct for a throwaway database and catastrophic for a working one. Run
 * against the dev database, `npx jest` silently destroys whatever you had
 * configured — business areas, folders, and registered Oracle data sources
 * included. That happened; this makes it impossible rather than unlikely.
 *
 * Two rules:
 *   1. No DATABASE_URL          → default to the test database.
 *   2. DATABASE_URL set, but not to a test database → throw, loudly, before a
 *      single test runs. Never "helpfully" rewrite it: a developer who typed a
 *      real database name is doing something they should reconsider, and
 *      silently redirecting them hides that.
 *
 * Runs via `setupFiles` (before the test framework and before any module reads
 * config), so `config.DATABASE_URL` is already correct by the time
 * `src/db/index.ts` builds its pool.
 */

/** A database is a test database if its name ends with this. */
const TEST_DB_SUFFIX = '_test';

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://discoverer:change_me_in_production@localhost:5432/discoverer_neo_test';

/**
 * The database name from a Postgres URL, or null if it can't be parsed.
 * Exported for the unit test that guards this guard.
 */
export function databaseNameOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, '');
    return name === '' ? null : name;
  } catch {
    return null;
  }
}

export function isTestDatabaseUrl(url: string): boolean {
  const name = databaseNameOf(url);
  return name !== null && name.endsWith(TEST_DB_SUFFIX);
}

/**
 * Decide the DATABASE_URL a test run should use.
 *
 * Returns the URL to use, or throws with an actionable message. Pure, so the
 * behaviour is testable without mutating the environment.
 */
export function resolveTestDatabaseUrl(current: string | undefined): string {
  if (current === undefined || current.trim() === '') {
    return DEFAULT_TEST_DATABASE_URL;
  }
  if (isTestDatabaseUrl(current)) return current;

  const name = databaseNameOf(current) ?? '(unparseable)';
  throw new Error(
    `Refusing to run tests against database "${name}".\n\n` +
      `These suites delete every row in the tables they touch, so they must only ` +
      `ever run against a database whose name ends in "${TEST_DB_SUFFIX}".\n\n` +
      `Either unset DATABASE_URL to use the default:\n` +
      `  ${DEFAULT_TEST_DATABASE_URL}\n` +
      `or point it at a *${TEST_DB_SUFFIX} database.\n\n` +
      `To create the test database:\n` +
      `  npm run db:test:setup --workspace @discoverer-neo/backend`,
  );
}

process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env.DATABASE_URL);
// Belt-and-braces: NODE_ENV=test also disables the in-process workers, so a
// test run cannot start pulling jobs off a real queue.
process.env.NODE_ENV = 'test';
