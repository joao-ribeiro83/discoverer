import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword === true)
  const location = useLocation()

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Checking authentication">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // An account provisioned with a temporary password can reach nothing else —
  // the API returns 403 PASSWORD_CHANGE_REQUIRED for every other route — so
  // send it straight to the change screen instead of a wall of failed requests.
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

/**
 * Mirrors the sidebar's role gates on the routes themselves, so a typed
 * `/admin/...` URL lands on the dashboard instead of a page of 403s. The
 * server still decides; this only saves the wasted trip.
 */
export function RequireRole({ roles }: { roles: readonly string[] }) {
  const role = useAuthStore((s) => s.user?.role)
  return role && roles.includes(role) ? <Outlet /> : <Navigate to="/dashboard" replace />
}
