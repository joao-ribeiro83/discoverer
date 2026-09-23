import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import { apiClient } from '@/lib/api'
import type { ExecuteResult, MapRun } from '@/lib/types'

// Covers what execution-panel.test.tsx doesn't: the crosstab pivot/fallback
// split, the worksheet-warnings banner, the explain-plan flow, a generic
// (kind-less) error banner, a decoration error with no message, and the
// built-in "Load more" mutation's pending spinner.

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
      explain: vi.fn(),
    },
    exports: { list: vi.fn(), getStatus: vi.fn(), download: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
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

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

describe('ExecutionPanel crosstab', () => {
  it('pivots when the result has a column-edge axis and a measure', () => {
    const result = baseResult({
      columns: [
        { name: 'REGION', label: 'Region', isAggregate: false, axisEdge: 'COLUMN' },
        { name: 'AMOUNT', label: 'Amount', isAggregate: true },
      ],
      rows: [{ REGION: 'EAST', AMOUNT: 5 }],
    })
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        mapType="CROSSTAB"
        result={result}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )
    // The plain-table fallback note is absent — it actually pivoted.
    expect(screen.queryByTestId('crosstab-fallback-note')).not.toBeInTheDocument()
    expect(screen.getByText('EAST')).toBeInTheDocument()
  })

  it('falls back to the table with an explanatory note when there is no column edge', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        mapType="CROSSTAB"
        result={baseResult()}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )
    expect(screen.getByTestId('crosstab-fallback-note')).toBeInTheDocument()
    // The grid still renders as a plain table.
    expect(screen.getByText('10')).toBeInTheDocument()
  })
})

describe('ExecutionPanel worksheet warnings', () => {
  it('lists warnings the run could not carry over', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult({ warnings: ['SELECT DISTINCT dropped the sort'] })}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )
    expect(screen.getByText('SELECT DISTINCT dropped the sort')).toBeInTheDocument()
  })
})

describe('ExecutionPanel explain plan', () => {
  it('fetches and shows the plan when Plan is clicked', async () => {
    mockedApi.maps.explain.mockResolvedValue(envelope({ plan: 'TABLE ACCESS FULL SALES' }) as never)
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult({ sql: 'SELECT * FROM SALES' })}
        parameters={{ region: 'EAST' }}
        onResultChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /plan/i }))

    expect(await screen.findByText('TABLE ACCESS FULL SALES')).toBeInTheDocument()
    expect(mockedApi.maps.explain).toHaveBeenCalledWith('map-1', { parameters: { region: 'EAST' } })
  })

  it('toasts a failure when the explain call rejects', async () => {
    mockedApi.maps.explain.mockRejectedValue({ message: 'plan unavailable' })
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult({ sql: 'SELECT * FROM SALES' })}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /plan/i }))

    await waitFor(() => expect(mockedApi.maps.explain).toHaveBeenCalled())
    expect(screen.queryByText('TABLE ACCESS FULL SALES')).not.toBeInTheDocument()
  })
})

describe('ExecutionPanel generic and decoration-only errors', () => {
  it('shows the generic execution-error headline when the error carries no kind', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        parameters={{}}
        runError="just a plain string failure"
        onResultChange={() => {}}
      />,
    )
    expect(screen.getByText('Execution error')).toBeInTheDocument()
    expect(screen.getByText('just a plain string failure')).toBeInTheDocument()
  })

  it('shows no error banner when a decoration error carries no message', () => {
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={null}
        run={baseRun({ status: 'FAILED', errorMessage: null, decoration: { error: { kind: 'CONFIG' } } })}
        parameters={{}}
        runError="ignored when decoration.error is present"
        onResultChange={() => {}}
      />,
    )
    expect(screen.queryByTestId('execution-error')).not.toBeInTheDocument()
  })
})

describe('ExecutionPanel built-in Load more (no run)', () => {
  it('shows a spinner and disables the button while the re-execute is pending', async () => {
    let resolveExecute!: (value: unknown) => void
    mockedApi.maps.execute.mockReturnValue(
      new Promise((resolve) => {
        resolveExecute = resolve
      }) as never,
    )
    renderWithProviders(
      <ExecutionPanel
        mapId="map-1"
        mapName="My Map"
        result={baseResult({ truncated: true })}
        parameters={{}}
        onResultChange={() => {}}
      />,
    )

    const button = screen.getByRole('button', { name: /load more/i })
    fireEvent.click(button)

    await waitFor(() => expect(button).toBeDisabled())
    expect(button.querySelector('.animate-spin')).toBeTruthy()

    resolveExecute(envelope(baseResult({ rows: [], rowCount: 0 })))
    await waitFor(() => expect(button).not.toBeDisabled())
  })
})
