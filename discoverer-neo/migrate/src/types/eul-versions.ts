/**
 * Type definitions and version constants for the EUL version detection and
 * schema adapter layer.
 *
 * Source of truth: `EUL_SCHEMA_GROUND_TRUTH.md` (this package), derived from
 * Oracle's own shipped scripts under `discoverer10g/sql/` — `euldrop.sql` and
 * `eul4del.sql` for the table inventory, `Lineage.sql` and `batchusr.sql` for
 * real column names, `eulver.sql` for the version stamp.
 *
 * Do NOT take table or column names from `EUL_VERSION_REFERENCE.md` or §8 of
 * `oracle_discoverer_complete_reference.md`. Both describe a schema that does
 * not exist in any Discoverer release (`EUL5_JOINS`, `OBJ_TABLE_NAME`,
 * `EXP_COL_NAME`, `EUL5_ELEM_ACCESS`, …) and were the origin of a fleet of
 * fabricated identifiers in this package.
 *
 * A note on EUL3: Oracle's own documentation for the 3.x EUL schema is
 * essentially gone. Everywhere this module needs a column-level answer for
 * EUL3 it assumes EUL3 ≈ EUL4 (same columns, `EUL_` prefix) — which is why
 * EUL3 is detected and readable on a best-effort basis but reported as
 * `supported: false`.
 */

// ---------------------------------------------------------------------------
// Versions and prefixes
// ---------------------------------------------------------------------------

export type EulVersion = 'EUL3' | 'EUL4' | 'EUL5';

export type EulTablePrefix = 'EUL_' | 'EUL4_' | 'EUL5_';

export const EUL_PREFIX: Record<EulVersion, EulTablePrefix> = {
  EUL3: 'EUL_',
  EUL4: 'EUL4_',
  EUL5: 'EUL5_',
};

/** Detection order matters: EUL5 wins over EUL4 wins over EUL3. */
export const EUL_VERSIONS_BY_PRECEDENCE: readonly EulVersion[] = [
  'EUL5',
  'EUL4',
  'EUL3',
];

// ---------------------------------------------------------------------------
// Table inventory (base names, without prefix)
// ---------------------------------------------------------------------------

/**
 * Base table names present in every EUL version, verified against Oracle's
 * `euldrop.sql` (EUL5) and `eul4del.sql` (EUL4).
 *
 * The EUL4 and EUL5 inventories are effectively identical — the version
 * difference is the table-name prefix, not the set of tables.
 */
export const CORE_TABLES: readonly string[] = [
  'BAS',
  'BA_OBJ_LINKS',
  'OBJS',
  'OBJ_DEPS',
  'OBJ_JOIN_USGS',
  'EXPRESSIONS',
  'EXP_DEPS',
  'KEY_CONS',
  'HIERARCHIES',
  'HI_NODES',
  'HI_SEGMENTS',
  'SUMMARY_OBJS',
  'FUNCTIONS',
  'ACCESS_PRIVS',
  'EUL_USERS',
  'DOCUMENTS',
  'ELEM_XREFS',
  'QPP_STATS',
  'VERSIONS',
];

/**
 * Base table names found only in EUL4's inventory (`eul4del.sql`) and absent
 * from EUL5's (`euldrop.sql`). These are the only genuine inventory
 * difference between the two versions, and the only usable table-presence
 * discriminator beyond the prefix itself.
 */
export const EUL4_ONLY_TABLES: readonly string[] = [
  'NAMED_ELEMS',
  'ODBC_CATALOGS',
  'ODBC_SCHEMAS',
];

/**
 * The table that stamps the EUL's own version. Read `VER_RELEASE` from it.
 * There is no `<prefix>EUL` table in any release.
 */
export const VERSION_TABLE = 'VERSIONS';

/** Business-area marker table — the presence test that identifies an EUL. */
export const BUSINESS_AREA_TABLE = 'BAS';

// ---------------------------------------------------------------------------
// Version info (detector output)
// ---------------------------------------------------------------------------

