import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  mapConditionalFormats,
  mapItems,
  maps,
  type MapConditionalFormat,
} from '../db/schema.js';
import type { ConditionOperator } from './map.service.js';

export type ConditionalFormatTarget = 'CELL' | 'ROW';

export interface ConditionalFormatInput {
  name?: string | null;
  /** The map item the rule tests. Required — a rule with nothing to test cannot evaluate. */
  mapItemId: string;
  target: ConditionalFormatTarget;
  operator: ConditionOperator;
  /** `BETWEEN` stores `low,high` and `IN` a comma-joined list, one column. */
  value: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  displayOrder?: number;
}

export class ConditionalFormatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConditionalFormatValidationError';
  }
}

/** A rule's `mapItemId` must name a column on the SAME map — never another map's. */
async function assertItemBelongsToMap(mapId: string, mapItemId: string): Promise<void> {
  const [row] = await db
    .select({ id: mapItems.id })
    .from(mapItems)
    .where(and(eq(mapItems.id, mapItemId), eq(mapItems.mapId, mapId)))
    .limit(1);
  if (!row) {
    throw new ConditionalFormatValidationError(
      'That column is not part of this map',
    );
  }
}

/**
 * A format change alters what a run renders, so it must change the map's
 * `updatedAt`: that timestamp is in the run key (map-run.service.ts), and an
 * unchanged key would re-use a stored run with the old formats.
 */
async function touchMap(mapId: string): Promise<void> {
  await db.update(maps).set({ updatedAt: new Date() }).where(eq(maps.id, mapId));
}

export async function listForMap(mapId: string): Promise<MapConditionalFormat[]> {
  return db
    .select()
    .from(mapConditionalFormats)
    .where(eq(mapConditionalFormats.mapId, mapId))
    .orderBy(asc(mapConditionalFormats.displayOrder));
}

export async function create(
  mapId: string,
  input: ConditionalFormatInput,
): Promise<MapConditionalFormat> {
  await assertItemBelongsToMap(mapId, input.mapItemId);
  const [row] = await db
    .insert(mapConditionalFormats)
    .values({
      mapId,
      name: input.name ?? null,
      mapItemId: input.mapItemId,
      target: input.target,
      operator: input.operator,
      value: input.value,
      backgroundColor: input.backgroundColor ?? null,
      textColor: input.textColor ?? null,
      isBold: input.isBold ?? false,
      isItalic: input.isItalic ?? false,
      isUnderline: input.isUnderline ?? false,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning();
  await touchMap(mapId);
  return row!;
}

export async function update(
  mapId: string,
  formatId: string,
  input: Partial<ConditionalFormatInput>,
): Promise<MapConditionalFormat | null> {
  if (input.mapItemId) await assertItemBelongsToMap(mapId, input.mapItemId);
  const [row] = await db
    .update(mapConditionalFormats)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.mapItemId !== undefined ? { mapItemId: input.mapItemId } : {}),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.operator !== undefined ? { operator: input.operator } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.backgroundColor !== undefined ? { backgroundColor: input.backgroundColor } : {}),
      ...(input.textColor !== undefined ? { textColor: input.textColor } : {}),
      ...(input.isBold !== undefined ? { isBold: input.isBold } : {}),
      ...(input.isItalic !== undefined ? { isItalic: input.isItalic } : {}),
      ...(input.isUnderline !== undefined ? { isUnderline: input.isUnderline } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    })
    .where(and(eq(mapConditionalFormats.id, formatId), eq(mapConditionalFormats.mapId, mapId)))
    .returning();
  if (row) await touchMap(mapId);
  return row ?? null;
}

export async function remove(mapId: string, formatId: string): Promise<boolean> {
  const deleted = await db
    .delete(mapConditionalFormats)
    .where(and(eq(mapConditionalFormats.id, formatId), eq(mapConditionalFormats.mapId, mapId)))
    .returning({ id: mapConditionalFormats.id });
  if (deleted.length > 0) await touchMap(mapId);
  return deleted.length > 0;
}
