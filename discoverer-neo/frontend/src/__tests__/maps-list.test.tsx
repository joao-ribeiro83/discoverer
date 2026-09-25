import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapsListPage } from '@/pages/MapsListPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { MapSummary, BusinessArea, WorkbookWithMaps } from '@/lib/types'

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
    maps: { listMine: vi.fn(), listAll: vi.fn(), delete: vi.fn(), listShares: vi.fn() },
    businessAreas: { list: vi.fn() },
    users: { search: vi.fn() },
    workbooks: { listBrowse: vi.fn(), delete: vi.fn() },
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
    workbookId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  }
}

function businessArea(over: Partial<BusinessArea> = {}): BusinessArea {
  return { id: 'ba1', name: 'Sales', description: null, isActive: true, createdAt: '2026-01-01', ...over }
}

function workbook(over: Partial<WorkbookWithMaps> = {}): WorkbookWithMaps {
  return {
    id: 'wb1',
    name: 'GD_M.M27_V08',
    description: null,
    sourceId: 27,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    maps: [mapSummary({ id: 'm1', name: 'Sheet One', workbookId: 'wb1' })],
    ...over,
  }
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
  mockedApi.workbooks.listBrowse.mockResolvedValue(envelope([]) as never)
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

  it('cancels a delete without calling the API', async () => {
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({ mine: [mapSummary({ id: 'm1', name: 'Sales by Region' })], shared: [] }) as never,
    )
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'Sales by Region' })] }) as never,
    )
    renderPage()

    await screen.findByText('Sales by Region')
    fireEvent.click(screen.getByTitle('Delete'))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockedApi.maps.delete).not.toHaveBeenCalled()
  })

  it('shows the empty-mine message with the total worksheet count', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: Array.from({ length: 3 }, (_, i) => mapSummary({ id: `m${i}`, name: `Map ${i}` })) }) as never,
    )
    renderPage()
    expect(await screen.findByText('3 worksheets exist; none are yours.')).toBeInTheDocument()
  })

  it('shows the empty-shared message on the Shared tab', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: Array.from({ length: 2 }, (_, i) => mapSummary({ id: `m${i}`, name: `Map ${i}` })) }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'Shared with me' }))
    expect(await screen.findByText('2 worksheets exist; none are shared with you.')).toBeInTheDocument()
  })

  it('shows a no-matches message when a search filters out every row', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'Sales by Region' })] }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    await screen.findByText('Sales by Region')

    fireEvent.change(screen.getByPlaceholderText('Search maps by name…'), { target: { value: 'nothing matches' } })
    expect(await screen.findByText('No maps match your search or filters.')).toBeInTheDocument()
  })

  it('shows a load error instead of the table', async () => {
    mockedApi.maps.listMine.mockRejectedValue(new Error('backend unavailable'))
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    renderPage()
    expect(await screen.findByText('backend unavailable')).toBeInTheDocument()
  })

  it('sorts by name', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [
          mapSummary({ id: 'm1', name: 'Zebra Report', updatedAt: '2026-01-05T00:00:00.000Z' }),
          mapSummary({ id: 'm2', name: 'Alpha Report', updatedAt: '2026-01-01T00:00:00.000Z' }),
        ],
      }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    await screen.findByText('Zebra Report')

    const [, sortSelect] = screen.getAllByRole('combobox')
    fireEvent.click(sortSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Name (A–Z)' }))

    const names = (await screen.findAllByText(/Report$/)).map((el) => el.textContent)
    expect(names).toEqual(['Alpha Report', 'Zebra Report'])
  })

  it('falls back to an em dash for an unrecognized business area', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'Orphaned Map', businessAreaId: 'ba-unknown' })] }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    expect(await screen.findByText('Orphaned Map')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('hides manage actions for a row the current user cannot manage', async () => {
    useAuthStore.setState({
      user: { id: 'u2', email: 'viewer@example.com', name: 'Viewer', role: 'ANALYST' },
      token: 't',
      isAuthenticated: true,
      hasHydrated: true,
    })
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({
        all: [mapSummary({ id: 'm1', name: 'Read Only Map', createdBy: 'someone-else' })],
      }) as never,
    )
    renderPage()
    clickTab(await screen.findByRole('tab', { name: 'All' }))
    await screen.findByText('Read Only Map')

    expect(screen.getByTitle('View')).toBeInTheDocument()
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Share')).not.toBeInTheDocument()
  })

  it('shows manage actions for the row owner even without the admin role', async () => {
    useAuthStore.setState({
      user: { id: 'u2', email: 'owner@example.com', name: 'Owner', role: 'ANALYST' },
      token: 't',
      isAuthenticated: true,
      hasHydrated: true,
    })
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({ mine: [mapSummary({ id: 'm1', name: 'My Own Map', createdBy: 'u2' })], shared: [] }) as never,
    )
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'My Own Map', createdBy: 'u2' })] }) as never,
    )
    renderPage()
    await screen.findByText('My Own Map')
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
  })

  it('browse view lists workbooks and drills to a worksheet', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    mockedApi.workbooks.listBrowse.mockResolvedValue(envelope([workbook()]) as never)
    renderPage()

    await screen.findByText('GD_M.M27_V08')
    expect(screen.getByText('1 worksheet')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: 'Sheet One' })
    expect(link).toHaveAttribute('href', '/maps/m1/view')
  })

  it('edits a worksheet and deletes a workbook from the browse view', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    mockedApi.workbooks.listBrowse.mockResolvedValue(envelope([workbook()]) as never)
    mockedApi.workbooks.delete.mockResolvedValue(envelope({ deleted: 1 }) as never)
    renderPage()

    const edit = await screen.findByRole('link', { name: 'Edit worksheet' })
    expect(edit).toHaveAttribute('href', '/maps/m1')

    fireEvent.click(screen.getByRole('button', { name: 'Delete workbook' }))
    expect(
      await screen.findByText('This deletes "GD_M.M27_V08" and its 1 worksheet. Only an administrator can bring it back.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockedApi.workbooks.delete).toHaveBeenCalledWith('wb1'))
  })

  it('filters workbooks by workbook or worksheet name', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    mockedApi.workbooks.listBrowse.mockResolvedValue(
      envelope([
        workbook(),
        workbook({
          id: 'wb2',
          name: 'Sales copy',
          maps: [mapSummary({ id: 'm2', name: 'Regional Totals', workbookId: 'wb2' })],
        }),
      ]) as never,
    )
    renderPage()
    const box = await screen.findByLabelText('Search workbooks or worksheets...')

    fireEvent.change(box, { target: { value: 'SALES' } })
    expect(screen.getByText('Sales copy')).toBeInTheDocument()
    expect(screen.queryByText('GD_M.M27_V08')).not.toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'sheet one' } })
    expect(screen.getByText('GD_M.M27_V08')).toBeInTheDocument()
    expect(screen.queryByText('Sales copy')).not.toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'nothing like this' } })
    expect(screen.getByText('No workbook matches this search.')).toBeInTheDocument()
  })

  it('hides workbook edit and delete from someone who owns none of it', async () => {
    useAuthStore.setState({
      user: { id: 'u2', email: 'viewer@example.com', name: 'Viewer', role: 'ANALYST' },
      token: 't',
      isAuthenticated: true,
      hasHydrated: true,
    })
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    mockedApi.workbooks.listBrowse.mockResolvedValue(envelope([workbook()]) as never)
    renderPage()

    await screen.findByRole('link', { name: 'Sheet One' })
    expect(screen.queryByRole('link', { name: 'Edit worksheet' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete workbook' })).not.toBeInTheDocument()
  })

  it('hides the workbooks panel when there are none to browse', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    mockedApi.maps.listAll.mockResolvedValue(envelope({ all: [] }) as never)
    renderPage()

    await screen.findByText('0 worksheets exist; none are yours.')
    expect(screen.queryByText('Workbooks')).not.toBeInTheDocument()
  })

  it('opens and closes the share dialog for a manageable row', async () => {
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({ mine: [mapSummary({ id: 'm1', name: 'Sales by Region' })], shared: [] }) as never,
    )
    mockedApi.maps.listAll.mockResolvedValue(
      envelope({ all: [mapSummary({ id: 'm1', name: 'Sales by Region' })] }) as never,
    )
    mockedApi.maps.listShares.mockResolvedValue(envelope([]) as never)
    mockedApi.users.search.mockResolvedValue(envelope([]) as never)
    renderPage()
    await screen.findByText('Sales by Region')

    fireEvent.click(screen.getByTitle('Share'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
