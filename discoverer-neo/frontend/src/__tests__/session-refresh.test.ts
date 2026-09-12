import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, refreshSession } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// A refresh token works once. Two refreshes racing with the same token would
// spend it twice, and the loser would log the user out.

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: 'old.jwt.token',
    refreshToken: 'sid.r1',
    isAuthenticated: true,
    hasHydrated: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('refreshSession', () => {
  it('sends one request for concurrent callers and stores the rotated pair', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ data: { data: { token: 'new.jwt.token', refreshToken: 'sid.r2' } } })

    const results = await Promise.all([refreshSession(), refreshSession()])

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'sid.r1' })
    expect(results).toEqual(['new.jwt.token', 'new.jwt.token'])
    expect(useAuthStore.getState()).toMatchObject({ token: 'new.jwt.token', refreshToken: 'sid.r2' })
  })

  it('refuses without a refresh token rather than calling the server', async () => {
    useAuthStore.setState({ refreshToken: null })
    const post = vi.spyOn(api, 'post')

    await expect(refreshSession()).rejects.toThrow('No refresh token')
    expect(post).not.toHaveBeenCalled()
  })
})
