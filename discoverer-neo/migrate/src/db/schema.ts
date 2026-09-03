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
  numeric,
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

export const operatorEnum = pgEnum('map_operator', [
  '=',
  '<>',
  '>',
  '<',
  '>=',
  '<=',
  'LIKE',
  'IN',
  'BETWEEN',
  'IS_NULL',
]);

export const conditionTypeEnum = pgEnum('condition_type', ['PARAMETER', 'STATIC']);

export const logicOperatorEnum = pgEnum('logic_operator', ['AND', 'OR']);

/** Discoverer's `EDCBAxisType` (`0x02be`) — which axis a column sits on. */
export const mapAxisTypeEnum = pgEnum('map_axis_type', ['AXIS', 'MEASURE', 'PAGE']);

/** Which edge of a crosstab an `AXIS` column sits on. Neo-only; see the backend schema. */
export const mapAxisEdgeEnum = pgEnum('map_axis_edge', ['ROW', 'COLUMN']);

/** Data-cell alignment. */
export const mapAlignmentEnum = pgEnum('map_alignment', ['LEFT', 'CENTER', 'RIGHT']);

/** What a `map_totals` row is — a total or a percentage of one. */
export const mapTotalKindEnum = pgEnum('map_total_kind', ['TOTAL', 'PERCENTAGE']);

/** Discoverer's `EDCBAggregateLocation` (`0x0c20`), as far as §7.8.7 establishes it. */
export const mapTotalPlacementEnum = pgEnum('map_total_placement', [
  'GRAND_TOTAL',
  'AT_CHANGE',
]);

/** What a conditional-format rule paints when it matches. */
export const mapFormatTargetEnum = pgEnum('map_format_target', ['CELL', 'ROW']);

/** Page orientation for printing. */
export const mapOrientationEnum = pgEnum('map_orientation', ['PORTRAIT', 'LANDSCAPE']);

