import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type * as ReactRouterDom from 'react-router-dom'
import { useAuth, useRequireAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth'
import { apiClient, refreshSession } from '@/lib/api'
import { getTokenExpiryMs } from '@/lib/jwt'
import i18n from '@/i18n'

// Covers the branches auth.test.tsx's happy-path suite doesn't reach: the
// locale-on-login conditional, logout's best-effort catch, the proactive
// refresh effect's early-return guards and its failure path, and both arms
// of useRequireAuth's redirect.

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDom>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/lib/api', () => ({
  apiClient: { auth: { login: vi.fn(), logout: vi.fn() } },
  refreshSession: vi.fn(),
}))

vi.mock('@/lib/jwt', () => ({ getTokenExpiryMs: vi.fn() }))

const mockedApiClient = vi.mocked(apiClient, true)
const mockedGetTokenExpiryMs = vi.mocked(getTokenExpiryMs)

const testUser = { id: '1', email: 'jane@example.com', name: 'Jane', role: 'ADMIN' }

function resetAuthStore(over: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    hasHydrated: true,
    ...over,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthStore()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAuth login locale handling', () => {
  it('applies the login response locale when it is supported', async () => {
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(i18n.t)
    mockedApiClient.auth.login.mockResolvedValueOnce({
      data: { data: { token: 't', refreshToken: 'r', user: { ...testUser, locale: 'pt-PT' } } },
    } as never)

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login('jane@example.com', 'pw')
    })

    expect(changeLanguageSpy).toHaveBeenCalledWith('pt-PT')
    changeLanguageSpy.mockRestore()
  })

  it('does not touch the UI language when the response locale is unsupported', async () => {
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(i18n.t)
    mockedApiClient.auth.login.mockResolvedValueOnce({
      data: { data: { token: 't', refreshToken: 'r', user: { ...testUser, locale: 'xx-XX' } } },
    } as never)

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login('jane@example.com', 'pw')
    })

    expect(changeLanguageSpy).not.toHaveBeenCalled()
    changeLanguageSpy.mockRestore()
  })
})

describe('useAuth logout', () => {
  it('clears local state even when the server logout call fails', async () => {
    resetAuthStore({ user: testUser, token: 't', isAuthenticated: true })
    mockedApiClient.auth.logout.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.logout()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('useAuth proactive refresh effect', () => {
  it('does nothing while unauthenticated', () => {
    resetAuthStore({ isAuthenticated: false })
    renderHook(() => useAuth())
    expect(refreshSession).not.toHaveBeenCalled()
    expect(mockedGetTokenExpiryMs).not.toHaveBeenCalled()
  })

  it('skips the expiry check when authenticated but the token is momentarily absent', async () => {
    resetAuthStore({ isAuthenticated: true, token: null })
    renderHook(() => useAuth())
    await waitFor(() => {
      // The effect's checkAndRefresh runs once on mount; give it a tick.
    })
    expect(mockedGetTokenExpiryMs).not.toHaveBeenCalled()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('does not refresh when the token has no parseable expiry', async () => {
    resetAuthStore({ isAuthenticated: true, token: 'opaque-token' })
    mockedGetTokenExpiryMs.mockReturnValue(null)
    renderHook(() => useAuth())
    await waitFor(() => expect(mockedGetTokenExpiryMs).toHaveBeenCalled())
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('does not refresh while the token is still comfortably valid', async () => {
    resetAuthStore({ isAuthenticated: true, token: 'valid-token' })
    mockedGetTokenExpiryMs.mockReturnValue(Date.now() + 10 * 60 * 1000)
    renderHook(() => useAuth())
    await waitFor(() => expect(mockedGetTokenExpiryMs).toHaveBeenCalled())
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('refreshes quietly when the token is close to expiry', async () => {
    resetAuthStore({ isAuthenticated: true, token: 'near-expiry-token' })
    mockedGetTokenExpiryMs.mockReturnValue(Date.now() + 60 * 1000)
    vi.mocked(refreshSession).mockResolvedValueOnce('new.token')

    renderHook(() => useAuth())

    await waitFor(() => expect(refreshSession).toHaveBeenCalledTimes(1))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('logs out and redirects to /login when the near-expiry refresh fails', async () => {
    resetAuthStore({ isAuthenticated: true, token: 'near-expiry-token', user: testUser })
    mockedGetTokenExpiryMs.mockReturnValue(Date.now() + 60 * 1000)
    vi.mocked(refreshSession).mockRejectedValueOnce(new Error('refresh token spent'))

    renderHook(() => useAuth())

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', expect.objectContaining({ replace: true })))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('useRequireAuth', () => {
  it('redirects to /login once hydration finishes for an unauthenticated user', async () => {
    resetAuthStore({ isAuthenticated: false, hasHydrated: true })
    const { result } = renderHook(() => useRequireAuth())

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }))
    expect(result.current.isLoading).toBe(false)
  })

  it('waits without redirecting until the store has hydrated', () => {
    resetAuthStore({ isAuthenticated: false, hasHydrated: false })
    const { result } = renderHook(() => useRequireAuth())

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)
  })

  it('does not redirect an authenticated, hydrated user', () => {
    resetAuthStore({ isAuthenticated: true, hasHydrated: true })
    const { result } = renderHook(() => useRequireAuth())

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })
})
