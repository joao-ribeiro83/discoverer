import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import type { ReactNode } from 'react'

import { BusinessAreaTree } from '@/components/map-builder/BusinessAreaTree'
import { MapCanvas } from '@/components/map-builder/MapCanvas'
import { ColumnConfigDialog } from '@/components/map-builder/ColumnConfigDialog'
import { MapBuilderPage } from '@/pages/MapBuilderPage'
import { useMapBuilderStore, type MapBuilderItemSource } from '@/store/mapBuilder'
import { apiClient } from '@/lib/api'

// --- api mock --------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  apiClient: {
    businessAreas: { list: vi.fn() },
    folders: { listByBusinessArea: vi.fn() },
    items: { listByFolder: vi.fn(), get: vi.fn() },
    maps: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      execute: vi.fn(),
      executeAsync: vi.fn(),
      getExecutionStatus: vi.fn(),
      cancelExecution: vi.fn(),
      getHistory: vi.fn(),
      exportXml: vi.fn(),
      createExport: vi.fn(),
    },
    exports: {
      list: vi.fn(),
      getStatus: vi.fn(),
      download: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
  getErrorKind: (err: unknown) => (err as { kind?: string } | undefined)?.kind,
}))

// jsdom has no real layout; render every row rather than a real visible range
// (see results-table.test.tsx for the full rationale).
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 32, size: 32, key: i })),
    getTotalSize: () => count * 32,
  }),
}))

const mockedApi = vi.mocked(apiClient, true)

// --- factories -------------------------------------------------------------
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

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  act(() => useMapBuilderStore.getState().clearMap())
})

// ---------------------------------------------------------------------------
// Store — the state a drop / config / reorder actually mutates
// ---------------------------------------------------------------------------
describe('mapBuilder store', () => {
  it('addItem appends a column and binds the business area', () => {
    const store = useMapBuilderStore.getState()
    const outcome = store.addItem({
      itemId: 'i1',
      source: makeSource(),
      defaultAggFunction: 'SUM',
      defaultFormatMask: null,
    })
    expect(outcome.ok).toBe(true)
    const state = useMapBuilderStore.getState()
    expect(state.selectedItems).toHaveLength(1)
    expect(state.selectedItems[0].itemId).toBe('i1')
    expect(state.businessAreaId).toBe('ba1')
    expect(state.isDirty).toBe(true)
  })

  it('rejects a duplicate item and an item from another business area', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource() })
    const dup = useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource() })
    expect(dup).toEqual({ ok: false, reason: 'duplicate' })

    const cross = useMapBuilderStore.getState().addItem({
      itemId: 'i2',
      source: makeSource({ businessAreaId: 'ba2' }),
    })
    expect(cross).toEqual({ ok: false, reason: 'cross-business-area' })
    expect(useMapBuilderStore.getState().selectedItems).toHaveLength(1)
  })

  it('reorderItems moves a column to a new position', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource({ name: 'A' }) })
    store.addItem({ itemId: 'i2', source: makeSource({ name: 'B' }) })
    store.addItem({ itemId: 'i3', source: makeSource({ name: 'C' }) })
    const [a, , c] = useMapBuilderStore.getState().selectedItems
    // Move A to where C is.
    useMapBuilderStore.getState().reorderItems(a.key, c.key)
    expect(useMapBuilderStore.getState().selectedItems.map((i) => i.itemId)).toEqual([
      'i2',
      'i3',
      'i1',
    ])
  })

  it('toInput assigns displayOrder by position and drops NONE aggregation', () => {
    const store = useMapBuilderStore.getState()
    store.addItem({ itemId: 'i1', source: makeSource(), defaultAggFunction: 'SUM' })
    store.addItem({ itemId: 'i2', source: makeSource({ name: 'Region' }), defaultAggFunction: 'NONE' })
    const input = useMapBuilderStore.getState().toInput()
    expect(input.items).toEqual([
      expect.objectContaining({ itemId: 'i1', displayOrder: 0, aggFunction: 'SUM' }),
      expect.objectContaining({ itemId: 'i2', displayOrder: 1, aggFunction: null }),
    ])
  })
})

