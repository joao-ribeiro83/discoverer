import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import {
  ThemeProvider,
  useTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/providers/ThemeProvider'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiClient: {
    users: {
      updatePreferences: vi.fn(),
    },
  },
}))

const mockedApiClient = vi.mocked(apiClient, true)

function resetAuthStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    hasHydrated: true,
  })
}

/**
 * Installs a mock `window.matchMedia` for `(prefers-color-scheme: dark)`
 * that supports the `addEventListener`/`removeEventListener` API
 * ThemeProvider relies on to live-follow OS changes, plus a `trigger` to
 * simulate the OS preference flipping.
 */
function mockMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  let matches = prefersDark

  const mql = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener)
    },
    dispatchEvent: () => true,
  }

  window.matchMedia = vi.fn().mockReturnValue(mql)

  return {
    trigger(nextMatches: boolean) {
      matches = nextMatches
      for (const listener of listeners) {
        listener({ matches: nextMatches } as MediaQueryListEvent)
      }
    },
  }
}

function Consumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => void setTheme('dark')}>dark</button>
      <button onClick={() => void setTheme('high-contrast')}>high-contrast</button>
      <button onClick={() => void setTheme('light')}>light</button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthStore()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeProvider', () => {
  it('applies data-theme on document.documentElement and updates it on switch', async () => {
    mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'))

    fireEvent.click(screen.getByText('dark'))

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')

    fireEvent.click(screen.getByText('high-contrast'))
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')
    )
  })

  it('defaults to prefers-color-scheme when there is no saved preference', async () => {
    mockMatchMedia(true)

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('follows live prefers-color-scheme changes while no explicit preference exists', async () => {
    const media = mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))

    act(() => media.trigger(true))

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
  })

  it('an explicit localStorage preference overrides prefers-color-scheme', async () => {
    mockMatchMedia(true)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('stops following OS changes once the user has explicitly chosen a theme', async () => {
    const media = mockMatchMedia(false)

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))

    fireEvent.click(screen.getByText('dark'))
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))

    // OS now reports light again — but the explicit choice should stick.
    act(() => media.trigger(false))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it("an authenticated user's saved account theme overrides prefers-color-scheme", async () => {
    mockMatchMedia(true)
    useAuthStore.setState({
      user: { id: '1', email: 'jane@example.com', name: 'Jane', role: 'USER', theme: 'light' },
      token: 'fake.jwt.token',
      isAuthenticated: true,
      hasHydrated: true,
    })

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('persists a theme change via apiClient.users.updatePreferences when authenticated', async () => {
    mockMatchMedia(false)
    useAuthStore.setState({
      user: { id: '1', email: 'jane@example.com', name: 'Jane', role: 'USER' },
      token: 'fake.jwt.token',
      isAuthenticated: true,
      hasHydrated: true,
    })
    mockedApiClient.users.updatePreferences.mockResolvedValueOnce({
      data: { data: { locale: 'en', theme: 'dark' as Theme } },
    } as never)

    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByText('dark'))

    await waitFor(() =>
      expect(mockedApiClient.users.updatePreferences).toHaveBeenCalledWith({ theme: 'dark' })
    )
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
