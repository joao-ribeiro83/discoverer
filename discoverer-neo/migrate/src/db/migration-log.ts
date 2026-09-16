/**
 * `migration_log` — created and owned by the migrator, and deliberately NOT
 * part of `db/schema.ts`.
 *
 * The backend re-exports that schema wholesale, so anything declared there
 * becomes a table `drizzle-kit generate` will try to create. This one is
 * created by the writer's own `ensureSchema()` instead (the DDL below), which
 * is why it lives in its own module.
 */

import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const migrationLog = pgTable(
  'migration_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Groups all rows written by a single `runMigration` invocation. */
    runId: uuid('run_id').notNull(),
    /** INFO | WARN | ERROR. */
    level: varchar('level', { length: 16 }).notNull(),
    /** Pipeline phase / entity the entry relates to (e.g. 'folders'). */
    phase: varchar('phase', { length: 64 }),
    message: text('message').notNull(),
    /** Source object id the entry concerns, when applicable. */
    sourceId: integer('source_id'),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('migration_log_run_idx').on(t.runId)],
);

/** DDL for `migration_log`, run by the writer's `ensureSchema()`. */
export const MIGRATION_LOG_DDL = `
CREATE TABLE IF NOT EXISTS migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  level varchar(16) NOT NULL,
  phase varchar(64),
  message text NOT NULL,
  source_id integer,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS migration_log_run_idx ON migration_log (run_id);
`;

export type NewMigrationLogRow = typeof migrationLog.$inferInsert;

/**
 * `migration_objects` — the baseline an incremental delta diffs against: one
 * row per migrated source object, naming the target row it became and a hash
 * of the rows it was written as (`delta.ts`). Owned by the migrator for the
 * same reason as `migration_log`.
 */
export const migrationObjects = pgTable('migration_objects', {
  /** Source key, e.g. `folder:200`, `map:<DOC_ID>:<worksheet GUID>`. */
  key: text('key').primaryKey(),
  targetId: uuid('target_id').notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  /** The `migration_log.run_id` that last wrote this row. */
  runId: uuid('run_id').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

/** DDL for `migration_objects`, run by the delta's `ensureSchema()`. */
export const MIGRATION_OBJECTS_DDL = `
CREATE TABLE IF NOT EXISTS migration_objects (
  key text PRIMARY KEY,
  target_id uuid NOT NULL,
  hash varchar(64) NOT NULL,
  run_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
`;
