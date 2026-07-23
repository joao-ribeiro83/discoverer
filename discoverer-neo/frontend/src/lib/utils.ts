import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import i18n, { FALLBACK_LOCALE } from '@/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// The active UI locale, read from the i18n singleton at call time so these
// shared formatters follow the user's language without every caller threading
// a locale through. For a hook-scoped locale, prefer `useLocale()` +
// `@/lib/format` helpers.
function activeLocale(): string {
  return i18n.resolvedLanguage ?? FALLBACK_LOCALE
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  })
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(activeLocale(), {
    ...options,
  })
}
