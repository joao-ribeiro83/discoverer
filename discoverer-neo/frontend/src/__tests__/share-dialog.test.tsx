import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ShareDialog } from '@/components/map-builder/ShareDialog'
import { apiClient } from '@/lib/api'
import type { MapShare, UserOption } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    maps: {
      listShares: vi.fn(),
      share: vi.fn(),
      updateShare: vi.fn(),
      revokeShare: vi.fn(),
    },
    users: {
      search: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function makeShare(over: Partial<MapShare> = {}): MapShare {
  return {
    id: 's1',
    mapId: 'map1',
    sharedWithUserId: 'u1',
    sharedWithEmail: 'existing@example.com',
    sharedWithName: 'Existing User',
    permissionLevel: 'VIEW',
    sharedBy: 'owner1',
    sharedAt: '2026-07-18T00:00:00Z',
    ...over,
  }
}

function makeUser(over: Partial<UserOption> = {}): UserOption {
  return { id: 'u2', name: 'Findable Fiona', email: 'fiona@example.com', ...over }
}

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))

const writeTextMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.maps.listShares.mockResolvedValue(envelope([]) as never)
  mockedApi.users.search.mockResolvedValue(envelope([]) as never)
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } })
})

describe('ShareDialog', () => {
  const fiona = () => makeUser({ id: 'u2' })
  const existing = () => makeUser({ id: 'u1', name: 'Existing User', email: 'existing@example.com' })

  function rowOf(name: string) {
    return within(screen.getByText(name).closest('li') as HTMLElement)
  }

  it('lists every user, with holders first and their level pressed', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.users.search.mockResolvedValue(envelope([fiona(), existing()]) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)

    await screen.findByText('Existing User')
    expect(mockedApi.users.search).toHaveBeenCalledWith('')
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)
    expect(names).toEqual(['Existing User', 'Findable Fiona'])
    expect(rowOf('Existing User').getByRole('button', { name: 'Can view' })).toHaveAttribute('aria-pressed', 'true')
    expect(rowOf('Findable Fiona').getByRole('button', { name: 'Can view' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the list locally', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([fiona(), existing()]) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Findable Fiona')

    fireEvent.change(screen.getByLabelText('Search users to share with'), { target: { value: 'fiona' } })
    expect(screen.queryByText('Existing User')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search users to share with'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matching users')).toBeInTheDocument()
  })

  it('shares with a new user when a level is clicked', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([fiona()]) as never)
    mockedApi.maps.share.mockResolvedValue(envelope(makeShare({ sharedWithUserId: 'u2' })) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Findable Fiona')

    fireEvent.click(rowOf('Findable Fiona').getByRole('button', { name: 'Can export' }))

    await waitFor(() =>
      expect(mockedApi.maps.share).toHaveBeenCalledWith('map1', { userId: 'u2', permissionLevel: 'EXPORT' }),
    )
    expect(mockedApi.maps.updateShare).not.toHaveBeenCalled()
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Map shared' })))
  })

  it('updates the level of a user who already holds a share', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.users.search.mockResolvedValue(envelope([existing()]) as never)
    mockedApi.maps.updateShare.mockResolvedValue(envelope(makeShare({ permissionLevel: 'EDIT' })) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Existing User')
    await waitFor(() =>
      expect(rowOf('Existing User').getByRole('button', { name: 'Can view' })).toHaveAttribute('aria-pressed', 'true'),
    )

    fireEvent.click(rowOf('Existing User').getByRole('button', { name: 'Can edit' }))

    await waitFor(() => expect(mockedApi.maps.updateShare).toHaveBeenCalledWith('map1', 'u1', 'EDIT'))
    expect(mockedApi.maps.share).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Permission updated' })),
    )
  })

  it('does nothing when the held level is clicked again', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.users.search.mockResolvedValue(envelope([existing()]) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Existing User')
    await waitFor(() =>
      expect(rowOf('Existing User').getByRole('button', { name: 'Can view' })).toHaveAttribute('aria-pressed', 'true'),
    )
    fireEvent.click(rowOf('Existing User').getByRole('button', { name: 'Can view' }))
    expect(mockedApi.maps.updateShare).not.toHaveBeenCalled()
    expect(mockedApi.maps.share).not.toHaveBeenCalled()
  })

  it('revokes a share, and only enables the remove button for holders', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.users.search.mockResolvedValue(envelope([existing(), fiona()]) as never)
    mockedApi.maps.revokeShare.mockResolvedValue(envelope({ revoked: true }) as never)
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Existing User')

    expect(screen.getByLabelText('Revoke access for Findable Fiona')).toBeDisabled()
    await waitFor(() => expect(screen.getByLabelText('Revoke access for Existing User')).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Revoke access for Existing User'))

    await waitFor(() => expect(mockedApi.maps.revokeShare).toHaveBeenCalledWith('map1', 'u1'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Access revoked' })))
  })

  it('shows an error toast when sharing fails', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([fiona()]) as never)
    mockedApi.maps.share.mockRejectedValue(new Error('network down'))
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('Findable Fiona')

    fireEvent.click(rowOf('Findable Fiona').getByRole('button', { name: 'Can view' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not share map', description: 'network down', variant: 'destructive' }),
      ),
    )
  })

  it('hides the copy-link action for a non-public map', async () => {
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />)
    await screen.findByText('No matching users')
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument()
  })

  it('copies the view link for a public map', async () => {
    renderWithProviders(<ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic />)
    fireEvent.click(await screen.findByRole('button', { name: /Copy link/ }))
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/maps/map1/view'))
  })
})
