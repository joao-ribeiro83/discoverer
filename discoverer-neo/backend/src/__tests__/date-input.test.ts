import { dateFieldOrder, normalizeDateInput } from '../lib/sql/date-input.js';

describe('normalizeDateInput', () => {
  it('passes ISO through', () => {
    expect(normalizeDateInput('2026-09-18')).toBe('2026-09-18');
    expect(normalizeDateInput('2026-9-8')).toBe('2026-09-08');
  });

  // The reference estate's own stored schedule parameters. Every one of these
  // used to reach Oracle as ORA-01861.
  it('reads the values this estate actually stores', () => {
    expect(normalizeDateInput('01-JAN-2022')).toBe('2022-01-01');
    expect(normalizeDateInput('31-DEZ-2025')).toBe('2025-12-31'); // Portuguese
  });

  // The estate also stores `22.10.31`, which is 22 Oct 2031 read day-first and
  // 31 Oct 2022 read year-first. Nothing in the VALUE decides, so with no mask
  // it is refused: a wrong decade returns wrong rows silently. The mask does
  // decide it — see the next test.
  it('refuses an all-two-digit date when nothing says how it was written', () => {
    expect(normalizeDateInput('22.10.31', null)).toBeNull();
    expect(normalizeDateInput('01-02-03', null)).toBeNull();
  });

  // The database's own NLS_DATE_FORMAT is what these values were written
  // under, so it is the authority — this estate reports RR.MM.DD.
  it('resolves an ambiguous date from the configured date format', () => {
    const yearFirst = dateFieldOrder('RR.MM.DD');
    expect(yearFirst).toEqual(['y', 'm', 'd']);
    expect(normalizeDateInput('22.10.31', yearFirst)).toBe('2022-10-31');

    const dayFirst = dateFieldOrder('DD/MM/RRRR');
    expect(normalizeDateInput('22.10.31', dayFirst)).toBe('2031-10-22');
  });

  it('lets the mask decide day-first from month-first on a four-digit year', () => {
    expect(normalizeDateInput('01/02/2022', dateFieldOrder('MM/DD/YYYY'))).toBe('2022-01-02');
    expect(normalizeDateInput('01/02/2022', dateFieldOrder('DD/MM/YYYY'))).toBe('2022-02-01');
    // No mask: day-first, as documented.
    expect(normalizeDateInput('01/02/2022', null)).toBe('2022-02-01');
  });

  it('reads a mask only when all three fields are unambiguous in it', () => {
    expect(dateFieldOrder(undefined)).toBeNull();
    expect(dateFieldOrder('YYYY-MM')).toBeNull(); // no day
    // DDD is the day of the YEAR and D the day of the WEEK — neither says how
    // a day of the month was written.
    expect(dateFieldOrder('YYYY-MM-DDD')).toBeNull();
    // Quoted text is literal, not fields.
    expect(dateFieldOrder(`DD 'de' MON 'de' YYYY`)).toEqual(['d', 'm', 'y']);
  });

  it('accepts a two-digit date whose first part cannot be a day', () => {
    expect(normalizeDateInput('99.10.31', null)).toBe('1999-10-31');
  });

  it('reads the all-numeric forms day-first', () => {
    expect(normalizeDateInput('31/12/2025', null)).toBe('2025-12-31');
    expect(normalizeDateInput('01-02-2022', null)).toBe('2022-02-01');
  });

  it('applies Oracle’s RR rule to a two-digit year', () => {
    expect(normalizeDateInput('01-JAN-49')).toBe('2049-01-01');
    expect(normalizeDateInput('01-JAN-50')).toBe('1950-01-01');
  });

  it('drops a time component', () => {
    expect(normalizeDateInput('2026-09-18T14:30:00')).toBe('2026-09-18');
    expect(normalizeDateInput('18/09/2026 14:30', null)).toBe('2026-09-18');
  });

  it('refuses a day the month does not have, rather than rolling it over', () => {
    expect(normalizeDateInput('31-APR-2026')).toBeNull();
    expect(normalizeDateInput('2026-02-30')).toBeNull();
  });

  it('refuses what it cannot read instead of guessing', () => {
    expect(normalizeDateInput('')).toBeNull();
    expect(normalizeDateInput('last tuesday')).toBeNull();
    expect(normalizeDateInput('01-XYZ-2022')).toBeNull();
  });
});
