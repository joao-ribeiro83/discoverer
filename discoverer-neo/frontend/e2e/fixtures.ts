import type { Page, Route } from '@playwright/test'

export const AUTH_USER = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Ada Admin',
  role: 'ADMIN',
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** A structurally-valid (unsigned) JWT — only the payload's `exp` claim matters to the frontend. */
export function makeFakeJwt(expiresInSeconds = 24 * 3600): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({ sub: AUTH_USER.id, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  )
  return `${header}.${payload}.`
}

/** Seeds zustand's persisted auth store before any app script runs, so ProtectedRoute treats the session as already logged in. */
export async function seedAuthedSession(page: Page): Promise<void> {
  const token = makeFakeJwt()
  await page.addInitScript(
    ([storedToken, user]) => {
      window.localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user, token: storedToken, isAuthenticated: true },
          version: 0,
        }),
      )
    },
    [token, AUTH_USER],
  )
}

export function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

export const BUSINESS_AREA = {
  id: 'ba-1',
  name: 'Sales',
  description: 'Sales business area',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const BUSINESS_AREA_2 = {
  id: 'ba-2',
  name: 'Finance',
  description: null,
  isActive: true,
  createdAt: '2026-01-02T00:00:00.000Z',
}

export const FOLDER = {
  id: 'folder-1',
  businessAreaId: BUSINESS_AREA.id,
  name: 'Orders',
  description: null,
  folderType: 'TABLE' as const,
  tableName: 'ORDERS',
  tableOwner: 'SCOTT',
  customSql: null,
  dataSourceId: 'ds-1',
  dataSourceName: 'Primary Oracle',
  isActive: true,
}

export const ITEM_DIMENSION = {
  id: 'item-1',
  folderId: FOLDER.id,
  name: 'Customer Name',
  description: null,
  itemType: 'CI' as const,
  columnName: 'CUSTOMER_NAME',
  formula: null,
  dataType: 'VARCHAR2',
  formatMask: null,
  aggFunction: null,
  isActive: true,
}

export const ITEM_MEASURE = {
  id: 'item-2',
  folderId: FOLDER.id,
  name: 'Order Total',
  description: null,
  itemType: 'CI' as const,
  columnName: 'ORDER_TOTAL',
  formula: null,
  dataType: 'NUMBER',
  formatMask: '999,999.00',
  aggFunction: 'SUM',
  isActive: true,
}

export const DATA_SOURCE = {
  id: 'ds-1',
  name: 'Primary Oracle',
  description: 'Main Oracle connection',
  connectionType: 'oracle' as const,
  host: 'oracle.internal',
  port: 1521,
  serviceName: 'ORCLPDB',
  sid: null,
  username: 'scott',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  hasConnectionString: false,
}

export const MAP_SUMMARY = {
  id: 'map-1',
  name: 'Order Summary',
  description: 'Orders by customer',
  mapType: 'TABLE' as const,
  businessAreaId: BUSINESS_AREA.id,
  createdBy: AUTH_USER.id,
  isPublic: false,
  isActive: true,
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
}

export const MAP_WITH_DETAILS = {
  ...MAP_SUMMARY,
  items: [
    {
      id: 'mi-1',
      mapId: MAP_SUMMARY.id,
      itemId: ITEM_DIMENSION.id,
      displayOrder: 0,
      displayName: null,
      formatMask: null,
      aggFunction: null,
      sortDirection: null,
      sortOrder: null,
      columnWidth: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
    {
      id: 'mi-2',
      mapId: MAP_SUMMARY.id,
      itemId: ITEM_MEASURE.id,
      displayOrder: 1,
      displayName: null,
      formatMask: '999,999.00',
      aggFunction: 'SUM',
      sortDirection: null,
      sortOrder: null,
      columnWidth: null,
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ],
  conditions: [],
  parameters: [],
  calculatedFields: [],
}

export const EXECUTE_RESULT = {
  columns: [
    { name: 'CUSTOMER_NAME', label: 'Customer Name', isAggregate: false },
    { name: 'ORDER_TOTAL', label: 'Order Total', isAggregate: true },
  ],
  rows: [
    { CUSTOMER_NAME: 'Acme Corp', ORDER_TOTAL: 12500.5 },
    { CUSTOMER_NAME: 'Globex Inc', ORDER_TOTAL: 8300 },
    { CUSTOMER_NAME: 'Initech', ORDER_TOTAL: 4100.25 },
  ],
  rowCount: 3,
  executionTimeMs: 42,
  truncated: false,
  sql: 'SELECT CUSTOMER_NAME, SUM(ORDER_TOTAL) AS ORDER_TOTAL FROM ORDERS GROUP BY CUSTOMER_NAME',
}

export const RUN_ID = 'run-1'

function makeMapRun(overrides: Record<string, unknown> = {}) {
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
    createdAt: '2026-01-06T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    // Fixed far in the future so `expiresAt > now` holds regardless of when
    // the suite actually runs — export/reuse gating checks the real clock.
    expiresAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const QUEUED_RUN = makeMapRun()
export const COMPLETED_RUN = makeMapRun({
  status: 'COMPLETED',
  columns: EXECUTE_RESULT.columns,
  decoration: { groupBreakAliases: [], totals: [], conditionalFormats: [], warnings: [] },
  rowCount: EXECUTE_RESULT.rowCount,
  executionTimeMs: EXECUTE_RESULT.executionTimeMs,
  startedAt: '2026-01-06T00:00:00.000Z',
  completedAt: '2026-01-06T00:00:01.000Z',
})

/**
 * Mocks the map-run queue (Task 5.x — `POST .../runs` replaced the old
 * synchronous `.../execute`) for a single "run to completion" pass: the
 * queue request queues (202), and the poll/rows endpoints report it already
 * `COMPLETED` with `EXECUTE_RESULT`'s rows — a test never actually needs to
 * observe QUEUED/RUNNING within its assertion window. Register a route for
 * the same POST path again afterwards to override just the request, e.g. to
 * assert its body — the later registration takes precedence.
 */
export async function mockMapRunFlow(page: Page, mapId: string = MAP_WITH_DETAILS.id): Promise<void> {
  await page.route(`**/api/maps/${mapId}/runs`, (route) => jsonRoute(route, { data: QUEUED_RUN }, 202))
  await page.route(`**/api/runs/${RUN_ID}`, (route) => jsonRoute(route, { data: COMPLETED_RUN }))
  // `runs.rows()` appends `?offset=&limit=` — the trailing `*` absorbs it.
  await page.route(`**/api/runs/${RUN_ID}/rows*`, (route) => jsonRoute(route, { data: EXECUTE_RESULT.rows }))
}

/** Wires up the common read-only endpoints most pages need (auth/me, empty lists) so unrelated requests don't hang the page. Individual specs add/override routes for what they actually exercise. */
export async function mockCommonApi(page: Page): Promise<void> {
  await page.route('**/api/business-areas', (route) => {
    if (route.request().method() === 'GET') return jsonRoute(route, { data: [BUSINESS_AREA, BUSINESS_AREA_2] })
    return route.continue()
  })
  // A plain glob without a trailing wildcard only matches a bare '/api/maps'
  // — MapsListPage and DashboardPage call it with `?scope=all`, which falls
  // through this route unmocked and hits the real (proxied) backend with the
  // test's unsigned fake JWT, 401s, and silently logs the page out mid-test.
  await page.route(/\/api\/maps(\?.*)?$/, (route) => {
    const scope = new URL(route.request().url()).searchParams.get('scope')
    if (scope === 'all') return jsonRoute(route, { data: { all: [MAP_SUMMARY] } })
    return jsonRoute(route, { data: { mine: [MAP_SUMMARY], shared: [] } })
  })
  await page.route('**/api/data-sources', (route) => {
    if (route.request().method() === 'GET') return jsonRoute(route, { data: [DATA_SOURCE] })
    return route.continue()
  })
  await page.route(
    /\/api\/dashboard\/stats$/,
    (route) => jsonRoute(route, { data: { totalExecutions: 0, scheduledMaps: 0, scheduledResults: 0 } }),
  )
}
