import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  AUTH_USER,
  EXECUTE_RESULT,
  MAP_WITH_DETAILS,
  jsonRoute,
  makeFakeJwt,
  mockCommonApi,
  seedAuthedSession,
} from './fixtures'

type Theme = 'light' | 'dark' | 'high-contrast'

interface LocaleCase {
  code: 'pt-PT' | 'fr-FR' | 'es-ES'
  label: string
  dashboard: string
  settingsTitle: string
  treeTitle: string
  actionSave: string
  actionRun: string
}

// Native-language labels (LOCALE_LABELS in src/i18n/index.ts) plus one
// representative translated string per surface, used to assert the switch
// actually propagated rather than just re-rendering in whatever was active.
const LOCALE_CASES: LocaleCase[] = [
  {
    code: 'pt-PT',
    label: 'Português (Portugal)',
    dashboard: 'Painel',
    settingsTitle: 'Definições',
    treeTitle: 'Áreas de Negócio',
    actionSave: 'Guardar',
    actionRun: 'Executar',
  },
  {
    code: 'fr-FR',
    label: 'Français (France)',
    dashboard: 'Tableau de bord',
    settingsTitle: 'Paramètres',
    treeTitle: "Domaines d'activité",
    actionSave: 'Enregistrer',
    actionRun: 'Exécuter',
  },
  {
    code: 'es-ES',
    label: 'Español (España)',
    dashboard: 'Panel',
    settingsTitle: 'Configuración',
    treeTitle: 'Áreas de negocio',
    actionSave: 'Guardar',
    actionRun: 'Ejecutar',
  },
]

/** Mocks the user-preferences endpoints against a mutable in-memory record so
 * revisiting Settings reflects whatever was last selected, matching how a
 * real backend would echo it back. */
async function mockPreferences(page: Page, prefs: { locale: string; theme: string }) {
  await page.route('**/api/users/me/preferences', (route) => {
    if (route.request().method() === 'GET') return jsonRoute(route, { data: prefs })
    if (route.request().method() === 'PATCH') {
      Object.assign(prefs, route.request().postDataJSON())
      return jsonRoute(route, { data: prefs })
    }
    return route.continue()
  })
}

/** Seeds the localStorage keys ThemeProvider and the i18next language
 * detector each read on boot, before any app script runs. */
async function seedThemeAndLocale(page: Page, { theme, locale }: { theme: Theme; locale: string }) {
  await page.addInitScript(
    ([t, l]) => {
      window.localStorage.setItem('discoverer-neo-theme', t)
      window.localStorage.setItem('discoverer-neo-locale', l)
    },
    [theme, locale],
  )
}

test.describe('Language switching', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
  })

  test('propagates to nav, the map builder, and buttons across the app', async ({ page }) => {
    const prefs = { locale: 'en', theme: 'light' }
    await mockPreferences(page, prefs)

    for (const c of LOCALE_CASES) {
      // Each iteration is a hard navigation (page.goto), and i18next caches
      // the active language to its own localStorage key independent of the
      // account-preferences mock — so after the first switch, revisiting
      // /settings already boots in the previously-selected language rather
      // than English. Only assert the pre-switch heading on the first pass.
      await page.goto('/settings')
      if (c === LOCALE_CASES[0]) {
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      }

      await page.locator('#settings-language').click()
      await page.getByRole('option', { name: c.label }).click()
      // Keep the mock in step so the next /settings visit doesn't sync the
      // UI back to the old value via SettingsPage's preferences-sync effect.
      prefs.locale = c.code

      await expect(page.getByRole('heading', { name: c.settingsTitle })).toBeVisible()
      await expect(page.getByRole('link', { name: c.dashboard })).toBeVisible()

      await page.goto('/maps/new')
      await expect(page.getByRole('heading', { name: c.treeTitle })).toBeVisible()
      await expect(page.getByRole('button', { name: c.actionSave, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: c.actionRun, exact: true })).toBeVisible()
    }
  })

  test('persists across logout and login, not reset to the browser default', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()

    await page.getByRole('button', { name: AUTH_USER.name }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    // The login response carries the account's saved locale, and useAuth's
    // login() applies it immediately (frontend/src/hooks/useAuth.ts) — that's
    // what makes the language follow the account across a fresh sign-in
    // rather than resetting to whatever the browser/OS reports.
    await page.route('**/api/auth/login', (route) =>
      jsonRoute(route, {
        data: { token: makeFakeJwt(), user: { ...AUTH_USER, locale: 'pt-PT', theme: 'light' } },
      }),
    )
    await page.route('**/api/maps', (route) => jsonRoute(route, { data: { mine: [], shared: [] } }))

    await page.getByLabel('Email').fill(AUTH_USER.email)
    await page.getByLabel('Password').fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('link', { name: 'Painel' })).toBeVisible()
  })
})

