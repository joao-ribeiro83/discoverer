import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { DashboardPage } from '@/pages/DashboardPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { MapSummary } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: { listMine: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function mapSummary(over: Partial<MapSummary> = {}): MapSummary {
  return {
    id: 'm1',
    name: 'Sales by Region',
    description: null,
    mapType: 'TABLE',
    businessAreaId: 'ba1',
    createdBy: 'u1',
    isPublic: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  }
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { id: 'u1', email: 'jane@example.com', name: 'Jane', role: 'USER' },
    token: 't',
    isAuthenticated: true,
    hasHydrated: true,
  })
})

describe('DashboardPage', () => {
  it('greets the authenticated user by name', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('Welcome, Jane')).toBeInTheDocument()
  })

  it('shows recent maps (most recently updated first), clickable through to the map', async () => {
    mockedApi.maps.listMine.mockResolvedValue(
      envelope({
        mine: [
          mapSummary({ id: 'm1', name: 'Older Map', updatedAt: '2026-01-01T00:00:00.000Z' }),
          mapSummary({ id: 'm2', name: 'Newer Map', updatedAt: '2026-02-01T00:00:00.000Z' }),
        ],
        shared: [mapSummary({ id: 'm3', name: 'Shared Map' })],
      }) as never,
    )
    renderWithProviders(<DashboardPage />)

    const newerLink = await screen.findByRole('link', { name: /Newer Map/ })
    const olderLink = screen.getByRole('link', { name: /Older Map/ })
    expect(newerLink).toHaveAttribute('href', '/maps/m2')
    expect(olderLink).toHaveAttribute('href', '/maps/m1')

    // Total maps counts both owned and shared.
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2 yours, 1 shared with you')).toBeInTheDocument()
  })

  it('shows an empty state and degrades gracefully when there are no maps', async () => {
    mockedApi.maps.listMine.mockResolvedValue(envelope({ mine: [], shared: [] }) as never)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText(/No maps yet/)).toBeInTheDocument()
    expect(screen.getByText(/Scheduling isn.t available yet/)).toBeInTheDocument()
  })
})
