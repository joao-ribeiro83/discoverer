import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { MigrationPage } from '@/pages/MigrationPage'
import { apiClient } from '@/lib/api'
import type {
  AssessmentReport,
  DataSource,
  EulVersionInfo,
  MigrationJob,
  MigrationTableCounts,
} from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    dataSources: { list: vi.fn() },
    migration: {
      detectVersion: vi.fn(),
      analyze: vi.fn(),
      run: vi.fn(),
      getJob: vi.fn(),
      listJobs: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function makeDataSource(over: Partial<DataSource> = {}): DataSource {
  return {
    id: 'ds-oracle',
    name: 'Legacy Discoverer',
    description: null,
    connectionType: 'oracle',
    host: 'ora.example.com',
    port: 1521,
    serviceName: 'ORCL',
    sid: null,
    username: 'EUL5_US',
    isActive: true,
    createdAt: '2026-07-18T00:00:00Z',
    hasPassword: true,
    hasConnectionString: false,
    ...over,
  }
}

function makeVersion(over: Partial<EulVersionInfo> = {}): EulVersionInfo {
  return {
    version: 'EUL5',
    prefix: 'EUL5_',
    discovererVersion: '10.1.2/11.1.1',
    schemaVersion: '5.1.0.0.0',
    tableNames: ['EUL5_BA', 'EUL5_OBJS'],
    owner: 'EUL5_US',
    supported: true,
    warnings: [],
    ...over,
  }
}

function zeroCounts(): MigrationTableCounts {
  return {
    users: 0,
    business_areas: 0,
    folders: 0,
    items: 0,
    joins: 0,
    hierarchies: 0,
    hierarchy_levels: 0,
    custom_functions: 0,
    maps: 0,
    map_items: 0,
    user_business_area_grants: 0,
  }
}

function makeJob(over: Partial<MigrationJob> = {}): MigrationJob {
  return {
    id: 'job-1',
    status: 'RUNNING',
    dataSourceId: 'ds-oracle',
    dryRun: true,
    requestedVersion: 'auto',
    detectedVersion: null,
    startedBy: 'admin',
    startedAt: '2026-07-18T00:00:00Z',
    finishedAt: null,
    progress: 10,
    currentPhase: 'read',
    logs: [],
    droppedLogs: 0,
    result: null,
    error: null,
    ...over,
  }
}

function makeReport(over: Partial<AssessmentReport> = {}): AssessmentReport {
  return {
    version: makeVersion(),
    counts: {
      businessAreas: 1,
      folders: 2,
      items: 2,
      calculatedItems: 1,
      conditions: 0,
      securityConditions: 1,
      joins: 1,
      hierarchies: 1,
      customFunctions: 1,
      workbooks: 1,
      users: 2,
      grants: 3,
    },
    folderTypeBreakdown: { TABLE: 1, SUMMARY: 1 },
    orphans: { total: 0 },
    complexity: { score: 'simple', points: 14 },
    warnings: [
      { severity: 'info', code: 'SECURITY_MANAGER', message: '1 Security Manager condition found.' },
    ],
    estimate: { totalObjects: 9, estimatedMinutes: 12, humanReadable: '~12 min' },
    readiness: { score: 90, rating: 'ready', blockers: [], notes: [] },
    ...over,
  }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<MigrationPage />, { wrapper })
}

/** Choose the data source via the Radix Select. */
async function selectDataSource() {
  fireEvent.click(await screen.findByLabelText('Oracle data source'))
  fireEvent.click(await screen.findByText('Legacy Discoverer'))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.dataSources.list.mockResolvedValue(
    envelope([makeDataSource(), makeDataSource({ id: 'ds-pg', name: 'Neo Postgres', connectionType: 'postgres' })]) as never,
  )
})

