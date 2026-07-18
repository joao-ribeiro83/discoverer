/**
 * Unified schema adapter over EUL3/EUL4/EUL5 sources.
 *
 * Column-level differences are encoded as declarative specs (see
 * EUL_VERSION_REFERENCE.md §3): each canonical column lists the versions it
 * is missing in and what to do about it — take a sibling column's value
 * (`fallbackColumn`) or a constant (`defaultValue`). Read functions SELECT
 * only the columns that exist in the detected version and fill the rest, so
 * callers get identical normalized entities from any source version.
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
  HierarchyLevel,
  Item,
  Join,
  JoinComponent,
  Workbook,
} from '../types/eul-versions.js';
import { VERSION_FEATURES } from '../types/eul-versions.js';

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

/** Shorthand: the pre-EUL5 versions, for columns added in EUL5. */
const PRE5: EulVersion[] = ['EUL3', 'EUL4'];

const BA_COLUMNS: ColumnSpec[] = [
  { name: 'BA_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'BA_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'BA_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', defaultValue: null },
  { name: 'BA_LANGUAGE', type: 'string', required: false, mapsTo: 'language', missingIn: PRE5, defaultValue: 'US' },
  { name: 'BA_DEVELOPER_KEY', type: 'string', required: false, mapsTo: 'developerKey', missingIn: PRE5, defaultValue: null },
  { name: 'BA_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'BA_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'BA_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', defaultValue: null },
  { name: 'BA_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', defaultValue: null },
];

