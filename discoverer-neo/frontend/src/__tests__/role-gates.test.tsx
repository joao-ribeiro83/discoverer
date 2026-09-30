import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SidebarNav } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { RequireRole } from '@/components/auth/ProtectedRoute'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

vi.mock('@/lib/api', () => ({
  apiClient: { auth: { logout: vi.fn() } },
  refreshSession: vi.fn(),
}))

const mockedApi = vi.mocked(apiClient, true)

function signInAs(role: string) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'x@example.com', name: 'X', role },
    token: 't',
    refreshToken: 'r',
    isAuthenticated: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sidebar role gates', () => {
  // Security, Audit Log and Migration APIs are authorize('ADMIN') only, and a
  // MANAGER may not change the data model.
  it.each([
    ['ADMIN', true],
    ['MANAGER', false],
  ])('%s sees the admin-only links: %s', (role, visible) => {
    signInAs(role)
    render(
      <MemoryRouter>
        <SidebarNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
    for (const name of [
      'Business Areas', 'Folders', 'Items', 'Joins', 'Hierarchies',
      'Custom Functions', 'Data Sources',
      'Security', 'Audit Log', 'Migration',
    ]) {
      expect(!!screen.queryByRole('link', { name })).toBe(visible)
    }
  })
})

describe('RequireRole', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dashboard" element={<p>dashboard</p>} />
          <Route path="/admin" element={<RequireRole roles={['ADMIN', 'MANAGER']} />}>
            <Route path="users" element={<p>users page</p>} />
            <Route element={<RequireRole roles={['ADMIN']} />}>
              <Route path="security" element={<p>security page</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  it('lets a MANAGER open a modelling page', () => {
    signInAs('MANAGER')
    renderAt('/admin/users')
    expect(screen.getByText('users page')).toBeInTheDocument()
  })

  it('sends a MANAGER away from an admin-only page', () => {
    signInAs('MANAGER')
    renderAt('/admin/security')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('sends a USER away from every admin page', () => {
    signInAs('USER')
    renderAt('/admin/users')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})

describe('Header log out', () => {
  async function clickLogOut() {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )
    // Radix opens the menu on pointerdown or Enter, not click; jsdom has no PointerEvent.
    fireEvent.keyDown(screen.getByRole('button', { name: 'X' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }))
  }

  it('revokes the session on the server, then clears local state', async () => {
    signInAs('USER')
    mockedApi.auth.logout.mockResolvedValueOnce({} as never)
    await clickLogOut()
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
    expect(mockedApi.auth.logout).toHaveBeenCalledTimes(1)
  })

  it('still clears local state when the server call fails', async () => {
    signInAs('USER')
    mockedApi.auth.logout.mockRejectedValueOnce(new Error('network'))
    await clickLogOut()
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
  })
})
