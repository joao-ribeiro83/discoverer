/**
 * Unified schema adapter over EUL3/EUL4/EUL5 sources.
 *
 * Every table and column named here is verified against Oracle's own shipped
 * scripts — see `EUL_SCHEMA_GROUND_TRUTH.md` in this package for the evidence
 * trail and per-name confidence. Columns still awaiting live confirmation are
 * marked `[?]` at their definition and are read through `probeColumns()`,
 * which degrades to null rather than putting a guessed name into the SQL.
 *
 * Column-level differences are encoded as declarative specs: each canonical
 * column lists the versions it is missing in and what to do about it — take a
 * sibling column's value (`fallbackColumn`) or a constant (`defaultValue`).
 * Read functions SELECT only the columns that exist in the detected version
 * and fill the rest, so callers get identical normalized entities from any
 * source version.
 *
 * EUL3 column availability is assumed identical to EUL4 (Oracle's 3.x schema
 * docs are gone); EUL3 sources are readable best-effort but flagged
 * unsupported by the detector.
 */

import type { EulSource, OracleExecutor } from './oracle-client.js';
import { dbString, isTableNotFoundError, resolveExecutor } from './oracle-client.js';
import { assertSafeIdentifier } from './eul-version-detector.js';
import type {
  BusinessArea,
  ColumnMapping,
  ColumnType,
  CustomFunction,
  EulSchemaAdapter,
  EulUser,
  EulVersion,
  EulVersionInfo,
  Folder,
  Grant,
  Hierarchy,
  HierarchyNode,
  Item,
  Join,
  JoinComponent,
  Workbook,
} from '../types/eul-versions.js';
import {
  EXP_TYPE_CREATED_ITEM,
  EXP_TYPE_DATABASE_ITEM,
  EXP_TYPE_JOIN_PREDICATE,
  FOLDER_TYPE_COMPLEX,
  FOLDER_TYPE_SIMPLE,
  VERSION_FEATURES,
} from '../types/eul-versions.js';
// A `JP` predicate is written in the same token language as a workbook
// condition — `[1,81](a,b)` for `=`, `[1,98](…)` for `AND`, `[6,n]` for an
// item — so it is read with the same parser rather than a second one. The
// only difference is what `[6,n]` names: an `EXPRESSIONS.EXP_ID` here, a
// workbook element id there.
import { parseConditionTree, type ConditionNode } from './workbook-parser.js';

// ---------------------------------------------------------------------------
// Column specs (canonical = EUL5 shape)
// ---------------------------------------------------------------------------

interface ColumnSpec {
  name: string;
  type: ColumnType;
  required: boolean;
  mapsTo: string;
  /** Versions in which this column does not exist. */
  missingIn?: EulVersion[];
  defaultValue?: unknown;
  fallbackColumn?: string;
}

// NOTE: no `missingIn` appears in the specs below. The EUL4 and EUL5 column
// lists for every entity we read are identical in all confirmed sources — the
// version difference is the table-name prefix. Version-conditional columns
// should only be reintroduced with evidence.

