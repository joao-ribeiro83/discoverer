/**
 * Shared types and version-aware type maps for the EUL → Discoverer Neo data
 * transformers.
 *
 * A transformer is a **pure** function: it takes one normalized EUL entity
 * (from `eul-reader`) plus the source `EulVersion`, and returns a
 * `Transformed*` value — the Neo column values that can be derived from that
 * one entity, the *source* foreign-key references the migration runner still
 * has to resolve to Neo UUIDs, and any warnings the mapping produced. The
 * runner (`migration-runner.ts`) mints UUIDs and resolves the cross-entity FKs.
 *
 * Target column names / nullability / enum values come from
 * `backend/src/db/schema.ts` (mirrored in `../../db/schema.ts`).
 */

import type { EulVersion } from '../../types/eul-versions.js';

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export interface TransformWarning {
  code: string;
  message: string;
  /** Source id of the object the warning is about, when applicable. */
  sourceId?: number;
}

// ---------------------------------------------------------------------------
// Neo enum value sets (mirrors backend/src/db/schema.ts pgEnum definitions)
// ---------------------------------------------------------------------------

export type NeoFolderType = 'TABLE' | 'VIEW' | 'DERIVED' | 'COMPLEX' | 'JOIN' | 'SUMMARY';
export type NeoItemType = 'CI' | 'CU' | 'CO' | 'JI' | 'HI' | 'AG' | 'FU';
// `NeoJoinType` was here. There is no `join_type` column any more (D-032) and
// nothing in this package writes one; the derived type lives on the query side,
// in `backend/src/lib/sql/join-type.ts`.
export type NeoFunctionType = 'SQL' | 'PLSQL' | 'PACKAGE';
export type NeoMapType = 'TABLE' | 'CROSSTAB' | 'PAGE_DETAIL' | 'CHART';
/** `map_items.axis_type` / `map_calculated_fields.axis_type` — Oracle's `EDCBAxisType`. */
export type NeoMapAxisType = 'AXIS' | 'MEASURE' | 'PAGE';
/** `map_items.sort_direction` — Oracle's `EDCBSortDirection`, named. */
export type NeoSortDirection = 'ASC' | 'DESC';
/** `map_totals.kind` — a total, or a percentage of one. */
export type NeoMapTotalKind = 'TOTAL' | 'PERCENTAGE';
/**
 * `map_items.alignment` — Oracle's `0x0643`. No transformer emits a value yet:
 * six observed codes and an independent bit are unconfirmed (§7.8.8), so a
 * migrated item always carries `alignment: null` with the raw code in
 * `source_attrs.alignmentCode` instead of a guess.
 */
export type NeoMapAlignment = 'LEFT' | 'CENTER' | 'RIGHT';
/** `map_totals.placement` — Oracle's `EDCBAggregateLocation`, named. */
export type NeoMapTotalPlacement = 'GRAND_TOTAL' | 'AT_CHANGE';
export type NeoMapOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'BETWEEN'
  | 'IS_NULL';
export type NeoConditionType = 'PARAMETER' | 'STATIC';
/** `map_parameters.param_type` is a plain varchar in Neo, not a pg enum. */
export type NeoMapParameterType = 'STRING' | 'NUMBER' | 'DATE' | 'LIST';
export type NeoPermissionLevel = 'CREATE' | 'EDIT' | 'DELETE' | 'EXPORT' | 'SCHEDULE' | 'VIEW';
export type NeoUserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';

export const NEO_FOLDER_TYPES: ReadonlySet<string> = new Set<NeoFolderType>([
  'TABLE',
  'VIEW',
  'DERIVED',
  'COMPLEX',
  'JOIN',
  'SUMMARY',
]);

export const NEO_ITEM_TYPES: ReadonlySet<string> = new Set<NeoItemType>([
  'CI',
  'CU',
  'CO',
  'JI',
  'HI',
  'AG',
  'FU',
]);

// ---------------------------------------------------------------------------
// Version-aware type maps
// ---------------------------------------------------------------------------

