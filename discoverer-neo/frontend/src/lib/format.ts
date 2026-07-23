import { FALLBACK_LOCALE, isSupportedLocale } from '@/i18n'

/**
 * Locale-aware formatting helpers built on the platform `Intl` APIs. These
 * replace the ad-hoc `toLocaleDateString()` / `toLocaleString()` calls
 * scattered through the UI so every date and number renders consistently for
 * the active locale.
 *
 * Each helper takes an explicit `locale` so it can be used outside React (e.g.
 * export previews) as well as from components via `useLocale().locale`.
 */

type DateInput = Date | string | number | null | undefined

function resolveLocale(locale: string | undefined): string {
  return isSupportedLocale(locale) ? locale : FALLBACK_LOCALE
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Format a date (no time) for the given locale. Returns '' for invalid input. */
export function formatDate(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(resolveLocale(locale), options).format(date)
}

/** Format a date with time for the given locale. Returns '' for invalid input. */
export function formatDateTime(
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return formatDate(value, locale, options)
}

/** Format a number for the given locale. Returns '' for non-finite input. */
export function formatNumber(
  value: number | null | undefined,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat(resolveLocale(locale), options).format(value)
}

/** Format an integer count for the given locale (thousands separators). */
export function formatInteger(value: number | null | undefined, locale: string): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0 })
}

/** Format a monetary amount for the given locale. */
export function formatCurrency(
  value: number | null | undefined,
  locale: string,
  currency = 'USD',
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(value, locale, { style: 'currency', currency, ...options })
}
