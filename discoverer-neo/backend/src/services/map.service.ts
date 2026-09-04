import { eq, and, asc, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  mapCalculatedFields,
  mapConditionalFormats,
  mapLayouts,
  mapPageSetup,
  mapTotals,
  mapShares,
  userBusinessAreaGrants,
  items,
  folders,
  users,
  type Map,
  type MapItem,
  type MapCondition,
  type MapParameter,
  type MapCalculatedField,
  type MapConditionalFormat,
  type MapLayout,
  type MapPageSetup,
  type MapTotal,
  type MapShare,
} from '../db/schema.js';
import { userHasPermission } from './business-area.service.js';
import { makeBindName } from '../lib/sql/identifiers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MapType = 'TABLE' | 'CROSSTAB' | 'PAGE_DETAIL' | 'CHART';
export type ConditionOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'BETWEEN'
  | 'IS_NULL';

export interface MapItemInput {
  itemId: string;
  displayOrder?: number;
  displayName?: string | null;
  formatMask?: string | null;
  aggFunction?: string | null;
  sortDirection?: 'ASC' | 'DESC' | null;
  sortOrder?: number | null;
  columnWidth?: number | null;
  /** Where the item sits — `AXIS` / `MEASURE` / `PAGE`, and its place there. */
  axisType?: 'AXIS' | 'MEASURE' | 'PAGE' | null;
  axisOrder?: number | null;
  /**
   * Which edge of a crosstab an `AXIS` column sits on. Discoverer records no
   * such field, so this is null on every migrated map and is set only when
   * somebody lays a crosstab out in Neo.
   */
  axisEdge?: 'ROW' | 'COLUMN' | null;
  /**
   * Group/break sort: suppress repeated values and give a subtotal its
   * boundary. The SQL generator emits these ahead of every plain sort.
   */
  sortGroup?: boolean;
  /**
   * The map's query names this item without drawing it as a column.
   *
   * The SQL generator leaves such a row out of the SELECT list; it exists so a
   * migrated Discoverer worksheet records the item its query asked for. Copied
   * on duplication like every other item field — a copy that quietly turned a
   * hidden item into a column would not be a copy.
   */
  isHidden?: boolean;
}

export interface MapConditionInput {
  itemId: string;
  operator: ConditionOperator;
  value?: string | null;
  paramName?: string | null;
  conditionType: 'PARAMETER' | 'STATIC';
  groupId?: string | null;
  logicOperator?: 'AND' | 'OR';
  displayOrder?: number;
}

export interface MapParameterInput {
  name: string;
  paramType: 'STRING' | 'NUMBER' | 'DATE' | 'LIST';
  defaultValue?: string | null;
  isRequired?: boolean;
}

export interface MapCalculatedFieldInput {
  name: string;
  formula: string;
  displayOrder?: number;
}

export interface CreateMapInput {
  name: string;
  description?: string | null;
  mapType: MapType;
  businessAreaId: string;
  isPublic?: boolean;
  items: MapItemInput[];
  conditions?: MapConditionInput[];
  parameters?: MapParameterInput[];
  calculatedFields?: MapCalculatedFieldInput[];
}

export interface UpdateMapInput {
  name?: string;
  description?: string | null;
  mapType?: MapType;
  isPublic?: boolean;
  items?: MapItemInput[];
  conditions?: MapConditionInput[];
  parameters?: MapParameterInput[];
  calculatedFields?: MapCalculatedFieldInput[];
}

export interface MapWithDetails extends Map {
  items: MapItem[];
  conditions: MapCondition[];
  parameters: MapParameter[];
  calculatedFields: MapCalculatedField[];
  /**
   * F-32 — the three the API used to omit. They are not decoration: the
   * estate carries 19 632 totals and a page-setup row for every map, and a
   * client that cannot read them cannot round-trip a map without losing them.
   */
  totals: MapTotal[];
  layouts: MapLayout[];
  pageSetup: MapPageSetup | null;
}

export type MapAction = 'VIEW' | 'EDIT' | 'EXPORT' | 'DELETE' | 'SCHEDULE';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MapValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'MapValidationError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that every referenced item exists and belongs (via its folder) to
 * the map's business area. Throws MapValidationError on failure.
 */
