import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { MapViewerPage } from '@/pages/MapViewerPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { apiClient } from '@/lib/api'
import type { MapRun, MapWithDetails } from '@/lib/types'

// These cover the defect this stage exists for: a primary action that gives no
// feedback. Every path through Run must end in a request, a prompt, or a
// stated reason — never in nothing.

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 32, size: 32, key: i })),
    getTotalSize: () => count * 32,
  }),
}))

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: {
      get: vi.fn(),
      requestRun: vi.fn(),
      createExport: vi.fn(),
    },
    runs: {
      get: vi.fn(),
      rows: vi.fn(),
      cancel: vi.fn(),
    },
    exports: { list: vi.fn(), getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) =>
    (err as { message?: string } | undefined)?.message ?? 'error',
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
    parameters: {},
    calculatedFields: [],
    columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
    decoration: null,
    rowCount: 1,
    truncated: false,
    executionTimeMs: 5,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2099-01-01T00:00:00Z',
    ...over,
  }
}

function makeMap(over: Partial<MapWithDetails> = {}): MapWithDetails {
  return {
    id: 'map-1',
    name: 'Sales by Region',
    description: null,
    mapType: 'TABLE',
    businessAreaId: 'ba-1',
    createdBy: 'user-1',
    isPublic: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    items: [
      {
        id: 'mi-1',
        mapId: 'map-1',
        itemId: 'item-1',
        displayOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    ...over,
  } as MapWithDetails
}

function renderViewer(ui: ReactNode, path = '/maps/map-1/view') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/maps/:id/view" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function envelope<T>(data: T) {
  return { data: { data } }
}

describe('MapViewerPage — Run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.runs.rows.mockResolvedValue(envelope([{ C1: 1 }]) as never)
  })

  it('issues the run request when Run is clicked', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: makeRun(), reused: false })

    renderViewer(<MapViewerPage />)
    fireEvent.click(await screen.findByRole('button', { name: /run/i }))

    await waitFor(() =>
      expect(mockedApi.maps.requestRun).toHaveBeenCalledWith('map-1', {
        parameters: {},
        force: false,
      }),
    )
  })

  it('prompts for parameters and does not execute until they are supplied', async () => {
    mockedApi.maps.get.mockResolvedValue(
      envelope(
        makeMap({
          parameters: [
            {
              id: 'p-1',
              mapId: 'map-1',
              name: 'Dt Inicio',
              bindName: 'p_dt_inicio',
              paramType: 'DATE',
              defaultValue: null,
              isRequired: true,
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      ) as never,
    )

    mockedApi.maps.requestRun.mockResolvedValue({
      data: makeRun({ parameters: { 'Dt Inicio': '2026-01-01' } }),
      reused: false,
    })

    renderViewer(<MapViewerPage />)
    fireEvent.click(await screen.findByRole('button', { name: /run/i }))

    // The prompt is the feedback. Nothing was sent.
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(mockedApi.maps.requestRun).not.toHaveBeenCalled()

    // An empty required value keeps the gate closed.
    const dialogRun = screen.getAllByRole('button', { name: /run/i }).at(-1)!
    fireEvent.click(dialogRun)
    expect(mockedApi.maps.requestRun).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/Dt Inicio/), { target: { value: '2026-01-01' } })
    fireEvent.click(screen.getAllByRole('button', { name: /run/i }).at(-1)!)

    await waitFor(() =>
      expect(mockedApi.maps.requestRun).toHaveBeenCalledWith('map-1', {
        parameters: { 'Dt Inicio': '2026-01-01' },
        force: false,
      }),
    )
  })

  // Fix round 1, MINOR 5: `?run=` names a run id the caller can read, but
  // that run can belong to any map — a stale bookmark, a hand-edited URL, a
  // link copied from the wrong tab. Before this fix the viewer showed
  // whichever map's run it was handed and would replay its parameters on
  // "Run again"; now it's ignored entirely when the map doesn't match.
  it('ignores ?run= when the run belongs to a different map', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap()) as never)
    mockedApi.runs.get.mockResolvedValue(
      envelope(makeRun({ id: 'run-9', mapId: 'map-2', parameters: { region: 'WEST' } })) as never,
    )

    renderViewer(<MapViewerPage />, '/maps/map-1/view?run=run-9')

    await waitFor(() => expect(mockedApi.runs.get).toHaveBeenCalledWith('run-9'))

    // Neither the foreign run's result nor its "Run again" affordance shows.
    expect(await screen.findByText(/run the map to see results/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /run again/i })).toBeNull()
  })

  it('disables Run with a stated reason when the map has no output columns', async () => {
    mockedApi.maps.get.mockResolvedValue(envelope(makeMap({ items: [] })) as never)

    renderViewer(<MapViewerPage />)
    const run = await screen.findByRole('button', { name: /run/i })

    expect(run).toBeDisabled()
    // Disabled alone is not feedback — the reason must be on screen, not just
    // in a tooltip a keyboard user never sees.
    expect(screen.getByText(/no output columns/i)).toBeTruthy()
    expect(run.getAttribute('aria-describedby')).toBe('run-disabled-reason')
  })
})

describe('ErrorBoundary', () => {
  it('catches a render throw and offers a recovery path', () => {
    // React logs the caught error; silence it so the run stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function Boom(): never {
      throw new Error('render exploded')
    }

    render(
      <ErrorBoundary scope="test">
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy()
    // It reports rather than swallowing.
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('names a failed chunk load as a load problem, not a code bug', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ChunkBoom(): never {
      throw new Error('Failed to fetch dynamically imported module: /assets/Page.js')
    }

    render(
      <ErrorBoundary>
        <ChunkBoom />
      </ErrorBoundary>,
    )

    expect(screen.getByText(/could not be loaded/i)).toBeTruthy()
    spy.mockRestore()
  })
})
