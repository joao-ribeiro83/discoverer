import { normalizeDateInput } from '../lib/sql/date-input.js';

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
  // 31 Oct 2022 read year-first. Nothing in the value decides, so it is
  // refused: a wrong decade in a date filter returns wrong rows silently.
  it('refuses an all-two-digit date rather than pick a decade', () => {
    expect(normalizeDateInput('22.10.31')).toBeNull();
    expect(normalizeDateInput('01-02-03')).toBeNull();
  });

  it('accepts a two-digit date whose first part cannot be a day', () => {
    expect(normalizeDateInput('99.10.31')).toBe('1999-10-31');
  });

  it('reads the all-numeric forms day-first', () => {
    expect(normalizeDateInput('31/12/2025')).toBe('2025-12-31');
    expect(normalizeDateInput('01-02-2022')).toBe('2022-02-01');
  });

  it('applies Oracle’s RR rule to a two-digit year', () => {
    expect(normalizeDateInput('01-JAN-49')).toBe('2049-01-01');
    expect(normalizeDateInput('01-JAN-50')).toBe('1950-01-01');
  });

  it('drops a time component', () => {
    expect(normalizeDateInput('2026-09-18T14:30:00')).toBe('2026-09-18');
    expect(normalizeDateInput('18/09/2026 14:30')).toBe('2026-09-18');
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
