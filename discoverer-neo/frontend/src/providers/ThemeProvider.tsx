import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

/** Matches the backend's `themeEnum` (backend/src/db/schema.ts) exactly. */
export const SUPPORTED_THEMES = ['light', 'dark', 'high-contrast'] as const
export type Theme = (typeof SUPPORTED_THEMES)[number]

const DEFAULT_THEME: Theme = 'light'

/** localStorage key, following useLocale's `discoverer-neo-locale` convention. */
export const THEME_STORAGE_KEY = 'discoverer-neo-theme'

export function isSupportedTheme(value: string | undefined | null): value is Theme {
  return !!value && (SUPPORTED_THEMES as readonly string[]).includes(value)
}

function readStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isSupportedTheme(stored) ? stored : null
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
    return null
  }
}

function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Resolves the theme to use before we know anything about the authenticated
 * user: an explicit localStorage choice wins, otherwise fall back to the OS
 * `prefers-color-scheme` (never high-contrast — that's opt-in only).
 */
function resolveInitialTheme(): Theme {
  const stored = readStoredTheme()
  if (stored) return stored
  return prefersDarkColorScheme() ? 'dark' : 'light'
}

function applyThemeAttribute(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme, options?: { persist?: boolean }) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer runs synchronously during the first render (before
  // paint), so `data-theme` is set via useLayoutEffect below rather than
  // useEffect — see the FOUC note further down.
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme())

  // True once we have an explicit preference (saved account theme or a
  // localStorage value written by a previous setTheme call). While false,
  // the theme continues to track OS `prefers-color-scheme` changes live.
  const hasExplicitPreferenceRef = useRef(readStoredTheme() !== null)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // FOUC prevention: this repo's Vite SPA otherwise tolerates a brief flash
  // on first paint (i18n's language detection resolves asynchronously the
  // same way), so — to keep this pass simple and consistent with that
  // existing tradeoff — theme uses a useLayoutEffect (applied before the
  // browser paints the committed DOM, so no visible flash in practice for a
  // client-rendered SPA) instead of an inline <script> in index.html. The
  // inline-script approach is more robust (it would also cover the case of
  // a slow-to-hydrate React bundle on a throttled connection) and is the
  // documented fallback if FOUC turns out to be visible in practice.
  useLayoutEffect(() => {
    applyThemeAttribute(theme)
  }, [theme])

  // Once the authenticated user's saved theme is known, it wins over
  // whatever we guessed at boot (localStorage / OS preference) — mirrors
  // useLocale's precedence: the account preference is the source of truth.
  useEffect(() => {
    if (!isAuthenticated) return
    if (isSupportedTheme(user?.theme)) {
      hasExplicitPreferenceRef.current = true
      setThemeState(user.theme)
    }
  }, [isAuthenticated, user?.theme])

  // Live-follow OS `prefers-color-scheme` changes, but only while nothing
  // explicit has been chosen yet (spec: explicit preference always wins).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (event: MediaQueryListEvent) => {
      if (hasExplicitPreferenceRef.current) return
      setThemeState(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback(async (next: Theme, options?: { persist?: boolean }) => {
    if (!isSupportedTheme(next)) return

    hasExplicitPreferenceRef.current = true
    setThemeState(next)
    applyThemeAttribute(next)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Best-effort — the UI theme has already changed locally.
    }

    const shouldPersist = options?.persist ?? true
    if (shouldPersist && useAuthStore.getState().isAuthenticated) {
      try {
        await apiClient.users.updatePreferences({ theme: next })
      } catch {
        // Best-effort — the UI theme has already changed locally; a failed
        // write just means it won't follow the user to another device.
      }
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Re-exported for callers that want the fallback without mounting the
// provider (e.g. very early bootstrap code) — kept in step with DEFAULT_THEME.
export { DEFAULT_THEME }
