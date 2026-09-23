import { test, expect } from '@playwright/test'
import { COMPLETED_RUN, EXECUTE_RESULT, MAP_WITH_DETAILS, QUEUED_RUN, RUN_ID, jsonRoute, seedAuthedSession } from './fixtures'

// Between QUEUED and COMPLETED — fixtures.ts only exports those two, since
// `mockMapRunFlow` never needs to show RUNNING within a test's window; this
// spec does, to prove the status line actually transitions.
const RUNNING_RUN = { ...QUEUED_RUN, status: 'RUNNING', startedAt: '2026-01-06T00:00:00.500Z' }

test.describe('Runs', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}`, (route) => jsonRoute(route, { data: MAP_WITH_DETAILS }))
  })

  test('runs a map through the queue, then reuses the result from the Runs page', async ({ page }) => {
    // 1st POST (the viewer's "Run" click): a fresh run is queued (202).
    // 2nd POST ("Run again" from the Runs page): a valid result already
    // exists, so the backend reuses it instead of queueing (200).
    let requestCount = 0
    await page.route(`**/api/maps/${MAP_WITH_DETAILS.id}/runs`, (route) => {
      requestCount += 1
      const first = requestCount === 1
      return jsonRoute(route, { data: first ? QUEUED_RUN : COMPLETED_RUN }, first ? 202 : 200)
    })
    // `useMapRun` shows the QUEUED run it just got back from the POST above
    // immediately (no fetch needed) — the first actual poll of this endpoint
    // reports QUEUED again, the next RUNNING, and only the one after that
    // COMPLETED, so the status line is seen to genuinely transition rather
    // than just matching whatever `useMapRun` already had in hand.
    let pollCount = 0
    await page.route(`**/api/runs/${RUN_ID}`, (route) => {
      pollCount += 1
      const run = pollCount === 1 ? QUEUED_RUN : pollCount === 2 ? RUNNING_RUN : COMPLETED_RUN
      return jsonRoute(route, { data: run })
    })
    // `runs.rows()` appends `?offset=&limit=` — the trailing `*` absorbs it.
    await page.route(`**/api/runs/${RUN_ID}/rows*`, (route) => jsonRoute(route, { data: EXECUTE_RESULT.rows }))
    // The Runs page's list: QUEUED on the first read (Cancel should show),
    // COMPLETED afterwards (Cancel should disappear, exports should appear)
    // — whichever request gets there first, the auto-poll or "Run again"'s
    // cache invalidation.
    let listCallCount = 0
    await page.route(/\/api\/runs(\?.*)?$/, (route) => {
      listCallCount += 1
      const run = listCallCount === 1 ? QUEUED_RUN : COMPLETED_RUN
      return jsonRoute(route, { data: [run] })
    })

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
    await expect(page.getByRole('heading', { name: MAP_WITH_DETAILS.name })).toBeVisible()

    await page.getByRole('button', { name: 'Run', exact: true }).click()
    // Exact strings, not a regex — the Run button's own label also reads
    // "Running…" while either state is in flight, so a loose match risks a
    // strict-mode violation once both are on screen at once.
    await expect(page.getByText('Queued (position unknown)')).toBeVisible()
    await expect(page.locator('p', { hasText: 'Running…' })).toBeVisible()
    await expect(page.getByText('Acme Corp')).toBeVisible()

    await page.goto('/runs')
    const row = page.getByRole('row', { name: new RegExp(MAP_WITH_DETAILS.name) })
    await expect(row).toBeVisible()
    await expect(row.getByTitle('Cancel')).toBeVisible()

    await row.getByTitle('Run again').click()
    await expect(page.getByText('Result reused').first()).toBeVisible()

    await expect(row.getByTitle('Cancel')).toHaveCount(0)
    await expect(row.getByText('XLSX')).toBeVisible()
    await expect(row.getByText('CSV')).toBeVisible()
    await expect(row.getByText('PDF')).toBeVisible()
  })
})
