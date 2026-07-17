import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { EXECUTE_RESULT, MAP_WITH_DETAILS, jsonRoute, seedAuthedSession } from './fixtures'

const PARAM_MAP = {
  ...MAP_WITH_DETAILS,
  parameters: [
    {
      id: 'param-1',
      mapId: MAP_WITH_DETAILS.id,
      name: 'MIN_TOTAL',
      paramType: 'NUMBER' as const,
      defaultValue: null,
      isRequired: true,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ],
}

test.describe('Map Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
  })

  test('views a saved map and executes it with default parameters', async ({ page }) => {
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/execute`, (route) =>
      jsonRoute(route, { data: EXECUTE_RESULT }),
    )

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)

    await expect(page.getByRole('heading', { name: MAP_WITH_DETAILS.name })).toBeVisible()
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    await expect(page.getByText('Map executed').first()).toBeVisible()
    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('Globex Inc')).toBeVisible()
  })

  test('prompts for a required parameter before executing', async ({ page }) => {
    await page.route(`**/api/maps/${PARAM_MAP.id}`, (route) => jsonRoute(route, { data: PARAM_MAP }))
    await page.route(`**/api/maps/${PARAM_MAP.id}/execute`, (route) => {
      const body = route.request().postDataJSON()
      expect(body.parameters).toEqual({ MIN_TOTAL: '1000' })
      return jsonRoute(route, { data: EXECUTE_RESULT })
    })

    await page.goto(`/maps/${PARAM_MAP.id}/view`)
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('MIN_TOTAL').fill('1000')
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()

    await expect(page.getByText('Map executed').first()).toBeVisible()
  })

  test('shows a not-found state for a missing map', async ({ page }) => {
    await page.route('**/api/maps/missing-map', (route) => jsonRoute(route, { error: 'Map not found' }, 404))

    await page.goto('/maps/missing-map/view')

    // react-query's default retries delay isError beyond the default assertion timeout.
    await expect(page.getByRole('heading', { name: 'Map not found' })).toBeVisible({ timeout: 15_000 })
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
    await expect(page.getByRole('heading', { name: MAP_WITH_DETAILS.name })).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
