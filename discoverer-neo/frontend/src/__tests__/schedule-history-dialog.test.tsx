import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScheduleHistoryDialog } from '@/pages/SchedulesPage'
import { apiClient } from '@/lib/api'
import type { Schedule, ScheduledResult } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    schedules: { history: vi.fn(), downloadResult: vi.fn() },
    exports: { getStatus: vi.fn(), download: vi.fn() },
    maps: { createExport: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const mockedApi = vi.mocked(apiClient, true)

function makeSchedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-1',
    mapId: 'map-1',
    name: 'Nightly',
    cronExpression: '0 0 * * *',
    timezone: 'UTC',
    validFrom: null,
    validUntil: null,
    outputFormat: 'CSV',
    isActive: true,
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    parameters: [],
    nextRunAt: null,
    plannerDecision: null,
    plannerRefusalDetail: null,
    ...over,
  }
}

function makeResult(over: Partial<ScheduledResult> = {}): ScheduledResult {
  return {
    id: 'result-1',
    scheduleId: 'sched-1',
    executedAt: '2026-01-01T00:00:00Z',
    rowCount: 10,
    filePath: null,
    executionTimeMs: 500,
    status: 'SUCCESS',
    errorMessage: null,
    runId: null,
    expiresAt: null,
    ...over,
  }
}

function envelope<T>(data: T) {
  return { data: { data } }
}

function renderDialog(schedule: Schedule) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ScheduleHistoryDialog schedule={schedule} onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ScheduleHistoryDialog', () => {
  it('shows XLSX/CSV/PDF and an Open link for a row with a valid runId', async () => {
    mockedApi.schedules.history.mockResolvedValue(
      envelope([
        makeResult({ id: 'r1', runId: 'run-1', expiresAt: '2026-01-03T00:00:00Z' }),
      ]) as never,
    )
    renderDialog(makeSchedule())

    expect(await screen.findByText('XLSX')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
    const openLink = screen.getByRole('link', { name: /open/i })
    expect(openLink).toHaveAttribute('href', '/maps/map-1/view?run=run-1')
  })

  it('shows the existing Download button for a row with only a filePath', async () => {
    mockedApi.schedules.history.mockResolvedValue(
      envelope([makeResult({ id: 'r2', filePath: '/tmp/r2.csv', runId: null, expiresAt: null })]) as never,
    )
    renderDialog(makeSchedule())

    await screen.findByText(/10/) // rows column, waits for the row to render
    expect(screen.queryByText('XLSX')).not.toBeInTheDocument()
    expect(screen.getByTitle('Download')).toBeInTheDocument()
  })

  it('shows no export buttons for an expired run (Open link still works)', async () => {
    mockedApi.schedules.history.mockResolvedValue(
      envelope([
        makeResult({ id: 'r3', runId: 'run-3', expiresAt: '2026-01-01T00:00:00Z', filePath: null }),
      ]) as never,
    )
    renderDialog(makeSchedule())

    await screen.findByText(/10/)
    expect(screen.queryByText('XLSX')).not.toBeInTheDocument()
    expect(screen.queryByText('CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('PDF')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open/i })).toBeInTheDocument()
  })

  it('shows no export buttons for a FAILED run, but keeps the Open link', async () => {
    // The worker records a result — and a live 24h `expiresAt` — on failure
    // too, so a FAILED row has everything the (old, buggy) export gate
    // checked for. The backend has nothing to export for a run that never
    // completed, so the gate must also check `status`.
    mockedApi.schedules.history.mockResolvedValue(
      envelope([
        makeResult({
          id: 'r4',
          status: 'FAILED',
          runId: 'run-4',
          expiresAt: '2026-01-03T00:00:00Z',
          errorMessage: 'ORA-12154',
        }),
      ]) as never,
    )
    renderDialog(makeSchedule())

    expect(await screen.findByText('FAILED')).toBeInTheDocument()
    expect(screen.queryByText('XLSX')).not.toBeInTheDocument()
    expect(screen.queryByText('CSV')).not.toBeInTheDocument()
    expect(screen.queryByText('PDF')).not.toBeInTheDocument()
    const openLink = screen.getByRole('link', { name: /open/i })
    expect(openLink).toHaveAttribute('href', '/maps/map-1/view?run=run-4')
  })

  it('shows the relative expiry text next to the buttons', async () => {
    mockedApi.schedules.history.mockResolvedValue(
      envelope([
        // 2 hours ahead of the frozen clock (2026-01-02T00:00:00Z).
        makeResult({ id: 'r5', runId: 'run-5', expiresAt: '2026-01-02T02:00:00Z' }),
      ]) as never,
    )
    renderDialog(makeSchedule())

    expect(await screen.findByText(/Expires 2h/)).toBeInTheDocument()
  })
})
