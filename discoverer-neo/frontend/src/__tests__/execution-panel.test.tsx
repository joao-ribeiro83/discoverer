import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import { apiClient } from '@/lib/api'
import type { ExecuteResult, MapRun } from '@/lib/types'

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
      createExport: vi.fn(),
      drillToDetail: vi.fn(),
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
  getRefusalCode: (err: unknown) => (err as { code?: string } | undefined)?.code,
  getRefusalDetails: (err: unknown) =>
    (err as { details?: Record<string, unknown> } | undefined)?.details,
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

/** A stored run backing a result — COMPLETED and valid unless overridden. */
function baseRun(over: Partial<MapRun> = {}): MapRun {
  return {
    id: 'run-1',
    mapId: 'map-1',
    mapName: 'My Map',
    kind: 'LIVE',
    scheduleId: null,
    status: 'COMPLETED',
    parameters: {},
    calculatedFields: [],
    columns: null,
    decoration: null,
    rowCount: 2,
    truncated: false,
    executionTimeMs: 42,
    errorMessage: null,
    createdAt: '',
    startedAt: null,
    completedAt: '',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
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
        run={baseRun()}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Excel$/ }))

    await waitFor(() => expect(mockedApi.maps.createExport).toHaveBeenCalledWith('map-1', {
      format: 'XLSX',
      runId: 'run-1',
      parameters: {},
      calculatedFields: undefined,
      locale: 'en',
    }))
    await waitFor(() => expect(mockedApi.exports.download).toHaveBeenCalledWith('job-1'))
  })

  it('exports to PDF: creates the job, polls to completion, and downloads the file', async () => {
    mockedApi.maps.createExport.mockResolvedValue(
      envelope({ jobId: 'job-2', status: 'PENDING' }) as never,
    )
    mockedApi.exports.getStatus.mockResolvedValue(
      envelope({
        jobId: 'job-2',
        mapId: 'map-1',
        format: 'PDF',
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
        run={baseRun()}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )

    // PDF first asks for paper, orientation and columns; confirm the defaults.
    fireEvent.click(screen.getByRole('button', { name: /^PDF$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Export$/ }))

    await waitFor(() => expect(mockedApi.maps.createExport).toHaveBeenCalledWith('map-1', {
      format: 'PDF',
      runId: 'run-1',
      parameters: {},
      calculatedFields: undefined,
      locale: 'en',
      pdf: { pageSize: 'A4', orientation: 'PORTRAIT', columns: undefined },
    }))
    await waitFor(() => expect(mockedApi.exports.download).toHaveBeenCalledWith('job-2'))
  })

  // --- Export gating (Task 5.3) ------------------------------------------
  //
  // Exports read from the run's stored rows, never from a live re-execute —
  // so the buttons must not exist unless there is a valid, COMPLETED run to
  // read them from.

  describe('export button gating', () => {
    function queryExportButtons() {
      return {
        excel: screen.queryByRole('button', { name: /^Excel$/ }),
        csv: screen.queryByRole('button', { name: /^CSV$/ }),
        pdf: screen.queryByRole('button', { name: /^PDF$/ }),
      }
    }

    it('hides the export buttons when there is no run', () => {
      renderWithProviders(
        <ExecutionPanel
          mapId="map-1"
          mapName="My Map"
          result={baseResult()}
          parameters={{}}
          onResultChange={() => {}}
        />,
      )
      const buttons = queryExportButtons()
      expect(buttons.excel).toBeNull()
      expect(buttons.csv).toBeNull()
      expect(buttons.pdf).toBeNull()
    })

    it('hides the export buttons when the run has expired', () => {
      renderWithProviders(
        <ExecutionPanel
          mapId="map-1"
          mapName="My Map"
          result={baseResult()}
          run={baseRun({ expiresAt: new Date(Date.now() - 1000).toISOString() })}
          parameters={{}}
          onResultChange={() => {}}
        />,
      )
      const buttons = queryExportButtons()
      expect(buttons.excel).toBeNull()
      expect(buttons.csv).toBeNull()
      expect(buttons.pdf).toBeNull()
    })

    it('shows XLSX, CSV, and PDF buttons for a completed, still-valid run', () => {
      renderWithProviders(
        <ExecutionPanel
          mapId="map-1"
          mapName="My Map"
          result={baseResult()}
          run={baseRun()}
          parameters={{}}
          onResultChange={() => {}}
        />,
      )
      const buttons = queryExportButtons()
      expect(buttons.excel).not.toBeNull()
      expect(buttons.csv).not.toBeNull()
      expect(buttons.pdf).not.toBeNull()
    })
  })

  // --- Error surface (Phase 2.2) ----------------------------------------
  //
  // The point of these three is that the *shape* of the feedback differs by
  // kind. A refusal that renders as a red error banner is the defect D-036
  // exists to prevent, and a CONFIG error that reads like an ORACLE one tells
  // the user to call the wrong person.

  it('renders a CONFIG error and an ORACLE (QUERY) error with different headlines', () => {
    const { unmount } = renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError={{ kind: 'CONFIG', message: 'Unknown item reference' }}
        onResultChange={() => {}}
      />,
    )
    const configHeadline = screen.getByTestId('execution-error').textContent
    unmount()

    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError={{ kind: 'QUERY', message: 'table or view does not exist' }}
        onResultChange={() => {}}
      />,
    )
    const queryHeadline = screen.getByTestId('execution-error').textContent

    expect(configHeadline).not.toEqual(queryHeadline)
  })

  it('renders a refusal as an explanation, not as the generic error banner', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError={{
          kind: 'REFUSED',
          code: 'FAN_TRAP_R4',
          details: { folders: ['Sales', 'Sales Lines'] },
          message: 'This query fans out from more than one folder at once',
        }}
        onResultChange={() => {}}
      />,
    )

    const refusal = screen.getByTestId('execution-refusal')
    expect(refusal).toBeTruthy()
    // The explanation names both folders and offers a next step.
    expect(refusal.textContent).toContain('Sales Lines')
    // And the red error banner must not also appear.
    expect(screen.queryByTestId('execution-error')).toBeNull()
  })

  it('drills to detail on a row double-click', async () => {
    mockedApi.maps.drillToDetail.mockResolvedValue(
      envelope(
        baseResult({
          columns: [{ name: 'C1', label: 'Amount', isAggregate: false }],
          rows: [{ C1: 4 }, { C1: 6 }],
          rowCount: 2,
        }),
      ) as never,
    )

    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult()}
        parameters={{ region: 'EAST' }}
        onResultChange={() => {}}
      />,
    )

    fireEvent.doubleClick(screen.getByText('10'))

    expect(await screen.findByText('Drill to Detail')).toBeInTheDocument()
    await waitFor(() =>
      expect(mockedApi.maps.drillToDetail).toHaveBeenCalledWith('map-1', {
        parameters: { region: 'EAST' },
        rowValues: { C1: 10 },
      }),
    )
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('falls back to the error banner when a REFUSED response carries no code', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError={{ kind: 'REFUSED', message: 'declined' }}
        onResultChange={() => {}}
      />,
    )
    expect(screen.queryByTestId('execution-refusal')).toBeNull()
    expect(screen.getByTestId('execution-error')).toBeTruthy()
  })
})
