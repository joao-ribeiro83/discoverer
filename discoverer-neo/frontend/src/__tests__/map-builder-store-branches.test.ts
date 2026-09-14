import { describe, it, expect, beforeEach } from 'vitest'

import {
  useMapBuilderStore,
  clusterConditions,
  columnLabel,
  type MapBuilderItemSource,
  type MapBuilderCondition,
} from '@/store/mapBuilder'
import type { MapWithDetails } from '@/lib/types'

// Branch coverage for store logic not already exercised by
// map-builder.test.tsx / map-builder-panels.test.tsx / map-builder-parameters.test.ts:
// addItem rejections, removeItem's businessAreaId release, no-op reorders,
// group/ungroup, calculated-field CRUD, loadMap's fallbackSource path, and
// toInput's conditional serialization.

function makeSource(over: Partial<MapBuilderItemSource> = {}): MapBuilderItemSource {
  return {
    name: 'Amount',
    itemType: 'AG',
    dataType: 'NUMBER',
    folderId: 'f1',
    folderName: 'Orders',
    businessAreaId: 'ba1',
    ...over,
  }
}

beforeEach(() => {
  useMapBuilderStore.getState().clearMap()
})

describe('addItem rejections', () => {
  it('rejects a duplicate itemId without mutating state', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    const outcome = store.addItem({ itemId: 'i1', source: makeSource() })
    expect(outcome).toEqual({ ok: false, reason: 'duplicate' })
    expect(useMapBuilderStore.getState().selectedItems).toHaveLength(1)
  })

  it('rejects an item from a different business area than the one already bound', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource({ businessAreaId: 'ba1' }) })
    const outcome = store.addItem({ itemId: 'i2', source: makeSource({ businessAreaId: 'ba2' }) })
    expect(outcome).toEqual({ ok: false, reason: 'cross-business-area' })
    expect(useMapBuilderStore.getState().selectedItems).toHaveLength(1)
  })
})

describe('removeItem', () => {
  it('clears businessAreaId once the last item is removed', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    const key = useMapBuilderStore.getState().selectedItems[0].key
    store.removeItem(key)
    expect(useMapBuilderStore.getState().businessAreaId).toBeNull()
    expect(useMapBuilderStore.getState().selectedItems).toHaveLength(0)
  })

  it('keeps businessAreaId while other items remain', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    store.addItem({ itemId: 'i2', source: makeSource() })
    const key = useMapBuilderStore.getState().selectedItems[0].key
    store.removeItem(key)
    expect(useMapBuilderStore.getState().businessAreaId).toBe('ba1')
    expect(useMapBuilderStore.getState().selectedItems).toHaveLength(1)
  })
})

describe('reorderItems', () => {
  it('is a no-op when either key is unknown', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    const before = useMapBuilderStore.getState().selectedItems
    store.reorderItems('missing', 'also-missing')
    expect(useMapBuilderStore.getState().selectedItems).toBe(before)
  })

  it('is a no-op when active and over are the same key', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    const key = useMapBuilderStore.getState().selectedItems[0].key
    const before = useMapBuilderStore.getState().selectedItems
    store.reorderItems(key, key)
    expect(useMapBuilderStore.getState().selectedItems).toBe(before)
  })

  it('moves the active item to the over item position', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    store.addItem({ itemId: 'i2', source: makeSource() })
    const [first, second] = useMapBuilderStore.getState().selectedItems
    store.reorderItems(first.key, second.key)
    const after = useMapBuilderStore.getState().selectedItems
    expect(after.map((i) => i.itemId)).toEqual(['i2', 'i1'])
  })
})

describe('addCondition default itemId', () => {
  it('defaults to an empty itemId when no columns are selected', () => {
    useMapBuilderStore.getState().addCondition()
    expect(useMapBuilderStore.getState().conditions[0].itemId).toBe('')
  })

  it('defaults to the first selected column when one exists', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    store.addCondition()
    expect(useMapBuilderStore.getState().conditions[0].itemId).toBe('i1')
  })
})

describe('groupConditions / ungroupConditions', () => {
  it('does nothing when fewer than two keys are given', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    const before = useMapBuilderStore.getState().conditions
    store.groupConditions([before[0].key])
    expect(useMapBuilderStore.getState().conditions).toBe(before)
  })

  it('assigns a shared groupId and clusters the rows together', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    store.addCondition()
    store.addCondition()
    const keys = useMapBuilderStore.getState().conditions.map((c) => c.key)
    // Group the first and third row — they should cluster adjacently.
    store.groupConditions([keys[0], keys[2]])
    const grouped = useMapBuilderStore.getState().conditions
    expect(grouped[0].groupId).toBe(grouped[1].groupId)
    expect(grouped[0].key).not.toBe(grouped[1].key)

    store.ungroupConditions(grouped[0].groupId!)
    expect(useMapBuilderStore.getState().conditions.every((c) => c.groupId === null)).toBe(true)
  })
})

