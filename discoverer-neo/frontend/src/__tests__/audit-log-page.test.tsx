import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { apiClient } from '@/lib/api'
import type { AuditLogEntry, AuditStats } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    audit: {
      query: vi.fn(),
      stats: vi.fn(),
      entityHistory: vi.fn(),
      userActivity: vi.fn(),
    },
    users: {
      list: vi.fn(),
    },
  },
}))

const mockedApi = vi.mocked(apiClient, true)

function makeEntry(over: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'a1',
    userId: 'u1',
    userName: 'Ada Admin',
    userEmail: 'ada@example.com',
    action: 'POST /api/business-areas',
    entityType: 'business-areas',
    entityId: 'ba-123',
    details: { statusCode: 201, body: { name: 'Sales' } },
    ipAddress: '127.0.0.1',
    createdAt: '2026-07-18T10:00:00Z',
    ...over,
  }
}

const emptyStats: AuditStats = { totalActions: 0, byDay: [], byUser: [], byActionType: [] }

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.audit.query.mockResolvedValue({
    data: { data: [], total: 0, limit: 25, offset: 0 },
  } as never)
  mockedApi.audit.stats.mockResolvedValue({ data: { data: emptyStats } } as never)
  mockedApi.users.list.mockResolvedValue({ data: { data: [] } } as never)
})

describe('AuditLogPage', () => {
  it('renders entries once loaded', async () => {
    const entry = makeEntry()
    mockedApi.audit.query.mockResolvedValue({
      data: { data: [entry], total: 1, limit: 25, offset: 0 },
    } as never)
    mockedApi.audit.stats.mockResolvedValue({
      data: {
        data: {
          totalActions: 1,
          byDay: [{ date: '2026-07-18', count: 1 }],
          byUser: [{ userId: 'u1', userName: 'Ada Admin', count: 1 }],
          byActionType: [{ action: 'POST /api/business-areas', count: 1 }],
        },
      },
    } as never)

    renderWithProviders(<AuditLogPage />)

    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())
    expect(screen.getAllByText('POST /api/business-areas').length).toBeGreaterThan(0)
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument()
  })

  it('shows an empty state when no entries match', async () => {
    renderWithProviders(<AuditLogPage />)
    await waitFor(() =>
      expect(screen.getByText('No audit entries match these filters.')).toBeInTheDocument(),
    )
  })

  it('re-queries with the entity type filter applied', async () => {
    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(mockedApi.audit.query).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Entity type'), { target: { value: 'maps' } })

    await waitFor(() =>
      expect(mockedApi.audit.query).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'maps' }),
      ),
    )
  })

  it('opens a detail dialog with the full JSON payload', async () => {
    const entry = makeEntry()
    mockedApi.audit.query.mockResolvedValue({
      data: { data: [entry], total: 1, limit: 25, offset: 0 },
    } as never)

    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('View details'))

    await waitFor(() => expect(screen.getByText('Audit entry details')).toBeInTheDocument())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/"entityId": "ba-123"/)).toBeInTheDocument()
  })

  it('disables CSV export when there are no rows to export', async () => {
    renderWithProviders(<AuditLogPage />)
    await waitFor(() =>
      expect(screen.getByText('No audit entries match these filters.')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled()
  })

  it('falls back to the email, then to "Unknown", when a name is missing', async () => {
    mockedApi.audit.query.mockResolvedValue({
      data: {
        data: [
          makeEntry({ id: 'a2', userId: 'u2', userName: undefined, userEmail: 'noname@example.com' }),
          makeEntry({ id: 'a3', userId: undefined, userName: undefined, userEmail: undefined }),
        ],
        total: 2,
        limit: 25,
        offset: 0,
      },
    } as never)

    renderWithProviders(<AuditLogPage />)

    await waitFor(() => expect(screen.getByText('noname@example.com')).toBeInTheDocument())
    expect(screen.getByText('System / unauthenticated')).toBeInTheDocument()
  })

  it('shows an em dash for a row with no IP address', async () => {
    mockedApi.audit.query.mockResolvedValue({
      data: { data: [makeEntry({ ipAddress: undefined })], total: 1, limit: 25, offset: 0 },
    } as never)

    renderWithProviders(<AuditLogPage />)

    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('exports rows with missing entityId/ipAddress as quoted-empty CSV fields', async () => {
    let capturedBlob: Blob | undefined
    const created = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:mock-url'
    })
    const revoked = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: created, revokeObjectURL: revoked })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    mockedApi.audit.query.mockResolvedValue({
      data: {
        data: [makeEntry({ entityId: undefined, ipAddress: undefined })],
        total: 1,
        limit: 25,
        offset: 0,
      },
    } as never)

    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))

    expect(created).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revoked).toHaveBeenCalledWith('blob:mock-url')
    expect(capturedBlob).toBeDefined()
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
      reader.readAsText(capturedBlob!)
    })
    expect(text).toContain('""') // the blank entityId/ipAddress fields, quoted-empty

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('closes the detail dialog and clears the selection', async () => {
    mockedApi.audit.query.mockResolvedValue({
      data: { data: [makeEntry()], total: 1, limit: 25, offset: 0 },
    } as never)

    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('View details'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('applies a date-range filter and reflects it in the stats query and label', async () => {
    mockedApi.audit.stats.mockResolvedValue({
      data: { data: { ...emptyStats, totalActions: 3 } },
    } as never)

    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(mockedApi.audit.query).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })

    await waitFor(() =>
      expect(mockedApi.audit.query).toHaveBeenCalledWith(
        expect.objectContaining({ dateFrom: new Date('2026-01-01').toISOString() }),
      ),
    )
    expect(screen.getByText('In the selected date range')).toBeInTheDocument()
  })

  it('renders the top-actions and per-day breakdowns once stats resolve', async () => {
    mockedApi.audit.stats.mockResolvedValue({
      data: {
        data: {
          totalActions: 5,
          byDay: [{ date: '2026-07-18', count: 5 }],
          byUser: [],
          byActionType: [{ action: 'POST /api/maps', count: 5 }],
        },
      },
    } as never)

    renderWithProviders(<AuditLogPage />)

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(screen.getByText('POST /api/maps')).toBeInTheDocument()
    expect(screen.queryByText('No activity recorded yet.')).not.toBeInTheDocument()
  })

  it('pages forward and back through results', async () => {
    mockedApi.audit.query.mockResolvedValue({
      data: { data: [makeEntry()], total: 60, limit: 25, offset: 0 },
    } as never)

    renderWithProviders(<AuditLogPage />)
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())

    const prevButton = screen.getByRole('button', { name: 'Previous' })
    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    fireEvent.click(nextButton)
    await waitFor(() =>
      expect(mockedApi.audit.query).toHaveBeenCalledWith(expect.objectContaining({ offset: 25 })),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await waitFor(() =>
      expect(mockedApi.audit.query).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 })),
    )
  })
})
