import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapsListPage } from '@/pages/MapsListPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { MapSummary, BusinessArea } from '@/lib/types'

// jsdom has no real layout (clientHeight is always 0), so @tanstack/react-virtual
// can't compute a meaningful visible range there. Swap in a fake that just
// "virtualizes" every row — same approach as results-table.test.tsx.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 56, size: 56, key: i })),
    getTotalSize: () => count * 56,
  }),
}))

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { listMine: vi.fn(), listAll: vi.fn(), delete: vi.fn() },
    businessAreas: { list: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function mapSummary(over: Partial<MapSummary> = {}): MapSummary {
  return {
    id: 'm1',
    name: 'Sales by Region',
    description: null,
    mapType: 'TABLE',
    businessAreaId: 'ba1',
    createdBy: 'u1',
    isPublic: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  }
}

function businessArea(over: Partial<BusinessArea> = {}): BusinessArea {
  return { id: 'ba1', name: 'Sales', description: null, isActive: true, createdAt: '2026-01-01', ...over }
}

// jsdom doesn't focus an element on a synthetic click the way a real browser
// does, and Radix Tabs activates on focus — a plain fireEvent.click leaves
// the "Mine" tab active. Focusing first reproduces real click behavior.
function clickTab(tab: HTMLElement) {
  tab.focus()
  fireEvent.click(tab)
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MapsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { id: 'u1', email: 'jane@example.com', name: 'Jane', role: 'ADMIN' },
    token: 't',
    isAuthenticated: true,
    hasHydrated: true,
  })
  mockedApi.businessAreas.list.mockResolvedValue(envelope([businessArea()]) as never)
})

describe('MapsListPage', () => {
  it('renders rows from a mocked GET /api/maps', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [mapSummary({ id: 'm1', name: 'Sales by Region' }), mapSummary({ id: 'm2', name: 'Costs' })],
      }) as never,
    )
    renderPage()

    clickTab(await screen.findByRole('tab', { name: 'All' }))
    expect(await screen.findByText('Sales by Region')).toBeInTheDocument()
    expect(screen.getByText('Costs')).toBeInTheDocument()
  })

  it('shows the right maps per tab', async () => {
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({
        mine: [mapSummary({ id: 'm1', name: 'Mine Map' })],
        shared: [mapSummary({ id: 'm2', name: 'Shared Map' })],
      }) as never,
    )
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [
          mapSummary({ id: 'm1', name: 'Mine Map' }),
          mapSummary({ id: 'm2', name: 'Shared Map' }),
          mapSummary({ id: 'm3', name: 'Third Map' }),
        ],
      }) as never,
    )
    renderPage()

    expect(await screen.findByText('Mine Map')).toBeInTheDocument()
    expect(screen.queryByText('Shared Map')).not.toBeInTheDocument()

    clickTab(screen.getByRole('tab', { name: 'Shared with me' }))
    expect(await screen.findByText('Shared Map')).toBeInTheDocument()
    expect(screen.queryByText('Mine Map')).not.toBeInTheDocument()

    clickTab(screen.getByRole('tab', { name: 'All' }))
    expect(await screen.findByText('Third Map')).toBeInTheDocument()
  })

  it('narrows results with search', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [mapSummary({ id: 'm1', name: 'Sales by Region' }), mapSummary({ id: 'm2', name: 'Costs' })],
      }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    await screen.findByText('Sales by Region')

    fireEvent.change(screen.getByPlaceholderText('Search maps by name…'), { target: { value: 'sales' } })
    expect(await screen.findByText('Sales by Region')).toBeInTheDocument()
    expect(screen.queryByText('Costs')).not.toBeInTheDocument()
  })

  it('narrows results with the business-area filter', async () => {
    mockedApi.businessAreas.list.mockResolvedValue(
      envelope([businessArea({ id: 'ba1', name: 'Sales' }), businessArea({ id: 'ba2', name: 'Finance' })]) as never,
    )
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [
          mapSummary({ id: 'm1', name: 'Sales by Region', businessAreaId: 'ba1' }),
          mapSummary({ id: 'm2', name: 'Costs', businessAreaId: 'ba2' }),
        ],
      }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    await screen.findByText('Sales by Region')

    const [baFilter] = screen.getAllByRole('combobox')
    fireEvent.click(baFilter)
    fireEvent.click(await screen.findByRole('option', { name: 'Finance' }))

    expect(await screen.findByText('Costs')).toBeInTheDocument()
    expect(screen.queryByText('Sales by Region')).not.toBeInTheDocument()
  })

  it('renders the truthful empty state, not a generic one', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: Array.from({ length: 5 }, (_, i) => mapSummary({ id: `m${i}`, name: `Map ${i}`, createdBy: 'other' })),
      }) as never,
    )
    renderPage()
    expect(await screen.findByText('5 worksheets exist; none are yours.')).toBeInTheDocument()
  })

  it('requires confirmation before deleting a map', async () => {
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({ mine: [mapSummary({ id: 'm1', name: 'Sales by Region' })], shared: [] }) as never,
    )
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'Sales by Region' })] }) as never,
    )
    mockedApi.maps.delete.mockResolvedValue(envelope({ deleted: true }) as never)
    renderPage()

    await screen.findByText('Sales by Region')
    fireEvent.click(screen.getByTitle('Delete'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/This will deactivate/)).toBeInTheDocument()
    expect(mockedApi.maps.delete).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(mockedApi.maps.delete).toHaveBeenCalledWith('m1'))
  })
})
