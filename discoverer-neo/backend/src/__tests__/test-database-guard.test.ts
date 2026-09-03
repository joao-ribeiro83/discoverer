/**
 * Tests for the guard that keeps `npx jest` off a real database.
 *
 * This one matters more than most: if it silently stops working, the failure
 * mode is a developer losing their local data with no error — which is exactly
 * what happened before the guard existed.
 */

import {
  DEFAULT_TEST_DATABASE_URL,
  databaseNameOf,
  isTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from './setup/test-database.js';

describe('databaseNameOf', () => {
  it('extracts the database name from a Postgres URL', () => {
    expect(databaseNameOf('postgres://u:p@localhost:5432/discoverer_neo')).toBe(
      'discoverer_neo',
    );
  });

  it('ignores query parameters', () => {
    expect(
      databaseNameOf('postgres://u:p@host:5432/app_test?sslmode=require'),
    ).toBe('app_test');
  });

  it('returns null when there is no database name', () => {
    expect(databaseNameOf('postgres://u:p@localhost:5432/')).toBeNull();
    expect(databaseNameOf('postgres://u:p@localhost:5432')).toBeNull();
  });

  it('returns null for something that is not a URL', () => {
    expect(databaseNameOf('not a url')).toBeNull();
    expect(databaseNameOf('')).toBeNull();
  });
});

describe('isTestDatabaseUrl', () => {
  it.each([
    ['postgres://u:p@h:5432/discoverer_neo_test', true],
    ['postgres://u:p@h:5432/anything_test', true],
    ['postgres://u:p@h:5432/discoverer_neo', false],
    ['postgres://u:p@h:5432/production', false],
    // A name that merely *contains* "_test" is not a test database.
    ['postgres://u:p@h:5432/testing_prod', false],
    ['postgres://u:p@h:5432/my_test_data', false],
  ])('%s → %s', (url, expected) => {
    expect(isTestDatabaseUrl(url)).toBe(expected);
  });
});

describe('resolveTestDatabaseUrl', () => {
  it('defaults to the test database when DATABASE_URL is unset', () => {
    expect(resolveTestDatabaseUrl(undefined)).toBe(DEFAULT_TEST_DATABASE_URL);
    expect(resolveTestDatabaseUrl('')).toBe(DEFAULT_TEST_DATABASE_URL);
    expect(resolveTestDatabaseUrl('   ')).toBe(DEFAULT_TEST_DATABASE_URL);
  });

  it('passes a test database through unchanged', () => {
    const url = 'postgres://u:p@remote:5432/ci_run_test';
    expect(resolveTestDatabaseUrl(url)).toBe(url);
  });

  it('THROWS rather than silently redirecting a real database', () => {
    // Silently rewriting would hide the mistake; the developer needs to know
    // they pointed a destructive suite at something they care about.
    expect(() =>
      resolveTestDatabaseUrl('postgres://u:p@h:5432/discoverer_neo'),
    ).toThrow(/Refusing to run tests against database "discoverer_neo"/);
  });

  it('names the offending database and how to fix it', () => {
    expect(() => resolveTestDatabaseUrl('postgres://u:p@h:5432/prod_data')).toThrow(
      /prod_data/,
    );
    expect(() => resolveTestDatabaseUrl('postgres://u:p@h:5432/prod_data')).toThrow(
      /db:test:setup/,
    );
  });

  it('rejects an unparseable DATABASE_URL instead of assuming it is safe', () => {
    expect(() => resolveTestDatabaseUrl('¯\\_(ツ)_/¯')).toThrow(/Refusing/);
  });

  it('the default it falls back to is itself a test database', () => {
    // Guards against someone "fixing" the default to a real database.
    expect(isTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL)).toBe(true);
  });
});
