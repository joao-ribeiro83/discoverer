/**
 * The Drizzle implementation of `DeltaDb`. Separate from `delta.ts` so the
 * decisions stay testable without a database, as `join-reimport-db.ts` does.
 */

import { eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import type { PgColumn, PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { TargetDatabase } from '../db/client.js';
import { MIGRATION_LOG_DDL, MIGRATION_OBJECTS_DDL, migrationLog, migrationObjects } from '../db/migration-log.js';
import { TARGET_TABLES } from '../db/schema.js';
import type { TargetTable } from '../db/schema.js';
import type { BaselineEntry, DeltaDb, DeltaTx } from './delta.js';

// Same bound as the migration writer: well inside Postgres' 65 535 bind parameters.
const CHUNK = 500;

function chunks<T>(values: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK));
  return out;
}

function column(table: TargetTable, name: string): PgColumn {
  const col = (getTableColumns(TARGET_TABLES[table]) as Record<string, PgColumn>)[name];
  if (!col) throw new Error(`${table} has no column ${name}`);
  return col;
}

function txOver(db: TargetDatabase): DeltaTx {
  return {
    async insert(table, rows) {
      for (const part of chunks(rows)) {
        await db.insert(TARGET_TABLES[table]).values(part as unknown as PgInsertValue<PgTable>[]);
      }
    },
    async update(table, id, values) {
      await db.update(TARGET_TABLES[table]).set(values).where(eq(column(table, 'id'), id));
    },
    async deleteWhere(table, name, values) {
      for (const part of chunks(values)) {
        await db.delete(TARGET_TABLES[table]).where(inArray(column(table, name), part));
      }
    },
    async readRows(table) {
      return db.select().from(TARGET_TABLES[table]);
    },
    async saveBaseline(runId, upsert, remove) {
      for (const part of chunks(upsert)) {
        await db
          .insert(migrationObjects)
          .values(part.map(([key, e]) => ({ key, targetId: e.targetId, hash: e.hash, runId })))
          .onConflictDoUpdate({
            target: migrationObjects.key,
            set: {
              targetId: sql`excluded.target_id`,
              hash: sql`excluded.hash`,
              runId: sql`excluded.run_id`,
              recordedAt: sql`now()`,
            },
          });
      }
      for (const part of chunks(remove)) {
        await db.delete(migrationObjects).where(inArray(migrationObjects.key, part));
      }
    },
  };
}

export function createDeltaDb(db: TargetDatabase): DeltaDb {
  const base = txOver(db);
  return {
    async ensureSchema() {
      for (const statement of `${MIGRATION_LOG_DDL};${MIGRATION_OBJECTS_DDL}`.split(';')) {
        if (statement.trim() !== '') await db.execute(sql.raw(statement.trim()));
      }
    },
    async log(entry) {
      await db.insert(migrationLog).values({
        runId: entry.runId,
        level: entry.level,
        phase: entry.phase ?? null,
        message: entry.message,
        sourceId: entry.sourceId ?? null,
        detail: entry.detail ?? null,
      });
    },
    async readBaseline() {
      // A dry run on a target no delta has touched must not create the table.
      const exists = await db.execute<{ present: boolean }>(
        sql`SELECT to_regclass('migration_objects') IS NOT NULL AS present`,
      );
      if (exists.rows[0]?.present !== true) return new Map<string, BaselineEntry>();
      const rows = await db.select().from(migrationObjects);
      return new Map(rows.map((r) => [r.key, { targetId: r.targetId, hash: r.hash }]));
    },
    readRows: (table) => base.readRows(table),
    transaction(fn) {
      return db.transaction(async (tx) => fn(txOver(tx as unknown as TargetDatabase)));
    },
  };
}
