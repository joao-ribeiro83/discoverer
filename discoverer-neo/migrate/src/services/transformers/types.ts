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
export type NeoJoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export type NeoFunctionType = 'SQL' | 'PLSQL' | 'PACKAGE';
export type NeoMapType = 'TABLE' | 'CROSSTAB' | 'PAGE_DETAIL' | 'CHART';
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

/**
 * Join type → Neo join_type. The reader already normalizes EUL4's single
 * `OUTER` to `LEFT` (reference §3.4); the explicit `OUTER` key here is
 * belt-and-braces for a raw value that somehow reaches the transformer.
 */
export const JOIN_TYPE_MAP: Record<string, NeoJoinType> = {
  INNER: 'INNER',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  FULL: 'FULL',
  OUTER: 'LEFT',
};

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
  businessAreaSourceId: number | null;
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

export interface TransformedJoinComponent {
  leftItemSourceId: number;
  rightItemSourceId: number;
  operator: string;
}

export interface TransformedJoin {
  sourceId: number;
  name: string;
  joinType: NeoJoinType;
  isActive: boolean;
  createdAt: Date | null;
  components: TransformedJoinComponent[];
  warnings: TransformWarning[];
}

export interface TransformedHierarchyLevel {
  sourceId: number;
  itemSourceId: number | null;
  levelName: string;
  levelNumber: number;
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

export interface TransformedMapItem {
  itemSourceId: number | null;
  displayName: string | null;
  displayOrder: number;
}

export interface TransformedWorkbook {
  sourceId: number;
  name: string;
  description: string | null;
  mapType: NeoMapType;
  ownerUsername: string | null;
  isPublic: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Worksheet count from the parsed DOC_CONTENT (0 when unparsable). */
  worksheetCount: number;
  /** Best-effort resolved column references; empty for proprietary blobs. */
  items: TransformedMapItem[];
  warnings: TransformWarning[];
}

export interface TransformedUser {
  /** Source key (ELEM_ACCESS grantee username). */
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  role: NeoUserRole;
  warnings: TransformWarning[];
}

export interface TransformedGrant {
  sourceId: number;
  granteeUsername: string;
  businessAreaSourceId: number | null;
  folderSourceId: number | null;
  level: 'BUSINESS_AREA' | 'FOLDER';
  permissionLevel: NeoPermissionLevel;
  warnings: TransformWarning[];
  /** True when the grant can't be represented (no BA/folder reference). */
  skip: boolean;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/**
 * Placeholder password hash for migrated users. It is not a valid bcrypt hash,
 * so it can never match any supplied password — migrated accounts are
 * effectively login-disabled until an admin resets the password.
 */
export const MIGRATED_USER_PASSWORD_HASH = '!migrated-no-login';

/** Normalize an aggregation function: EUL 'NONE'/'' means "no aggregation". */
export function normalizeAggregation(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toUpperCase() === 'NONE') return null;
  return trimmed;
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
