import { describe, expect, it } from 'vitest'
import { buildCron, parseCron, DEFAULT_SPEC, type FrequencySpec } from '@/lib/schedule-frequency'
import { formatDateRule, parseDateRule } from '@/lib/schedule-date-rule'

const spec = (over: Partial<FrequencySpec>): FrequencySpec => ({ ...DEFAULT_SPEC, ...over })

describe('schedule frequency', () => {
  it.each([
    [spec({ frequency: 'daily', time: '07:30' }), '30 7 * * *'],
    [spec({ frequency: 'weekly', weekday: 5 }), '0 8 * * 5'],
    [spec({ frequency: 'fortnightly' }), '0 8 1,16 * *'],
    [spec({ frequency: 'monthly', day: 'L' }), '0 8 L * *'],
    [spec({ frequency: 'bimonthly', day: '2' }), '0 8 2 */2 *'],
    [spec({ frequency: 'quarterly' }), '0 8 1 */3 *'],
    [spec({ frequency: 'fourMonthly' }), '0 8 1 */4 *'],
    [spec({ frequency: 'semiannual' }), '0 8 1 */6 *'],
    [spec({ frequency: 'annual', day: '15', month: 3 }), '0 8 15 3 *'],
  ])('%o <-> %s', (s, cron) => {
    expect(buildCron(s)).toBe(cron)
    expect(parseCron(cron)).toEqual(s)
  })

  it('reads the old presets', () => {
    expect(parseCron('0 0 * * *')).toMatchObject({ frequency: 'daily', time: '00:00' })
    expect(parseCron('0 0 * * 0')).toMatchObject({ frequency: 'weekly', weekday: 0 })
    expect(parseCron('0 0 1 * *')).toMatchObject({ frequency: 'monthly', day: '1' })
  })

  it('leaves anything else custom', () => {
    for (const e of ['0 9 * * 1-5', '0 8 31 * *', '0 8 1 */5 *', '*/5 * * * *', 'nonsense']) {
      expect(parseCron(e).frequency).toBe('custom')
    }
  })
})

describe('schedule date rule text', () => {
  it('round-trips', () => {
    for (const r of ['@MONTH-1:START_OF_YEAR', '@DAY:DATE', '@QUARTER+1:END_OF_QUARTER']) {
      expect(formatDateRule(parseDateRule(r)!)).toBe(r)
    }
  })

  it('treats a literal as no rule', () => {
    expect(parseDateRule('2026-01-01')).toBeNull()
    expect(parseDateRule(null)).toBeNull()
  })
})
