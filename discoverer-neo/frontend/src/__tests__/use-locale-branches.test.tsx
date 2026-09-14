import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useLocale } from '@/hooks/useLocale'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api'
import i18n from '@/i18n'

// theme.test.tsx and i18n.test.tsx exercise i18n resolution and the
// account-theme persistence pattern, but nothing calls useLocale() directly.
// These cover its own branches: rejecting an unsupported target locale, the
// persist option's default vs explicit-false, skipping the write-back for an
// unauthenticated viewer, and swallowing a failed preference write.

vi.mock('@/lib/api', () => ({
  apiClient: { users: { updatePreferences: vi.fn() } },
}))

const mockedApiClient = vi.mocked(apiClient, true)

function resetAuthStore(over: Partial<ReturnType<typeof useAuthStore.getState>> = {}) {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    hasHydrated: true,
    ...over,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthStore()
})

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en')
  })
})

describe('useLocale', () => {
  it('ignores a target that is not a supported locale', async () => {
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      // @ts-expect-error deliberately invalid at the boundary
      await result.current.setLocale('xx-XX')
    })

    expect(changeLanguageSpy).not.toHaveBeenCalled()
    expect(mockedApiClient.users.updatePreferences).not.toHaveBeenCalled()
  })

  it('persists by default for an authenticated user', async () => {
    resetAuthStore({ isAuthenticated: true, user: { id: '1', email: 'j@x.com', name: 'J', role: 'USER' } })
    mockedApiClient.users.updatePreferences.mockResolvedValueOnce({} as never)
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('pt-PT')
    })

    expect(mockedApiClient.users.updatePreferences).toHaveBeenCalledWith({ locale: 'pt-PT' })
    await waitFor(() => expect(result.current.locale).toBe('pt-PT'))
  })

  it('does not write back when persist is explicitly false', async () => {
    resetAuthStore({ isAuthenticated: true, user: { id: '1', email: 'j@x.com', name: 'J', role: 'USER' } })
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('fr-FR', { persist: false })
    })

    expect(mockedApiClient.users.updatePreferences).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.locale).toBe('fr-FR'))
  })

  it('changes the UI language without writing back for an unauthenticated viewer', async () => {
    resetAuthStore({ isAuthenticated: false })
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('es-ES')
    })

    expect(mockedApiClient.users.updatePreferences).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.locale).toBe('es-ES'))
  })

  it('swallows a failed preference write — the UI language change already stuck', async () => {
    resetAuthStore({ isAuthenticated: true, user: { id: '1', email: 'j@x.com', name: 'J', role: 'USER' } })
    mockedApiClient.users.updatePreferences.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useLocale())

    await expect(
      act(async () => {
        await result.current.setLocale('pt-PT')
      }),
    ).resolves.not.toThrow()

    await waitFor(() => expect(result.current.locale).toBe('pt-PT'))
  })

  it('exposes the full supported-locale list', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current.supportedLocales).toEqual(['en', 'pt-PT', 'fr-FR', 'es-ES'])
  })
})