// ---------------------------------------------------------------------------
// BusinessAreaTree — renders the BA → Folder → Item hierarchy
// ---------------------------------------------------------------------------
describe('BusinessAreaTree', () => {
  it('renders business areas, then folders and items on expand', async () => {
    mockedApi.businessAreas.list.mockResolvedValue(
      envelope([{ id: 'ba1', name: 'Sales', description: null, isActive: true, createdAt: '' }]) as never,
    )
    mockedApi.folders.listByBusinessArea.mockResolvedValue(
      envelope([
        { id: 'f1', name: 'Orders', businessAreaId: 'ba1', folderType: 'TABLE', isActive: true },
      ]) as never,
    )
    mockedApi.items.listByFolder.mockResolvedValue(
      envelope([
        { id: 'i1', folderId: 'f1', name: 'Amount', itemType: 'AG', dataType: 'NUMBER', aggFunction: 'SUM', isActive: true },
        { id: 'i2', folderId: 'f1', name: 'Region', itemType: 'CI', dataType: 'VARCHAR2', aggFunction: null, isActive: true },
      ]) as never,
    )

    renderWithProviders(
      <DndContext>
        <BusinessAreaTree />
      </DndContext>,
    )

    const ba = await screen.findByText('Sales')
    fireEvent.click(ba)
    const folder = await screen.findByText('Orders')
    fireEvent.click(folder)

    expect(await screen.findByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Region')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// MapCanvas — reflects the selected columns
// ---------------------------------------------------------------------------
describe('MapCanvas', () => {
  it('shows the empty state, then a chip once an item is added', () => {
    const { rerender } = render(
      <DndContext>
        <MapCanvas onConfigure={() => {}} />
      </DndContext>,
    )
    expect(screen.getByText(/drag items here/i)).toBeInTheDocument()

    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
    })
    rerender(
      <DndContext>
        <MapCanvas onConfigure={() => {}} />
      </DndContext>,
    )
    expect(screen.getByText('Amount')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ColumnConfigDialog — persists edits to the store
// ---------------------------------------------------------------------------
describe('ColumnConfigDialog', () => {
  it('saves display name and width changes to the column', async () => {
    act(() => {
      useMapBuilderStore.getState().addItem({ itemId: 'i1', source: makeSource({ name: 'Amount' }) })
    })
    const key = useMapBuilderStore.getState().selectedItems[0].key

    render(<ColumnConfigDialog columnKey={key} open onOpenChange={() => {}} />)

    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Total Sales' } })
    fireEvent.change(screen.getByLabelText('Column width (px)'), { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const col = useMapBuilderStore.getState().selectedItems[0]
      expect(col.displayName).toBe('Total Sales')
      expect(col.columnWidth).toBe(150)
    })
  })
})

// ---------------------------------------------------------------------------
// MapBuilderPage — Save persists via the API
// ---------------------------------------------------------------------------
describe('MapBuilderPage save', () => {
  it('calls maps.create with the business area and built payload', async () => {
    mockedApi.businessAreas.list.mockResolvedValue(envelope([]) as never)
    mockedApi.maps.create.mockResolvedValue(
      envelope({
        id: 'new-map-1',
        name: 'Untitled Map',
        description: null,
        mapType: 'TABLE',
        businessAreaId: 'ba1',
        createdBy: 'u1',
        isPublic: false,
        isActive: true,
        createdAt: '',
        updatedAt: '',
        items: [],
        conditions: [],
        parameters: [],
        calculatedFields: [],
      }) as never,
    )

    renderWithProviders(
      <MemoryRouter initialEntries={['/maps/new']}>
        <Routes>
          <Route path="/maps/:id" element={<MapBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Wait for the "new map" hydration to settle (toolbar visible).
    const saveButton = await screen.findByRole('button', { name: 'Save' })

    // Simulate a drop by adding a column to the store.
    act(() => {
      useMapBuilderStore.getState().addItem({
        itemId: 'i1',
        source: makeSource(),
        defaultAggFunction: 'SUM',
        defaultFormatMask: null,
      })
    })

    fireEvent.click(saveButton)

    await waitFor(() => expect(mockedApi.maps.create).toHaveBeenCalledTimes(1))
    const [baId, payload] = mockedApi.maps.create.mock.calls[0]
    expect(baId).toBe('ba1')
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0]).toMatchObject({ itemId: 'i1', displayOrder: 0, aggFunction: 'SUM' })
  })
})

// ---------------------------------------------------------------------------
// MapBuilderPage — Run executes results, prompting for parameters when needed
// ---------------------------------------------------------------------------
describe('MapBuilderPage run', () => {
  function mockCreatedMap(id: string) {
    mockedApi.maps.create.mockResolvedValue(
      envelope({
        id,
        name: 'Untitled Map',
        description: null,
        mapType: 'TABLE',
        businessAreaId: 'ba1',
        createdBy: 'u1',
        isPublic: false,
        isActive: true,
        createdAt: '',
        updatedAt: '',
        items: [],
        conditions: [],
        parameters: [],
        calculatedFields: [],
      }) as never,
    )
  }

  function mockExecuteResult() {
    mockedApi.maps.execute.mockResolvedValue(
      envelope({
        columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
        rows: [{ C1: 10 }],
        rowCount: 1,
        executionTimeMs: 5,
        truncated: false,
      }) as never,
    )
  }

  it('runs immediately (no prompt) when the map has no parameters', async () => {
    mockedApi.businessAreas.list.mockResolvedValue(envelope([]) as never)
    mockCreatedMap('new-map-2')
    mockExecuteResult()

    renderWithProviders(
      <MemoryRouter initialEntries={['/maps/new']}>
        <Routes>
          <Route path="/maps/:id" element={<MapBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const runButton = await screen.findByRole('button', { name: 'Run' })
    act(() => {
      useMapBuilderStore.getState().addItem({
        itemId: 'i1',
        source: makeSource(),
        defaultAggFunction: 'SUM',
        defaultFormatMask: null,
      })
    })

    fireEvent.click(runButton)

    expect(screen.queryByText('Run parameters')).not.toBeInTheDocument()
    await waitFor(() => expect(mockedApi.maps.execute).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.execute).toHaveBeenCalledWith('new-map-2', { parameters: {} })
  })

  it('opens the parameter prompt when a parameter lacks a default, then runs with the entered value', async () => {
    mockedApi.businessAreas.list.mockResolvedValue(envelope([]) as never)
    mockCreatedMap('new-map-3')
    mockExecuteResult()

    renderWithProviders(
      <MemoryRouter initialEntries={['/maps/new']}>
        <Routes>
          <Route path="/maps/:id" element={<MapBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const runButton = await screen.findByRole('button', { name: 'Run' })
    act(() => {
      const store = useMapBuilderStore.getState()
      store.addItem({
        itemId: 'i1',
        source: makeSource(),
        defaultAggFunction: 'SUM',
        defaultFormatMask: null,
      })
      store.addParameter()
    })

    fireEvent.click(runButton)

    const dialog = await screen.findByRole('dialog')
    within(dialog).getByText('Run parameters')
    expect(mockedApi.maps.execute).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText('Parameter1'), { target: { value: 'East' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(mockedApi.maps.execute).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.execute).toHaveBeenCalledWith('new-map-3', {
      parameters: { Parameter1: 'East' },
    })
  })
})
