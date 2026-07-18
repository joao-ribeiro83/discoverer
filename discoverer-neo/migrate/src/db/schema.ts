/**
 * Drizzle definitions for the **target** Discoverer Neo tables the migration
 * runner writes into.
 *
 * This is deliberately a self-contained mirror of the subset of
 * `backend/src/db/schema.ts` that the migrator populates — the migrate
 * workspace does not import backend code (same standalone principle as
 * `oracle-client.ts`). The authoritative source of truth for these column
 * names, types, nullability and enum values is that backend schema; keep this
 * file in step with it. Only the columns the migrator sets are declared.
 *
 * `migration_log` is the one table that does NOT exist in the backend schema —
 * it is created by the migrator itself (see `migration-writer.ts`
 * `ensureSchema()`), so it is defined here with plain columns (no custom PG
 * enum type to create).
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums (names + values mirror backend/src/db/schema.ts)
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MANAGER', 'USER', 'VIEWER']);

export const folderTypeEnum = pgEnum('folder_type', [
  'TABLE',
  'VIEW',
  'DERIVED',
  'COMPLEX',
  'JOIN',
  'SUMMARY',
]);

export const itemTypeEnum = pgEnum('item_type', ['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU']);

export const permissionLevelEnum = pgEnum('permission_level', [
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'SCHEDULE',
  'VIEW',
]);

export const joinTypeEnum = pgEnum('join_type', ['INNER', 'LEFT', 'RIGHT', 'FULL']);

export const functionTypeEnum = pgEnum('function_type', ['SQL', 'PLSQL', 'PACKAGE']);

export const mapTypeEnum = pgEnum('map_type', ['TABLE', 'CROSSTAB', 'PAGE_DETAIL', 'CHART']);

export const sortDirectionEnum = pgEnum('sort_direction', ['ASC', 'DESC']);

// ---------------------------------------------------------------------------
// Target tables (write subset)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('USER'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const businessAreas = pgTable('business_areas', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export const userBusinessAreaGrants = pgTable('user_business_area_grants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  businessAreaId: uuid('business_area_id').notNull(),
  permissionLevel: permissionLevelEnum('permission_level').notNull(),
  grantedBy: uuid('granted_by'),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  businessAreaId: uuid('business_area_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  folderType: folderTypeEnum('folder_type').notNull(),
  tableName: varchar('table_name', { length: 255 }),
  tableOwner: varchar('table_owner', { length: 255 }),
  customSql: text('custom_sql'),
  dataSourceId: uuid('data_source_id'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable('items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  folderId: uuid('folder_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  itemType: itemTypeEnum('item_type').notNull(),
  columnName: varchar('column_name', { length: 255 }),
  formula: text('formula'),
  dataType: varchar('data_type', { length: 64 }),
  formatMask: varchar('format_mask', { length: 255 }),
  aggFunction: varchar('agg_function', { length: 64 }),
  displayOrder: integer('display_order').notNull().default(0),
  isHidden: boolean('is_hidden').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  parentItemId: uuid('parent_item_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const joins = pgTable('joins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  leftFolderId: uuid('left_folder_id').notNull(),
  rightFolderId: uuid('right_folder_id').notNull(),
  leftItemId: uuid('left_item_id'),
  rightItemId: uuid('right_item_id'),
  joinType: joinTypeEnum('join_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hierarchies = pgTable('hierarchies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  businessAreaId: uuid('business_area_id').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hierarchyLevels = pgTable('hierarchy_levels', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  hierarchyId: uuid('hierarchy_id').notNull(),
  levelName: varchar('level_name', { length: 255 }).notNull(),
  itemId: uuid('item_id').notNull(),
  levelNumber: integer('level_number').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customFunctions = pgTable('custom_functions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  functionType: functionTypeEnum('function_type').notNull(),
  parameters: jsonb('parameters'),
  returnType: varchar('return_type', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const maps = pgTable('maps', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  mapType: mapTypeEnum('map_type').notNull(),
  businessAreaId: uuid('business_area_id').notNull(),
  createdBy: uuid('created_by').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mapItems = pgTable('map_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  itemId: uuid('item_id').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  displayName: varchar('display_name', { length: 255 }),
  formatMask: varchar('format_mask', { length: 255 }),
  aggFunction: varchar('agg_function', { length: 64 }),
  sortDirection: sortDirectionEnum('sort_direction'),
  sortOrder: integer('sort_order'),
  columnWidth: integer('column_width'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// migration_log — created and owned by the migrator (not in the backend schema)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inferred insert types
// ---------------------------------------------------------------------------

export type NewUserRow = typeof users.$inferInsert;
export type NewBusinessAreaRow = typeof businessAreas.$inferInsert;
export type NewGrantRow = typeof userBusinessAreaGrants.$inferInsert;
export type NewFolderRow = typeof folders.$inferInsert;
export type NewItemRow = typeof items.$inferInsert;
export type NewJoinRow = typeof joins.$inferInsert;
export type NewHierarchyRow = typeof hierarchies.$inferInsert;
export type NewHierarchyLevelRow = typeof hierarchyLevels.$inferInsert;
export type NewCustomFunctionRow = typeof customFunctions.$inferInsert;
export type NewMapRow = typeof maps.$inferInsert;
export type NewMapItemRow = typeof mapItems.$inferInsert;
export type NewMigrationLogRow = typeof migrationLog.$inferInsert;

/** The set of target tables the migrator writes to, in dependency order. */
export const TARGET_TABLES = {
  users,
  business_areas: businessAreas,
  folders,
  items,
  joins,
  hierarchies,
  hierarchy_levels: hierarchyLevels,
  custom_functions: customFunctions,
  maps,
  map_items: mapItems,
  user_business_area_grants: userBusinessAreaGrants,
} as const;

export type TargetTable = keyof typeof TARGET_TABLES;