/** EUL4 folder (OBJ_TYPE) values. */
export const FOLDER_TYPE_MAP_EUL4: Record<string, NeoFolderType> = {
  TABLE: 'TABLE',
  VIEW: 'VIEW',
  COMPLEX: 'COMPLEX',
  JOIN: 'JOIN',
};

/** EUL5 adds DERIVED and SUMMARY. */
export const FOLDER_TYPE_MAP_EUL5: Record<string, NeoFolderType> = {
  ...FOLDER_TYPE_MAP_EUL4,
  DERIVED: 'DERIVED',
  SUMMARY: 'SUMMARY',
};

export function folderTypeMapFor(version: EulVersion): Record<string, NeoFolderType> {
  // EUL3 shares EUL4's folder types (no DERIVED/SUMMARY).
  return version === 'EUL5' ? FOLDER_TYPE_MAP_EUL5 : FOLDER_TYPE_MAP_EUL4;
}

/**
 * EXP_TYPE → Neo item_type. Note SM (Security Manager, EUL5) has **no** Neo
 * item type — those expressions migrate to row-level security policies, not
 * items, so they are intentionally absent here and skipped by `transformItem`.
 */
export const ITEM_TYPE_MAP: Record<string, NeoItemType> = {
  CI: 'CI',
  CU: 'CU',
  CO: 'CO',
  JI: 'JI',
  HI: 'HI',
  AG: 'AG',
  FU: 'FU',
};

// `JOIN_TYPE_MAP` lived here until Phase 3.2. There is no join type to map any
// more: it was read from `KEY_CONS.KEY_TYPE`, whose live domain is `FK`/`UK`,
// and it is now DERIVED at query time from `allow_master_no_detail` /
// `allow_detail_no_master` (D-032). See `backend/src/lib/sql/join-type.ts`.

/**
 * EUL ELEM_ACCESS privilege type → Neo permission level. ELEM_ACCESS records
 * *access* (the user may see/query the object), not a CRUD grade, so every
 * migrated grant lands at VIEW; elevated permissions must be re-granted in Neo.
 */
export const GRANT_PERMISSION_MAP: Record<string, NeoPermissionLevel> = {
  BUSINESS_AREA: 'VIEW',
  OBJECT: 'VIEW',
  FOLDER: 'VIEW',
};

export const DEFAULT_GRANT_PERMISSION: NeoPermissionLevel = 'VIEW';

// ---------------------------------------------------------------------------
// Transformed entity shapes (runner resolves the *SourceId / *Username refs)
// ---------------------------------------------------------------------------

export interface TransformedBusinessArea {
  sourceId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdByUsername: string | null;
  updatedByUsername: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  warnings: TransformWarning[];
}

export interface TransformedFolder {
  sourceId: number;
  /** The OWNING business area — Neo's folders.business_area_id. */
  businessAreaSourceId: number | null;
  /**
   * Every business area the folder belongs to in the EUL (`BA_OBJ_LINKS`),
   * owning area included. The runner writes the non-owning ones to
   * `folder_business_areas` so a shared folder is visible in all of them.
   */
  businessAreaSourceIds: number[];
  name: string;
  description: string | null;
  folderType: NeoFolderType;
  tableName: string | null;
  tableOwner: string | null;
  customSql: string | null;
  displayOrder: number;
  isActive: boolean;
  createdByUsername: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  warnings: TransformWarning[];
}

export interface TransformedItem {
  sourceId: number;
  folderSourceId: number | null;
  name: string;
  description: string | null;
  itemType: NeoItemType;
  columnName: string | null;
  formula: string | null;
  dataType: string | null;
  formatMask: string | null;
  aggFunction: string | null;
  displayOrder: number;
  isHidden: boolean;
  isActive: boolean;
  parentItemSourceId: number | null;
  createdByUsername: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  warnings: TransformWarning[];
  /** True when the source expression cannot be represented as a Neo item. */
  skip: boolean;
}

