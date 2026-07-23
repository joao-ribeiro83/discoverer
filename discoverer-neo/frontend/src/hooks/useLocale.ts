import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from '@/i18n'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface SetLocaleOptions {
  /**
   * Persist the choice to the user's saved preferences via
   * `PATCH /api/users/me/preferences`. Defaults to true when authenticated;
   * pass false to change the UI language without writing it back (e.g. when
   * applying a locale that just came *from* the server).
   */
  persist?: boolean
}

/**
 * Reads and sets the active UI locale.
 *
 * Setting a locale updates the UI immediately (no page reload), keeps the
 * localStorage cache and `<html lang>` in sync, and — for an authenticated
 * user — persists the choice to the backend so it follows them across devices.
 * Session 7.4's Settings page is the primary caller.
 */
export function useLocale() {
  const { i18n: instance } = useTranslation()

  const raw = instance.resolvedLanguage ?? instance.language
  const locale: SupportedLocale = isSupportedLocale(raw) ? raw : FALLBACK_LOCALE

  const setLocale = useCallback(async (next: SupportedLocale, options?: SetLocaleOptions) => {
    if (!isSupportedLocale(next)) return
    await i18n.changeLanguage(next)

    const shouldPersist = options?.persist ?? true
    if (shouldPersist && useAuthStore.getState().isAuthenticated) {
      try {
        await apiClient.users.updatePreferences({ locale: next })
      } catch {
        // Best-effort — the UI language has already changed locally; a failed
        // write just means it won't follow the user to another device.
      }
    }
  }, [])

  return { locale, setLocale, supportedLocales: SUPPORTED_LOCALES }
}