test.describe('Theme switching', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
    await mockPreferences(page, { locale: 'en', theme: 'light' })
  })

  test('updates data-theme and computed colors, and survives a reload', async ({ page }) => {
    await page.goto('/settings')
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    for (const theme of ['dark', 'high-contrast'] as const) {
      await page.getByTestId(`theme-swatch-${theme}`).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(bg, `${theme} background should differ from light`).not.toBe(lightBg)

      // setTheme writes localStorage unconditionally (frontend/src/providers/
      // ThemeProvider.tsx), independent of whether the account-sync PATCH
      // succeeds — a reload should still resolve to the same theme from there.
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    }
  })
})

test.describe('Theme switching — OS preference', () => {
  test.use({ colorScheme: 'dark' })

  test('a fresh session with no saved preference opens in the dark theme', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('Missing translation fallback', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
    await mockPreferences(page, { locale: 'en', theme: 'light' })
  })

  test('falls back to the English string rather than the raw key or crashing', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.goto('/settings')
    await page.locator('#settings-language').click()
    await page.getByRole('option', { name: 'Español (España)' }).click()
    await expect(page.getByRole('heading', { name: 'Tema' })).toBeVisible()

    // Delete the es-ES translation for a live, currently-rendered key at
    // runtime — no locale JSON file is touched — then cycle the language so
    // react-i18next re-renders bound components against the new resource
    // state. `window.__i18n` is a dev-only test hook (see src/i18n/index.ts).
    await page.evaluate(async () => {
      const i18n = (
        window as unknown as {
          __i18n: { store: { data: Record<string, Record<string, unknown>> }; changeLanguage: (lng: string) => Promise<unknown> }
        }
      ).__i18n
      delete i18n.store.data['es-ES'].settings.theme.title
      await i18n.changeLanguage('en')
      await i18n.changeLanguage('es-ES')
    })

    await expect(page.getByRole('heading', { name: 'Theme', exact: true })).toBeVisible()
    await expect(page.getByText('theme.title')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
})

test.describe('Contrast — theme sweep', () => {
  const AXE_TAGS = ['wcag2a', 'wcag2aa']

  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
  })

  for (const theme of ['light', 'dark', 'high-contrast'] as const) {
    test(`login page meets WCAG AA in ${theme}`, async ({ page }) => {
      await seedThemeAndLocale(page, { theme, locale: 'en' })
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Discoverer Neo' })).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })

    test(`dashboard meets WCAG AA in ${theme}`, async ({ page }) => {
      await seedThemeAndLocale(page, { theme, locale: 'en' })
      await page.goto('/dashboard')
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })

    test(`map builder meets WCAG AA in ${theme}`, async ({ page }) => {
      await seedThemeAndLocale(page, { theme, locale: 'en' })
      await page.goto('/maps/new')
      await expect(page.getByRole('heading', { name: 'Business Areas' })).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })
  }
})

test.describe('Visual regression — theme x locale', () => {
  const THEMES = ['light', 'dark', 'high-contrast'] as const
  const LOCALES = ['en', 'pt-PT'] as const
  const RUN_LABEL: Record<(typeof LOCALES)[number], string> = { en: 'Run', 'pt-PT': 'Executar' }

  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/execute`, (route) => jsonRoute(route, { data: EXECUTE_RESULT }))
  })

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`dashboard — ${theme} — ${locale}`, async ({ page }) => {
        await seedThemeAndLocale(page, { theme, locale })
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: `e2e/screenshots/theming/dashboard-${theme}-${locale}.png`, fullPage: true })
      })

      test(`map builder — ${theme} — ${locale}`, async ({ page }) => {
        await seedThemeAndLocale(page, { theme, locale })
        await page.goto('/maps/new')
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: `e2e/screenshots/theming/map-builder-${theme}-${locale}.png`, fullPage: true })
      })

      test(`map viewer with results — ${theme} — ${locale}`, async ({ page }) => {
        await seedThemeAndLocale(page, { theme, locale })
        await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
        await page.getByRole('button', { name: RUN_LABEL[locale], exact: true }).click()
        await expect(page.getByText('Acme Corp')).toBeVisible()
        await page.screenshot({
          path: `e2e/screenshots/theming/map-viewer-results-${theme}-${locale}.png`,
          fullPage: true,
        })
      })

      test(`settings — ${theme} — ${locale}`, async ({ page }) => {
        await seedThemeAndLocale(page, { theme, locale })
        await mockPreferences(page, { locale, theme })
        await page.goto('/settings')
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: `e2e/screenshots/theming/settings-${theme}-${locale}.png`, fullPage: true })
      })
    }
  }
})
