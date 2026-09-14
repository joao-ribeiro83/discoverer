import { describe, it, expect } from 'vitest'
import { getTokenExpiryMs } from '@/lib/jwt'

function makeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'none' })}.${base64url(payload)}.sig`
}

describe('getTokenExpiryMs', () => {
  it('returns the exp claim in epoch milliseconds', () => {
    expect(getTokenExpiryMs(makeToken({ exp: 1700000000 }))).toBe(1700000000 * 1000)
  })

  it('returns null for a token that is not three dot-separated parts', () => {
    expect(getTokenExpiryMs('not-a-jwt')).toBeNull()
  })

  it('returns null for a token whose payload is not valid base64/JSON', () => {
    expect(getTokenExpiryMs('a.not-valid-base64!!!.c')).toBeNull()
  })

  it('returns null when the exp claim is missing or not a number', () => {
    expect(getTokenExpiryMs(makeToken({ sub: 'u1' }))).toBeNull()
    expect(getTokenExpiryMs(makeToken({ exp: '1700000000' }))).toBeNull()
  })
})
