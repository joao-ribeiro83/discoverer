/**
 * Pure EUL → Discoverer Neo entity transformers.
 *
 * Each function maps one normalized EUL entity (from `eul-reader`) to a
 * `Transformed*` value carrying the Neo column values plus the *source*
 * foreign-key references the migration runner resolves to UUIDs. All lossy or
 * version-specific mapping decisions are made here and surfaced as warnings.
 */

import type {
  BusinessArea,
  CustomFunction,
  EulUser,
  EulVersion,
  Folder,
  Grant,
  Hierarchy,
  Item,
  Join,
} from '../../types/eul-versions.js';
import type { ParsedWorkbook } from '../eul-reader.js';
import {
  clamp,
  DEFAULT_GRANT_PERMISSION,
  folderTypeMapFor,
  GRANT_PERMISSION_MAP,
  ITEM_TYPE_MAP,
  JOIN_TYPE_MAP,
  MIGRATED_USER_PASSWORD_HASH,
  NEO_FOLDER_TYPES,
  normalizeAggregation,
  type NeoFolderType,
  type NeoItemType,
  type NeoJoinType,
  type TransformedBusinessArea,
  type TransformedCustomFunction,
  type TransformedFolder,
  type TransformedGrant,
  type TransformedHierarchy,
  type TransformedHierarchyLevel,
  type TransformedItem,
  type TransformedJoin,
  type TransformedUser,
  type TransformedWorkbook,
  type TransformWarning,
} from './types.js';

const NAME_MAX = 255;

// ---------------------------------------------------------------------------
// Business area
// ---------------------------------------------------------------------------

