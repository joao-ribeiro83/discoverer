import { test, expect } from '@playwright/test'
import { EXECUTE_RESULT, MAP_WITH_DETAILS, jsonRoute, seedAuthedSession } from './fixtures'

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/execute`, (route) =>
      jsonRoute(route, { data: EXECUTE_RESULT }),
    )
  })

  // Creating an export is map-scoped; polling and downloading are keyed by the
  // job id alone (`/api/exports/:jobId`).
  test('exports the executed result to CSV and downloads it', async ({ page }) => {
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/export`, (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      return jsonRoute(route, { data: { jobId: 'job-1', status: 'PENDING' } }, 202)
    })
    await page.route('**/api/exports/job-1', (route) =>
      jsonRoute(route, {
        data: {
          jobId: 'job-1',
          mapId: MAP_WITH_DETAILS.id,
          format: 'CSV',
          status: 'COMPLETED',
          progress: 100,
          rowCount: 1,
          errorMessage: null,
          createdAt: '2026-01-06T00:00:00.000Z',
          completedAt: '2026-01-06T00:00:01.000Z',
        },
      }),
    )
    await page.route('**/api/exports/job-1/download', (route) =>
      route.fulfill({ status: 200, contentType: 'text/csv', body: 'CUSTOMER_NAME,ORDER_TOTAL\nAcme Corp,12500.5\n' }),
    )

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Map executed').first()).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('Order_Summary.csv')
  })

  test('surfaces a failed export job', async ({ page }) => {
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/export`, (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      return jsonRoute(route, { data: { jobId: 'job-2', status: 'PENDING' } }, 202)
    })
    await page.route('**/api/exports/job-2', (route) =>
      jsonRoute(route, {
        data: {
          jobId: 'job-2',
          mapId: MAP_WITH_DETAILS.id,
          format: 'XLSX',
          status: 'FAILED',
          progress: 0,
          rowCount: null,
          errorMessage: 'Query timed out while generating the export.',
          createdAt: '2026-01-06T00:00:00.000Z',
          completedAt: '2026-01-06T00:00:01.000Z',
        },
      }),
    )

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Map executed').first()).toBeVisible()

    await page.getByRole('button', { name: 'Excel' }).click()
    await expect(page.getByText('Query timed out while generating the export.').first()).toBeVisible()
  })
})
