/**
 * The schedule dialog's "how often" choice, and the cron expression it means.
 *
 * Cron stays the stored form (BullMQ fires on it); this only lets the dialog
 * offer frequencies by name and read a saved expression back into them.
 * Anything it cannot read back is "custom" and keeps its raw expression.
 *
 * Multi-month frequencies count from January: quarterly runs in Jan/Apr/Jul/Oct.
 * Fortnightly runs on the 1st and 16th — the two halves of the month that the
 * `FORTNIGHT` date rule also uses. Day of month is 1-28 or `L` (last day), so
 * no month is ever skipped for being too short.
 */

export const FREQUENCIES = [
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
  'bimonthly',
  'quarterly',
  'fourMonthly',
  'semiannual',
  'annual',
  'custom',
] as const
export type Frequency = (typeof FREQUENCIES)[number]

export interface FrequencySpec {
  frequency: Frequency
  /** `HH:mm`. */
  time: string
  /** 0 = Sunday … 6 = Saturday, as cron counts. */
  weekday: number
  /** `1`…`28`, or `L` for the last day of the month. */
  day: string
  /** 1-12; annual only. */
  month: number
}

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  fourMonthly: 4,
  semiannual: 6,
}

export const DEFAULT_SPEC: FrequencySpec = {
  frequency: 'monthly',
  time: '08:00',
  weekday: 1,
  day: '1',
  month: 1,
}

/** The cron expression for a spec; null for `custom`, which has its own. */
export function buildCron(spec: FrequencySpec): string | null {
  const [h, m] = spec.time.split(':').map(Number)
  const at = `${m ?? 0} ${h ?? 0}`
  const step = MONTH_STEP[spec.frequency]
  if (step) return `${at} ${spec.day} ${step === 1 ? '*' : `*/${step}`} *`
  switch (spec.frequency) {
    case 'daily':
      return `${at} * * *`
    case 'weekly':
      return `${at} * * ${spec.weekday}`
    case 'fortnightly':
      return `${at} 1,16 * *`
    case 'annual':
      return `${at} ${spec.day} ${spec.month} *`
    default:
      return null
  }
}

const DAY = /^([1-9]|1\d|2[0-8]|L)$/

/** Read a saved expression back into a spec; `custom` when it is not one of ours. */
export function parseCron(expr: string): FrequencySpec {
  const custom = { ...DEFAULT_SPEC, frequency: 'custom' as const }
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return custom
  const [min, hour, dom, mon, dow] = parts as [string, string, string, string, string]
  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour) || +min > 59 || +hour > 23) return custom
  const base = { ...DEFAULT_SPEC, time: `${hour.padStart(2, '0')}:${min.padStart(2, '0')}` }

  if (dom === '*' && mon === '*' && dow === '*') return { ...base, frequency: 'daily' }
  if (dom === '*' && mon === '*' && /^[0-6]$/.test(dow)) {
    return { ...base, frequency: 'weekly', weekday: Number(dow) }
  }
  if (dow !== '*') return custom
  if (dom === '1,16' && mon === '*') return { ...base, frequency: 'fortnightly' }
  if (!DAY.test(dom)) return custom
  if (/^([1-9]|1[0-2])$/.test(mon)) {
    return { ...base, frequency: 'annual', day: dom, month: Number(mon) }
  }
  const step = mon === '*' ? 1 : Number(/^\*\/(\d+)$/.exec(mon)?.[1])
  const frequency = (Object.keys(MONTH_STEP) as Frequency[]).find((f) => MONTH_STEP[f] === step)
  return frequency ? { ...base, frequency, day: dom } : custom
}