describe('reorderConditions', () => {
  it('is a no-op when either key is unknown or equal', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    const before = useMapBuilderStore.getState().conditions
    store.reorderConditions('missing', 'also-missing')
    expect(useMapBuilderStore.getState().conditions).toBe(before)
    const key = before[0].key
    store.reorderConditions(key, key)
    expect(useMapBuilderStore.getState().conditions).toBe(before)
  })

  it('moves a condition and re-clusters the result', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    store.addCondition()
    const [first, second] = useMapBuilderStore.getState().conditions
    store.reorderConditions(first.key, second.key)
    const after = useMapBuilderStore.getState().conditions
    expect(after.map((c) => c.key)).toEqual([second.key, first.key])
  })
})

describe('parameters CRUD', () => {
  it('names successive parameters sequentially and removes one by key', () => {
    const store = useMapBuilderStore.getState()
    store.addParameter()
    store.addParameter()
    expect(useMapBuilderStore.getState().parameters.map((p) => p.name)).toEqual([
      'Parameter1',
      'Parameter2',
    ])
    const key = useMapBuilderStore.getState().parameters[0].key
    store.removeParameter(key)
    expect(useMapBuilderStore.getState().parameters).toHaveLength(1)
    expect(useMapBuilderStore.getState().parameters[0].name).toBe('Parameter2')
  })
})

describe('calculated fields CRUD', () => {
  it('adds, updates, removes and reorders with renumbered displayOrder', () => {
    const store = useMapBuilderStore.getState()
    store.addCalculatedField()
    store.addCalculatedField()
    const [f1, f2] = useMapBuilderStore.getState().calculatedFields
    expect([f1.displayOrder, f2.displayOrder]).toEqual([0, 1])

    store.updateCalculatedField(f1.key, { formula: 'A+B' })
    expect(useMapBuilderStore.getState().calculatedFields[0].formula).toBe('A+B')

    // No-op reorder branch.
    const before = useMapBuilderStore.getState().calculatedFields
    store.reorderCalculatedFields('missing', 'also-missing')
    expect(useMapBuilderStore.getState().calculatedFields).toBe(before)

    store.reorderCalculatedFields(f1.key, f2.key)
    const reordered = useMapBuilderStore.getState().calculatedFields
    expect(reordered.map((f) => f.key)).toEqual([f2.key, f1.key])
    expect(reordered.map((f) => f.displayOrder)).toEqual([0, 1])

    store.removeCalculatedField(f2.key)
    expect(useMapBuilderStore.getState().calculatedFields).toHaveLength(1)
    expect(useMapBuilderStore.getState().calculatedFields[0].key).toBe(f1.key)
  })
})

describe('columnLabel', () => {
  it('prefers a trimmed displayName over the source name', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
    const item = useMapBuilderStore.getState().selectedItems[0]
    expect(columnLabel(item)).toBe('Amount')
    store.updateItem(item.key, { displayName: '  Total  ' })
    expect(columnLabel(useMapBuilderStore.getState().selectedItems[0])).toBe('Total')
    store.updateItem(item.key, { displayName: '   ' })
    expect(columnLabel(useMapBuilderStore.getState().selectedItems[0])).toBe('Amount')
  })
})

describe('clusterConditions', () => {
  it('keeps ungrouped rows as singleton clusters and groups adjacent-or-not rows together', () => {
    const a: MapBuilderCondition = {
      key: 'a',
      itemId: 'i1',
      operator: '=',
      value: '1',
      paramName: null,
      conditionType: 'STATIC',
      groupId: 'g1',
      logicOperator: 'AND',
    }
    const b: MapBuilderCondition = { ...a, key: 'b', groupId: null }
    const c: MapBuilderCondition = { ...a, key: 'c', groupId: 'g1' }
    expect(clusterConditions([a, b, c])).toEqual([[a, c], [b]])
  })
})

