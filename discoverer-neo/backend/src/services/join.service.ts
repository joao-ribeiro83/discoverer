import { eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { joins, items, folders, type Join } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface CreateJoinInput {
  name: string;
  leftFolderId: string;
  rightFolderId: string;
  leftItemId?: string | null;
  rightItemId?: string | null;
  joinType: JoinType;
}

export interface UpdateJoinInput {
  name?: string;
  leftFolderId?: string;
  rightFolderId?: string;
  leftItemId?: string | null;
  rightItemId?: string | null;
  joinType?: JoinType;
}

export interface JoinWithDetails extends Join {
  leftFolderName: string;
  rightFolderName: string;
  leftItemName: string | null;
  rightItemName: string | null;
  businessAreaId: string;
}

export interface JoinSuggestion {
  leftFolderId: string;
  rightFolderId: string;
  leftItemId: string;
  rightItemId: string;
  leftColumnName: string;
  rightColumnName: string;
  suggestedJoinType: JoinType;
  reason: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that items exist and belong to the correct folders.
 */
export async function validateJoin(
  leftItemId: string | null | undefined,
  rightItemId: string | null | undefined,
  leftFolderId: string,
  rightFolderId: string,
): Promise<{ valid: boolean; error?: string }> {
  // If item IDs are provided, validate they exist and belong to the correct folders
  if (leftItemId) {
    const [leftItem] = await db
      .select({ id: items.id, folderId: items.folderId })
      .from(items)
      .where(and(eq(items.id, leftItemId), eq(items.isActive, true)))
      .limit(1);

    if (!leftItem) {
      return { valid: false, error: `Left item "${leftItemId}" does not exist or is inactive` };
    }
    if (leftItem.folderId !== leftFolderId) {
      return {
        valid: false,
        error: `Left item "${leftItemId}" does not belong to folder "${leftFolderId}"`,
      };
    }
  }

  if (rightItemId) {
    const [rightItem] = await db
      .select({ id: items.id, folderId: items.folderId })
      .from(items)
      .where(and(eq(items.id, rightItemId), eq(items.isActive, true)))
      .limit(1);

    if (!rightItem) {
      return { valid: false, error: `Right item "${rightItemId}" does not exist or is inactive` };
    }
    if (rightItem.folderId !== rightFolderId) {
      return {
        valid: false,
        error: `Right item "${rightItemId}" does not belong to folder "${rightFolderId}"`,
      };
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a join. Validates that items belong to correct folders.
 */
export async function create(data: CreateJoinInput): Promise<Join> {
  // Validate folders exist
  const [leftFolder] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, data.leftFolderId), eq(folders.isActive, true)))
    .limit(1);

  if (!leftFolder) {
    throw new Error(`Left folder "${data.leftFolderId}" does not exist or is inactive`);
  }

  const [rightFolder] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, data.rightFolderId), eq(folders.isActive, true)))
    .limit(1);

  if (!rightFolder) {
    throw new Error(`Right folder "${data.rightFolderId}" does not exist or is inactive`);
  }

  // Validate items
  const validation = await validateJoin(
    data.leftItemId ?? null,
    data.rightItemId ?? null,
    data.leftFolderId,
    data.rightFolderId,
  );

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const [row] = await db
    .insert(joins)
    .values({
      name: data.name,
      leftFolderId: data.leftFolderId,
      rightFolderId: data.rightFolderId,
      leftItemId: data.leftItemId ?? null,
      rightItemId: data.rightItemId ?? null,
      joinType: data.joinType,
    })
    .returning();

  return row as Join;
}

/**
 * Update a join.
 */
