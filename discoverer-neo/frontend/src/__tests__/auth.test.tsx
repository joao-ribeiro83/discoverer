import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth'
import { apiClient, refreshSession } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiClient: {
    auth: {
      login: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
    },
  },
  refreshSession: vi.fn(),
}))

const mockedApiClient = vi.mocked(apiClient, true)

const testUser = { id: '1', email: 'jane@example.com', name: 'Jane', role: 'ADMIN' }

function resetAuthStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    hasHydrated: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthStore()
})

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('redirects to the dashboard after a successful login', async () => {
    mockedApiClient.auth.login.mockResolvedValueOnce({
      data: { data: { token: 'fake.jwt.token', user: testUser } },
    } as never)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: testUser.email } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText('Dashboard Page')).toBeInTheDocument())
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe('fake.jwt.token')
  })

  it('shows an error message on invalid credentials', async () => {
    mockedApiClient.auth.login.mockRejectedValueOnce({
      response: { data: { error: 'Invalid email or password' } },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: testUser.email } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
    )
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('ProtectedRoute', () => {
  it('redirects an unauthenticated user to /login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Secret Dashboard')).not.toBeInTheDocument()
  })

  it('renders children for an authenticated user', () => {
    useAuthStore.setState({
      user: testUser,
      token: 'fake.jwt.token',
      isAuthenticated: true,
      hasHydrated: true,
    })

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Secret Dashboard')).toBeInTheDocument()
  })
})

describe('useAuth token refresh', () => {
  it('delegates to the shared refreshSession', async () => {
    vi.mocked(refreshSession).mockResolvedValueOnce('new.jwt.token')

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })

    let token: string | undefined
    await act(async () => {
      token = await result.current.refresh()
    })

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(token).toBe('new.jwt.token')
  })

  it('stores the refresh token from login', async () => {
    mockedApiClient.auth.login.mockResolvedValueOnce({
      data: { data: { token: 'a.jwt.token', refreshToken: 'sid.secret', user: testUser } },
    } as never)

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    })
    await act(async () => {
      await result.current.login('jane@example.com', 'pw')
    })

    expect(useAuthStore.getState().refreshToken).toBe('sid.secret')
  })
})