export function transformBusinessArea(ba: BusinessArea, _version: EulVersion): TransformedBusinessArea {
  const warnings: TransformWarning[] = [];

  let name = (ba.name ?? '').trim();
  if (name === '') {
    name = `Business Area ${ba.sourceId}`;
    warnings.push({
      code: 'BA_MISSING_NAME',
      message: `Business area ${ba.sourceId} has no name; using "${name}".`,
      sourceId: ba.sourceId,
    });
  }

  // Neo has no columns for BA_LANGUAGE / BA_DEVELOPER_KEY (EUL5-only metadata);
  // they are dropped. Note the developer key so a reviewer can re-key if needed.
  if (ba.developerKey) {
    warnings.push({
      code: 'BA_DEVELOPER_KEY_DROPPED',
      message: `Business area "${name}" developer key "${ba.developerKey}" is not migrated (no Neo column).`,
      sourceId: ba.sourceId,
    });
  }

  return {
    sourceId: ba.sourceId,
    name: clamp(name, NAME_MAX),
    description: ba.description,
    isActive: true,
    createdByUsername: ba.createdBy,
    updatedByUsername: ba.updatedBy,
    createdAt: ba.createdAt,
    updatedAt: ba.updatedAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

function mapFolderType(
  raw: string,
  version: EulVersion,
  sourceId: number,
  warnings: TransformWarning[],
): NeoFolderType {
  const upper = (raw ?? '').toUpperCase();
  const versionMap = folderTypeMapFor(version);
  const mapped = versionMap[upper];
  if (mapped) return mapped;

  // A type Neo understands but that isn't documented for this EUL version
  // (e.g. DERIVED/SUMMARY in an EUL4 source): keep it, but flag the anomaly.
  if (NEO_FOLDER_TYPES.has(upper)) {
    warnings.push({
      code: 'FOLDER_TYPE_UNEXPECTED',
      message: `Folder ${sourceId} has type "${upper}", not a documented ${version} folder type; kept as-is.`,
      sourceId,
    });
    return upper as NeoFolderType;
  }

  warnings.push({
    code: 'FOLDER_TYPE_UNKNOWN',
    message: `Folder ${sourceId} has unrecognized type "${raw}"; mapped to COMPLEX.`,
    sourceId,
  });
  return 'COMPLEX';
}

export function transformFolder(folder: Folder, version: EulVersion): TransformedFolder {
  const warnings: TransformWarning[] = [];

  let name = (folder.name ?? '').trim();
  if (name === '') {
    name = `Folder ${folder.sourceId}`;
    warnings.push({
      code: 'FOLDER_MISSING_NAME',
      message: `Folder ${folder.sourceId} has no name; using "${name}".`,
      sourceId: folder.sourceId,
    });
  }

  const folderType = mapFolderType(folder.folderType, version, folder.sourceId, warnings);

  // Non-table folders (COMPLEX/DERIVED/JOIN/SUMMARY) have no backing table and
  // no SQL in EUL metadata — their definition has to be completed in Neo.
  if (folderType !== 'TABLE' && folderType !== 'VIEW' && !folder.tableName) {
    warnings.push({
      code: 'FOLDER_DEFINITION_INCOMPLETE',
      message: `Folder "${name}" is ${folderType} with no source table; its SQL/definition must be completed in Neo.`,
      sourceId: folder.sourceId,
    });
  }

  return {
    sourceId: folder.sourceId,
    businessAreaSourceId: folder.businessAreaId,
    name: clamp(name, NAME_MAX),
    description: folder.description,
    folderType,
    tableName: folder.tableName ? clamp(folder.tableName, NAME_MAX) : null,
    tableOwner: folder.tableOwner ? clamp(folder.tableOwner, NAME_MAX) : null,
    customSql: null,
    displayOrder: folder.sequence ?? 0,
    isActive: true,
    createdByUsername: folder.createdBy,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

export function transformItem(item: Item, _version: EulVersion): TransformedItem {
  const warnings: TransformWarning[] = [];
  const rawType = (item.expType ?? '').toUpperCase();
  const mappedType = ITEM_TYPE_MAP[rawType];

  const itemType: NeoItemType = mappedType ?? 'CI';
  let skip = false;
  if (!mappedType) {
    skip = true;
    if (rawType === 'SM') {
      warnings.push({
        code: 'ITEM_SECURITY_MANAGER',
        message: `Item ${item.sourceId} is a Security Manager condition (EXP_TYPE='SM'); migrate it to a Neo row-level security policy, not an item.`,
        sourceId: item.sourceId,
      });
    } else {
      warnings.push({
        code: 'ITEM_TYPE_UNKNOWN',
        message: `Item ${item.sourceId} has unrecognized EXP_TYPE "${item.expType}"; skipped.`,
        sourceId: item.sourceId,
      });
    }
  }

  let name = (item.name ?? '').trim();
  if (name === '' && !skip) {
    name = `Item ${item.sourceId}`;
    warnings.push({
      code: 'ITEM_MISSING_NAME',
      message: `Item ${item.sourceId} has no name; using "${name}".`,
      sourceId: item.sourceId,
    });
  }

  return {
    sourceId: item.sourceId,
    folderSourceId: item.folderId,
    name: clamp(name, NAME_MAX),
    description: item.description,
    itemType,
    columnName: item.columnName ? clamp(item.columnName, NAME_MAX) : null,
    formula: item.formula,
    dataType: item.dataType ? clamp(item.dataType, 64) : null,
    formatMask: item.formatMask ? clamp(item.formatMask, NAME_MAX) : null,
    aggFunction: normalizeAggregation(item.aggregation),
    displayOrder: item.sequence ?? 0,
    isHidden: false,
    isActive: true,
    parentItemSourceId: item.parentItemId,
    createdByUsername: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    warnings,
    skip,
  };
}

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

export function transformJoin(join: Join, _version: EulVersion): TransformedJoin {
  const warnings: TransformWarning[] = [];
  const rawType = (join.joinType ?? 'INNER').toUpperCase();
  const joinType: NeoJoinType = JOIN_TYPE_MAP[rawType] ?? 'INNER';
  if (!JOIN_TYPE_MAP[rawType]) {
    warnings.push({
      code: 'JOIN_TYPE_UNKNOWN',
      message: `Join ${join.sourceId} has unrecognized type "${join.joinType}"; defaulted to INNER.`,
      sourceId: join.sourceId,
    });
  }

  const components = join.components.map((c) => ({
    leftItemSourceId: c.masterItemId,
    rightItemSourceId: c.detailItemId,
    operator: c.operator,
  }));

  if (components.length === 0) {
    warnings.push({
      code: 'JOIN_NO_COMPONENTS',
      message: `Join "${join.name}" (${join.sourceId}) has no components and will be skipped.`,
      sourceId: join.sourceId,
    });
  }

  let name = (join.name ?? '').trim();
  if (name === '') name = `Join ${join.sourceId}`;

  return {
    sourceId: join.sourceId,
    name: clamp(name, NAME_MAX),
    joinType,
    isActive: true,
    createdAt: join.createdAt,
    components,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Hierarchy (+ levels)
// ---------------------------------------------------------------------------

export function transformHierarchy(hierarchy: Hierarchy, _version: EulVersion): TransformedHierarchy {
  const warnings: TransformWarning[] = [];

  const levels: TransformedHierarchyLevel[] = hierarchy.levels.map((lvl, idx) => {
    let levelName = (lvl.name ?? '').trim();
    if (levelName === '') levelName = `Level ${idx + 1}`;
    return {
      sourceId: lvl.sourceId,
      itemSourceId: lvl.itemId,
      levelName: clamp(levelName, NAME_MAX),
      levelNumber: lvl.levelNumber ?? idx + 1,
    };
  });

  const missingItemLevels = levels.filter((l) => l.itemSourceId === null).length;
  if (missingItemLevels > 0) {
    warnings.push({
      code: 'HIER_LEVEL_NO_ITEM',
      message: `Hierarchy "${hierarchy.name}" has ${missingItemLevels} level(s) with no item; those levels will be skipped (Neo requires an item per level).`,
      sourceId: hierarchy.sourceId,
    });
  }

  let name = (hierarchy.name ?? '').trim();
  if (name === '') name = `Hierarchy ${hierarchy.sourceId}`;

  return {
    sourceId: hierarchy.sourceId,
    businessAreaSourceId: hierarchy.businessAreaId,
    name: clamp(name, NAME_MAX),
    description: hierarchy.description,
    isActive: true,
    createdAt: hierarchy.createdAt,
    updatedAt: hierarchy.updatedAt,
    levels,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Custom function
// ---------------------------------------------------------------------------

export function transformCustomFunction(
  fn: CustomFunction,
  _version: EulVersion,
): TransformedCustomFunction {
  const warnings: TransformWarning[] = [];
  let name = (fn.name ?? '').trim();
  if (name === '') name = `Function ${fn.sourceId}`;

  // EUL FUNCTIONS metadata carries no argument list or return type in the
  // normalized read, so these default and should be reviewed post-migration.
  warnings.push({
    code: 'FUNCTION_SIGNATURE_DEFAULTED',
    message: `Custom function "${name}" migrated as PL/SQL with no parameters/return type; complete its signature in Neo.`,
    sourceId: fn.sourceId,
  });

  return {
    sourceId: fn.sourceId,
    name: clamp(name, NAME_MAX),
    description: fn.description,
    functionType: 'PLSQL',
    returnType: null,
    parameters: null,
    isActive: true,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Workbook → map (+ map_items)
// ---------------------------------------------------------------------------

export function transformWorkbook(workbook: ParsedWorkbook, _version: EulVersion): TransformedWorkbook {
  const warnings: TransformWarning[] = [];
  const info = workbook.info;

  let name = (workbook.name ?? '').trim();
  if (name === '') name = `Workbook ${workbook.sourceId}`;

  // DOC_CONTENT is a proprietary Discoverer blob. The reader best-effort-parses
  // it for worksheet/column counts, but those references cannot be resolved to
  // specific migrated items, so map_items can't be reconstructed automatically.
  if (info.parsed) {
    warnings.push({
      code: 'WORKBOOK_LAYOUT_MANUAL',
      message: `Workbook "${name}" migrates as an empty ${
        'TABLE'
      } map; its ${info.worksheetCount} worksheet(s) and column layout must be rebuilt in Neo.`,
      sourceId: workbook.sourceId,
    });
  } else if (workbook.content !== null && workbook.content.trim() !== '') {
    warnings.push({
      code: 'WORKBOOK_UNPARSED',
      message: `Workbook "${name}" DOC_CONTENT could not be parsed; it migrates as an empty map and must be rebuilt manually.`,
      sourceId: workbook.sourceId,
    });
  }

  return {
    sourceId: workbook.sourceId,
    name: clamp(name, NAME_MAX),
    description: workbook.description,
    mapType: 'TABLE',
    ownerUsername: workbook.owner ?? workbook.createdBy,
    isPublic: false,
    createdAt: workbook.createdAt,
    updatedAt: workbook.updatedAt,
    worksheetCount: info.worksheetCount,
    items: [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** Turn an Oracle username into a safe email local-part. */
export function usernameToEmailLocal(username: string): string {
  const local = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  return local === '' ? 'user' : local;
}

export const MIGRATED_EMAIL_DOMAIN = 'migrated.local';

export function transformUser(user: EulUser, _version: EulVersion): TransformedUser {
  const warnings: TransformWarning[] = [];
  const username = user.username.trim();
  const local = usernameToEmailLocal(username);
  const email = `${local}@${MIGRATED_EMAIL_DOMAIN}`;

  if (local !== username.toLowerCase()) {
    warnings.push({
      code: 'USER_EMAIL_SYNTHESIZED',
      message: `User "${username}" has no email; synthesized "${email}".`,
    });
  }

  return {
    username,
    email: clamp(email, NAME_MAX),
    name: clamp(username, NAME_MAX),
    passwordHash: MIGRATED_USER_PASSWORD_HASH,
    role: 'USER',
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Grant
// ---------------------------------------------------------------------------

export function transformGrant(grant: Grant, _version: EulVersion): TransformedGrant {
  const warnings: TransformWarning[] = [];
  const privType = (grant.privType ?? '').toUpperCase();
  const permissionLevel = GRANT_PERMISSION_MAP[privType] ?? DEFAULT_GRANT_PERMISSION;

  // Neo only models business-area-level grants. A FOLDER/OBJECT grant is
  // migrated as a grant on the folder's owning business area (resolved by the
  // runner); if it references neither a BA nor a folder, it can't be migrated.
  let skip = false;
  if (grant.level === 'BUSINESS_AREA' && grant.businessAreaId === null) {
    skip = true;
    warnings.push({
      code: 'GRANT_NO_BA',
      message: `Grant ${grant.sourceId} for "${grant.grantee}" has no business area; skipped.`,
      sourceId: grant.sourceId,
    });
  } else if (grant.level === 'FOLDER' && grant.folderId === null) {
    skip = true;
    warnings.push({
      code: 'GRANT_NO_FOLDER',
      message: `Folder-level grant ${grant.sourceId} for "${grant.grantee}" has no folder; skipped.`,
      sourceId: grant.sourceId,
    });
  }

  return {
    sourceId: grant.sourceId,
    granteeUsername: grant.grantee,
    businessAreaSourceId: grant.businessAreaId,
    folderSourceId: grant.folderId,
    level: grant.level,
    permissionLevel,
    warnings,
    skip,
  };
}

// ---------------------------------------------------------------------------
// Plural convenience wrappers (match the session-plan signatures)
// ---------------------------------------------------------------------------

export function transformUsers(users: EulUser[], version: EulVersion): TransformedUser[] {
  return users.map((u) => transformUser(u, version));
}

export function transformGrants(grants: Grant[], version: EulVersion): TransformedGrant[] {
  return grants.map((g) => transformGrant(g, version));
}