const OBJ_COLUMNS: ColumnSpec[] = [
  { name: 'OBJ_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'BA_ID', type: 'number', required: false, mapsTo: 'businessAreaId', defaultValue: null },
  { name: 'OBJ_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'OBJ_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
  { name: 'OBJ_TYPE', type: 'string', required: true, mapsTo: 'folderType' },
  { name: 'OBJ_TABLE_NAME', type: 'string', required: false, mapsTo: 'tableName', defaultValue: null },
  { name: 'OBJ_TABLE_OWNER', type: 'string', required: false, mapsTo: 'tableOwner', defaultValue: null },
  { name: 'OBJ_SEQUENCE', type: 'number', required: false, mapsTo: 'sequence', defaultValue: null },
  { name: 'OBJ_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'OBJ_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'OBJ_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', missingIn: PRE5, fallbackColumn: 'OBJ_CREATED_BY' },
  { name: 'OBJ_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', missingIn: PRE5, fallbackColumn: 'OBJ_CREATED_DATE' },
];

const EXP_COLUMNS: ColumnSpec[] = [
  { name: 'EXP_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'OBJ_ID', type: 'number', required: false, mapsTo: 'folderId', defaultValue: null },
  { name: 'EXP_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'EXP_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
  { name: 'EXP_TYPE', type: 'string', required: true, mapsTo: 'expType' },
  { name: 'EXP_FORMULA', type: 'string', required: false, mapsTo: 'formula', defaultValue: null },
  { name: 'EXP_COL_NAME', type: 'string', required: false, mapsTo: 'columnName', defaultValue: null },
  { name: 'EXP_DATA_TYPE', type: 'string', required: false, mapsTo: 'dataType', defaultValue: null },
  { name: 'EXP_FORMAT_MASK', type: 'string', required: false, mapsTo: 'formatMask', defaultValue: null },
  { name: 'EXP_AGGR_FUNC', type: 'string', required: false, mapsTo: 'aggregation', defaultValue: null },
  { name: 'EXP_SEQUENCE', type: 'number', required: false, mapsTo: 'sequence', defaultValue: null },
  { name: 'EXP_NULLS_ALLOWED', type: 'boolean', required: false, mapsTo: 'nullsAllowed', missingIn: PRE5, defaultValue: true },
  { name: 'IT_EXP_ID', type: 'number', required: false, mapsTo: 'parentItemId', missingIn: PRE5, defaultValue: null },
  { name: 'EXP_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'EXP_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'EXP_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', missingIn: PRE5, fallbackColumn: 'EXP_CREATED_BY' },
  { name: 'EXP_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', missingIn: PRE5, fallbackColumn: 'EXP_CREATED_DATE' },
];

const JOIN_COLUMNS: ColumnSpec[] = [
  { name: 'JOI_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'JOI_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'JOI_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
  { name: 'JOI_TYPE', type: 'string', required: false, mapsTo: 'joinType', defaultValue: 'INNER' },
  { name: 'JOI_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'JOI_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
];

const JOI_COMP_COLUMNS: ColumnSpec[] = [
  { name: 'JOI_ID', type: 'number', required: true, mapsTo: 'joinId' },
  { name: 'EXP_ID_1', type: 'number', required: true, mapsTo: 'masterItemId' },
  { name: 'EXP_ID_2', type: 'number', required: true, mapsTo: 'detailItemId' },
  { name: 'JOI_OP', type: 'string', required: false, mapsTo: 'operator', defaultValue: '=' },
];

const HIER_COLUMNS: ColumnSpec[] = [
  { name: 'HIER_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'BA_ID', type: 'number', required: false, mapsTo: 'businessAreaId', defaultValue: null },
  { name: 'HIER_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'HIER_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
  { name: 'HIER_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'HIER_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'HIER_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', missingIn: PRE5, fallbackColumn: 'HIER_CREATED_BY' },
  { name: 'HIER_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', missingIn: PRE5, fallbackColumn: 'HIER_CREATED_DATE' },
];

const HIER_LEVEL_COLUMNS: ColumnSpec[] = [
  { name: 'HIER_LEVEL_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'HIER_ID', type: 'number', required: true, mapsTo: 'hierarchyId' },
  { name: 'ITEM_ID', type: 'number', required: false, mapsTo: 'itemId', defaultValue: null },
  { name: 'HIER_LEVEL_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'HIER_LEVEL_NUM', type: 'number', required: false, mapsTo: 'levelNumber', defaultValue: null },
];

const DOC_COLUMNS: ColumnSpec[] = [
  { name: 'DOC_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'DOC_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'DOC_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
  { name: 'DOC_CONTENT', type: 'clob', required: false, mapsTo: 'content', defaultValue: null },
  { name: 'DOC_WORKBOOK_OWNER', type: 'string', required: false, mapsTo: 'owner', missingIn: PRE5, fallbackColumn: 'DOC_CREATED_BY' },
  { name: 'DOC_DEVELOPER_KEY', type: 'string', required: false, mapsTo: 'developerKey', missingIn: PRE5, defaultValue: null },
  { name: 'DOC_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'DOC_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
  { name: 'DOC_UPDATED_BY', type: 'string', required: false, mapsTo: 'updatedBy', defaultValue: null },
  { name: 'DOC_UPDATED_DATE', type: 'date', required: false, mapsTo: 'updatedAt', defaultValue: null },
];

/**
 * EUL*_FUNCTIONS columns are not documented in the reference beyond the
 * table's existence — only the conservatively safe columns are mapped.
 */
const FUN_COLUMNS: ColumnSpec[] = [
  { name: 'FUN_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'FUN_NAME', type: 'string', required: true, mapsTo: 'name' },
  { name: 'FUN_DESCRIPTION', type: 'string', required: false, mapsTo: 'description', missingIn: PRE5, defaultValue: null },
];

/** ELEM_ACCESS has the same shape in every version (reference §2). */
const GRANT_COLUMNS: ColumnSpec[] = [
  { name: 'EA_ID', type: 'number', required: true, mapsTo: 'sourceId' },
  { name: 'BA_ID', type: 'number', required: false, mapsTo: 'businessAreaId', defaultValue: null },
  { name: 'OBJ_ID', type: 'number', required: false, mapsTo: 'folderId', defaultValue: null },
  { name: 'EU_USERNAME', type: 'string', required: true, mapsTo: 'grantee' },
  { name: 'EA_PRIV_TYPE', type: 'string', required: false, mapsTo: 'privType', defaultValue: null },
  { name: 'EA_CREATED_BY', type: 'string', required: false, mapsTo: 'createdBy', defaultValue: null },
  { name: 'EA_CREATED_DATE', type: 'date', required: false, mapsTo: 'createdAt', defaultValue: null },
];

/**
 * Users are derived from distinct ELEM_ACCESS grantees in every version.
 * EUL3/EUL4 do have a USERS table, but its columns are undocumented and the
 * grantee list is the part a migration actually needs.
 */
const USER_COLUMNS: ColumnSpec[] = [
  { name: 'EU_USERNAME', type: 'string', required: true, mapsTo: 'username' },
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

  return {
    version,
    getTableName,
    getQualifiedTableName: (baseName) =>
      version.owner
        ? `${assertSafeIdentifier(version.owner)}.${getTableName(baseName)}`
        : getTableName(baseName),
    hasTable: (baseName) =>
      // An empty tableNames list (e.g. a hand-built EulVersionInfo in tests
      // or a config file) means "unknown" — assume present rather than
      // silently skipping entities.
      tableSet.size === 0 || tableSet.has(getTableName(baseName)),

    getBusinessAreaColumns: () => toMappings(BA_COLUMNS, version.version),
    getFolderColumns: () => toMappings(OBJ_COLUMNS, version.version),
    getExpressionColumns: () => toMappings(EXP_COLUMNS, version.version),
    getJoinColumns: () => toMappings(JOIN_COLUMNS, version.version),
    getJoinComponentColumns: () => toMappings(JOI_COMP_COLUMNS, version.version),
    getHierarchyColumns: () => toMappings(HIER_COLUMNS, version.version),
    getHierarchyLevelColumns: () => toMappings(HIER_LEVEL_COLUMNS, version.version),
    getDocumentColumns: () => toMappings(DOC_COLUMNS, version.version),
    getFunctionColumns: () => toMappings(FUN_COLUMNS, version.version),
    getUserColumns: () => toMappings(USER_COLUMNS, version.version),
    getGrantColumns: () => toMappings(GRANT_COLUMNS, version.version),

    supportsMultiLanguage: () => features.multiLanguage,
    supportsDerivedFolders: () => features.derivedFolders,
    supportsSummaryFolders: () => features.summaryFolders,
    hasSeparateHierarchyLevelsTable: () => features.separateHierarchyLevelsTable,
    hasSecurityManagerInExpressions: () => features.securityManagerInExpressions,
    hasRoleBasedGrants: () =>
      // EUL4 only sometimes has the role tables — trust what detection saw.
      features.roleBasedGrants ||
      tableSet.has(`${version.prefix}BA_ROLES`),
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
  const rows = await readEntity(execute, adapter, 'BA', adapter.getBusinessAreaColumns(), {
    orderBy: 'BA_NAME',
  });
  return rows as unknown as BusinessArea[];
}

export async function readFolders(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Folder[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'OBJS', adapter.getFolderColumns(), {
    orderBy: 'OBJ_NAME',
  });
  return rows as unknown as Folder[];
}

/** Item-like EXP_TYPEs read by default (plain and calculated items). */
export const DEFAULT_ITEM_EXP_TYPES: readonly string[] = ['CI', 'CU'];

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
  const rows = await readEntity(execute, adapter, 'EXPRESSIONS', adapter.getExpressionColumns(), {
    where: `EXP_TYPE IN (${placeholders.join(', ')})`,
    binds,
    orderBy: 'OBJ_ID, EXP_SEQUENCE',
  });
  return rows as unknown as Item[];
}

/** EUL4's single OUTER join type normalizes to LEFT (reference §3.4). */
function normalizeJoinType(joinType: unknown): string {
  const t = dbString(joinType ?? 'INNER').toUpperCase();
  return t === 'OUTER' ? 'LEFT' : t;
}

export async function readJoins(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Join[]> {
  const execute = resolveExecutor(source);
  const joins = await readEntity(execute, adapter, 'JOINS', adapter.getJoinColumns(), {
    orderBy: 'JOI_NAME',
  });
  const comps = await readEntity(
    execute,
    adapter,
    'JOI_COMP',
    adapter.getJoinComponentColumns(),
  );

  const byJoin = new Map<number, JoinComponent[]>();
  for (const comp of comps) {
    const joinId = comp.joinId as number;
    const list = byJoin.get(joinId) ?? [];
    list.push({
      masterItemId: comp.masterItemId as number,
      detailItemId: comp.detailItemId as number,
      operator: (comp.operator as string | null) ?? '=',
    });
    byJoin.set(joinId, list);
  }

  return joins.map((join) => ({
    ...(join as unknown as Join),
    joinType: normalizeJoinType(join.joinType),
    components: byJoin.get(join.sourceId as number) ?? [],
  }));
}

export async function readHierarchies(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Hierarchy[]> {
  const execute = resolveExecutor(source);
  const hierarchies = (await readEntity(
    execute,
    adapter,
    'HIERARCHIES',
    adapter.getHierarchyColumns(),
    { orderBy: 'HIER_NAME' },
  )) as unknown as Hierarchy[];

  let levels: HierarchyLevel[] = [];
  try {
    levels = (await readEntity(
      execute,
      adapter,
      'HIER_LEVELS',
      adapter.getHierarchyLevelColumns(),
      { orderBy: 'HIER_ID, HIER_LEVEL_NUM' },
    )) as unknown as HierarchyLevel[];
  } catch (err) {
    if (!(err instanceof EulReadError) || !isTableNotFoundError(err.cause)) throw err;
    // Levels table missing entirely — fall through to the EUL5 fallback.
  }

  // EUL5 fallback (reference §3.6): when the levels table is empty, levels
  // are encoded as EXP_TYPE='HI' expressions whose IT_EXP_ID points at the
  // underlying item. Expressions carry no hierarchy id, so attributed
  // attachment is only possible when there is exactly one hierarchy.
  if (levels.length === 0 && adapter.version.version === 'EUL5' && hierarchies.length > 0) {
    const hiRows = await readItems(adapter, execute, { expTypes: ['HI'] });
    if (hiRows.length > 0) {
      const fallbackLevels: HierarchyLevel[] = hiRows.map((row) => ({
        sourceId: row.sourceId,
        hierarchyId: hierarchies.length === 1 ? (hierarchies[0]?.sourceId ?? null) : null,
        itemId: row.parentItemId,
        name: row.name,
        levelNumber: row.sequence,
      }));
      levels = fallbackLevels;
    }
  }

  const byHierarchy = new Map<number, HierarchyLevel[]>();
  for (const level of levels) {
    if (level.hierarchyId === null) continue;
    const list = byHierarchy.get(level.hierarchyId) ?? [];
    list.push(level);
    byHierarchy.set(level.hierarchyId, list);
  }

  return hierarchies.map((h) => ({
    ...h,
    levels: byHierarchy.get(h.sourceId) ?? [],
  }));
}

export async function readCustomFunctions(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<CustomFunction[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'FUNCTIONS', adapter.getFunctionColumns(), {
    orderBy: 'FUN_NAME',
  });
  return rows as unknown as CustomFunction[];
}

export async function readWorkbooks(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Workbook[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'DOCUMENTS', adapter.getDocumentColumns(), {
    orderBy: 'DOC_NAME',
  });
  return rows as unknown as Workbook[];
}

export async function readGrants(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<Grant[]> {
  const execute = resolveExecutor(source);
  const rows = await readEntity(execute, adapter, 'ELEM_ACCESS', adapter.getGrantColumns(), {
    orderBy: 'EU_USERNAME',
  });
  return rows.map((row) => ({
    ...(row as unknown as Grant),
    level: row.businessAreaId !== null ? 'BUSINESS_AREA' : 'FOLDER',
  }));
}

export async function readUsers(
  adapter: EulSchemaAdapter,
  source: EulSource,
): Promise<EulUser[]> {
  const execute = resolveExecutor(source);
  const table = adapter.getQualifiedTableName('ELEM_ACCESS');
  const sql = `SELECT DISTINCT EU_USERNAME FROM ${table} WHERE EU_USERNAME IS NOT NULL ORDER BY EU_USERNAME`;
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await execute(sql);
  } catch (err) {
    throw new EulReadError(
      `Failed to read users from ${table}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err,
    );
  }
  return rows.map((row) => ({
    username: dbString(row.EU_USERNAME),
    source: 'ELEM_ACCESS' as const,
  }));
}
