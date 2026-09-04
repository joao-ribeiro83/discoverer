import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Loader2 } from 'lucide-react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PaletteProvider } from '@/providers/PaletteProvider'
import i18n from '@/i18n'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

/** Shown while the initial route chunk downloads — never a blank screen. */
function AppFallback() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      {i18n.t('common:states.loading')}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost and router-independent: applies data-theme/data-palette
        before anything else renders, and only needs the (non-context) auth
        store, which is readable regardless of nesting depth. */}
    <ThemeProvider>
      <PaletteProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              {/* Inside ToastProvider so the fallback can still reach the
                  toast context if a recovery action needs it, and outside
                  <App /> so a throw in any route lands here rather than
                  white-screening the document. */}
              <ErrorBoundary scope="app">
                <Suspense fallback={<AppFallback />}>
                  <App />
                </Suspense>
              </ErrorBoundary>
              <Toaster />
            </ToastProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </PaletteProvider>
    </ThemeProvider>
  </StrictMode>
)
