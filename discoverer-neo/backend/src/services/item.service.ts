import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { items, folders, type Item, type NewItem } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemType = 'CI' | 'CU' | 'CO' | 'JI' | 'HI' | 'AG' | 'FU';

export interface CreateItemInput {
  folderId: string;
  name: string;
  description?: string | null;
  itemType: ItemType;
  columnName?: string | null;
  formula?: string | null;
  dataType?: string | null;
  formatMask?: string | null;
  aggFunction?: string | null;
  displayOrder?: number;
  isHidden?: boolean;
  parentItemId?: string | null;
  createdBy?: string | null;
}

export interface UpdateItemInput {
  name?: string;
  description?: string | null;
  itemType?: ItemType;
  columnName?: string | null;
  formula?: string | null;
  dataType?: string | null;
  formatMask?: string | null;
  aggFunction?: string | null;
  displayOrder?: number;
  isHidden?: boolean;
  parentItemId?: string | null;
}

export interface ItemWithFolder extends Item {
  folderName: string;
  folderType: string;
  businessAreaId: string;
}

export interface OracleColumn {
  columnName: string;
  dataType: string;
  dataLength?: number | null;
  nullable?: boolean;
}

export interface ImportResult {
  created: Array<{ itemId: string; name: string; columnName: string }>;
  skipped: Array<{ columnName: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Formula validation
// ---------------------------------------------------------------------------

const FORBIDDEN_FORMULA_PATTERNS = [
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
  /\bUTL_/i,
];

/**
 * Validate CU item formulas (basic SQL expression validation).
 * Returns an error message if the formula contains forbidden patterns, or null if valid.
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  if (!formula || formula.trim().length === 0) {
    return { valid: false, error: 'Formula cannot be empty' };
  }

  // Check for forbidden DDL/DML patterns
  for (const pattern of FORBIDDEN_FORMULA_PATTERNS) {
    if (pattern.test(formula)) {
      return {
        valid: false,
        error: `Formula contains forbidden pattern: ${pattern.source}. Only SQL expressions are allowed.`,
      };
    }
  }

  // Check balanced parentheses
  const openParens = (formula.match(/\(/g) || []).length;
  const closeParens = (formula.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return {
      valid: false,
      error: 'Formula has mismatched parentheses',
    };
  }

  // Check for balanced quotes
  const singleQuotes = (formula.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    return {
      valid: false,
      error: 'Formula has mismatched single quotes',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create an item. For CI type, columnName is required.
 */
export async function create(data: CreateItemInput): Promise<Item> {
  if (data.itemType === 'CI' && !data.columnName) {
    throw new Error('columnName is required for CI (Custom Item) type');
  }

  if (data.itemType === 'CU' && !data.formula) {
    throw new Error('formula is required for CU (Calculated User) type');
  }

  // Validate formula for CU items
  if (data.itemType === 'CU' && data.formula) {
    const validation = validateFormula(data.formula);
    if (!validation.valid) {
      throw new Error(`Invalid formula: ${validation.error}`);
    }
  }

  // Validate parent item exists if provided
  if (data.parentItemId) {
    const [parent] = await db
      .select({ id: items.id })
      .from(items)
      .where(eq(items.id, data.parentItemId))
      .limit(1);
    if (!parent) {
      throw new Error(`Parent item "${data.parentItemId}" does not exist`);
    }
  }

  const values: NewItem = {
    folderId: data.folderId,
    name: data.name,
    description: data.description ?? null,
    itemType: data.itemType,
    columnName: data.columnName ?? null,
    formula: data.formula ?? null,
    dataType: data.dataType ?? null,
    formatMask: data.formatMask ?? null,
    aggFunction: data.aggFunction ?? null,
    displayOrder: data.displayOrder ?? 0,
    isHidden: data.isHidden ?? false,
    parentItemId: data.parentItemId ?? null,
    createdBy: data.createdBy ?? null,
  };

  const [row] = await db.insert(items).values(values).returning();
  return row as Item;
}

/**
 * Update an item.
 */
export async function update(
  id: string,
  data: UpdateItemInput,
): Promise<Item | null> {
  const values: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  // Remove fields that shouldn't be overwritten
  delete values.id;
  delete values.createdAt;
  delete values.createdBy;
  delete values.folderId;

  // Validate formula if being updated
  if (data.formula && data.itemType === 'CU') {
    const validation = validateFormula(data.formula);
    if (!validation.valid) {
      throw new Error(`Invalid formula: ${validation.error}`);
    }
  }

  const [row] = await db
    .update(items)
    .set(values)
    .where(eq(items.id, id))
    .returning();

  return row ?? null;
}

/**
 * Get an item by ID with folder info.
 */
export async function getById(id: string): Promise<ItemWithFolder | null> {
  const [row] = await db
    .select({
      id: items.id,
      folderId: items.folderId,
      name: items.name,
      description: items.description,
      itemType: items.itemType,
      columnName: items.columnName,
      formula: items.formula,
      dataType: items.dataType,
      formatMask: items.formatMask,
      aggFunction: items.aggFunction,
      displayOrder: items.displayOrder,
      isHidden: items.isHidden,
      isActive: items.isActive,
      parentItemId: items.parentItemId,
      createdBy: items.createdBy,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      folderName: folders.name,
      folderType: folders.folderType,
      businessAreaId: folders.businessAreaId,
    })
    .from(items)
    .innerJoin(folders, eq(items.folderId, folders.id))
    .where(eq(items.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * List items in a folder (active only).
 */
export async function listByFolder(folderId: string): Promise<Item[]> {
  const rows = await db
    .select()
    .from(items)
    .where(and(eq(items.folderId, folderId), eq(items.isActive, true)))
    .orderBy(items.displayOrder, items.name);

  return rows;
}

/**
 * List all items in a business area (active only).
 */
export async function listByBusinessArea(businessAreaId: string): Promise<ItemWithFolder[]> {
  const rows = await db
    .select({
      id: items.id,
      folderId: items.folderId,
      name: items.name,
      description: items.description,
      itemType: items.itemType,
      columnName: items.columnName,
      formula: items.formula,
      dataType: items.dataType,
      formatMask: items.formatMask,
      aggFunction: items.aggFunction,
      displayOrder: items.displayOrder,
      isHidden: items.isHidden,
      isActive: items.isActive,
      parentItemId: items.parentItemId,
      createdBy: items.createdBy,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      folderName: folders.name,
      folderType: folders.folderType,
      businessAreaId: folders.businessAreaId,
    })
    .from(items)
    .innerJoin(folders, eq(items.folderId, folders.id))
    .where(
      and(
        eq(folders.businessAreaId, businessAreaId),
        eq(items.isActive, true),
      ),
    )
    .orderBy(folders.displayOrder, items.displayOrder);

  return rows;
}

/**
 * Soft-delete an item (set isActive = false).
 */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(items)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning({ id: items.id });

  return !!row;
}

// ---------------------------------------------------------------------------
// Oracle import
// ---------------------------------------------------------------------------

/**
 * Create CI items from Oracle column introspection.
 */
export async function importFromOracleColumns(
  folderId: string,
  columns: OracleColumn[],
): Promise<ImportResult> {
  // Verify folder exists
  const [folder] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.isActive, true)))
    .limit(1);

  if (!folder) {
    throw new Error(`Folder "${folderId}" does not exist or is inactive`);
  }

  const result: ImportResult = { created: [], skipped: [] };

  for (const col of columns) {
    // Check if an item with the same columnName already exists in this folder
    const [existing] = await db
      .select({ id: items.id })
      .from(items)
      .where(
        and(
          eq(items.folderId, folderId),
          eq(items.columnName, col.columnName),
          eq(items.isActive, true),
        ),
      )
      .limit(1);

    if (existing) {
      result.skipped.push({
        columnName: col.columnName,
        reason: 'Item already exists in this folder',
      });
      continue;
    }

    const [item] = await db
      .insert(items)
      .values({
        folderId,
        name: col.columnName,
        description: `${col.dataType}${col.dataLength ? `(${col.dataLength})` : ''}`,
        itemType: 'CI',
        columnName: col.columnName,
        dataType: col.dataType,
        displayOrder: result.created.length,
        isHidden: false,
      })
      .returning();

    result.created.push({
      itemId: item!.id,
      name: item!.name,
      columnName: col.columnName,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hierarchy
// ---------------------------------------------------------------------------

/**
 * Get hierarchical descendants for an HI item (recursive).
 */
export async function getDescendants(itemId: string): Promise<Item[]> {
  // Verify the item exists
  const [item] = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);

  if (!item) {
    throw new Error(`Item "${itemId}" does not exist`);
  }

  // Recursively collect all descendants
  const allDescendants: Item[] = [];
  const queue: string[] = [itemId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await db
      .select()
      .from(items)
      .where(and(eq(items.parentItemId, currentId), eq(items.isActive, true)));

    for (const child of children) {
      allDescendants.push(child);
      queue.push(child.id);
    }
  }

  return allDescendants;
}
