import { test, expect } from '@playwright/test'
import { BUSINESS_AREA, FOLDER, jsonRoute, seedAuthedSession } from './fixtures'

test.describe('Admin — Hierarchies', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA] }))
    await page.route(`**/api/business-areas/${BUSINESS_AREA.id}/folders`, (route) =>
      jsonRoute(route, { data: [FOLDER] }),
    )
    await page.route(`**/api/business-areas/${BUSINESS_AREA.id}/hierarchies`, (route) =>
      jsonRoute(route, { data: [] }),
    )
  })

  test('supports picking up a hierarchy level via the keyboard (WCAG 2.5.7 non-drag equivalent)', async ({
    page,
  }) => {
    await page.goto('/admin/hierarchies')

    await page.getByLabel('Business Area').click()
    await page.getByRole('option', { name: BUSINESS_AREA.name }).click()

    await page.getByRole('button', { name: 'New Hierarchy' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Add Level' }).click()
    await dialog.getByRole('button', { name: 'Add Level' }).click()

    const grips = dialog.getByRole('button', { name: 'Reorder level' })
    await expect(grips).toHaveCount(2)

    // This DndContext lives inside a Radix Dialog, whose own Escape handler
    // closes the dialog — so (unlike the standalone map-builder canvas) we
    // only assert pickup here, matching the panel-embedded tests in
    // map-builder.spec.ts (Sort/Calculated Fields) which do the same.
    const liveRegion = page.locator('[id^="DndLiveRegion"]')
    await grips.first().focus()
    await page.keyboard.press('Space')
    await expect(liveRegion).toContainText(/picked up|moved over/i)
  })
})
