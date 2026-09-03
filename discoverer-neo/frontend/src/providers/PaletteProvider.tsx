import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

/** Matches the backend's `colorPaletteEnum` (backend/src/db/schema.ts) exactly. */
export const SUPPORTED_PALETTES = ['default', 'navy'] as const
export type ColorPalette = (typeof SUPPORTED_PALETTES)[number]

/**
 * Independent of `theme` (light/dark/high-contrast, see ThemeProvider) — this
 * only recolors primary/accent/chart/sidebar tokens via [data-palette] CSS
 * (frontend/src/styles/palettes/navy.css). 'navy' is the default: unlike
 * light/dark there's no OS signal to defer to, so a fresh visitor gets the
 * Allianz Trade-inspired look rather than the plain shadcn grayscale.
 */
const DEFAULT_PALETTE: ColorPalette = 'navy'

/** localStorage key, following THEME_STORAGE_KEY's convention. */
export const PALETTE_STORAGE_KEY = 'discoverer-neo-palette'

export function isSupportedPalette(value: string | undefined | null): value is ColorPalette {
  return !!value && (SUPPORTED_PALETTES as readonly string[]).includes(value)
}

function readStoredPalette(): ColorPalette | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    return isSupportedPalette(stored) ? stored : null
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
    return null
  }
}

function resolveInitialPalette(): ColorPalette {
  return readStoredPalette() ?? DEFAULT_PALETTE
}

function applyPaletteAttribute(palette: ColorPalette) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-palette', palette)
}

interface PaletteContextValue {
  palette: ColorPalette
  setPalette: (palette: ColorPalette, options?: { persist?: boolean }) => Promise<void>
}

const PaletteContext = createContext<PaletteContextValue | null>(null)

export function PaletteProvider({ children }: { children: ReactNode }) {
  // Lazy initializer runs synchronously during the first render (before
  // paint); `data-palette` is applied via useLayoutEffect below for the same
  // FOUC-avoidance reason ThemeProvider uses.
  const [palette, setPaletteState] = useState<ColorPalette>(() => resolveInitialPalette())

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useLayoutEffect(() => {
    applyPaletteAttribute(palette)
  }, [palette])

  // Once the authenticated user's saved palette is known, it wins over
  // whatever we guessed at boot (localStorage / default) — mirrors
  // ThemeProvider's account-preference precedence.
  useEffect(() => {
    if (!isAuthenticated) return
    if (isSupportedPalette(user?.colorPalette)) {
      setPaletteState(user.colorPalette)
    }
  }, [isAuthenticated, user?.colorPalette])

  const setPalette = useCallback(async (next: ColorPalette, options?: { persist?: boolean }) => {
    if (!isSupportedPalette(next)) return

    setPaletteState(next)
    applyPaletteAttribute(next)

    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next)
    } catch {
      // Best-effort — the UI palette has already changed locally.
    }

    const shouldPersist = options?.persist ?? true
    if (shouldPersist && useAuthStore.getState().isAuthenticated) {
      try {
        await apiClient.users.updatePreferences({ colorPalette: next })
      } catch {
        // Best-effort — the UI palette has already changed locally; a failed
        // write just means it won't follow the user to another device.
      }
    }
  }, [])

  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>{children}</PaletteContext.Provider>
  )
}

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext)
  if (!context) {
    throw new Error('usePalette must be used within a PaletteProvider')
  }
  return context
}

// Re-exported for callers that want the fallback without mounting the
// provider — kept in step with DEFAULT_PALETTE.
export { DEFAULT_PALETTE }
