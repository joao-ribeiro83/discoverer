import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  hierarchies,
  hierarchyLevels,
  items,
  folders,
  type Hierarchy,
  type HierarchyLevel,
} from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HierarchyLevelInput {
  levelName: string;
  itemId: string;
  levelNumber: number;
}

export interface CreateHierarchyInput {
  name: string;
  description?: string | null;
  businessAreaId: string;
  levels: HierarchyLevelInput[];
}

export interface UpdateHierarchyInput {
  name?: string;
  description?: string | null;
  levels?: HierarchyLevelInput[];
}

export interface HierarchyWithLevels extends Hierarchy {
  levels: HierarchyLevel[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class HierarchyValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HierarchyValidationError';
  }
}

/**
 * Validate that each level references an item that exists and belongs to the
 * same business area as the hierarchy. Throws HierarchyValidationError on
 * failure.
 */
export async function validateLevels(
  businessAreaId: string,
  levels: HierarchyLevelInput[],
): Promise<void> {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new HierarchyValidationError('At least one hierarchy level is required');
  }

  // Ensure level numbers are unique and positive
  const levelNumbers = levels.map((l) => l.levelNumber);
  const uniqueNumbers = new Set(levelNumbers);
  if (uniqueNumbers.size !== levelNumbers.length) {
    throw new HierarchyValidationError('Level numbers must be unique');
  }
  for (const n of levelNumbers) {
    if (!Number.isInteger(n) || n < 1) {
      throw new HierarchyValidationError(
        'Level numbers must be positive integers starting at 1',
      );
    }
  }

  // Each level must reference a valid item in the same business area
  for (const level of levels) {
    if (!level.itemId) {
      throw new HierarchyValidationError(
        `Level "${level.levelName}" must reference an item`,
      );
    }
    if (!level.levelName || level.levelName.trim().length === 0) {
      throw new HierarchyValidationError('Each level must have a levelName');
    }

    const [row] = await db
      .select({ id: items.id, folderId: items.folderId })
      .from(items)
      .where(eq(items.id, level.itemId))
      .limit(1);

    if (!row) {
      throw new HierarchyValidationError(
        `Item "${level.itemId}" referenced by level "${level.levelName}" does not exist`,
      );
    }

    const [folder] = await db
      .select({ businessAreaId: folders.businessAreaId })
      .from(folders)
      .where(eq(folders.id, row.folderId))
      .limit(1);

    if (!folder || folder.businessAreaId !== businessAreaId) {
      throw new HierarchyValidationError(
        `Item referenced by level "${level.levelName}" does not belong to the target business area`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a hierarchy with its levels, ordered by levelNumber.
 */
export async function create(
  data: CreateHierarchyInput,
): Promise<HierarchyWithLevels> {
  await validateLevels(data.businessAreaId, data.levels);

  return db.transaction(async (tx) => {
    const [hierarchy] = await tx
      .insert(hierarchies)
      .values({
        name: data.name,
        description: data.description ?? null,
        businessAreaId: data.businessAreaId,
      })
      .returning();

    const sortedLevels = [...data.levels].sort(
      (a, b) => a.levelNumber - b.levelNumber,
    );

    const levelRows = await tx
      .insert(hierarchyLevels)
      .values(
        sortedLevels.map((l) => ({
          hierarchyId: hierarchy!.id,
          levelName: l.levelName,
          itemId: l.itemId,
          levelNumber: l.levelNumber,
        })),
      )
      .returning();

    return { ...hierarchy!, levels: levelRows };
  });
}

/**
 * Update a hierarchy and replace its levels atomically.
 */
export async function update(
  id: string,
  data: UpdateHierarchyInput,
): Promise<HierarchyWithLevels | null> {
  const existing = await db
    .select()
    .from(hierarchies)
    .where(eq(hierarchies.id, id))
    .limit(1);
  if (!existing[0]) return null;

  if (data.levels) {
    await validateLevels(existing[0].businessAreaId, data.levels);
  }

  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined) values.description = data.description;

    const [hierarchy] = await tx
      .update(hierarchies)
      .set(values)
      .where(eq(hierarchies.id, id))
      .returning();

    let levelRows: HierarchyLevel[] = [];
    if (data.levels) {
      // Replace levels: delete old, insert new
      await tx
        .delete(hierarchyLevels)
        .where(eq(hierarchyLevels.hierarchyId, id));

      const sortedLevels = [...data.levels].sort(
        (a, b) => a.levelNumber - b.levelNumber,
      );

      levelRows = await tx
        .insert(hierarchyLevels)
        .values(
          sortedLevels.map((l) => ({
            hierarchyId: id,
            levelName: l.levelName,
            itemId: l.itemId,
            levelNumber: l.levelNumber,
          })),
        )
        .returning();
    } else {
      levelRows = await tx
        .select()
        .from(hierarchyLevels)
        .where(eq(hierarchyLevels.hierarchyId, id))
        .orderBy(asc(hierarchyLevels.levelNumber));
    }

    return { ...hierarchy!, levels: levelRows };
  });
}

/**
 * Get a hierarchy with all levels ordered by levelNumber.
 */
export async function getById(id: string): Promise<HierarchyWithLevels | null> {
  const [hierarchy] = await db
    .select()
    .from(hierarchies)
    .where(and(eq(hierarchies.id, id), eq(hierarchies.isActive, true)))
    .limit(1);

  if (!hierarchy) return null;

  const levelRows = await db
    .select()
    .from(hierarchyLevels)
    .where(eq(hierarchyLevels.hierarchyId, id))
    .orderBy(asc(hierarchyLevels.levelNumber));

  return { ...hierarchy, levels: levelRows };
}

/**
 * List active hierarchies in a business area.
 */
export async function listByBusinessArea(
  businessAreaId: string,
): Promise<Hierarchy[]> {
  return db
    .select()
    .from(hierarchies)
    .where(
      and(
        eq(hierarchies.businessAreaId, businessAreaId),
        eq(hierarchies.isActive, true),
      ),
    )
    .orderBy(hierarchies.name);
}

/**
 * Soft-delete a hierarchy (set isActive = false).
 */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(hierarchies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(hierarchies.id, id))
    .returning({ id: hierarchies.id });

  return !!row;
}
