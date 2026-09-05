/**
 * The single Drizzle definition of every table shared by the migrator and the
 * backend — all 21 of them.
 *
 * This file is the one place those tables are declared.
 * `backend/src/db/schema.ts` re-exports it and adds the 10 runtime-only
 * tables (map shares, query execution log, export jobs, schedules, scheduled
 * results, security policies and the audit log). Drift between the two
 * workspaces is therefore not possible: there is nothing to drift from.
 *
 * Neither this file nor the backend's is the DDL. `backend/drizzle/*.sql` is.
 * Both are typed views over one physical schema.
 *
 * Dependency direction: `@discoverer-neo/core` must never import from
 * `backend/`. An ESLint `no-restricted-imports` rule enforces it.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * The domain of every `agg_function` column: the five functions Neo's SQL
 * generator accepts (`backend/src/lib/sql/formula-parser.ts`), or NULL for
 * "no aggregation".
 *
 * A CHECK rather than a `pgEnum` because the column already exists as
 * `varchar(64)` on three tables with live data, and because the set is Neo's
 * own capability, not Discoverer's — Oracle's `EDCBAggregateType` has sixteen
 * members and its `/aggregate` grammar six. A value outside this set is not a
 * label Neo displays; it is one `select-clause.ts` throws on, and one the
 * fan-trap guard would read as a measure it cannot re-aggregate. Free text
 * feeding a correctness guard is the hazard this closes.
 */
