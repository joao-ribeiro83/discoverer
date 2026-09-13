import { describe, it, expect, vi, afterEach } from 'vitest'
import { useAuthStore, setRememberMe } from '@/store/auth'

describe('auth store persistence', () => {
  afterEach(() => {
    setRememberMe(true)
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('persists to localStorage when "remember me" is on', () => {
    setRememberMe(true)
    useAuthStore.getState().login({ id: 'u1', email: 'a@b.com', name: 'A', role: 'ADMIN' }, 'tok', 'ref')
    expect(window.localStorage.getItem('auth-storage')).toContain('"token":"tok"')
    expect(window.sessionStorage.getItem('auth-storage')).toBeNull()
  })

  it('persists to sessionStorage when "remember me" is off', () => {
    setRememberMe(false)
    useAuthStore.getState().login({ id: 'u1', email: 'a@b.com', name: 'A', role: 'ADMIN' }, 'tok2', 'ref2')
    expect(window.sessionStorage.getItem('auth-storage')).toContain('"token":"tok2"')
    expect(window.localStorage.getItem('auth-storage')).toBeNull()
  })

  it('rehydrates this tab when another tab rotates the auth-storage key', () => {
    const rehydrate = vi.spyOn(useAuthStore.persist, 'rehydrate').mockResolvedValue(undefined)

    window.dispatchEvent(new StorageEvent('storage', { key: 'auth-storage' }))
    expect(rehydrate).toHaveBeenCalled()

    rehydrate.mockClear()
    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }))
    expect(rehydrate).not.toHaveBeenCalled()

    rehydrate.mockRestore()
  })
})
