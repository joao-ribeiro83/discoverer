import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunsPage } from '@/pages/RunsPage'
import { apiClient } from '@/lib/api'
import type { MapRun } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    runs: { list: vi.fn(), cancel: vi.fn() },
    maps: { requestRun: vi.fn() },
    exports: { getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
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
    columns: null,
    decoration: null,
    rowCount: 42,
    truncated: false,
    executionTimeMs: 120,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-01T00:00:01Z',
    completedAt: '2026-01-01T00:00:02Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...over,
  }
}

function envelope<T>(data: T) {
  return { data: { data } }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RunsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RunsPage', () => {
  it('renders rows with map name, kind, status and expires-in', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([makeRun({ expiresAt: '2026-01-01T14:00:00Z' })]) as never,
    )
    renderPage()

    expect(await screen.findByText('Sales by Region')).toBeInTheDocument()
    expect(screen.getByText(/live/i)).toBeInTheDocument()
    expect(screen.getByText(/completed/i)).toBeInTheDocument()
    // 2 hours ahead of the frozen clock.
    expect(screen.getByText(/2h/)).toBeInTheDocument()
  })

  it('hides export buttons on an expired run and on a queued run', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({ id: 'run-expired', mapName: 'Expired Map', expiresAt: '2026-01-01T00:00:00Z' }),
        makeRun({ id: 'run-queued', mapName: 'Queued Map', status: 'QUEUED', expiresAt: '2026-01-02T00:00:00Z' }),
        makeRun({ id: 'run-valid', mapName: 'Valid Map', expiresAt: '2026-01-02T00:00:00Z' }),
      ]) as never,
    )
    renderPage()

    const expiredRow = (await screen.findByText('Expired Map')).closest('tr')!
    const queuedRow = screen.getByText('Queued Map').closest('tr')!
    const validRow = screen.getByText('Valid Map').closest('tr')!

    expect(within(expiredRow).queryByText('XLSX')).not.toBeInTheDocument()
    expect(within(queuedRow).queryByText('XLSX')).not.toBeInTheDocument()
    expect(within(validRow).getByText('XLSX')).toBeInTheDocument()
    expect(within(validRow).getByText('CSV')).toBeInTheDocument()
    expect(within(validRow).getByText('PDF')).toBeInTheDocument()
  })

  it('"Run again" calls maps.requestRun with the row\'s parameters, calculatedFields and force false', async () => {
    const run = makeRun({
      parameters: { region: 'WEST' },
      calculatedFields: [{ name: 'MARGIN', formula: 'REVENUE - COST' }],
    })
    mockedApi.runs.list.mockResolvedValue(envelope([run]) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: run, reused: true })

    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /run again/i }))

    await waitFor(() =>
      expect(mockedApi.maps.requestRun).toHaveBeenCalledWith('map-1', {
        parameters: { region: 'WEST' },
        calculatedFields: [{ name: 'MARGIN', formula: 'REVENUE - COST' }],
        force: false,
      }),
    )
  })

  it('shows Cancel only on a QUEUED run', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({ id: 'run-queued', mapName: 'Queued Map', status: 'QUEUED' }),
        makeRun({ id: 'run-done', mapName: 'Done Map', status: 'COMPLETED' }),
        makeRun({ id: 'run-failed', mapName: 'Failed Map', status: 'FAILED' }),
      ]) as never,
    )
    renderPage()

    const queuedRow = (await screen.findByText('Queued Map')).closest('tr')!
    const doneRow = screen.getByText('Done Map').closest('tr')!
    const failedRow = screen.getByText('Failed Map').closest('tr')!

    expect(within(queuedRow).getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(within(doneRow).queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    expect(within(failedRow).queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })
})
