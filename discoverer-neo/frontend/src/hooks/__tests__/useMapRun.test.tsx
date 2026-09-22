import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMapRun } from '@/hooks/useMapRun'
import { apiClient } from '@/lib/api'
import type { MapRun } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { requestRun: vi.fn() },
    runs: { get: vi.fn(), rows: vi.fn(), cancel: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
}))

const mockedApi = vi.mocked(apiClient, true)

function makeRun(over: Partial<MapRun> = {}): MapRun {
  return {
    id: 'run-1',
    mapId: 'map-1',
    mapName: 'Sales by Region',
    kind: 'LIVE',
    scheduleId: null,
    status: 'QUEUED',
    parameters: {},
    calculatedFields: [],
    columns: null,
    decoration: null,
    rowCount: null,
    truncated: false,
    executionTimeMs: null,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: null,
    completedAt: null,
    expiresAt: '2026-01-01T01:00:00Z',
    ...over,
  }
}

const COLUMNS = [{ name: 'REGION', label: 'Region', isAggregate: false }]
const ROWS = [{ REGION: 'EAST' }, { REGION: 'WEST' }]

function envelope<T>(data: T) {
  return { data: { data } }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useMapRun', () => {
  it('polls a queued run every second until it completes, then loads the first 500 rows', async () => {
    const queued = makeRun({ status: 'QUEUED' })
    const completed = makeRun({
      status: 'COMPLETED',
      columns: COLUMNS,
      decoration: { groupBreakAliases: [], totals: [], conditionalFormats: [], warnings: [] },
      rowCount: 2,
      truncated: false,
      executionTimeMs: 42,
    })
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: queued, reused: false })
    mockedApi.runs.get.mockResolvedValueOnce(envelope(queued) as never)
    mockedApi.runs.get.mockResolvedValue(envelope(completed) as never)
    mockedApi.runs.rows.mockResolvedValueOnce(envelope(ROWS) as never)

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.request({ parameters: { region: 'EAST' } })
    })

    expect(result.current.isQueued).toBe(true)
    expect(result.current.isReused).toBe(false)

    // Real 1 s polling — the hook's refetchInterval is 1000ms while non-terminal.
    await waitFor(() => expect(result.current.run?.status).toBe('COMPLETED'), { timeout: 3000 })
    expect(mockedApi.runs.get.mock.calls.length).toBeGreaterThanOrEqual(2)

    await waitFor(() => expect(result.current.rows).toEqual(ROWS))
    expect(mockedApi.runs.rows).toHaveBeenCalledWith('run-1', 0, 500)
    expect(result.current.result).toEqual(
      expect.objectContaining({ columns: COLUMNS, rows: ROWS, rowCount: 2, executionTimeMs: 42 }),
    )
  })

  it('does not poll a reused run and loads its rows immediately', async () => {
    const completed = makeRun({
      id: 'run-2',
      status: 'COMPLETED',
      columns: COLUMNS,
      rowCount: 2,
    })
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: completed, reused: true })
    mockedApi.runs.rows.mockResolvedValueOnce(envelope(ROWS) as never)

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.request({ parameters: { region: 'EAST' } })
    })

    expect(result.current.isReused).toBe(true)

    await waitFor(() => expect(result.current.rows).toEqual(ROWS))
    expect(mockedApi.runs.get).not.toHaveBeenCalled()
  })

  it('cancels the active run, moving its status to CANCELLED', async () => {
    const queued = makeRun({ status: 'QUEUED' })
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: queued, reused: false })
    mockedApi.runs.cancel.mockResolvedValueOnce(envelope({ cancelled: true }) as never)

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.request({})
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(mockedApi.runs.cancel).toHaveBeenCalledWith('run-1')
    await waitFor(() => expect(result.current.run?.status).toBe('CANCELLED'))
  })

  it('open(runId) loads an existing run and its rows', async () => {
    const completed = makeRun({ id: 'run-99', status: 'COMPLETED', columns: COLUMNS, rowCount: 2 })
    mockedApi.runs.get.mockResolvedValueOnce(envelope(completed) as never)
    mockedApi.runs.rows.mockResolvedValueOnce(envelope(ROWS) as never)

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.open('run-99')
    })

    await waitFor(() => expect(result.current.run?.id).toBe('run-99'))
    await waitFor(() => expect(result.current.rows).toEqual(ROWS))
    expect(mockedApi.runs.rows).toHaveBeenCalledWith('run-99', 0, 500)
  })
})
