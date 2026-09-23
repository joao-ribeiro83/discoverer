import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RunsPage } from '@/pages/RunsPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { MapRun } from '@/lib/types'

// Covers the branches RunsPage.test.tsx doesn't: the three filters (incl.
// empty-after-filter), the admin-only "all users" toggle, the delete dialog,
// the reused-vs-queued "Run again" toast, the >3-params / no-params summary,
// and the "—" fallbacks for duration/rows.

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

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
    parameters: {},
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
  mockToast.mockClear()
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RunsPage filters', () => {
  it('narrows to the selected status and shows the empty state when nothing matches', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({ id: 'r1', mapName: 'Completed Map', status: 'COMPLETED' }),
        makeRun({ id: 'r2', mapName: 'Failed Map', status: 'FAILED' }),
      ]) as never,
    )
    renderPage()
    await screen.findByText('Completed Map')

    const [, statusSelect] = screen.getAllByRole('combobox')
    fireEvent.click(statusSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Cancelled' }))

    // Neither row's status is CANCELLED.
    await waitFor(() => expect(screen.queryByText('Completed Map')).not.toBeInTheDocument())
    expect(screen.queryByText('Failed Map')).not.toBeInTheDocument()
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument()
  })

  it('narrows to the selected kind', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({ id: 'r1', mapName: 'Live Map', kind: 'LIVE' }),
        makeRun({ id: 'r2', mapName: 'Scheduled Map', kind: 'SCHEDULED' }),
      ]) as never,
    )
    renderPage()
    await screen.findByText('Live Map')

    const [, , kindSelect] = screen.getAllByRole('combobox')
    fireEvent.click(kindSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Scheduled' }))

    await waitFor(() => expect(screen.queryByText('Live Map')).not.toBeInTheDocument())
    expect(screen.getByText('Scheduled Map')).toBeInTheDocument()
  })

  it('narrows to the selected map', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({ id: 'r1', mapId: 'map-1', mapName: 'Sales by Region' }),
        makeRun({ id: 'r2', mapId: 'map-2', mapName: 'Costs by Region' }),
      ]) as never,
    )
    renderPage()
    await screen.findByText('Sales by Region')

    const [mapSelect] = screen.getAllByRole('combobox')
    fireEvent.click(mapSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Costs by Region' }))

    await waitFor(() => expect(screen.queryByText('Sales by Region')).not.toBeInTheDocument())
    // "Costs by Region" now also shows as the select's own current value, so
    // there are two matches (the trigger and the table cell) — just check the
    // row is there.
    expect(screen.getAllByText('Costs by Region').length).toBeGreaterThan(0)
    expect(document.querySelector('tbody')?.textContent).toContain('Costs by Region')
  })
})

describe('RunsPage admin "all users" toggle', () => {
  it('hides the toggle for a non-admin', async () => {
    mockedApi.runs.list.mockResolvedValue(envelope([makeRun()]) as never)
    renderPage()
    await screen.findByText('Sales by Region')
    expect(screen.queryByText(/show every user/i)).not.toBeInTheDocument()
  })

  it('shows the toggle for an admin and re-requests with all:true when checked', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@example.com', name: 'Admin', role: 'ADMIN' },
      token: 't',
      isAuthenticated: true,
    })
    mockedApi.runs.list.mockResolvedValue(envelope([makeRun()]) as never)
    renderPage()
    await screen.findByText('Sales by Region')

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() =>
      expect(mockedApi.runs.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ all: true }),
      ),
    )
  })
})

describe('RunsPage delete', () => {
  it('confirms then deletes a terminal run', async () => {
    const run = makeRun({ status: 'FAILED' })
    mockedApi.runs.list.mockResolvedValue(envelope([run]) as never)
    mockedApi.runs.cancel.mockResolvedValue(envelope({ cancelled: true }) as never)
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!

    fireEvent.click(within(row).getByTitle('Delete'))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(mockedApi.runs.cancel).toHaveBeenCalledWith('run-1'))
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Run deleted' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not show a delete button for a run still in flight', async () => {
    mockedApi.runs.list.mockResolvedValue(envelope([makeRun({ status: 'RUNNING' })]) as never)
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    expect(within(row).queryByTitle('Delete')).not.toBeInTheDocument()
  })
})

describe('RunsPage "Run again" toast', () => {
  it('shows "Result reused" when the run was reused', async () => {
    const run = makeRun()
    mockedApi.runs.list.mockResolvedValue(envelope([run]) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: run, reused: true })
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!

    fireEvent.click(within(row).getByTitle('Run again'))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Result reused' })),
    )
  })

  it('shows "Queued" when a new run was queued', async () => {
    const run = makeRun()
    mockedApi.runs.list.mockResolvedValue(envelope([run]) as never)
    mockedApi.maps.requestRun.mockResolvedValue({ data: run, reused: false })
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!

    fireEvent.click(within(row).getByTitle('Run again'))

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Queued' })))
  })
})

describe('RunsPage parameters summary', () => {
  it('truncates a summary of more than 3 parameters with an ellipsis and a full title', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([
        makeRun({
          parameters: { a: '1', b: '2', c: '3', d: '4' },
        }),
      ]) as never,
    )
    renderPage()
    const cell = (await screen.findByText(/a=1, b=2, c=3…/)).closest('td')!
    expect(cell.getAttribute('title')).toBe('a=1, b=2, c=3, d=4')
  })

  it('shows the "none" label when a run has no parameters', async () => {
    mockedApi.runs.list.mockResolvedValue(envelope([makeRun({ parameters: {} })]) as never)
    renderPage()
    await screen.findByText('Sales by Region')
    // The summary cell renders the noParameters label ("—").
    const row = screen.getByText('Sales by Region').closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells[2].textContent).toBe('—')
  })
})

describe('RunsPage duration and row-count fallbacks', () => {
  it('shows "—" for both when rowCount and executionTimeMs are null', async () => {
    mockedApi.runs.list.mockResolvedValue(
      envelope([makeRun({ rowCount: null, executionTimeMs: null })]) as never,
    )
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    // columns: map, kind, parameters, status, rows, duration, ranAt, expiresIn, actions
    expect(cells[4].textContent).toBe('—')
    expect(cells[5].textContent).toBe('—')
  })
})
