import { eq, and, or, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  joins,
  joinPredicates,
  items,
  folders,
  type Join,
} from '../db/schema.js';
import { deriveJoinType } from '../lib/sql/join-type.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The join types Neo can emit.
 *
 * No `FULL`. It was never reachable: `join_type` came from
 * `EUL4_KEY_CONS.KEY_TYPE`, whose live domain is `FK`/`UK`, and the flag
 * combination that would mean a full outer join is a refusal (D-038) —
 * inexpressible in the Oracle 8 `(+)` syntax Discoverer 4.1 targeted, and
 * described by no vendor text.
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT';

/**
 * `join_type` is no longer stored (D-032); it is derived from the two
 * outer-join flags. This is the inverse, for the admin API, which still lets
 * a person pick a join type by name rather than set two booleans.
 */
export const FLAGS_FOR_JOIN_TYPE: Record<
  JoinType,
  { allowMasterNoDetail: boolean; allowDetailNoMaster: boolean }
> = {
  INNER: { allowMasterNoDetail: false, allowDetailNoMaster: false },
  LEFT: { allowMasterNoDetail: true, allowDetailNoMaster: false },
  RIGHT: { allowMasterNoDetail: false, allowDetailNoMaster: true },
};

export interface CreateJoinInput {
  name: string;
  /** MASTER folder (D-040). */
  leftFolderId: string;
  /** DETAIL folder (D-040). */
  rightFolderId: string;
  /**
   * The single column pair a join authored here uses. Stored as one
   * `join_predicates` row with operator `=`. Multi-column predicates come from
   * the EUL migration; the admin UI does not build them yet.
   */
  leftItemId?: string | null;
  rightItemId?: string | null;
  joinType: JoinType;
  /** Fan-trap detection only — never affects the emitted SQL. */
  oneToOne?: boolean;
  /** Referential-integrity assertion. Unlocks join trimming; not a join type. */
  mandatory?: boolean;
}

export interface UpdateJoinInput {
  name?: string;
  leftFolderId?: string;
  rightFolderId?: string;
  leftItemId?: string | null;
  rightItemId?: string | null;
  joinType?: JoinType;
  oneToOne?: boolean;
  mandatory?: boolean;
}

export interface JoinWithDetails extends Join {
  leftFolderName: string;
  rightFolderName: string;
  /** Derived from the flags, for display. Never a stored column. */
  joinType: JoinType;
  /** First predicate component's items — what the admin UI shows today. */
  leftItemId: string | null;
  rightItemId: string | null;
  leftItemName: string | null;
  rightItemName: string | null;
  /** How many column pairs the predicate has. 0 means the join cannot run. */
  predicateCount: number;
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
export async function create(data: CreateJoinInput): Promise<JoinWithDetails> {
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
      ...FLAGS_FOR_JOIN_TYPE[data.joinType],
      oneToOne: data.oneToOne ?? false,
      mandatory: data.mandatory ?? false,
    })
    .returning();

  const join = row as Join;
  await writePredicate(join.id, data.leftItemId ?? null, data.rightItemId ?? null);
  // Read back rather than returning the inserted row: `joinType` and the
  // predicate items are DERIVED, so the stored row alone is not the API shape.
  return (await getById(join.id))!;
}

/**
 * Replace a join's predicate with the single `=` pair the admin API carries.
 *
 * A join authored in Neo has one column pair; the multi-column shape comes
 * from the EUL, whose predicate is an n-ary `AND` token tree. Passing two
 * nulls clears the predicate, which leaves the join present but unrunnable —
 * and `buildFromClause` then refuses by name (D-039) rather than silently
 * dropping it.
 */
async function writePredicate(
  joinId: string,
  leftItemId: string | null,
  rightItemId: string | null,
): Promise<void> {
  await db.delete(joinPredicates).where(eq(joinPredicates.joinId, joinId));
  if (!leftItemId && !rightItemId) return;
  await db.insert(joinPredicates).values({
    joinId,
    seq: 0,
    leftItemId,
    rightItemId,
    operator: '=',
  });
}

/**
 * A join's predicate, flattened to what the admin API shows: the FIRST
 * component's two items, plus how many components there are in total.
 *
 * The count matters. A migrated three-column join shows one pair in the UI,
 * and `predicateCount` is what says the other two exist rather than letting
 * the screen imply the join is simpler than it is.
 */
