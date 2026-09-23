import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMapRun } from '@/hooks/useMapRun'
import { apiClient } from '@/lib/api'
import type { MapRun } from '@/lib/types'

// Covers what useMapRun.test.tsx doesn't: loadMore's early-return guards
// (no run yet, run not COMPLETED, already fully loaded), request()'s
// no-mapId and error-catch paths, and cancel()'s no-op/error paths.

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

describe('useMapRun.loadMore guards', () => {
  it('does nothing before any run has been requested or opened', async () => {
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.loadMore()
    })
    expect(mockedApi.runs.rows).not.toHaveBeenCalled()
  })

  it('does nothing while the run is still QUEUED', async () => {
    mockedApi.runs.get.mockResolvedValue(envelope(makeRun({ status: 'QUEUED' })) as never)
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.open('run-1')
    })
    await waitFor(() => expect(result.current.run?.status).toBe('QUEUED'))

    await act(async () => {
      await result.current.loadMore()
    })
    expect(mockedApi.runs.rows).not.toHaveBeenCalled()
  })

  it('does nothing once every row has already been loaded', async () => {
    const completed = makeRun({ status: 'COMPLETED', columns: [{ name: 'C', label: 'C', isAggregate: false }], rowCount: 1 })
    mockedApi.runs.get.mockResolvedValue(envelope(completed) as never)
    mockedApi.runs.rows.mockResolvedValueOnce(envelope([{ C: 1 }]) as never)

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.open('run-1')
    })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))

    await act(async () => {
      await result.current.loadMore()
    })
    // rowCount (1) already matches rows.length (1); no second page request.
    expect(mockedApi.runs.rows).toHaveBeenCalledTimes(1)
  })
})

describe('useMapRun.request', () => {
  it('does nothing when mapId is undefined', async () => {
    const { result } = renderHook(() => useMapRun(undefined), { wrapper })
    await act(async () => {
      await result.current.request({ parameters: {} })
    })
    expect(mockedApi.maps.requestRun).not.toHaveBeenCalled()
    expect(result.current.run).toBeNull()
  })

  it('surfaces an error when requestRun rejects', async () => {
    mockedApi.maps.requestRun.mockRejectedValueOnce({ message: 'no data source' })
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })

    await act(async () => {
      await result.current.request({ parameters: {} })
    })

    expect(result.current.error).toBe('no data source')
    expect(result.current.run).toBeNull()
  })
})

describe('useMapRun.cancel', () => {
  it('does nothing when there is no active run', async () => {
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.cancel()
    })
    expect(mockedApi.runs.cancel).not.toHaveBeenCalled()
  })

  it('does nothing once the run is no longer QUEUED', async () => {
    const running = makeRun({ status: 'RUNNING' })
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: running, reused: false })

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.request({})
    })
    await act(async () => {
      await result.current.cancel()
    })
    expect(mockedApi.runs.cancel).not.toHaveBeenCalled()
  })

  it('surfaces an error when the cancel call rejects', async () => {
    const queued = makeRun({ status: 'QUEUED' })
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: queued, reused: false })
    mockedApi.runs.cancel.mockRejectedValueOnce({ message: 'already claimed' })

    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.request({})
    })
    await act(async () => {
      await result.current.cancel()
    })

    expect(result.current.error).toBe('already claimed')
  })
})
