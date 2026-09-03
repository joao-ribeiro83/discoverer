import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  PaletteProvider,
  usePalette,
  PALETTE_STORAGE_KEY,
  type ColorPalette,
} from '@/providers/PaletteProvider'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiClient: {
    users: {
      updatePreferences: vi.fn(),
    },
  },
}))

const mockedApiClient = vi.mocked(apiClient, true)

function resetAuthStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    hasHydrated: true,
  })
}

function Consumer() {
  const { palette, setPalette } = usePalette()
  return (
    <div>
      <span data-testid="palette">{palette}</span>
      <button onClick={() => void setPalette('default')}>default</button>
      <button onClick={() => void setPalette('navy')}>navy</button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthStore()
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-palette')
})

afterEach(() => {
  document.documentElement.removeAttribute('data-palette')
})

describe('PaletteProvider', () => {
  it('defaults to navy with no saved preference', async () => {
    render(
      <PaletteProvider>
        <Consumer />
      </PaletteProvider>
    )

    await waitFor(() => expect(document.documentElement.getAttribute('data-palette')).toBe('navy'))
    expect(screen.getByTestId('palette')).toHaveTextContent('navy')
  })

  it('applies data-palette on document.documentElement and updates it on switch', async () => {
    render(
      <PaletteProvider>
        <Consumer />
      </PaletteProvider>
    )

    await waitFor(() => expect(document.documentElement.getAttribute('data-palette')).toBe('navy'))

    fireEvent.click(screen.getByText('default'))

    await waitFor(() => expect(document.documentElement.getAttribute('data-palette')).toBe('default'))
    expect(screen.getByTestId('palette')).toHaveTextContent('default')
  })

  it('an explicit localStorage preference overrides the navy default', async () => {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, 'default')

    render(
      <PaletteProvider>
        <Consumer />
      </PaletteProvider>
    )

    await waitFor(() => expect(screen.getByTestId('palette')).toHaveTextContent('default'))
    expect(document.documentElement.getAttribute('data-palette')).toBe('default')
  })

  it("an authenticated user's saved account palette overrides the navy default", async () => {
    useAuthStore.setState({
      user: { id: '1', email: 'jane@example.com', name: 'Jane', role: 'USER', colorPalette: 'default' },
      token: 'fake.jwt.token',
      isAuthenticated: true,
      hasHydrated: true,
    })

    render(
      <PaletteProvider>
        <Consumer />
      </PaletteProvider>
    )

    await waitFor(() => expect(screen.getByTestId('palette')).toHaveTextContent('default'))
    expect(document.documentElement.getAttribute('data-palette')).toBe('default')
  })

  it('persists a palette change via apiClient.users.updatePreferences when authenticated', async () => {
    useAuthStore.setState({
      user: { id: '1', email: 'jane@example.com', name: 'Jane', role: 'USER' },
      token: 'fake.jwt.token',
      isAuthenticated: true,
      hasHydrated: true,
    })
    mockedApiClient.users.updatePreferences.mockResolvedValueOnce({
      data: { data: { locale: 'en', theme: 'light', colorPalette: 'default' as ColorPalette } },
    } as never)

    render(
      <PaletteProvider>
        <Consumer />
      </PaletteProvider>
    )

    fireEvent.click(screen.getByText('default'))

    await waitFor(() =>
      expect(mockedApiClient.users.updatePreferences).toHaveBeenCalledWith({ colorPalette: 'default' })
    )
    expect(window.localStorage.getItem(PALETTE_STORAGE_KEY)).toBe('default')
  })
})
