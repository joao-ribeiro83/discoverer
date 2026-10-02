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
  items,
  folders,
  users,
  workbooks,
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
import { makeBindName } from '../lib/sql/identifiers.js';
import { substituteTitleTokens } from '../lib/title-tokens.js';

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
  /** Exactly one of `itemId` / `calculatedFieldName` must be set. */
  itemId?: string | null;
  /**
   * Names a calculated field in the SAME request rather than an id, because
   * `calculatedFields` is fully replaced on every save (BE-02) and gets fresh
   * ids each time — the same reason `paramName` names a parameter by prompt
   * rather than by bind name.
   */
  calculatedFieldName?: string | null;
  /** The right-hand side is this calculated field, named the same way. */
  valueCalculatedFieldName?: string | null;
  operator: ConditionOperator;
  value?: string | null;
  paramName?: string | null;
  conditionType: 'PARAMETER' | 'STATIC';
  groupId?: string | null;
  logicOperator?: 'AND' | 'OR';
  displayOrder?: number;
  /** Per-node negation (Oracle's `IsNot`). Defaults to false. */
  negated?: boolean;
  /** Text comparisons only. Defaults to true — Oracle's own default. */
  caseSensitive?: boolean;
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
  /**
   * Items the map already references. A migrated worksheet routinely draws on
   * folders of several business areas (925 of 926 in the live estate), so
   * holding those to the map's own area made almost every one unsaveable.
   * What is already on the map may stay; only a newly added item must come
   * from the map's area.
   */
  alreadyOnMap: ReadonlySet<string> = new Set(),
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
    if (businessAreaId !== null && ba !== businessAreaId && !alreadyOnMap.has(itemId)) {
      throw new MapValidationError(
        `Item "${itemId}" does not belong to the map's business area`,
      );
    }
  }
}

