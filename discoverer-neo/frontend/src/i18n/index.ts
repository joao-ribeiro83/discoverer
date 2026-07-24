import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

/**
 * Supported UI locales. European variants were an explicit product decision
 * (European Portuguese, European Spanish, France French), not defaults.
 */
export const SUPPORTED_LOCALES = ['en', 'pt-PT', 'fr-FR', 'es-ES'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const FALLBACK_LOCALE: SupportedLocale = 'en'

/** Human-readable label for each locale, shown in the language switcher. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  'pt-PT': 'Português (Portugal)',
  'fr-FR': 'Français (France)',
  'es-ES': 'Español (España)',
}

/** localStorage key the language detector reads/writes the active locale under. */
export const LOCALE_STORAGE_KEY = 'discoverer-neo-locale'

/** Every translation namespace. Keep in step with the files in `src/locales/en/`. */
export const NAMESPACES = [
  'common',
  'auth',
  'nav',
  'admin',
  'mapBuilder',
  'mapViewer',
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
  // explicitly on login/`/me` (see useAuth). For anonymous or pre-login visits,
  // the detector falls back to localStorage → browser `navigator.language` → en.
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
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
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnNull: false,
  })
  .then(() => {
    // Reflect the initially-detected language in <html lang> (the
    // languageChanged event below only fires on subsequent switches).
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', i18n.resolvedLanguage ?? FALLBACK_LOCALE)
    }
  })

// Keep the document language attribute in sync for a11y / screen readers.
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng)
  }
})

// Dev-only escape hatch for Playwright (see e2e/i18n-theming.spec.ts): lets a
// test simulate a missing translation key at runtime instead of mutating
// locale JSON files on disk. Never present in a production build.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as typeof window & { __i18n?: typeof i18n }).__i18n = i18n
}

export default i18n