describe('loadMap', () => {
  const NOW = '2026-01-01T00:00:00.000Z'

  function baseMap(over: Partial<MapWithDetails> = {}): MapWithDetails {
    return {
      id: 'm1',
      name: 'Test Map',
      description: null,
      mapType: 'TABLE',
      businessAreaId: 'ba1',
      createdBy: 'u1',
      isPublic: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
      items: [],
      conditions: [],
      parameters: [],
      calculatedFields: [],
      ...over,
    }
  }

  it('falls back to a stub source when the item is unresolvable, using its displayName', () => {
    const map = baseMap({
      items: [
        {
          id: 'mi1',
          mapId: 'm1',
          itemId: 'missing-item',
          displayOrder: 0,
          displayName: 'Orphan Column',
          formatMask: null,
          aggFunction: null,
          sortDirection: null,
          sortOrder: null,
          columnWidth: null,
          axisType: null,
          axisEdge: null,
          isHidden: false,
          sortGroup: false,
          createdAt: NOW,
        } as never,
      ],
    })
    useMapBuilderStore.getState().loadMap(map, {})
    const item = useMapBuilderStore.getState().selectedItems[0]
    expect(item.source.name).toBe('Orphan Column')
    expect(item.source.itemType).toBe('CI')
    expect(item.source.folderId).toBe('')
  })
})

describe('toInput serialization', () => {
  it('persists NONE aggregation as null and keeps a real one', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource(), defaultAggFunction: 'NONE' })
    store.addItem({ itemId: 'i2', source: makeSource(), defaultAggFunction: 'SUM' })
    const payload = store.toInput()
    expect(payload.items?.[0].aggFunction).toBeNull()
    expect(payload.items?.[1].aggFunction).toBe('SUM')
  })

  it('serializes a STATIC condition with value and null paramName', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    const key = useMapBuilderStore.getState().conditions[0].key
    store.updateCondition(key, { conditionType: 'STATIC', value: '5', paramName: 'ignored' })
    const payload = store.toInput()
    expect(payload.conditions?.[0]).toMatchObject({ value: '5', paramName: null })
  })

  it('serializes a PARAMETER condition with paramName and null value', () => {
    const store = useMapBuilderStore.getState()
    store.addCondition()
    const key = useMapBuilderStore.getState().conditions[0].key
    store.updateCondition(key, { conditionType: 'PARAMETER', paramName: 'P1', value: 'ignored' })
    const payload = store.toInput()
    expect(payload.conditions?.[0]).toMatchObject({ paramName: 'P1', value: null })
  })
})

describe('markSaved', () => {
  it('sets mapId and clears isDirty', () => {
    const store = useMapBuilderStore.getState()
    store.setName('changed')
    expect(useMapBuilderStore.getState().isDirty).toBe(true)
    store.markSaved('new-id')
    expect(useMapBuilderStore.getState()).toMatchObject({ mapId: 'new-id', isDirty: false })
  })
})

describe('simple field setters', () => {
  it('each marks the map dirty and updates its field', () => {
    const store = useMapBuilderStore.getState()
    store.setDescription('a description')
    store.setMapType('CROSSTAB')
    store.setIsPublic(true)
    expect(useMapBuilderStore.getState()).toMatchObject({
      description: 'a description',
      mapType: 'CROSSTAB',
      isPublic: true,
      isDirty: true,
    })
  })
})

describe('loadMap ordering with multiple rows', () => {
  const NOW = '2026-01-01T00:00:00.000Z'
  const ITEM_A = 'item-a'
  const ITEM_B = 'item-b'

  it('sorts conditions and calculated fields by displayOrder, not array order', () => {
    const map = {
      id: 'm2',
      name: 'Multi',
      description: null,
      mapType: 'TABLE',
      businessAreaId: 'ba1',
      createdBy: 'u1',
      isPublic: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
      items: [],
      conditions: [
        {
          id: 'c2',
          mapId: 'm2',
          itemId: ITEM_B,
          operator: '=',
          value: '2',
          paramName: null,
          conditionType: 'STATIC',
          groupId: null,
          logicOperator: 'AND',
          displayOrder: 1,
          createdAt: NOW,
        },
        {
          id: 'c1',
          mapId: 'm2',
          itemId: ITEM_A,
          operator: '=',
          value: '1',
          paramName: null,
          conditionType: 'STATIC',
          groupId: null,
          logicOperator: 'AND',
          displayOrder: 0,
          createdAt: NOW,
        },
      ],
      parameters: [],
      calculatedFields: [
        { id: 'f2', mapId: 'm2', name: 'Second', formula: 'B', displayOrder: 1, createdAt: NOW },
        { id: 'f1', mapId: 'm2', name: 'First', formula: 'A', displayOrder: 0, createdAt: NOW },
      ],
    } as unknown as MapWithDetails

    useMapBuilderStore.getState().loadMap(map, {})
    const state = useMapBuilderStore.getState()
    expect(state.conditions.map((c) => c.itemId)).toEqual([ITEM_A, ITEM_B])
    expect(state.calculatedFields.map((f) => f.name)).toEqual(['First', 'Second'])
  })
})
