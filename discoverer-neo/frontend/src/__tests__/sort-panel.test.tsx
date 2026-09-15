import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type * as DndKit from '@dnd-kit/core'

// Initialize i18next once for this file's process, same as map-builder-panels.test.tsx.
import '@/i18n'

// dnd-kit's DndContext needs real pointer geometry jsdom doesn't provide, so
// tests can't drag for real. Capture the onDragEnd it's given and call it
// directly to exercise handleDragEnd's own guard clause.
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null =
  null
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKit>()
  return {
    ...actual,
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: ReactNode
      onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      capturedOnDragEnd = onDragEnd
      return children
    },
  }
})

import { SortPanel } from '@/components/map-builder/panels/SortPanel'
import { useMapBuilderStore, type MapBuilderItemSource } from '@/store/mapBuilder'

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
  act(() => useMapBuilderStore.getState().clearMap())
})

describe('SortPanel', () => {
  it('shows the "add columns" message when nothing is selected yet', () => {
    render(<SortPanel />)
    expect(screen.getByText('Add columns to configure sorting.')).toBeInTheDocument()
  })

  it('shows the "none sorted" message and an add-sort picker once a column is selected', () => {
    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource() })
    })

    render(<SortPanel />)
    expect(screen.getByText('No columns are sorted yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Sort' })).toBeDisabled()
  })

  it('renders a sort row for a sorted column and removes it', () => {
    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
      useMapBuilderStore.getState().addItem({ itemId: 'i2', source: makeSource({ name: 'Region' }) })
      const [first] = useMapBuilderStore.getState().selectedItems
      useMapBuilderStore.getState().updateItem(first.key, { sortDirection: 'ASC', sortOrder: 0 })
    })

    render(<SortPanel />)
    // The sorted column renders as a row (priority "1") with a remove button...
    expect(screen.getByText('1')).toBeInTheDocument()
    const removeButton = screen.getByRole('button', { name: 'Remove sort on Amount' })
    expect(removeButton).toBeInTheDocument()
    // ...and the still-unsorted column shows up in the add-sort picker.
    expect(screen.getByRole('button', { name: 'Add Sort' })).toBeInTheDocument()

    fireEvent.click(removeButton)
    const sortedItem = useMapBuilderStore.getState().selectedItems.find((i) => i.source.name === 'Amount')
    expect(sortedItem?.sortDirection).toBeNull()
  })

  it('handleDragEnd ignores a drop with no target or a drop on itself, but reorders otherwise', () => {
    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
      useMapBuilderStore.getState().addItem({ itemId: 'i2', source: makeSource({ name: 'Region' }) })
      const [a, b] = useMapBuilderStore.getState().selectedItems
      useMapBuilderStore.getState().updateItem(a.key, { sortDirection: 'ASC', sortOrder: 0 })
      useMapBuilderStore.getState().updateItem(b.key, { sortDirection: 'ASC', sortOrder: 1 })
    })

    render(<SortPanel />)
    const [a, b] = useMapBuilderStore.getState().selectedItems
    const orderBefore = useMapBuilderStore.getState().selectedItems.map((i) => i.sortOrder)

    act(() => capturedOnDragEnd?.({ active: { id: a.key }, over: null }))
    expect(useMapBuilderStore.getState().selectedItems.map((i) => i.sortOrder)).toEqual(orderBefore)

    act(() => capturedOnDragEnd?.({ active: { id: a.key }, over: { id: a.key } }))
    expect(useMapBuilderStore.getState().selectedItems.map((i) => i.sortOrder)).toEqual(orderBefore)

    act(() => capturedOnDragEnd?.({ active: { id: a.key }, over: { id: b.key } }))
    const afterSwap = useMapBuilderStore.getState().selectedItems
    expect(afterSwap.find((i) => i.key === b.key)?.sortOrder).toBe(0)
    expect(afterSwap.find((i) => i.key === a.key)?.sortOrder).toBe(1)
  })
})
