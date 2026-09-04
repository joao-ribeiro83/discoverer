import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  BUSINESS_AREA,
  EXECUTE_RESULT,
  FOLDER,
  ITEM_DIMENSION,
  ITEM_MEASURE,
  MAP_WITH_DETAILS,
  jsonRoute,
  seedAuthedSession,
} from './fixtures'

async function dragTo(page: Page, sourceTestId: string, target: ReturnType<Page['getByTestId']>) {
  const source = page.getByTestId(sourceTestId)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Could not resolve drag source/target bounding box')

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 15, sourceBox.y + sourceBox.height / 2 + 15, {
    steps: 5,
  })
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 })
  await page.mouse.up()
}

async function mockTree(page: Page) {
  await page.route('**/api/business-areas', (route) => jsonRoute(route, { data: [BUSINESS_AREA] }))
  await page.route(`**/api/business-areas/${BUSINESS_AREA.id}/folders`, (route) =>
    jsonRoute(route, { data: [FOLDER] }),
  )
  await page.route(`**/api/folders/${FOLDER.id}/items`, (route) =>
    jsonRoute(route, { data: [ITEM_DIMENSION, ITEM_MEASURE] }),
  )
}

async function expandTree(page: Page) {
  await page.getByRole('button', { name: BUSINESS_AREA.name }).click()
  await page.getByRole('button', { name: FOLDER.name }).click()
  await expect(page.getByTestId(`tree-item-${ITEM_DIMENSION.id}`)).toBeVisible()
}

/** Same as expandTree, but never dispatches a mouse click — Playwright's
 * .click() moves the mouse and clicks, which is not a keyboard interaction. */
async function expandTreeByKeyboard(page: Page) {
  await page.getByRole('button', { name: BUSINESS_AREA.name }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: FOLDER.name }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId(`tree-item-${ITEM_DIMENSION.id}`)).toBeVisible()
}

/** A column chip on the canvas, matched by name — avoids ambiguity with the
 * same label appearing in the tree and (transiently, mid drop-animation) in
 * dnd-kit's DragOverlay portal. */
function canvasColumn(page: Page, name: string) {
  return page.getByTestId('canvas-column-row').filter({ hasText: name })
}