/**
 * One column pair of a join's predicate — a `join_predicates` row.
 *
 * Item ids are nullable because the item may not have migrated. The row is
 * still emitted: dropping it would shorten the ON clause and return MORE rows
 * than the source did, so an unresolvable component refuses at query time
 * instead (D-058).
 */
export interface TransformedJoinComponent {
  /** MASTER-side item (D-040). */
  leftItemSourceId: number | null;
  /** DETAIL-side item (D-040). */
  rightItemSourceId: number | null;
  /** One of `=`, `<`, `>`, `<=`, `>=`, `<>`. */
  operator: string;
  /** 0-based position within the ANDed predicate. */
  sequence: number;
}

export interface TransformedJoin {
  sourceId: number;
  name: string;
  /** MASTER folder, `KEY_CONS.FK_OBJ_ID_REMOTE` — Neo's `joins.left_folder_id`. */
  leftFolderSourceId: number | null;
  /** DETAIL folder, `KEY_CONS.KEY_OBJ_ID` — Neo's `joins.right_folder_id`. */
  rightFolderSourceId: number | null;
  oneToOne: boolean;
  allowMasterNoDetail: boolean;
  allowDetailNoMaster: boolean;
  mandatory: boolean;
  predicateFormula: string | null;
  isActive: boolean;
  createdAt: Date | null;
  components: TransformedJoinComponent[];
  warnings: TransformWarning[];
}

export interface TransformedHierarchyLevel {
  sourceId: number;
  itemSourceId: number | null;
  levelName: string;
  /** Derived depth, root = 1. */
  levelNumber: number;
  /** Source id of the parent node; null at the root (EUL: HI_SEGMENTS). */
  parentSourceId: number | null;
}

export interface TransformedHierarchy {
  sourceId: number;
  businessAreaSourceId: number | null;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  levels: TransformedHierarchyLevel[];
  warnings: TransformWarning[];
}

export interface TransformedCustomFunction {
  sourceId: number;
  name: string;
  description: string | null;
  functionType: NeoFunctionType;
  returnType: string | null;
  /** JSON argument list; null when EUL carries no signature metadata. */
  parameters: unknown;
  isActive: boolean;
  warnings: TransformWarning[];
}

/**
 * One displayed column of a worksheet.
 *
 * Resolved two ways, in order. `itemSourceId` is the EUL `EXPRESSIONS.EXP_ID`
 * the workbook records for the item, which is exact — it survives a rename in
 * the EUL and is the same key every other migrated foreign key uses. The
 * folder and item **labels** are what the workbook saw when it was saved, and
 * are the fallback for the rare column that records no id, matched against
 * `folders.name` / `items.name` in Discoverer Neo.
 */
export interface TransformedMapItem {
  /** EUL `EXPRESSIONS.EXP_ID`, when the workbook records one. */
  itemSourceId: number | null;
  /** Folder display name, e.g. 'M M27'. Null on a workbook calculation. */
  folderLabel: string | null;
  /** Item display name, e.g. 'Dt Emissao'. Null when the blob omitted it. */
  itemLabel: string | null;
  /** Heading the worksheet shows, when it overrides the item's own name. */
  displayName: string | null;
  formatMask: string | null;
  displayOrder: number;
  /** True for a calculation defined inside the workbook, not an EUL item. */
  isCalculation: boolean;

  // --- worksheet layout (EUL_SCHEMA_GROUND_TRUTH.md §7.8) -------------------

  /**
   * `map_items.axis_type` — where the item sits, from the column's own
   * `EDCBAxisType` (`0x02be`), falling back to which of the query request's
   * two lists names it. Null when the worksheet's layout did not decode, and
   * then Neo shows no axis rather than a guessed one.
   */
  axisType: NeoMapAxisType | null;
  /**
   * `map_items.axis_order` — position within that axis, 0-based. Axis items
   * and measures are numbered separately, exactly as `Axis Item Usage` and
   * `Measure Item Usage` are printed.
   */
  axisOrder: number | null;
  /**
   * `map_items.is_hidden` — the worksheet's query names this item but no
   * column displays it (typically a calculation needs it). It migrates so the
   * map records what the Discoverer query asked for, not as a shown column.
   */
  isHidden: boolean;