// ---------------------------------------------------------------------------
// Target tables (write subset)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  /** True for a database ROLE grantee (EUL_USERS.EU_ROLE_FLAG); cannot log in. */
  isRole: boolean('is_role').notNull().default(false),
  /** Forces a password rotation before the account can be used. */
  mustChangePassword: boolean('must_change_password').notNull().default(false),
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
  /** Nullable: an EUL hierarchy node does not always resolve to an item. */
  itemId: uuid('item_id'),
  levelNumber: integer('level_number').notNull(),
  /** Parent node in the drill path; null at the root (EUL: HI_SEGMENTS). */
  parentLevelId: uuid('parent_level_id'),
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
  /** `SELECT DISTINCT` — the query request's `Distinct` (§7.8.3). */
  selectDistinct: boolean('select_distinct').notNull().default(false),
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
  /** `EDCBAxisType` (`0x02be`) — axis / measure / page. */
  axisType: mapAxisTypeEnum('axis_type'),
  /** Crosstab edge; Discoverer has no field for it, so the migration leaves it null. */
  axisEdge: mapAxisEdgeEnum('axis_edge'),
  /** Position within the query request's axis or measure list (§7.8.3). */
  axisOrder: integer('axis_order'),
  /** The query names this item but no column displays it (§7.8.4). */
  isHidden: boolean('is_hidden').notNull().default(false),
  /** `TEXT` | `NUMBER` | `DATE` — the format block's `0x0642`. */
  dataType: varchar('data_type', { length: 64 }),
  headingFormatMask: varchar('heading_format_mask', { length: 255 }),
  /** Left null while `0x0643`'s codes are unconfirmed; the raw code goes to `sourceAttrs`. */
  alignment: mapAlignmentEnum('alignment'),
  wordWrap: boolean('word_wrap'),
  /** `DCBImportedItemSort::GetRank` — `d4wkdmp` never prints it (§7.8.14). */
  sortRank: integer('sort_rank'),
  /** Group/break sort — `IsABreak`, layout-side a sort entry with a group block. */
  sortGroup: boolean('sort_group').notNull().default(false),
  sourceElementId: integer('source_element_id'),
  /** Raw unconfirmed codes and the style chain's font/colour values. */
  sourceAttrs: jsonb('source_attrs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Worksheet conditions.
 *
 * `item_id` is NOT NULL in Neo, so a condition whose filtered item cannot be
 * resolved back to a migrated item is reported and skipped rather than
 * attached to an arbitrary item.
 */
export const mapConditions = pgTable('map_conditions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  itemId: uuid('item_id').notNull(),
  operator: operatorEnum('operator').notNull(),
  value: text('value'),
  paramName: varchar('param_name', { length: 255 }),
  conditionType: conditionTypeEnum('condition_type').notNull(),
  logicOperator: logicOperatorEnum('logic_operator').notNull().default('AND'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mapParameters = pgTable('map_parameters', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  /** The prompt the user sees — free text, spaces and accents and all. */
  name: varchar('name', { length: 255 }).notNull(),
  /** The Oracle identifier this prompt binds as; unique within the map. */
  bindName: varchar('bind_name', { length: 30 }).notNull(),
  /** STRING | NUMBER | DATE | LIST — a plain varchar in Neo, not a pg enum. */
  paramType: varchar('param_type', { length: 32 }).notNull(),
  defaultValue: text('default_value'),
  isRequired: boolean('is_required').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mapCalculatedFields = pgTable('map_calculated_fields', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  formula: text('formula').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  /** `Desc` (`0x00df`). */
  description: text('description'),
  /** `DataType` (`0x00e3`): `TEXT` | `NUMBER` | `DATE`. */
  dataType: varchar('data_type', { length: 64 }),
  /** `Placement` (`0x00e2`): 1 → `MEASURE`, 2 → `AXIS`; 0 is `isHidden`, not an axis. */
  axisType: mapAxisTypeEnum('axis_type'),
  /** Format mask carried on the calculation itself (`0x00e8`). */
  formatMask: varchar('format_mask', { length: 255 }),
  /** `Hidden` (`0x00e6`). */
  isHidden: boolean('is_hidden').notNull().default(false),
  /** `Identifier` (`0x0fa0`) — unique within the workbook. */
  sourceIdentifier: varchar('source_identifier', { length: 64 }),
  sourceElementId: integer('source_element_id'),
  sourceAttrs: jsonb('source_attrs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Worksheet presentation and provenance — the layout element (`0x0258`) and
 * the worksheet element (`0x01f4`), one row per map at most.
 *
 * No `viewType` column: the view type is `maps.mapType` (`TABLE` | `CROSSTAB`).
 */
export const mapLayouts = pgTable('map_layouts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  worksheetIndex: integer('worksheet_index'),
  worksheetGuid: varchar('worksheet_guid', { length: 64 }),
  title: text('title'),
  /** `0x0201` / `0x0205` — the printed title as RTF and as an HTML fragment. */
  titleRtf: text('title_rtf'),
  titleHtml: text('title_html'),
  /** How many query requests the source worksheet linked; 1 on every corpus sheet. */
  queryCount: integer('query_count'),
  /** The graph block's name/value pairs (`0x0272` → `0x026f`). */
  graph: jsonb('graph'),
  sourceElementId: integer('source_element_id'),
  sourceAttrs: jsonb('source_attrs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Totals and percentages — `DCBImportedSummary` (`0x0c1c`), discriminated by `kind`. */
export const mapTotals = pgTable('map_totals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  kind: mapTotalKindEnum('kind').notNull().default('TOTAL'),
  /** The column totalled (`0x0c22`) — an item column or a calculation column, not both. */
  mapItemId: uuid('map_item_id'),
  mapCalculatedFieldId: uuid('map_calculated_field_id'),
  /** The column whose change breaks a subtotal (`0x0c23`). */
  breakMapItemId: uuid('break_map_item_id'),
  /**
   * `SUM` | `COUNT` | `AVG` — the `EDCBAggregateType` codes §7.12 established
   * (`1`/`2`/`3`) that Neo's SQL generator can also emit. Code `4` is decoded
   * as `COUNT DISTINCT` and still stays null, because emitting `COUNT` for it
   * would count duplicates; `5`/`6`/`9` are undecoded. The raw code and the
   * Discoverer-level name are always in `sourceAttrs`.
   */
  aggFunction: varchar('agg_function', { length: 64 }),
  placement: mapTotalPlacementEnum('placement'),
  /** Label template (`0x0c21`) — `&value` / `&item` interpolate the broken-on value. */
  label: text('label'),
  displayOrder: integer('display_order').notNull().default(0),
  sourceElementId: integer('source_element_id'),
  sourceAttrs: jsonb('source_attrs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Print settings — `DCBImportedDisplaySettings` (`0x0834`), per workbook in the
 * source and therefore copied onto each map the workbook produces.
 *
 * The six header/footer slots and six margins are named as Neo models them;
 * §7.8.12 leaves the source's tag order unattributed, so a migration writes the
 * raw arrays to `sourceAttrs` rather than assuming this order is theirs.
 */
export const mapPageSetup = pgTable('map_page_setup', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  orientation: mapOrientationEnum('orientation'),
  scalePercent: integer('scale_percent'),
  headerLeft: text('header_left'),
  headerCenter: text('header_center'),
  headerRight: text('header_right'),
  footerLeft: text('footer_left'),
  footerCenter: text('footer_center'),
  footerRight: text('footer_right'),
  marginTop: numeric('margin_top', { precision: 6, scale: 3 }),
  marginBottom: numeric('margin_bottom', { precision: 6, scale: 3 }),
  marginLeft: numeric('margin_left', { precision: 6, scale: 3 }),
  marginRight: numeric('margin_right', { precision: 6, scale: 3 }),
  marginHeader: numeric('margin_header', { precision: 6, scale: 3 }),
  marginFooter: numeric('margin_footer', { precision: 6, scale: 3 }),
  printGridLines: boolean('print_grid_lines'),
  printHeadings: boolean('print_headings'),
  sourceElementId: integer('source_element_id'),
  sourceAttrs: jsonb('source_attrs'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Conditional formatting (Discoverer's Exceptions).
 *
 * Neo-native: no `.DIS` element class for exceptions has been decoded, so the
 * migrator writes nothing here. It is mirrored anyway so the target-table set
 * matches the backend schema and a re-import's cascade is complete.
 */
export const mapConditionalFormats = pgTable('map_conditional_formats', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  mapId: uuid('map_id').notNull(),
  name: varchar('name', { length: 255 }),
  mapItemId: uuid('map_item_id'),
  target: mapFormatTargetEnum('target').notNull().default('CELL'),
  operator: operatorEnum('operator'),
  value: text('value'),
  backgroundColor: varchar('background_color', { length: 32 }),
  textColor: varchar('text_color', { length: 32 }),
  isBold: boolean('is_bold').notNull().default(false),
  isItalic: boolean('is_italic').notNull().default(false),
  isUnderline: boolean('is_underline').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
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
export type NewMapConditionRow = typeof mapConditions.$inferInsert;
export type NewMapParameterRow = typeof mapParameters.$inferInsert;
export type NewMapCalculatedFieldRow = typeof mapCalculatedFields.$inferInsert;
export type NewMapLayoutRow = typeof mapLayouts.$inferInsert;
export type NewMapTotalRow = typeof mapTotals.$inferInsert;
export type NewMapPageSetupRow = typeof mapPageSetup.$inferInsert;
export type NewMapConditionalFormatRow = typeof mapConditionalFormats.$inferInsert;
export type NewMigrationLogRow = typeof migrationLog.$inferInsert;

/**
 * Additional business areas a folder appears in. The EUL models
 * folder↔business-area as many-to-many (BA_OBJ_LINKS); Neo keeps
 * folders.business_area_id as the owning area and records extra shares here.
 */
export const folderBusinessAreas = pgTable('folder_business_areas', {
  folderId: uuid('folder_id').notNull(),
  businessAreaId: uuid('business_area_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The set of target tables the migrator writes to, in dependency order. */
export const TARGET_TABLES = {
  users,
  business_areas: businessAreas,
  folders,
  folder_business_areas: folderBusinessAreas,
  items,
  joins,
  hierarchies,
  hierarchy_levels: hierarchyLevels,
  custom_functions: customFunctions,
  maps,
  map_items: mapItems,
  map_conditions: mapConditions,
  map_parameters: mapParameters,
  map_calculated_fields: mapCalculatedFields,
  map_layouts: mapLayouts,
  map_totals: mapTotals,
  map_page_setup: mapPageSetup,
  map_conditional_formats: mapConditionalFormats,
  user_business_area_grants: userBusinessAreaGrants,
} as const;

export type TargetTable = keyof typeof TARGET_TABLES;
