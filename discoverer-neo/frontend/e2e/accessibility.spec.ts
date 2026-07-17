import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { MAP_SUMMARY, jsonRoute, mockCommonApi, seedAuthedSession } from './fixtures'

const AXE_TAGS = ['wcag2a', 'wcag2aa']

const PAGES: { path: string; heading: string }[] = [
  { path: '/dashboard', heading: 'Welcome' },
  { path: '/admin/folders', heading: 'Folders' },
  { path: '/admin/items', heading: 'Items' },
  { path: '/admin/joins', heading: 'Joins' },
  { path: '/admin/hierarchies', heading: 'Hierarchies' },
  { path: '/admin/custom-functions', heading: 'Custom Functions' },
  { path: '/admin/users', heading: 'Users' },
  { path: '/maps', heading: 'Maps' },
  { path: '/schedules', heading: 'Schedules' },
]

test.describe('Accessibility sweep', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockCommonApi(page)
    await page.route('**/api/custom-functions', (route) => jsonRoute(route, { data: [] }))
    await page.route('**/api/users', (route) => jsonRoute(route, { data: [] }))
    await page.route('**/api/schedules', (route) => jsonRoute(route, { data: [] }))
    await page.route('**/api/business-areas/*/maps', (route) => jsonRoute(route, { data: [MAP_SUMMARY] }))
  })

  for (const { path, heading } of PAGES) {
    test(`${path} has no detectable accessibility violations`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: new RegExp(heading) }).first()).toBeVisible()

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })
  }

  test('sidebar navigation is fully keyboard-reachable', async ({ page }) => {
    await page.goto('/dashboard')

    const dashboardLink = page.getByRole('link', { name: 'Dashboard' })
    await dashboardLink.focus()
    await expect(dashboardLink).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Business Areas' })).toBeFocused()
  })
})
