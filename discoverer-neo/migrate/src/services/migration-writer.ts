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

import { sql } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { TargetDatabase } from '../db/client.js';
import { MIGRATION_LOG_DDL, migrationLog, TARGET_TABLES } from '../db/schema.js';
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
  /** Run `fn` inside a transaction; data writes roll back together on throw. */
  transaction<T>(fn: (writer: MigrationWriter) => Promise<T>): Promise<T>;
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

  async transaction<T>(fn: (writer: MigrationWriter) => Promise<T>): Promise<T> {
    return this.base.transaction(async (tx) => fn(new DrizzleMigrationWriter(this.base, tx as TargetDatabase)));
  }
}

/** Build a Drizzle-backed writer over a target Discoverer Neo database. */
export function createMigrationWriter(db: TargetDatabase): MigrationWriter {
  return new DrizzleMigrationWriter(db);
}