export async function validateMapItems(
  businessAreaId: string | null,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;

  const unique = [...new Set(itemIds)];
  const rows = await db
    .select({
      id: items.id,
      businessAreaId: folders.businessAreaId,
    })
    .from(items)
    .innerJoin(folders, eq(items.folderId, folders.id))
    .where(inArray(items.id, unique));

  // globalThis.Map: the built-in Map class (the schema's `Map` row type
  // shadows the name in this module).
  const found = new globalThis.Map<string, string>(
    rows.map((r) => [r.id, r.businessAreaId]),
  );
  for (const itemId of unique) {
    const ba = found.get(itemId);
    if (!ba) {
      throw new MapValidationError(`Item "${itemId}" does not exist`);
    }
    // `maps.business_area_id` is advisory since D-013, so it only constrains
    // authoring when it is actually set. A map with no business area is scoped
    // by the folders its items live in, which is what the generator, the
    // entitlement gate and row-level security all derive from.
    if (businessAreaId !== null && ba !== businessAreaId) {
      throw new MapValidationError(
        `Item "${itemId}" does not belong to the map's business area`,
      );
    }
  }
}

function validateConditionInputs(conditions: MapConditionInput[]): void {
  for (const c of conditions) {
    if (c.conditionType === 'PARAMETER' && !c.paramName) {
      throw new MapValidationError(
        'PARAMETER conditions must reference a paramName',
      );
    }
    if (
      c.conditionType === 'STATIC' &&
      c.operator !== 'IS_NULL' &&
      (c.value === undefined || c.value === null || c.value === '')
    ) {
      throw new MapValidationError(
        `STATIC condition with operator "${c.operator}" requires a value`,
      );
    }
  }
}

/**
 * Give a map's parameters their bind names, and resolve what its conditions
 * point at.
 *
 * A parameter is authored by its prompt — free text, and after a Discoverer
 * migration routinely `Dt Fim Vigência >=`. What goes into the SQL is a bind
 * name derived from it, and what `map_conditions.param_name` stores is that
 * bind name. Deriving here rather than accepting one from the client keeps the
 * two in step: a client cannot name a bind that no parameter owns, and a
 * renamed prompt re-derives without the caller having to know the rule.
 *
 * Conditions may therefore reference a parameter either way — by the prompt (a
 * UI holding unsaved parameters has nothing else to offer) or by a bind name
 * already assigned (a saved map being re-saved unchanged). Both resolve.
 */
interface BoundParameters {
  rows: Array<MapParameterInput & { bindName: string }>;
  /** Bind name for a condition's reference, or undefined if it names nothing. */
  resolve: (reference: string) => string | undefined;
}

function bindParameters(parameters: MapParameterInput[]): BoundParameters {
  const taken = new Set<string>();
  const byPrompt = new globalThis.Map<string, string>();
  const rows = parameters.map((p) => {
    const bindName = makeBindName(p.name, taken);
    byPrompt.set(p.name, bindName);
    return { ...p, bindName };
  });
  return {
    rows,
    resolve: (reference) =>
      byPrompt.get(reference) ?? (taken.has(reference) ? reference : undefined),
  };
}

