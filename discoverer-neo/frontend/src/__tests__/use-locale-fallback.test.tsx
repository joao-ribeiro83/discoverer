import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLocale } from '@/hooks/useLocale'

// Isolated in its own file because it replaces react-i18next's useTranslation
// wholesale — the other useLocale tests need the real i18n instance.
// Covers the two branches use-locale-branches.test.tsx can't reach through a
// real, correctly-configured i18n instance: resolvedLanguage being unset, and
// the resolved value not being one of our supported locales.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: undefined, language: 'de-DE' } }),
}))

describe('useLocale locale resolution fallback', () => {
  it('falls back through instance.language to FALLBACK_LOCALE when neither is supported', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  })
})