test.describe('Map Builder', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page)
    await mockTree(page)
  })

  test('creates a map by dragging columns onto the canvas, adds a condition, saves, and runs it', async ({
    page,
  }) => {
    await page.route(`**/api/business-areas/${BUSINESS_AREA.id}/maps`, (route) => {
      const body = route.request().postDataJSON()
      return jsonRoute(route, { data: { ...MAP_WITH_DETAILS, ...body, id: 'map-new' } }, 201)
    })
    await page.route('**/api/maps/*/execute', (route) => jsonRoute(route, { data: EXECUTE_RESULT }))

    await page.goto('/maps/new')
    await expandTree(page)

    await dragTo(page, `tree-item-${ITEM_DIMENSION.id}`, page.getByTestId('map-canvas-dropzone'))
    await expect(canvasColumn(page, ITEM_DIMENSION.name)).toBeVisible()

    await dragTo(page, `tree-item-${ITEM_MEASURE.id}`, page.getByTestId('map-canvas-dropzone'))
    await expect(canvasColumn(page, ITEM_MEASURE.name)).toBeVisible()

    // Add a condition referencing the dimension column.
    await page.getByRole('tab', { name: /^Conditions/ }).click()
    await page.getByRole('button', { name: 'Add Condition' }).click()
    await page.getByLabel('Condition value').fill('Acme Corp')
    await expect(page.getByRole('tab', { name: /^Conditions \(1\)/ })).toBeVisible()

    // Save.
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Map saved').first()).toBeVisible()
    await expect(page).toHaveURL(/\/maps\/map-new$/)

    // Run and verify results render.
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByText('Map executed').first()).toBeVisible()
    await expect(page.getByText('Acme Corp')).toBeVisible()
    await expect(page.getByText('3 rows').first()).toBeVisible()
  })

  test('rejects dropping a duplicate column', async ({ page }) => {
    await page.goto('/maps/new')
    await expandTree(page)

    await dragTo(page, `tree-item-${ITEM_DIMENSION.id}`, page.getByTestId('map-canvas-dropzone'))
    await expect(canvasColumn(page, ITEM_DIMENSION.name)).toBeVisible()

    await dragTo(page, `tree-item-${ITEM_DIMENSION.id}`, page.getByTestId('map-canvas-dropzone'))
    await expect(page.getByText('Already added').first()).toBeVisible()
  })

  test('supports picking up a column via the keyboard (screen-reader accessible drag)', async ({ page }) => {
    await page.goto('/maps/new')
    await expandTree(page)

    await dragTo(page, `tree-item-${ITEM_DIMENSION.id}`, page.getByTestId('map-canvas-dropzone'))
    await dragTo(page, `tree-item-${ITEM_MEASURE.id}`, page.getByTestId('map-canvas-dropzone'))

    const grips = page.getByRole('button', { name: 'Reorder column' })
    await expect(grips).toHaveCount(2)

    const liveRegion = page.locator('[id^="DndLiveRegion"]')

    await grips.first().focus()
    await page.keyboard.press('Space')

    // dnd-kit's built-in screen-reader live region announces pickup — this is
    // the actual accessibility contract, more robust to assert than the exact
    // pointer-drop geometry a full keyboard-driven reorder depends on. The
    // region updates fast (pickup immediately followed by an over-target
    // announcement), so match either rather than racing the first message.
    await expect(liveRegion).toContainText(/picked up|moved over/i)

    await page.keyboard.press('Escape')
    await expect(liveRegion).toContainText(/cancel/i)
  })

  test('builds a two-column map using only the keyboard (WCAG 2.5.7 non-drag equivalent)', async ({
    page,
  }) => {
    await page.goto('/maps/new')
    await expandTreeByKeyboard(page)

    // Accessible names must identify which field each control acts on, not
    // just say "Add" — a screen-reader user tabbing through many fields needs
    // to tell them apart without extra context.
    const addDimension = page.getByRole('button', { name: `Add ${ITEM_DIMENSION.name} to map` })
    const addMeasure = page.getByRole('button', { name: `Add ${ITEM_MEASURE.name} to map` })
    await expect(addDimension).toBeVisible()
    await expect(addMeasure).toBeVisible()

    await addDimension.focus()
    await page.keyboard.press('Enter')
    await expect(canvasColumn(page, ITEM_DIMENSION.name)).toBeVisible()

    await addMeasure.focus()
    await page.keyboard.press('Enter')
    await expect(canvasColumn(page, ITEM_MEASURE.name)).toBeVisible()

    await expect(page.getByTestId('canvas-column-row')).toHaveCount(2)
  })

  test('supports picking up a Sort-panel row via the keyboard', async ({ page }) => {
    await page.goto('/maps/new')
    await expandTree(page)
    await dragTo(page, `tree-item-${ITEM_DIMENSION.id}`, page.getByTestId('map-canvas-dropzone'))
    await dragTo(page, `tree-item-${ITEM_MEASURE.id}`, page.getByTestId('map-canvas-dropzone'))

    await page.getByRole('tab', { name: 'Sort' }).click()
    await page.getByLabel('Pick column to sort').click()
    await page.getByRole('option', { name: ITEM_DIMENSION.name }).click()
    await page.getByRole('button', { name: 'Add Sort' }).click()
    await page.getByLabel('Pick column to sort').click()
    await page.getByRole('option', { name: ITEM_MEASURE.name }).click()
    await page.getByRole('button', { name: 'Add Sort' }).click()

    // Scoped to the tabpanel: the page also has the canvas's own "Reorder
    // column" grips, and (once this panel's DndContext mounts) its own
    // separate live region alongside the canvas's — assert by text, not id,
    // to avoid colliding with the other DndContext's region.
    const panel = page.getByRole('tabpanel')
    const grips = panel.getByRole('button', { name: /^Reorder /})
    await expect(grips).toHaveCount(2)

    // Two DndContexts are mounted here (the page's own, plus this panel's) so
    // two live regions exist — filter to whichever one actually announced,
    // rather than asserting on a single (now ambiguous) id-prefixed locator.
    const liveRegions = page.locator('[id^="DndLiveRegion"]')
    await grips.first().focus()
    await page.keyboard.press('Space')
    await expect(liveRegions.filter({ hasText: /picked up|moved over/i })).toHaveCount(1)
  })

  test('supports picking up a Calculated-Fields row via the keyboard', async ({ page }) => {
    await page.goto('/maps/new')

    await page.getByRole('tab', { name: 'Calculated Fields' }).click()
    await page.getByRole('button', { name: /Add Calculated Field/ }).click()
    await page.getByRole('button', { name: /Add Calculated Field/ }).click()

    const grips = page.getByRole('button', { name: /^Reorder /})
    await expect(grips).toHaveCount(2)

    const liveRegions = page.locator('[id^="DndLiveRegion"]')
    await grips.first().focus()
    await page.keyboard.press('Space')
    await expect(liveRegions.filter({ hasText: /picked up|moved over/i })).toHaveCount(1)
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/maps/new')
    await expandTree(page)

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
