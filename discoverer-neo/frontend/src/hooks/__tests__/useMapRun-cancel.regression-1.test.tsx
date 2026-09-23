// Regression: a double-clicked Cancel sent a second DELETE, which reached the
// already-CANCELLED run and deleted it (DELETE on a non-queued run deletes).
// Found by review of the /qa fix wave on 2026-09-23
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-09-23.md
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
  getErrorMessage: () => 'error',
}))

const mockedApi = vi.mocked(apiClient, true)

function makeRun(status: MapRun['status']): MapRun {
  return {
    id: 'run-1',
    mapId: 'map-1',
    mapName: 'Sales by Region',
    kind: 'LIVE',
    scheduleId: null,
    status,
    parameters: {},
    calculatedFields: [],
    columns: [{ name: 'REGION', label: 'Region', isAggregate: false }],
    decoration: null,
    rowCount: 0,
    truncated: false,
    executionTimeMs: null,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: null,
    completedAt: null,
    expiresAt: '2099-01-01T00:00:00Z',
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.resetAllMocks()
  mockedApi.runs.rows.mockResolvedValue({ data: { data: [] } } as never)
})

describe('useMapRun cancel guard', () => {
  it('sends one DELETE when cancel is called twice at once', async () => {
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: makeRun('QUEUED'), reused: false })
    mockedApi.runs.cancel.mockResolvedValue({ data: { data: { cancelled: true } } } as never)
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.request({})
    })

    await act(async () => {
      await Promise.all([result.current.cancel(), result.current.cancel()])
    })
    await act(async () => {
      await result.current.cancel()
    })

    expect(mockedApi.runs.cancel).toHaveBeenCalledTimes(1)
  })

  it('does not send DELETE for a run that is no longer queued', async () => {
    mockedApi.maps.requestRun.mockResolvedValueOnce({ data: makeRun('COMPLETED'), reused: true })
    const { result } = renderHook(() => useMapRun('map-1'), { wrapper })
    await act(async () => {
      await result.current.request({})
    })

    await act(async () => {
      await result.current.cancel()
    })

    expect(mockedApi.runs.cancel).not.toHaveBeenCalled()
  })
})