  // --- sorting (§7.8.6) ----------------------------------------------------
  //
  // Discoverer stores a sort twice — query-side (`0x00f0`, which is what
  // `d4wkdmp -f` prints as `EUL Sort Item Reference`) and layout-side
  // (`0x0514`, which carries the group/break block). Both halves land on the
  // column they sort, because a Discoverer sort is 1:1 with an item and
  // `map_items` already *is* the column (§7.9.2).

  /**
   * `map_items.sort_direction` — `Direction` (`0x00f2`) named: 1 ASC, 2 DESC.
   *
   * Null when the item is not sorted at all, and also when `Direction` holds
   * a code neither 1 nor 2 (unobserved corpus-wide, and then reported rather
   * than guessed). Neo's `buildOrderByClause` emits nothing for a null, so an
   * unnamed direction produces the map that has no ORDER BY, never a wrong one.
   */
  sortDirection: NeoSortDirection | null;
  /**
   * `map_items.sort_order` — 0-based position in the worksheet's sort list,
   * which is the precedence Discoverer applies them in and the order
   * `Sort Item Usage` prints. Set whenever a sort names this item, including
   * when `sortDirection` could not be named.
   *
   * This is *not* `DCBImportedItemSort::GetRank`. `map_items.sort_rank` exists
   * for `Rank` and stays null: `d4wkdmp` never prints it (§7.8.14) and nothing
   * in the corpus separates it from the two unconfirmed flags on `0x0514`.
   */
  sortOrder: number | null;
  /**
   * `map_items.sort_group` — Oracle's `IsABreak`: a *group* sort, the feature
   * the 4i Plus User Guide documents separately from plain table sorting. The
   * sort suppresses repeated values and creates the boundary a subtotal breaks
   * on. Layout-side it is a sort entry carrying a group block
   * (`0x0518` → `0x05dc`), true on 2 029 of the corpus's 3 865 sorts.
   */
  sortGroup: boolean;

  // --- item format (§7.8.8) -------------------------------------------------

  /** `map_items.column_width` — the data font's display width (`0x07e4`). */
  columnWidth: number | null;
  /** `map_items.data_type` — the format block's value type (`0x0642`). */
  dataType: string | null;
  /** `map_items.heading_format_mask` — the heading style's own format mask. */
  headingFormatMask: string | null;
  /**
   * `map_items.alignment`. Always null — see `NeoMapAlignment`. The raw
   * `0x0643` code, when the column carries one, is in `sourceAttrs.alignmentCode`.
   */
  alignment: NeoMapAlignment | null;
  /** `map_items.word_wrap` — `0x0645` read as a boolean, or null when absent. */
  wordWrap: boolean | null;
  /** The column's own element id inside the `.DIS` body, or the hidden item's. */
  sourceElementId: number | null;
  /** `alignmentCode` when the column carries one that could not be named. */
  sourceAttrs: Record<string, unknown> | null;
}

/**
 * The worksheet's own identity and the heading it printed above the data
 * (§7.8.4) — everything a `map_layouts` row holds except the join usage, which
 * arrives separately because resolving it needs the joins the same run wrote.
 *
 * A worksheet always has an index, so this is never null; the rest may be.
 * Discoverer writes the printed title three times — plain (`0x01f9`), RTF
 * (`0x0201`) and as an HTML fragment (`0x0205`) — and all three are kept: the
 * plain text is what a grid heading needs and the other two carry the bold,
 * colour and size the author chose, which nothing else records.
 */
