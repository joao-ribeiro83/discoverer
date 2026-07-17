import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setToken: (token: string) => void
  setHasHydrated: (hydrated: boolean) => void
}

// "Remember me" toggles whether the session survives a browser restart
// (localStorage) or is cleared when the tab closes (sessionStorage). The
// backend issues a fixed-lifetime JWT (config.JWT_EXPIRES_IN) regardless of
// this flag, so it does not extend token expiry — only where the session
// itself is persisted.
let rememberMe = true

export function setRememberMe(remember: boolean) {
  rememberMe = remember
}

const dynamicStorage: StateStorage = {
  getItem: (name) => (rememberMe ? window.localStorage : window.sessionStorage).getItem(name),
  setItem: (name, value) =>
    (rememberMe ? window.localStorage : window.sessionStorage).setItem(name, value),
  removeItem: (name) => {
    window.localStorage.removeItem(name)
    window.sessionStorage.removeItem(name)
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (user, token) => {
        set({ user, token, isAuthenticated: true })
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },
      setToken: (token) => set({ token }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => dynamicStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
