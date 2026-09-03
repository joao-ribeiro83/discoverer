import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  folderBusinessAreas,
  folders,
  items,
  type Folder,
  type NewFolder,
} from '../db/schema.js';
import { introspectSchema, testTableExists, type IntrospectedTable } from './oracle-introspection.js';
import type { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FolderType = 'TABLE' | 'VIEW' | 'DERIVED' | 'COMPLEX' | 'JOIN' | 'SUMMARY';

export interface CreateFolderInput {
  businessAreaId: string;
  name: string;
  description?: string | null;
  folderType: FolderType;
  tableName?: string | null;
  tableOwner?: string | null;
  customSql?: string | null;
  dataSourceId?: string | null;
  displayOrder?: number;
  createdBy?: string | null;
}

export interface UpdateFolderInput {
  name?: string;
  description?: string | null;
  folderType?: FolderType;
  tableName?: string | null;
  tableOwner?: string | null;
  customSql?: string | null;
  dataSourceId?: string | null;
  displayOrder?: number;
}

export interface FolderWithDataSource extends Folder {
  dataSourceName: string | null;
}

// ---------------------------------------------------------------------------
// SQL validation for COMPLEX folders
// ---------------------------------------------------------------------------

const FORBIDDEN_SQL_PATTERNS = [
  /\bDROP\s+/i,
  /\bCREATE\s+/i,
  /\bALTER\s+/i,
  /\bTRUNCATE\s+/i,
  /\bINSERT\s+/i,
  /\bUPDATE\s+/i,
  /\bDELETE\s+/i,
  /\bMERGE\s+/i,
  /\bGRANT\s+/i,
  /\bREVOKE\s+/i,
  /\bEXEC\b/i,
  /\bEXECUTE\s+IMMEDIATE/i,
  /\bDBMS_/i,
];

/**
 * Basic SQL validation for COMPLEX folder custom SQL.
 * Returns an error message if the SQL contains forbidden patterns, or null if valid.
 */
export function validateCustomSql(sql: string): { valid: boolean; error?: string } {
  if (!sql || sql.trim().length === 0) {
    return { valid: false, error: 'SQL cannot be empty' };
  }

  // Check for forbidden DDL/DML patterns
  for (const pattern of FORBIDDEN_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      return {
        valid: false,
        error: `SQL contains forbidden pattern: ${pattern.source}. Only SELECT statements are allowed.`,
      };
    }
  }

  // Must start with SELECT or WITH (CTE)
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    return {
      valid: false,
      error: 'SQL must begin with SELECT or WITH (Common Table Expression)',
    };
  }

  // Check for unterminated string literals or basic syntax issues
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return {
      valid: false,
      error: 'SQL has mismatched parentheses',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a folder. For TABLE/VIEW types, validates the table exists via introspection.
 */
export async function create(
  data: CreateFolderInput,
  redis?: Redis,
): Promise<Folder> {
  // Validate table exists for TABLE/VIEW folders
  if (
    (data.folderType === 'TABLE' || data.folderType === 'VIEW') &&
    data.dataSourceId &&
    data.tableName
  ) {
    const tableOwner = data.tableOwner ?? '';
    const qualifiedName = `${data.tableOwner ? `${data.tableOwner}.` : ''}${data.tableName}`;
    let exists: boolean;
    try {
      exists = await testTableExists(
        data.dataSourceId,
        data.tableName,
        tableOwner,
        redis!,
      );
    } catch (err) {
      // Introspection failures (driver missing, connection refused, ...)
      // are a client-resolvable condition, not a server fault.
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Table "${qualifiedName}" does not exist or is not accessible (${reason})`,
      );
    }
    if (!exists) {
      throw new Error(
        `Table "${qualifiedName}" does not exist or is not accessible`,
      );
    }
  }

  // Validate custom SQL for COMPLEX folders
  if (data.folderType === 'COMPLEX') {
    if (!data.customSql || data.customSql.trim().length === 0) {
      throw new Error(
        'Invalid custom SQL: SQL cannot be empty for COMPLEX folders',
      );
    }
    const validation = validateCustomSql(data.customSql);
    if (!validation.valid) {
      throw new Error(`Invalid custom SQL: ${validation.error}`);
    }
  }

  const values: NewFolder = {
    businessAreaId: data.businessAreaId,
    name: data.name,
    description: data.description ?? null,
    folderType: data.folderType,
    tableName: data.tableName ?? null,
    tableOwner: data.tableOwner ?? null,
    customSql: data.customSql ?? null,
    dataSourceId: data.dataSourceId ?? null,
    displayOrder: data.displayOrder ?? 0,
    createdBy: data.createdBy ?? null,
  };

  const [row] = await db.insert(folders).values(values).returning();
  return row as Folder;
}

/**
 * Update a folder.
 */
export async function update(
  id: string,
  data: UpdateFolderInput,
): Promise<Folder | null> {
  const values: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  // Remove fields that shouldn't be overwritten
  delete values.id;
  delete values.createdAt;
  delete values.createdBy;
  delete values.businessAreaId;

  const [row] = await db
    .update(folders)
    .set(values)
    .where(eq(folders.id, id))
    .returning();

  return row ?? null;
}

/**
 * Get a folder by ID with data source info.
 */
export async function getById(id: string): Promise<FolderWithDataSource | null> {
  const [row] = await db
    .select({
      id: folders.id,
      businessAreaId: folders.businessAreaId,
      name: folders.name,
      description: folders.description,
      folderType: folders.folderType,
      tableName: folders.tableName,
      tableOwner: folders.tableOwner,
      customSql: folders.customSql,
      dataSourceId: folders.dataSourceId,
      displayOrder: folders.displayOrder,
      isActive: folders.isActive,
      createdBy: folders.createdBy,
      createdAt: folders.createdAt,
      updatedAt: folders.updatedAt,
    })
    .from(folders)
    .where(eq(folders.id, id))
    .limit(1);

  if (!row) return null;

  // Fetch data source name separately
  let dataSourceName: string | null = null;
  if (row.dataSourceId) {
    const { dataSources } = await import('../db/schema.js');
    const [ds] = await db
      .select({ name: dataSources.name })
      .from(dataSources)
      .where(eq(dataSources.id, row.dataSourceId))
      .limit(1);
    dataSourceName = ds?.name ?? null;
  }

  return { ...row, dataSourceName };
}

/** A folder as seen from one business area: owned there, or shared into it. */
export type FolderInBusinessArea = Folder & { isShared: boolean };

/**
 * List folders in a business area (active only).
 *
 * A folder belongs to its owning business area (`folders.business_area_id`)
 * AND to any it has been shared into (`folder_business_areas`) — Discoverer
 * models this as many-to-many via `BA_OBJ_LINKS`, and sharing a common
 * dimension folder across areas is ordinary practice. Both sides are returned
 * here so a shared folder is visible everywhere it belongs; `isShared` says
 * which is which.
 */
export async function listByBusinessArea(
  businessAreaId: string,
): Promise<FolderInBusinessArea[]> {
  const owned = await db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.businessAreaId, businessAreaId),
        eq(folders.isActive, true),
      ),
    );

  const shared = await db
    .select({ folder: folders })
    .from(folderBusinessAreas)
    .innerJoin(folders, eq(folders.id, folderBusinessAreas.folderId))
    .where(
      and(
        eq(folderBusinessAreas.businessAreaId, businessAreaId),
        eq(folders.isActive, true),
      ),
    );

  const rows: FolderInBusinessArea[] = [
    ...owned.map((f) => ({ ...f, isShared: false })),
    ...shared.map((r) => ({ ...r.folder, isShared: true })),
  ];

  // Sorted in JS rather than SQL: the two sides are separate queries, and a
  // UNION would lose the isShared flag without extra plumbing.
  rows.sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  return rows;
}

/**
 * Share an existing folder into an additional business area.
 *
 * Rejects the folder's owning area — that membership already exists on
 * `folders.business_area_id`, and duplicating it would make the folder appear
 * twice in every listing.
 */
export async function shareWithBusinessArea(
  folderId: string,
  businessAreaId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [folder] = await db
    .select()
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);
  if (!folder) return { ok: false, reason: 'Folder not found' };
  if (folder.businessAreaId === businessAreaId) {
    return { ok: false, reason: 'Folder already belongs to this business area' };
  }

  await db
    .insert(folderBusinessAreas)
    .values({ folderId, businessAreaId })
    .onConflictDoNothing();
  return { ok: true };
}

/** Remove a share. The owning business area cannot be unshared. */
export async function unshareWithBusinessArea(
  folderId: string,
  businessAreaId: string,
): Promise<void> {
  await db
    .delete(folderBusinessAreas)
    .where(
      and(
        eq(folderBusinessAreas.folderId, folderId),
        eq(folderBusinessAreas.businessAreaId, businessAreaId),
      ),
    );
}

/** Business areas a folder is shared into, excluding its owning one. */
export async function listSharedBusinessAreas(folderId: string): Promise<string[]> {
  const rows = await db
    .select({ businessAreaId: folderBusinessAreas.businessAreaId })
    .from(folderBusinessAreas)
    .where(eq(folderBusinessAreas.folderId, folderId));
  return rows.map((r) => r.businessAreaId);
}

/**
 * List folders using a specific data source.
 */
export async function listByDataSource(dataSourceId: string): Promise<Folder[]> {
  const rows = await db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.dataSourceId, dataSourceId),
        eq(folders.isActive, true),
      ),
    )
    .orderBy(folders.name);

  return rows;
}

/**
 * Soft-delete a folder (set isActive = false).
 */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(folders)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(folders.id, id))
    .returning({ id: folders.id });

  return !!row;
}

// ---------------------------------------------------------------------------
// Oracle import
// ---------------------------------------------------------------------------

export interface ImportResult {
  created: Array<{ folderId: string; name: string; tableName: string }>;
  skipped: Array<{ tableName: string; reason: string }>;
}

/**
 * Auto-create folders from Oracle table introspection.
 * For each table, creates a TABLE folder with items auto-discovered from columns.
 */
export async function importFromOracle(
  dataSourceId: string,
  tableNames: string[],
  tableOwner: string,
  businessAreaId: string,
  createdBy: string,
  redis: Redis,
): Promise<ImportResult> {
  // Get full introspection data (uses cache)
  const allTables = await introspectSchema(dataSourceId, redis);

  const result: ImportResult = { created: [], skipped: [] };

  for (const requestedName of tableNames) {
    const tableData = allTables.find(
      (t) => t.tableName.toUpperCase() === requestedName.toUpperCase(),
    );

    if (!tableData) {
      result.skipped.push({
        tableName: requestedName,
        reason: 'Table not found or not accessible in the data source',
      });
      continue;
    }

    // Check if a folder already exists for this table in this business area
    const [existing] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.businessAreaId, businessAreaId),
          eq(folders.tableName, tableData.tableName),
          eq(folders.tableOwner, tableData.tableOwner),
          eq(folders.isActive, true),
        ),
      )
      .limit(1);

    if (existing) {
      result.skipped.push({
        tableName: requestedName,
        reason: 'Folder already exists for this table',
      });
      continue;
    }

    // Create the folder
    const folderName = generateFolderName(tableData);
    const [folder] = await db
      .insert(folders)
      .values({
        businessAreaId,
        name: folderName,
        description: `Imported from Oracle table ${tableData.tableOwner}.${tableData.tableName}`,
        folderType: 'TABLE',
        tableName: tableData.tableName,
        tableOwner: tableData.tableOwner,
        dataSourceId,
        displayOrder: 0,
        createdBy,
      })
      .returning();

    // Auto-create items from columns
    const itemRows: Array<typeof items.$inferInsert> = tableData.columns.map(
      (col, idx) => ({
        folderId: folder!.id,
        name: col.columnName,
        description: `${col.dataType}${col.dataLength ? `(${col.dataLength})` : ''}`,
        itemType: 'CI',
        columnName: col.columnName,
        dataType: col.dataType,
        displayOrder: idx,
        isHidden: false,
        createdBy,
      }),
    );

    if (itemRows.length > 0) {
      await db.insert(items).values(itemRows);
    }

    result.created.push({
      folderId: folder!.id,
      name: folder!.name,
      tableName: tableData.tableName,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateFolderName(table: IntrospectedTable): string {
  // Convert table name to a human-readable folder name
  const base = table.tableName
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  // If there's an existing folder with the same name, append the owner
  return base;
}