export interface EulVersionInfo {
  version: EulVersion;
  prefix: EulTablePrefix;
  /** Human-readable Discoverer release, e.g. '4.1.x', '10.1.2/11.1.1'. */
  discovererVersion: string;
  /** Raw EUL*_EUL.EU_VERSION value, e.g. '5.1.0.0.0', or 'unknown'. */
  schemaVersion: string;
  /** Actual EUL% table names found in the source DB (uppercase, unqualified). */
  tableNames: string[];
  /** Schema owner the tables live under (uppercase), when known. */
  owner?: string;
  /** Whether this version can be migrated by the tool. */
  supported: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Column mappings (adapter output)
// ---------------------------------------------------------------------------

/**
 * `raw` is the workbook body (`DOCUMENTS.DOC_DOCUMENT`, a `LONG RAW`): it is
 * carried through as a Buffer with no coercion, because it is a proprietary
 * binary container rather than text — see `workbook-parser.ts`.
 */
export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'clob' | 'raw';

export interface ColumnMapping {
  /** Actual column name in the source DB (uppercase). */
  name: string;
  type: ColumnType;
  required: boolean;
  /** Value to use when the column doesn't exist in this source version. */
  defaultValue?: unknown;
  /**
   * When the column doesn't exist in this source version, take the value of
   * this sibling column instead of `defaultValue` (e.g. EUL4 has no
   * OBJ_UPDATED_BY, so it falls back to OBJ_CREATED_BY per the reference).
   */
  fallbackColumn?: string;
  /** Discoverer Neo field this column maps to (camelCase). */
  mapsTo: string;
  /** Whether the column actually exists in the adapter's source version. */
  existsInSource: boolean;
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export interface EulFeatureFlags {
  /** Summary folders (`SUMMARY_OBJS`) — present in EUL4 and EUL5 alike. */
  summaryFolders: boolean;
  /**
   * Hierarchies are a parent/child node tree (`HI_NODES` + `HI_SEGMENTS`) in
   * every version — there is no table of numbered levels. Kept as a flag so
   * callers can branch if a future source ever differs.
   */
  hierarchyNodeTree: boolean;
  /**
   * Grants are rows in `ACCESS_PRIVS` keyed to `EUL_USERS.EU_ID`. A grantee
   * may be a database role rather than a user; `EU_ROLE_FLAG` says which.
   */
  roleAwareGrantees: boolean;
}

export const VERSION_FEATURES: Record<EulVersion, EulFeatureFlags> = {
  EUL3: { summaryFolders: false, hierarchyNodeTree: true, roleAwareGrantees: true },
  EUL4: { summaryFolders: true, hierarchyNodeTree: true, roleAwareGrantees: true },
  EUL5: { summaryFolders: true, hierarchyNodeTree: true, roleAwareGrantees: true },
};

/**
 * `EXPRESSIONS.EXP_TYPE` values. Confirmed: `CO` is a database (base) item
 * bound to a real column via `IT_EXT_COLUMN`; `CI` is a *created* item — a
 * calculation, date-hierarchy item, or complex-folder item.
 *
 * Note the direction: `CO` is the plain column-backed item. Reading only `CI`
 * yields calculations and skips every real column, which is exactly the bug
 * the pre-rewrite code shipped.
 */
export const EXP_TYPE_DATABASE_ITEM = 'CO';
export const EXP_TYPE_CREATED_ITEM = 'CI';
/**
 * A join predicate. One row per `KEY_CONS` join, linked by `JP_KEY_ID`, whose
 * `EXP_FORMULA1` holds the whole (possibly multi-column) condition as a token
 * tree. `IT_OBJ_ID` and `IT_EXT_COLUMN` are null on these rows.
 *
 * The third and last value `EXP_TYPE` takes on the live EUL4: `CO` 6 967,
 * `CI` 2 830, `JP` 10.
 */
export const EXP_TYPE_JOIN_PREDICATE = 'JP';

export const EXP_TYPES_BY_VERSION: Record<EulVersion, readonly string[]> = {
  EUL3: [EXP_TYPE_DATABASE_ITEM, EXP_TYPE_CREATED_ITEM],
  EUL4: [EXP_TYPE_DATABASE_ITEM, EXP_TYPE_CREATED_ITEM],
  EUL5: [EXP_TYPE_DATABASE_ITEM, EXP_TYPE_CREATED_ITEM],
};

/**
 * `OBJS.OBJ_TYPE` values: `SOBJ` = simple folder (over a base table/view,
 * named by `SOBJ_EXT_TABLE`), `COBJ` = complex folder (a join of others).
 * Confirmed by `Lineage.sql`: `where obj_id = COBJ_ID and obj_type = 'SOBJ'`.
 */
export const FOLDER_TYPE_SIMPLE = 'SOBJ';
export const FOLDER_TYPE_COMPLEX = 'COBJ';

export const FOLDER_TYPES_BY_VERSION: Record<EulVersion, readonly string[]> = {
  EUL3: [FOLDER_TYPE_SIMPLE, FOLDER_TYPE_COMPLEX],
  EUL4: [FOLDER_TYPE_SIMPLE, FOLDER_TYPE_COMPLEX],
  EUL5: [FOLDER_TYPE_SIMPLE, FOLDER_TYPE_COMPLEX],
};

/**
 * What `FOLDER_TYPES_BY_VERSION` becomes after `normalizeFolderType()`.
 *
 * The read layer normalizes the raw SOBJ/COBJ codes into this vocabulary, so
 * anything inspecting a `Folder.folderType` must compare against THESE values
 * — comparing against the raw codes would flag every folder as anomalous.
 */
export const NORMALIZED_FOLDER_TYPES: readonly string[] = ['TABLE', 'COMPLEX'];

// ---------------------------------------------------------------------------
// Schema adapter interface
// ---------------------------------------------------------------------------

export interface EulSchemaAdapter {
  version: EulVersionInfo;