export async function update(
  id: string,
  data: UpdateJoinInput,
): Promise<Join | null> {
  const values: Record<string, unknown> = {
    ...data,
  };

  // Remove fields that shouldn't be overwritten
  delete values.id;
  delete values.createdAt;

  // If items are being updated, validate them
  if (data.leftItemId || data.rightItemId) {
    // Get the current join to resolve folder IDs
    const [current] = await db
      .select()
      .from(joins)
      .where(eq(joins.id, id))
      .limit(1);

    if (!current) {
      return null;
    }

    const leftFolderId = data.leftFolderId ?? current.leftFolderId;
    const rightFolderId = data.rightFolderId ?? current.rightFolderId;

    const validation = await validateJoin(
      data.leftItemId ?? current.leftItemId,
      data.rightItemId ?? current.rightItemId,
      leftFolderId,
      rightFolderId,
    );

    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  const [row] = await db
    .update(joins)
    .set(values)
    .where(eq(joins.id, id))
    .returning();

  return row ?? null;
}

/**
 * Get a join by ID with folder and item details.
 */
export async function getById(id: string): Promise<JoinWithDetails | null> {
  const [row] = await db
    .select({
      id: joins.id,
      name: joins.name,
      leftFolderId: joins.leftFolderId,
      rightFolderId: joins.rightFolderId,
      leftItemId: joins.leftItemId,
      rightItemId: joins.rightItemId,
      joinType: joins.joinType,
      isActive: joins.isActive,
      createdAt: joins.createdAt,
      leftFolderName: folders.name,
    })
    .from(joins)
    .innerJoin(folders, eq(joins.leftFolderId, folders.id))
    .where(eq(joins.id, id))
    .limit(1);

  if (!row) return null;

  // Fetch right folder name
  const [rightFolder] = await db
    .select({ name: folders.name, businessAreaId: folders.businessAreaId })
    .from(folders)
    .where(eq(folders.id, row.rightFolderId))
    .limit(1);

  // Fetch item names
  let leftItemName: string | null = null;
  let rightItemName: string | null = null;

  if (row.leftItemId) {
    const [li] = await db
      .select({ name: items.name })
      .from(items)
      .where(eq(items.id, row.leftItemId))
      .limit(1);
    leftItemName = li?.name ?? null;
  }

  if (row.rightItemId) {
    const [ri] = await db
      .select({ name: items.name })
      .from(items)
      .where(eq(items.id, row.rightItemId))
      .limit(1);
    rightItemName = ri?.name ?? null;
  }

  return {
    ...row,
    leftFolderName: row.leftFolderName,
    rightFolderName: rightFolder?.name ?? '',
    leftItemName,
    rightItemName,
    businessAreaId: rightFolder?.businessAreaId ?? '',
  };
}

/**
 * List joins involving a folder (either left or right).
 */
export async function listByFolder(folderId: string): Promise<JoinWithDetails[]> {
  const rows = await db
    .select({
      id: joins.id,
      name: joins.name,
      leftFolderId: joins.leftFolderId,
      rightFolderId: joins.rightFolderId,
      leftItemId: joins.leftItemId,
      rightItemId: joins.rightItemId,
      joinType: joins.joinType,
      isActive: joins.isActive,
      createdAt: joins.createdAt,
    })
    .from(joins)
    .where(
      and(
        or(eq(joins.leftFolderId, folderId), eq(joins.rightFolderId, folderId)),
        eq(joins.isActive, true),
      ),
    );

  // Enrich with folder and item details
  const enriched: JoinWithDetails[] = [];
  for (const row of rows) {
    const [leftFolder] = await db
      .select({ name: folders.name })
      .from(folders)
      .where(eq(folders.id, row.leftFolderId))
      .limit(1);

    const [rightFolder] = await db
      .select({ name: folders.name, businessAreaId: folders.businessAreaId })
      .from(folders)
      .where(eq(folders.id, row.rightFolderId))
      .limit(1);

    let leftItemName: string | null = null;
    let rightItemName: string | null = null;

    if (row.leftItemId) {
      const [li] = await db
        .select({ name: items.name })
        .from(items)
        .where(eq(items.id, row.leftItemId))
        .limit(1);
      leftItemName = li?.name ?? null;
    }

    if (row.rightItemId) {
      const [ri] = await db
        .select({ name: items.name })
        .from(items)
        .where(eq(items.id, row.rightItemId))
        .limit(1);
      rightItemName = ri?.name ?? null;
    }

    enriched.push({
      ...row,
      leftFolderName: leftFolder?.name ?? '',
      rightFolderName: rightFolder?.name ?? '',
      leftItemName,
      rightItemName,
      businessAreaId: rightFolder?.businessAreaId ?? '',
    });
  }

  return enriched;
}

/**
 * List all joins in a business area.
 */
export async function listByBusinessArea(businessAreaId: string): Promise<JoinWithDetails[]> {
  // Get all folders in this business area
  const baFolders = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.businessAreaId, businessAreaId), eq(folders.isActive, true)));

  const folderIds = baFolders.map((f) => f.id);

  if (folderIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: joins.id,
      name: joins.name,
      leftFolderId: joins.leftFolderId,
      rightFolderId: joins.rightFolderId,
      leftItemId: joins.leftItemId,
      rightItemId: joins.rightItemId,
      joinType: joins.joinType,
      isActive: joins.isActive,
      createdAt: joins.createdAt,
    })
    .from(joins)
    .where(
      and(
        or(inArray(joins.leftFolderId, folderIds), inArray(joins.rightFolderId, folderIds)),
        eq(joins.isActive, true),
      ),
    );

  // Enrich with folder and item details
  const enriched: JoinWithDetails[] = [];
  for (const row of rows) {
    const [leftFolder] = await db
      .select({ name: folders.name })
      .from(folders)
      .where(eq(folders.id, row.leftFolderId))
      .limit(1);

    const [rightFolder] = await db
      .select({ name: folders.name })
      .from(folders)
      .where(eq(folders.id, row.rightFolderId))
      .limit(1);

    let leftItemName: string | null = null;
    let rightItemName: string | null = null;

    if (row.leftItemId) {
      const [li] = await db
        .select({ name: items.name })
        .from(items)
        .where(eq(items.id, row.leftItemId))
        .limit(1);
      leftItemName = li?.name ?? null;
    }

    if (row.rightItemId) {
      const [ri] = await db
        .select({ name: items.name })
        .from(items)
        .where(eq(items.id, row.rightItemId))
        .limit(1);
      rightItemName = ri?.name ?? null;
    }

    enriched.push({
      ...row,
      leftFolderName: leftFolder?.name ?? '',
      rightFolderName: rightFolder?.name ?? '',
      leftItemName,
      rightItemName,
      businessAreaId,
    });
  }

  return enriched;
}

