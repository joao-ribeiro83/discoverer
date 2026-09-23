import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { MAP_WITH_DETAILS, QUEUED_RUN, jsonRoute, mockMapRunFlow, seedAuthedSession } from './fixtures'

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

  test('views a saved map and runs it with default parameters', async ({ page }) => {
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
    await mockMapRunFlow(page)

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)

    await expect(page.getByRole('heading', { name: MAP_WITH_DETAILS.name })).toBeVisible()
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('Globex Inc')).toBeVisible()
  })

  test('prompts for a required parameter before running', async ({ page }) => {
    await page.route(`**/api/maps/${PARAM_MAP.id}`, (route) => jsonRoute(route, { data: PARAM_MAP }))
    await mockMapRunFlow(page, PARAM_MAP.id)
    // Overrides the queue route `mockMapRunFlow` just registered, to also
    // assert the parameter made it into the request body.
    await page.route(`**/api/maps/${PARAM_MAP.id}/runs`, (route) => {
      const body = route.request().postDataJSON()
      expect(body.parameters).toEqual({ MIN_TOTAL: '1000' })
      return jsonRoute(route, { data: QUEUED_RUN }, 202)
    })

    await page.goto(`/maps/${PARAM_MAP.id}/view`)
    await page.getByRole('button', { name: 'Run', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('MIN_TOTAL').fill('1000')
    await dialog.getByRole('button', { name: 'Run', exact: true }).click()

    await expect(page.getByText('Acme Corp')).toBeVisible()
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
