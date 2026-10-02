/**
 * The dialog side of a schedule parameter's date rule. The backend
 * (`backend/src/lib/schedule-date-rule.ts`) owns what a rule means and
 * resolves it at fire time; this only reads and writes the text
 * `@<UNIT><±n>:<TAKE>` so the dialog can edit it as three fields.
 */

export const RULE_UNITS = ['DAY', 'WEEK', 'FORTNIGHT', 'MONTH', 'QUARTER', 'HALF', 'YEAR'] as const
export type RuleUnit = (typeof RULE_UNITS)[number]

const PERIODS = ['WEEK', 'FORTNIGHT', 'MONTH', 'QUARTER', 'HALF', 'YEAR'] as const
/** Takes that give a date. */
export const DATE_TAKES = [
  'DATE',
  ...PERIODS.flatMap((p) => [`START_OF_${p}`, `END_OF_${p}`]),
] as const
/** Takes that give a number. */
export const NUMBER_TAKES = ['YEAR', 'MONTH'] as const

export interface DateRule {
  unit: RuleUnit
  offset: number
  take: string
}

const RULE = /^@([A-Z]+)([+-]\d{1,4})?:([A-Z_]+)$/

export function parseDateRule(value: string | null): DateRule | null {
  const m = value ? RULE.exec(value) : null
  if (!m || !(RULE_UNITS as readonly string[]).includes(m[1])) return null
  return { unit: m[1] as RuleUnit, offset: Number(m[2] ?? 0), take: m[3] }
}

export function formatDateRule(rule: DateRule): string {
  const offset = rule.offset === 0 ? '' : rule.offset > 0 ? `+${rule.offset}` : String(rule.offset)
  return `@${rule.unit}${offset}:${rule.take}`
}