async function readPredicateSummary(joinId: string): Promise<{
  leftItemId: string | null;
  rightItemId: string | null;
  leftItemName: string | null;
  rightItemName: string | null;
  predicateCount: number;
}> {
  const rows = await db
    .select()
    .from(joinPredicates)
    .where(eq(joinPredicates.joinId, joinId))
    .orderBy(joinPredicates.seq);

  const first = rows[0];
  const nameOf = async (itemId: string | null | undefined) => {
    if (!itemId) return null;
    const [row] = await db
      .select({ name: items.name })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    return row?.name ?? null;
  };

  return {
    leftItemId: first?.leftItemId ?? null,
    rightItemId: first?.rightItemId ?? null,
    leftItemName: await nameOf(first?.leftItemId),
    rightItemName: await nameOf(first?.rightItemId),
    predicateCount: rows.length,
  };
}

/**
 * Update a join.
 */
export async function update(
  id: string,
  data: UpdateJoinInput,
): Promise<JoinWithDetails | null> {
  const [current] = await db
    .select()
    .from(joins)
    .where(eq(joins.id, id))
    .limit(1);
  if (!current) return null;

  const values: Record<string, unknown> = {};
  if (data.name !== undefined) values.name = data.name;
  if (data.leftFolderId !== undefined) values.leftFolderId = data.leftFolderId;
  if (data.rightFolderId !== undefined) values.rightFolderId = data.rightFolderId;
  if (data.oneToOne !== undefined) values.oneToOne = data.oneToOne;
  if (data.mandatory !== undefined) values.mandatory = data.mandatory;
  // `join_type` is not a column any more — it sets the two flags it derives
  // from (D-032).
  if (data.joinType !== undefined) {
    Object.assign(values, FLAGS_FOR_JOIN_TYPE[data.joinType]);
  }

  const leftFolderId = data.leftFolderId ?? current.leftFolderId;
  const rightFolderId = data.rightFolderId ?? current.rightFolderId;

  // The predicate is only touched when the caller names an item, so an update
  // that only renames the join leaves a migrated multi-column predicate alone.
  const touchesPredicate =
    data.leftItemId !== undefined || data.rightItemId !== undefined;
  if (touchesPredicate) {
    const existing = await readPredicateSummary(id);
    const leftItemId =
      data.leftItemId !== undefined ? data.leftItemId : existing.leftItemId;
    const rightItemId =
      data.rightItemId !== undefined ? data.rightItemId : existing.rightItemId;

    const validation = await validateJoin(
      leftItemId,
      rightItemId,
      leftFolderId,
      rightFolderId,
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    await writePredicate(id, leftItemId, rightItemId);
  }

  if (Object.keys(values).length > 0) {
    await db.update(joins).set(values).where(eq(joins.id, id));
  }

  // Same as `create`: the response shape is the derived one.
  return getById(id);
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
      oneToOne: joins.oneToOne,
      allowMasterNoDetail: joins.allowMasterNoDetail,
      allowDetailNoMaster: joins.allowDetailNoMaster,
      mandatory: joins.mandatory,
      predicateFormula: joins.predicateFormula,
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

  return {
    ...row,
    ...(await readPredicateSummary(row.id)),
    joinType: deriveJoinType(row, row.name),
    leftFolderName: row.leftFolderName,
    rightFolderName: rightFolder?.name ?? '',
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
      oneToOne: joins.oneToOne,
      allowMasterNoDetail: joins.allowMasterNoDetail,
      allowDetailNoMaster: joins.allowDetailNoMaster,
      mandatory: joins.mandatory,
      predicateFormula: joins.predicateFormula,
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

    enriched.push({
      ...row,
      ...(await readPredicateSummary(row.id)),
      joinType: deriveJoinType(row, row.name),
      leftFolderName: leftFolder?.name ?? '',
      rightFolderName: rightFolder?.name ?? '',
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
      oneToOne: joins.oneToOne,
      allowMasterNoDetail: joins.allowMasterNoDetail,
      allowDetailNoMaster: joins.allowDetailNoMaster,
      mandatory: joins.mandatory,
      predicateFormula: joins.predicateFormula,
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

    enriched.push({
      ...row,
      ...(await readPredicateSummary(row.id)),
      joinType: deriveJoinType(row, row.name),
      leftFolderName: leftFolder?.name ?? '',
      rightFolderName: rightFolder?.name ?? '',
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
        // Check if a join already exists for this pair. The pair now lives on
        // `join_predicates`, so the lookup goes through it — a join with a
        // multi-column predicate matches if ANY of its components is this pair.
        const [existing] = await db
          .select({ id: joins.id })
          .from(joins)
          .innerJoin(joinPredicates, eq(joinPredicates.joinId, joins.id))
          .where(
            and(
              or(
                and(
                  eq(joinPredicates.leftItemId, sourceItem.id),
                  eq(joinPredicates.rightItemId, targetItem.id),
                ),
                and(
                  eq(joinPredicates.leftItemId, targetItem.id),
                  eq(joinPredicates.rightItemId, sourceItem.id),
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
