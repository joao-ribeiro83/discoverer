import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'

import { ConditionsPanel } from '@/components/map-builder/panels/ConditionsPanel'
import { SortPanel, reorderAndRenumber } from '@/components/map-builder/panels/SortPanel'
import { ParametersPanel } from '@/components/map-builder/panels/ParametersPanel'
import { CalculatedFieldsPanel } from '@/components/map-builder/panels/CalculatedFieldsPanel'
import { validateFormulaHeuristic } from '@/components/map-builder/panels/FormulaEditorDialog'
import { useMapBuilderStore, type MapBuilderItemSource, type MapBuilderItem } from '@/store/mapBuilder'
import { apiClient } from '@/lib/api'

// --- api mock --------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { execute: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

// Monaco doesn't run in jsdom (no workers/real DOM measurement); swap it for a
// plain textarea so the formula editor dialog can still be exercised.
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: string
    onChange?: (value: string | undefined) => void
  }) => (
    <textarea
      data-testid="formula-editor-mock"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

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

function renderPanel(ui: ReactNode) {
  return render(ui)
}

beforeEach(() => {
  vi.clearAllMocks()
  act(() => useMapBuilderStore.getState().clearMap())
})

// ---------------------------------------------------------------------------
// ConditionsPanel — add/remove + grouping semantics
// ---------------------------------------------------------------------------
describe('ConditionsPanel', () => {
  it('disables Add Condition until a column exists, then adds/removes rows', () => {
    renderPanel(<ConditionsPanel />)
    expect(screen.getByRole('button', { name: /Add Condition/ })).toBeDisabled()

    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
    })

    const { rerender } = render(<ConditionsPanel />)
    rerender(<ConditionsPanel />)
    const addButtons = screen.getAllByRole('button', { name: /Add Condition/ })
    expect(addButtons[addButtons.length - 1]).toBeEnabled()

    fireEvent.click(addButtons[addButtons.length - 1])
    expect(useMapBuilderStore.getState().conditions).toHaveLength(1)

    const key = useMapBuilderStore.getState().conditions[0].key
    act(() => useMapBuilderStore.getState().removeCondition(key))
    expect(useMapBuilderStore.getState().conditions).toHaveLength(0)
  })

  it('groups selected conditions and reflects it in toInput(), then ungroups', () => {
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
      store.addCondition()
      store.addCondition()
      store.addCondition()
    })

    const [c1, c2, c3] = useMapBuilderStore.getState().conditions
    act(() => {
      useMapBuilderStore.getState().updateCondition(c2.key, { logicOperator: 'OR' })
      useMapBuilderStore.getState().updateCondition(c3.key, { logicOperator: 'AND' })
      useMapBuilderStore.getState().groupConditions([c2.key, c3.key])
    })

    const grouped = useMapBuilderStore.getState().conditions
    // c2/c3 should now be adjacent and share a non-null groupId; c1 stays a singleton.
    const g2 = grouped.find((c) => c.key === c2.key)!
    const g3 = grouped.find((c) => c.key === c3.key)!
    const g1 = grouped.find((c) => c.key === c1.key)!
    expect(g1.groupId).toBeNull()
    expect(g2.groupId).not.toBeNull()
    expect(g2.groupId).toBe(g3.groupId)

    const conditionsInput = useMapBuilderStore.getState().toInput().conditions ?? []
    // where-clause.ts groups by groupId (first-occurrence order) then sorts
    // rendered clauses by [group-or-singleton]; displayOrder must be
    // sequential array-position based, and each row keeps its OWN
    // logicOperator (c2's joins the group to the previous clause, c3's joins
    // it to c2 within the group).
    expect(conditionsInput).toHaveLength(3)
    const byKeyOrder = conditionsInput.map((c) => c.groupId)
    const groupIdValue = g2.groupId
    expect(byKeyOrder.filter((g) => g === groupIdValue)).toHaveLength(2)
    const orders = conditionsInput.map((c) => c.displayOrder ?? -1).sort((a, b) => a - b)
    expect(orders).toEqual([0, 1, 2])

    // Render the panel: grouping should show a visible "Ungroup" control.
    renderPanel(<ConditionsPanel />)
    const ungroupButton = screen.getByRole('button', { name: 'Ungroup' })
    fireEvent.click(ungroupButton)
    expect(useMapBuilderStore.getState().conditions.every((c) => c.groupId === null)).toBe(true)
  })

  it('hides the AND/OR selector only on the very first overall row', () => {
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addItem({ itemId: 'i1', source: makeSource() })
      store.addCondition()
      store.addCondition()
    })
    renderPanel(<ConditionsPanel />)
    // 2 conditions total => exactly 1 logic-operator selector (on the 2nd row).
    expect(screen.getAllByLabelText('Logic operator')).toHaveLength(1)
  })

  it('hides the value input entirely for IS_NULL', () => {
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addItem({ itemId: 'i1', source: makeSource() })
      store.addCondition()
    })
    const key = useMapBuilderStore.getState().conditions[0].key
    act(() => useMapBuilderStore.getState().updateCondition(key, { operator: 'IS_NULL' }))
    renderPanel(<ConditionsPanel />)
    expect(screen.queryByLabelText('Condition value')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Parameter name')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SortPanel — pure reorder/renumber helper + add-sort flow
// ---------------------------------------------------------------------------
describe('reorderAndRenumber (SortPanel)', () => {
  function item(key: string, sortOrder: number): MapBuilderItem {
    return {
      key,
      itemId: key,
      source: makeSource({ name: key }),
      displayName: null,
      aggFunction: null,
      formatMask: null,
      sortDirection: 'ASC',
      sortOrder,
      columnWidth: null,
      axisType: null,
      axisEdge: null,
      isHidden: false,
      sortGroup: false,
    }
  }

  it('moves an item to a new position and renumbers sortOrder sequentially', () => {
    const sorted = [item('a', 0), item('b', 1), item('c', 2)]
    const result = reorderAndRenumber(sorted, 'c', 'a')
    expect(result).toEqual([
      { key: 'c', sortOrder: 0 },
      { key: 'a', sortOrder: 1 },
      { key: 'b', sortOrder: 2 },
    ])
  })

  it('is a no-op (but still renumbers) when active === over or ids are missing', () => {
    const sorted = [item('a', 0), item('b', 1)]
    expect(reorderAndRenumber(sorted, 'a', 'a')).toEqual([
      { key: 'a', sortOrder: 0 },
      { key: 'b', sortOrder: 1 },
    ])
    expect(reorderAndRenumber(sorted, 'missing', 'b')).toEqual([
      { key: 'a', sortOrder: 0 },
      { key: 'b', sortOrder: 1 },
    ])
  })
})

describe('SortPanel', () => {
  it('shows the empty state without columns', () => {
    renderPanel(<SortPanel />)
    expect(screen.getByText(/Add columns to configure sorting/)).toBeInTheDocument()
  })

  it('adds a sort via updateItem and shows it in priority order', () => {
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
      store.addItem({ itemId: 'i2', source: makeSource({ name: 'Region' }) })
    })
    const [first, second] = useMapBuilderStore.getState().selectedItems
    act(() => {
      useMapBuilderStore.getState().updateItem(first.key, { sortDirection: 'ASC', sortOrder: 0 })
      useMapBuilderStore.getState().updateItem(second.key, { sortDirection: 'DESC', sortOrder: 1 })
    })
    renderPanel(<SortPanel />)
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Region')).toBeInTheDocument()
    expect(screen.queryByText('Add sort')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ParametersPanel — add/edit/required toggle
// ---------------------------------------------------------------------------
describe('ParametersPanel', () => {
  it('adds a parameter, edits its name/type, and toggles required', async () => {
    renderPanel(<ParametersPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add Parameter/ }))
    expect(useMapBuilderStore.getState().parameters).toHaveLength(1)

    fireEvent.change(screen.getByLabelText('Parameter name'), { target: { value: 'Region' } })
    fireEvent.click(screen.getByLabelText('Default value'))
    fireEvent.change(screen.getByLabelText('Default value'), { target: { value: 'West' } })

    const requiredCheckbox = screen.getByRole('checkbox', { name: 'Required' })
    fireEvent.click(requiredCheckbox)

    await waitFor(() => {
      const [param] = useMapBuilderStore.getState().parameters
      expect(param.name).toBe('Region')
      expect(param.defaultValue).toBe('West')
      expect(param.isRequired).toBe(true)
    })

    const input = useMapBuilderStore.getState().toInput()
    expect(input.parameters).toEqual([
      { name: 'Region', paramType: 'STRING', defaultValue: 'West', isRequired: true },
    ])
  })

  it('removes a parameter', () => {
    act(() => useMapBuilderStore.getState().addParameter())
    const key = useMapBuilderStore.getState().parameters[0].key
    renderPanel(<ParametersPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Delete parameter/ }))
    expect(useMapBuilderStore.getState().parameters.find((p) => p.key === key)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// CalculatedFieldsPanel + FormulaEditorDialog — add + open/save + reorder
// ---------------------------------------------------------------------------
describe('CalculatedFieldsPanel', () => {
  it('adds a calculated field, opens the formula editor, edits, and saves', async () => {
    renderPanel(<CalculatedFieldsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Add Calculated Field/ }))
    expect(useMapBuilderStore.getState().calculatedFields).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Click to write a formula/ }))
    expect(await screen.findByText('Formula editor')).toBeInTheDocument()

    const editor = screen.getByTestId('formula-editor-mock')
    fireEvent.change(editor, { target: { value: 'UPPER(Amount)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useMapBuilderStore.getState().calculatedFields[0].formula).toBe('UPPER(Amount)')
    })
  })

  it('renumbers displayOrder sequentially after reorderCalculatedFields', () => {
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addCalculatedField()
      store.addCalculatedField()
      store.addCalculatedField()
    })
    const [f1, f2, f3] = useMapBuilderStore.getState().calculatedFields
    expect([f1.displayOrder, f2.displayOrder, f3.displayOrder]).toEqual([0, 1, 2])

    act(() => useMapBuilderStore.getState().reorderCalculatedFields(f3.key, f1.key))
    const after = useMapBuilderStore.getState().calculatedFields
    expect(after.map((f) => f.key)).toEqual([f3.key, f1.key, f2.key])
    expect(after.map((f) => f.displayOrder)).toEqual([0, 1, 2])
  })

  it('shows a "save the map" hint and disables Test formula for an unsaved map', async () => {
    act(() => useMapBuilderStore.getState().addCalculatedField())
    renderPanel(<CalculatedFieldsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Click to write a formula/ }))
    expect(await screen.findByText(/Save the map to test formulas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Test formula/ })).toBeDisabled()
    expect(mockedApi.maps.execute).not.toHaveBeenCalled()
  })

  it('calls maps.execute with the ad-hoc calculatedFields option when the map is saved', async () => {
    act(() => {
      useMapBuilderStore.getState().addCalculatedField()
      useMapBuilderStore.getState().markSaved('map-1')
    })
    mockedApi.maps.execute.mockResolvedValue(
      envelope({
        columns: [],
        rows: [{ Calc1: 42 }],
        rowCount: 1,
        executionTimeMs: 1,
        truncated: false,
      }) as never,
    )

    renderPanel(<CalculatedFieldsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Click to write a formula/ }))
    fireEvent.click(screen.getByRole('button', { name: /Test formula/ }))

    await waitFor(() => expect(mockedApi.maps.execute).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.execute).toHaveBeenCalledWith(
      'map-1',
      expect.objectContaining({
        calculatedFields: [expect.objectContaining({ name: 'Calc1' })],
      }),
    )
    expect(await screen.findByText('42')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// validateFormulaHeuristic — lightweight client-side syntax checks
// ---------------------------------------------------------------------------
describe('validateFormulaHeuristic', () => {
  it('flags empty formulas', () => {
    expect(validateFormulaHeuristic('', [])).toEqual(['Formula is empty.'])
  })

  it('flags unbalanced parens/quotes/brackets', () => {
    expect(validateFormulaHeuristic('UPPER([Name]', ['Name'])).toContain('Unbalanced parentheses.')
    expect(validateFormulaHeuristic("'unterminated", [])).toContain('Unbalanced quotes.')
    expect(validateFormulaHeuristic('[Name', ['Name'])).toContain('Unbalanced [ ] column references.')
  })

  it('flags unknown functions and unknown column references', () => {
    const errors = validateFormulaHeuristic('FRIED([Amount])', ['Region'])
    expect(errors).toContain('Unknown function "FRIED".')
    expect(errors).toContain('Unknown column reference "[Amount]".')
  })

  it('passes a well-formed formula referencing known functions and columns', () => {
    expect(validateFormulaHeuristic("UPPER([Region]) || '-' || TRIM([Amount])", ['Region', 'Amount'])).toEqual(
      [],
    )
  })
})