function validateParameterInputs(
  parameters: MapParameterInput[],
  conditions: MapConditionInput[],
): void {
  const names = parameters.map((p) => p.name);
  if (new Set(names).size !== names.length) {
    throw new MapValidationError('Parameter names must be unique');
  }
  const { resolve } = bindParameters(parameters);
  for (const c of conditions) {
    if (
      c.conditionType === 'PARAMETER' &&
      c.paramName &&
      resolve(c.paramName) === undefined
    ) {
      throw new MapValidationError(
        `Condition references undefined parameter "${c.paramName}"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Child-row helpers
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertChildren(
  tx: Tx,
  mapId: string,
  input: {
    items: MapItemInput[];
    conditions?: MapConditionInput[];
    parameters?: MapParameterInput[];
    calculatedFields?: MapCalculatedFieldInput[];
  },
): Promise<{
  items: MapItem[];
  conditions: MapCondition[];
  parameters: MapParameter[];
  calculatedFields: MapCalculatedField[];
}> {
  // Derived once: the conditions below store bind names, so they have to be
  // resolved against the very same assignment the parameter rows get.
  const bound = bindParameters(input.parameters ?? []);

  const itemRows = input.items.length
    ? await tx
        .insert(mapItems)
        .values(
          input.items.map((i, idx) => ({
            mapId,
            itemId: i.itemId,
            displayOrder: i.displayOrder ?? idx,
            displayName: i.displayName ?? null,
            formatMask: i.formatMask ?? null,
            aggFunction: i.aggFunction ?? null,
            sortDirection: i.sortDirection ?? null,
            sortOrder: i.sortOrder ?? null,
            columnWidth: i.columnWidth ?? null,
            axisType: i.axisType ?? null,
            axisOrder: i.axisOrder ?? null,
            axisEdge: i.axisEdge ?? null,
            isHidden: i.isHidden ?? false,
            sortGroup: i.sortGroup ?? false,
          })),
        )
        .returning()
    : [];

  const conditionRows = input.conditions?.length
    ? await tx
        .insert(mapConditions)
        .values(
          input.conditions.map((c, idx) => ({
            mapId,
            itemId: c.itemId,
            operator: c.operator,
            value: c.value ?? null,
            // Stored as the parameter's bind name. `validateParameterInputs`
            // has already refused anything that resolves to nothing, so the
            // fallback only carries a STATIC condition's stray value through.
            paramName: c.paramName ? (bound.resolve(c.paramName) ?? c.paramName) : null,
            conditionType: c.conditionType,
            groupId: c.groupId ?? null,
            logicOperator: c.logicOperator ?? 'AND',
            displayOrder: c.displayOrder ?? idx,
          })),
        )
        .returning()
    : [];

  const parameterRows = bound.rows.length
    ? await tx
        .insert(mapParameters)
        .values(
          bound.rows.map((p) => ({
            mapId,
            name: p.name,
            bindName: p.bindName,
            paramType: p.paramType,
            defaultValue: p.defaultValue ?? null,
            isRequired: p.isRequired ?? false,
          })),
        )
        .returning()
    : [];

  const calculatedFieldRows = input.calculatedFields?.length
    ? await tx
        .insert(mapCalculatedFields)
        .values(
          input.calculatedFields.map((f, idx) => ({
            mapId,
            name: f.name,
            formula: f.formula,
            displayOrder: f.displayOrder ?? idx,
          })),
        )
        .returning()
    : [];

  return {
    items: itemRows,
    conditions: conditionRows,
    parameters: parameterRows,
    calculatedFields: calculatedFieldRows,
  };
}

/**
 * BE-02 — what a save would otherwise destroy.
 *
 * `map_totals` and `map_conditional_formats` anchor on `map_items.id` and
 * `map_calculated_fields.id` with `ON DELETE CASCADE`, and a save replaces
 * every one of those rows. So a plain `PUT /api/maps/:id` silently deleted the
 * map's totals — 19 632 rows across the migrated estate — and the API cannot
 * even express them, so the client could not put them back.
 *
 * Neither table is part of `UpdateMapInput`. The fix is to carry them across
 * the replace: snapshot each anchor as a key that survives it (the underlying
 * `items.id` for a map item, the field name for a calculation), then re-point
 * the rows at the new ids afterwards. A total whose column is no longer on the
 * map is dropped — that is what removing a column means.
 */
interface AnchoredChildren {
  totals: Array<Omit<MapTotal, 'id' | 'mapItemId' | 'mapCalculatedFieldId' | 'breakMapItemId'> & {
    itemKey: string | null;
    calculatedFieldKey: string | null;
    breakItemKey: string | null;
  }>;
  formats: Array<Omit<MapConditionalFormat, 'id' | 'mapItemId'> & { itemKey: string | null }>;
}

async function snapshotAnchoredChildren(
  tx: Tx,
  mapId: string,
): Promise<AnchoredChildren> {
  const [totalRows, formatRows, itemRows, calcRows] = await Promise.all([
    tx.select().from(mapTotals).where(eq(mapTotals.mapId, mapId)),
    tx
      .select()
      .from(mapConditionalFormats)
      .where(eq(mapConditionalFormats.mapId, mapId)),
    tx.select().from(mapItems).where(eq(mapItems.mapId, mapId)),
    tx
      .select()
      .from(mapCalculatedFields)
      .where(eq(mapCalculatedFields.mapId, mapId)),
  ]);

  const itemKeyById = new globalThis.Map(itemRows.map((r) => [r.id, r.itemId]));
  const calcKeyById = new globalThis.Map(calcRows.map((r) => [r.id, r.name]));
  const key = <T>(m: globalThis.Map<string, T>, id: string | null): T | null =>
    id === null ? null : (m.get(id) ?? null);

  return {
    totals: totalRows.map(({ id: _id, mapItemId, mapCalculatedFieldId, breakMapItemId, ...rest }) => ({
      ...rest,
      itemKey: key(itemKeyById, mapItemId),
      calculatedFieldKey: key(calcKeyById, mapCalculatedFieldId),
      breakItemKey: key(itemKeyById, breakMapItemId),
    })),
    formats: formatRows.map(({ id: _id, mapItemId, ...rest }) => ({
      ...rest,
      itemKey: key(itemKeyById, mapItemId),
    })),
  };
}

async function restoreAnchoredChildren(
  tx: Tx,
  snapshot: AnchoredChildren,
  newItems: MapItem[],
  newCalculatedFields: MapCalculatedField[],
): Promise<void> {
  // ponytail: first row wins when a map carries the same underlying item
  // twice (the same column on two axes). Discoverer's totals point at a
  // column element, not at an axis placement, so the distinction does not
  // exist in the source. Key on (item, axis) if that ever changes.
  const itemIdByKey = new globalThis.Map<string, string>();
  for (const row of newItems) if (!itemIdByKey.has(row.itemId)) itemIdByKey.set(row.itemId, row.id);
  const calcIdByKey = new globalThis.Map<string, string>();
  for (const row of newCalculatedFields) if (!calcIdByKey.has(row.name)) calcIdByKey.set(row.name, row.id);

  /** null key -> null id; a key that no longer resolves -> undefined (drop). */
  const resolve = (
    m: globalThis.Map<string, string>,
    k: string | null,
  ): string | null | undefined => (k === null ? null : m.get(k));

  const totalValues = [];
  for (const { itemKey, calculatedFieldKey, breakItemKey, ...rest } of snapshot.totals) {
    const mapItemId = resolve(itemIdByKey, itemKey);
    const mapCalculatedFieldId = resolve(calcIdByKey, calculatedFieldKey);
    const breakMapItemId = resolve(itemIdByKey, breakItemKey);
    // Its column, its calculation or its break column is gone from the map.
    if (mapItemId === undefined || mapCalculatedFieldId === undefined || breakMapItemId === undefined) {
      continue;
    }
    totalValues.push({ ...rest, mapItemId, mapCalculatedFieldId, breakMapItemId });
  }
  if (totalValues.length) await tx.insert(mapTotals).values(totalValues);

  const formatValues = [];
  for (const { itemKey, ...rest } of snapshot.formats) {
    const mapItemId = resolve(itemIdByKey, itemKey);
    if (mapItemId === undefined) continue;
    formatValues.push({ ...rest, mapItemId });
  }
  if (formatValues.length) await tx.insert(mapConditionalFormats).values(formatValues);
}

async function deleteChildren(tx: Tx, mapId: string): Promise<void> {
  await tx.delete(mapItems).where(eq(mapItems.mapId, mapId));
  await tx.delete(mapConditions).where(eq(mapConditions.mapId, mapId));
  await tx.delete(mapParameters).where(eq(mapParameters.mapId, mapId));
  await tx
    .delete(mapCalculatedFields)
    .where(eq(mapCalculatedFields.mapId, mapId));
}

type MapChildren = Omit<MapWithDetails, keyof Map>;

async function loadChildren(mapId: string, tx: Tx | typeof db = db): Promise<MapChildren> {
  const [
    itemRows,
    conditionRows,
    parameterRows,
    calculatedFieldRows,
    totalRows,
    layoutRows,
    pageSetupRows,
  ] = await Promise.all([
    tx
      .select()
      .from(mapItems)
      .where(eq(mapItems.mapId, mapId))
      .orderBy(asc(mapItems.displayOrder)),
    tx
      .select()
      .from(mapConditions)
      .where(eq(mapConditions.mapId, mapId))
      .orderBy(asc(mapConditions.displayOrder)),
    tx
      .select()
      .from(mapParameters)
      .where(eq(mapParameters.mapId, mapId))
      .orderBy(asc(mapParameters.name)),
    tx
      .select()
      .from(mapCalculatedFields)
      .where(eq(mapCalculatedFields.mapId, mapId))
      .orderBy(asc(mapCalculatedFields.displayOrder)),
    tx
      .select()
      .from(mapTotals)
      .where(eq(mapTotals.mapId, mapId))
      .orderBy(asc(mapTotals.displayOrder)),
    tx
      .select()
      .from(mapLayouts)
      .where(eq(mapLayouts.mapId, mapId))
      .orderBy(asc(mapLayouts.worksheetIndex)),
    tx.select().from(mapPageSetup).where(eq(mapPageSetup.mapId, mapId)).limit(1),
  ]);

  return {
    items: itemRows,
    conditions: conditionRows,
    parameters: parameterRows,
    calculatedFields: calculatedFieldRows,
    totals: totalRows,
    layouts: layoutRows,
    pageSetup: pageSetupRows[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a map with its items, conditions, parameters, and calculated fields.
 */
export async function create(
  data: CreateMapInput,
  createdBy: string,
): Promise<MapWithDetails> {
  if (!data.items || data.items.length === 0) {
    throw new MapValidationError('A map must contain at least one item');
  }

  const referencedItemIds = [
    ...data.items.map((i) => i.itemId),
    ...(data.conditions ?? []).map((c) => c.itemId),
  ];
  await validateMapItems(data.businessAreaId, referencedItemIds);
  validateConditionInputs(data.conditions ?? []);
  validateParameterInputs(data.parameters ?? [], data.conditions ?? []);

  return db.transaction(async (tx) => {
    const [map] = await tx
      .insert(maps)
      .values({
        name: data.name,
        description: data.description ?? null,
        mapType: data.mapType,
        businessAreaId: data.businessAreaId,
        createdBy,
        isPublic: data.isPublic ?? false,
      })
      .returning();

    const children = await insertChildren(tx, map!.id, data);
    // A new map has no totals, layouts or page setup yet — only the migrator
    // and the (future) worksheet editor write those.
    return { ...map!, ...children, totals: [], layouts: [], pageSetup: null };
  });
}

/**
 * Update a map. When child collections are provided they replace the
 * existing ones atomically; omitted collections are left untouched.
 */
export async function update(
  id: string,
  data: UpdateMapInput,
): Promise<MapWithDetails | null> {
  const [existing] = await db
    .select()
    .from(maps)
    .where(and(eq(maps.id, id), eq(maps.isActive, true)))
    .limit(1);
  if (!existing) return null;

  const replacingChildren =
    data.items !== undefined ||
    data.conditions !== undefined ||
    data.parameters !== undefined ||
    data.calculatedFields !== undefined;

  if (replacingChildren) {
    // Replacement is all-or-nothing so that validation always sees the
    // complete picture (conditions may reference parameters, etc.).
    if (!data.items || data.items.length === 0) {
      throw new MapValidationError(
        'Updating map contents requires the full items list (at least one item)',
      );
    }
    const referencedItemIds = [
      ...data.items.map((i) => i.itemId),
      ...(data.conditions ?? []).map((c) => c.itemId),
    ];
    await validateMapItems(existing.businessAreaId, referencedItemIds);
    validateConditionInputs(data.conditions ?? []);
    validateParameterInputs(data.parameters ?? [], data.conditions ?? []);
  }

  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined) values.description = data.description;
    if (data.mapType !== undefined) values.mapType = data.mapType;
    if (data.isPublic !== undefined) values.isPublic = data.isPublic;

    const [map] = await tx
      .update(maps)
      .set(values)
      .where(eq(maps.id, id))
      .returning();

    if (replacingChildren) {
      // BE-02: totals and conditional formats cascade off `map_items`; carry
      // them across the replace rather than letting the save delete them.
      const anchored = await snapshotAnchoredChildren(tx, id);
      await deleteChildren(tx, id);
      const inserted = await insertChildren(tx, id, {
        items: data.items!,
        conditions: data.conditions,
        parameters: data.parameters,
        calculatedFields: data.calculatedFields,
      });
      await restoreAnchoredChildren(
        tx,
        anchored,
        inserted.items,
        inserted.calculatedFields,
      );
      return { ...map!, ...(await loadChildren(id, tx)) };
    }

    const children = await loadChildren(id, tx);
    return { ...map!, ...children };
  });
}

/**
 * Get a map with all child entities. Returns null for missing or
 * soft-deleted maps.
 */
export async function getById(id: string): Promise<MapWithDetails | null> {
  const [map] = await db
    .select()
    .from(maps)
    .where(and(eq(maps.id, id), eq(maps.isActive, true)))
    .limit(1);
  if (!map) return null;

  const children = await loadChildren(id);
  return { ...map, ...children };
}

/** List active maps in a business area. */
export async function listByBusinessArea(
  businessAreaId: string,
): Promise<Map[]> {
  return db
    .select()
    .from(maps)
    .where(
      and(eq(maps.businessAreaId, businessAreaId), eq(maps.isActive, true)),
    )
    .orderBy(maps.name);
}

/** List active maps created by a user. */
export async function listByUser(userId: string): Promise<Map[]> {
  return db
    .select()
    .from(maps)
    .where(and(eq(maps.createdBy, userId), eq(maps.isActive, true)))
    .orderBy(maps.name);
}

/**
 * F-07 — every map the caller may see, in one list.
 *
 * `GET /api/maps` returned `{ mine, shared }`, which for an estate migrated
 * under one service account is `{ mine: [], shared: [] }` for everyone else:
 * all 923 maps invisible. This is the third scope.
 *
 * The predicate mirrors `canAccessMap(user, map, 'VIEW')` exactly, in SQL,
 * because calling it per row would be two round trips per map. The mirroring
 * is pinned by a test — if the two ever disagree, that test fails, not a user.
 *
 * Listing is not entitlement. `assertDataEntitlement` still governs execution
 * (Phase 1.1's second gate); appearing here only means the map OBJECT is
 * readable.
 */
export async function listAll(user: {
  sub: string;
  role: string;
}): Promise<Map[]> {
  if (user.role === 'ADMIN') {
    return db
      .select()
      .from(maps)
      .where(eq(maps.isActive, true))
      .orderBy(maps.name);
  }

  const [grantRows, shareRows] = await Promise.all([
    db
      .select({ businessAreaId: userBusinessAreaGrants.businessAreaId })
      .from(userBusinessAreaGrants)
      .where(eq(userBusinessAreaGrants.userId, user.sub)),
    db
      .select({ mapId: mapShares.mapId })
      .from(mapShares)
      .where(eq(mapShares.sharedWithUserId, user.sub)),
  ]);

  const grantedBaIds = [...new Set(grantRows.map((r) => r.businessAreaId))];
  const sharedMapIds = [...new Set(shareRows.map((r) => r.mapId))];

  // Every share level grants VIEW (see SHARE_ALLOWS), and VIEW is the bottom
  // of the permission hierarchy, so holding any grant on the business area is
  // enough. `inArray` on a nullable column never matches NULL, which is the
  // behaviour we want: a map with no business area is not visible through a
  // grant — matching `canAccessMap`'s `if (!map.businessAreaId) return false`.
  const visible = [
    eq(maps.createdBy, user.sub),
    eq(maps.isPublic, true),
    ...(sharedMapIds.length ? [inArray(maps.id, sharedMapIds)] : []),
    ...(grantedBaIds.length
      ? [inArray(maps.businessAreaId, grantedBaIds)]
      : []),
  ];

  return db
    .select()
    .from(maps)
    .where(and(eq(maps.isActive, true), or(...visible)))
    .orderBy(maps.name);
}

/** List active maps shared with a user. */
export async function listSharedWithUser(
  userId: string,
): Promise<(Map & { sharePermission: string })[]> {
  const rows = await db
    .select({ map: maps, permissionLevel: mapShares.permissionLevel })
    .from(mapShares)
    .innerJoin(maps, eq(mapShares.mapId, maps.id))
    .where(
      and(eq(mapShares.sharedWithUserId, userId), eq(maps.isActive, true)),
    )
    .orderBy(maps.name);

  return rows.map((r) => ({ ...r.map, sharePermission: r.permissionLevel }));
}

/** Soft-delete a map (set isActive = false). */
export async function softDelete(id: string): Promise<boolean> {
  const [row] = await db
    .update(maps)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(maps.id, id), eq(maps.isActive, true)))
    .returning({ id: maps.id });
  return !!row;
}

/**
 * Deep-copy a map with all child entities. The copy is owned by
 * `newCreatedBy` and is always private initially.
 */
export async function duplicate(
  id: string,
  newCreatedBy: string,
  newName?: string,
): Promise<MapWithDetails | null> {
  const source = await getById(id);
  if (!source) return null;

  // The copy re-derives its own bind names, and it derives them in the order
  // `getById` returns parameters (by name) rather than the order the original
  // was authored in. Where two prompts reduce to the same base that is a
  // different assignment, so a condition carried over by bind name could land
  // on the other parameter. Carrying it over by *prompt* is order-independent.
  const promptByBindName = new globalThis.Map(
    source.parameters.map((p) => [p.bindName, p.name]),
  );

  return db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(maps)
      .values({
        name: newName ?? `${source.name} (copy)`,
        description: source.description,
        mapType: source.mapType,
        businessAreaId: source.businessAreaId,
        createdBy: newCreatedBy,
        isPublic: false,
        selectDistinct: source.selectDistinct,
      })
      .returning();

    // Totals, conditional formats, layouts and page setup are not part of
    // `insertChildren` (the API cannot express them). Copy them explicitly —
    // a duplicate that quietly loses the original's totals is the same bug as
    // BE-02, one call site over.
    const anchored = await snapshotAnchoredChildren(tx, id);

    const children = await insertChildren(tx, copy!.id, {
      items: source.items.map((i) => ({
        itemId: i.itemId,
        displayOrder: i.displayOrder,
        displayName: i.displayName,
        formatMask: i.formatMask,
        aggFunction: i.aggFunction,
        sortDirection: i.sortDirection,
        sortOrder: i.sortOrder,
        columnWidth: i.columnWidth,
        axisType: i.axisType,
        axisOrder: i.axisOrder,
        axisEdge: i.axisEdge,
        isHidden: i.isHidden,
        sortGroup: i.sortGroup,
      })),
      conditions: source.conditions.map((c) => ({
        itemId: c.itemId,
        operator: c.operator,
        value: c.value,
        paramName:
          c.paramName === null
            ? null
            : (promptByBindName.get(c.paramName) ?? c.paramName),
        conditionType: c.conditionType,
        groupId: c.groupId,
        logicOperator: c.logicOperator,
        displayOrder: c.displayOrder,
      })),
      parameters: source.parameters.map((p) => ({
        name: p.name,
        paramType: p.paramType as MapParameterInput['paramType'],
        defaultValue: p.defaultValue,
        isRequired: p.isRequired,
      })),
      calculatedFields: source.calculatedFields.map((f) => ({
        name: f.name,
        formula: f.formula,
        displayOrder: f.displayOrder,
      })),
    });

    await restoreAnchoredChildren(
      tx,
      anchored,
      children.items,
      children.calculatedFields,
    );

    for (const layout of source.layouts) {
      const { id: _id, mapId: _mapId, createdAt: _createdAt, ...rest } = layout;
      await tx.insert(mapLayouts).values({ ...rest, mapId: copy!.id });
    }
    if (source.pageSetup) {
      const { id: _id, mapId: _mapId, createdAt: _createdAt, ...rest } = source.pageSetup;
      await tx.insert(mapPageSetup).values({ ...rest, mapId: copy!.id });
    }

    return { ...copy!, ...(await loadChildren(copy!.id, tx)) };
  });
}

// ---------------------------------------------------------------------------
// XML export
// ---------------------------------------------------------------------------

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Serialize the full map definition as XML (Discoverer Neo's own map
 * definition format — used for backup/exchange, not EUL-compatible).
 */
export async function exportAsXml(id: string): Promise<string | null> {
  const map = await getById(id);
  if (!map) return null;

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<map id="${map.id}" name="${xmlEscape(map.name)}" type="${map.mapType}" businessAreaId="${map.businessAreaId}" isPublic="${map.isPublic}">`,
  ];
  if (map.description) {
    lines.push(`  <description>${xmlEscape(map.description)}</description>`);
  }

  lines.push('  <items>');
  for (const i of map.items) {
    const attrs = [
      `itemId="${i.itemId}"`,
      `displayOrder="${i.displayOrder}"`,
      i.displayName ? `displayName="${xmlEscape(i.displayName)}"` : null,
      i.formatMask ? `formatMask="${xmlEscape(i.formatMask)}"` : null,
      i.aggFunction ? `aggFunction="${xmlEscape(i.aggFunction)}"` : null,
      i.sortDirection ? `sortDirection="${i.sortDirection}"` : null,
      i.sortOrder !== null ? `sortOrder="${i.sortOrder}"` : null,
      i.columnWidth !== null ? `columnWidth="${i.columnWidth}"` : null,
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`    <item ${attrs} />`);
  }
  lines.push('  </items>');

  lines.push('  <conditions>');
  for (const c of map.conditions) {
    const attrs = [
      `itemId="${c.itemId}"`,
      `operator="${xmlEscape(c.operator)}"`,
      `type="${c.conditionType}"`,
      `logic="${c.logicOperator}"`,
      c.value !== null ? `value="${xmlEscape(c.value)}"` : null,
      // The parameter's bind name — match it to a <parameter bindName="...">
      // below to recover the prompt it stands for.
      c.paramName ? `paramName="${xmlEscape(c.paramName)}"` : null,
      c.groupId ? `groupId="${c.groupId}"` : null,
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`    <condition ${attrs} />`);
  }
  lines.push('  </conditions>');

  lines.push('  <parameters>');
  for (const p of map.parameters) {
    const attrs = [
      `name="${xmlEscape(p.name)}"`,
      `bindName="${xmlEscape(p.bindName)}"`,
      `type="${p.paramType}"`,
      `required="${p.isRequired}"`,
      p.defaultValue !== null ? `default="${xmlEscape(p.defaultValue)}"` : null,
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`    <parameter ${attrs} />`);
  }
  lines.push('  </parameters>');

  lines.push('  <calculatedFields>');
  for (const f of map.calculatedFields) {
    lines.push(
      `    <calculatedField name="${xmlEscape(f.name)}" displayOrder="${f.displayOrder}">${xmlEscape(f.formula)}</calculatedField>`,
    );
  }
  lines.push('  </calculatedFields>');
  lines.push('</map>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

const SHARE_ALLOWS: Record<string, MapAction[]> = {
  VIEW: ['VIEW'],
  EXPORT: ['VIEW', 'EXPORT'],
  EDIT: ['VIEW', 'EXPORT', 'EDIT'],
};

/**
 * GATE 1 of 2 (D-016): may this user see this map OBJECT?
 *
 * It does NOT answer "may this user read the data the map touches". Four of
 * the five grant paths below return before any business-area check, so a
 * folder rule bolted onto the last branch would leave map sharing as
 * business-area grant escalation: I own a map over folders in a business area
 * you were never granted, I share it with you, you read the data.
 *
 * The data question is `assertDataEntitlement` in business-area.service.ts,
 * which runs unconditionally on every execute and export path.
 *
 * A map with no business area (the column is advisory and nullable since
 * D-013) has no grant to check, so it falls through to false — fail-closed on
 * the object gate; the data gate decides the rest.
 *
 * Rules (first match wins):
 *  - admins may do anything
 *  - the map owner may do anything
 *  - a public map is viewable/exportable by any authenticated user
 *  - an explicit share grants its permission level (EDIT ⊇ EXPORT ⊇ VIEW)
 *  - a business-area grant of the corresponding level applies
 *  - DELETE is owner/admin only (beyond BA DELETE grant)
 */
export async function canAccessMap(
  user: { sub: string; role: string },
  map: Map,
  action: MapAction,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (map.createdBy === user.sub) return true;

  if (map.isPublic && (action === 'VIEW' || action === 'EXPORT')) return true;

  const [share] = await db
    .select()
    .from(mapShares)
    .where(
      and(eq(mapShares.mapId, map.id), eq(mapShares.sharedWithUserId, user.sub)),
    )
    .limit(1);
  if (share && SHARE_ALLOWS[share.permissionLevel]?.includes(action)) {
    return true;
  }

  if (!map.businessAreaId) return false;

  const { hasPermission } = await userHasPermission(
    user.sub,
    map.businessAreaId,
    action,
  );
  return hasPermission;
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export interface ShareWithUser extends MapShare {
  sharedWithEmail: string | null;
  sharedWithName: string | null;
}

/** List all shares for a map, with user display info. */
export async function listShares(mapId: string): Promise<ShareWithUser[]> {
  const rows = await db
    .select({
      share: mapShares,
      email: users.email,
      name: users.name,
    })
    .from(mapShares)
    .leftJoin(users, eq(mapShares.sharedWithUserId, users.id))
    .where(eq(mapShares.mapId, mapId));

  return rows.map((r) => ({
    ...r.share,
    sharedWithEmail: r.email,
    sharedWithName: r.name,
  }));
}

/** Create or update a share (upsert on map+user). */
export async function shareWith(
  mapId: string,
  sharedWithUserId: string,
  permissionLevel: 'VIEW' | 'EDIT' | 'EXPORT',
  sharedBy: string,
): Promise<MapShare> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, sharedWithUserId))
    .limit(1);
  if (!target) {
    throw new MapValidationError('Target user does not exist');
  }

  const [existing] = await db
    .select()
    .from(mapShares)
    .where(
      and(
        eq(mapShares.mapId, mapId),
        eq(mapShares.sharedWithUserId, sharedWithUserId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(mapShares)
      .set({ permissionLevel, sharedBy })
      .where(eq(mapShares.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(mapShares)
    .values({ mapId, sharedWithUserId, permissionLevel, sharedBy })
    .returning();
  return created!;
}

/** Remove a share. Returns false when no share existed. */
export async function revokeShare(
  mapId: string,
  sharedWithUserId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(mapShares)
    .where(
      and(
        eq(mapShares.mapId, mapId),
        eq(mapShares.sharedWithUserId, sharedWithUserId),
      ),
    )
    .returning({ id: mapShares.id });
  return deleted.length > 0;
}
