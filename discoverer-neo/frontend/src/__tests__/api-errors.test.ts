import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  api,
  getErrorMessage,
  getErrorKind,
  getRefusalCode,
  getRefusalDetails,
} from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import i18n from '@/i18n'

// Fake axios errors — isAxiosError() only checks `isAxiosError === true` on a
// truthy object, so no real HTTP mock is needed (per src/lib/api.ts's own
// isAxiosError<T> usage). Built on a real Error so the response interceptor's
// final `error instanceof Error ? error : new Error(...)` passes it through
// unwrapped, matching what axios itself throws.
function axiosError(response?: { status?: number; data?: unknown }, config?: unknown) {
  return Object.assign(new Error('mock axios error'), { isAxiosError: true, response, config })
}

describe('getErrorMessage', () => {
  it('returns the fallback for a non-axios error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe(i18n.t('errors:generic'))
  })

  it('returns a caller-supplied fallback for a non-axios error', () => {
    expect(getErrorMessage('not an error', 'custom fallback')).toBe('custom fallback')
  })

  it('returns the network message when there is no response', () => {
    expect(getErrorMessage(axiosError(undefined))).toBe(i18n.t('errors:network'))
  })

  it('returns the fallback when the response has no data', () => {
    expect(getErrorMessage(axiosError({ status: 500, data: undefined }))).toBe(
      i18n.t('errors:generic')
    )
  })

  it('returns the fallback when the response data has no error field', () => {
    expect(getErrorMessage(axiosError({ status: 500, data: {} }))).toBe(i18n.t('errors:generic'))
  })

  it('returns the server message as-is when it is not an Oracle error', () => {
    const err = axiosError({ status: 400, data: { error: 'Name is required' } })
    expect(getErrorMessage(err)).toBe('Name is required')
  })

  it('redacts an ORA- error and reports the kind translation (SEC-07)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = axiosError({
      status: 500,
      data: { error: 'ORA-01017: invalid username/password', kind: 'CONNECT' },
    })
    expect(getErrorMessage(err)).toBe(i18n.t('errors:execution.CONNECT'))
    expect(spy).toHaveBeenCalledWith(
      '[api] suppressed Oracle error detail:',
      'ORA-01017: invalid username/password'
    )
    spy.mockRestore()
  })

  it('falls back when an ORA- error carries no kind', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = axiosError({ status: 500, data: { error: 'ORA-00942: table or view does not exist' } })
    expect(getErrorMessage(err)).toBe(i18n.t('errors:generic'))
    spy.mockRestore()
  })

  it('does not treat a too-short ORA code as an Oracle error', () => {
    // The regex requires 3-5 digits; "ORA-12" (2 digits) must not match.
    const err = axiosError({ status: 500, data: { error: 'ORA-12 is not a real code' } })
    expect(getErrorMessage(err)).toBe('ORA-12 is not a real code')
  })
})

describe('getErrorKind', () => {
  it('returns undefined for a non-axios error', () => {
    expect(getErrorKind(new Error('boom'))).toBeUndefined()
  })

  it('returns undefined when there is no response', () => {
    expect(getErrorKind(axiosError(undefined))).toBeUndefined()
  })

  it('returns undefined when the response data has no kind', () => {
    expect(getErrorKind(axiosError({ status: 500, data: {} }))).toBeUndefined()
  })

  it('returns the kind when present', () => {
    expect(getErrorKind(axiosError({ status: 500, data: { kind: 'TIMEOUT' } }))).toBe('TIMEOUT')
  })
})

describe('getRefusalCode', () => {
  it('returns undefined for a non-axios error', () => {
    expect(getRefusalCode({ some: 'object' })).toBeUndefined()
  })

  it('returns undefined when there is no response', () => {
    expect(getRefusalCode(axiosError(undefined))).toBeUndefined()
  })

  it('returns undefined when the response data has no code', () => {
    expect(getRefusalCode(axiosError({ status: 422, data: {} }))).toBeUndefined()
  })

  it('returns the code when present', () => {
    expect(getRefusalCode(axiosError({ status: 422, data: { code: 'NO_JOIN_PATH' } }))).toBe(
      'NO_JOIN_PATH'
    )
  })
})

