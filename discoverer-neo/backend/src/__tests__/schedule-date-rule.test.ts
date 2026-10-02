import {
  isValidDateRule,
  resolveParameterValue,
} from '../lib/schedule-date-rule.js';

const LISBON = 'Europe/Lisbon';
const at = (iso: string) => new Date(iso);
const r = (rule: string, iso: string, tz = LISBON) => resolveParameterValue(rule, at(iso), tz);

describe('schedule date rules', () => {
  it('passes a literal through untouched', () => {
    expect(r('2026-01-01', '2026-10-01T08:00:00Z')).toBe('2026-01-01');
    expect(r('Norte', '2026-10-01T08:00:00Z')).toBe('Norte');
  });

  it('closes the previous month', () => {
    expect(r('@MONTH-1:START_OF_MONTH', '2026-03-01T08:00:00Z')).toBe('2026-02-01');
    expect(r('@MONTH-1:END_OF_MONTH', '2026-03-01T08:00:00Z')).toBe('2026-02-28');
    expect(r('@MONTH-1:END_OF_MONTH', '2028-03-01T08:00:00Z')).toBe('2028-02-29');
  });

  it('year to date of the closed month still works in January', () => {
    expect(r('@MONTH-1:START_OF_YEAR', '2027-01-01T08:00:00Z')).toBe('2026-01-01');
    expect(r('@MONTH-1:END_OF_MONTH', '2027-01-01T08:00:00Z')).toBe('2026-12-31');
    expect(r('@MONTH-1:START_OF_YEAR', '2026-11-01T08:00:00Z')).toBe('2026-01-01');
  });

  it('clamps a month shift to the shorter month', () => {
    expect(r('@MONTH-1:DATE', '2026-03-31T08:00:00Z')).toBe('2026-02-28');
  });

  it('handles quarters, halves and years', () => {
    expect(r('@QUARTER-1:START_OF_QUARTER', '2026-01-02T08:00:00Z')).toBe('2025-10-01');
    expect(r('@QUARTER-1:END_OF_QUARTER', '2026-01-02T08:00:00Z')).toBe('2025-12-31');
    expect(r('@HALF-1:START_OF_HALF', '2026-07-01T08:00:00Z')).toBe('2026-01-01');
    expect(r('@HALF-1:END_OF_HALF', '2026-07-01T08:00:00Z')).toBe('2026-06-30');
    expect(r('@YEAR-1:END_OF_YEAR', '2026-01-01T08:00:00Z')).toBe('2025-12-31');
  });

  it('handles fortnights across a month and a year', () => {
    expect(r('@FORTNIGHT-1:START_OF_FORTNIGHT', '2026-10-16T08:00:00Z')).toBe('2026-10-01');
    expect(r('@FORTNIGHT-1:END_OF_FORTNIGHT', '2026-10-16T08:00:00Z')).toBe('2026-10-15');
    expect(r('@FORTNIGHT-1:START_OF_FORTNIGHT', '2026-01-01T08:00:00Z')).toBe('2025-12-16');
    expect(r('@FORTNIGHT-1:END_OF_FORTNIGHT', '2026-01-01T08:00:00Z')).toBe('2025-12-31');
  });

  it('weeks start on Monday', () => {
    // Thursday 2026-10-01.
    expect(r('@WEEK-1:START_OF_WEEK', '2026-10-01T08:00:00Z')).toBe('2026-09-21');
    expect(r('@WEEK-1:END_OF_WEEK', '2026-10-01T08:00:00Z')).toBe('2026-09-27');
  });

  it('gives year and month numbers', () => {
    expect(r('@MONTH-1:YEAR', '2027-01-01T08:00:00Z')).toBe('2026');
    expect(r('@MONTH-1:MONTH', '2027-01-01T08:00:00Z')).toBe('12');
    expect(r('@DAY:DATE', '2026-10-01T08:00:00Z')).toBe('2026-10-01');
  });

  it('reads the day in the schedule timezone, not UTC', () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Tokyo.
    expect(r('@DAY-1:DATE', '2025-12-31T23:30:00Z', 'Asia/Tokyo')).toBe('2025-12-31');
    expect(r('@DAY-1:DATE', '2025-12-31T23:30:00Z', 'UTC')).toBe('2025-12-30');
  });

  it('accepts only well-formed rules', () => {
    expect(isValidDateRule('@MONTH-1:END_OF_MONTH')).toBe(true);
    expect(isValidDateRule('@DAY:DATE')).toBe(true);
    expect(isValidDateRule('@MONTH-1:END_OF_DAY')).toBe(false);
    expect(isValidDateRule('@month-1:END_OF_MONTH')).toBe(false);
    expect(isValidDateRule('@MONTH-1')).toBe(false);
  });
});
