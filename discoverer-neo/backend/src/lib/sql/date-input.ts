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
 * **Day-first for the all-numeric forms.** `31/12/2025` is unambiguous, but
 * `01/02/2022` is not, and guessing wrong silently returns the wrong rows.
 * Day-first is the documented reading because it is what this database itself
 * uses — its own stored values are `DD-MON-YYYY` — and it is the convention in
 * every locale this application ships. It is a convention, not a detection:
 * a month-first estate must state its dates in ISO.
 *
 * Anything that does not match one of the accepted forms is refused by name
 * rather than passed through to become an Oracle error, or worse, a silent
 * mis-read.
 */

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
export function normalizeDateInput(raw: string): string | null {
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

  // All-numeric. Four-digit year first tells us which end it is on; otherwise
  // day-first, per the note at the top of this file.
  const numeric = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/.exec(dateOnly);
  if (numeric) {
    const [a, b, c] = [numeric[1]!, numeric[2]!, numeric[3]!];
    if (a.length === 4) return iso(Number(a), Number(b), Number(c)); // YYYY-M-D
    if (c.length === 4) return iso(Number(c), Number(b), Number(a)); // D-M-YYYY
    // Two-digit everything, e.g. this estate's stored `22.10.31`. Day-first
    // makes it 22 Oct 2031; year-first makes it 31 Oct 2022. Both are real
    // readings and nothing in the value decides between them, so it is
    // REFUSED. Day-first resolves the four-digit-year forms above because the
    // year is pinned there; here it is not, and a date filter that quietly
    // picks the wrong decade returns wrong rows with no error to notice.
    // A leading value above 31 cannot be a day, which does settle it.
    if (Number(a) > 31) return iso(expandTwoDigitYear(Number(a)), Number(b), Number(c));
    return null;
  }

  return null;
}
