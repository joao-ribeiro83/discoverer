/**
 * Rolling values for a scheduled run's parameters.
 *
 * A schedule parameter's stored value is either a literal, sent as it is, or a
 * rule `@<UNIT><±n>:<TAKE>`: move the run date by n units, then take a date or
 * a number from where it lands. The rule is resolved in the schedule's own
 * timezone when the run fires, so a monthly map keeps following the month it
 * runs in instead of repeating the dates it was saved with.
 *
 *   @MONTH-1:START_OF_MONTH   first day of last month
 *   @MONTH-1:END_OF_MONTH     last day of last month
 *   @MONTH-1:START_OF_YEAR    1 January of last month's year — a year to date
 *                             that still covers December when it runs in January
 *   @DAY-1:DATE               yesterday
 *   @MONTH-1:YEAR             last month's year, as a number (2026)
 *   @MONTH-1:MONTH            last month's month, as a number (1-12)
 *
 * A fortnight is 1-15 and 16-end of month. A week starts on Monday.
 */

const UNITS = ['DAY', 'WEEK', 'FORTNIGHT', 'MONTH', 'QUARTER', 'HALF', 'YEAR'] as const;
const PERIODS = ['WEEK', 'FORTNIGHT', 'MONTH', 'QUARTER', 'HALF', 'YEAR'] as const;
type Unit = (typeof UNITS)[number];
type Period = (typeof PERIODS)[number];

const RULE = new RegExp(
  `^@(${UNITS.join('|')})([+-]\\d{1,4})?:(DATE|YEAR|MONTH|(START|END)_OF_(${PERIODS.join('|')}))$`,
);

/** A value meant as a rule: anything starting with `@`. */
export function looksLikeDateRule(value: string | null): boolean {
  return value?.startsWith('@') ?? false;
}

export function isValidDateRule(value: string): boolean {
  return RULE.test(value);
}

/** `Date.UTC` with overflow, so day 0 is the last day of the month before. */
const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** The calendar day `at` falls on in `timeZone`, as UTC midnight. */
function localDay(at: Date, timeZone: string): Date {
  // en-CA formats as YYYY-MM-DD.
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  return new Date(`${iso}T00:00:00Z`);
}

function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const lastDay = ymd(y, m + 1, 0).getUTCDate();
  return ymd(y, m, Math.min(d.getUTCDate(), lastDay));
}

function shift(d: Date, unit: Unit, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  switch (unit) {
    case 'DAY':
      return ymd(y, m, day + n);
    case 'WEEK':
      return ymd(y, m, day + 7 * n);
    case 'FORTNIGHT': {
      // Lands on the start of the target fortnight.
      const index = m * 2 + (day >= 16 ? 1 : 0) + n;
      const half = ((index % 2) + 2) % 2;
      return ymd(y, (index - half) / 2, half ? 16 : 1);
    }
    case 'MONTH':
      return addMonths(d, n);
    case 'QUARTER':
      return addMonths(d, 3 * n);
    case 'HALF':
      return addMonths(d, 6 * n);
    case 'YEAR':
      return addMonths(d, 12 * n);
  }
}

function bounds(d: Date, period: Period): [Date, Date] {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  switch (period) {
    case 'WEEK': {
      const start = day - ((d.getUTCDay() + 6) % 7);
      return [ymd(y, m, start), ymd(y, m, start + 6)];
    }
    case 'FORTNIGHT':
      return day >= 16 ? [ymd(y, m, 16), ymd(y, m + 1, 0)] : [ymd(y, m, 1), ymd(y, m, 15)];
    case 'MONTH':
      return [ymd(y, m, 1), ymd(y, m + 1, 0)];
    case 'QUARTER':
      return [ymd(y, m - (m % 3), 1), ymd(y, m - (m % 3) + 3, 0)];
    case 'HALF':
      return [ymd(y, m - (m % 6), 1), ymd(y, m - (m % 6) + 6, 0)];
    case 'YEAR':
      return [ymd(y, 0, 1), ymd(y, 12, 0)];
  }
}

/**
 * Resolve a rule against the moment a run fires. Dates come back as
 * `YYYY-MM-DD`, which `lib/sql/date-input.ts` accepts for any date bind.
 * A value that is not a rule comes back unchanged.
 */
export function resolveParameterValue(value: string, at: Date, timeZone: string): string {
  const match = RULE.exec(value);
  if (!match) return value;
  const [, unit, offset, take, edge, period] = match;
  const d = shift(localDay(at, timeZone), unit as Unit, Number(offset ?? 0));
  if (take === 'YEAR') return String(d.getUTCFullYear());
  if (take === 'MONTH') return String(d.getUTCMonth() + 1);
  const out = take === 'DATE' ? d : bounds(d, period as Period)[edge === 'START' ? 0 : 1];
  return out.toISOString().slice(0, 10);
}
