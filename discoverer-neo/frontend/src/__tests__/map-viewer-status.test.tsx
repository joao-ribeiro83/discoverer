import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MapViewerPage } from '@/pages/MapViewerPage'
import { apiClient } from '@/lib/api'
import type { MapRun, MapWithDetails } from '@/lib/types'

// Covers what map-viewer-run.test.tsx and the cancel regression test don't:
// the four status-line states (queued/running/result/reused), the heading
// override, "Run again", the refusal-vs-failure toast split (from
// run.decoration.error), and Load more via useMapRun's hasMore/onLoadMore.

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 32, size: 32, key: i })),
    getTotalSize: () => count * 32,
  }),
}))

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { get: vi.fn(), requestRun: vi.fn(), createExport: vi.fn() },
    runs: { get: vi.fn(), rows: vi.fn(), cancel: vi.fn() },
    exports: { list: vi.fn(), getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
  getErrorKind: (err: unknown) => (err as { kind?: string } | undefined)?.kind,
  getRefusalCode: (err: unknown) => (err as { code?: string } | undefined)?.code,
  getRefusalDetails: (err: unknown) =>
    (err as { details?: Record<string, unknown> } | undefined)?.details,
}))

const mockedApi = vi.mocked(apiClient, true)

function makeRun(over: Partial<MapRun> = {}): MapRun {
  return {
    id: 'run-1',
    mapId: 'map-1',
    mapName: 'Sales by Region',
    kind: 'LIVE',
    scheduleId: null,
    status: 'COMPLETED',
    parameters: { region: 'EAST' },
    calculatedFields: [],
    columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
    decoration: null,
    rowCount: 1,
    truncated: false,
    executionTimeMs: 5,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T10:00:00Z',
    expiresAt: '2026-01-01T11:00:00Z',
    ...over,
  }
}

function makeMap(over: Partial<MapWithDetails> = {}): MapWithDetails {
  return {
    id: 'map-1',
    name: 'Sales by Region',
    description: 'Default description',
    mapType: 'TABLE',
    businessAreaId: 'ba-1',
    createdBy: 'user-1',
    isPublic: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: [{ id: 'mi-1', mapId: 'map-1', itemId: 'item-1', displayOrder: 0, createdAt: '2026-01-01T00:00:00Z' }],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    ...over,
  } as MapWithDetails
}

function envelope<T>(data: T) {
  return { data: { data } }
}

function renderViewer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/maps/map-1/view']}>
        <Routes>
          <Route path="/maps/:id/view" element={<MapViewerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.runs.rows.mockResolvedValue(envelope([{ C1: 1 }]) as never)
})

describe('MapViewerPage status line', () => {
  it('shows "Queued (position unknown)" for a queued run', async () => {
    const queued = makeRun({ status: 'QUEUED', columns: null })
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: queued, reused: false })
    mockedApi.runs.get.mockResolvedValue(envelope(queued) as never)

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    expect(await screen.findByText('Queued (position unknown)')).toBeInTheDocument()
  })

  it('shows "Running…" for a running run', async () => {
    const running = makeRun({ status: 'RUNNING', columns: null })
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: running, reused: false })
    mockedApi.runs.get.mockResolvedValue(envelope(running) as never)

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    expect(await screen.findByText('Running…')).toBeInTheDocument()
  })

  it('shows the result line and "Run again" for a freshly queued-and-completed run', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun(), reused: false })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    expect(await screen.findByText(/^Result from /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /run again/i })).toBeInTheDocument()
  })

  it('shows the reused-result wording when the result was cached', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun(), reused: true })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    expect(await screen.findByText(/^Showing a cached result from /)).toBeInTheDocument()
  })

  it('overrides the map description with the run heading once a result lands', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({
      data: makeRun({ decoration: { heading: { title: null, description: '&Region: EAST' } } }),
      reused: false,
    })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    expect(await screen.findByText('&Region: EAST')).toBeInTheDocument()
    expect(screen.queryByText('Default description')).not.toBeInTheDocument()
  })

  it('"Run again" re-requests with the run\'s own parameters and force: true', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun(), reused: false })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /run again/i }))

    await waitFor(() =>
      expect(mockedApi.maps.requestRun).toHaveBeenLastCalledWith('map-1', {
        parameters: { region: 'EAST' },
        force: true,
      }),
    )
  })
})

describe('MapViewerPage failure toast', () => {
  it('shows a non-destructive "not run" toast for a REFUSED failure', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({
      data: makeRun({
        status: 'FAILED',
        columns: null,
        errorMessage: 'fans out',
        decoration: { error: { kind: 'REFUSED', refusal: { code: 'FAN_TRAP_R4' } } },
      }),
      reused: false,
    })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Worksheet not run', variant: 'default' }),
      ),
    )
  })

  it('shows a destructive "run failed" toast for a non-refusal failure', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({
      data: makeRun({
        status: 'FAILED',
        columns: null,
        errorMessage: 'ORA-00942: table or view does not exist',
        decoration: { error: { kind: 'QUERY' } },
      }),
      reused: false,
    })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Run failed',
          description: 'ORA-00942: table or view does not exist',
          variant: 'destructive',
        }),
      ),
    )
  })
})

describe('MapViewerPage load more', () => {
  it('shows Load more when more stored rows remain and pages them in via useMapRun', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun({ rowCount: 2 }), reused: false })
    mockedApi.runs.rows.mockResolvedValueOnce(envelope([{ C1: 1 }]) as never)
    mockedApi.runs.rows.mockResolvedValueOnce(envelope([{ C1: 2 }]) as never)

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    // Wait for the first page to actually render before paging further, so
    // the click below can't race the initial load (both start from offset 0).
    await screen.findByText('1')
    const loadMoreButton = await screen.findByRole('button', { name: /load more/i })
    fireEvent.click(loadMoreButton)

    await waitFor(() => expect(mockedApi.runs.rows).toHaveBeenCalledWith('run-1', 1, 500))
  })

  it('hides Load more once every row has been loaded', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun({ rowCount: 1 }), reused: false })

    renderViewer()
    fireEvent.click(await screen.findByRole('button', { name: /^run$/i }))

    await screen.findByText(/^Result from /)
    // Wait for the (only) page of rows to actually land — hasMore briefly
    // reads true before it, since it only compares counts, not load state.
    await screen.findByText('1')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument(),
    )
  })
})
