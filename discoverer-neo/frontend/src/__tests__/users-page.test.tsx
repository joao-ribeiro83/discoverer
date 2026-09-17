import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from '@/pages/UsersPage'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { AppUser } from '@/lib/types'

vi.mock('@/lib/api', () => ({
  apiClient: { users: { list: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() } },
  getErrorMessage: (e: unknown) => String(e),
}))

const mockedApi = vi.mocked(apiClient, true)

const admin: AppUser = { id: 'u-admin', email: 'ada@example.com', name: 'Ada Admin', role: 'ADMIN', isActive: true, createdAt: '' }
const bob: AppUser = { id: 'u-bob', email: 'bob@example.com', name: 'Bob User', role: 'USER', isActive: true, createdAt: '' }
const carol: AppUser = { id: 'u-carol', email: 'carol@example.com', name: 'Carol Gone', role: 'USER', isActive: false, createdAt: '' }

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

function rowOf(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'ADMIN' },
    token: 'fake.jwt.token',
    isAuthenticated: true,
  })
  mockedApi.users.list.mockResolvedValue({ data: { data: [admin, bob, carol] } } as never)
  mockedApi.users.update.mockResolvedValue({ data: { data: bob } } as never)
})

describe('UsersPage active toggle', () => {
  it('shows each user status', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())
    expect(within(rowOf('Bob User')).getByText('Active')).toBeInTheDocument()
    expect(within(rowOf('Carol Gone')).getByText('Inactive')).toBeInTheDocument()
  })

  it('asks for confirmation before deactivating, then sends isActive: false', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(within(rowOf('Bob User')).getByRole('button', { name: 'Deactivate' }))
    expect(mockedApi.users.update).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Bob User is signed out/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(mockedApi.users.update).toHaveBeenCalledWith('u-bob', { isActive: false }))
  })

  it('cancelling the confirmation does not deactivate', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(within(rowOf('Bob User')).getByRole('button', { name: 'Deactivate' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockedApi.users.update).not.toHaveBeenCalled()
  })

  it('activates an inactive user without confirmation', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Carol Gone')).toBeInTheDocument())

    fireEvent.click(within(rowOf('Carol Gone')).getByRole('button', { name: 'Activate' }))

    await waitFor(() => expect(mockedApi.users.update).toHaveBeenCalledWith('u-carol', { isActive: true }))
  })

  it('does not let an admin deactivate their own account', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Ada Admin')).toBeInTheDocument())

    const own = within(rowOf('Ada Admin')).getByRole('button', { name: 'Deactivate' })
    expect(own).toBeDisabled()
    fireEvent.click(own)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('UsersPage create/edit dialog', () => {
  it('creates a user from the New User form', async () => {
    mockedApi.users.create = vi.fn().mockResolvedValue({ data: { data: bob } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'New User' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Dana New' } })
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'dana@example.com' } })
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'longenough' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedApi.users.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dana New', email: 'dana@example.com', password: 'longenough' }),
      ),
    )
  })

  it('shows a validation error instead of submitting an empty name', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'New User' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'dana@example.com' } })
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'longenough' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument()
    expect(mockedApi.users.update).not.toHaveBeenCalled()
  })

  it('edits an existing user without changing the password when left blank', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(within(rowOf('Bob User')).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('bob@example.com')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedApi.users.update).toHaveBeenCalledWith(
        'u-bob',
        expect.objectContaining({ name: 'Bob User', email: 'bob@example.com' }),
      ),
    )
    expect(mockedApi.users.update.mock.calls[0][1]).not.toHaveProperty('password')
  })

  it('cancelling the create dialog does not submit', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Bob User')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'New User' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockedApi.users.create).not.toHaveBeenCalled()
  })
})