function validateConditionInputs(conditions: MapConditionInput[]): void {
  for (const c of conditions) {
    if (Boolean(c.itemId) === Boolean(c.calculatedFieldName)) {
      throw new MapValidationError(
        'A condition must reference exactly one of itemId or calculatedFieldName',
      );
    }
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

function validateCalculatedFieldReferences(
  calculatedFields: MapCalculatedFieldInput[],
  conditions: MapConditionInput[],
): void {
  const names = new Set(calculatedFields.map((f) => f.name));
  for (const c of conditions) {
    for (const name of [c.calculatedFieldName, c.valueCalculatedFieldName]) {
      if (name && !names.has(name)) {
        throw new MapValidationError(
          `Condition references undefined calculated field "${name}"`,
        );
      }
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

  // Calculated fields are inserted before conditions so a condition can
  // resolve `calculatedFieldName` against the row this same save just made —
  // fields are fully replaced on every save (BE-02) and get fresh ids each
  // time, so a condition cannot carry one over from before.
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
  const calcFieldIdByName = new globalThis.Map(
    calculatedFieldRows.map((f) => [f.name, f.id]),
  );

  const conditionRows = input.conditions?.length
    ? await tx
        .insert(mapConditions)
        .values(
          input.conditions.map((c, idx) => ({
            mapId,
            itemId: c.itemId ?? null,
            // `validateCalculatedFieldReferences` has already refused a name
            // matching no calculated field in this same request.
            calculatedFieldId: c.calculatedFieldName
              ? (calcFieldIdByName.get(c.calculatedFieldName) ?? null)
              : null,
            valueCalculatedFieldId: c.valueCalculatedFieldName
              ? (calcFieldIdByName.get(c.valueCalculatedFieldName) ?? null)
              : null,
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
            negated: c.negated ?? false,
            caseSensitive: c.caseSensitive ?? true,
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
  /**
   * Migrated column detail the save payload has no field for. Without this a
   * builder save wrote these columns back as null on every item. Keyed by the
   * underlying item, in display order, so the k-th copy of an item gets the
   * k-th copy's detail back.
   */
  itemDetail: Array<Pick<MapItem, (typeof ITEM_DETAIL_KEYS)[number] | 'itemId'>>;
}

const ITEM_DETAIL_KEYS = [
  'axisOrder',
  'dataType',
  'headingFormatMask',
  'alignment',
  'wordWrap',
  'sortRank',
  'sourceElementId',
  'sourceAttrs',
] as const;

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
    itemDetail: [...itemRows]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((r) => ({
        itemId: r.itemId,
        ...Object.fromEntries(ITEM_DETAIL_KEYS.map((k) => [k, r[k]])),
      })) as AnchoredChildren['itemDetail'],
  };
}

/**
 * Put each item's migrated detail back. `axisOrder` is the one detail the
 * payload can carry, so it is only restored where the payload left it out.
 */
async function restoreItemDetail(
  tx: Tx,
  snapshot: AnchoredChildren,
  newItems: MapItem[],
  inputItems: MapItemInput[],
): Promise<void> {
  const pending = new globalThis.Map<string, AnchoredChildren['itemDetail']>();
  for (const d of snapshot.itemDetail) {
    pending.set(d.itemId, [...(pending.get(d.itemId) ?? []), d]);
  }
  for (const [idx, row] of newItems.entries()) {
    const detail = pending.get(row.itemId)?.shift();
    if (!detail) continue;
    const { itemId: _itemId, axisOrder, ...rest } = detail;
    const set: Partial<MapItem> = { ...rest };
    if (inputItems[idx]?.axisOrder === undefined) set.axisOrder = axisOrder;
    await tx.update(mapItems).set(set).where(eq(mapItems.id, row.id));
  }
}

async function restoreAnchoredChildren(
  tx: Tx,
  /**
   * Where the rows go. Not the snapshot's own `mapId`: on a duplicate that is
   * the SOURCE map, and writing there gave the original a second set of
   * totals pointing at the copy's columns on every copy.
   */
  mapId: string,
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
    totalValues.push({ ...rest, mapId, mapItemId, mapCalculatedFieldId, breakMapItemId });
  }
  if (totalValues.length) await tx.insert(mapTotals).values(totalValues);

  const formatValues = [];
  for (const { itemKey, ...rest } of snapshot.formats) {
    const mapItemId = resolve(itemIdByKey, itemKey);
    if (mapItemId === undefined) continue;
    formatValues.push({ ...rest, mapId, mapItemId });
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

  // `&Date`, `&Time` and `&<ParamName>` substitute here, not at migration —
  // see `substituteTitleTokens`. Outside an actual execution the best
  // available value for a named token is the parameter's own default.
  const paramValues = defaultParamValues(parameterRows);
  const resolvedLayouts = layoutRows.map((layout) => ({
    ...layout,
    title: substituteTitleTokens(layout.title, paramValues),
    titleRtf: substituteTitleTokens(layout.titleRtf, paramValues),
    titleHtml: substituteTitleTokens(layout.titleHtml, paramValues),
  }));

  return {
    items: itemRows,
    conditions: conditionRows,
    parameters: parameterRows,
    calculatedFields: calculatedFieldRows,
    totals: totalRows,
    layouts: resolvedLayouts,
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
    ...(data.conditions ?? [])
      .map((c) => c.itemId)
      .filter((id): id is string => typeof id === 'string'),
  ];
  await validateMapItems(data.businessAreaId, referencedItemIds);
  validateConditionInputs(data.conditions ?? []);
  validateParameterInputs(data.parameters ?? [], data.conditions ?? []);
  validateCalculatedFieldReferences(
    data.calculatedFields ?? [],
    data.conditions ?? [],
  );

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
      ...(data.conditions ?? [])
        .map((c) => c.itemId)
        .filter((id): id is string => typeof id === 'string'),
    ];
    const [onMapItems, onMapConditions] = await Promise.all([
      db.select({ id: mapItems.itemId }).from(mapItems).where(eq(mapItems.mapId, id)),
      db.select({ id: mapConditions.itemId }).from(mapConditions).where(eq(mapConditions.mapId, id)),
    ]);
    await validateMapItems(
      existing.businessAreaId,
      referencedItemIds,
      new Set([...onMapItems, ...onMapConditions].map((r) => r.id).filter((v) => v !== null)),
    );
    validateConditionInputs(data.conditions ?? []);
    validateParameterInputs(data.parameters ?? [], data.conditions ?? []);
    validateCalculatedFieldReferences(
      data.calculatedFields ?? [],
      data.conditions ?? [],
    );
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
        id,
        anchored,
        inserted.items,
        inserted.calculatedFields,
      );
      await restoreItemDetail(tx, anchored, inserted.items, data.items!);
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
  // The description carries the same `&Date (&Time) &<ParamName>` heading text
  // as the worksheet title — every one of this estate's 923 maps has tokens in
  // it — and it is what the viewer prints above the grid. Substituting the
  // title but not the description left the tokens on screen.
  return {
    ...map,
    description: substituteTitleTokens(
      map.description,
      withNameTokens(defaultParamValues(children.parameters), map.name),
    ),
    ...children,
  };
}

/**
 * Discoverer's other title text variables: `&Workbook` and `&Worksheet`. A Neo
 * map is one worksheet, imported under its own name, so both print that name.
 */
function withNameTokens(values: globalThis.Map<string, string>, mapName: string) {
  values.set('Workbook', mapName);
  values.set('Worksheet', mapName);
  return values;
}

/** A map's parameter defaults, as `substituteTitleTokens` wants them. */
function defaultParamValues(
  parameters: Array<{ name: string; defaultValue: string | null }>,
): globalThis.Map<string, string> {
  return new globalThis.Map(
    parameters
      .filter((p): p is typeof p & { defaultValue: string } => p.defaultValue !== null)
      .map((p) => [p.name, p.defaultValue]),
  );
}

/**
 * The map's heading text rendered with the parameter values an execution
 * actually ran with, rather than the defaults `getById` can see.
 *
 * `&Date`/`&Time` print the moment of the run. A parameter the caller left out
 * falls back to its default, and an unknown token is left as written — the
 * same rules `substituteTitleTokens` applies everywhere else.
 */
export async function resolveHeading(
  mapId: string,
  supplied: Record<string, unknown> = {},
  now: Date = new Date(),
): Promise<{
  title: string | null;
  description: string | null;
  /** Parameters with a value this run that the heading text does not already print. */
  parameters: Array<{ name: string; value: string }>;
  runAt: Date;
}> {
  const [[map], parameterRows] = await Promise.all([
    db
      .select({ name: maps.name, description: maps.description })
      .from(maps)
      .where(eq(maps.id, mapId))
      .limit(1),
    db.select().from(mapParameters).where(eq(mapParameters.mapId, mapId)),
  ]);
  const [layout] = await db
    .select({ title: mapLayouts.title })
    .from(mapLayouts)
    .where(eq(mapLayouts.mapId, mapId))
    .orderBy(asc(mapLayouts.worksheetIndex))
    .limit(1);

  const values = defaultParamValues(parameterRows);
  for (const p of parameterRows) {
    const given = supplied[p.name];
    // A parameter value arrives as JSON, so it can be any scalar. Only the
    // ones that read back as themselves are printable in a heading.
    if (typeof given === 'string' && given !== '') values.set(p.name, given);
    else if (typeof given === 'number' || typeof given === 'boolean') {
      values.set(p.name, String(given));
    }
  }

  // The heading text already prints the parameters it names as `&<Name>`
  // tokens; only the ones it does not mention are listed after it, so each
  // value appears on the page exactly once.
  const rawText = `${layout?.title ?? ''}\n${map?.description ?? ''}`.toLowerCase();
  const parameters = parameterRows
    .filter((p) => values.has(p.name) && !rawText.includes(`&${p.name.toLowerCase()}`))
    .map((p) => ({ name: p.name, value: values.get(p.name)! }));
  if (map) withNameTokens(values, map.name);

  return {
    title: substituteTitleTokens(layout?.title ?? null, values, now),
    description: substituteTitleTokens(map?.description ?? null, values, now),
    parameters,
    runAt: now,
  };
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
  // A MANAGER sees every map (see canAccessMap), same as an ADMIN.
  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return db
      .select()
      .from(maps)
      .where(eq(maps.isActive, true))
      .orderBy(maps.name);
  }

  const shareRows = await db
    .select({ mapId: mapShares.mapId })
    .from(mapShares)
    .where(eq(mapShares.sharedWithUserId, user.sub));
  const sharedMapIds = [...new Set(shareRows.map((r) => r.mapId))];

  // Every share level grants VIEW (see SHARE_ALLOWS). A business-area grant
  // no longer shows maps — it is a data entitlement only.
  const visible = [
    eq(maps.createdBy, user.sub),
    eq(maps.isPublic, true),
    ...(sharedMapIds.length ? [inArray(maps.id, sharedMapIds)] : []),
  ];

  return db
    .select()
    .from(maps)
    .where(and(eq(maps.isActive, true), or(...visible)))
    .orderBy(maps.name);
}

/**
 * Add the owner's and the workbook's display names to listed maps, for the
 * Maps page table. Two queries for the whole list, not two per row.
 */
export async function withListNames<T extends Map>(
  rows: T[],
): Promise<(T & { ownerName: string | null; workbookName: string | null })[]> {
  const ownerIds = [...new Set(rows.map((r) => r.createdBy))];
  const workbookIds = [...new Set(rows.map((r) => r.workbookId).filter((id): id is string => !!id))];
  const [owners, books] = await Promise.all([
    ownerIds.length
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ownerIds))
      : [],
    workbookIds.length
      ? db
          .select({ id: workbooks.id, name: workbooks.name })
          .from(workbooks)
          .where(inArray(workbooks.id, workbookIds))
      : [],
  ]);
  const ownerName = new globalThis.Map(owners.map((o) => [o.id, o.name]));
  const workbookName = new globalThis.Map(books.map((b) => [b.id, b.name]));
  return rows.map((r) => ({
    ...r,
    ownerName: ownerName.get(r.createdBy) ?? null,
    workbookName: r.workbookId ? (workbookName.get(r.workbookId) ?? null) : null,
  }));
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
 *
 * `workbookId` files the copy as a worksheet of that workbook; without it the
 * copy stands alone. `tx` runs the copy inside a caller's transaction, so a
 * workbook copy is all-or-nothing.
 */
export async function duplicate(
  id: string,
  newCreatedBy: string,
  newName?: string,
  opts: { workbookId?: string; tx?: Tx } = {},
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
  // Same reasoning as `promptByBindName`: `calculatedFieldId` will not survive
  // the copy (fields get fresh ids), so a condition on one is carried over by
  // NAME and re-resolved once the copy's own fields are inserted.
  const calcFieldNameById = new globalThis.Map(
    source.calculatedFields.map((f) => [f.id, f.name]),
  );

  return (opts.tx ?? db).transaction(async (tx) => {
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
        // Same query, same filters lost in migration — keep saying so.
        droppedFilters: source.droppedFilters,
        workbookId: opts.workbookId ?? null,
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
        itemId: c.itemId ?? undefined,
        calculatedFieldName: c.calculatedFieldId
          ? calcFieldNameById.get(c.calculatedFieldId)
          : undefined,
        valueCalculatedFieldName: c.valueCalculatedFieldId
          ? calcFieldNameById.get(c.valueCalculatedFieldId)
          : undefined,
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
        negated: c.negated,
        caseSensitive: c.caseSensitive,
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
      copy!.id,
      anchored,
      children.items,
      children.calculatedFields,
    );
    await restoreItemDetail(tx, anchored, children.items, source.items);

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
      c.itemId ? `itemId="${c.itemId}"` : null,
      c.calculatedFieldId ? `calculatedFieldId="${c.calculatedFieldId}"` : null,
      `operator="${xmlEscape(c.operator)}"`,
      `type="${c.conditionType}"`,
      `logic="${c.logicOperator}"`,
      c.value !== null ? `value="${xmlEscape(c.value)}"` : null,
      // The parameter's bind name — match it to a <parameter bindName="...">
      // below to recover the prompt it stands for.
      c.paramName ? `paramName="${xmlEscape(c.paramName)}"` : null,
      c.groupId ? `groupId="${c.groupId}"` : null,
      c.negated ? `negated="true"` : null,
      c.caseSensitive === false ? `caseSensitive="false"` : null,
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
  // A person a map was assigned to is expected to run it, export the result,
  // and put it on a schedule — that is what the map is for. SCHEDULE rides
  // with EXPORT because both produce the same artifact; the only difference
  // is who pressed the button. VIEW stays read-only, for a deliberately
  // narrow share.
  EXPORT: ['VIEW', 'EXPORT', 'SCHEDULE'],
  EDIT: ['VIEW', 'EXPORT', 'SCHEDULE', 'EDIT'],
};

/**
 * What a MANAGER may do to ANY map: see it, run it, export and schedule it —
 * the same as an EXPORT share. Changing or deleting it stays with the owner,
 * an EDIT share, or an admin.
 */
const MANAGER_ALLOWS: MapAction[] = ['VIEW', 'EXPORT', 'SCHEDULE'];

/**
 * GATE 1 of 2 (D-016): may this user see this map OBJECT?
 *
 * It does NOT answer "may this user read the data the map touches". Every
 * path below returns before any business-area check, so map sharing could
 * otherwise become business-area grant escalation: I own a map over folders
 * in a business area you were never granted, I share it with you, you read
 * the data.
 *
 * The data question is `assertDataEntitlement` in business-area.service.ts,
 * which runs unconditionally on every execute and export path.
 *
 * A business-area grant does NOT show a map. It is a data entitlement only.
 * Discoverer drew the same line: seeing someone else's saved workbook needed
 * an explicit workbook grant (`ACCESS_PRIVS.AP_TYPE = 'GD'`), which migrates
 * into `map_shares`.
 *
 * Rules (first match wins):
 *  - admins may do anything
 *  - the map owner may do anything
 *  - a public map is viewable/exportable by any authenticated user
 *  - a MANAGER may view, export and schedule every map (MANAGER_ALLOWS)
 *  - an explicit share grants its permission level (EDIT ⊇ EXPORT ⊇ VIEW)
 *  - nothing else — DELETE is owner/admin only
 */
export async function canAccessMap(
  user: { sub: string; role: string },
  map: Map,
  action: MapAction,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (map.createdBy === user.sub) return true;

  if (map.isPublic && (action === 'VIEW' || action === 'EXPORT')) return true;
  if (user.role === 'MANAGER' && MANAGER_ALLOWS.includes(action)) return true;

  const [share] = await db
    .select()
    .from(mapShares)
    .where(
      and(eq(mapShares.mapId, map.id), eq(mapShares.sharedWithUserId, user.sub)),
    )
    .limit(1);
  return !!share && !!SHARE_ALLOWS[share.permissionLevel]?.includes(action);
}

/**
 * May this user hand this map to somebody else?
 *
 * Three ways in:
 *  - an admin, who may do anything;
 *  - the map's owner, sharing their own work;
 *  - a MANAGER who can see the map.
 *
 * The MANAGER branch is what the role is FOR. This estate's `MAPTESTES`
 * account held fifty workbook grants on `SIID_TESTES`'s workbooks and existed
 * to pass them on to the people who needed them — it authored nothing. Sharing
 * used to need an EDIT right, so an account in that position could see fifty
 * maps and distribute none of them.
 *
 * Receiving an EDIT share still does not let you re-share: an ordinary user
 * matches none of the three branches.
 */
export async function canManageShares(
  user: { sub: string; role: string },
  map: Map,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (map.createdBy === user.sub) return true;
  if (user.role === 'MANAGER') return canAccessMap(user, map, 'VIEW');
  return false;
}

/**
 * May this user copy a map they can already see?
 *
 * Copying is how a MANAGER or USER builds their own map from someone else's:
 * anyone who can see a map may copy it, except a read-only VIEWER. The copy is
 * theirs, but running it still passes the data gate (`assertDataEntitlement`),
 * so a copy never reads more than the user's business-area grants allow.
 */
export async function canDuplicate(
  user: { sub: string; role: string },
  map: Map,
): Promise<boolean> {
  if (user.role === 'VIEWER') return false;
  return canAccessMap(user, map, 'VIEW');
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

/**
 * Hand a map to a new owner (ADMIN or MANAGER only — the route checks).
 * A share the new owner held on it is dropped: an owner needs no share.
 * Returns false when the map or the user does not exist.
 */
export async function transferOwnership(mapId: string, newOwnerId: string): Promise<boolean> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, newOwnerId))
    .limit(1);
  if (!owner) return false;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(maps)
      .set({ createdBy: newOwnerId, updatedAt: new Date() })
      .where(and(eq(maps.id, mapId), eq(maps.isActive, true)))
      .returning({ id: maps.id });
    if (!row) return false;
    await tx
      .delete(mapShares)
      .where(and(eq(mapShares.mapId, mapId), eq(mapShares.sharedWithUserId, newOwnerId)));
    return true;
  });
}
