import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
  mockedApi.users.search.mockResolvedValue(envelope([]) as never)
})

function heldShare(over: Record<string, unknown> = {}) {
  return { userId: 'u2', email: 'bob@example.com', name: 'Bob', permissionLevel: 'EXPORT', sheets: 2, ...over }
}

function rowOf(name: string) {
  return within(screen.getByText(name).closest('li') as HTMLElement)
}

describe('WorkbookShareDialog', () => {
  it('shows the title with the workbook name and the worksheet count', async () => {
    renderDialog()
    expect(await screen.findByText('Share "GD_M.M27_V08"')).toBeInTheDocument()
    expect(await screen.findByText('Give someone every worksheet in this workbook — 3 in total.')).toBeInTheDocument()
  })

  it('lists every user and asks for all of them', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user(), user({ id: 'u3', name: 'Carol', email: 'c@example.com' })]) as never)
    renderDialog()
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
    expect(mockedApi.users.search).toHaveBeenCalledWith('')
  })

  it('shows how many worksheets a holder has, and revokes on the remove button', async () => {
    mockedApi.workbooks.listShares.mockResolvedValue(envelope(shares({ shares: [heldShare()] })) as never)
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.revokeShare.mockResolvedValue(envelope({ revoked: 2 }) as never)
    renderDialog()

    expect(await screen.findByText(/2 of 3 worksheets/)).toBeInTheDocument()
    expect(rowOf('Bob').getByRole('button', { name: 'Can export' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByLabelText('Revoke access for Bob'))
    await waitFor(() => expect(mockedApi.workbooks.revokeShare).toHaveBeenCalledWith('wb-1', 'u2'))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Access removed' })))
  })

  it('shares the workbook at the clicked level and shows the result toast', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockResolvedValue(envelope({ shared: 2, refused: [] }) as never)
    renderDialog()

    await screen.findByText('Bob')
    fireEvent.click(rowOf('Bob').getByRole('button', { name: 'Can export' }))

    await waitFor(() => expect(mockedApi.workbooks.share).toHaveBeenCalledWith('wb-1', 'u2', 'EXPORT'))
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shared 2 worksheet(s)' })),
    )
  })

  it('changes the level for someone who already holds it', async () => {
    mockedApi.workbooks.listShares.mockResolvedValue(envelope(shares({ shares: [heldShare()] })) as never)
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockResolvedValue(envelope({ shared: 3, refused: [] }) as never)
    renderDialog()

    await screen.findByText(/2 of 3 worksheets/)
    fireEvent.click(rowOf('Bob').getByRole('button', { name: 'Can edit' }))
    await waitFor(() => expect(mockedApi.workbooks.share).toHaveBeenCalledWith('wb-1', 'u2', 'EDIT'))
  })

  it('names any refused worksheet in the toast description', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockResolvedValue(envelope({ shared: 1, refused: ['Sheet Two'] }) as never)
    renderDialog()

    await screen.findByText('Bob')
    fireEvent.click(rowOf('Bob').getByRole('button', { name: 'Can view' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: 'Not shared: Sheet Two' })),
    )
  })

  it('shows an error toast when sharing fails', async () => {
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    mockedApi.workbooks.share.mockRejectedValue(new Error('network down'))
    renderDialog()

    await screen.findByText('Bob')
    fireEvent.click(rowOf('Bob').getByRole('button', { name: 'Can view' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not share the workbook', description: 'network down' }),
      ),
    )
  })

  it('lists holders first', async () => {
    mockedApi.workbooks.listShares.mockResolvedValue(
      envelope(shares({ shares: [heldShare({ userId: 'u3', name: 'Zed', email: 'z@example.com' })] })) as never,
    )
    mockedApi.users.search.mockResolvedValue(
      envelope([user(), user({ id: 'u3', name: 'Zed', email: 'z@example.com' })]) as never,
    )
    renderDialog()
    await screen.findByText(/2 of 3 worksheets/)
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent)
    expect(names).toEqual(['Zed', 'Bob'])
  })

  it('still lists users when the shares query itself fails', async () => {
    mockedApi.workbooks.listShares.mockRejectedValue(new Error('down'))
    mockedApi.users.search.mockResolvedValue(envelope([user()]) as never)
    renderDialog()
    expect(await screen.findByText('Bob')).toBeInTheDocument()
    expect(screen.getByLabelText('Revoke access for Bob')).toBeDisabled()
  })
})