export interface TransformedMapLayout {
  /** Position of the worksheet within its workbook, 0-based. */
  worksheetIndex: number;
  worksheetGuid: string | null;
  title: string | null;
  titleRtf: string | null;
  titleHtml: string | null;
  /**
   * How many query requests the worksheet linked (`0x026b`). Neo models one
   * query per map, so anything above 1 is a worksheet whose queries were
   * merged — visible here instead of silently lost. Null when the layout did
   * not decode.
   */
  queryCount: number | null;
  /** The worksheet element's own id inside the `.DIS` body. */
  sourceElementId: number | null;
}

/**
 * One `map_page_setup` row — Discoverer's `DCBImportedDisplaySettings`
 * (`0x0834`, §7.8.12), shared by every map a workbook produces.
 *
 * Only the element's own id is written as a typed field. The six texts, six
 * font references and six margins are **[STRUCT]** as a group but their tag
 * order does not say which slot is which (§7.8.12), and orientation, scale
 * and the grid-line/heading toggles are **[UNCONFIRMED]** altogether — so
 * every one of Neo's named columns (`header_left`, `margin_top`,
 * `orientation`, …) would be a guess. `buildMapPageSetupRow` writes all of
 * them null and keeps the raw arrays in `sourceAttrs` instead.
 */
export interface TransformedMapPageSetup {
  /** The display-settings element's own id inside the `.DIS` body. */
  sourceElementId: number;
  /** The six texts, six font element ids and six margins, in tag order. */
  sourceAttrs: Record<string, unknown>;
}

/**
 * A reference to an already-migrated EUL join a worksheet's query forces
 * (`0x0118`, §7.8.9) — `d4wkdmp`'s `Join Usage`.
 */
export interface TransformedMapJoin {
  /** The join-reference element's own id inside the `.DIS` body. */
  sourceElementId: number;
  /** EUL join id (`0x0119`) — `d4wkdmp`'s `Id` on `EUL Join Reference`. */
  eulJoinSourceId: number | null;
  identifier: string | null;
  name: string | null;
  owningFolderIdentifier: string | null;
  owningFolderName: string | null;
}

/** A worksheet condition, resolved as far as the token tree allows. */
export interface TransformedMapCondition {
  /** EUL `EXPRESSIONS.EXP_ID` of the item filtered, when the workbook records one. */
  itemSourceId: number | null;
  folderLabel: string | null;
  itemLabel: string | null;
  /** Neo `map_operator` value; null when the source operator has no Neo equivalent. */
  operator: NeoMapOperator | null;
  value: string | null;
  /**
   * `map_conditions.param_name`: the **bind name** of the parameter that
   * supplies this condition's value, never the prompt the user sees. Null on a
   * STATIC condition.
   */
  paramName: string | null;
  conditionType: NeoConditionType;
  displayOrder: number;
  /** The condition exactly as Discoverer displays it, for the warning text. */
  sourceText: string | null;
  /**
   * Which workbook condition this row came from.
   *
   * A Discoverer condition can be a compound (`a AND (b OR c)`) and becomes
   * several rows. They are all or nothing: if one row's item did not migrate,
   * the writer must drop the whole set, because keeping the rest would widen a
   * conjunction or narrow a disjunction.
   */
  sourceIndex: number;
  /**
   * Rows sharing a key are parenthesized together in the generated SQL. Null
   * when the row stands alone. The writer turns each distinct key into one
   * `map_conditions.group_id` per map.
   */
  groupKey: string | null;
  /**
   * `map_conditions.logic_operator`. On the *first* row of a group it says how
   * that group joins the previous one; on the rest, how the row joins the one
   * before it inside the group. That double duty is what Neo's SQL generator
   * reads, not an accident of this transformer.
   */
  logicOperator: 'AND' | 'OR';
}

export interface TransformedMapParameter {
  /** The prompt as Discoverer's author wrote it — free text. */
  name: string;
  /**
   * `map_parameters.bind_name`: the Oracle identifier this prompt binds as,
   * derived from `name` by `makeBindName` and unique within the map.
   */
  bindName: string;
  paramType: NeoMapParameterType;
  defaultValue: string | null;
  isRequired: boolean;
}

