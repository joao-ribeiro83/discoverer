import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMapExport } from '@/hooks/useMapExport'
import { apiClient } from '@/lib/api'

// Branches not already exercised by execution-panel.test.tsx's single happy-path
// export flow: the no-mapId guard, the createExport error toast, a failed
// download, the FAILED-job toast (both with and without a server errorMessage),
// and the "queued" toast for a slow export.

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { createExport: vi.fn() },
    exports: { getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

const mockedApi = vi.mocked(apiClient, true)

interface ToastCallProps {
  title?: string
  description?: string
  variant?: string
}

function lastToastProps(): ToastCallProps {
  return mockToast.mock.calls.at(-1)?.[0] as ToastCallProps
}

function envelope<T>(data: T) {
  return { data: { data } }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMapExport', () => {
  it('refuses to export without a saved map and surfaces the failure toast', async () => {
    const { result } = renderHook(() => useMapExport(null, 'My Map'), { wrapper })

    act(() => {
      result.current.exportFormat('CSV')
    })

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    ))
    expect(mockedApi.maps.createExport).not.toHaveBeenCalled()
  })

  it('refuses to export without a run and surfaces the failure toast', async () => {
    const { result } = renderHook(() => useMapExport('map-1', 'My Map'), { wrapper })

    act(() => {
      result.current.exportFormat('CSV')
    })

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    ))
    expect(mockedApi.maps.createExport).not.toHaveBeenCalled()
  })

  it('surfaces a toast when job creation itself fails', async () => {
    mockedApi.maps.createExport.mockRejectedValueOnce({ message: 'server exploded' })
    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })

    act(() => {
      result.current.exportFormat('XLSX')
    })

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'server exploded', variant: 'destructive' }),
      ),
    )
  })

  it('toasts a failed export job, falling back to a generic message when none is given', async () => {
    mockedApi.maps.createExport.mockResolvedValue(envelope({ jobId: 'job-1', status: 'PENDING' }) as never)
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-1',
        mapId: 'map-1',
        format: 'CSV',
        status: 'FAILED',
        progress: 0,
        rowCount: 0,
        errorMessage: null,
        createdAt: '',
        completedAt: '',
      }) as never,
    )

    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })
    act(() => {
      result.current.exportFormat('CSV')
    })

    await waitFor(() => expect(result.current.status).toBe('FAILED'))
    expect(lastToastProps().variant).toBe('destructive')
    expect(typeof lastToastProps().description).toBe('string')
    // The download flow never runs for a failed job.
    expect(mockedApi.exports.download).not.toHaveBeenCalled()
  })

  it('uses the server-provided errorMessage on a failed job instead of the fallback', async () => {
    mockedApi.maps.createExport.mockResolvedValue(envelope({ jobId: 'job-2', status: 'PENDING' }) as never)
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-2',
        mapId: 'map-1',
        format: 'CSV',
        status: 'FAILED',
        progress: 0,
        rowCount: 0,
        errorMessage: 'disk full',
        createdAt: '',
        completedAt: '',
      }) as never,
    )

    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })
    act(() => {
      result.current.exportFormat('CSV')
    })

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: 'disk full' })),
    )
  })

  it('toasts a download failure without ever calling downloadBlob', async () => {
    mockedApi.maps.createExport.mockResolvedValue(envelope({ jobId: 'job-3', status: 'PENDING' }) as never)
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-3',
        mapId: 'map-1',
        format: 'XLSX',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 1,
        errorMessage: null,
        createdAt: '',
        completedAt: '',
      }) as never,
    )
    mockedApi.exports.download.mockRejectedValueOnce({ message: 'network blip' })

    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })
    act(() => {
      result.current.exportFormat('XLSX')
    })

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'network blip', variant: 'destructive' }),
      ),
    )
  })

  it('stays quiet on the first poll, inside the quiet window', async () => {
    mockedApi.maps.createExport.mockResolvedValue(envelope({ jobId: 'job-4a', status: 'PENDING' }) as never)
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-4a',
        mapId: 'map-1',
        format: 'CSV',
        status: 'PROCESSING',
        progress: 10,
        rowCount: 0,
        errorMessage: null,
        createdAt: '',
        completedAt: '',
      }) as never,
    )

    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })
    act(() => {
      result.current.exportFormat('CSV')
    })

    // Real elapsed time between onMutate and this first resolved poll is a
    // few ms — well under QUIET_POLL_MS — so no toast yet.
    await waitFor(() => expect(result.current.status).toBe('PROCESSING'))
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('shows a one-time queued toast once the quiet window has passed, and stays quiet on the poll after', async () => {
    // Fake timers fight React's scheduler here, so simulate elapsed wall-clock
    // time via Date.now() instead of vi.useFakeTimers: the effect only cares
    // about `Date.now() - startedAt.current >= QUIET_POLL_MS`.
    let now = 1_000_000
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => now)
    mockedApi.maps.createExport.mockResolvedValue(envelope({ jobId: 'job-4b', status: 'PENDING' }) as never)
    // A fresh object per call (not mockResolvedValue's single shared instance)
    // so react-query's data reference actually changes on each refetch —
    // otherwise the effect's `[job, ...]` dependency never sees a new `job`
    // and the queuedToastShown guard on the second poll is never exercised.
    mockedApi.exports.getStatus.mockImplementation(
      () =>
        envelope({
          jobId: 'job-4b',
          mapId: 'map-1',
          format: 'CSV',
          status: 'PROCESSING',
          progress: 10,
          rowCount: 0,
          errorMessage: null,
          createdAt: '',
          completedAt: '',
        }) as never,
    )

    const { result } = renderHook(() => useMapExport('map-1', 'My Map', {}, 'run-1'), { wrapper })
    act(() => {
      result.current.exportFormat('CSV')
    })
    // startedAt.current was captured as `now` in onMutate; move the clock past
    // the quiet window before the first status poll resolves.
    now += 2000

    await waitFor(() => expect(mockToast).toHaveBeenCalled())
    expect(typeof lastToastProps().title).toBe('string')
    expect(typeof lastToastProps().description).toBe('string')

    // React-query's internal timing math needs real Date.now() to keep
    // scheduling refetches; restore it before waiting out another poll cycle.
    dateSpy.mockRestore()
    await new Promise((resolve) => setTimeout(resolve, 900))
    // Still PROCESSING and already shown once — the queuedToastShown guard
    // must keep it from firing again.
    const queuedCalls = mockToast.mock.calls.filter((call) => {
      const props = call[0] as { variant?: string }
      return !('variant' in props) || props.variant !== 'destructive'
    })
    expect(queuedCalls).toHaveLength(1)
  })
})
