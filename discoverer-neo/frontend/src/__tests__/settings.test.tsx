import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { SettingsPage } from '@/pages/SettingsPage'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PaletteProvider } from '@/providers/PaletteProvider'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import i18n from '@/i18n'

vi.mock('@/lib/api', () => ({
  apiClient: {
    users: {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    },
  },
  getErrorMessage: (err: unknown) => (err as { message?: string } | undefined)?.message ?? 'error',
}))

const toastMock = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

const mockedApi = vi.mocked(apiClient, true)

function envelope<T>(data: T) {
  return { data: { data } }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <PaletteProvider>{children}</PaletteProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
  return render(<SettingsPage />, { wrapper })
}

beforeEach(async () => {
  vi.clearAllMocks()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-palette')
  useAuthStore.setState({
    user: { id: '1', email: 'jane@example.com', name: 'Jane', role: 'USER', locale: 'en', theme: 'light' },
    token: 'fake.jwt.token',
    isAuthenticated: true,
    hasHydrated: true,
  })
  await i18n.changeLanguage('en')
  mockedApi.users.getPreferences.mockResolvedValue(
    envelope({ locale: 'en', theme: 'light', colorPalette: 'navy' }) as never,
  )
})

describe('SettingsPage', () => {
  it('renders the current preferences on load', async () => {
    mockedApi.users.getPreferences.mockResolvedValue(
      envelope({ locale: 'fr-FR', theme: 'dark', colorPalette: 'default' }) as never,
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('Français (France)')).toBeInTheDocument())
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    expect(screen.getByTestId('theme-swatch-dark')).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(document.documentElement.getAttribute('data-palette')).toBe('default'))
    expect(screen.getByTestId('palette-swatch-default')).toHaveAttribute('aria-pressed', 'true')
  })

  it('changing the language updates displayed text immediately', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Save' })

    fireEvent.click(screen.getByLabelText('Display language'))
    fireEvent.click(await screen.findByText('Français (France)'))

    // common:actions.save has a real fr-FR translation ("Enregistrer") —
    // the Save button switching to it proves the whole page re-rendered in
    // the new language immediately, with no reload or save required.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument())
  })

  it('changing the theme updates data-theme immediately', async () => {
    renderPage()
    await screen.findByTestId('theme-swatch-dark')

    fireEvent.click(screen.getByTestId('theme-swatch-dark'))

    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    expect(screen.getByTestId('theme-swatch-dark')).toHaveAttribute('aria-pressed', 'true')
  })

  it('save calls the preferences API and shows a success toast', async () => {
    mockedApi.users.updatePreferences.mockResolvedValue(
      envelope({ locale: 'en', theme: 'dark', colorPalette: 'navy' }) as never,
    )
    renderPage()
    await screen.findByTestId('theme-swatch-dark')

    fireEvent.click(screen.getByTestId('theme-swatch-dark'))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedApi.users.updatePreferences).toHaveBeenCalledWith({
        locale: 'en',
        theme: 'dark',
        colorPalette: 'navy',
      }),
    )
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Preferences saved' }))
  })

  it('changing the palette updates data-palette immediately and saves it', async () => {
    mockedApi.users.updatePreferences.mockResolvedValue(
      envelope({ locale: 'en', theme: 'light', colorPalette: 'default' }) as never,
    )
    renderPage()
    await screen.findByTestId('palette-swatch-default')

    fireEvent.click(screen.getByTestId('palette-swatch-default'))

    await waitFor(() => expect(document.documentElement.getAttribute('data-palette')).toBe('default'))
    expect(screen.getByTestId('palette-swatch-default')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mockedApi.users.updatePreferences).toHaveBeenCalledWith({
        locale: 'en',
        theme: 'light',
        colorPalette: 'default',
      }),
    )
  })

  it('disables the palette picker while High contrast is selected', async () => {
    renderPage()
    await screen.findByTestId('theme-swatch-high-contrast')

    fireEvent.click(screen.getByTestId('theme-swatch-high-contrast'))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast'))

    expect(screen.getByTestId('palette-swatch-navy')).toBeDisabled()
    expect(screen.getByTestId('palette-swatch-default')).toBeDisabled()
  })

  it('shows an error toast on save failure and keeps the unsaved selection', async () => {
    mockedApi.users.updatePreferences.mockRejectedValue(new Error('Network error'))
    renderPage()
    await screen.findByTestId('theme-swatch-high-contrast')

    fireEvent.click(screen.getByTestId('theme-swatch-high-contrast'))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast'))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    )
    // The failed save must not revert the selection already applied live.
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')
    expect(screen.getByTestId('theme-swatch-high-contrast')).toHaveAttribute('aria-pressed', 'true')
  })
})