/**
 * Soft-delete a join (set isActive = false).
 */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(joins)
    .set({ isActive: false })
    .where(eq(joins.id, id))
    .returning({ id: joins.id });

  return !!row;
}

// ---------------------------------------------------------------------------
// Auto-suggest
// ---------------------------------------------------------------------------

/**
 * Suggest joins based on matching column names across folders.
 * Looks for items in the given folder that share column names with items
 * in other folders within the same business area.
 */
export async function autoSuggestJoins(folderId: string): Promise<JoinSuggestion[]> {
  // Get the folder to find its business area
  const [folder] = await db
    .select({ id: folders.id, businessAreaId: folders.businessAreaId })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.isActive, true)))
      .limit(1);

  if (!folder) {
    throw new Error(`Folder "${folderId}" does not exist or is inactive`);
  }

  // Get all CI items in the source folder
  const sourceItems = await db
    .select({
      id: items.id,
      columnName: items.columnName,
      name: items.name,
    })
    .from(items)
    .where(
      and(
        eq(items.folderId, folderId),
        eq(items.itemType, 'CI'),
        eq(items.isActive, true),
      ),
    );

  if (sourceItems.length === 0) {
    return [];
  }

  // Get all other folders in the same business area
  const otherFolders = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.businessAreaId, folder.businessAreaId),
        eq(folders.isActive, true),
      ),
    );

  const otherFolderIds = otherFolders
    .map((f) => f.id)
    .filter((id) => id !== folderId);

  if (otherFolderIds.length === 0) {
    return [];
  }

  // Get all CI items in other folders
  const targetItems = await db
    .select({
      id: items.id,
      columnName: items.columnName,
      name: items.name,
      folderId: items.folderId,
    })
    .from(items)
    .where(
      and(
        inArray(items.folderId, otherFolderIds),
        eq(items.itemType, 'CI'),
        eq(items.isActive, true),
      ),
    );

  // Build suggestions by matching column names
  const suggestions: JoinSuggestion[] = [];

  for (const sourceItem of sourceItems) {
    if (!sourceItem.columnName) continue;

    for (const targetItem of targetItems) {
      if (!targetItem.columnName) continue;

      // Case-insensitive match
      if (
        sourceItem.columnName.toUpperCase() === targetItem.columnName.toUpperCase()
      ) {
        // Check if a join already exists for this pair
        const [existing] = await db
          .select({ id: joins.id })
          .from(joins)
          .where(
            and(
              or(
                and(
                  eq(joins.leftItemId, sourceItem.id),
                  eq(joins.rightItemId, targetItem.id),
                ),
                and(
                  eq(joins.leftItemId, targetItem.id),
                  eq(joins.rightItemId, sourceItem.id),
                ),
              ),
              eq(joins.isActive, true),
            ),
          )
          .limit(1);

        if (!existing) {
          suggestions.push({
            leftFolderId: folderId,
            rightFolderId: targetItem.folderId,
            leftItemId: sourceItem.id,
            rightItemId: targetItem.id,
            leftColumnName: sourceItem.columnName,
            rightColumnName: targetItem.columnName,
            suggestedJoinType: 'INNER',
            reason: `Matching column name: ${sourceItem.columnName}`,
          });
        }
      }
    }
  }

  return suggestions;
}
