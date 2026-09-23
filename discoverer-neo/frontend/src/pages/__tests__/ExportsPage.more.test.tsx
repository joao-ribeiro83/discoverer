import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ExportsPage } from '@/pages/ExportsPage'
import { apiClient } from '@/lib/api'
import type { ExportJob } from '@/lib/types'

// Covers what ExportsPage.test.tsx doesn't: each status badge, a successful
// download, a failed download's toast, the empty state, and the mapName ->
// id-prefix fallback.

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))

vi.mock('@/lib/api', () => ({
  apiClient: {
    exports: { list: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'download error'),
}))

const mockedApi = vi.mocked(apiClient, true)

function job(over: Partial<ExportJob> = {}): ExportJob {
  return {
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
    ...over,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mockToast.mockClear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ExportsPage status badges', () => {
  it.each([
    ['PENDING', 'Queued'],
    ['PROCESSING', 'Running'],
    ['FAILED', 'Failed'],
    ['COMPLETED', 'Completed'],
  ] as const)('shows %s as "%s"', async (status, label) => {
    mockedApi.exports.list.mockResolvedValue({ data: { data: [job({ status })] } } as never)
    renderPage()
    expect(await screen.findByText(label)).toBeInTheDocument()
  })
})

describe('ExportsPage empty state', () => {
  it('shows a message when there are no exports', async () => {
    mockedApi.exports.list.mockResolvedValue({ data: { data: [] } } as never)
    renderPage()
    expect(await screen.findByText(/no exports yet/i)).toBeInTheDocument()
  })
})

describe('ExportsPage mapName fallback', () => {
  it('shows the id prefix when mapName is null', async () => {
    mockedApi.exports.list.mockResolvedValue(
      { data: { data: [job({ mapName: null, mapId: 'abcdefgh-1234' })] } } as never,
    )
    renderPage()
    expect(await screen.findByText('abcdefgh')).toBeInTheDocument()
  })
})

describe('ExportsPage download', () => {
  it('downloads a completed job and only shows the button for COMPLETED', async () => {
    mockedApi.exports.list.mockResolvedValue({ data: { data: [job()] } } as never)
    mockedApi.exports.download.mockResolvedValue({ data: new Blob(['x']) } as never)
    renderPage()

    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    fireEvent.click(within(row).getByTitle('Download'))

    await waitFor(() => expect(mockedApi.exports.download).toHaveBeenCalledWith('job-1'))
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('hides the download button for a job still processing', async () => {
    mockedApi.exports.list.mockResolvedValue({ data: { data: [job({ status: 'PROCESSING' })] } } as never)
    renderPage()
    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    expect(within(row).queryByTitle('Download')).not.toBeInTheDocument()
  })

  it('toasts a failure when the download rejects', async () => {
    mockedApi.exports.list.mockResolvedValue({ data: { data: [job()] } } as never)
    mockedApi.exports.download.mockRejectedValue(new Error('disk full'))
    renderPage()

    const row = (await screen.findByText('Sales by Region')).closest('tr')!
    fireEvent.click(within(row).getByTitle('Download'))

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Download failed', description: 'disk full', variant: 'destructive' }),
      ),
    )
  })
})