describe('MigrationPage', () => {
  it('only offers Oracle data sources as a migration source', async () => {
    renderPage()
    fireEvent.click(await screen.findByLabelText('Oracle data source'))

    expect(await screen.findByText('Legacy Discoverer')).toBeInTheDocument()
    // The Postgres data source is not a valid EUL source.
    expect(screen.queryByText('Neo Postgres')).not.toBeInTheDocument()
  })

  it('disables the actions until a data source is chosen', async () => {
    renderPage()
    await screen.findByLabelText('Oracle data source')

    expect(screen.getByRole('button', { name: /detect version/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /analyze/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /run dry run/i })).toBeDisabled()
  })

  it('detects and prominently shows the EUL version', async () => {
    mockedApi.migration.detectVersion.mockResolvedValue(envelope(makeVersion()) as never)
    renderPage()
    await selectDataSource()

    fireEvent.click(screen.getByRole('button', { name: /detect version/i }))

    await waitFor(() => {
      expect(mockedApi.migration.detectVersion).toHaveBeenCalledWith('ds-oracle', undefined)
    })
    expect(await screen.findByText('Detected source')).toBeInTheDocument()
    expect(screen.getAllByText('EUL5').length).toBeGreaterThan(0)
    expect(screen.getByText('10.1.2/11.1.1')).toBeInTheDocument()
    expect(screen.getByText('Supported')).toBeInTheDocument()
  })

  it('shows an EUL4 source as EUL4', async () => {
    mockedApi.migration.detectVersion.mockResolvedValue(
      envelope(makeVersion({ version: 'EUL4', prefix: 'EUL4_', discovererVersion: '4.1.x', schemaVersion: '4.1.8.0.0' })) as never,
    )
    renderPage()
    await selectDataSource()
    fireEvent.click(screen.getByRole('button', { name: /detect version/i }))

    expect(await screen.findByText('4.1.x')).toBeInTheDocument()
    expect(screen.getAllByText('EUL4').length).toBeGreaterThan(0)
  })

  it('passes the schema owner when supplied', async () => {
    mockedApi.migration.detectVersion.mockResolvedValue(envelope(makeVersion()) as never)
    renderPage()
    await selectDataSource()
    fireEvent.change(screen.getByLabelText(/EUL schema owner/i), { target: { value: 'EUL5_US' } })
    fireEvent.click(screen.getByRole('button', { name: /detect version/i }))

    await waitFor(() => {
      expect(mockedApi.migration.detectVersion).toHaveBeenCalledWith('ds-oracle', 'EUL5_US')
    })
  })

  it('renders the assessment report', async () => {
    mockedApi.migration.analyze.mockResolvedValue(envelope(makeReport()) as never)
    renderPage()
    await selectDataSource()
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }))

    expect(await screen.findByText('Assessment')).toBeInTheDocument()
    expect(screen.getByText(/Readiness 90\/100/)).toBeInTheDocument()
    expect(screen.getByText('SECURITY_MANAGER')).toBeInTheDocument()
    expect(screen.getByText('Security conditions')).toBeInTheDocument()
  })

  it('defaults to a dry run and sends dryRun: true', async () => {
    mockedApi.migration.run.mockResolvedValue(envelope(makeJob()) as never)
    mockedApi.migration.getJob.mockResolvedValue(envelope(makeJob()) as never)
    renderPage()
    await selectDataSource()

    fireEvent.click(screen.getByRole('button', { name: /run dry run/i }))

    await waitFor(() => {
      expect(mockedApi.migration.run).toHaveBeenCalledWith({
        dataSourceId: 'ds-oracle',
        schemaOwner: undefined,
        version: 'auto',
        dryRun: true,
      })
    })
  })

  it('warns before a live migration and sends the version override', async () => {
    mockedApi.migration.run.mockResolvedValue(envelope(makeJob({ dryRun: false })) as never)
    mockedApi.migration.getJob.mockResolvedValue(envelope(makeJob({ dryRun: false })) as never)
    renderPage()
    await selectDataSource()

    // Turn off dry run — a warning about writing to the live database appears.
    fireEvent.click(screen.getByLabelText(/Dry run/i))
    expect(await screen.findByText(/writes into this Discoverer Neo database/i)).toBeInTheDocument()

    // Force EUL4.
    fireEvent.click(screen.getByLabelText('EUL version'))
    fireEvent.click(await screen.findByText('Force EUL4'))

    fireEvent.click(screen.getByRole('button', { name: /run migration/i }))
    await waitFor(() => {
      expect(mockedApi.migration.run).toHaveBeenCalledWith({
        dataSourceId: 'ds-oracle',
        schemaOwner: undefined,
        version: 'EUL4',
        dryRun: false,
      })
    })
  })

  it('shows progress, the detected version and the log while running', async () => {
    const running = makeJob({
      detectedVersion: 'EUL5',
      progress: 45,
      logs: [
        { level: 'INFO', phase: 'read', message: 'Source is EUL5 (Discoverer 10.1.2/11.1.1).', at: '2026-07-18T00:00:01Z' },
        { level: 'WARN', phase: 'security', message: '1 Security Manager condition(s) were NOT migrated.', at: '2026-07-18T00:00:02Z' },
      ],
    })
    mockedApi.migration.run.mockResolvedValue(envelope(running) as never)
    mockedApi.migration.getJob.mockResolvedValue(envelope(running) as never)

    renderPage()
    await selectDataSource()
    fireEvent.click(screen.getByRole('button', { name: /run dry run/i }))

    const bar = await screen.findByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText(/Source is EUL5/)).toBeInTheDocument()
    expect(screen.getByText(/Security Manager condition\(s\) were NOT migrated/)).toBeInTheDocument()
    expect(screen.getByRole('log', { name: /migration log/i })).toBeInTheDocument()
  })

  it('renders the post-migration summary with row counts and reconciliation', async () => {
    const completed = makeJob({
      status: 'COMPLETED',
      dryRun: false,
      detectedVersion: 'EUL5',
      progress: 100,
      finishedAt: '2026-07-18T00:01:00Z',
      result: {
        runId: 'run-1',
        dryRun: false,
        version: makeVersion(),
        planned: { ...zeroCounts(), business_areas: 2, items: 2 },
        inserted: { ...zeroCounts(), business_areas: 2, items: 2, folders: 2 },
        skipped: [{ table: 'items', sourceId: 302, reason: 'unmapped EXP_TYPE' }],
        warnings: [{ code: 'ITEM_SECURITY_MANAGER', message: 'Security Manager condition.' }],
        sourceValidation: { valid: true, errorCount: 0, warningCount: 0 },
        validation: { valid: true, reconciliations: [], issues: [] },
        syntheticBusinessAreas: 1,
        migrationUserEmail: 'migration@migrated.local',
        durationMs: 1500,
      },
    })
    mockedApi.migration.run.mockResolvedValue(envelope(completed) as never)
    mockedApi.migration.getJob.mockResolvedValue(envelope(completed) as never)

    renderPage()
    await selectDataSource()
    fireEvent.click(screen.getByRole('button', { name: /run dry run/i }))

    expect(await screen.findByText('Rows inserted')).toBeInTheDocument()
    expect(screen.getByText('Business areas')).toBeInTheDocument()
    expect(screen.getByText(/row counts match/i)).toBeInTheDocument()
    expect(screen.getByText(/Skipped 1 object/)).toBeInTheDocument()
    // Version-specific notes the operator must act on.
    expect(screen.getByText(/Migrated Workbooks/)).toBeInTheDocument()
    expect(screen.getByText(/cannot sign in until an admin sets a password/)).toBeInTheDocument()
  })

  it('surfaces a failed job with its error', async () => {
    const failed = makeJob({
      status: 'FAILED',
      progress: 20,
      error: 'ORA-01017: invalid username/password',
      logs: [{ level: 'ERROR', phase: 'failed', message: 'ORA-01017: invalid username/password', at: '2026-07-18T00:00:03Z' }],
    })
    mockedApi.migration.run.mockResolvedValue(envelope(failed) as never)
    mockedApi.migration.getJob.mockResolvedValue(envelope(failed) as never)

    renderPage()
    await selectDataSource()
    fireEvent.click(screen.getByRole('button', { name: /run dry run/i }))

    expect(await screen.findByText(/Dry run — FAILED/)).toBeInTheDocument()
    expect(screen.getAllByText(/ORA-01017/).length).toBeGreaterThan(0)
  })
})
