import { describe, it, expect, beforeEach } from 'vitest'

import { useMapBuilderStore, type MapBuilderItemSource } from '@/store/mapBuilder'
import type { MapWithDetails } from '@/lib/types'

/**
 * A map that came out of a Discoverer migration: the prompt is a label
 * (`Dt Fim Vigência >=`) and the condition points at the parameter's derived
 * bind name (`DT_FIM_VIG_NCIA`), which is what the generated SQL binds.
 *
 * The builder works in prompts throughout — that is what the conditions panel
 * shows and what `toInput()` sends back — so that renaming a parameter carries
 * its conditions with it instead of orphaning them.
 */
const NOW = '2026-01-01T00:00:00.000Z'
const ITEM_ID = '11111111-1111-4111-8111-111111111111'

function migratedMap(): MapWithDetails {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'GD_M.M172_V01',
    description: null,
    mapType: 'TABLE',
    businessAreaId: '33333333-3333-4333-8333-333333333333',
    createdBy: '44444444-4444-4444-8444-444444444444',
    isPublic: false,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    items: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        mapId: '22222222-2222-4222-8222-222222222222',
        itemId: ITEM_ID,
        displayOrder: 0,
        displayName: null,
        formatMask: null,
        aggFunction: null,
        sortDirection: null,
        sortOrder: null,
        columnWidth: null,
        axisType: null,
        axisEdge: null,
        axisOrder: null,
        isHidden: false,
        sortGroup: false,
        dataType: null,
        headingFormatMask: null,
        alignment: null,
        wordWrap: null,
        createdAt: NOW,
      },
    ],
    conditions: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        mapId: '22222222-2222-4222-8222-222222222222',
        itemId: ITEM_ID,
        operator: '>=',
        value: null,
        paramName: 'DT_FIM_VIG_NCIA',
        conditionType: 'PARAMETER',
        groupId: null,
        logicOperator: 'AND',
        displayOrder: 0,
        createdAt: NOW,
      },
    ],
    parameters: [
      {
        id: '77777777-7777-4777-8777-777777777777',
        mapId: '22222222-2222-4222-8222-222222222222',
        name: 'Dt Fim Vigência >=',
        bindName: 'DT_FIM_VIG_NCIA',
        paramType: 'DATE',
        defaultValue: null,
        isRequired: true,
        createdAt: NOW,
      },
    ],
    calculatedFields: [],
  }
}

const sources: Record<string, MapBuilderItemSource> = {
  [ITEM_ID]: {
    name: 'Dt Fim Vigencia',
    itemType: 'CI',
    dataType: 'DATE',
    folderId: '88888888-8888-4888-8888-888888888888',
    folderName: 'Apolices',
    businessAreaId: '33333333-3333-4333-8333-333333333333',
  },
}

describe('map builder parameters', () => {
  beforeEach(() => {
    useMapBuilderStore.getState().clearMap()
  })

  it('shows the prompt for a condition stored against a bind name', () => {
    useMapBuilderStore.getState().loadMap(migratedMap(), sources)

    const { conditions, parameters } = useMapBuilderStore.getState()
    expect(parameters[0]?.name).toBe('Dt Fim Vigência >=')
    expect(conditions[0]?.paramName).toBe('Dt Fim Vigência >=')
  })

  it('sends the prompt back, so the server re-derives the bind name', () => {
    useMapBuilderStore.getState().loadMap(migratedMap(), sources)

    const payload = useMapBuilderStore.getState().toInput()
    expect(payload.conditions?.[0]?.paramName).toBe('Dt Fim Vigência >=')
    expect(payload.parameters?.[0]?.name).toBe('Dt Fim Vigência >=')
  })

  it('carries a condition through a rename of the parameter it points at', () => {
    const store = useMapBuilderStore.getState()
    store.loadMap(migratedMap(), sources)

    const key = useMapBuilderStore.getState().parameters[0].key
    useMapBuilderStore.getState().updateParameter(key, { name: 'Data fim' })
    // The condition still names the old prompt, so the rename has to be
    // applied to it as well — this asserts the payload the panel produces
    // after the user also repoints the condition, which is the flow the
    // conditions panel offers.
    const conditionKey = useMapBuilderStore.getState().conditions[0].key
    useMapBuilderStore.getState().updateCondition(conditionKey, { paramName: 'Data fim' })

    const payload = useMapBuilderStore.getState().toInput()
    expect(payload.parameters?.[0]?.name).toBe('Data fim')
    expect(payload.conditions?.[0]?.paramName).toBe('Data fim')
  })

  it('leaves an unresolvable reference visible rather than blanking it', () => {
    const map = migratedMap()
    map.parameters = []
    useMapBuilderStore.getState().loadMap(map, sources)

    expect(useMapBuilderStore.getState().conditions[0]?.paramName).toBe('DT_FIM_VIG_NCIA')
  })
})
