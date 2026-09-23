import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  folderBusinessAreas,
  folders,
  items,
  type Folder,
  type NewFolder,
} from '../db/schema.js';
import {
  describeObjects,
  introspectSchema,
  neoDataType,
  testTableExists,
  type IntrospectedTable,
} from './oracle-introspection.js';
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

/**
 * The one `custom_sql` gate for writes. Create and update both call it, so a
 * rule added here reaches both — SEC-04 was the update path having no gate at
 * all, which let a COMPLEX folder created with a clean SELECT be rewritten to
 * anything. Pass the folder's type and SQL as they will be *after* the write.
 */
export function assertValidFolderSql(
  folderType: string,
  customSql: string | null | undefined,
): void {
  if (folderType !== 'COMPLEX') return;
  if (!customSql || customSql.trim().length === 0) {
    throw new Error('Invalid custom SQL: SQL cannot be empty for COMPLEX folders');
  }
  const validation = validateCustomSql(customSql);
  if (!validation.valid) {
    throw new Error(`Invalid custom SQL: ${validation.error}`);
  }
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

  assertValidFolderSql(data.folderType, data.customSql);

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
  // Validate the folder as it will be after the write: a PUT may change only
  // the type, only the SQL, or both.
  if (data.folderType !== undefined || data.customSql !== undefined) {
    const [current] = await db
      .select({ folderType: folders.folderType, customSql: folders.customSql })
      .from(folders)
      .where(eq(folders.id, id))
      .limit(1);
    if (!current) return null;
    assertValidFolderSql(
      data.folderType ?? current.folderType,
      data.customSql !== undefined ? data.customSql : current.customSql,
    );
  }

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
 * Auto-create folders from Oracle introspection.
 * For each object, creates a TABLE or VIEW folder (whichever it is) with items
 * auto-discovered from its columns; a column comment becomes the item's description.
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

    // Create the folder and its items atomically — a failed items insert must
    // not leave a folder with no columns behind (BE-08).
    const folder = await db.transaction(async (tx) => {
      const [newFolder] = await tx
        .insert(folders)
        .values({
          businessAreaId,
          name: generateFolderName(tableData),
          description:
            tableData.comments ??
            `Imported from Oracle ${tableData.objectType.toLowerCase()} ${tableData.tableOwner}.${tableData.tableName}`,
          folderType: tableData.objectType,
          tableName: tableData.tableName,
          tableOwner: tableData.tableOwner,
          dataSourceId,
          displayOrder: 0,
          createdBy,
        })
        .returning();

      const itemRows: Array<typeof items.$inferInsert> = tableData.columns.map(
        (col, idx) => ({
          folderId: newFolder!.id,
          name: col.columnName,
          description: col.comments ?? `${col.dataType}${col.dataLength ? `(${col.dataLength})` : ''}`,
          itemType: 'CI',
          columnName: col.columnName,
          dataType: col.dataType,
          displayOrder: idx,
          isHidden: false,
          createdBy,
        }),
      );

      if (itemRows.length > 0) {
        await tx.insert(items).values(itemRows);
      }

      return newFolder!;
    });

    result.created.push({
      folderId: folder.id,
      name: folder.name,
      tableName: tableData.tableName,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Refresh from the data source
// ---------------------------------------------------------------------------

export interface RefreshResult {
  folderId: string;
  folderName: string;
  /** Columns new in the source, now items. */
  added: string[];
  /** Items whose data type changed, plus the folder itself if TABLE/VIEW flipped. */
  updated: string[];
  /** Items whose column is gone from the source. Reported, never deleted. */
  missing: string[];
  error: string | null;
}

/**
 * Re-read each folder's table or view from its data source and bring the
 * items in line: a new column becomes an item, a changed data type is updated.
 * A column that is gone is only reported — maps may still use its item, so
 * deleting it is the admin's call. Only TABLE/VIEW folders with a data source.
 */
export async function refreshFromSource(
  folderIds: string[],
  describe: typeof describeObjects = describeObjects,
): Promise<RefreshResult[]> {
  const rows =
    folderIds.length === 0
      ? []
      : await db
          .select()
          .from(folders)
          .where(and(inArray(folders.id, folderIds), eq(folders.isActive, true)));

  const results: RefreshResult[] = [];
  const byDataSource = new Map<string, Folder[]>();
  for (const folder of rows) {
    if ((folder.folderType !== 'TABLE' && folder.folderType !== 'VIEW') || !folder.tableName || !folder.dataSourceId) {
      results.push(emptyRefresh(folder, 'Folder is not based on a table or view of a data source'));
      continue;
    }
    byDataSource.set(folder.dataSourceId, [...(byDataSource.get(folder.dataSourceId) ?? []), folder]);
  }

  for (const [dataSourceId, list] of byDataSource) {
    let described: Array<IntrospectedTable | null>;
    try {
      described = await describe(
        dataSourceId,
        list.map((f) => ({ owner: f.tableOwner, name: f.tableName! })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const folder of list) results.push(emptyRefresh(folder, message));
      continue;
    }
    for (const [i, folder] of list.entries()) {
      results.push(await syncFolder(folder, described[i] ?? null));
    }
  }
  return results;
}

function emptyRefresh(folder: Folder, error: string | null): RefreshResult {
  return { folderId: folder.id, folderName: folder.name, added: [], updated: [], missing: [], error };
}

async function syncFolder(folder: Folder, table: IntrospectedTable | null): Promise<RefreshResult> {
  const result = emptyRefresh(folder, null);
  if (!table) {
    result.error =
      `${folder.tableOwner ? `${folder.tableOwner}.` : ''}${folder.tableName} ` +
      'no longer exists, or the data source user cannot see it';
    return result;
  }

  const current = await db
    .select()
    .from(items)
    .where(and(eq(items.folderId, folder.id), eq(items.isActive, true)));
  // Several items may sit on one column (a date and its year, say).
  const byColumn = new Map<string, typeof current>();
  for (const item of current) {
    if (!item.columnName) continue;
    const key = item.columnName.toUpperCase();
    byColumn.set(key, [...(byColumn.get(key) ?? []), item]);
  }
  let order = Math.max(-1, ...current.map((i) => i.displayOrder)) + 1;

  await db.transaction(async (tx) => {
    for (const col of table.columns) {
      const dataType = neoDataType(col.dataType);
      const onColumn = byColumn.get(col.columnName.toUpperCase());
      if (!onColumn) {
        await tx.insert(items).values({
          folderId: folder.id,
          name: humanizeName(col.columnName),
          description: col.comments,
          itemType: 'CO',
          columnName: col.columnName,
          dataType,
          displayOrder: order++,
        });
        result.added.push(col.columnName);
        continue;
      }
      for (const item of onColumn) {
        if (neoDataType(item.dataType ?? '') === dataType) continue;
        await tx.update(items).set({ dataType, updatedAt: new Date() }).where(eq(items.id, item.id));
        result.updated.push(item.name);
      }
    }
    if (folder.folderType !== table.objectType) {
      await tx
        .update(folders)
        .set({ folderType: table.objectType, updatedAt: new Date() })
        .where(eq(folders.id, folder.id));
      result.updated.push(`${folder.name} (${table.objectType})`);
    }
  });

  const live = new Set(table.columns.map((c) => c.columnName.toUpperCase()));
  result.missing = [...byColumn]
    .filter(([column]) => !live.has(column))
    .flatMap(([, onColumn]) => onColumn.map((i) => i.name));
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `CAP_PAGO` → `Cap Pago`, Discoverer's default naming. */
function humanizeName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function generateFolderName(table: IntrospectedTable): string {
  return humanizeName(table.tableName);
}
