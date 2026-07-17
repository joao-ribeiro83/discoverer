import { create } from 'zustand'
import type {
  ItemType,
  MapType,
  SortDirection,
  ConditionOperator,
  MapWithDetails,
  MapItem,
  MapCondition,
  MapParameter,
  MapCalculatedField,
  CreateMapInput,
  MapItemInput,
  MapConditionInput,
  MapParameterInput,
  MapCalculatedFieldInput,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Client-side key generation
// ---------------------------------------------------------------------------

// A monotonic counter keeps every client-side key stable and deterministic (no
// crypto / Date.now needed, which keeps tests reproducible).
let keySeq = 0
function nextKey(prefix: string): string {
  keySeq += 1
  return `${prefix}-${keySeq}`
}
/** Stable client key for a canvas column — never sent to the API. */
export function nextColumnKey(): string {
  return nextKey('col')
}
function nextConditionKey(): string {
  return nextKey('cond')
}
function nextParameterKey(): string {
  return nextKey('param')
}
function nextCalcFieldKey(): string {
  return nextKey('calc')
}
function nextGroupId(): string {
  return nextKey('group')
}

// ---------------------------------------------------------------------------
// Client-side models
// ---------------------------------------------------------------------------

/**
 * Source metadata for a tree item, carried in the drag payload and stored on
 * each selected column so chips can render without re-fetching the item.
 */
export interface MapBuilderItemSource {
  name: string
  itemType: ItemType
  dataType: string | null
  folderId: string
  folderName: string
  businessAreaId: string
}

/**
 * A column selected onto the canvas. Combines the editable map-item config
 * with the (non-persisted) source metadata used purely for display.
 */
export interface MapBuilderItem {
  /** Stable client key for dnd/react — never sent to the API. */
  key: string
  itemId: string
  source: MapBuilderItemSource
  // editable config (maps 1:1 onto MapItemInput)
  displayName: string | null
  aggFunction: string | null
  formatMask: string | null
  sortDirection: SortDirection | null
  sortOrder: number | null
  columnWidth: number | null
}

/**
 * A WHERE-clause condition row. Mirrors `MapCondition` minus server-only
 * fields (`id`/`mapId`/`createdAt`). There is deliberately no `displayOrder`
 * field here — like `MapBuilderItem`, the array's own position IS the display
 * order (see `toInput()`); the store keeps this array clustered so grouped
 * rows are always contiguous (see `clusterConditions`).
 */
export interface MapBuilderCondition {
  key: string
  itemId: string
  operator: ConditionOperator
  value: string | null
  paramName: string | null
  conditionType: 'PARAMETER' | 'STATIC'
  groupId: string | null
  logicOperator: 'AND' | 'OR'
}

/** A run-time prompt definition. Mirrors `MapParameter` minus server-only fields. */
export interface MapBuilderParameter {
  key: string
  name: string
  paramType: 'STRING' | 'NUMBER' | 'DATE' | 'LIST'
  defaultValue: string | null
  isRequired: boolean
}

/**
 * A calculated field. Mirrors `MapCalculatedField` minus server-only fields.
 * Unlike conditions, `displayOrder` here IS a directly user-editable field
 * (the panel exposes a number input), so it is not merely derived from array
 * position.
 */
export interface MapBuilderCalculatedField {
  key: string
  name: string
  formula: string
  displayOrder: number
}

/** The label a chip shows: explicit displayName, else the source item name. */
export function columnLabel(item: MapBuilderItem): string {
  return item.displayName?.trim() || item.source.name
}

/**
 * Cluster conditions sharing a `groupId` into contiguous runs, in the exact
 * order `backend/src/lib/sql/where-clause.ts` groups them when building the
 * WHERE clause: conditions are visited in array order, each distinct groupId
 * (or singleton, for a null groupId) starts a new cluster at its first
 * occurrence, and later conditions sharing that groupId join the existing
 * cluster wherever it started. Reusing this exact algorithm guarantees the
 * panel's visual "boxes" always match what the backend will actually produce,
 * even if a manual reorder ever left a group's rows non-adjacent.
 */
export function clusterConditions(
  conditions: MapBuilderCondition[],
): MapBuilderCondition[][] {
  const groups = new Map<string, MapBuilderCondition[]>()
  for (const c of conditions) {
    const key = c.groupId ?? `__single_${c.key}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return [...groups.values()]
}

/** Re-flattens `conditions` into canonical clustered order (see `clusterConditions`). */
function reclusterConditions(conditions: MapBuilderCondition[]): MapBuilderCondition[] {
  return clusterConditions(conditions).flat()
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface MapBuilderState {
  /** null while the map is new and unsaved. */
  mapId: string | null
  name: string
  description: string | null
  mapType: MapType
  isPublic: boolean
  /**
   * The business area every selected item must belong to. Fixed by the first
   * item dropped (or by a loaded map); cleared when the canvas empties.
   */
  businessAreaId: string | null

  selectedItems: MapBuilderItem[]
  conditions: MapBuilderCondition[]
  parameters: MapBuilderParameter[]
  calculatedFields: MapBuilderCalculatedField[]

  isDirty: boolean

  // --- actions: columns ---
  addItem: (payload: {
    itemId: string
    source: MapBuilderItemSource
    defaultAggFunction?: string | null
    defaultFormatMask?: string | null
  }) => { ok: true } | { ok: false; reason: 'duplicate' | 'cross-business-area' }
  removeItem: (key: string) => void
  reorderItems: (activeKey: string, overKey: string) => void
  updateItem: (key: string, patch: Partial<Omit<MapBuilderItem, 'key' | 'itemId' | 'source'>>) => void

  setName: (name: string) => void
  setDescription: (description: string | null) => void
  setMapType: (mapType: MapType) => void
  setIsPublic: (isPublic: boolean) => void

  // --- actions: conditions ---
  addCondition: () => void
  removeCondition: (key: string) => void
  updateCondition: (key: string, patch: Partial<Omit<MapBuilderCondition, 'key'>>) => void
  /** Assigns a new shared groupId to (at least two) rows and clusters them together. */
  groupConditions: (keys: string[]) => void
  /** Clears groupId for every row currently sharing `groupId`. */
  ungroupConditions: (groupId: string) => void
  reorderConditions: (activeKey: string, overKey: string) => void

  // --- actions: parameters ---
  addParameter: () => void
  removeParameter: (key: string) => void
  updateParameter: (key: string, patch: Partial<Omit<MapBuilderParameter, 'key'>>) => void

  // --- actions: calculated fields ---
  addCalculatedField: () => void
  removeCalculatedField: (key: string) => void
  updateCalculatedField: (key: string, patch: Partial<Omit<MapBuilderCalculatedField, 'key'>>) => void
  /** Moves a field to another's position and renumbers displayOrder sequentially. */
  reorderCalculatedFields: (activeKey: string, overKey: string) => void

  loadMap: (map: MapWithDetails, sources: Record<string, MapBuilderItemSource>) => void
  clearMap: () => void
  /** Mark the current in-memory map as persisted under `mapId`. */
  markSaved: (mapId: string) => void
  /** Build the create/update payload from the current state. */
  toInput: () => CreateMapInput
}

const initialState = {
  mapId: null as string | null,
  name: 'Untitled Map',
  description: null as string | null,
  mapType: 'TABLE' as MapType,
  isPublic: false,
  businessAreaId: null as string | null,
  selectedItems: [] as MapBuilderItem[],
  conditions: [] as MapBuilderCondition[],
  parameters: [] as MapBuilderParameter[],
  calculatedFields: [] as MapBuilderCalculatedField[],
  isDirty: false,
}

function mapItemToBuilderItem(
  row: MapItem,
  source: MapBuilderItemSource,
): MapBuilderItem {
  return {
    key: nextColumnKey(),
    itemId: row.itemId,
    source,
    displayName: row.displayName,
    aggFunction: row.aggFunction,
    formatMask: row.formatMask,
    sortDirection: row.sortDirection,
    sortOrder: row.sortOrder,
    columnWidth: row.columnWidth,
  }
}

/** A source stub for a map item whose source could not be resolved. */
function fallbackSource(row: MapItem): MapBuilderItemSource {
  return {
    name: row.displayName ?? 'Unknown item',
    itemType: 'CI',
    dataType: null,
    folderId: '',
    folderName: '',
    businessAreaId: '',
  }
}

function mapConditionToBuilder(row: MapCondition): MapBuilderCondition {
  return {
    key: nextConditionKey(),
    itemId: row.itemId,
    operator: row.operator,
    value: row.value,
    paramName: row.paramName,
    conditionType: row.conditionType,
    groupId: row.groupId,
    logicOperator: row.logicOperator,
  }
}

function mapParameterToBuilder(row: MapParameter): MapBuilderParameter {
  return {
    key: nextParameterKey(),
    name: row.name,
    paramType: row.paramType,
    defaultValue: row.defaultValue,
    isRequired: row.isRequired,
  }
}

function mapCalculatedFieldToBuilder(row: MapCalculatedField): MapBuilderCalculatedField {
  return {
    key: nextCalcFieldKey(),
    name: row.name,
    formula: row.formula,
    displayOrder: row.displayOrder,
  }
}

export const useMapBuilderStore = create<MapBuilderState>((set, get) => ({
  ...initialState,

  addItem: (payload) => {
    const state = get()
    if (state.selectedItems.some((i) => i.itemId === payload.itemId)) {
      return { ok: false, reason: 'duplicate' }
    }
    if (
      state.businessAreaId &&
      state.businessAreaId !== payload.source.businessAreaId
    ) {
      return { ok: false, reason: 'cross-business-area' }
    }

    const column: MapBuilderItem = {
      key: nextColumnKey(),
      itemId: payload.itemId,
      source: payload.source,
      displayName: null,
      aggFunction: payload.defaultAggFunction ?? null,
      formatMask: payload.defaultFormatMask ?? null,
      sortDirection: null,
      sortOrder: null,
      columnWidth: null,
    }

    set({
      selectedItems: [...state.selectedItems, column],
      businessAreaId: state.businessAreaId ?? payload.source.businessAreaId,
      isDirty: true,
    })
    return { ok: true }
  },

  removeItem: (key) => {
    const remaining = get().selectedItems.filter((i) => i.key !== key)
    set({
      selectedItems: remaining,
      // Releasing the last item frees the map to bind a new business area.
      businessAreaId: remaining.length === 0 ? null : get().businessAreaId,
      isDirty: true,
    })
  },

  reorderItems: (activeKey, overKey) => {
    const items = get().selectedItems
    const from = items.findIndex((i) => i.key === activeKey)
    const to = items.findIndex((i) => i.key === overKey)
    if (from === -1 || to === -1 || from === to) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set({ selectedItems: next, isDirty: true })
  },

  updateItem: (key, patch) => {
    set({
      selectedItems: get().selectedItems.map((i) =>
        i.key === key ? { ...i, ...patch } : i,
      ),
      isDirty: true,
    })
  },

  setName: (name) => set({ name, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),
  setMapType: (mapType) => set({ mapType, isDirty: true }),
  setIsPublic: (isPublic) => set({ isPublic, isDirty: true }),

  addCondition: () => {
    const state = get()
    const row: MapBuilderCondition = {
      key: nextConditionKey(),
      itemId: state.selectedItems[0]?.itemId ?? '',
      operator: '=',
      value: '',
      paramName: null,
      conditionType: 'STATIC',
      groupId: null,
      logicOperator: 'AND',
    }
    set({ conditions: [...state.conditions, row], isDirty: true })
  },

  removeCondition: (key) => {
    set({
      conditions: get().conditions.filter((c) => c.key !== key),
      isDirty: true,
    })
  },

  updateCondition: (key, patch) => {
    set({
      conditions: get().conditions.map((c) => (c.key === key ? { ...c, ...patch } : c)),
      isDirty: true,
    })
  },

  groupConditions: (keys) => {
    if (keys.length < 2) return
    const keySet = new Set(keys)
    const groupId = nextGroupId()
    const updated = get().conditions.map((c) =>
      keySet.has(c.key) ? { ...c, groupId } : c,
    )
    set({ conditions: reclusterConditions(updated), isDirty: true })
  },

  ungroupConditions: (groupId) => {
    const updated = get().conditions.map((c) =>
      c.groupId === groupId ? { ...c, groupId: null } : c,
    )
    set({ conditions: reclusterConditions(updated), isDirty: true })
  },

  reorderConditions: (activeKey, overKey) => {
    const conditions = get().conditions
    const from = conditions.findIndex((c) => c.key === activeKey)
    const to = conditions.findIndex((c) => c.key === overKey)
    if (from === -1 || to === -1 || from === to) return
    const next = conditions.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set({ conditions: reclusterConditions(next), isDirty: true })
  },

  addParameter: () => {
    const state = get()
    const row: MapBuilderParameter = {
      key: nextParameterKey(),
      name: `Parameter${state.parameters.length + 1}`,
      paramType: 'STRING',
      defaultValue: null,
      isRequired: false,
    }
    set({ parameters: [...state.parameters, row], isDirty: true })
  },

  removeParameter: (key) => {
    set({
      parameters: get().parameters.filter((p) => p.key !== key),
      isDirty: true,
    })
  },

  updateParameter: (key, patch) => {
    set({
      parameters: get().parameters.map((p) => (p.key === key ? { ...p, ...patch } : p)),
      isDirty: true,
    })
  },

  addCalculatedField: () => {
    const state = get()
    const row: MapBuilderCalculatedField = {
      key: nextCalcFieldKey(),
      name: `Calc${state.calculatedFields.length + 1}`,
      formula: '',
      displayOrder: state.calculatedFields.length,
    }
    set({ calculatedFields: [...state.calculatedFields, row], isDirty: true })
  },

  removeCalculatedField: (key) => {
    set({
      calculatedFields: get().calculatedFields.filter((f) => f.key !== key),
      isDirty: true,
    })
  },

  updateCalculatedField: (key, patch) => {
    set({
      calculatedFields: get().calculatedFields.map((f) =>
        f.key === key ? { ...f, ...patch } : f,
      ),
      isDirty: true,
    })
  },

  reorderCalculatedFields: (activeKey, overKey) => {
    const fields = get().calculatedFields
    const from = fields.findIndex((f) => f.key === activeKey)
    const to = fields.findIndex((f) => f.key === overKey)
    if (from === -1 || to === -1 || from === to) return
    const next = fields.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set({
      // Renumber sequentially so displayOrder always matches the new order.
      calculatedFields: next.map((f, i) => ({ ...f, displayOrder: i })),
      isDirty: true,
    })
  },

  loadMap: (map, sources) => {
    const orderedItems = [...map.items].sort((a, b) => a.displayOrder - b.displayOrder)
    const orderedConditions = [...map.conditions].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    )
    const orderedCalcFields = [...map.calculatedFields].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    )
    set({
      mapId: map.id,
      name: map.name,
      description: map.description,
      mapType: map.mapType,
      isPublic: map.isPublic,
      businessAreaId: map.businessAreaId,
      selectedItems: orderedItems.map((row) =>
        mapItemToBuilderItem(row, sources[row.itemId] ?? fallbackSource(row)),
      ),
      // Reclustered so any non-adjacent groupId membership from the server
      // still renders as one legible box (see `clusterConditions`).
      conditions: reclusterConditions(orderedConditions.map(mapConditionToBuilder)),
      parameters: map.parameters.map(mapParameterToBuilder),
      calculatedFields: orderedCalcFields.map(mapCalculatedFieldToBuilder),
      isDirty: false,
    })
  },

  clearMap: () => set({ ...initialState }),

  markSaved: (mapId) => set({ mapId, isDirty: false }),

  toInput: () => {
    const state = get()
    const items: MapItemInput[] = state.selectedItems.map((col, index) => ({
      itemId: col.itemId,
      displayOrder: index,
      displayName: col.displayName,
      formatMask: col.formatMask,
      // 'NONE' means "no aggregation" — persist it as null.
      aggFunction:
        col.aggFunction && col.aggFunction !== 'NONE' ? col.aggFunction : null,
      sortDirection: col.sortDirection,
      sortOrder: col.sortOrder,
      columnWidth: col.columnWidth,
    }))

    const conditions: MapConditionInput[] = state.conditions.map((c, index) => ({
      itemId: c.itemId,
      operator: c.operator,
      value: c.conditionType === 'STATIC' ? c.value : null,
      paramName: c.conditionType === 'PARAMETER' ? c.paramName : null,
      conditionType: c.conditionType,
      groupId: c.groupId,
      logicOperator: c.logicOperator,
      // The array is always kept in canonical (clustered) order, so its index
      // IS the display order — mirrors how `items` above derives its own.
      displayOrder: index,
    }))

    const parameters: MapParameterInput[] = state.parameters.map((p) => ({
      name: p.name,
      paramType: p.paramType,
      defaultValue: p.defaultValue,
      isRequired: p.isRequired,
    }))

    const calculatedFields: MapCalculatedFieldInput[] = state.calculatedFields.map((f) => ({
      name: f.name,
      formula: f.formula,
      displayOrder: f.displayOrder,
    }))

    return {
      name: state.name,
      description: state.description,
      mapType: state.mapType,
      isPublic: state.isPublic,
      items,
      conditions,
      parameters,
      calculatedFields,
    }
  },
}))
