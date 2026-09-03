/**
 * Target-side writer for the migration runner.
 *
 * `MigrationWriter` is the seam that keeps the runner hermetically testable:
 * production uses the Drizzle implementation over a real Postgres connection,
 * while tests inject an in-memory fake (mirrors the `OracleExecutor` seam on
 * the read side).
 *
 * Two connection scopes matter here:
 *  - **data** writes (`insert`/`count`) run on the current connection, which is
 *    the transaction connection inside `transaction()`, so a failed run rolls
 *    back cleanly.
 *  - **log** writes always run on the base (auto-committed) connection, so the
 *    migration_log survives even when the data transaction rolls back — the log
 *    is the post-mortem and must outlive the failure it records.
 */

import { eq, sql } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { TargetDatabase } from '../db/client.js';
import { MIGRATION_LOG_DDL, migrationLog } from '../db/migration-log.js';
import { businessAreas, folders, items, maps, TARGET_TABLES, users } from '../db/schema.js';
import type { TargetTable } from '../db/schema.js';

export type MigrationLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface MigrationLogInput {
  runId: string;
  level: MigrationLogLevel;
  phase?: string | null;
  message: string;
  sourceId?: number | null;
  detail?: unknown;
}

export interface MigrationWriter {
  /** Create the migration_log table (idempotent). */
  ensureSchema(): Promise<void>;
  /** Append a log row (always committed, even during a rolled-back run). */
  log(entry: MigrationLogInput): Promise<void>;
  /** Bulk-insert into a target table (no-op for an empty array). */
  insert(table: TargetTable, rows: Record<string, unknown>[]): Promise<void>;
  /** Count rows currently in a target table. */
  count(table: TargetTable): Promise<number>;
  /**
   * Emails already in the target `users` table, lower-cased.
   *
   * Read before anything is written. The migration's own service account is
   * the marker for "this database has already been migrated", and every other
   * address here is one a synthesized email must not collide with — the users
   * insert is the first statement of the run, so a collision there costs the
   * whole migration.
   */
  existingUserEmails(): Promise<Set<string>>;
  /**
   * The target rows a maps-only re-import needs to resolve its references —
   * see `map-reimport.ts`. Read as one snapshot rather than queried per
   * workbook: a real EUL has thousands of items and hundreds of workbooks, and
   * resolving column by column would be thousands of round trips.
   */
  snapshotForMaps(): Promise<TargetSnapshot>;
  /**
   * Delete every map in `businessAreaId`, returning how many went.
   *
   * Cascades to the map's items, conditions, parameters, calculated fields,
   * shares, schedules and export jobs (all `ON DELETE CASCADE`). Only ever
   * called against the migration's own host business area.
   */
  deleteMapsInBusinessArea(businessAreaId: string): Promise<number>;
  /** Run `fn` inside a transaction; data writes roll back together on throw. */
  transaction<T>(fn: (writer: MigrationWriter) => Promise<T>): Promise<T>;
}

/** Target state a maps-only re-import resolves against. */
export interface TargetSnapshot {
  users: Array<{ id: string; email: string }>;
  businessAreas: Array<{ id: string; name: string }>;
  /** Items, each with the name of the folder holding it. */
  items: Array<{ id: string; name: string; folderName: string }>;
  /** How many maps each business area currently holds, keyed by its id. */
  mapCountByBusinessArea: Record<string, number>;
}

// Postgres caps a statement at 65535 bind parameters. Target rows have well
// under ~20 columns; 500 rows/insert keeps us comfortably inside the limit.
const INSERT_CHUNK_ROWS = 500;

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

class DrizzleMigrationWriter implements MigrationWriter {
  /** Base connection: owns logging and starts transactions. */
  private readonly base: TargetDatabase;
  /** Current data connection: the transaction inside `transaction()`, else base. */
  private readonly exec: TargetDatabase;

  constructor(base: TargetDatabase, exec: TargetDatabase = base) {
    this.base = base;
    this.exec = exec;
  }

  async ensureSchema(): Promise<void> {
    // Split the DDL so each statement runs on its own (drizzle's execute sends
    // a single statement over the extended protocol).
    for (const statement of MIGRATION_LOG_DDL.split(';')) {
      const trimmed = statement.trim();
      if (trimmed !== '') await this.base.execute(sql.raw(trimmed));
    }
  }

  async log(entry: MigrationLogInput): Promise<void> {
    await this.base.insert(migrationLog).values({
      runId: entry.runId,
      level: entry.level,
      phase: entry.phase ?? null,
      message: entry.message,
      sourceId: entry.sourceId ?? null,
      detail: entry.detail ?? null,
    });
  }

  async insert(table: TargetTable, rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;
    const target: PgTable = TARGET_TABLES[table];
    for (const rowChunk of chunk(rows, INSERT_CHUNK_ROWS)) {
      await this.exec.insert(target).values(rowChunk as unknown as PgInsertValue<PgTable>[]);
    }
  }

  async count(table: TargetTable): Promise<number> {
    const target: PgTable = TARGET_TABLES[table];
    const result = await this.exec.select({ c: sql<number>`count(*)::int` }).from(target);
    return result[0]?.c ?? 0;
  }

  async existingUserEmails(): Promise<Set<string>> {
    const rows = await this.exec.select({ email: users.email }).from(users);
    return new Set(rows.map((row) => row.email.toLowerCase()));
  }

  async snapshotForMaps(): Promise<TargetSnapshot> {
    const userRows = await this.exec.select({ id: users.id, email: users.email }).from(users);
    const baRows = await this.exec
      .select({ id: businessAreas.id, name: businessAreas.name })
      .from(businessAreas);
    // The folder name rides along on each item: `map_items` resolves by
    // (folder name, item name), and joining here is one query instead of a
    // second pass to stitch folders onto items.
    const itemRows = await this.exec
      .select({ id: items.id, name: items.name, folderName: folders.name })
      .from(items)
      .innerJoin(folders, eq(items.folderId, folders.id));
    const mapCounts = await this.exec
      .select({ businessAreaId: maps.businessAreaId, count: sql<number>`count(*)::int` })
      .from(maps)
      .groupBy(maps.businessAreaId);

    const mapCountByBusinessArea: Record<string, number> = {};
    // `maps.business_area_id` is advisory and nullable since Phase 1.1 — the
    // effective folder set is what scopes a map. Maps with no owning area are
    // simply not counted against one.
    for (const row of mapCounts) {
      if (row.businessAreaId !== null) mapCountByBusinessArea[row.businessAreaId] = row.count;
    }

    return {
      users: userRows,
      businessAreas: baRows,
      items: itemRows,
      mapCountByBusinessArea,
    };
  }

  async deleteMapsInBusinessArea(businessAreaId: string): Promise<number> {
    const doomed = await this.exec
      .select({ id: maps.id })
      .from(maps)
      .where(eq(maps.businessAreaId, businessAreaId));
    if (doomed.length === 0) return 0;
    await this.exec.delete(maps).where(eq(maps.businessAreaId, businessAreaId));
    return doomed.length;
  }

  async transaction<T>(fn: (writer: MigrationWriter) => Promise<T>): Promise<T> {
    return this.base.transaction(async (tx) => fn(new DrizzleMigrationWriter(this.base, tx as TargetDatabase)));
  }
}

/** Build a Drizzle-backed writer over a target Discoverer Neo database. */
export function createMigrationWriter(db: TargetDatabase): MigrationWriter {
  return new DrizzleMigrationWriter(db);
}
