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
    items: [],
    joins: [],
    hierarchies: [],
    hierarchy_levels: [],
    custom_functions: [],
    maps: [],
    map_items: [],
    user_business_area_grants: [],
  };
}

export interface FakeWriterOptions {
  /** Throw when inserting into this table (to exercise rollback). */
  failOnInsert?: TargetTable;
  /** Rows already present in the target before the run. */
  baseline?: Partial<Record<TargetTable, number>>;
  /** Report a different count than actually stored (to force a mismatch). */
  countOverride?: Partial<Record<TargetTable, number>>;
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
    tables: emptyTargetTables(),
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
    count: (table: TargetTable) => {
      const override = options.countOverride?.[table];
      if (override !== undefined) return Promise.resolve(override);
      return Promise.resolve((state.baseline[table] ?? 0) + tables[table].length);
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
