import { test, expect } from '@playwright/test'
import { EXECUTE_RESULT, MAP_WITH_DETAILS, jsonRoute, seedAuthedSession } from './fixtures'

const RUN_ID = 'run-e2e-1'
const NOW_ISO = '2026-01-01T00:00:00.000Z'
// Fixed far in the future so `expiresAt > now` holds regardless of when this
// suite actually runs (RunsPage/ExecutionPanel gate exports on the real clock).
const FAR_FUTURE_ISO = '2099-01-01T00:00:00.000Z'

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    mapId: MAP_WITH_DETAILS.id,
    mapName: MAP_WITH_DETAILS.name,
    kind: 'LIVE',
    scheduleId: null,
    status: 'QUEUED',
    parameters: {},
    calculatedFields: [],
    columns: null,
    decoration: null,
    rowCount: null,
    truncated: false,
    executionTimeMs: null,
    errorMessage: null,
    createdAt: NOW_ISO,
    startedAt: null,
    completedAt: null,
    expiresAt: FAR_FUTURE_ISO,
    ...overrides,
  }
}

const QUEUED_RUN = makeRun()
const COMPLETED_RUN = makeRun({
  status: 'COMPLETED',
  columns: EXECUTE_RESULT.columns,
  decoration: { groupBreakAliases: [], totals: [], conditionalFormats: [], warnings: [] },
  rowCount: EXECUTE_RESULT.rowCount,
  executionTimeMs: EXECUTE_RESULT.executionTimeMs,
  startedAt: NOW_ISO,
  completedAt: NOW_ISO,
})

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
    // immediately (no fetch needed) and only polls this endpoint afterwards
    // — by the time it's ever called, the run has completed.
    await page.route(`**/api/runs/${RUN_ID}`, (route) => jsonRoute(route, { data: COMPLETED_RUN }))
    // `runs.rows()` appends `?offset=&limit=` — the trailing `*` absorbs it.
    await page.route(`**/api/runs/${RUN_ID}/rows*`, (route) => jsonRoute(route, { data: EXECUTE_RESULT.rows }))
    // The Runs page's list — a single completed row throughout.
    await page.route(/\/api\/runs(\?.*)?$/, (route) => jsonRoute(route, { data: [COMPLETED_RUN] }))

    await page.goto(`/maps/${MAP_WITH_DETAILS.id}/view`)
    await expect(page.getByRole('heading', { name: MAP_WITH_DETAILS.name })).toBeVisible()

    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText(/Queued|Running/)).toBeVisible()
    await expect(page.getByText('Acme Corp')).toBeVisible()

    await page.goto('/runs')
    const row = page.getByRole('row', { name: new RegExp(MAP_WITH_DETAILS.name) })
    await expect(row).toBeVisible()

    await row.getByTitle('Run again').click()
    await expect(page.getByText('Result reused').first()).toBeVisible()

    await expect(row.getByText('XLSX')).toBeVisible()
    await expect(row.getByText('CSV')).toBeVisible()
    await expect(row.getByText('PDF')).toBeVisible()
    await expect(row.getByTitle('Cancel')).toHaveCount(0)
  })
})