  /** e.g. 'BAS' → 'EUL5_BAS' / 'EUL4_BAS' / 'EUL_BAS'. */
  getTableName(baseName: string): string;
  /** Owner-qualified name for use in SQL, e.g. 'EUL5_US.EUL5_BAS'. */
  getQualifiedTableName(baseName: string): string;
  /** Whether the given base table was actually found in the source DB. */
  hasTable(baseName: string): boolean;

  getBusinessAreaColumns(): ColumnMapping[];
  /** `BA_OBJ_LINKS` — the folder↔business-area link table. */
  getBusinessAreaLinkColumns(): ColumnMapping[];
  getFolderColumns(): ColumnMapping[];
  getExpressionColumns(): ColumnMapping[];
  /** `KEY_CONS` — folder-to-folder joins. */
  getJoinColumns(): ColumnMapping[];
  getHierarchyColumns(): ColumnMapping[];
  /** `HI_NODES` — hierarchy nodes. */
  getHierarchyNodeColumns(): ColumnMapping[];
  /** `HI_SEGMENTS` — the parent/child edges between nodes. */
  getHierarchySegmentColumns(): ColumnMapping[];
  getDocumentColumns(): ColumnMapping[];
  getFunctionColumns(): ColumnMapping[];
  getUserColumns(): ColumnMapping[];
  getGrantColumns(): ColumnMapping[];

