import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function RouteFallback() {
  const { t } = useTranslation('nav')
  return (
    <div
      className="flex h-64 items-center justify-center text-muted-foreground"
      role="status"
      aria-label={t('loadingPage')}
    >
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
