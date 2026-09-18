/**
 * Normalise a date a person typed (or a migrated schedule stored) into the one
 * format the generated SQL's `TO_DATE(:bind, 'YYYY-MM-DD')` accepts.
 *
 * The generator has always wrapped a date operand in `TO_DATE` with a fixed
 * `YYYY-MM-DD` mask and bound the raw string straight through. That only ever
 * worked for a value already in ISO form. The reference estate's own saved
 * schedule parameters are `01-JAN-2022`, `31-DEZ-2025` and `22.10.31`, so every
 * one of them reached Oracle as `ORA-01861: literal does not match format
 * string` — and the estate has 184 conditions where a text parameter filters a
 * DATE column, which is exactly the shape Discoverer users were told to use
 * (a text prompt, converted inside the condition).
 *
 * Converting here rather than widening the SQL mask keeps the statement shape
 * unchanged, keeps the bind a string, and introduces no timezone question: a
 * JS `Date` bound through the driver would be converted against the session
 * zone and could land a day either side.
 *
 * **The all-numeric forms read from `ORACLE_NLS_DATE_FORMAT`.** `31/12/2025` is
 * unambiguous, but `01/02/2022` is not, and `22.10.31` is not even decidable
 * between day-first and year-first. Guessing returns the wrong rows silently.
 *
 * The database's own `NLS_DATE_FORMAT` is the right authority, because it is
 * the setting these values were written under: this estate reports `RR.MM.DD`,
 * which makes `22.10.31` the 31st of October 2022 and nothing else. Set it via
 * `ORACLE_NLS_DATE_FORMAT` — the same value the Oracle session gets.
 *
 * Without it, a four-digit year still pins its own position, `DD-MM-YYYY`
 * falls back to day-first as the convention in every locale this application
 * ships, and an all-two-digit date is REFUSED rather than guessed.
 *
 * Anything that does not match one of the accepted forms is refused by name
 * rather than passed through to become an Oracle error, or worse, a silent
 * mis-read.
 */

import { config } from '../../config.js';

/** Month abbreviations Oracle prints under the NLS languages this estate uses. */
const MONTH_NAMES: Record<string, number> = {
  // English
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Portuguese — only the four that differ from the English spelling.
  fev: 2, abr: 4, ago: 8, set: 9, out: 10, dez: 12,
  // Spanish / French additions that do not collide with the above.
  ene: 1, avr: 4, mai: 5, juin: 6, juil: 7, aou: 8, dic: 12, 'déc': 12,
};

/** The forms `normalizeDateInput` accepts, for an error message. */
export const ACCEPTED_DATE_FORMATS =
  'YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY or DD-MON-YYYY';

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject a day the month does not have — 31 April is a typo, not a date.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Oracle's own rule for a two-digit year under `RR`: 00-49 is this century,
 * 50-99 the last. Matching it keeps a migrated value reading the same as it
 * did in Discoverer.
 */
function expandTwoDigitYear(yy: number): number {
  return yy < 50 ? 2000 + yy : 1900 + yy;
}

/**
 * `YYYY-MM-DD` (already normal), `DD-MM-YYYY`, `DD/MM/YYYY`, `DD.MM.YYYY`,
 * `DD-MON-YYYY`, and the two-digit-year variants of each.
 *
 * Returns the ISO date, or null when the input is not a date this function is
 * willing to read. A leading/trailing time component is dropped: the operand
 * is a DATE column and Discoverer's prompts were date-only.
 */
export type Field = 'y' | 'm' | 'd';

/** What day-first means, as a field order. */
const DAY_FIRST: readonly Field[] = ['d', 'm', 'y'];

/**
 * The year/month/day order of an Oracle date mask — `RR.MM.DD` is
 * `['y','m','d']` — or null when the mask does not carry all three plainly.
 *
 * Only the unambiguous tokens count. `DDD` is the day of the YEAR and `D` the
 * day of the WEEK, neither of which is a day of the month; `MI` is minutes,
 * not months. A mask using any of those tells us nothing about how a bare
 * `22.10.31` was written, so it is treated as no mask at all rather than being
 * read optimistically.
 */
