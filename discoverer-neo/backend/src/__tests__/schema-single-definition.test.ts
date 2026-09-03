/**
 * BE-10 / D-011 — the shared tables have exactly one declaration.
 *
 * Before this, `backend/src/db/schema.ts` and `migrate/src/db/schema.ts` each
 * declared the same 20 tables, and nothing made them agree. They didn't: the
 * migrator's `map_conditions` had no `group_id`, so 5 605 imported conditions
 * lost their parenthesisation, and its `maps.business_area_id` was still
 * `notNull()` a phase after the backend made it advisory.
 *
 * The fix is a re-export, not a second copy. That turns a column change in
 * core into a compile error in every backend consumer that relied on the old
 * type — which is a real gate, but only for as long as nobody re-adds a local
 * `pgTable` here. This test is what stops that.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHARED_TABLES = [
  'users',
  'data_sources',
  'business_areas',
  'user_business_area_grants',
  'folders',
  'folder_business_areas',
  'items',
  'joins',
  'hierarchies',
  'hierarchy_levels',
  'custom_functions',
  'maps',
  'map_items',
  'map_conditions',
  'map_parameters',
  'map_calculated_fields',
  'map_layouts',
  'map_totals',
  'map_page_setup',
  'map_conditional_formats',
];

const BACKEND_SCHEMA = join(__dirname, '..', 'db', 'schema.ts');
const CORE_SCHEMA = join(__dirname, '..', '..', '..', 'migrate', 'src', 'db', 'schema.ts');

/** Table names passed to a `pgTable('<name>', ...)` call in `source`. */
function declaredTables(source: string): string[] {
  return [...source.matchAll(/pgTable\(\s*\n?\s*'([^']+)'/g)].map((m) => m[1]!);
}

describe('shared schema has a single definition', () => {
  const backend = readFileSync(BACKEND_SCHEMA, 'utf8');
  const core = readFileSync(CORE_SCHEMA, 'utf8');

  it('declares every shared table in core, and none of them in the backend', () => {
    const inCore = declaredTables(core);
    const inBackend = declaredTables(backend);

    expect([...SHARED_TABLES].sort()).toEqual([...inCore].sort());
    expect(inBackend.filter((t) => SHARED_TABLES.includes(t))).toEqual([]);
  });

  it('re-exports core from the backend rather than redeclaring it', () => {
    expect(backend).toContain("export * from '@discoverer-neo/core/db/schema';");
  });

  it('keeps migration_log out of the re-export', () => {
    // The migrator creates it itself via `ensureSchema()`. If it were exported
    // from `db/schema.ts` the backend would re-export it and `drizzle-kit
    // generate` would emit a CREATE TABLE for a table that already exists.
    expect(core).not.toContain("pgTable(\n  'migration_log'");
    expect(core).not.toContain("pgTable('migration_log'");
  });
});
