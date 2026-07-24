import { test, expect } from '@playwright/test'
import { MAP_WITH_DETAILS, jsonRoute, mockCommonApi, seedAuthedSession } from './fixtures'

const VIEWPORTS = [
  { name: '1280', width: 1280, height: 800 },
  { name: '1920', width: 1920, height: 1080 },
]

const PAGES: { path: string; name: string }[] = [
  { path: '/login', name: 'login' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/admin/business-areas', name: 'admin-business-areas' },
  { path: `/maps/${MAP_WITH_DETAILS.id}/view`, name: 'map-viewer' },
]

test.describe('Visual — responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
  })

  for (const viewport of VIEWPORTS) {
    for (const { path, name } of PAGES) {
      test(`${name} renders without horizontal overflow at ${viewport.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(path)
        await page.waitForLoadState('networkidle')

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${name} at ${viewport.width}px has horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(1)

        await page.screenshot({
          path: `e2e/screenshots/${name}-${viewport.name}.png`,
          fullPage: true,
        })
      })
    }
  }

  test('sidebar disappears without a mobile drawer below md breakpoint (known gap)', async ({ page }) => {
    // Documents a pre-existing, out-of-scope issue (Sidebar.tsx is `hidden md:flex`
    // with no responsive drawer) rather than papering over it — narrow viewports
    // lose all navigation entirely instead of getting a collapsed/hamburger menu.
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden()
  })
})

test.describe('Visual — dark mode CSS wiring', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
  })

  test('the [data-theme="dark"] token set is wired up', async ({ page }) => {
    // Themes are selected via a `data-theme` attribute (see the note atop
    // frontend/src/index.css), not a `.dark` class — this only checks the CSS
    // wiring directly. Driving the switch through the real Settings UI is
    // covered end-to-end by e2e/i18n-theming.spec.ts.
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    expect(darkBg).not.toBe(lightBg)
    await page.screenshot({ path: 'e2e/screenshots/dashboard-dark-manual.png', fullPage: true })
  })
})