/**
 * One `map_totals` row — Discoverer's `DCBImportedSummary` (`0x0c1c`).
 *
 * The two column references are given as **display orders**, not as item
 * identities, because `map_totals` points at `map_items` /
 * `map_calculated_fields` rows rather than at EUL items. Both writers build
 * the same two lookups from the rows they have just pushed for this map, so a
 * total can only ever name a row that exists.
 */
export interface TransformedMapTotal {
  /**
   * `map_totals.kind`. Always `TOTAL` today: Discoverer carries a percentage
   * as a value of the same `EDCBAggregateType` the summary already holds
   * (there is no percentage element class — §7.12), and the two percentage
   * codes are not among the seven the corpus uses.
   */
  kind: NeoMapTotalKind;
  /**
   * `display_order` of the `map_items` row this total aggregates. Null when
   * the totalled column shows a workbook calculation (then
   * `measureCalculationOrder` is set) or when `0x0c22` named no column.
   */
  measureItemOrder: number | null;
  /**
   * `display_order` of the `map_calculated_fields` row this total aggregates,
   * when the totalled column shows a workbook calculation.
   */
  measureCalculationOrder: number | null;
  /**
   * `display_order` of the `map_items` row whose change breaks this subtotal.
   * Null on a grand total, and also when the breaking column shows a
   * calculation — `map_totals.break_map_item_id` can only name a `map_items`
   * row.
   */
  breakItemOrder: number | null;
  /**
   * `map_totals.agg_function`. `SUM` or null: only `EDCBAggregateType` code 1
   * is established (see `aggregateFunctionOf`). The raw code is always in
   * `sourceAttrs`, so a null here loses nothing.
   */
  aggFunction: string | null;
  /** `map_totals.placement`; null for an `EDCBAggregateLocation` code outside 1/3/6. */
  placement: NeoMapTotalPlacement | null;
  /** `map_totals.label` — the template, with `&value` / `&item` left intact. */
  label: string | null;
  /** Position among the worksheet's totals, in the order the body writes them. */
  displayOrder: number;
  /** The summary element's own id inside the `.DIS` body. */
  sourceElementId: number;
  /** Everything `d4wkdmp` cannot confirm, kept verbatim. */
  sourceAttrs: Record<string, unknown>;
}

export interface TransformedMapCalculatedField {
  name: string;
  formula: string;
  displayOrder: number;
  /**
   * `map_calculated_fields.axis_type` — the calculation's own `Placement`
   * (`0x00e2`): 1 measure, 2 axis. `0` means "not placed on this sheet",
   * which is `isHidden`, not an axis, so it maps to null.
   */
  axisType: NeoMapAxisType | null;
  /** `map_calculated_fields.is_hidden` — the calculation's `Hidden` (`0x00e6`). */
  isHidden: boolean;
}

/**
 * One migrated map.
 *
 * A Discoverer **workbook** is a container of worksheets; a Discoverer
 * **worksheet** is what actually has a column layout, conditions and a query.
 * Discoverer Neo has no workbook container — a `map` is a single report — so
 * one workbook produces one map *per worksheet*. Merging a multi-worksheet
 * workbook into a single map would concatenate unrelated column lists and
 * produce a report that never existed.
 */
