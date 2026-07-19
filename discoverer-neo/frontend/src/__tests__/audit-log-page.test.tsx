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
})