describe('getRefusalDetails', () => {
  it('returns undefined for a non-axios error', () => {
    expect(getRefusalDetails(null)).toBeUndefined()
  })

  it('returns undefined when there is no response', () => {
    expect(getRefusalDetails(axiosError(undefined))).toBeUndefined()
  })

  it('returns undefined when the response data has no details', () => {
    expect(getRefusalDetails(axiosError({ status: 422, data: {} }))).toBeUndefined()
  })

  it('returns the details object when present', () => {
    const details = { folders: ['Orders', 'Customers'] }
    expect(getRefusalDetails(axiosError({ status: 422, data: { details } }))).toBe(details)
  })
})

// The response interceptor's rejected handler, reached via axios's internal
// handlers list rather than a real HTTP round trip (session-refresh.test.ts
// uses the same real-store-plus-spy approach for refreshSession itself).
const rejectedHandler = (
  api.interceptors.response as unknown as {
    handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>
  }
).handlers[0].rejected

describe('response interceptor (401 handling)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: 'old.jwt.token',
      refreshToken: 'sid.r1',
      isAuthenticated: true,
      hasHydrated: true,
    })
    vi.stubGlobal('location', { ...window.location, href: '' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('passes through a non-401 error unchanged', async () => {
    const err = axiosError({ status: 500, data: {} }, { url: '/maps' })
    await expect(rejectedHandler(err)).rejects.toBe(err)
  })

  it('wraps a non-Error rejection reason in an Error', async () => {
    await expect(rejectedHandler('plain string failure')).rejects.toThrow('plain string failure')
  })

  it('does not intervene on a self-handled auth path (e.g. /auth/login)', async () => {
    const logout = vi.spyOn(useAuthStore.getState(), 'logout')
    const err = axiosError({ status: 401, data: {} }, { url: '/auth/login' })
    await expect(rejectedHandler(err)).rejects.toBe(err)
    expect(logout).not.toHaveBeenCalled()
  })

  it('logs out and redirects on 401 with no refresh token', async () => {
    useAuthStore.setState({ refreshToken: null })
    const err = axiosError({ status: 401, data: {} }, { url: '/maps' })

    await expect(rejectedHandler(err)).rejects.toBe(err)

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.location.href).toBe('/login')
  })

  it('logs out and redirects when the request was already retried once', async () => {
    const err = axiosError({ status: 401, data: {} }, { url: '/maps', _retried: true })

    await expect(rejectedHandler(err)).rejects.toBe(err)

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.location.href).toBe('/login')
  })

  it('attempts a refresh, and logs out when the refresh itself fails', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new Error('refresh token expired'))
    const err = axiosError({ status: 401, data: {} }, { url: '/maps' })

    await expect(rejectedHandler(err)).rejects.toBe(err)

    expect(post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'sid.r1' })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(window.location.href).toBe('/login')
  })

  it('refreshes and retries the original request once on success', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { data: { token: 'new.jwt.token', refreshToken: 'sid.r2' } },
    })
    // Public, supported override — not reaching into axios's private request
    // internals — so the retried `api(config)` resolves without a real
    // network call.
    const adapter = vi.fn().mockResolvedValue({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })
    api.defaults.adapter = adapter

    const config = { url: '/maps', headers: {} }
    const err = axiosError({ status: 401, data: {} }, config)

    const result = (await rejectedHandler(err)) as { data: unknown }

    expect(useAuthStore.getState().token).toBe('new.jwt.token')
    expect(config).toMatchObject({ _retried: true })
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(result.data).toEqual({ data: [] })
  })
})
