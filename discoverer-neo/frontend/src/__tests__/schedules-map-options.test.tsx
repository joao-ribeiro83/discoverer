import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SchedulesPage } from '@/pages/SchedulesPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

vi.mock('@/lib/api', () => ({
  apiClient: {
    schedules: { listMine: vi.fn() },
    maps: { listMine: vi.fn(), get: vi.fn() },
  },
  getErrorMessage: (e: unknown) => String(e),
}))

const mockedApi = vi.mocked(apiClient, true)

function map(id: string, name: string, sharePermission?: string) {
  return { id, name, description: null, mapType: 'TABLE', businessAreaId: 'ba', createdBy: 'other', isPublic: false, isActive: true, createdAt: '', updatedAt: '', sharePermission }
}

async function mapOptions(role: string) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'x@example.com', name: 'X', role },
    token: 't',
    isAuthenticated: true,
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SchedulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'New Schedule' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getAllByRole('combobox')[0])
  await screen.findByRole('option', { name: 'Mine' })
  return screen.getAllByRole('option').map((o) => o.textContent ?? '')
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.schedules.listMine.mockResolvedValue({ data: { data: [] } } as never)
  mockedApi.maps.listMine.mockResolvedValue({
    data: {
      data: {
        mine: [map('m1', 'Mine')],
        shared: [map('m2', 'Viewed', 'VIEW'), map('m3', 'Exported', 'EXPORT'), map('m4', 'Edited', 'EDIT')],
      },
    },
  } as never)
})

describe('Schedules map dropdown', () => {
  // SHARE_ALLOWS.VIEW has no SCHEDULE: offering a VIEW share only ends in a 403.
  it('leaves out maps a USER can only view', async () => {
    const options = await mapOptions('USER')
    expect(options.some((o) => o.includes('Viewed'))).toBe(false)
    expect(options.some((o) => o.includes('Exported'))).toBe(true)
    expect(options.some((o) => o.includes('Edited'))).toBe(true)
  })

  it('keeps every shared map for a MANAGER, who may schedule any map', async () => {
    const options = await mapOptions('MANAGER')
    expect(options.some((o) => o.includes('Viewed'))).toBe(true)
  })
})
