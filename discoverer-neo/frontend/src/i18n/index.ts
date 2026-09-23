import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

/**
 * Supported UI locales. European variants were an explicit product decision
 * (European Portuguese, European Spanish, France French), not defaults.
 */
export const SUPPORTED_LOCALES = ['en', 'pt-PT', 'fr-FR', 'es-ES'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/**
 * The language a visitor sees before any preference is known. Portuguese is
 * the product default for every account (the users table defaults to it too).
 */
export const DEFAULT_LOCALE: SupportedLocale = 'pt-PT'

/**
 * Where a key missing from the active locale is read from. English is the
 * source language every other locale is translated from, so it is the only
 * one guaranteed complete — this is not the UI default, DEFAULT_LOCALE is.
 */
export const FALLBACK_LOCALE: SupportedLocale = 'en'

/** Human-readable label for each locale, shown in the language switcher. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  'pt-PT': 'Português (Portugal)',
  'fr-FR': 'Français (France)',
  'es-ES': 'Español (España)',
}

/** localStorage key the active locale is remembered under between visits. */
export const LOCALE_STORAGE_KEY = 'discoverer-neo-locale'

function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return isSupportedLocale(stored) ? stored : null
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
    return null
  }
}

/** Every translation namespace. Keep in step with the files in `src/locales/en/`. */
export const NAMESPACES = [
  'common',
  'auth',
  'nav',
  'admin',
  'mapBuilder',
  'mapViewer',
  'runs',
  'schedules',
  'security',
  'migration',
  'audit',
  'settings',
  'errors',
] as const

/**
 * Eagerly import every locale namespace JSON. Using `import.meta.glob` means a
 * namespace file added later (e.g. a new locale's resources in Sessions 7.5–7.7)
 * is picked up automatically without editing this file. Works under both Vite
 * and Vitest, which share the same transform.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  '../locales/*/*.json',
  { eager: true },
)

type Resources = Record<string, Record<string, Record<string, unknown>>>

function buildResources(): Resources {
  const resources: Resources = {}
  for (const [path, mod] of Object.entries(modules)) {
    const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path)
    if (!match) continue
    const [, locale, namespace] = match
    resources[locale] ??= {}
    resources[locale][namespace] = mod.default
  }
  return resources
}

export const resources = buildResources()

/** True when `code` is one of our supported locales (narrowing type guard). */
export function isSupportedLocale(code: string | undefined | null): code is SupportedLocale {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code)
}

void i18n
  // Resolution order (spec §4): the authenticated user's saved locale is applied
  // explicitly on login/`/me` (see useAuth). For anonymous or pre-login visits:
  // the locale remembered in localStorage, else DEFAULT_LOCALE. The browser
  // language is deliberately not consulted — Portuguese is the product default.
  .use(initReactI18next)
  .init({
    resources,
    lng: readStoredLocale() ?? DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    fallbackLng: FALLBACK_LOCALE,
    ns: [...NAMESPACES],
    defaultNS: 'common',
    // React already escapes interpolated values, so i18next must not double-escape.
    interpolation: { escapeValue: false },
    // Resources are bundled eagerly (no async backend), so there is nothing to
    // suspend on. Disabling Suspense keeps components that render without a
    // Suspense boundary (including many unit tests) from throwing.
    react: { useSuspense: false },
    returnNull: false,
  })
  .then(() => {
    // Reflect the initially-detected language in <html lang> (the
    // languageChanged event below only fires on subsequent switches).
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', i18n.resolvedLanguage ?? FALLBACK_LOCALE)
    }
  })

// Keep the document language attribute in sync for a11y / screen readers, and
// remember the choice for the next visit.
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng)
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, lng)
  } catch {
    // Best-effort — the UI language has already changed.
  }
})

// Dev-only escape hatch for Playwright (see e2e/i18n-theming.spec.ts): lets a
// test simulate a missing translation key at runtime instead of mutating
// locale JSON files on disk. Never present in a production build.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as typeof window & { __i18n?: typeof i18n }).__i18n = i18n
}

export default i18n
