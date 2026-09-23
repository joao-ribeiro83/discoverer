import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatExpiresIn } from '@/lib/format'

// formatExpiresIn's branches: null input, already-expired, minutes, hours,
// and days — each picks a different translation key.

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key

describe('formatExpiresIn', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "" for a null/invalid date', () => {
    expect(formatExpiresIn(null, t)).toBe('')
    expect(formatExpiresIn('not-a-date', t)).toBe('')
  })

  it('returns the expired key once the time has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    expect(formatExpiresIn('2026-01-01T11:00:00Z', t)).toBe('runs:expired')
    // Exactly now also counts as expired (diffMs <= 0).
    expect(formatExpiresIn('2026-01-01T12:00:00Z', t)).toBe('runs:expired')
  })

  it('formats under an hour as minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    expect(formatExpiresIn('2026-01-01T12:30:00Z', t)).toBe('runs:expiresInMinutes:{"count":30}')
  })

  it('formats under a day as hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    expect(formatExpiresIn('2026-01-01T15:00:00Z', t)).toBe('runs:expiresInHours:{"count":3}')
  })

  it('formats a day or more as days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    expect(formatExpiresIn('2026-01-03T12:00:00Z', t)).toBe('runs:expiresInDays:{"count":2}')
  })
})
