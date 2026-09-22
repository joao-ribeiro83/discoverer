import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { WorkbookShareDialog } from '@/components/maps/WorkbookShareDialog'
import { apiClient } from '@/lib/api'
import type { UserOption, WorkbookShares } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: {
    workbooks: {
      listShares: vi.fn(),
      share: vi.fn(),
      revokeShare: vi.fn(),
    },
    users: { search: vi.fn() },
  },
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'error'),
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function shares(over: Partial<WorkbookShares> = {}): WorkbookShares {
  return { total: 3, shares: [], ...over }
}

function user(over: Partial<UserOption> = {}): UserOption {
  return { id: 'u2', email: 'bob@example.com', name: 'Bob', ...over }
}

function renderDialog(over: Partial<React.ComponentProps<typeof WorkbookShareDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const onOpenChange = vi.fn()
  const utils = render(
    <WorkbookShareDialog
      open
      onOpenChange={onOpenChange}
      workbookId="wb-1"
      workbookName="GD_M.M27_V08"
      {...over}
    />,
    { wrapper },
  )
  return { onOpenChange, ...utils }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.workbooks.listShares.mockResolvedValue(envelope(shares()) as never)
})

describe('WorkbookShareDialog', () => {
  it('shows the title with the workbook name and the worksheet count', async () => {
    renderDialog()
    expect(await screen.findByText('Share "GD_M.M27_V08"')).toBeInTheDocument()
    expect(await screen.findByText('Give someone every worksheet in this workbook — 3 in total.')).toBeInTheDocument()
  })

  it('shows the empty state when nobody holds the workbook', async () => {
    renderDialog()
    expect(await screen.findByText('Nobody holds this workbook yet.')).toBeInTheDocument()
  })

  it('lists current holders with their sheet count and revokes on click', async () => {
    mockedApi.workbooks.listShares.mockResolvedValue(
      envelope(
        shares({
          shares: [{ userId: 'u2', email: 'bob@example.com', name: 'Bob', permissionLevel: 'EXPORT', sheets: 2 }],
        }),
      ) as never,
    )
    mockedApi.workbooks.revokeShare.mockResolvedValue(envelope({ revoked: 2 }) as never)
    renderDialog()

    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Can export · 2 of 3 worksheets')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Remove access'))
    await waitFor(() => expect(mockedApi.workbooks.revokeShare).toHaveBeenCalledWith('wb-1', 'u2'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Access removed' })))
  })

  it('disables the Share button until a user is picked from search results', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    renderDialog()

    const shareButton = await screen.findByRole('button', { name: 'Share workbook' })
    expect(shareButton).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } })
    fireEvent.click(await screen.findByText('Bob'))

    expect(shareButton).toBeEnabled()
  })

  it('shares the workbook with the picked user and permission, and shows the result toast', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockResolvedValue(envelope({ shared: 2, refused: [] }) as never)
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } })
    fireEvent.click(await screen.findByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Share workbook' }))

    await waitFor(() => expect(mockedApi.workbooks.share).toHaveBeenCalledWith('wb-1', 'u2', 'EXPORT'))
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shared 2 worksheet(s)' })),
    )
  })

  it('names any refused worksheet in the toast description', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockResolvedValue(
      envelope({ shared: 1, refused: ['Sheet Two'] }) as never,
    )
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } })
    fireEvent.click(await screen.findByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Share workbook' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Not shared: Sheet Two' }),
      ),
    )
  })

  it('shows an error toast when sharing fails', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockRejectedValue(new Error('network down'))
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } })
    fireEvent.click(await screen.findByText('Bob'))
    fireEvent.click(screen.getByRole('button', { name: 'Share workbook' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not share the workbook', description: 'network down' }),
      ),
    )
  })

  it('does not search until at least one character is typed', async () => {
    renderDialog()
    await screen.findByText('Nobody holds this workbook yet.')
    expect(mockedApi.users.search).not.toHaveBeenCalled()
  })

  it('falls back to email when a holder has no name', async () => {
    mockedApi.workbooks.listShares.mockResolvedValue(
      envelope(
        shares({ shares: [{ userId: 'u3', email: 'noname@example.com', name: null, permissionLevel: 'VIEW', sheets: 1 }] }),
      ) as never,
    )
    renderDialog()
    expect(await screen.findByText('noname@example.com')).toBeInTheDocument()
  })

  it('shows the empty state when the shares query itself fails', async () => {
    mockedApi.workbooks.listShares.mockRejectedValue(new Error('down'))
    renderDialog()
    expect(await screen.findByText('Nobody holds this workbook yet.')).toBeInTheDocument()
  })

  it('shows a spinner on the Share button while the share mutation is pending', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    let resolveShare!: (v: unknown) => void
    mockedApi.workbooks.share.mockImplementation(
      () => new Promise((res) => { resolveShare = res }) as never,
    )
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'bob' } })
    fireEvent.click(await screen.findByText('Bob'))
    const shareButton = screen.getByRole('button', { name: 'Share workbook' })
    fireEvent.click(shareButton)

    await waitFor(() => expect(shareButton.querySelector('svg.animate-spin')).toBeInTheDocument())
    resolveShare({ data: { data: { shared: 1, refused: [] } } })
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shared 1 worksheet(s)' })))
  })
})
