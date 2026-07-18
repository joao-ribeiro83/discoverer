/**
 * Type definitions and version constants for the EUL version detection and
 * schema adapter layer.
 *
 * Source of truth for the version differences encoded here:
 * `EUL_VERSION_REFERENCE.md` (repo root) — the authoritative EUL3/EUL4/EUL5
 * schema comparison — plus §8 of `oracle_discoverer_complete_reference.md`
 * for the full EUL5 column-level detail.
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

/** Base table names present in every EUL version. */
export const CORE_TABLES: readonly string[] = [
  'BA',
  'OBJS',
  'EXPRESSIONS',
  'JOINS',
  'JOI_COMP',
  'HIERARCHIES',
  'HIER_LEVELS',
  'SUMMARIES',
  'FUNCTIONS',
  'ELEM_ACCESS',
  'DOCUMENTS',
  'QPP_STATS',
  'EUL',
  'OPTIONS',
];

/** Base table names that exist only in EUL5. */
export const EUL5_ONLY_TABLES: readonly string[] = [
  'QPP_QUERY',
  'LOCK',
  'TRANSLATIONS',
];

/** Base table names that exist only in EUL3/EUL4 (absorbed into EUL5's security model). */
export const PRE_EUL5_ONLY_TABLES: readonly string[] = ['USERS', 'ROLES'];

/** Role-based grant tables — always in EUL5, only sometimes present in EUL4. */
export const ROLE_GRANT_TABLES: readonly string[] = [
  'BA_ROLES',
  'OBJ_ROLES',
  'APP_ROLES',
];

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

export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'clob';

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
  multiLanguage: boolean;
  derivedFolders: boolean;
  summaryFolders: boolean;
  /**
   * All three versions ship a HIER_LEVELS table; EUL5 additionally encodes
   * levels via EUL5_EXPRESSIONS.IT_EXP_ID (used as a fallback when the
   * levels table is empty — see EUL_VERSION_REFERENCE.md §3.6).
   */
  separateHierarchyLevelsTable: boolean;
  securityManagerInExpressions: boolean;
  roleBasedGrants: boolean;
}

export const VERSION_FEATURES: Record<EulVersion, EulFeatureFlags> = {
  EUL3: {
    multiLanguage: false,
    derivedFolders: false,
    summaryFolders: false,
    separateHierarchyLevelsTable: true,
    securityManagerInExpressions: false,
    roleBasedGrants: false,
  },
  EUL4: {
    multiLanguage: false,
    derivedFolders: false,
    summaryFolders: false,
    separateHierarchyLevelsTable: true,
    securityManagerInExpressions: false,
    roleBasedGrants: false, // upgraded to true when *_BA_ROLES is actually detected
  },
  EUL5: {
    multiLanguage: true,
    derivedFolders: true,
    summaryFolders: true,
    separateHierarchyLevelsTable: true,
    securityManagerInExpressions: true,
    roleBasedGrants: true,
  },
};

/** EXP_TYPE values valid per version (AG and SM are EUL5-only). */
export const EXP_TYPES_BY_VERSION: Record<EulVersion, readonly string[]> = {
  EUL3: ['CI', 'CU', 'CO', 'JI', 'HI', 'FU'],
  EUL4: ['CI', 'CU', 'CO', 'JI', 'HI', 'FU'],
  EUL5: ['CI', 'CU', 'CO', 'JI', 'HI', 'FU', 'AG', 'SM'],
};

/** Folder (OBJ_TYPE) values valid per version. */
export const FOLDER_TYPES_BY_VERSION: Record<EulVersion, readonly string[]> = {
  EUL3: ['TABLE', 'VIEW', 'COMPLEX', 'JOIN'],
  EUL4: ['TABLE', 'VIEW', 'COMPLEX', 'JOIN'],
  EUL5: ['TABLE', 'VIEW', 'COMPLEX', 'JOIN', 'DERIVED', 'SUMMARY'],
};

// ---------------------------------------------------------------------------
// Schema adapter interface
// ---------------------------------------------------------------------------

export interface EulSchemaAdapter {
  version: EulVersionInfo;

  /** e.g. 'BA' → 'EUL5_BA' / 'EUL4_BA' / 'EUL_BA'. */
  getTableName(baseName: string): string;
  /** Owner-qualified name for use in SQL, e.g. 'EUL5_US.EUL5_BA'. */
  getQualifiedTableName(baseName: string): string;
  /** Whether the given base table was actually found in the source DB. */
  hasTable(baseName: string): boolean;

  getBusinessAreaColumns(): ColumnMapping[];
  getFolderColumns(): ColumnMapping[];
  getExpressionColumns(): ColumnMapping[];
  getJoinColumns(): ColumnMapping[];
  getJoinComponentColumns(): ColumnMapping[];
  getHierarchyColumns(): ColumnMapping[];
  getHierarchyLevelColumns(): ColumnMapping[];
  getDocumentColumns(): ColumnMapping[];
  getFunctionColumns(): ColumnMapping[];
  getUserColumns(): ColumnMapping[];
  getGrantColumns(): ColumnMapping[];

  supportsMultiLanguage(): boolean;
  supportsDerivedFolders(): boolean;
  supportsSummaryFolders(): boolean;
  hasSeparateHierarchyLevelsTable(): boolean;
  hasSecurityManagerInExpressions(): boolean;
  hasRoleBasedGrants(): boolean;
}

// ---------------------------------------------------------------------------
// Normalized entities (version-independent read-function output)
// ---------------------------------------------------------------------------

export interface BusinessArea {
  sourceId: number;
  name: string;
  description: string | null;
  language: string;
  developerKey: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface Folder {
  sourceId: number;
  businessAreaId: number | null;
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

export interface JoinComponent {
  masterItemId: number;
  detailItemId: number;
  operator: string;
}

export interface Join {
  sourceId: number;
  name: string;
  description: string | null;
  /** Normalized: INNER | LEFT | RIGHT | FULL (EUL4's OUTER maps to LEFT). */
  joinType: string;
  components: JoinComponent[];
  createdBy: string | null;
  createdAt: Date | null;
}

export interface HierarchyLevel {
  sourceId: number;
  hierarchyId: number | null;
  itemId: number | null;
  name: string;
  levelNumber: number | null;
}

export interface Hierarchy {
  sourceId: number;
  businessAreaId: number | null;
  name: string;
  description: string | null;
  levels: HierarchyLevel[];
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
  /** Proprietary Discoverer workbook XML (from the LONG DOC_CONTENT column). */
  content: string | null;
  owner: string | null;
  developerKey: string | null;
  createdBy: string | null;
  createdAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export interface EulUser {
  /** Oracle DB username or role name. */
  username: string;
  /** Where the user was discovered (currently always ELEM_ACCESS grants). */
  source: 'ELEM_ACCESS';
}

export interface Grant {
  sourceId: number;
  businessAreaId: number | null;
  folderId: number | null;
  grantee: string;
  privType: string | null;
  /** Derived: BUSINESS_AREA when BA_ID is set, else FOLDER. */
  level: 'BUSINESS_AREA' | 'FOLDER';
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