  supportsSummaryFolders(): boolean;
  hasHierarchyNodeTree(): boolean;
  hasRoleAwareGrantees(): boolean;
}

// ---------------------------------------------------------------------------
// Normalized entities (version-independent read-function output)
// ---------------------------------------------------------------------------

/**
 * `BAS`. Note there is no BA_LANGUAGE or BA_DEVELOPER_KEY column in any
 * confirmed source — both were inherited from the fabricated reference and
 * have been removed rather than defaulted, so nothing downstream can branch
 * on metadata the EUL never had.
 */
export interface BusinessArea {
  sourceId: number;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface Folder {
  sourceId: number;
  /**
   * The business area this folder migrates into. In the EUL the relationship
   * is MANY-TO-MANY (`BA_OBJ_LINKS`) — sharing one folder across several
   * business areas is normal Discoverer practice — but Neo's `folders` table
   * has a single non-null `business_area_id`. This holds the first link;
   * `sharedBusinessAreaIds` holds every link so the loss is reportable
   * instead of silent.
   */
  businessAreaId: number | null;
  /** Every `BA_OBJ_LINKS` business area for this folder, in read order. */
  sharedBusinessAreaIds: number[];
  name: string;
  description: string | null;
  folderType: string;
  tableName: string | null;
  tableOwner: string | null;
  sequence: number | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface Item {
  sourceId: number;
  folderId: number | null;
  name: string;
  description: string | null;
  expType: string;
  formula: string | null;
  columnName: string | null;
  dataType: string | null;
  formatMask: string | null;
  aggregation: string | null;
  sequence: number | null;
  nullsAllowed: boolean;
  parentItemId: number | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/**
 * One column pair of a join's predicate, ANDed with the others in `sequence`
 * order.
 *
 * The pair does NOT come from `KEY_CONS`, which carries no item columns at
 * all. It comes from the join's single `EXPRESSIONS` row — `EXP_TYPE = 'JP'`,
 * linked by `JP_KEY_ID` — whose `EXP_FORMULA1` holds the whole predicate as
 * one token tree: `[1,81](a,b)` for a single equality, `[1,98](…,…,…)` for an
 * n-ary AND. This estate runs five single-column joins, four three-column and
 * one four-column, all with `=`.
 *
 * `masterItemId`/`detailItemId` are `EXPRESSIONS.EXP_ID`s, oriented by looking
 * each one's `IT_OBJ_ID` up against the join's two folders — not by assuming
 * the token order matches the folder order.
 */
export interface JoinComponent {
  /** `EXP_ID` of the item on the MASTER folder's side. */
  masterItemId: number | null;
  /** `EXP_ID` of the item on the DETAIL folder's side. */
  detailItemId: number | null;
  /** One of `=`, `<`, `>`, `<=`, `>=`, `<>`. */
  operator: string;
  /** 0-based position within the ANDed predicate. */
  sequence: number;
}

/**
 * A join in the EUL binds two FOLDERS, not two items — `KEY_CONS` has no item
 * columns. This matches Neo's `joins` table, whose folder ids are NOT NULL.
 *
 * **Orientation (D-040, measured 2026-09-03):** `FK_OBJ_ID_REMOTE` is the
 * MASTER and `KEY_OBJ_ID` is the DETAIL. This was the other way round here
 * until Phase 0.3 measured it on the live EUL4.
 */
export interface Join {
  sourceId: number;
  name: string;
  description: string | null;
  /** MASTER folder — `KEY_CONS.FK_OBJ_ID_REMOTE`. */
  masterFolderId: number | null;
  /** DETAIL folder — `KEY_CONS.KEY_OBJ_ID`. */
  detailFolderId: number | null;
  /** `FK_ONE_TO_ONE`. Fan-trap detection only; never affects emitted SQL. */
  oneToOne: boolean;
  /** `FK_MSTR_NO_DETAIL` — "Outer join on detail". */
  allowMasterNoDetail: boolean;
  /** `FK_DTL_NO_MASTER` — "Outer join on master". */
  allowDetailNoMaster: boolean;
  /** `FK_MANDATORY`. Referential integrity; not a join type. */
  mandatory: boolean;
  /**
   * `EXPRESSIONS.EXP_FORMULA1` verbatim, or null when the join has no `JP`
   * row. Kept as provenance and as the escape hatch for a tree this reader
   * could not decompose.
   */
  predicateFormula: string | null;
  components: JoinComponent[];
  createdBy: string | null;
  createdAt: Date | null;
}

/**
 * One node of a hierarchy's drill path — a row of `HI_NODES`. Structure is
 * the parent/child edge list in `HI_SEGMENTS`, so `depth` is DERIVED by
 * walking that tree from the root (the node with no parent segment), not read
 * from any column. There is no `HIER_LEVELS` table and no level-number column
 * in any Discoverer release.
 */
export interface HierarchyNode {
  sourceId: number;
  hierarchyId: number | null;
  itemId: number | null;
  name: string;
  /** `HI_SEGMENTS.IHS_HN_ID_PARENT`; null at the root. */
  parentNodeId: number | null;
  /** Derived by tree walk: root = 1. Null when the node is unreachable. */
  depth: number | null;
}

export interface Hierarchy {
  sourceId: number;
  businessAreaId: number | null;
  name: string;
  description: string | null;
  /** Ordered root-first by derived depth. */
  nodes: HierarchyNode[];
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface CustomFunction {
  sourceId: number;
  name: string;
  description: string | null;
}

export interface Workbook {
  sourceId: number;
  name: string;
  description: string | null;
  /**
   * `DOC_CONTENT_TYPE` — e.g. `application/vnd.oracle-disco.wb` for a 4.x
   * workbook.
   */
  contentType: string | null;
  /**
   * The workbook body, read from `DOC_DOCUMENT` (a `LONG RAW` on EUL4).
   *
   * A Buffer for the Discoverer binary container, a string when a source
   * stores the body as XML, null when the carrying column is absent or empty.
   * `workbook-parser.ts` turns it into worksheets, columns, conditions,
   * parameters and calculations.
   */
  content: Buffer | string | null;
  /** `DOC_LENGTH` — the body's byte length as the EUL records it. */
  contentLength: number | null;
  /** `DOC_BATCH` — non-zero for a workbook scheduled as a batch report. */
  isBatch: boolean;
  /** `DOC_EU_ID` → `EUL_USERS.EU_ID`, resolved to a name when possible. */
  owner: string | null;
  developerKey: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

/**
 * `ELEM_XREFS` — the relational index of which items a workbook uses.
 * `EX_FROM_ID` is the referencing element (e.g. a `DOC_ID`) and `EX_TO_ID` the
 * referenced one (e.g. an `EXP_ID`).
 */
export interface WorkbookItemRef {
  fromId: number;
  toId: number;
  toParentName: string | null;
}

export interface EulUser {
  /** `EUL_USERS.EU_ID` — grants reference this, not the name. */
  sourceId: number;
  /** Oracle DB username or role name (`EU_USERNAME`). */
  username: string;
  /** `EU_ROLE_FLAG` — true when the grantee is a database role, not a user. */
  isRole: boolean;
  source: 'EUL_USERS';
}

/**
 * A row of `ACCESS_PRIVS`, resolved to a grantee name through `EUL_USERS`.
 *
 * `GP_APP_ID` is a numeric privilege code (values such as 1006 and 1015 appear
 * in Oracle's own `batchusr.sql`); the full code table is not documented in
 * any source available offline, so it is carried through verbatim as
 * `privCode` and mapped conservatively.
 *
 * `businessAreaId`/`folderId` come from optional `ACCESS_PRIVS` columns whose
 * names are NOT confirmed offline — the reader probes for them and leaves both
 * null when absent, rather than guessing a column name into the SQL.
 */
export interface Grant {
  sourceId: number;
  businessAreaId: number | null;
  folderId: number | null;
  /** `GD_DOC_ID` — set when the grant is on a workbook. */
  documentId: number | null;
  grantee: string;
  granteeIsRole: boolean;
  privCode: number | null;
  privType: string | null;
  /** Derived from whichever target id is populated. */
  level: 'BUSINESS_AREA' | 'FOLDER' | 'DOCUMENT' | 'EUL';
  createdBy: string | null;
  createdAt: Date | null;
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isEulVersion(value: unknown): value is EulVersion {
  return value === 'EUL3' || value === 'EUL4' || value === 'EUL5';
}

export function isEul3(info: EulVersionInfo): boolean {
  return info.version === 'EUL3';
}

export function isEul4(info: EulVersionInfo): boolean {
  return info.version === 'EUL4';
}

export function isEul5(info: EulVersionInfo): boolean {
  return info.version === 'EUL5';
}

/** True for versions the migration tool fully supports (EUL4 and EUL5). */
export function isSupportedEulVersion(info: EulVersionInfo): boolean {
  return info.supported;
}
