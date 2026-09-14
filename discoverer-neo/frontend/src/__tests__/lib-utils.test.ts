import { describe, it, expect } from 'vitest'
import { formatDate } from '@/lib/utils'

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2026-07-18')).toContain('2026')
  })

  it('formats a Date object the same way', () => {
    expect(formatDate(new Date('2026-07-18'))).toContain('2026')
  })
})
