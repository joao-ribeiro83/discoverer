import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

const writeTextMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.maps.listShares.mockResolvedValue(envelope([]) as never)
  mockedApi.users.search.mockResolvedValue(envelope([]) as never)
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } })
})

describe('ShareDialog', () => {
  it('lists existing shares', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    expect(await screen.findByText('Existing User')).toBeInTheDocument()
    expect(screen.getByText('existing@example.com')).toBeInTheDocument()
  })

  it('shows an empty state when nobody has access', async () => {
    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    expect(await screen.findByText('Not shared with anyone yet.')).toBeInTheDocument()
  })

  it('searches users, excludes existing collaborators, and shares with the selected user', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare({ sharedWithUserId: 'u1' })]) as never)
    mockedApi.users.search.mockResolvedValue(
      envelope([makeUser({ id: 'u1', name: 'Existing User' }), makeUser({ id: 'u2' })]) as never,
    )
    mockedApi.maps.share.mockResolvedValue(envelope(makeShare({ id: 's2', sharedWithUserId: 'u2' })) as never)

    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    await screen.findByText('Existing User')

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), {
      target: { value: 'fiona' },
    })

    await waitFor(() => expect(mockedApi.users.search).toHaveBeenCalledWith('fiona'))

    // The already-shared user (u1) must not appear in results, only u2.
    const result = await screen.findByText('Findable Fiona')
    fireEvent.click(result)

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))

    await waitFor(() =>
      expect(mockedApi.maps.share).toHaveBeenCalledWith('map1', {
        userId: 'u2',
        permissionLevel: 'VIEW',
      }),
    )
  })

  it('updates a share permission level', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.maps.updateShare.mockResolvedValue(envelope(makeShare({ permissionLevel: 'EDIT' })) as never)

    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    await screen.findByText('Existing User')

    fireEvent.click(screen.getByLabelText('Permission for Existing User'))
    fireEvent.click(await screen.findByText('Can edit'))

    await waitFor(() =>
      expect(mockedApi.maps.updateShare).toHaveBeenCalledWith('map1', 'u1', 'EDIT'),
    )
  })

  it('revokes a share', async () => {
    mockedApi.maps.listShares.mockResolvedValue(envelope([makeShare()]) as never)
    mockedApi.maps.revokeShare.mockResolvedValue(envelope({ revoked: true }) as never)

    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    await screen.findByText('Existing User')

    fireEvent.click(screen.getByLabelText('Revoke access for Existing User'))

    await waitFor(() => expect(mockedApi.maps.revokeShare).toHaveBeenCalledWith('map1', 'u1'))
  })

  it('hides the copy-link action for a non-public map', async () => {
    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic={false} />,
    )
    await screen.findByText('Not shared with anyone yet.')
    expect(screen.queryByText('Copy link')).not.toBeInTheDocument()
  })

  it('copies the view link for a public map', async () => {
    renderWithProviders(
      <ShareDialog open onOpenChange={() => {}} mapId="map1" isPublic />,
    )
    const copyButton = await screen.findByText('Copy link')
    fireEvent.click(copyButton)
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/maps/map1/view'))
  })
})
