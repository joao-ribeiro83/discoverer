import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import { apiClient } from '@/lib/api'
import type { ExecuteResult } from '@/lib/types'

// jsdom has no real layout; fake the virtualizer to render every row (see
// results-table.test.tsx for the full rationale).
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
      execute: vi.fn(),
      executeAsync: vi.fn(),
      getExecutionStatus: vi.fn(),
      createExport: vi.fn(),
    },
    exports: {
      list: vi.fn(),
      getStatus: vi.fn(),
      download: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) =>
    (err as { message?: string } | undefined)?.message ?? 'error',
  getErrorKind: (err: unknown) => (err as { kind?: string } | undefined)?.kind,
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function baseResult(over: Partial<ExecuteResult> = {}): ExecuteResult {
  return {
    columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
    rows: [{ C1: 10 }, { C1: 20 }],
    rowCount: 2,
    executionTimeMs: 42,
    truncated: false,
    ...over,
  }
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

// jsdom doesn't implement these Blob/URL APIs the download flow touches.
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

describe('ExecutionPanel', () => {
  it('shows row count, execution time, and toggles the SQL view', () => {
    const result = baseResult({ sql: 'SELECT "C1" FROM "T"' })
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={result}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )

    // Both the header badge and the ResultsTable footer show a row count.
    expect(screen.getAllByText('2 rows').length).toBeGreaterThan(0)
    expect(screen.getByText('42 ms')).toBeInTheDocument()
    expect(screen.queryByText(/SELECT "C1"/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /SQL/ }))
    expect(screen.getByText(/SELECT "C1"/)).toBeInTheDocument()
  })

  it('renders the results grid for the given columns/rows', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult()}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('shows a kind-specific error banner for a failed run', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError={{ kind: 'TIMEOUT', message: 'Statement timed out' }}
        onResultChange={() => {}}
      />,
    )
    expect(screen.getByText('Query timed out')).toBeInTheDocument()
    expect(screen.getByText('Statement timed out')).toBeInTheDocument()
  })

  it('offers Load more for a truncated result and appends the next page', async () => {
    mockedApi.maps.execute.mockResolvedValue(
      envelope(baseResult({ rows: [{ C1: 30 }], rowCount: 1, truncated: false })) as never,
    )
    const onResultChange = vi.fn()
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult({ truncated: true })}
        parameters={{ region: 'EAST' }}
        onResultChange={onResultChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Load more/ }))

    await waitFor(() => expect(mockedApi.maps.execute).toHaveBeenCalledTimes(1))
    expect(mockedApi.maps.execute).toHaveBeenCalledWith('map-1', {
      parameters: { region: 'EAST' },
      offset: 2,
    })
    await waitFor(() =>
      expect(onResultChange).toHaveBeenCalledWith(
        expect.objectContaining({ rowCount: 3, rows: [{ C1: 10 }, { C1: 20 }, { C1: 30 }] }),
      ),
    )
  })

  it('exports to Excel: creates the job, polls to completion, and downloads the file', async () => {
    mockedApi.maps.createExport.mockResolvedValue(
      envelope({ jobId: 'job-1', status: 'PENDING' }) as never,
    )
    // Status and download are keyed by job id alone, not nested under the map.
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-1',
        mapId: 'map-1',
        format: 'XLSX',
        status: 'COMPLETED',
        progress: 100,
        rowCount: 3,
        errorMessage: null,
        createdAt: '',
        completedAt: '',
      }) as never,
    )
    mockedApi.exports.download.mockResolvedValue({ data: new Blob(['x']) } as never)

    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult()}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Excel$/ }))

    await waitFor(() => expect(mockedApi.maps.createExport).toHaveBeenCalledWith('map-1', {
      format: 'XLSX',
      parameters: {},
      calculatedFields: undefined,
    }))
    await waitFor(() => expect(mockedApi.exports.download).toHaveBeenCalledWith('job-1'))
  })
})
