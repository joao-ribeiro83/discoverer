import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { ToastProvider } from '@/components/ui/toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/providers/ThemeProvider'
import '@/i18n'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost and router-independent: applies data-theme before anything
        else renders, and only needs the (non-context) auth store, which is
        readable regardless of nesting depth. */}
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Suspense fallback={null}>
              <App />
            </Suspense>
            <Toaster />
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
