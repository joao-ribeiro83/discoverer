import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { BUSINESS_AREA, BUSINESS_AREA_2, jsonRoute, seedAuthedSession } from './fixtures'

test.describe('Admin — Business Areas', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
  })

  test('lists existing business areas', async ({ page }) => {
    await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA, BUSINESS_AREA_2] }))

    await page.goto('/admin/business-areas')

    await expect(page.getByRole('heading', { name: 'Business Areas' })).toBeVisible()
    await expect(page.getByRole('cell', { name: BUSINESS_AREA.name, exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: BUSINESS_AREA_2.name, exact: true })).toBeVisible()
  })

  test('creates a new business area', async ({ page }) => {
    let created = false
    await page.route('**/api/business-areas', (route) => {
      if (route.request().method() === 'POST') {
        created = true
        const body = route.request().postDataJSON()
        return jsonRoute(
          route,
          { data: { id: 'ba-new', ...body, isActive: true, createdAt: '2026-01-04T00:00:00.000Z' } },
          201,
        )
      }
      return jsonRoute(route, { data: created ? [BUSINESS_AREA, { id: 'ba-new', name: 'Marketing', description: null, isActive: true, createdAt: '2026-01-04T00:00:00.000Z' }] : [BUSINESS_AREA] })
    })

    await page.goto('/admin/business-areas')
    await page.getByRole('button', { name: 'New Business Area' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'New Business Area' })).toBeVisible()
    await dialog.getByLabel('Name').fill('Marketing')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Business area created').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Marketing', exact: true })).toBeVisible()
  })

  test('edits a business area', async ({ page }) => {
    await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA] }))
    await page.route('**/api/business-areas/*', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        return jsonRoute(route, { data: { ...BUSINESS_AREA, ...body } })
      }
      return route.continue()
    })

    await page.goto('/admin/business-areas')
    await page.getByRole('row', { name: new RegExp(BUSINESS_AREA.name) }).getByTitle('Edit').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Edit Business Area' })).toBeVisible()
    await dialog.getByLabel('Name').fill('Sales EMEA')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Business area updated').first()).toBeVisible()
  })

  test('deletes a business area with confirmation', async ({ page }) => {
    await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA] }))
    await page.route('**/api/business-areas/*', (route) => {
      if (route.request().method() === 'DELETE') return jsonRoute(route, { data: { message: 'deactivated' } })
      return route.continue()
    })

    await page.goto('/admin/business-areas')
    await page.getByRole('row', { name: new RegExp(BUSINESS_AREA.name) }).getByTitle('Delete').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Delete business area?' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Business area deactivated').first()).toBeVisible()
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA, BUSINESS_AREA_2] }))
    await page.goto('/admin/business-areas')
    await expect(page.getByRole('cell', { name: BUSINESS_AREA.name, exact: true })).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
