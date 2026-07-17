import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api'
import { getTokenExpiryMs } from '@/lib/jwt'

const REFRESH_CHECK_INTERVAL_MS = 60 * 1000
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const refreshingRef = useRef(false)

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await apiClient.auth.login(email, password)
      const { token, user } = response.data.data
      useAuthStore.getState().login(user, token)
      return user
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.auth.logout()
    } catch {
      // best-effort — clear local state regardless of the server response
    } finally {
      useAuthStore.getState().logout()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return null
    const currentToken = useAuthStore.getState().token
    if (!currentToken) return null

    refreshingRef.current = true
    try {
      const response = await apiClient.auth.refresh(currentToken)
      const { token: newToken } = response.data.data
      useAuthStore.getState().setToken(newToken)
      return newToken
    } finally {
      refreshingRef.current = false
    }
  }, [])

  // Proactively refresh the token before it expires; force logout on failure.
  useEffect(() => {
    if (!isAuthenticated) return

    const checkAndRefresh = async () => {
      const currentToken = useAuthStore.getState().token
      if (!currentToken) return

      const expiryMs = getTokenExpiryMs(currentToken)
      if (expiryMs === null || expiryMs - Date.now() >= REFRESH_THRESHOLD_MS) return

      try {
        await refresh()
      } catch {
        useAuthStore.getState().logout()
        void navigate('/login', {
          replace: true,
          state: { message: 'Your session has expired. Please sign in again.' },
        })
      }
    }

    void checkAndRefresh()
    const interval = setInterval(() => void checkAndRefresh(), REFRESH_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isAuthenticated, refresh, navigate])

  return { user, token, isAuthenticated, isLoading, login, logout, refresh }
}

export function useRequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const navigate = useNavigate()

  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      void navigate('/login', { replace: true })
    }
  }, [hasHydrated, isAuthenticated, navigate])

  return { isAuthenticated, isLoading: !hasHydrated }
}