export function dateFieldOrder(mask: string | undefined | null): Field[] | null {
  if (!mask) return null;
  // A quoted section is literal text — `'de'` in `DD "de" MON` must not be
  // scanned for field letters.
  const scannable = mask.replace(/'[^']*'/g, ' ').replace(/"[^"]*"/g, ' ').toUpperCase();

  // Longest first, so MONTH is not read as MM + TH.
  const TOKENS: Array<[RegExp, Field]> = [
    [/\bMONTH\b/, 'm'],
    [/\bMON\b/, 'm'],
    [/\bRRRR\b/, 'y'],
    [/\bYYYY\b/, 'y'],
    [/\bRR\b/, 'y'],
    [/\bYY\b/, 'y'],
    [/\bMM\b/, 'm'],
    [/\bDD\b/, 'd'],
  ];

  const found = new globalThis.Map<Field, number>();
  for (const [pattern, field] of TOKENS) {
    const at = scannable.search(pattern);
    if (at >= 0 && !found.has(field)) found.set(field, at);
  }
  if (found.size !== 3) return null;
  return [...found.entries()].sort((x, y) => x[1] - y[1]).map(([field]) => field);
}

/**
 * @param fieldOrder how the source writes an all-numeric date. Defaults to the
 *   database's own `ORACLE_NLS_DATE_FORMAT`, which is the setting under which
 *   these values were written; pass one explicitly in tests.
 */
export function normalizeDateInput(
  raw: string,
  fieldOrder: Field[] | null = dateFieldOrder(config.ORACLE_NLS_DATE_FORMAT),
): string | null {
  const value = raw.trim();
  if (value === '') return null;

  // Drop a time part if one came along (`2026-09-18T00:00:00`, `18/09/2026 00:00`).
  const dateOnly = value.split(/[T ]/)[0]!;

  // ISO first: unambiguous, and what a date input in the browser sends.
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateOnly);
  if (isoMatch) {
    return iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // `DD-MON-YYYY` / `DD-MON-YY` — Oracle's default display form.
  const monMatch = /^(\d{1,2})[-/. ]([A-Za-zÀ-ÿ]{3,4})[-/. ](\d{2}|\d{4})$/.exec(dateOnly);
  if (monMatch) {
    const month = MONTH_NAMES[monMatch[2]!.toLowerCase().replace(/\.$/, '')];
    if (month === undefined) return null;
    const yearRaw = Number(monMatch[3]);
    const year = monMatch[3]!.length === 2 ? expandTwoDigitYear(yearRaw) : yearRaw;
    return iso(year, month, Number(monMatch[1]));
  }

  // All-numeric — the only genuinely ambiguous shape, and the one the
  // database's own `NLS_DATE_FORMAT` settles when it is configured.
  const numeric = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(dateOnly);
  if (numeric) {
    const parts: [string, string, string] = [numeric[1]!, numeric[2]!, numeric[3]!];
    const [a, b, c] = parts;

    // A four-digit field is a year wherever it sits, and that pins the rest:
    // stronger evidence than any configured mask, so it is checked first.
    if (a.length === 4) return iso(Number(a), Number(b), Number(c)); // YYYY-M-D
    if (c.length === 4) {
      // The remaining question is only whether the first field is the day or
      // the month. The mask answers it; without one, day-first.
      const order = fieldOrder ?? DAY_FIRST;
      return order.indexOf('m') < order.indexOf('d')
        ? iso(Number(c), Number(a), Number(b)) // M-D-YYYY
        : iso(Number(c), Number(b), Number(a)); // D-M-YYYY
    }

    // Two-digit everything, e.g. this estate's stored `22.10.31`. Day-first it
    // is 22 Oct 2031; year-first, 31 Oct 2022. Both are real readings, and a
    // date filter that quietly picks the wrong decade returns wrong rows with
    // nothing to notice — so this resolves ONLY from the database's own
    // `NLS_DATE_FORMAT`, which is what wrote the value in the first place.
    // A leading value above 31 cannot be a day, which settles it regardless.
    if (fieldOrder) {
      const at = (field: Field) => Number(parts[fieldOrder.indexOf(field)]);
      return iso(expandTwoDigitYear(at('y')), at('m'), at('d'));
    }
    if (Number(a) > 31) return iso(expandTwoDigitYear(Number(a)), Number(b), Number(c));
    return null;
  }

  return null;
}
