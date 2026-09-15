import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Initialize i18next once for this file's process, same as map-builder-panels.test.tsx.
import '@/i18n'

import { RightPanelTabs } from '@/components/map-builder/panels/RightPanelTabs'
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

describe('RightPanelTabs', () => {
  it('shows no count badge on any tab when every collection is empty', () => {
    render(<RightPanelTabs />)
    expect(screen.getByRole('tab', { name: /^Conditions$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Sort$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Parameters$/ })).toBeInTheDocument()
  })

  it('shows a count badge on each tab once its collection has an entry', () => {
    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource() })
      useMapBuilderStore.getState().addCondition()
      const [item] = useMapBuilderStore.getState().selectedItems
      useMapBuilderStore.getState().updateItem(item.key, { sortDirection: 'ASC', sortOrder: 0 })
      useMapBuilderStore.getState().addParameter()
      useMapBuilderStore.getState().addCalculatedField()
    })

    render(<RightPanelTabs />)
    expect(screen.getByRole('tab', { name: /Conditions \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sort \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Parameters \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Calculated Fields \(1\)/ })).toBeInTheDocument()
  })

  it('updates the description on the properties tab, and clears it to null when emptied', () => {
    render(<RightPanelTabs />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: 'Quarterly sales' } })
    expect(useMapBuilderStore.getState().description).toBe('Quarterly sales')

    fireEvent.change(textarea, { target: { value: '' } })
    expect(useMapBuilderStore.getState().description).toBeNull()
  })

  it('toggles isPublic via the properties tab checkbox', () => {
    render(<RightPanelTabs />)
    expect(useMapBuilderStore.getState().isPublic).toBe(false)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(useMapBuilderStore.getState().isPublic).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(useMapBuilderStore.getState().isPublic).toBe(false)
  })
})
