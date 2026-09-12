import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: string
  // Present since Session 7.1 — the backend returns these on login and /me.
  locale?: string
  theme?: string
  // Independent of theme — see PaletteProvider.
  colorPalette?: string
  /**
   * True for an account provisioned with a temporary password. The API refuses
   * every route except change-password/me/logout until it is cleared, so the
   * client must route to the change screen rather than the dashboard.
   */
  mustChangePassword?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  /** Works once: every refresh returns a replacement and kills this one. */
  refreshToken: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  login: (user: User, token: string, refreshToken: string) => void
  /** Update the cached user, e.g. after clearing mustChangePassword. */
  setUser: (user: User) => void
  logout: () => void
  setTokens: (token: string, refreshToken: string) => void
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
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      setUser: (user) => {
        set({ user })
      },
      login: (user, token, refreshToken) => {
        set({ user, token, refreshToken, isAuthenticated: true })
      },
      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => dynamicStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Tabs share one persisted session. When another tab rotates the refresh
// token, this tab's copy is dead — pick up the replacement instead of logging
// out on the next refresh.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'auth-storage') void useAuthStore.persist.rehydrate()
  })
}