/** `BAS` — business areas. Confirmed column list. */
const BA_COLUMNS: ColumnSpec[] = [
  { name: 'BA_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'BA_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'BA_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
  { name: 'BA_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'BA_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'BA_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', defaultValue: null },
  { name: 'BA_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', defaultValue: null },
];

/**
 * `BA_OBJ_LINKS` — folders belong to business areas through this link table,
 * NOT through a BA_ID column on OBJS.
 */
const BA_OBJ_LINK_COLUMNS: ColumnSpec[] = [
  { name: 'BOL_BA_ID', type: 'number', required: true, mapsTo: 'businessAreaId' },
  { name: 'BOL_OBJ_ID', type: 'number', required: true, mapsTo: 'folderId' },
];

/**
 * `OBJS` — folders. `OBJ_TYPE` is SOBJ/COBJ; the base table lives in
 * `SOBJ_EXT_TABLE` and its schema in `OBJ_EXT_OWNER`.
 */
const OBJ_COLUMNS: ColumnSpec[] = [
  { name: 'OBJ_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'OBJ_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'OBJ_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
  { name: 'OBJ_TYPE', type: 'string', required: true, mapsTo: 'folderType' },
  { name: 'SOBJ_EXT_TABLE', type: 'string', required: false, mapsTo: 'tableName', defaultValue: null },
  { name: 'OBJ_EXT_OWNER', type: 'string', required: false, mapsTo: 'tableOwner', defaultValue: null },
];

/**
 * `EXPRESSIONS` — items, calculations and conditions. The folder link is
 * `IT_OBJ_ID` and the physical column is `IT_EXT_COLUMN` (both `IT_`-prefixed:
 * they are the item-flavoured columns of the shared expression table).
 */
const EXP_COLUMNS: ColumnSpec[] = [
  { name: 'EXP_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'IT_OBJ_ID', type: 'number', required: false, mapsTo: 'folderId', defaultValue: null },
  { name: 'EXP_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'EXP_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
  { name: 'EXP_TYPE', type: 'string', required: true, mapsTo: 'expType' },
  { name: 'IT_EXT_COLUMN', type: 'string', required: false, mapsTo: 'columnName', defaultValue: null },
  { name: 'EXP_DATA_TYPE', type: 'string', required: false, mapsTo: 'dataType', defaultValue: null },
  { name: 'IT_FORMAT_MASK', type: 'string', required: false, mapsTo: 'formatMask', defaultValue: null },
  { name: 'IT_HEADING', type: 'string', required: false, mapsTo: 'heading', defaultValue: null },
];

/**
 * Probed on `EXPRESSIONS`.
 *
 * `IT_FUN_ID` is the item's **Default aggregate** — a foreign key to
 * `FUNCTIONS.FUN_ID`, not a code. Identified on the live EUL4 by Phase 0.3's
 * Q3 probe, which grouped every candidate: `110` = `Detail` ×8 152,
 * `1` = `SUM` ×1 292, null ×353. `IT_PLACEMENT` was the runner-up and was
 * ruled out — it groups `3`/`1`/`2`, a display-placement code.
 *
 * Probed rather than listed above because a column that is absent turns the
 * whole item read into an `ORA-00904`, and no offline source confirms the
 * spelling on EUL5.
 */
const EXP_OPTIONAL_COLUMNS = ['IT_FUN_ID'] as const;

/**
 * `KEY_CONS` — joins, folder to folder.
 *
 * **Orientation: `KEY_OBJ_ID` is the DETAIL, `FK_OBJ_ID_REMOTE` is the MASTER.**
 * This was inverted here until the Phase 0.3 probe measured it on the live
 * EUL4 — see `docs/master-plan/research/eul-probe-results.md` Q1. The one join
 * in that estate where a side's key is exactly unique (`M M111 -> M M111 1`:
 * `M_M111` 1 830 rows / 1 830 distinct keys) has that unique side on
 * `FK_OBJ_ID_REMOTE`, and `KEY_NAME` reads `master -> detail` with
 * `KEY_OBJ_ID` on the right of the arrow. Getting this backwards does not
 * error — it pushes the wrong side into the fan-trap inline view and returns
 * correct-looking wrong numbers, so it is covered by a regression test.
 *
 * `KEY_ID` (PK) and `KEY_NAME` are read via `probeColumns()` so a missing
 * column degrades to null instead of failing the whole read. `KEY_TYPE` is
 * probed too, but on a live EUL4 its domain is `FK`/`UK` — a constraint kind,
 * **not** a join type; the outer-join booleans `FK_MSTR_NO_DETAIL` /
 * `FK_DTL_NO_MASTER` are the real source, and land in Phase 3.2.
 */
const JOIN_COLUMNS: ColumnSpec[] = [
  { name: 'KEY_OBJ_ID', type: 'number', required: true, mapsTo: 'detailFolderId' },
  { name: 'FK_OBJ_ID_REMOTE', type: 'number', required: false, mapsTo: 'masterFolderId', defaultValue: null },
  { name: 'KEY_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
];

/**
 * `KEY_CONS` columns to probe for — absent ones are simply not selected.
 *
 * The four `FK_*` flags are the DTD's `OneToOne`, `AllowMasterNoDetail`,
 * `AllowDetailNoMaster` and `Mandatory` (`EUL.dtd:197-200`), confirmed present
 * and populated on all ten live rows by Phase 0.3's Q2. They are probed rather
 * than required because an absent column would take the whole join read down
 * with an ORA-00904, and because they are unconfirmed on EUL5.
 *
 * `KEY_TYPE` is deliberately NOT read. It was mapped to `joinType` until Phase
 * 3.2, but its live domain is `FK`/`UK` — a *constraint kind*. The join type
 * comes from the two outer-join flags and is derived, not stored (D-032).
 */
const JOIN_OPTIONAL_COLUMNS = [
  'KEY_ID',
  'KEY_NAME',
  'FK_ONE_TO_ONE',
  'FK_MSTR_NO_DETAIL',
  'FK_DTL_NO_MASTER',
  'FK_MANDATORY',
] as const;

/**
 * `HIERARCHIES` — the drill path itself. PK is `HI_ID`, not `HIER_ID`.
 *
 * Only `HI_ID` is confirmed by Oracle's shipped SQL (`Lineage.sql` joins on
 * it). The descriptive columns and the business-area link are probed, so a
 * source that names them differently degrades to nulls instead of ORA-00904.
 */
const HIER_COLUMNS: ColumnSpec[] = [
  { name: 'HI_ID', type: 'number', required: true, mapsTo: 'sourceId' },
];

/** Probed on HIERARCHIES. [?] */
const HIER_OPTIONAL_COLUMNS = [
  'HI_NAME',
  'HI_DESCRIPTION',
  'HI_DEVELOPER_KEY',
  'BA_ID',
] as const;

/**
 * `HI_NODES` — one row per node of a hierarchy. `HN_ID`/`HN_HI_ID` are
 * confirmed (`Lineage.sql` joins `A.HI_ID = B.HN_HI_ID`).
 */
const HIER_NODE_COLUMNS: ColumnSpec[] = [
  { name: 'HN_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'HN_HI_ID', type: 'number', required: true, mapsTo: 'hierarchyId' },
];

/**
 * The node→item link and node label are not attested offline. Candidates are
 * probed in order and the first present one wins; if none exist the node keeps
 * a null item, and Neo skips that level with a warning rather than the
 * migration inventing an association. [?]
 */
const HIER_NODE_OPTIONAL_COLUMNS = [
  'HN_EXP_ID',
  'HN_IT_EXP_ID',
  'HN_NAME',
] as const;

/** `HI_SEGMENTS` — the parent/child edges that give the tree its shape. */
const HIER_SEGMENT_COLUMNS: ColumnSpec[] = [
  { name: 'IHS_HI_ID', type: 'number', required: false, mapsTo: 'hierarchyId', defaultValue: null },
  { name: 'IHS_HN_ID_PARENT', type: 'number', required: false, mapsTo: 'parentNodeId', defaultValue: null },
  { name: 'IHS_HN_ID_CHILD', type: 'number', required: false, mapsTo: 'childNodeId', defaultValue: null },
];

/** `DOCUMENTS` — workbooks. */
const DOC_COLUMNS: ColumnSpec[] = [
  { name: 'DOC_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'DOC_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'DOC_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
  { name: 'DOC_CONTENT_TYPE', type: 'string', required: false, mapsTo: 'contentType', defaultValue: null },
  { name: 'DOC_DEVELOPER_KEY', type: 'string', required: false, mapsTo: 'developerKey', defaultValue: null },
  { name: 'DOC_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'DOC_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'DOC_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', defaultValue: null },
  { name: 'DOC_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', defaultValue: null },
];

/**
 * Probed on `DOCUMENTS`.
 *
 * `DOC_DOCUMENT` is the workbook body itself — a `LONG RAW` on a live EUL4,
 * holding the proprietary Discoverer container (`.DIS`). It is probed rather
 * than assumed because the column is confirmed only for 4.x; `DOC_CONTENT` is
 * the spelling the reference documentation uses for the later XML-bodied
 * releases, and whichever of the two exists wins.
 *
 * `DOC_EU_ID` (owner) is confirmed only from EUL5 examples, and
 * `DOC_FOLDER_ID` is absent from the live EUL4 entirely. [?]
 */
const DOC_OPTIONAL_COLUMNS = [
  'DOC_DOCUMENT',
  'DOC_CONTENT',
  'DOC_LENGTH',
  'DOC_BATCH',
  'DOC_EU_ID',
  'DOC_FOLDER_ID',
] as const;

/** Body-column spellings, most-confirmed first; the first present one wins. */
const DOC_CONTENT_COLUMNS = ['DOC_DOCUMENT', 'DOC_CONTENT'] as const;

/**
 * `FUNCTIONS` — registered PL/SQL functions.
 *
 * Only `FUN_ID`/`FUN_NAME` are certain. The description column is NOT
 * `FUN_DESCRIPTION`: a live EUL4 spells it `FUN_DESCRIPTION_S` (with a
 * companion `FUN_DESCRIPTION_MN`), so it is probed rather than assumed —
 * specifying it outright made the whole assessment die on ORA-00904.
 */
const FUN_COLUMNS: ColumnSpec[] = [
  { name: 'FUN_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'FUN_NAME', type: 'string', required: false, mapsTo: 'name', defaultValue: null },
];

/** Probed on FUNCTIONS; first present description spelling wins. */
const FUN_OPTIONAL_COLUMNS = [
  'FUN_DESCRIPTION_S',
  'FUN_DESCRIPTION',
  'FUN_EXT_NAME',
  'FUN_EXT_PACKAGE',
  'FUN_EXT_OWNER',
] as const;

/**
 * `ACCESS_PRIVS` — privileges. The grantee is `AP_EU_ID` → `EUL_USERS.EU_ID`;
 * there is no username column on this table. `GP_APP_ID` is a numeric
 * privilege code and `GD_DOC_ID` the workbook a grant applies to.
 */
const GRANT_COLUMNS: ColumnSpec[] = [
  { name: 'AP_EU_ID', type: 'number', required: true, mapsTo: 'granteeId' },
  { name: 'GP_APP_ID', type: 'number', required: false, mapsTo: 'privCode', defaultValue: null },
  { name: 'AP_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
];

/**
 * Target-id columns on `ACCESS_PRIVS`. `GD_DOC_ID` is confirmed; the
 * business-area and folder equivalents are NOT confirmed offline, so all of
 * these are probed rather than assumed. [?]
 */
const GRANT_OPTIONAL_COLUMNS = [
  'GD_DOC_ID',
  'AP_ID',
  'GBA_BA_ID',
  'GO_OBJ_ID',
] as const;

/** `EUL_USERS` — the grantee directory. `EU_ROLE_FLAG` marks DB roles. */
const USER_COLUMNS: ColumnSpec[] = [
  { name: 'EU_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'EU_USERNAME', type: 'string', required: true, mapsTo: 'username' },
  { name: 'EU_ROLE_FLAG', type: 'boolean', required: false, mapsTo: 'isRole', defaultValue: false },
];

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

function toMappings(specs: ColumnSpec[], version: EulVersion): ColumnMapping[] {
  return specs.map((spec) => ({
    name: spec.name,
    type: spec.type,
    required: spec.required,
    defaultValue: spec.defaultValue,
    fallbackColumn: spec.fallbackColumn,
    mapsTo: spec.mapsTo,
    existsInSource: !(spec.missingIn ?? []).includes(version),
  }));
}

export function createEulSchemaAdapter(version: EulVersionInfo): EulSchemaAdapter {
  const features = VERSION_FEATURES[version.version];
  const tableSet = new Set(version.tableNames.map((t) => t.toUpperCase()));

  const getTableName = (baseName: string): string =>
    `${version.prefix}${assertSafeIdentifier(baseName)}`;

  // An empty tableNames list (e.g. a hand-built EulVersionInfo in tests or a
  // config file) means "unknown" — assume present rather than silently
  // skipping entities.
  const hasTable = (baseName: string): boolean =>
    tableSet.size === 0 || tableSet.has(getTableName(baseName));

  return {
    version,
    getTableName,
    getQualifiedTableName: (baseName) =>
      version.owner
        ? `${assertSafeIdentifier(version.owner)}.${getTableName(baseName)}`
        : getTableName(baseName),
    hasTable,

    getBusinessAreaColumns: () => toMappings(BA_COLUMNS, version.version),
    getBusinessAreaLinkColumns: () => toMappings(BA_OBJ_LINK_COLUMNS, version.version),
    getFolderColumns: () => toMappings(OBJ_COLUMNS, version.version),
    getExpressionColumns: () => toMappings(EXP_COLUMNS, version.version),
    getJoinColumns: () => toMappings(JOIN_COLUMNS, version.version),
    getHierarchyColumns: () => toMappings(HIER_COLUMNS, version.version),
    getHierarchyNodeColumns: () => toMappings(HIER_NODE_COLUMNS, version.version),
    getHierarchySegmentColumns: () => toMappings(HIER_SEGMENT_COLUMNS, version.version),
    getDocumentColumns: () => toMappings(DOC_COLUMNS, version.version),
    getFunctionColumns: () => toMappings(FUN_COLUMNS, version.version),
    getUserColumns: () => toMappings(USER_COLUMNS, version.version),
    getGrantColumns: () => toMappings(GRANT_COLUMNS, version.version),

    supportsSummaryFolders: () => features.summaryFolders && hasTable('SUMMARY_OBJS'),
    hasHierarchyNodeTree: () => features.hierarchyNodeTree,
    hasRoleAwareGrantees: () => features.roleAwareGrantees,
  };
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

export class EulReadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EulReadError';
  }
}

function coerceValue(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'number': {
      if (typeof value === 'number') return value;
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    }
    case 'date': {
      if (value instanceof Date) return value;
      const d = new Date(dbString(value));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const s = dbString(value).toUpperCase();
      if (s === 'Y' || s === 'TRUE' || s === '1') return true;
      if (s === 'N' || s === 'FALSE' || s === '0') return false;
      return null;
    }
    case 'raw': {
      // The workbook container is binary; anything that coerces it (including
      // dbString) corrupts it. Buffers pass straight through, and a driver
      // that hands back a string instead is re-encoded from latin-1 so the
      // byte sequence survives.
      if (Buffer.isBuffer(value)) return value;
      if (typeof value === 'string') return Buffer.from(value, 'latin1');
      return null;
    }
    case 'string':
    case 'clob':
      return dbString(value);
  }
}

/**
 * Map one source row (uppercase column keys) through the version's column
 * mappings: existing columns are coerced; missing ones take their fallback
 * column's value, else their default, else null.
 */
export function normalizeRow(
  row: Record<string, unknown>,
  mappings: ColumnMapping[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const mapping of mappings) {
    let value: unknown;
    if (mapping.existsInSource) {
      value = coerceValue(row[mapping.name], mapping.type);
    } else if (
      mapping.fallbackColumn !== undefined &&
      row[mapping.fallbackColumn] !== undefined
    ) {
      value = coerceValue(row[mapping.fallbackColumn], mapping.type);
    } else {
      value = mapping.defaultValue ?? null;
    }
    out[mapping.mapsTo] = value;
  }
  return out;
}

function selectList(mappings: ColumnMapping[]): string {
  const existing = mappings.filter((m) => m.existsInSource).map((m) => m.name);
  // Fallback columns must ride along even when their canonical column is the
  // one that's missing (e.g. EUL4 needs OBJ_CREATED_BY twice conceptually —
  // once as createdBy, once to backfill updatedBy). A Set dedupes.
  const fallbacks = mappings
    .filter((m) => !m.existsInSource && m.fallbackColumn)
    .map((m) => m.fallbackColumn as string);
  return [...new Set([...existing, ...fallbacks])].join(', ');
}

/**
 * Ask the data dictionary which of `candidates` actually exist on a table.
 *
 * Several EUL columns are attested only by secondary sources, so putting them
 * straight into a SELECT risks ORA-00904 taking down an otherwise-good read.
 * Probing keeps the guess out of the SQL: a column that is not there is simply
 * never selected, and its normalized field stays null.
 *
 * Falls back to "none of them" if the dictionary itself is unreadable, which
 * degrades to the confirmed-columns-only read rather than failing.
 */
export async function probeColumns(
  execute: OracleExecutor,
  owner: string | undefined,
  tableName: string,
  candidates: readonly string[],
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const binds: Record<string, unknown> = { tbl: tableName.toUpperCase() };
  const placeholders = candidates.map((c, i) => {
    binds[`c${i}`] = c.toUpperCase();
    return `:c${i}`;
  });
  const ownerClause = owner ? 'AND owner = :own' : '';
  if (owner) binds.own = owner.toUpperCase();
  try {
    const rows = await execute(
      `SELECT column_name FROM all_tab_columns ` +
        `WHERE table_name = :tbl ${ownerClause} ` +
        `AND column_name IN (${placeholders.join(', ')})`,
      binds,
    );
    return new Set(rows.map((r) => dbString(r.COLUMN_NAME ?? '').toUpperCase()));
  } catch {
    return new Set();
  }
}

/** Build throwaway mappings for probed columns that turned out to exist. */
function optionalMappings(
  present: Set<string>,
  specs: Array<{ name: string; type: ColumnType; mapsTo: string }>,
): ColumnMapping[] {
  return specs
    .filter((s) => present.has(s.name))
    .map((s) => ({
      name: s.name,
      type: s.type,
      required: false,
      mapsTo: s.mapsTo,
      defaultValue: null,
      existsInSource: true,
    }));
}

async function readEntity(
  execute: OracleExecutor,
  adapter: EulSchemaAdapter,
  baseTable: string,
  mappings: ColumnMapping[],
  opts: { where?: string; binds?: Record<string, unknown>; orderBy?: string } = {},
): Promise<Array<Record<string, unknown>>> {
  const table = adapter.getQualifiedTableName(baseTable);
  const sql =
    `SELECT ${selectList(mappings)} FROM ${table}` +
    (opts.where ? ` WHERE ${opts.where}` : '') +
    (opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '');
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await execute(sql, opts.binds);
  } catch (err) {
    throw new EulReadError(
      `Failed to read ${table}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
  return rows.map((row) => normalizeRow(row, mappings));
}

// ---------------------------------------------------------------------------
// Unified read functions
// ---------------------------------------------------------------------------

export async function readBusinessAreas(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<BusinessArea[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'BAS', adapter.getBusinessAreaColumns(), {
    orderBy: 'BA_NAME',
  });
  return rows as unknown as BusinessArea[];
}

/**
 * Folders, with their business area resolved through `BA_OBJ_LINKS`.
 *
 * `OBJ_TYPE` is normalized from Oracle's SOBJ/COBJ codes to the folder
 * vocabulary the transform layer speaks: a simple folder over a base object
 * becomes TABLE, a complex folder becomes COMPLEX.
 */
export async function readFolders(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Folder[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'OBJS', adapter.getFolderColumns(), {
    orderBy: 'OBJ_NAME',
  });

  // Folder → business area comes from the link table, not a column on OBJS.
  // The relationship is many-to-many: collect ALL of them, so a folder shared
  // across business areas can be reported rather than quietly truncated.
  const basByFolder = new Map<number, number[]>();
  if (adapter.hasTable('BA_OBJ_LINKS')) {
    try {
      const links = await readEntity(
        execute,
        adapter,
        'BA_OBJ_LINKS',
        adapter.getBusinessAreaLinkColumns(),
      );
      for (const link of links) {
        const folderId = link.folderId as number | null;
        const baId = link.businessAreaId as number | null;
        if (folderId === null || baId === null) continue;
        const list = basByFolder.get(folderId) ?? [];
        if (!list.includes(baId)) list.push(baId);
        basByFolder.set(folderId, list);
      }
    } catch (err) {
      if (!(err instanceof EulReadError) || !isTableNotFoundError(err.cause)) throw err;
    }
  }

  return rows.map((row) => {
    const bas = basByFolder.get(row.sourceId as number) ?? [];
    return {
      ...(row as unknown as Folder),
      folderType: normalizeFolderType(row.folderType),
      // Neo's folders.business_area_id is a single NOT NULL column, so only
      // the first link can be honoured; transformFolder warns about the rest.
      businessAreaId: bas[0] ?? null,
      sharedBusinessAreaIds: bas,
      sequence: null,
      createdBy: null,
      createdAt: null,
      updatedBy: null,
      updatedAt: null,
    };
  });
}

/** SOBJ → TABLE, COBJ → COMPLEX; anything else passes through uppercased. */
export function normalizeFolderType(raw: unknown): string {
  const t = dbString(raw ?? '').toUpperCase();
  if (t === FOLDER_TYPE_SIMPLE) return 'TABLE';
  if (t === FOLDER_TYPE_COMPLEX) return 'COMPLEX';
  return t || 'TABLE';
}

/**
 * Item-like EXP_TYPEs read by default.
 *
 * `CO` (database item) comes FIRST and is the one that matters: it is the
 * plain column-backed item. `CI` (created item) covers calculations. Reading
 * only `CI` — as this package did before the ground-truth audit — silently
 * skips every real column in the EUL.
 */
export const DEFAULT_ITEM_EXP_TYPES: readonly string[] = [
  EXP_TYPE_DATABASE_ITEM,
  EXP_TYPE_CREATED_ITEM,
];

/**
 * `FUNCTIONS.FUN_ID` → `FUN_NAME`, for resolving `IT_FUN_ID`.
 *
 * A separate read of a tiny table rather than a join, so the item read keeps
 * the shape every other entity read has and an absent `FUNCTIONS` degrades to
 * "no default aggregate anywhere" instead of failing the item read.
 */
async function readFunctionNames(
  execute: OracleExecutor,
  adapter: EulSchemaAdapter,
): Promise<Map<number, string>> {
  const byId = new Map<number, string>();
  try {
    const rows = await readEntity(execute, adapter, 'FUNCTIONS', adapter.getFunctionColumns(), {
      orderBy: 'FUN_ID',
    });
    for (const row of rows) {
      const id = row.sourceId as number | null;
      const name = row.name as string | null;
      if (id !== null && name !== null) byId.set(id, name);
    }
  } catch {
    // An unreadable FUNCTIONS table costs the default aggregate, not the read.
  }
  return byId;
}

export async function readItems(
  adapter: EulSchemaAdapter,
  source: EulSource,
  options: { expTypes?: readonly string[] } = {},
): Promise<Item[]> {
  const execute = resolveExecutor(source);
  const expTypes = options.expTypes ?? DEFAULT_ITEM_EXP_TYPES;
  const binds: Record<string, unknown> = {};
  const placeholders = expTypes.map((t, i) => {
    binds[`t${i}`] = t;
    return `:t${i}`;
  });
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('EXPRESSIONS'),
    EXP_OPTIONAL_COLUMNS,
  );
  const aggregateByFunctionId = present.has('IT_FUN_ID')
    ? await readFunctionNames(execute, adapter)
    : new Map<number, string>();
  const rows = await readEntity(
    execute,
    adapter,
    'EXPRESSIONS',
    [
      ...adapter.getExpressionColumns(),
      ...optionalMappings(present, [
        { name: 'IT_FUN_ID', type: 'number', mapsTo: 'functionId' },
      ]),
    ],
    {
      where: `EXP_TYPE IN (${placeholders.join(', ')})`,
      binds,
      // IT_OBJ_ID is the folder link; there is no EXP_SEQUENCE column.
      orderBy: 'IT_OBJ_ID, EXP_ID',
    },
  );
  return rows.map((row, idx) => ({
    ...(row as unknown as Item),
    // Not present in the EUL expression table — supplied so downstream
    // ordering is stable and Neo's displayOrder is populated.
    sequence: idx,
    formula: null,
    // The Default aggregate, named. `Detail` reaches this field as `Detail`
    // and is turned into "no aggregation" one layer up, by
    // `normalizeAggregation` — this layer reports what the EUL says, it does
    // not decide what it means.
    aggregation: ((): string | null => {
      const functionId = (row as { functionId?: number | null }).functionId;
      if (functionId === null || functionId === undefined) return null;
      return aggregateByFunctionId.get(functionId) ?? null;
    })(),
    nullsAllowed: true,
    parentItemId: null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
  }));
}

/**
 * `EUL4_FUNCTIONS.FUN_ID` → the six comparison operators a join predicate may
 * use (`9.0.4/B10270_01.pdf` p. 24-91, the Join Wizard's verbatim list).
 *
 * A CLOSED table. A `[1,n]` at a comparison position whose `n` is not here is
 * not an operator to pass through — it means the tree is something other than
 * an ANDed set of column comparisons, and the whole predicate is refused
 * rather than half-read (D-058).
 *
 * `104` (`!=`) and `105` (`^=`) are Oracle's own spellings of `<>` — the same
 * operator, not an approximation of it — so they normalize onto `<>`.
 */
const JOIN_PREDICATE_OPERATORS: Record<number, string> = {
  81: '=',
  82: '<>',
  83: '>',
  84: '<',
  85: '<=',
  86: '>=',
  104: '<>',
  105: '<>',
};

/** `AND` (`FUN_FUNCTION_TYPE` 3) — the n-ary combiner of a multi-column join. */
const FUN_ID_AND = 98;
/** `()` — a bracket node, transparent to the predicate's shape. */
const FUN_ID_BRACKET = 106;

/** One comparison lifted out of a `JP` token tree, still in token order. */
interface RawJoinPredicate {
  leftExpId: number;
  rightExpId: number;
  operator: string;
}

/**
 * Decompose a `JP` token tree into its column comparisons.
 *
 * The grammar accepted is deliberately narrow: an optional n-ary `AND` over
 * comparison nodes, each comparing exactly two item references. Everything
 * else — a literal, a function call, a parameter, an `OR`, a nested
 * arithmetic expression — returns null, and the join then carries no
 * predicate and refuses by name at generation time (D-039). Emitting the part
 * that was understood would produce a shorter condition than the source had,
 * and a shorter join condition returns MORE rows, not fewer.
 *
 * Returns null rather than throwing: one undecodable join must not fail the
 * whole EUL read.
 */
export function parseJoinPredicate(formula: string | null): RawJoinPredicate[] | null {
  const { tree } = parseConditionTree(formula);
  if (!tree) return null;

  const unwrap = (node: ConditionNode): ConditionNode =>
    node.type === 'call' && node.code === FUN_ID_BRACKET && node.args.length === 1
      ? unwrap(node.args[0]!)
      : node;

  const comparison = (node: ConditionNode): RawJoinPredicate | null => {
    const n = unwrap(node);
    if (n.type !== 'call') return null;
    const operator = JOIN_PREDICATE_OPERATORS[n.code];
    if (!operator || n.args.length !== 2) return null;
    const [left, right] = [unwrap(n.args[0]!), unwrap(n.args[1]!)];
    if (left.type !== 'item' || right.type !== 'item') return null;
    return { leftExpId: left.elementId, rightExpId: right.elementId, operator };
  };

  const root = unwrap(tree);
  const nodes =
    root.type === 'call' && root.code === FUN_ID_AND ? root.args : [root];
  if (nodes.length === 0) return null;

  const parsed = nodes.map(comparison);
  return parsed.every((p): p is RawJoinPredicate => p !== null) ? parsed : null;
}

/**
 * Every join's predicate, keyed by `KEY_CONS.KEY_ID`.
 *
 * One `EXPRESSIONS` row per join — Phase 0.3 Q0 measured exactly ten `JP`
 * rows against ten `KEY_CONS` rows, one each — so a multi-column join is a
 * compound formula inside a single row, never several rows. The components
 * come from parsing `EXP_FORMULA1`; they cannot be read off separate rows.
 *
 * Degrades to an empty map when `JP_KEY_ID` or `EXP_FORMULA1` is absent, or
 * the read fails. A join without a predicate is a loud refusal later, which is
 * the point — it is never a silently dropped join.
 */
async function readJoinPredicates(
  execute: OracleExecutor,
  adapter: EulSchemaAdapter,
): Promise<Map<number, { formula: string | null; components: RawJoinPredicate[] }>> {
  const byKeyId = new Map<
    number,
    { formula: string | null; components: RawJoinPredicate[] }
  >();
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('EXPRESSIONS'),
    ['JP_KEY_ID', 'EXP_FORMULA1'],
  );
  if (!present.has('JP_KEY_ID') || !present.has('EXP_FORMULA1')) return byKeyId;

  try {
    const rows = await readEntity(
      execute,
      adapter,
      'EXPRESSIONS',
      [
        { name: 'JP_KEY_ID', type: 'number', required: true, mapsTo: 'keyId', existsInSource: true },
        { name: 'EXP_FORMULA1', type: 'string', required: false, mapsTo: 'formula', defaultValue: null, existsInSource: true },
      ],
      {
        where: 'EXP_TYPE = :jp',
        binds: { jp: EXP_TYPE_JOIN_PREDICATE },
        orderBy: 'JP_KEY_ID',
      },
    );
    for (const row of rows) {
      const keyId = row.keyId as number | null;
      if (keyId === null) continue;
      const formula = (row.formula as string | null) ?? null;
      byKeyId.set(keyId, {
        formula,
        components: parseJoinPredicate(formula) ?? [],
      });
    }
  } catch {
    // An unreadable JP read costs the predicates, not the join read. Every
    // join then refuses by name, which is diagnosable; a failed read is not.
  }
  return byKeyId;
}

/**
 * `EXPRESSIONS.EXP_ID` → `IT_OBJ_ID`, for the items a join predicate names.
 *
 * Orientation is settled by measurement, not by token order: each side of a
 * comparison is placed on master or detail by looking up which folder its item
 * belongs to. Nothing in the token language says the left operand is the
 * master, and getting it backwards is invisible — it produces correct-looking
 * wrong numbers rather than an error.
 */
async function readItemFolders(
  execute: OracleExecutor,
  adapter: EulSchemaAdapter,
  expIds: number[],
): Promise<Map<number, number>> {
  const byExpId = new Map<number, number>();
  if (expIds.length === 0) return byExpId;
  const binds: Record<string, unknown> = {};
  const placeholders = expIds.map((id, i) => {
    binds[`e${i}`] = id;
    return `:e${i}`;
  });
  try {
    const rows = await readEntity(
      execute,
      adapter,
      'EXPRESSIONS',
      [
        { name: 'EXP_ID', type: 'number', required: true, mapsTo: 'expId', existsInSource: true },
        { name: 'IT_OBJ_ID', type: 'number', required: false, mapsTo: 'folderId', defaultValue: null, existsInSource: true },
      ],
      { where: `EXP_ID IN (${placeholders.join(', ')})`, binds },
    );
    for (const row of rows) {
      const expId = row.expId as number | null;
      const folderId = row.folderId as number | null;
      if (expId !== null && folderId !== null) byExpId.set(expId, folderId);
    }
  } catch {
    // Unresolvable folders leave every component unoriented, and the join
    // refuses rather than guessing which side is which.
  }
  return byExpId;
}

/**
 * Joins — `KEY_CONS`, folder to folder.
 *
 * There is no `JOINS`/`JOI_COMP` pair in any Discoverer release, and joins do
 * not bind items: `KEY_OBJ_ID` and `FK_OBJ_ID_REMOTE` are both folder ids.
 * That lines up with Neo's `joins` table, whose folder ids are NOT NULL and
 * whose item ids are nullable.
 *
 * `KEY_ID`/`KEY_NAME`/`KEY_TYPE` are probed: unconfirmed offline, so they are
 * only selected if the data dictionary says they exist. Without `KEY_ID` the
 * source id falls back to the row index, which is stable within one read.
 */
export async function readJoins(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Join[]> {
  const execute = resolveExecutor(source);
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('KEY_CONS'),
    JOIN_OPTIONAL_COLUMNS,
  );
  const mappings = [
    ...adapter.getJoinColumns(),
    ...optionalMappings(present, [
      { name: 'KEY_ID', type: 'number', mapsTo: 'sourceId' },
      { name: 'KEY_NAME', type: 'string', mapsTo: 'name' },
      { name: 'FK_ONE_TO_ONE', type: 'number', mapsTo: 'oneToOne' },
      { name: 'FK_MSTR_NO_DETAIL', type: 'number', mapsTo: 'allowMasterNoDetail' },
      { name: 'FK_DTL_NO_MASTER', type: 'number', mapsTo: 'allowDetailNoMaster' },
      { name: 'FK_MANDATORY', type: 'number', mapsTo: 'mandatory' },
    ]),
  ];

  const rows = await readEntity(execute, adapter, 'KEY_CONS', mappings, {
    orderBy: present.has('KEY_ID') ? 'KEY_ID' : 'KEY_OBJ_ID',
  });

  const predicatesByKeyId = await readJoinPredicates(execute, adapter);
  const referencedExpIds = [
    ...new Set(
      [...predicatesByKeyId.values()].flatMap((p) =>
        p.components.flatMap((c) => [c.leftExpId, c.rightExpId]),
      ),
    ),
  ];
  const folderByExpId = await readItemFolders(execute, adapter, referencedExpIds);

  return rows.map((row, idx) => {
    const master = (row.masterFolderId as number | null) ?? null;
    const detail = (row.detailFolderId as number | null) ?? null;
    const sourceId = (row.sourceId as number | null) ?? idx;
    const predicate = predicatesByKeyId.get(sourceId);

    return {
      sourceId,
      name:
        (row.name as string | null) ??
        (row.description as string | null) ??
        `Join ${master ?? '?'}→${detail ?? '?'}`,
      description: (row.description as string | null) ?? null,
      masterFolderId: master,
      detailFolderId: detail,
      // `FK_ONE_TO_ONE` absent or null means one-to-many, which is
      // "assume fanning" (D-033) — the safe direction, and the one Oracle's
      // own default takes.
      oneToOne: dbFlag(row.oneToOne),
      allowMasterNoDetail: dbFlag(row.allowMasterNoDetail),
      allowDetailNoMaster: dbFlag(row.allowDetailNoMaster),
      mandatory: dbFlag(row.mandatory),
      predicateFormula: predicate?.formula ?? null,
      components: orientComponents(
        predicate?.components ?? [],
        master,
        folderByExpId,
      ),
      createdBy: null,
      createdAt: null,
    };
  });
}

/** A `NUMBER` flag column: 1 is true, everything else (0, null) is false. */
function dbFlag(raw: unknown): boolean {
  if (typeof raw === 'number') return raw === 1;
  if (typeof raw === 'string') return raw.trim() === '1';
  return false;
}

/**
 * The operator that means the same thing with its operands swapped.
 *
 * Only `=` and `<>` are symmetric. `a < b` is not `b < a` — it is `b > a` —
 * so a component reordered onto the master/detail axis must have its operator
 * reversed with it, or the condition silently changes meaning.
 */
const REVERSED_OPERATOR: Record<string, string> = {
  '=': '=',
  '<>': '<>',
  '<': '>',
  '>': '<',
  '<=': '>=',
  '>=': '<=',
};

/**
 * Put each comparison's two items on the master and detail sides, by folder.
 *
 * The token tree's operand order carries no orientation of its own — nothing
 * in the language says the left operand is the master — so the side is
 * decided by looking up which folder each item belongs to. A component whose
 * items cannot be placed (neither is on the master folder, or both are) keeps
 * its token order. The row exists either way, so the predicate always keeps
 * its true width and can never silently shorten.
 */
function orientComponents(
  raw: RawJoinPredicate[],
  masterFolderId: number | null,
  folderByExpId: Map<number, number>,
): JoinComponent[] {
  return raw.map((c, sequence) => {
    const leftFolder = folderByExpId.get(c.leftExpId);
    const rightFolder = folderByExpId.get(c.rightExpId);
    const swap =
      masterFolderId !== null &&
      rightFolder === masterFolderId &&
      leftFolder !== masterFolderId;
    return {
      masterItemId: swap ? c.rightExpId : c.leftExpId,
      detailItemId: swap ? c.leftExpId : c.rightExpId,
      operator: swap ? (REVERSED_OPERATOR[c.operator] ?? c.operator) : c.operator,
      sequence,
    };
  });
}

/**
 * Order a hierarchy's nodes root-first and stamp each with a derived depth.
 *
 * `HI_SEGMENTS` is a parent/child edge list, so depth is computed by walking
 * from the root (the node that is never a child) rather than read from a
 * column — no Discoverer release stores a level number. Nodes unreachable
 * from any root keep `depth: null` and are appended, so a cyclic or orphaned
 * segment can never drop a node from the migration silently.
 */
export function orderHierarchyNodes(
  nodes: HierarchyNode[],
  parentOf: Map<number, number>,
): HierarchyNode[] {
  const childrenOf = new Map<number, number[]>();
  for (const [child, parent] of parentOf) {
    const list = childrenOf.get(parent) ?? [];
    list.push(child);
    childrenOf.set(parent, list);
  }

  const byId = new Map(nodes.map((n) => [n.sourceId, n]));
  const roots = nodes.filter((n) => !parentOf.has(n.sourceId));

  const ordered: HierarchyNode[] = [];
  const seen = new Set<number>();
  const walk = (id: number, depth: number): void => {
    if (seen.has(id)) return; // cycle guard
    seen.add(id);
    const node = byId.get(id);
    if (node) {
      ordered.push({ ...node, parentNodeId: parentOf.get(id) ?? null, depth });
    }
    for (const child of childrenOf.get(id) ?? []) walk(child, depth + 1);
  };
  for (const root of roots) walk(root.sourceId, 1);

  for (const node of nodes) {
    if (!seen.has(node.sourceId)) {
      ordered.push({ ...node, parentNodeId: parentOf.get(node.sourceId) ?? null, depth: null });
    }
  }
  return ordered;
}

export async function readHierarchies(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Hierarchy[]> {
  const execute = resolveExecutor(source);
  const hierPresent = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('HIERARCHIES'),
    HIER_OPTIONAL_COLUMNS,
  );
  const hierarchies = (await readEntity(
    execute,
    adapter,
    'HIERARCHIES',
    [
      ...adapter.getHierarchyColumns(),
      ...optionalMappings(hierPresent, [
        { name: 'HI_NAME', type: 'string', mapsTo: 'name' },
        { name: 'HI_DESCRIPTION', type: 'string', mapsTo: 'description' },
        { name: 'BA_ID', type: 'number', mapsTo: 'businessAreaId' },
      ]),
    ],
    { orderBy: 'HI_ID' },
  )) as unknown as Hierarchy[];

  const nodePresent = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('HI_NODES'),
    HIER_NODE_OPTIONAL_COLUMNS,
  );
  // Only one item-link candidate is selected, so two spellings can't collide
  // on the same normalized field.
  const itemLink = HIER_NODE_OPTIONAL_COLUMNS.filter((c) => c.endsWith('EXP_ID')).find((c) =>
    nodePresent.has(c),
  );
  const nodes = (await readEntity(
    execute,
    adapter,
    'HI_NODES',
    [
      ...adapter.getHierarchyNodeColumns(),
      ...optionalMappings(nodePresent, [
        ...(itemLink ? [{ name: itemLink, type: 'number' as const, mapsTo: 'itemId' }] : []),
        { name: 'HN_NAME', type: 'string', mapsTo: 'name' },
      ]),
    ],
    { orderBy: 'HN_HI_ID, HN_ID' },
  )) as unknown as HierarchyNode[];

  // Edges. A missing segments table just means every node is a root.
  const parentOf = new Map<number, number>();
  if (adapter.hasTable('HI_SEGMENTS')) {
    try {
      const segments = await readEntity(
        execute,
        adapter,
        'HI_SEGMENTS',
        adapter.getHierarchySegmentColumns(),
      );
      for (const seg of segments) {
        const child = seg.childNodeId as number | null;
        const parent = seg.parentNodeId as number | null;
        if (child !== null && parent !== null) parentOf.set(child, parent);
      }
    } catch (err) {
      if (!(err instanceof EulReadError) || !isTableNotFoundError(err.cause)) throw err;
    }
  }

  const byHierarchy = new Map<number, HierarchyNode[]>();
  for (const node of nodes) {
    if (node.hierarchyId === null) continue;
    const list = byHierarchy.get(node.hierarchyId) ?? [];
    list.push({ ...node, name: node.name ?? `Node ${node.sourceId}`, itemId: node.itemId ?? null });
    byHierarchy.set(node.hierarchyId, list);
  }

  return hierarchies.map((h) => ({
    ...h,
    name: h.name ?? `Hierarchy ${h.sourceId}`,
    businessAreaId: h.businessAreaId ?? null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
    nodes: orderHierarchyNodes(byHierarchy.get(h.sourceId) ?? [], parentOf),
  }));
}

export async function readCustomFunctions(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<CustomFunction[]> {
  const execute = resolveExecutor(source);
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('FUNCTIONS'),
    FUN_OPTIONAL_COLUMNS,
  );
  // Only one description spelling is selected, so two cannot collide on the
  // same normalized field.
  const descCol = ['FUN_DESCRIPTION_S', 'FUN_DESCRIPTION'].find((c) => present.has(c));
  const rows = await readEntity(
    execute,
    adapter,
    'FUNCTIONS',
    [
      ...adapter.getFunctionColumns(),
      ...optionalMappings(present, [
        ...(descCol ? [{ name: descCol, type: 'string' as const, mapsTo: 'description' }] : []),
      ]),
    ],
    { orderBy: 'FUN_NAME' },
  );
  return rows.map((row) => ({
    ...(row as unknown as CustomFunction),
    description: (row.description as string | null) ?? null,
  }));
}

/**
 * Workbook bodies are large — the source this was built against averages
 * ~110 KB each over 558 workbooks, and the biggest is half a megabyte. Reading
 * them all in one statement would hold the whole set in memory at once, so the
 * bodies are fetched in batches keyed by `DOC_ID`. The metadata pass stays a
 * single cheap query.
 */
const WORKBOOK_BODY_BATCH = 25;

export async function readWorkbooks(
  adapter: EulSchemaAdapter,
  source: EulSource,
  options: { includeContent?: boolean } = {},
): Promise<Workbook[]> {
  const includeContent = options.includeContent ?? true;
  const execute = resolveExecutor(source);
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('DOCUMENTS'),
    DOC_OPTIONAL_COLUMNS,
  );
  const contentColumn = DOC_CONTENT_COLUMNS.find((c) => present.has(c)) ?? null;

  const mappings = [
    ...adapter.getDocumentColumns(),
    ...optionalMappings(present, [
      { name: 'DOC_EU_ID', type: 'number', mapsTo: 'ownerId' },
      { name: 'DOC_LENGTH', type: 'number', mapsTo: 'contentLength' },
      { name: 'DOC_BATCH', type: 'number', mapsTo: 'batchFlag' },
    ]),
  ];
  const rows = await readEntity(execute, adapter, 'DOCUMENTS', mappings, {
    orderBy: 'DOC_NAME',
  });

  // Resolve the owner id to a username when the column exists.
  const users = present.has('DOC_EU_ID') ? await readUsers(adapter, execute) : [];
  const nameById = new Map(users.map((u) => [u.sourceId, u.username]));

  const bodies =
    includeContent && contentColumn !== null
      ? await readWorkbookBodies(
          execute,
          adapter,
          contentColumn,
          rows.map((row) => row.sourceId as number),
        )
      : new Map<number, Buffer | string>();

  return rows.map((row) => ({
    ...(row as unknown as Workbook),
    owner:
      row.ownerId !== undefined && row.ownerId !== null
        ? (nameById.get(row.ownerId as number) ?? null)
        : ((row.createdBy as string | null) ?? null),
    contentLength: (row.contentLength as number | null) ?? null,
    isBatch: ((row.batchFlag as number | null) ?? 0) !== 0,
    content: bodies.get(row.sourceId as number) ?? null,
  }));
}

/**
 * Fetch the workbook bodies for `documentIds`, in batches.
 *
 * A batch that fails is reported as missing bodies for those workbooks rather
 * than aborting: one unreadable `LONG RAW` (a truncated row, a driver that
 * refuses the type) must not cost the migration every other workbook.
 */
async function readWorkbookBodies(
  execute: OracleExecutor,
  adapter: EulSchemaAdapter,
  contentColumn: string,
  documentIds: number[],
): Promise<Map<number, Buffer | string>> {
  const bodies = new Map<number, Buffer | string>();
  const table = adapter.getQualifiedTableName('DOCUMENTS');
  const column = assertSafeIdentifier(contentColumn);

  for (let offset = 0; offset < documentIds.length; offset += WORKBOOK_BODY_BATCH) {
    const batch = documentIds.slice(offset, offset + WORKBOOK_BODY_BATCH);
    const binds: Record<string, unknown> = {};
    const placeholders = batch.map((id, i) => {
      binds[`d${i}`] = id;
      return `:d${i}`;
    });
    try {
      // Selected without an alias so the result key is the column's own name:
      // the driver returns UPPERCASE keys either way, and an alias would have
      // to be re-derived by every caller that does not know which of the two
      // body-column spellings this source uses.
      const rows = await execute(
        `SELECT DOC_ID, ${column} FROM ${table} ` +
          `WHERE DOC_ID IN (${placeholders.join(', ')})`,
        binds,
      );
      for (const row of rows) {
        const id = Number(row.DOC_ID);
        const body = coerceValue(row[column], 'raw');
        if (!Number.isNaN(id) && Buffer.isBuffer(body) && body.length > 0) {
          bodies.set(id, body);
        }
      }
    } catch {
      // Leave this batch's bodies unset; transformWorkbook reports them as
      // metadata-only migrations.
    }
  }
  return bodies;
}

/**
 * Grants — `ACCESS_PRIVS`, with the grantee resolved through `EUL_USERS`.
 *
 * The privilege target columns beyond `GD_DOC_ID` are unconfirmed offline, so
 * they are probed. A grant with no resolvable target is reported at level
 * `EUL` (an EUL-wide privilege) rather than being silently dropped.
 */
export async function readGrants(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Grant[]> {
  const execute = resolveExecutor(source);
  const present = await probeColumns(
    execute,
    adapter.version.owner,
    adapter.getTableName('ACCESS_PRIVS'),
    GRANT_OPTIONAL_COLUMNS,
  );
  const mappings = [
    ...adapter.getGrantColumns(),
    ...optionalMappings(present, [
      { name: 'AP_ID', type: 'number', mapsTo: 'sourceId' },
      { name: 'GD_DOC_ID', type: 'number', mapsTo: 'documentId' },
      { name: 'GBA_BA_ID', type: 'number', mapsTo: 'businessAreaId' },
      { name: 'GO_OBJ_ID', type: 'number', mapsTo: 'folderId' },
    ]),
  ];

  const rows = await readEntity(execute, adapter, 'ACCESS_PRIVS', mappings, {
    orderBy: 'AP_EU_ID',
  });

  const users = await readUsers(adapter, execute);
  const byId = new Map(users.map((u) => [u.sourceId, u]));

  return rows.map((row, idx) => {
    const user = byId.get(row.granteeId as number);
    const businessAreaId = (row.businessAreaId as number | null) ?? null;
    const folderId = (row.folderId as number | null) ?? null;
    const documentId = (row.documentId as number | null) ?? null;
    const level: Grant['level'] =
      businessAreaId !== null
        ? 'BUSINESS_AREA'
        : folderId !== null
          ? 'FOLDER'
          : documentId !== null
            ? 'DOCUMENT'
            : 'EUL';
    const privCode = (row.privCode as number | null) ?? null;
    return {
      sourceId: (row.sourceId as number | null) ?? idx,
      businessAreaId,
      folderId,
      documentId,
      // Fall back to the raw EU_ID when the directory has no matching row, so
      // an unresolvable grant is still reportable rather than blank.
      grantee: user?.username ?? dbString(row.granteeId ?? ''),
      granteeIsRole: user?.isRole ?? false,
      privCode,
      // GP_APP_ID's code table is undocumented offline; carry the number
      // through as a string so the transform's map can grow once decoded.
      privType: privCode === null ? null : String(privCode),
      level,
      createdBy: null,
      createdAt: (row.createdAt as Date | null) ?? null,
    };
  });
}

/** Users and roles — `EUL_USERS`, the directory grants point at. */
export async function readUsers(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<EulUser[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'EUL_USERS', adapter.getUserColumns(), {
    orderBy: 'EU_USERNAME',
  });
  return rows.map((row) => ({
    sourceId: row.sourceId as number,
    username: dbString(row.username ?? ''),
    isRole: row.isRole === true,
    source: 'EUL_USERS' as const,
  }));
}
