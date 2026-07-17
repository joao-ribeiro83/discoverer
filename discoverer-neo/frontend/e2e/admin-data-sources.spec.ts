import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { DATA_SOURCE, jsonRoute, seedAuthedSession } from './fixtures'

test.describe('Admin — Data Sources', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
  })

  test('lists existing data sources', async ({ page }) => {
    await page.route('**/api/data-sources', (route) => jsonRoute(route, { data: [DATA_SOURCE] }))

    await page.goto('/admin/data-sources')

    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await expect(page.getByRole('cell', { name: DATA_SOURCE.name, exact: true })).toBeVisible()
    await expect(page.getByText('oracle', { exact: true })).toBeVisible()
  })

  test('creates a new Oracle data source', async ({ page }) => {
    await page.route('**/api/data-sources', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        return jsonRoute(
          route,
          {
            data: {
              id: 'ds-new',
              ...body,
              isActive: true,
              createdAt: '2026-01-05T00:00:00.000Z',
              hasPassword: !!body.passwordEnc,
              hasConnectionString: false,
            },
          },
          201,
        )
      }
      return jsonRoute(route, { data: [DATA_SOURCE] })
    })

    await page.goto('/admin/data-sources')
    await page.getByRole('button', { name: 'New Data Source' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name', { exact: true }).fill('Reporting Oracle')
    await dialog.getByLabel('Host').fill('oracle-report.internal')
    await dialog.getByLabel('Port').fill('1521')
    await dialog.getByLabel('Service Name').fill('REPORTPDB')
    await dialog.getByLabel('Username').fill('reporting')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Data source created').first()).toBeVisible()
  })

  test('tests a data source connection', async ({ page }) => {
    await page.route('**/api/data-sources', (route) => jsonRoute(route, { data: [DATA_SOURCE] }))
    await page.route('**/api/data-sources/*/test', (route) =>
      jsonRoute(route, { data: { success: true, message: 'Connected in 84ms.', latencyMs: 84 } }),
    )

    await page.goto('/admin/data-sources')
    await page.getByRole('row', { name: new RegExp(DATA_SOURCE.name) }).getByTitle('Test connection').click()

    await expect(page.getByText('Connected in 84ms.').first()).toBeVisible()
  })

  test('surfaces a failed connection test', async ({ page }) => {
    await page.route('**/api/data-sources', (route) => jsonRoute(route, { data: [DATA_SOURCE] }))
    await page.route('**/api/data-sources/*/test', (route) =>
      jsonRoute(route, { data: { success: false, message: 'ORA-12154: could not resolve service name', latencyMs: 0 } }),
    )

    await page.goto('/admin/data-sources')
    await page.getByRole('row', { name: new RegExp(DATA_SOURCE.name) }).getByTitle('Test connection').click()

    await expect(page.getByText('ORA-12154: could not resolve service name').first()).toBeVisible()
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.route('**/api/data-sources', (route) => jsonRoute(route, { data: [DATA_SOURCE] }))
    await page.goto('/admin/data-sources')
    await expect(page.getByRole('cell', { name: DATA_SOURCE.name, exact: true })).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
