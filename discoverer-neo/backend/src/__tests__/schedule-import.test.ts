import { describe, it, expect } from '@jest/globals';
import {
  classifyFrequencyUnit,
  classifyRunOutcome,
  buildCronPlan,
} from '../services/schedule-import.service.js';

describe('classifyFrequencyUnit', () => {
  it('reads MINUTES from the /1440 shape', () => {
    expect(classifyFrequencyUnit("... + ( &bind_num_units * 1/1440)")).toBe('MINUTES');
  });

  it('reads HOURS from the /24 shape', () => {
    expect(classifyFrequencyUnit("... + ( &bind_num_units * 1/24)")).toBe('HOURS');
  });

  it('reads DAYS from the bare-unit shape', () => {
    expect(classifyFrequencyUnit("... + ( &bind_num_units)")).toBe('DAYS');
  });

  it('reads WEEKS from the *7 shape', () => {
    expect(classifyFrequencyUnit("... + ( &bind_num_units * 7)")).toBe('WEEKS');
  });

  it('reads MONTHS from add_months without a *12', () => {
    expect(classifyFrequencyUnit("add_months(..., &bind_num_units )")).toBe('MONTHS');
  });

  it('reads YEARS from add_months with a *12', () => {
    expect(classifyFrequencyUnit("add_months(...,( &bind_num_units * 12) )")).toBe('YEARS');
  });
});

describe('classifyRunOutcome', () => {
  it('is FAILED when an Oracle error code is present', () => {
    const result = classifyRunOutcome(-1854, 'a data juliana deve situar-se entre 1 e 5373484');
    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('ORA-1854: a data juliana deve situar-se entre 1 e 5373484');
  });

  it('is SUCCESS when no error code is present', () => {
    const result = classifyRunOutcome(null, null);
    expect(result.status).toBe('SUCCESS');
    expect(result.errorMessage).toBeNull();
  });
});

describe('buildCronPlan', () => {
  const anchor = new Date(Date.UTC(2025, 3, 9, 9, 5)); // 2025-04-09T09:05Z

  it('a one-shot (BR_AUTO_REFRESH=0) job gets a cron matching its exact anchor, bounded to fire once', () => {
    const plan = buildCronPlan(anchor, false, 1, 'DAYS');
    expect(plan.cronExpression).toBe('5 9 9 4 *');
    expect(plan.validFrom).toEqual(anchor);
    expect(plan.validUntil).toEqual(new Date(anchor.getTime() + 60_000));
  });

  it('a one-shot job ignores the frequency unit entirely — it never recurs', () => {
    const daily = buildCronPlan(anchor, false, 1, 'DAYS');
    const yearly = buildCronPlan(anchor, false, 5, 'YEARS');
    expect(daily.cronExpression).toBe(yearly.cronExpression);
  });

  it('a recurring weekly job has no bounding window', () => {
    const plan = buildCronPlan(anchor, true, 1, 'WEEKS');
    expect(plan.validFrom).toBeNull();
    expect(plan.validUntil).toBeNull();
    expect(plan.cronExpression).toBe(`5 9 * * ${anchor.getUTCDay()}`);
  });

  it('a recurring minutes job steps the minute field', () => {
    const plan = buildCronPlan(anchor, true, 15, 'MINUTES');
    expect(plan.cronExpression).toBe('*/15 * * * *');
  });
});
