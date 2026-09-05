/**
 * In-memory `MigrationWriter` for hermetic migration-runner tests.
 *
 * Mirrors the real Drizzle writer's two-scope behaviour: data writes inside a
 * `transaction()` roll back on throw, while log writes always survive (the real
 * writer logs on the base auto-committed connection precisely so a failed run
 * still leaves its post-mortem behind).
 */

import type { MigrationLogInput, MigrationWriter } from '../services/migration-writer.js';
import type { TargetTable } from '../db/schema.js';

export type FakeTables = Record<TargetTable, Array<Record<string, unknown>>>;

export interface FakeWriterState {
  ensureSchemaCalls: number;
  transactionCalls: number;
  logs: MigrationLogInput[];
  tables: FakeTables;
  /** Pre-existing row counts, to emulate a non-empty target database. */
  baseline: Partial<Record<TargetTable, number>>;
}

export function emptyTargetTables(): FakeTables {
  return {
    users: [],
    business_areas: [],
    folders: [],
    folder_business_areas: [],
    items: [],
    joins: [],
    join_predicates: [],
    hierarchies: [],
    hierarchy_levels: [],
    custom_functions: [],
    maps: [],
    map_items: [],
    map_conditions: [],
    map_parameters: [],
    map_calculated_fields: [],
    map_layouts: [],
    map_totals: [],
    map_page_setup: [],
    map_conditional_formats: [],
    user_business_area_grants: [],
  };
}

export interface FakeWriterOptions {
  /** Throw when inserting into this table (to exercise rollback). */
  failOnInsert?: TargetTable;
  /**
   * Throw when counting these tables — how a target whose schema is behind the
   * code behaves, since Postgres raises `undefined_table` rather than
   * returning zero.
   */
  failOnCount?: readonly TargetTable[];
  /** Rows already present in the target before the run. */
  baseline?: Partial<Record<TargetTable, number>>;
  /** Report a different count than actually stored (to force a mismatch). */
  countOverride?: Partial<Record<TargetTable, number>>;
  /** Emails already in the target `users` table (e.g. a previous migration). */
  existingUserEmails?: string[];
  /**
   * Start from an existing target rather than an empty one — a database that
   * has already been migrated. Adopted by reference, so the caller sees writes
   * through their own handle too.
   */
  tables?: FakeTables;
}

export interface FakeWriter {
  writer: MigrationWriter;
  state: FakeWriterState;
}

export function createFakeWriter(options: FakeWriterOptions = {}): FakeWriter {
  const state: FakeWriterState = {
    ensureSchemaCalls: 0,
    transactionCalls: 0,
    logs: [],
    tables: options.tables ?? emptyTargetTables(),
    baseline: options.baseline ?? {},
  };

  const makeWriter = (tables: FakeTables): MigrationWriter => ({
    ensureSchema: () => {
      state.ensureSchemaCalls += 1;
      return Promise.resolve();
    },
    log: (entry: MigrationLogInput) => {
      // Logs are never rolled back — same as the real writer's base connection.
      state.logs.push(entry);
      return Promise.resolve();
    },
    insert: (table: TargetTable, rows: Record<string, unknown>[]) => {
      if (options.failOnInsert === table) {
        return Promise.reject(new Error(`fake insert failure on ${table}`));
      }
      tables[table].push(...rows);
      return Promise.resolve();
    },
    existingUserEmails: () => {
      const emails = new Set((options.existingUserEmails ?? []).map((e) => e.toLowerCase()));
      for (const row of tables.users) {
        const email = row.email;
        if (typeof email === 'string') emails.add(email.toLowerCase());
      }
      return Promise.resolve(emails);
    },
    count: (table: TargetTable) => {
      if (options.failOnCount?.includes(table)) {
        return Promise.reject(new Error(`relation "${table}" does not exist`));
      }
      const override = options.countOverride?.[table];
      if (override !== undefined) return Promise.resolve(override);
      return Promise.resolve((state.baseline[table] ?? 0) + tables[table].length);
    },
    snapshotForMaps: () => {
      const str = (row: Record<string, unknown>, key: string): string =>
        typeof row[key] === 'string' ? row[key] : '';
      const folderNameById = new Map(tables.folders.map((f) => [str(f, 'id'), str(f, 'name')]));
      const mapCountByBusinessArea: Record<string, number> = {};
      for (const row of tables.maps) {
        const baId = str(row, 'businessAreaId');
        mapCountByBusinessArea[baId] = (mapCountByBusinessArea[baId] ?? 0) + 1;
      }
      return Promise.resolve({
        users: tables.users.map((u) => ({ id: str(u, 'id'), email: str(u, 'email') })),
        businessAreas: tables.business_areas.map((b) => ({
          id: str(b, 'id'),
          name: str(b, 'name'),
        })),
        items: tables.items.map((i) => ({
          id: str(i, 'id'),
          name: str(i, 'name'),
          folderName: folderNameById.get(str(i, 'folderId')) ?? '',
        })),
        mapCountByBusinessArea,
      });
    },
    deleteMapsInBusinessArea: (businessAreaId: string) => {
      const doomed = new Set(
        tables.maps.filter((m) => m.businessAreaId === businessAreaId).map((m) => m.id),
      );
      if (doomed.size === 0) return Promise.resolve(0);
      tables.maps = tables.maps.filter((m) => !doomed.has(m.id));
      // Emulate ON DELETE CASCADE from maps to everything keyed on a map.
      for (const table of [
        'map_items',
        'map_conditions',
        'map_parameters',
        'map_calculated_fields',
        'map_layouts',
        'map_totals',
        'map_page_setup',
        'map_conditional_formats',
      ] as const) {
        tables[table] = tables[table].filter((row) => !doomed.has(row.mapId));
      }
      state.tables = tables;
      return Promise.resolve(doomed.size);
    },
    transaction: async <T,>(fn: (w: MigrationWriter) => Promise<T>): Promise<T> => {
      state.transactionCalls += 1;
      // Snapshot for rollback.
      const snapshot: FakeTables = emptyTargetTables();
      for (const key of Object.keys(tables) as TargetTable[]) {
        snapshot[key] = [...tables[key]];
      }
      try {
        return await fn(makeWriter(tables));
      } catch (err) {
        for (const key of Object.keys(snapshot) as TargetTable[]) {
          tables[key] = snapshot[key];
        }
        state.tables = tables;
        throw err;
      }
    },
  });

  return { writer: makeWriter(state.tables), state };
}

/** Convenience: row counts per table. */
export function tableCounts(state: FakeWriterState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [table, rows] of Object.entries(state.tables)) out[table] = rows.length;
  return out;
}
