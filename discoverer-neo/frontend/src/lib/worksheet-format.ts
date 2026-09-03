import { FALLBACK_LOCALE, isSupportedLocale } from '@/i18n'

/**
 * Discoverer format masks, applied to result values.
 *
 * A migrated worksheet carries Oracle-style masks (`999,999.00`,
 * `$9,999,999.00`, `990.0%`, `DD-MON-YYYY`). They are *presentation*: the query
 * returns a raw number or date and the mask says how the sheet drew it. These
 * helpers turn a mask into `Intl` options rather than reimplementing Oracle's
 * formatter, so a formatted value still reads correctly in every locale — a
 * Portuguese user sees `1.234,50` where the mask says `9,999.00`, which is
 * what the mask meant (grouped, two decimals), not what it literally spelled.
 *
 * Only the mask elements that appear in the corpus are handled. Anything else
 * falls through to the caller's default formatting rather than being guessed
 * at — a half-applied mask is worse than none.
 */

function resolveLocale(locale: string | undefined): string {
  return isSupportedLocale(locale) ? locale : FALLBACK_LOCALE
}

/**
 * A result cell as a plain string, for grouping keys and comparisons.
 *
 * `String(x)` on an `unknown` prints `[object Object]` for anything structured,
 * which would silently collapse two different rows onto one group key. Objects
 * and arrays go through `JSON.stringify` instead, so distinct values stay
 * distinct — the same rule the results grid already applies when drawing them.
 */
export function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value) ?? ''
}

/** Mask elements that only ever appear in a date mask. */
const DATE_MASK_RE = /(YYYY|YY|MONTH|MON|MM|DD|DAY|DY|HH24|HH|MI|SS|AM|PM)/i
/** Mask elements that only ever appear in a number mask. */
const NUMBER_MASK_RE = /[90]/

export type MaskKind = 'number' | 'date' | 'unknown'

/** What a mask formats. `unknown` means "leave it to the caller". */
export function maskKind(mask: string | undefined | null): MaskKind {
  if (!mask) return 'unknown'
  const trimmed = mask.trim()
  if (trimmed === '') return 'unknown'
  // Order matters: `MM` and `DD` contain no 9/0, but `990.0%` contains no date
  // element, so testing for digits first would still be safe — testing dates
  // first keeps `DD-MON-YYYY` from being read as a number mask if it ever
  // gained a literal digit.
  if (DATE_MASK_RE.test(trimmed)) return 'date'
  if (NUMBER_MASK_RE.test(trimmed)) return 'number'
  return 'unknown'
}

/**
 * Turn a numeric mask into `Intl.NumberFormat` options.
 *
 * `,` anywhere means "group thousands". The digits after the decimal point set
 * both the minimum and maximum fraction digits — `999.00` always shows two,
 * `999.99` likewise, because Oracle's `9` and `0` differ only in how they pad
 * the *integer* side. A leading `$` means currency.
 *
 * A trailing `%` appends a percent sign and does **not** multiply by 100.
 * Discoverer stores the computed value, and multiplying a value that is
 * already a percentage would silently show it 100× too large.
 */
export function numberOptionsFromMask(mask: string): {
  options: Intl.NumberFormatOptions
  suffix: string
} {
  const percent = /%\s*$/.test(mask)
  const body = mask.replace(/%\s*$/, '')
  const currency = body.includes('$')
  const grouping = body.includes(',')

  const decimalPart = body.split('.')[1] ?? ''
  const fractionDigits = (decimalPart.match(/[90]/g) ?? []).length

  const options: Intl.NumberFormatOptions = {
    useGrouping: grouping,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }
  if (currency) {
    options.style = 'currency'
    // The mask records a currency *symbol*, not a currency code, and Neo has
    // nowhere to store which currency a column is in. USD keeps the symbol
    // slot filled and the grouping/decimals correct; a real currency setting
    // belongs on the item, not inferred from one character.
    options.currency = 'USD'
  }
  return { options, suffix: percent ? '%' : '' }
}

/** Two-digit zero pad. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Apply a date mask by substituting Oracle's elements.
 *
 * Month and day names come from `Intl` in the active locale, so `DD-MON-YYYY`
 * renders `05-AGO-2026` for a Spanish user and `05-AUG-2026` for an English
 * one. Longest elements are replaced first (`YYYY` before `YY`, `MONTH` before
 * `MON` before `MM`) — otherwise a short element eats part of a long one.
 */
export function applyDateMask(date: Date, mask: string, locale: string): string {
  const loc = resolveLocale(locale)
  const monthLong = new Intl.DateTimeFormat(loc, { month: 'long' }).format(date)
  const monthShort = new Intl.DateTimeFormat(loc, { month: 'short' }).format(date)
  const dayLong = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date)
  const dayShort = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date)
  const hours12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12

  const replacements: Array<[RegExp, string]> = [
    [/YYYY/g, String(date.getFullYear())],
    [/YY/g, pad2(date.getFullYear() % 100)],
    [/MONTH/gi, monthLong.toUpperCase()],
    [/MON/g, monthShort.toUpperCase().replace(/\.$/, '')],
    [/MM/g, pad2(date.getMonth() + 1)],
    [/DAY/g, dayLong.toUpperCase()],
    [/DY/g, dayShort.toUpperCase().replace(/\.$/, '')],
    [/DD/g, pad2(date.getDate())],
    [/HH24/g, pad2(date.getHours())],
    [/HH/g, pad2(hours12)],
    [/MI/g, pad2(date.getMinutes())],
    [/SS/g, pad2(date.getSeconds())],
    [/AM|PM/g, date.getHours() < 12 ? 'AM' : 'PM'],
  ]

  let out = mask
  for (const [pattern, value] of replacements) out = out.replace(pattern, value)
  return out
}

/**
 * Format one value with a map column's format mask.
 *
 * Returns `null` when the mask does not apply to this value — an empty mask, a
 * mask whose kind is unreadable, or a value of the wrong shape. The caller then
 * falls back to its own locale-aware default, which is what an unformatted
 * column already does.
 */
export function applyFormatMask(
  value: unknown,
  mask: string | undefined | null,
  locale: string,
): string | null {
  if (value === null || value === undefined || value === '') return null
  const kind = maskKind(mask)
  if (kind === 'unknown' || !mask) return null

  if (kind === 'number') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(n)) return null
    const { options, suffix } = numberOptionsFromMask(mask)
    return new Intl.NumberFormat(resolveLocale(locale), options).format(n) + suffix
  }

  const date = value instanceof Date ? value : new Date(stringifyCell(value))
  if (Number.isNaN(date.getTime())) return null
  return applyDateMask(date, mask, locale)
}

/**
 * Fill in a Discoverer total label.
 *
 * Discoverer stores the template verbatim — `Total for &value`,
 * `SubTotal por &Value` — because the value only exists once the query has run.
 * `&value` is the value the subtotal broke on and `&item` the column it broke
 * in. Both are matched case-insensitively: authors typed them either way.
 *
 * A label with no template element is returned unchanged, and a total with no
 * label at all gets `fallback`.
 */
export function interpolateTotalLabel(
  template: string | undefined | null,
  parts: { value?: string; item?: string },
  fallback: string,
): string {
  if (!template || template.trim() === '') return fallback
  return template
    .replace(/&value/gi, parts.value ?? '')
    .replace(/&item/gi, parts.item ?? '')
    .trim()
}