const AGG_FUNCTION_CHECK = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} IS NULL OR ${column} IN ('SUM', 'COUNT', 'AVG', 'MIN', 'MAX')`);

export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'MANAGER',
  'USER',
  'VIEWER',
]);

export const connectionTypeEnum = pgEnum('connection_type', [
  'oracle',
  'postgres',
]);

export const folderTypeEnum = pgEnum('folder_type', [
  'TABLE',
  'VIEW',
  'DERIVED',
  'COMPLEX',
  'JOIN',
  'SUMMARY',
]);

/**
 * Item types. `CO` and `CI` are the two values Oracle's EUL actually stores in
 * `EXPRESSIONS.EXP_TYPE` — see migrate/EUL_SCHEMA_GROUND_TRUTH.md §3.2.
 *
 * The comments here were previously inverted (`CO` labelled "calculated",
 * `CI` labelled "custom"), which is backwards and matched the inverted UI
 * labels. Getting this wrong means reading calculations as columns.
 */
export const itemTypeEnum = pgEnum('item_type', [
  'CO', // database item — bound to a real column (EUL: IT_EXT_COLUMN)
  'CI', // created item — a calculation, date-hierarchy or complex-folder item
  // The values below are Neo-only: no confirmed EXP_TYPE produces them, but
  // they are meaningful in Neo's own model and are kept for items authored here.
  'CU', // calculated item authored in Neo
  'JI', // join item
  'HI', // hierarchy item
  'AG', // aggregate item
  'FU', // function item
]);

export const permissionLevelEnum = pgEnum('permission_level', [
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'SCHEDULE',
  'VIEW',
]);

// `join_type` was a pgEnum column on `joins` until Phase 3.2. It is now
// DERIVED from `allow_master_no_detail` / `allow_detail_no_master` (D-032),
// so neither the column nor the Postgres type exists any more. The derivation
// and its `INNER | LEFT | RIGHT` range live in
// `backend/src/lib/sql/join-type.ts`; there is deliberately no `FULL`, because
// the combination that would produce it is a refusal (D-038).

export const functionTypeEnum = pgEnum('function_type', [
  'SQL',
  'PLSQL',
  'PACKAGE',
]);

/**
 * How a map is drawn.
 *
 * This **is** the home for Discoverer's `EDCBViewType` (see
 * migrate/EUL_SCHEMA_GROUND_TRUTH.md §7.8.5). A worksheet's `0x01f8` names one
 * of exactly two classes — `0x0384` table, `0x0385` crosstab — and those are
 * the first two values here. `PAGE_DETAIL` and `CHART` are Neo-only and no
 * migration ever writes them: Discoverer does not model either as a view type.
 * A page item is an *axis* (`map_items.axis_type = 'PAGE'`), and a chart is a
 * graph block hanging off the layout (`map_layouts.graph`), not an alternative
 * to being a table.
 *
 * There is deliberately no second `view_type` column on `map_layouts`. Two
 * columns answering "is this a crosstab?" is one more than can be kept true.
 */
export const mapTypeEnum = pgEnum('map_type', [
  'TABLE',
  'CROSSTAB',
  'PAGE_DETAIL',
  'CHART',
]);

export const sortDirectionEnum = pgEnum('sort_direction', ['ASC', 'DESC']);

/**
 * Which axis an item sits on — Discoverer's `EDCBAxisType`, carried on the
 * column element as `0x02be` (§7.8.8): `0` axis, `1` measure, `2` page.
 *
 * Kept at Oracle's own three values rather than being widened, because those
 * are the three the source can actually be read for. The row/column split a
 * crosstab needs is a separate, orthogonal fact — see `mapAxisEdgeEnum`.
 */
export const mapAxisTypeEnum = pgEnum('map_axis_type', [
  'AXIS',
  'MEASURE',
  'PAGE',
]);

/**
 * Which edge of a crosstab an `AXIS` item sits on.
 *
 * Discoverer has no field for this: `EDCBAxisType` says axis/measure/page and
 * stops. The layout's second column list (`0x025f`, 27 instances corpus-wide)
 * is the suspected home and §7.8.4 marks it **[UNCONFIRMED]**, so the
 * migration leaves this null and Neo sets it when a user builds a crosstab.
 * Null on every table map, which is every map the corpus produces.
 */
export const mapAxisEdgeEnum = pgEnum('map_axis_edge', ['ROW', 'COLUMN']);

/** Horizontal alignment of a column's data cells. */
export const mapAlignmentEnum = pgEnum('map_alignment', [
  'LEFT',
  'CENTER',
  'RIGHT',
]);

/**
 * What a `map_totals` row is.
 *
 * One table with a discriminator, not two. A total and a percentage are the
 * same shape — an aggregate over one column, optionally broken at each change
 * in another, with a label template and a placement — and Discoverer presents
 * them as sibling tabs of the same worksheet properties dialog. Two tables
 * would duplicate six columns and force every reader to union them.
 */
export const mapTotalKindEnum = pgEnum('map_total_kind', [
  'TOTAL',
  'PERCENTAGE',
]);

/**
 * Where a total sits — Discoverer's `EDCBAggregateLocation` (`0x0c20`).
 *
 * §7.8.7 establishes `1` = "at each change in the break column" (it is
 * non-zero on exactly the totals that carry one) and observes two further
 * codes, `3` and `6`, both grand totals with no break column and nothing in
 * the corpus separating them. Both land on `GRAND_TOTAL`; the raw code is kept
 * in `map_totals.source_attrs` so the distinction is recoverable if it is ever
 * decoded, rather than being guessed at now.
 */
export const mapTotalPlacementEnum = pgEnum('map_total_placement', [
  'GRAND_TOTAL',
  'AT_CHANGE',
]);

/** What a conditional-format rule paints when it matches. */
export const mapFormatTargetEnum = pgEnum('map_format_target', ['CELL', 'ROW']);

/** Page orientation for printing and PDF export. */
export const mapOrientationEnum = pgEnum('map_orientation', [
  'PORTRAIT',
  'LANDSCAPE',
]);

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

export const conditionTypeEnum = pgEnum('condition_type', [
  'PARAMETER',
  'STATIC',
]);

export const logicOperatorEnum = pgEnum('logic_operator', ['AND', 'OR']);

export const localeEnum = pgEnum('locale', ['en', 'pt-PT', 'fr-FR', 'es-ES']);

export const themeEnum = pgEnum('theme', ['light', 'dark', 'high-contrast']);

/**
 * The color scheme layered on top of `theme`'s light/dark/high-contrast
 * appearance mode — an independent axis. 'navy' recolors the primary/accent/
 * chart/sidebar tokens (see frontend/src/styles/palettes/navy.css) without
 * changing which of light/dark/high-contrast is active. 'high-contrast'
 * theme ignores this column entirely (its CSS only keys off [data-theme],
 * never [data-palette]) — that AAA-contrast guarantee must not depend on
 * which palette a user last picked.
 */
export const colorPaletteEnum = pgEnum('color_palette', ['default', 'navy']);

// ---------------------------------------------------------------------------
// 1. users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: varchar('email', { length: 255 }).notNull().unique(),
    /**
     * True when this principal is a database ROLE rather than a person.
     *
     * Discoverer grants privileges to Oracle roles as readily as to users
     * (`EUL_USERS.EU_ROLE_FLAG`), and a migration that flattens a role into a
     * login is both a security surprise and a lie about who can sign in.
     * A role holds grants and can never authenticate.
     */
    isRole: boolean('is_role').notNull().default(false),
    /**
     * Forces a password change before the account can do anything else.
     *
     * Set for every account provisioned with a temporary password (EUL
     * migration). Enforced in the `authenticate` decorator, not just the UI —
     * a temporary password that only the front end insists on rotating is not
     * a control, since the API is reachable directly.
     */
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('USER'),
    locale: localeEnum('locale').notNull().default('en'),
    theme: themeEnum('theme').notNull().default('light'),
    colorPalette: colorPaletteEnum('color_palette').notNull().default('navy'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

// ---------------------------------------------------------------------------
// 2. data_sources
// ---------------------------------------------------------------------------

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    connectionType: connectionTypeEnum('connection_type').notNull(),
    host: varchar('host', { length: 255 }),
    port: integer('port'),
    serviceName: varchar('service_name', { length: 255 }),
    sid: varchar('sid', { length: 64 }),
    username: varchar('username', { length: 255 }),
    passwordEnc: text('password_enc'),
    connectionString: text('connection_string'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('data_sources_name_idx').on(t.name)],
);

// ---------------------------------------------------------------------------
// 3. business_areas
// ---------------------------------------------------------------------------

export const businessAreas = pgTable(
  'business_areas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('business_areas_name_idx').on(t.name),
    index('business_areas_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 4. user_business_area_grants
// ---------------------------------------------------------------------------

export const userBusinessAreaGrants = pgTable(
  'user_business_area_grants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    permissionLevel: permissionLevelEnum('permission_level').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('user_ba_grants_user_ba_perm_idx').on(
      t.userId,
      t.businessAreaId,
      t.permissionLevel,
    ),
    index('user_ba_grants_ba_idx').on(t.businessAreaId),
  ],
);

// ---------------------------------------------------------------------------
// 5. folders
// ---------------------------------------------------------------------------

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    folderType: folderTypeEnum('folder_type').notNull(),
    tableName: varchar('table_name', { length: 255 }),
    tableOwner: varchar('table_owner', { length: 255 }),
    customSql: text('custom_sql'),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'set null',
    }),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('folders_ba_idx').on(t.businessAreaId),
    index('folders_data_source_idx').on(t.dataSourceId),
    index('folders_created_by_idx').on(t.createdBy),
  ],
);

/**
 * Additional business areas a folder appears in.
 *
 * Discoverer models folder↔business-area as many-to-many (`BA_OBJ_LINKS`), and
 * sharing one folder — a Time or Organisation dimension, typically — across
 * several business areas is ordinary practice. Neo keeps `folders.business_area_id`
 * as the OWNING business area (so every existing query, grant check and cache
 * key keeps working unchanged) and records the extra memberships here.
 *
 * Read "which folders are in this business area" as the union of the two.
 * `folderBusinessAreas` never contains the owning row — see `shareFolder()` in
 * folder.service.ts, which rejects that as a duplicate.
 */
export const folderBusinessAreas = pgTable(
  'folder_business_areas',
  {
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.folderId, t.businessAreaId] }),
    index('folder_business_areas_ba_idx').on(t.businessAreaId),
  ],
);

// ---------------------------------------------------------------------------
// 6. items
// ---------------------------------------------------------------------------

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
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
    // Self-referential parent item; FK added at migration time because drizzle
    // cannot declare an inline `.references()` on its own table.
    parentItemId: uuid('parent_item_id'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('items_folder_idx').on(t.folderId),
    index('items_parent_idx').on(t.parentItemId),
    index('items_created_by_idx').on(t.createdBy),
    AGG_FUNCTION_CHECK('items_agg_function_check', t.aggFunction),
  ],
);

// ---------------------------------------------------------------------------
// 7. joins
// ---------------------------------------------------------------------------

/**
 * A join binds two FOLDERS and carries a predicate of one or more column
 * pairs. `left` is the MASTER side, `right` the DETAIL side.
 *
 * **Orientation (D-040, measured on the live EUL4 2026-09-03).**
 * `KEY_CONS.FK_OBJ_ID_REMOTE` is the master and reaches `left_folder_id`;
 * `KEY_CONS.KEY_OBJ_ID` is the detail and reaches `right_folder_id`. Getting
 * this backwards does not error — it pushes the wrong side into the fan-trap
 * inline view and returns correct-looking wrong numbers.
 *
 * **`join_type` is derived, never stored (D-032).** Discoverer's Join Wizard
 * offers four settings and the EUL DTD carries four attributes; three of them
 * are the columns below, and the emitted SQL falls out of two of those:
 *
 * | `allow_master_no_detail` | `allow_detail_no_master` | emitted |
 * | --- | --- | --- |
 * | false | false | `INNER JOIN` |
 * | true  | false | `LEFT JOIN` from master (detail side `(+)`) |
 * | false | true  | `RIGHT JOIN` from master — "rare in real business scenarios" |
 * | true  | true  | **refusal** (D-038) |
 *
 * The old `join_type` enum column was fed from `KEY_CONS.KEY_TYPE`, whose live
 * domain is `FK`/`UK` — a *constraint kind*, not a join type. Every one of the
 * estate's ten joins therefore read `INNER` by accident.
 *
 * `one_to_one` has **no** effect on emitted SQL: Oracle states fan-trap
 * detection is its only consumer. `mandatory` has no join-type effect either
 * — it is a referential-integrity assertion that unlocks join trimming and
 * summary-folder eligibility. Both are stored and both stay out of the
 * derivation.
 */
export const joins = pgTable(
  'joins',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    /** MASTER folder — `KEY_CONS.FK_OBJ_ID_REMOTE`. */
    leftFolderId: uuid('left_folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    /** DETAIL folder — `KEY_CONS.KEY_OBJ_ID`. */
    rightFolderId: uuid('right_folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    /** `FK_ONE_TO_ONE`. Default false = one-to-many = assume fanning (D-033). */
    oneToOne: boolean('one_to_one').notNull().default(false),
    /** `FK_MSTR_NO_DETAIL` — Administrator's "Outer join on detail". */
    allowMasterNoDetail: boolean('allow_master_no_detail')
      .notNull()
      .default(false),
    /** `FK_DTL_NO_MASTER` — Administrator's "Outer join on master". */
    allowDetailNoMaster: boolean('allow_detail_no_master')
      .notNull()
      .default(false),
    /** `FK_MANDATORY`. Referential integrity, not a join type. */
    mandatory: boolean('mandatory').notNull().default(false),
    /**
     * The source `EXPRESSIONS.EXP_FORMULA1` token tree, verbatim (D-055).
     *
     * Provenance and escape hatch: a predicate that is not an `AND` of
     * comparisons writes no `join_predicates` rows at all — the join then
     * refuses loudly (D-039) — but the tree that could not be decomposed is
     * still here to diagnose, and to re-decompose later without re-migrating.
     */
    predicateFormula: text('predicate_formula'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('joins_left_folder_idx').on(t.leftFolderId),
    index('joins_right_folder_idx').on(t.rightFolderId),
  ],
);

// ---------------------------------------------------------------------------
// 7b. join_predicates
// ---------------------------------------------------------------------------

/**
 * The domain of `join_predicates.operator` — the six comparison operators
 * Discoverer's Join Wizard offers (`9.0.4/B10270_01.pdf` p. 24-91, verbatim).
 *
 * A CHECK, and a closed one, because this value is spliced straight into
 * generated SQL. It is never interpolated from source data at generation
 * time: the reader maps an `EUL4_FUNCTIONS.FUN_ID` onto one of these six and
 * refuses anything else, and the database refuses it a second time.
 */
const JOIN_OPERATOR_CHECK = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} IN ('=', '<', '>', '<=', '>=', '<>')`);