export interface TransformedWorkbook {
  /** `DOC_ID` of the workbook this map came from. */
  sourceId: number;
  /** Worksheet index within that workbook, 0-based. */
  worksheetIndex: number;
  name: string;
  description: string | null;
  mapType: NeoMapType;
  ownerUsername: string | null;
  isPublic: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** How many worksheets the source workbook had in total. */
  worksheetCount: number;
  /**
   * `maps.select_distinct` — the query request's `Distinct` (`0x0128`).
   *
   * False both when Discoverer said so and when the worksheet's layout did
   * not decode, which is the behaviour every map had before the layout was
   * read at all.
   */
  selectDistinct: boolean;
  items: TransformedMapItem[];
  conditions: TransformedMapCondition[];
  parameters: TransformedMapParameter[];
  calculatedFields: TransformedMapCalculatedField[];
  /** Totals defined on this worksheet, in the order the body writes them. */
  totals: TransformedMapTotal[];
  /**
   * Print settings (§7.8.12) — one per workbook, so every worksheet's map
   * carries the same row. Null when the document has no page-setup element.
   */
  pageSetup: TransformedMapPageSetup | null;
  /** The worksheet's identity and printed heading (§7.8.4). */
  layout: TransformedMapLayout;
  /**
   * EUL joins this worksheet's query forces (§7.8.9), deduplicated across its
   * query requests. Empty when the worksheet's layout did not decode or names
   * no join.
   */
  joins: TransformedMapJoin[];
  warnings: TransformWarning[];
}

export interface TransformedUser {
  /** Source key (`EUL_USERS.EU_USERNAME`). */
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  role: NeoUserRole;
  /**
   * True when the source principal is a database ROLE (`EU_ROLE_FLAG`), not a
   * person. Roles hold grants but must never be able to sign in.
   */
  isRole: boolean;
  /**
   * True when the account was provisioned with a temporary password and must
   * rotate it before doing anything else.
   */
  mustChangePassword: boolean;
  warnings: TransformWarning[];
}

export interface TransformedGrant {
  sourceId: number;
  granteeUsername: string;
  /** True when the grantee is a database role rather than a user. */
  granteeIsRole: boolean;
  businessAreaSourceId: number | null;
  folderSourceId: number | null;
  /**
   * `DOCUMENT` (a workbook grant) and `EUL` (an EUL-wide privilege) have no
   * Neo equivalent yet — both are carried through so they can be reported,
   * and both set `skip`.
   */
  level: 'BUSINESS_AREA' | 'FOLDER' | 'DOCUMENT' | 'EUL';
  permissionLevel: NeoPermissionLevel;
  warnings: TransformWarning[];
  /** True when the grant can't be represented (no BA/folder reference). */
  skip: boolean;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/**
 * Placeholder password hash for accounts that must NEVER authenticate.
 *
 * Not a valid bcrypt hash, so no supplied password can ever match it. Used for
 * two cases: database ROLES (which are grant-holders, not people), and any
 * migration run without a password hasher, where falling back to a usable
 * credential would be the unsafe default.
 */
export const MIGRATED_USER_PASSWORD_HASH = '!migrated-no-login';

/**
 * The domain of every `agg_function` column — the five functions Neo's SQL
 * generator accepts (`backend/src/lib/sql/formula-parser.ts`;
 * `select-clause.ts` throws on anything else). Enforced in the database by
 * `0012_constrain_agg_function.sql`.
 */
export const NEO_AGGREGATE_FUNCTIONS = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'] as const;

/**
 * Normalize an EUL **Default aggregate** to that domain.
 *
 * Oracle's own grammar is `SUM|MAX|MIN|COUNT|AVG|DETAIL`
 * (`/aggregate`, `9.0.4\B10270_01.pdf` p. 5-171). `DETAIL` is the marker for
 * *no* aggregation, not a function — 8 152 of the live estate's items carry it
 * — so it normalizes to null, exactly like an absent value.
 *
 * Anything outside the domain also becomes null rather than reaching the
 * column. This is a correctness input, not a label: an unnamed function read
 * as an aggregate is a wrong number, and `agg_function` feeds both the
 * fan-trap guard's measure set and the SELECT list.
 */
export function normalizeAggregation(value: string | null): string | null {
  if (value === null) return null;
  const upper = value.trim().toUpperCase();
  return (NEO_AGGREGATE_FUNCTIONS as readonly string[]).includes(upper) ? upper : null;
}

/** Coalesce an empty/whitespace string to null; pass through real content. */
export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : value;
}

/** Truncate a string to `max` chars (Neo varchar columns have length caps). */
export function clamp(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
