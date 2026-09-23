import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExportsPage } from '@/pages/ExportsPage'
import { apiClient } from '@/lib/api'
import type { ExportJob } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    exports: { list: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: () => 'error',
}))

const mockedApi = vi.mocked(apiClient, true)

const job: ExportJob = {
  jobId: 'job-1',
  mapId: 'map-1',
  mapName: 'Sales by Region',
  format: 'CSV',
  status: 'COMPLETED',
  progress: 100,
  rowCount: 3,
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:00:01Z',
}

// Same defaults as main.tsx: a 5 min staleTime, which on its own would serve a
// return visit from cache and miss exports requested since.
function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } } })
}

function page(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mockedApi.exports.list.mockResolvedValue({ data: { data: [job] } } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ExportsPage refresh', () => {
  it('refetches the list on every visit', async () => {
    const queryClient = makeClient()
    const first = render(page(queryClient))
    await waitFor(() => expect(mockedApi.exports.list).toHaveBeenCalledTimes(1))
    first.unmount()

    render(page(queryClient))
    await waitFor(() => expect(mockedApi.exports.list).toHaveBeenCalledTimes(2))
  })

  it('keeps polling slowly when every export has finished', async () => {
    render(page(makeClient()))
    await waitFor(() => expect(mockedApi.exports.list).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(30_000)
    await waitFor(() => expect(mockedApi.exports.list).toHaveBeenCalledTimes(2))
  })

  it('names each map from the export list, not from the caller’s own maps', async () => {
    render(page(makeClient()))
    expect(await screen.findByText('Sales by Region')).toBeInTheDocument()
  })
})