/**
 * One column pair of a join's predicate. Components are ANDed, in `seq` order.
 *
 * Multi-item joins are first-class in Discoverer — the Join Wizard has an
 * explicit **Add** button for them, and this estate's ten joins run five
 * single-column, four three-column and one four-column. The EUL stores all of
 * them in ONE `EXPRESSIONS` row whose `EXP_FORMULA1` is an n-ary `AND` token
 * tree, so the migrator parses that tree to fill this table; it cannot read
 * components off separate rows.
 *
 * Item ids are nullable on purpose. A component whose item failed to migrate
 * must still occupy a row: dropping it would silently shorten the `ON` clause
 * from `a = b AND c = d` to `a = b`, which returns *more* rows than the source
 * did — a wrong number that looks right. A null endpoint is a refusal at
 * generation time instead (D-058).
 */
export const joinPredicates = pgTable(
  'join_predicates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    joinId: uuid('join_id')
      .notNull()
      .references(() => joins.id, { onDelete: 'cascade' }),
    /** 0-based position within the ANDed predicate. */
    seq: integer('seq').notNull(),
    /** MASTER-side item — belongs to `joins.left_folder_id`. */
    leftItemId: uuid('left_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    /** DETAIL-side item — belongs to `joins.right_folder_id`. */
    rightItemId: uuid('right_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    operator: varchar('operator', { length: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('join_predicates_join_idx').on(t.joinId),
    index('join_predicates_left_item_idx').on(t.leftItemId),
    index('join_predicates_right_item_idx').on(t.rightItemId),
    uniqueIndex('join_predicates_join_seq_uq').on(t.joinId, t.seq),
    JOIN_OPERATOR_CHECK('join_predicates_operator_check', t.operator),
  ],
);

// ---------------------------------------------------------------------------
// 8. hierarchies
// ---------------------------------------------------------------------------

export const hierarchies = pgTable(
  'hierarchies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('hierarchies_ba_idx').on(t.businessAreaId)],
);

// ---------------------------------------------------------------------------
// 9. hierarchy_levels
// ---------------------------------------------------------------------------

export const hierarchyLevels = pgTable(
  'hierarchy_levels',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    hierarchyId: uuid('hierarchy_id')
      .notNull()
      .references(() => hierarchies.id, { onDelete: 'cascade' }),
    levelName: varchar('level_name', { length: 255 }).notNull(),
    /**
     * Nullable: the EUL's hierarchy nodes (`HI_NODES`) do not always resolve
     * to an item, and dropping such a level would silently shorten a user's
     * drill path. A level with no item is carried and flagged instead.
     */
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    /**
     * Depth in the drill path, root = 1. Derived by walking `HI_SEGMENTS`;
     * Discoverer stores the structure as a parent/child edge list, not as a
     * numbered list — see `parentLevelId`.
     */
    levelNumber: integer('level_number').notNull(),
    /**
     * Parent node in the drill path; null at the root. Preserves the EUL's
     * actual tree shape, so a hierarchy that branches into alternate drill
     * paths survives the round trip instead of being flattened.
     */
    parentLevelId: uuid('parent_level_id').references(
      (): AnyPgColumn => hierarchyLevels.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // NOT unique: a hierarchy is a tree, so two siblings legitimately share a
    // depth. The previous unique(hierarchy_id, level_number) silently forbade
    // any hierarchy that branches into alternate drill paths.
    index('hierarchy_levels_hierarchy_number_idx').on(t.hierarchyId, t.levelNumber),
    index('hierarchy_levels_item_idx').on(t.itemId),
    index('hierarchy_levels_parent_idx').on(t.parentLevelId),
  ],
);

// ---------------------------------------------------------------------------
// 10. custom_functions
// ---------------------------------------------------------------------------

export const customFunctions = pgTable('custom_functions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  functionType: functionTypeEnum('function_type').notNull(),
  parameters: jsonb('parameters'),
  returnType: varchar('return_type', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// 11. maps
// ---------------------------------------------------------------------------

export const maps = pgTable(
  'maps',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    mapType: mapTypeEnum('map_type').notNull(),
    /**
     * ADVISORY ONLY — UI grouping. Nullable since D-013.
     *
     * A map's query scope is derived from the folders its items and conditions
     * live in, plus everything reachable from them through joins
     * (`loadMapDefinition`), never from this column. Discoverer models
     * folder-to-business-area as many-to-many (`BA_OBJ_LINKS`), so a worksheet
     * was never confined to one business area, and `NOT NULL` here was the
     * root cause of the estate-wide execution failure.
     *
     * Nothing that decides what a user may read may read this column: the
     * entitlement gate and row-level security both resolve against the derived
     * folder set (see `effectiveFolderSet`).
     */
    businessAreaId: uuid('business_area_id').references(
      () => businessAreas.id,
      { onDelete: 'cascade' },
    ),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPublic: boolean('is_public').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    /**
     * `SELECT DISTINCT` — Discoverer's query-request `Distinct` (`0x0128`,
     * §7.8.3), confirmed against all 896 dumped query requests.
     *
     * It lives on `maps` rather than on `map_layouts` because it changes the
     * SQL the query engine generates, not how the result is drawn, and the
     * generator already has the map row in hand. `false` is what every map
     * built before this column existed did, so the default is behaviour-neutral.
     */
    selectDistinct: boolean('select_distinct').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('maps_ba_idx').on(t.businessAreaId),
    index('maps_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 12. map_items
// ---------------------------------------------------------------------------

/**
 * A map's columns — Neo's counterpart to Discoverer's column element
 * (`0x02bc`, §7.8.8), one row per item the map uses.
 *
 * **Axis and placement live here, not in a layout table.** Discoverer carries
 * `EDCBAxisType` on the column itself, and this table already *is* the column:
 * it holds display order, heading override, format mask and width. A separate
 * layout-items table would be an empty indirection over a 1:1 relationship,
 * and would fork the query engine's column list into two places to read.
 *
 * The one thing Discoverer's column can do that this table cannot is show a
 * *workbook calculation* instead of an EUL item — `item_id` is NOT NULL, so a
 * calculation column becomes a `map_calculated_fields` row instead. That
 * mismatch predates this table's layout columns and is left alone here;
 * `map_calculated_fields` carries the same presentation fields for that reason.
 */
export const mapItems = pgTable(
  'map_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    displayName: varchar('display_name', { length: 255 }),
    formatMask: varchar('format_mask', { length: 255 }),
    /**
     * The aggregate this column is run with — the EUL item's Default aggregate
     * (`EXPRESSIONS.IT_FUN_ID`), written only where the workbook's query
     * request puts the item on the measure vector (`0x0124`). `select-clause.ts`
     * falls back to `items.agg_function` when this is null, so the column is an
     * override, not the only home for the value; the migration fills it so the
     * fan-trap guard can read one map's measure set without re-deriving it.
     *
     * Null on every axis column, and on any measure whose item resolves to
     * `Detail` (8 152 of the estate's items) or carries no default at all
     * (353). It is never defaulted to `SUM`: a guessed aggregate is a wrong
     * number that looks right.
     */
    aggFunction: varchar('agg_function', { length: 64 }),
    sortDirection: sortDirectionEnum('sort_direction'),
    sortOrder: integer('sort_order'),
    columnWidth: integer('column_width'),
    /**
     * Which axis this column sits on (`0x02be`). Null when the map does not
     * say, as on every map that predates this column — which the query engine
     * goes on treating exactly as it did before.
     */
    axisType: mapAxisTypeEnum('axis_type'),
    /** Crosstab edge for an `AXIS` column; see `mapAxisEdgeEnum`. */
    axisEdge: mapAxisEdgeEnum('axis_edge'),
    /**
     * Position within the query's axis or measure list (§7.8.3), which is not
     * the same ordering as `display_order`: the layout's column order and the
     * query request's item order are independent lists in Discoverer.
     */
    axisOrder: integer('axis_order'),
    /**
     * The map queries this item but shows no column for it — Discoverer's
     * hidden item. 1 176 of the corpus's 34 683 query items are in this state
     * (§7.8.4): an item a calculation or a filter needs, that the sheet does
     * not draw. Such a row has no meaningful `display_order` or format.
     */
    isHidden: boolean('is_hidden').notNull().default(false),
    /** `TEXT` | `NUMBER` | `DATE` — the format block's `0x0642` (§7.8.8). */
    dataType: varchar('data_type', { length: 64 }),
    /** Format mask applied to the heading, when it carries one of its own. */
    headingFormatMask: varchar('heading_format_mask', { length: 255 }),
    /**
     * Data-cell alignment. Discoverer's `0x0643` is **[UNCONFIRMED]** (six
     * observed codes and an independent bit), so the migration leaves this
     * null and keeps the raw code in `source_attrs` rather than guessing.
     */
    alignment: mapAlignmentEnum('alignment'),
    /** Wrap long values in the cell (`0x0645`, **[UNCONFIRMED]**). */
    wordWrap: boolean('word_wrap'),
    /**
     * Discoverer's `DCBImportedItemSort::GetRank`. `d4wkdmp` does not print it
     * (§7.8.14) and nothing in the corpus separates it from the other two
     * unconfirmed sort flags, so it is a column with no migration behind it
     * yet — `sort_order` remains the position in the ORDER BY.
     */
    sortRank: integer('sort_rank'),
    /**
     * Group/break sort — `IsABreak`. The sort suppresses repeated values and
     * creates the boundary a subtotal breaks on (`map_totals.break_map_item_id`).
     * Layout-side, this is a sort entry carrying a group block
     * (`0x0518` → `0x05dc`), true on 2 029 of 3 865 sorts.
     *
     * Sorting stays on this table rather than in a `map_sorts` table: a
     * Discoverer sort is 1:1 with a column, `sort_direction`/`sort_order` are
     * already here and already drive `lib/sql/order-by-clause.ts`, and a second
     * table would give ORDER BY two sources of truth.
     */
    sortGroup: boolean('sort_group').notNull().default(false),
    /** The column element's own id inside the `.DIS` body, for round-tripping. */
    sourceElementId: integer('source_element_id'),
    /**
     * Source detail with no typed column of its own: the raw `[UNCONFIRMED]`
     * codes of §7.8.8 (`alignmentCode`, `wordWrapFlag`, the sort's `0x0519` /
     * `0x051a`) and the style chain's font and colour values. Deliberately
     * untyped — inventing a column per undecoded flag would be false precision.
     */
    sourceAttrs: jsonb('source_attrs'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_items_map_idx').on(t.mapId),
    index('map_items_item_idx').on(t.itemId),
    AGG_FUNCTION_CHECK('map_items_agg_function_check', t.aggFunction),
  ],
);

// ---------------------------------------------------------------------------
// 13. map_conditions
// ---------------------------------------------------------------------------

export const mapConditions = pgTable(
  'map_conditions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    operator: operatorEnum('operator').notNull(),
    value: text('value'),
    /**
     * For a PARAMETER condition, the `bind_name` of the map parameter that
     * supplies its value — NOT the parameter's display name. The display name
     * is whatever Discoverer's author typed (`Dt Fim Vigência >=`) and cannot
     * be a bind variable; see `map_parameters.bindName`.
     */
    paramName: varchar('param_name', { length: 255 }),
    conditionType: conditionTypeEnum('condition_type').notNull(),
    groupId: uuid('group_id'),
    logicOperator: logicOperatorEnum('logic_operator').notNull().default('AND'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_conditions_map_idx').on(t.mapId),
    index('map_conditions_item_idx').on(t.itemId),
  ],
);

// ---------------------------------------------------------------------------
// 14. map_parameters
// ---------------------------------------------------------------------------

export const mapParameters = pgTable(
  'map_parameters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    /** The prompt the user sees. Free text — spaces, accents, operators. */
    name: varchar('name', { length: 255 }).notNull(),
    /**
     * The name this parameter binds as in generated SQL.
     *
     * Derived from `name` by `makeBindName` and unique within the map. It
     * exists because `name` is a human label and a bind variable is an Oracle
     * identifier, and a migrated EUL is full of labels that are not:
     * `Apólice nº`, `DATA FIM`, `Dt Fim Vigência >=`. `map_conditions.param_name`
     * stores this value, not `name`.
     */
    bindName: varchar('bind_name', { length: 30 }).notNull(),
    paramType: varchar('param_type', { length: 32 }).notNull(), // STRING | NUMBER | DATE | LIST
    defaultValue: text('default_value'),
    isRequired: boolean('is_required').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_parameters_map_idx').on(t.mapId),
    // Two prompts binding the same name would silently become one filter.
    uniqueIndex('map_parameters_map_bind_idx').on(t.mapId, t.bindName),
  ],
);

// ---------------------------------------------------------------------------
// 15. map_calculated_fields
// ---------------------------------------------------------------------------

/**
 * A map's calculations — Discoverer's `0x00dc` `EUL Private Item` (§7.8.13).
 *
 * The presentation columns below are not a copy of `map_items`': the
 * calculation element carries them itself, field for field, and every one is
 * confirmed against `d4wkdmp -f` on all 41 982 corpus calculations. A
 * calculation is also the one thing that can occupy a column slot without
 * being an EUL item, so it needs an axis and a format of its own.
 */
export const mapCalculatedFields = pgTable(
  'map_calculated_fields',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    formula: text('formula').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    /** `Desc` (`0x00df`) — the description the author typed. */
    description: text('description'),
    /** `DataType` (`0x00e3`): `TEXT` | `NUMBER` | `DATE`. */
    dataType: varchar('data_type', { length: 64 }),
    /**
     * `Placement` (`0x00e2`) named: `1` measure → `MEASURE`, `2` axis → `AXIS`.
     * `0` means "not placed on this sheet", which is `is_hidden`, not an axis.
     */
    axisType: mapAxisTypeEnum('axis_type'),
    /** Format mask stored on the calculation itself (`0x00e8`). */
    formatMask: varchar('format_mask', { length: 255 }),
    /**
     * `Hidden` (`0x00e6`) — set on 38 436 of the corpus's 47 548 calculations,
     * near-exactly the complement of `Placement = 0`: a workbook writes a
     * calculation into every worksheet section that offers it, and most of
     * those are not on that sheet's layout.
     */
    isHidden: boolean('is_hidden').notNull().default(false),
    /** `Identifier` (`0x0fa0`) — a small integer, unique within the workbook. */
    sourceIdentifier: varchar('source_identifier', { length: 64 }),
    /** The calculation element's own id inside the `.DIS` body. */
    sourceElementId: integer('source_element_id'),
    /**
     * Source detail with no typed column — e.g. `IsACalc`, whose meaning
     * §7.8.13 decodes value for value but deliberately leaves unnamed.
     */
    sourceAttrs: jsonb('source_attrs'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('map_calculated_fields_map_idx').on(t.mapId)],
);

// ---------------------------------------------------------------------------
// 15.1 map_layouts
//
// Everything the worksheet (`0x01f4`) and its layout element (`0x0258`) carry
// that neither `maps` nor `map_items` has a column for. One row per map, or
// none: a map built in Neo that never came from a worksheet has no layout row,
// and reads that do not ask for one behave exactly as they did before.
//
// It carries no `view_type`: that is `maps.map_type`, see `mapTypeEnum`.
// ---------------------------------------------------------------------------

export const mapLayouts = pgTable(
  'map_layouts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    /** 0-based position of the source worksheet within its workbook. */
    worksheetIndex: integer('worksheet_index'),
    /** The stable GUID Discoverer assigned the worksheet. */
    worksheetGuid: varchar('worksheet_guid', { length: 64 }),
    /** The multi-line title Discoverer prints above the data, as plain text. */
    title: text('title'),
    /** The same title as RTF (`0x0201`) and as an HTML fragment (`0x0205`). */
    titleRtf: text('title_rtf'),
    titleHtml: text('title_html'),
    /**
     * How many query requests the source worksheet linked (`0x026b`).
     *
     * **Neo does not model Discoverer's Query Request.** Its job is to group
     * the items, sorts, filters and joins one query uses, and Neo already has
     * exactly one query per map: 923 worksheets in the corpus link 923 query
     * requests, one each, and the only workbook with two (Oracle's own
     * `VIDSTR4.DIS`) has one per sheet. The indirection is representable in
     * the format — `0x026b` is a vector — but it has never been observed
     * carrying more than one, so a `map_queries` table would add a join to
     * every read path to model a 1:1. This column is the hedge: a worksheet
     * that ever linked two queries is visible here instead of being silently
     * merged.
     */
    queryCount: integer('query_count'),
    /**
     * Chart configuration — the graph block's `name`/`value` pairs
     * (`0x0272` → `0x026f`, §7.8.13), e.g. `graphLayout` =
     * `graphPosition="rightofdata" widthPixels="335"`. A bag of strings in the
     * source, so a bag of strings here. The block is empty on all 917 corpus
     * worksheets that have one; Oracle's `VIDAF4.DIS` is what shows its shape.
     */
    graph: jsonb('graph'),
    /** The layout element's own id inside the `.DIS` body. */
    sourceElementId: integer('source_element_id'),
    /** Layout fields §7.8.4 leaves unconfirmed (`0x025a`–`0x025c`, `0x0269`). */
    sourceAttrs: jsonb('source_attrs'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('map_layouts_map_idx').on(t.mapId)],
);

// ---------------------------------------------------------------------------
// 15.2 map_totals
//
// Totals and percentages — Discoverer's `DCBImportedSummary` (`0x0c1c`,
// §7.8.7), 19 639 of them across the corpus. One table, discriminated by
// `kind`; see `mapTotalKindEnum` for why not two.
// ---------------------------------------------------------------------------

export const mapTotals = pgTable(
  'map_totals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    kind: mapTotalKindEnum('kind').notNull().default('TOTAL'),
    /**
     * The column being totalled (`0x0c22`). At most one of this and
     * `map_calculated_field_id` is set — Discoverer's `0x0c22` points at a
     * column element, which shows either an EUL item or a calculation.
     */
    mapItemId: uuid('map_item_id').references(() => mapItems.id, {
      onDelete: 'cascade',
    }),
    mapCalculatedFieldId: uuid('map_calculated_field_id').references(
      () => mapCalculatedFields.id,
      { onDelete: 'cascade' },
    ),
    /**
     * The column whose change breaks a subtotal (`0x0c23`) — non-zero on
     * exactly the 9 357 totals whose placement is `AT_CHANGE`, and null on
     * every grand total.
     */
    breakMapItemId: uuid('break_map_item_id').references(() => mapItems.id, {
      onDelete: 'cascade',
    }),
    /**
     * `SUM` | `COUNT` | `AVG` | `MIN` | `MAX` — the same vocabulary as
     * `items.agg_function`, and the set `lib/sql/formula-parser.ts` accepts.
     *
     * Discoverer's `EDCBAggregateType` (`0x0c1d`) has sixteen members and
     * seven observed codes, of which §7.12 establishes four against the live
     * source: `1` SUM, `2` AVG, `3` COUNT, `4` COUNT DISTINCT. The first three
     * are written here — 19 335 of 19 639 totals. `COUNT DISTINCT` is **not**:
     * this column feeds `select-clause.ts`, which would emit `COUNT(x)` and
     * silently count duplicates. Those 282 rows, and the 22 whose code is
     * undecoded, stay null with the raw code and the Discoverer-level name in
     * `source_attrs`.
     *
     * Teaching `AGGREGATE_FUNCTIONS` a `COUNT DISTINCT` that emits
     * `COUNT(DISTINCT x)` would let the migration fill those 282.
     */
    aggFunction: varchar('agg_function', { length: 64 }),
    /** Where the total sits (`0x0c20`); see `mapTotalPlacementEnum`. */
    placement: mapTotalPlacementEnum('placement'),
    /**
     * Label template (`0x0c21`), with Discoverer's own interpolation intact:
     * `&value` / `&item` stand for the broken-on value (`Total for &value`,
     * `SubTotal por &Value`).
     */
    label: text('label'),
    displayOrder: integer('display_order').notNull().default(0),
    /** The summary element's own id inside the `.DIS` body. */
    sourceElementId: integer('source_element_id'),
    /**
     * The raw `EDCBAggregateType` and `EDCBAggregateLocation` codes plus the
     * flags §7.8.7 leaves unconfirmed (`0x0c24`–`0x0c28`). `d4wkdmp` prints
     * nothing at all about summaries, so none of it is dump-confirmed and the
     * codes are worth keeping verbatim.
     */
    sourceAttrs: jsonb('source_attrs'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_totals_map_idx').on(t.mapId),
    index('map_totals_item_idx').on(t.mapItemId),
  ],
);

// ---------------------------------------------------------------------------
// 15.3 map_page_setup
//
// Print settings — Discoverer's `DCBImportedDisplaySettings` (`0x0834`,
// §7.8.12). Its own table rather than more columns on `map_layouts`: it is
// per-*workbook* in the source (one block shared by every sheet) where a
// layout is per-worksheet, it answers "how does this print" rather than "what
// is drawn", and it is fifteen columns that are null on every map authored in
// Neo.
//
// The slot names below are Neo's model. Discoverer writes six texts, six fonts
// and six margins in tag order and `d4wkdmp` prints none of it, so *which slot
// is which is unconfirmed* (§7.8.12) — a migration must put the raw tag-order
// arrays in `source_attrs` rather than assume this order is theirs.
// ---------------------------------------------------------------------------

export const mapPageSetup = pgTable(
  'map_page_setup',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    orientation: mapOrientationEnum('orientation'),
    /** Scale percentage (`0x0837`) — `100` on every workbook in the corpus. */
    scalePercent: integer('scale_percent'),
    headerLeft: text('header_left'),
    headerCenter: text('header_center'),
    headerRight: text('header_right'),
    footerLeft: text('footer_left'),
    footerCenter: text('footer_center'),
    footerRight: text('footer_right'),
    /** Margins in inches — the unit every corpus value is in (0.5 / 0.75 / 1.0). */
    marginTop: numeric('margin_top', { precision: 6, scale: 3 }),
    marginBottom: numeric('margin_bottom', { precision: 6, scale: 3 }),
    marginLeft: numeric('margin_left', { precision: 6, scale: 3 }),
    marginRight: numeric('margin_right', { precision: 6, scale: 3 }),
    marginHeader: numeric('margin_header', { precision: 6, scale: 3 }),
    marginFooter: numeric('margin_footer', { precision: 6, scale: 3 }),
    printGridLines: boolean('print_grid_lines'),
    printHeadings: boolean('print_headings'),
    /** The display-settings element's own id inside the `.DIS` body. */
    sourceElementId: integer('source_element_id'),
    /**
     * The six texts, six fonts and six margins in raw tag order, and the
     * grid-line and heading toggles §7.8.12 assigns only by elimination.
     */
    sourceAttrs: jsonb('source_attrs'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('map_page_setup_map_idx').on(t.mapId)],
);

// ---------------------------------------------------------------------------
// 15.4 map_conditional_formats
//
// Conditional formatting — what Discoverer 4 calls an Exception: paint a cell
// or a row when a column's value satisfies a test.
//
// *Nothing migrates into this table yet, and that is deliberate.* No element
// class for exceptions has been decoded: §7.8.11 explicitly withdraws the
// guess that `0x0898` held conditional-format ranges (it holds saved parameter
// values), and the classes read but unmodelled — `0x03e8`, `0x06a4`, `0x0708`,
// `0x0ce4` — are 40 elements corpus-wide with no dump output to check against.
// So this is Neo's own model, typed the way Neo's UI will author it, and a
// migration writes no rows here until an exception class is identified.
//
// The `value` convention matches `map_conditions`: a `BETWEEN` stores
// `low,high` and an `IN` a comma-joined list, in the one column.
// ---------------------------------------------------------------------------

export const mapConditionalFormats = pgTable(
  'map_conditional_formats',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }),
    /** The column the rule tests. Null means the rule tests the row as a whole. */
    mapItemId: uuid('map_item_id').references(() => mapItems.id, {
      onDelete: 'cascade',
    }),
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_conditional_formats_map_idx').on(t.mapId),
    index('map_conditional_formats_item_idx').on(t.mapItemId),
  ],
);

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

