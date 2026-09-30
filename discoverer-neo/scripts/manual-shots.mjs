// Screenshot generator for the four role manuals.
//   node scripts/manual-shots.mjs --locale en [--role user] [--only slug] [--dump /path]
// Writes docs/user-guide/manual/shots/<locale>/<role>/NN-slug.png and (en only) SHOTS.md rows.
// Needs the dev stack running (frontend :5173, backend :3000, container discoverer-neo-postgres).
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/user-guide/manual/shots')
const CREDS = 'C:/Users/BUGSBU~1/AppData/Local/Temp/claude/E--claude-discoverer/14c82a35-ed5f-428d-bcdd-f5f9b270d7aa/scratchpad/creds.json'
const BASE = 'http://localhost:5173'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d }
const locale = arg('locale', 'en')
const onlyRole = arg('role')
const only = arg('only')
const dump = arg('dump')

const creds = JSON.parse(fs.readFileSync(CREDS, 'utf8'))

export function psql(sql) {
  return execFileSync('docker', ['exec', 'discoverer-neo-postgres', 'psql', '-U', 'discoverer', '-d', 'discoverer_neo', '-tAc', sql], { encoding: 'utf8' }).trim()
}

// ---- i18n lookup (same JSON the app ships) ----
const cache = {}
export function t(ns, key, loc = locale) {
  const f = path.join(ROOT, 'frontend/src/locales', loc, ns + '.json')
  cache[f] ??= JSON.parse(fs.readFileSync(f, 'utf8'))
  let v = key.split('.').reduce((o, k) => o?.[k], cache[f])
  if (typeof v !== 'string' && loc !== 'en') return t(ns, key, 'en')
  if (typeof v !== 'string') throw new Error(`missing i18n ${ns}:${key}`)
  return v
}

// ---- privacy ----
const NL = String.fromCharCode(10)
const baNames = psql('select name from business_areas').split(NL)
const realNames = psql("select name from users where email not like 'manual.%'").split(NL).filter((n) => n.length >= 3 && !baNames.includes(n))
const privacyInit = (names) => {
  const esc = (s) => s.replace(/[.*+?^${}()[\]\|]/g, '\$&')
  const reN = new RegExp('(?<![A-Za-z0-9_])(' + names.map(esc).join('|') + ')(?![A-Za-z0-9_])')
  const reE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i
  const allowed = /(manual\.(admin|manager|user|viewer)@discoverer\.local|Ana Admin|Marco Manager|Ursula User|Vasco Viewer)/i
  const dsPage = () => /^\/admin\/(data-sources|custom-functions|folders|migration)/.test(location.pathname)
  const bad = (x) => {
    // Server addresses are internal infrastructure, not for a manual.
    if (/\d{1,3}(\.\d{1,3}){3}/.test(x)) return true
    const e = reE.exec(x)
    if (e && !allowed.test(e[0])) return true
    const n = reN.exec(x)
    return !!n && !(dsPage() && n[0] === 'SIID_TESTES')
  }
  const style = document.createElement('style')
  style.textContent = `[data-priv]{filter:blur(6px)!important;user-select:none}
  body.priv-grid tbody td{filter:blur(5px)!important}
  body.priv-ds [role=dialog] input:not([type=checkbox]):not([role=combobox]){filter:blur(6px)!important}`
  const scan = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) {
      const s = n.nodeValue
      if (s && s.length >= 3 && n.parentElement && bad(s)) n.parentElement.setAttribute('data-priv', '1')
    }
    root.querySelectorAll('input,textarea').forEach((el) => { if (el.value && bad(el.value)) el.setAttribute('data-priv', '1') })
  }
  const tick = () => {
    if (!document.body) return
    if (!style.isConnected) document.head?.appendChild(style)
    document.body.classList.toggle('priv-grid', /^\/maps\/[^/]+/.test(location.pathname))
    // Connection details (host, SID, account) in the data-source dialogs.
    document.body.classList.toggle('priv-ds', /^\/admin\/data-sources/.test(location.pathname))
    scan(document.body)
  }
  new MutationObserver(tick).observe(document, { childList: true, subtree: true, characterData: true })
  setInterval(tick, 250)
}

// ---- shot helper ----
const manifest = []
let counters = {}
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[class*="animate-pulse"],[class*="animate-spin"]'), null, { timeout: 8000 }).catch(() => {})
  await page.waitForFunction(() => !/(Loading|A carregar|Cargando|Chargement)[….]{1,3}/i.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
}

function makeCtx(page, role) {
  const folder = role
  return {
    page, role, locale, t,
    async settle() { await settle(page) },
    /** Capture. opts: { el: selector|Locator (default: viewport), desc, full } */
    async shot(slug, desc, opts = {}) {
      // Count before the --only filter so a partial run keeps the full run's numbers.
      counters[folder] = (counters[folder] ?? 0) + 1
      const file = `${String(counters[folder]).padStart(2, '0')}-${slug}.png`
      if (only && !slug.includes(only)) return
      const dir = path.join(OUT, locale, folder)
      fs.mkdirSync(dir, { recursive: true })
      if (opts.vp) { await page.setViewportSize(opts.vp); await page.waitForTimeout(600) }
      await settle(page)
      // scan pass so blur attributes are in place
      await page.waitForTimeout(400)
      const target = opts.el ? (typeof opts.el === 'string' ? page.locator(opts.el).first() : opts.el) : null
      if (target) await target.screenshot({ path: path.join(dir, file) })
      else await page.screenshot({ path: path.join(dir, file), fullPage: !!opts.full })
      if (opts.vp) await page.setViewportSize({ width: 1280, height: 800 })
      manifest.push({ file: `${folder}/${file}`, role: folder, desc })
      console.log('  shot', `${folder}/${file}`)
    },
    async goto(p) { await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }); await settle(page) },
    async dialog() { const d = page.locator('[role=dialog]').last(); await d.waitFor({ timeout: 8000 }); await page.waitForTimeout(600); return d },
    async esc() { await page.keyboard.press('Escape'); await page.waitForTimeout(400) },
    async skip(why) { console.log('  SKIP', why); manifest.push({ skipped: why }) },
    async tryStep(name, fn) { try { await fn() } catch (e) { console.log(`  FAIL ${name}: ${String(e.message).split('\n')[0]}`); try { await page.keyboard.press('Escape'); await page.keyboard.press('Escape') } catch {} } },
  }
}

async function newPage(browser, loc, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1.5, locale: loc })
  await context.addInitScript(([k, v]) => { try { localStorage.setItem(k, v) } catch {} }, ['discoverer-neo-locale', loc])
  await context.addInitScript(privacyInit, realNames)
  const page = await context.newPage()
  return { context, page }
}

export async function login(page, role) {
  await page.goto(BASE + '/login')
  await page.locator('#email').fill(creds.users[role])
  await page.locator('#password').fill(creds.password)
  await page.locator('button[type=submit]').click()
  await page.waitForURL(/\/(dashboard|change-password)/, { timeout: 15000 })
  await settle(page)
}

const steps = {}
async function main() {
  for (const r of ['admin', 'manager', 'user', 'viewer']) {
    psql(`update users set locale='${locale}' where email='manual.${r}@discoverer.local'`)
  }
  const browser = await chromium.launch()
  const roles = ['common', 'user', 'viewer', 'manager', 'admin'].filter((r) => !onlyRole || r === onlyRole || (r === 'common' && onlyRole === 'common'))
  if (dump) {
    const { page } = await newPage(browser, locale)
    await login(page, (onlyRole || 'admin').toUpperCase())
    for (const d of dump.split(',')) {
      await page.goto(BASE + d, { waitUntil: 'domcontentloaded' }); await settle(page)
      console.log('#### ' + d)
      console.log('blurred: ' + await page.evaluate(() => [...document.querySelectorAll('[data-priv]')].map((e) => e.tagName + ':' + (e.textContent || e.value || '').slice(0, 20)).join(' ; ')))
      console.log(await page.evaluate(() => (document.querySelector('main')?.innerText ?? '').split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0, 1200)))
      console.log(await page.evaluate(() => [...document.querySelectorAll('main button,main a,main [role=combobox],main [role=tab],main input')].map((e) => `${e.tagName}[${e.getAttribute('aria-label') ?? e.getAttribute('title') ?? e.getAttribute('placeholder') ?? ''}]${(e.innerText || '').trim().slice(0, 30)}`).join(' ; ').slice(0, 1500)))
    }
    await browser.close(); return
  }
  for (const role of roles) {
    console.log('== role', role)
    const fn = steps[role]
    if (!only) fs.rmSync(path.join(OUT, locale, role), { recursive: true, force: true })
    if (!fn) continue
    const { context, page } = await newPage(browser, locale)
    const ctx = makeCtx(page, role)
    ctx.login = (r) => login(page, r)
    ctx.newPage = (vp) => newPage(browser, locale, vp)
    ctx.psql = psql
    ctx.creds = creds
    ctx.BASE = BASE
    try { await fn(ctx) } catch (e) { console.log('ROLE FAILED', role, e.message) }
    await context.close()
  }
  await browser.close()
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, `.manifest-${locale}${onlyRole ? '-' + onlyRole : ''}.json`), JSON.stringify(manifest, null, 1))
  if (locale === 'en' && !onlyRole && !only) {
    const rows = manifest.filter((m) => m.file).map((m) => `| ${m.file} | ${m.role} | ${m.desc.replace(/\|/g, '/')} |`)
    fs.writeFileSync(path.join(OUT, 'SHOTS.md'), [
      '# Manual screenshots',
      '',
      'Generated by `scripts/manual-shots.mjs`. Every file exists in `shots/en/`, `shots/pt-PT/`, `shots/es-ES/` and `shots/fr-FR/` under the same relative path.',
      'The descriptions below use the English labels; the other languages show the same screen with translated labels.',
      'Real people and result-grid data are blurred on purpose; only the accounts Ana Admin, Marco Manager, Ursula User and Vasco Viewer are readable.',
      'Screens of 1280x800 unless noted; Maps list captures are taken at 1500x900 because the Actions column needs the width; dialogs are cropped to the dialog.',
      '',
      '| File (relative to shots/<locale>/) | Role | What the picture shows |',
      '|---|---|---|',
      ...rows,
      '',
    ].join(String.fromCharCode(10)))
  }
}

// ================= STEPS =================
const MAP = '04b193a3-e8ef-45c9-a3d9-b51fc5682747'
const MAP_SLOW_EDIT = 'e2cc59ef-714d-4ba1-a713-8d4643b79db8'
const RUN_PARAMS = ['2020', '125']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function openSelect(page, trigger) {
  await trigger.click()
  await page.locator('[role=listbox]').last().waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
}
const cbo = (page, label) => page.locator(`[role=combobox][aria-label="${label}"]`).first()

/** Run the sample map with quick parameters and wait for the result grid. */
async function runMap(c, { fill = true } = {}) {
  const { page } = c
  await page.getByRole('button', { name: t('mapViewer', 'viewer.runTitle') === '' ? 'Run' : /^(Run|Executar|Ejecutar|Exécuter)$/ }).first().click().catch(() => {})
}

const runLabel = () => t('mapBuilder', 'toolbar.run')
const ownMapId = (email) => psql(`select m.id from maps m join users u on u.id=m.created_by where u.email='${email}' order by m.created_at limit 1`)

/** Duplicate the sample map via the Maps list Copy icon (once per account). */
async function ensureCopy(c, email) {
  if (ownMapId(email)) return ownMapId(email)
  const { page } = c
  await c.goto('/maps')
  await tab(c, 'all').click()
  await page.waitForTimeout(800)
  await page.setViewportSize(WIDE)
  await rowIcon(page, 'GD_M.M10_V01.DIS', 'copyTooltip').first().click()
  await page.waitForURL(/\/maps\/[0-9a-f-]{36}$/, { timeout: 20000 })
  await page.setViewportSize({ width: 1280, height: 800 })
  await c.settle()
  return ownMapId(email)
}

steps.common = async (c) => {
  const { page } = c
  await page.goto(BASE + '/login'); await c.settle()
  await c.shot('login', 'Sign-in page (/login) in the chosen language: product name, e-mail and password fields, "Remember me" ticked, Sign in button.')
  await page.locator('button[type=submit]').click(); await page.waitForTimeout(600)
  await c.shot('login-validation', 'Sign-in page after pressing Sign in with empty fields: inline validation messages under e-mail and password.')
  await c.login('USER')
  await c.goto('/dashboard')
  await page.getByRole('button', { name: /Ursula User/ }).click(); await page.waitForTimeout(500)
  await c.shot('user-menu', 'Dashboard with the account menu (top right) open: My Account label, e-mail line, Settings, Log out.')
  await c.esc()
  await c.goto('/settings')
  await c.shot('settings', 'Settings page: Language card, Theme card (Light/Dark/High contrast), Color palette card (six palettes) and Save button.')
  await openSelect(page, page.locator('main [role=combobox]').first())
  await c.shot('settings-language', 'Settings page with the Display language dropdown open, listing the four languages.')
  await c.esc()
  await page.locator(`button[title="${t('settings', 'theme.tooltip.dark')}"]`).click()
  await page.waitForTimeout(600)
  await c.shot('settings-dark', 'Settings page with the Dark theme selected (not saved), showing the preview of the interface in dark colours.')
  await page.locator(`button[title="${t('settings', 'theme.tooltip.high-contrast')}"]`).click()
  await page.waitForTimeout(600)
  await c.shot('settings-high-contrast', 'Settings page with High contrast selected: the palette card is greyed out with an explanatory note.')
  // mobile
  const m = await c.newPage({ width: 375, height: 812 })
  await login(m.page, 'USER')
  await m.page.locator('header button').first().click()
  await sleep(1800)
  await m.page.screenshot({ path: path.join(OUT, locale, 'common', String(++counters.common).padStart(2, '0') + '-mobile-drawer.png') })
  manifest.push({ file: `common/${String(counters.common).padStart(2, '0')}-mobile-drawer.png`, role: 'common', desc: 'Phone width (375 px): header with the hamburger button and the navigation drawer open on the left with the sidebar sections.' })
  await m.context.close()
}

const WIDE = { width: 1500, height: 900 }
const tab = (c, k) => c.page.getByRole('tab', { name: t('mapViewer', 'mapsList.tabs.' + k), exact: true }).or(c.page.getByRole('button', { name: t('mapViewer', 'mapsList.tabs.' + k), exact: true })).first()
const rowIcon = (page, rowText, key) => page.locator("div.grid.items-center").filter({ hasText: rowText }).last().locator(`[aria-label="${t("mapViewer", "mapsList.actions." + key)}"]`)

steps.user = async (c) => {
  const { page } = c
  page.on('dialog', (d) => d.accept())
  await c.login('USER')
  const email = creds.users.USER
  // --- maps list
  await c.goto('/maps')
  await tab(c, 'shared').click(); await page.waitForTimeout(600)
  await c.shot('maps-shared', 'Maps list, tab "Shared with me": the three maps shared with this user, with the Workbooks card above; row icons depend on the share level (Open on all; Edit pencil on the map shared at Can edit; Schedule and Export on maps shared at Can export or higher).', { vp: WIDE })
  await c.tryStep('workbook-copy-dialog', async () => {
    await page.locator('button[aria-label="' + t('mapViewer', 'workbookDuplicate.button') + '"]').nth(1).click()
    await c.dialog()
    await c.shot('workbook-copy-dialog', 'Copy workbook dialog: title, explanation, "Name of the new workbook" field prefilled with the workbook name plus (copy), Copy and Cancel buttons (Cancel pressed, nothing copied).', { el: '[role=dialog]' })
    await c.esc()
  })
  // --- copy once (own map)
  await ensureCopy(c, email)
  await c.goto('/maps')
  await tab(c, 'mine').click(); await page.waitForTimeout(600)
  await c.shot('maps-mine', 'Maps list, tab "Mine": the user\'s own copy of the map with every row icon (Open, Edit, Copy, Share, Schedule, Export, Delete).', { vp: WIDE })
  await tab(c, 'all').click(); await page.waitForTimeout(600)
  await c.shot('maps-all', 'Maps list, tab "All": every map this user may see (own and shared), with the Owner column blurred.', { vp: WIDE })
  // ---- builder on own copy
  const mid = ownMapId(email)
  await c.goto(`/maps/${mid}`)
  await page.waitForTimeout(1500)
  await c.shot('builder-overview', 'Map builder for the user\'s own copy: toolbar (Back, map name, Table type, Run, Save, Export, Schedule, Formatting, Share), Business Areas tree on the left, 17 columns on the canvas, Properties tab on the right.')
  await c.tryStep('builder-unsaved', async () => {
    const name = page.getByLabel(t('mapBuilder', 'toolbar.mapNameAria'))
    const old = await name.inputValue()
    await name.fill(old + ' ')
    await page.waitForTimeout(500)
    await c.shot('builder-unsaved', 'Map builder toolbar after editing the map name: the "Unsaved" marker (dot + label) appears next to the toolbar buttons. Nothing was saved.', { el: page.locator('header, div').filter({ has: name }).last() })
    await name.fill(old)
  })
  await c.tryStep('builder-column-config', async () => {
    await page.getByRole('button', { name: /Configure column|.*/ }).filter({ hasText: 'Montante Garantido' }).first().click()
    await c.dialog()
    await c.shot('builder-column-dialog', 'Configure column dialog for "Montante Garantido": display name, Aggregation, Sort direction, Format mask, sort order, column width, Crosstab axis fields.', { el: '[role=dialog]' })
    await openSelect(page, page.locator('[role=dialog]').getByRole('combobox', { name: t('mapBuilder', 'columnConfig.aggregation') }))
    await c.shot('builder-column-aggregation', 'Configure column dialog with the Aggregation dropdown open listing the aggregation functions.')
    await c.esc(); await c.esc()
  })
  for (const [key, slug, d] of [
    ['conditions', 'builder-conditions', 'Right panel, Conditions tab: the map\'s three conditions with operator and value/prompt controls.'],
    ['sort', 'builder-sort', 'Right panel, Sort tab: the ordered list of sort columns with direction toggles and Add sort control.'],
    ['parameters', 'builder-parameters', 'Right panel, Parameters tab: the two parameters (Ano, produto) with type and default value.'],
    ['calculatedFields', 'builder-calculated', 'Right panel, Calculated Fields tab (empty) with the Add button.'],
  ]) {
    await c.tryStep(slug, async () => {
      await page.getByRole('tab').filter({ hasText: t('mapBuilder', 'panels.tabs.' + key) }).first().click()
      await page.waitForTimeout(500)
      await c.shot(slug, d)
    })
  }
  await c.tryStep('builder-formula', async () => {
    await page.getByRole('button', { name: t('mapBuilder', 'panels.calculatedFields.addButton') }).click()
    await page.waitForTimeout(600)
    const dlg = page.locator('[role=dialog]')
    if (await dlg.count()) await c.shot('builder-formula', 'Formula editor dialog opened from Add calculated field: name, formula box and the function/column chips.', { el: '[role=dialog]' })
    else await c.shot('builder-calculated-added', 'Calculated Fields tab after pressing Add: a new (unsaved) calculated field row.')
    await c.esc()
    await c.goto(`/maps/${mid}`)
  })
  await c.tryStep('builder-params-prompt', async () => {
    await page.getByRole('button', { name: t('mapBuilder', 'toolbar.run'), exact: true }).click()
    await c.dialog()
    await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
    await page.waitForTimeout(500)
    await c.shot('builder-params-required', 'Run parameters dialog opened from the builder Run button, showing required-field messages after pressing Run empty.', { el: '[role=dialog]' })
    const ins = page.locator('[role=dialog] input')
    await ins.nth(0).fill(RUN_PARAMS[0]); await ins.nth(1).fill(RUN_PARAMS[1])
    await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
    await page.getByRole('button', { name: 'Excel', exact: true }).first().waitFor({ timeout: 60000 })
    await c.shot('builder-results', 'Map builder after a run: the results panel below the canvas with row-count and time badges, Excel/CSV/PDF export buttons and the blurred grid. No SQL or Plan buttons for a User.')
  })
  await c.tryStep('builder-export-menu', async () => {
    await page.getByRole('button', { name: t('common', 'actions.export'), exact: true }).click()
    await page.waitForTimeout(500)
    await c.shot('builder-export-menu', 'Toolbar Export menu open: the export choices (Excel, CSV, PDF, XML).')
    await c.esc()
  })
  await c.tryStep('builder-pdf', async () => {
    await page.getByRole('button', { name: 'PDF', exact: true }).first().click()
    await c.dialog()
    await c.shot('builder-pdf-dialog', 'PDF export dialog with all layout options (orientation, page size, title, fonts, etc.).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('builder-share', async () => {
    await page.getByRole('button', { name: t('mapBuilder', 'toolbar.share'), exact: true }).click()
    await c.dialog()
    await c.shot('builder-share-dialog', 'Share dialog opened from the builder as owner: user search, list of people with permission levels, public toggle/notice.', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('builder-formatting', async () => {
    await page.getByRole('button', { name: t('mapBuilder', 'toolbar.conditionalFormat'), exact: true }).click()
    await c.dialog()
    await c.shot('builder-formatting-dialog', 'Formatting (conditional format) dialog: rules list and the Add rule controls.', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.goto('/maps/new')
  await c.shot('builder-new', 'New map (/maps/new): empty builder for a user with a Create grant - toolbar, Business Areas tree with the granted areas, empty canvas hint "Drag items here to build your map", Properties panel.')
  // ---- viewer run + export
  await c.goto(`/maps/${MAP}/view`)
  await c.shot('viewer-before-run', 'Map viewer before any run: Back link, map name and description, parameter names, Run and Schedule management buttons, empty Results panel "Run the map to see results."')
  await page.getByRole('button', { name: runLabel(), exact: true }).click()
  await c.dialog()
  await c.shot('viewer-params-empty', 'Run parameters dialog with the two required fields (Ano, produto) empty.', { el: '[role=dialog]' })
  await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
  await page.waitForTimeout(500)
  await c.shot('viewer-params-required', 'Run parameters dialog after pressing Run with empty required fields: red "This parameter is required." messages.', { el: '[role=dialog]' })
  { const ins = page.locator('[role=dialog] input'); await ins.nth(0).fill(RUN_PARAMS[0]); await ins.nth(1).fill(RUN_PARAMS[1]) }
  await c.shot('viewer-params-filled', 'Run parameters dialog with Ano = 2020 and produto = 125 filled in.', { el: '[role=dialog]' })
  await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
  await page.getByRole('button', { name: 'Excel', exact: true }).first().waitFor({ timeout: 60000 })
  await c.shot('viewer-results', 'Map viewer after a completed run: status line "Result from ... valid until ...", Run again, row-count and time badges, Excel/CSV/PDF export buttons and the blurred result grid with sortable column headers and filter boxes; "Not all rows are loaded. Load more" at the bottom.')
  await c.tryStep('viewer-export', async () => {
    await page.getByRole('button', { name: 'Excel', exact: true }).first().click()
    await page.waitForTimeout(2500)
    await c.shot('viewer-export-toast', 'Map viewer just after pressing the Excel button: a toast confirms the export was queued/started.')
  })
  await c.tryStep('viewer-drill', async () => {
    await page.locator('tbody tr').nth(2).dblclick()
    await page.waitForTimeout(1500)
    if (await page.locator('[role=dialog]').count()) { await c.shot('viewer-drill-dialog', 'Drill to detail dialog opened by double-clicking a result row (values blurred).', { el: '[role=dialog]' }); await c.esc() }
  })
  await c.tryStep('viewer-schedule-mgmt', async () => {
    await page.getByRole('link', { name: t('mapViewer', 'viewer.scheduleManagement') }).click()
    await c.settle()
    await c.shot('schedules-empty', 'Schedules page reached from "Schedule management" on the map viewer: empty list message "No schedules yet.", New Schedule button.')
  })
  // ---- share own copy with the viewer test account
  await c.goto('/maps')
  await tab(c, 'mine').click(); await page.waitForTimeout(500)
  await c.tryStep('share-dialog', async () => {
    await page.setViewportSize(WIDE)
    await rowIcon(page, '(copy)', 'shareTooltip').first().click()
    await c.dialog()
    const dlg = page.locator('[role=dialog]')
    await dlg.getByPlaceholder(t('mapBuilder', 'share.searchPlaceholder')).fill('Vasco')
    await page.waitForTimeout(600)
    await c.shot('share-dialog-search', 'Share map dialog after typing "Vasco" in the search box: only the matching user (Vasco Viewer) is listed, with the level buttons Can view / Can export / Can edit.', { el: '[role=dialog]' })
    const lvl = t('mapBuilder', 'share.permissions.VIEW')
    await dlg.getByRole('button', { name: lvl, exact: true }).first().click()
    await page.waitForTimeout(1200)
    await c.shot('share-dialog-shared', 'Share map dialog after granting Vasco Viewer "Can view": the dark level button shows the current level and an X appears to remove access.', { el: '[role=dialog]' })
    await c.esc()
    await page.setViewportSize({ width: 1280, height: 800 })
  })
  await c.tryStep('delete-dialog', async () => {
    await c.goto('/maps')
    await tab(c, 'mine').click(); await page.waitForTimeout(500)
    await page.setViewportSize(WIDE)
    await rowIcon(page, '(copy)', 'deleteTooltip').first().click()
    await c.dialog()
    await c.shot('map-delete-dialog', 'Delete map confirmation dialog for the user\'s own copy (Cancel pressed; nothing deleted).', { el: '[role=dialog]' })
    await c.esc()
    await page.setViewportSize({ width: 1280, height: 800 })
  })
  // ---- schedules
  const has = psql(`select count(*) from schedules where created_by=(select id from users where email='${email}')`) !== '0'
  await c.goto(`/schedules?mapId=${mid}`)
  await c.tryStep('schedule-dialog', async () => {
    const dlg = await c.dialog()
    await c.shot('schedule-new-dialog', 'New Schedule dialog opened from the Maps list Calendar icon: map preselected, Name, Frequency, Timezone, Output Format, Enabled switch, Save/Cancel.', { el: '[role=dialog]' })
    const cb = dlg.getByRole('combobox')
    await openSelect(page, cb.nth(1))
    await c.shot('schedule-frequency-open', 'New Schedule dialog with the Frequency dropdown open: Daily (midnight), Weekly (Sunday, midnight), Monthly (1st, midnight), Custom.')
    await page.getByRole('option').filter({ hasText: t('schedules', 'cronPresets.custom') }).click()
    await page.waitForTimeout(400)
    await c.shot('schedule-custom-cron', 'New Schedule dialog with Frequency = Custom: a Cron expression field and its help line appear.', { el: '[role=dialog]' })
    await openSelect(page, cb.nth(1))
    await page.getByRole('option').filter({ hasText: t('schedules', 'cronPresets.monthly') }).click()
    await page.waitForTimeout(300)
    const ci = await dlg.getByRole('combobox').count()
    await openSelect(page, dlg.getByRole('combobox').nth(ci - 1))
    await c.shot('schedule-format-open', 'New Schedule dialog with the Output Format dropdown open: Excel (.xlsx) and CSV.')
    await c.esc()
    await openSelect(page, dlg.getByRole('combobox').nth(2))
    await c.shot('schedule-timezone-open', 'New Schedule dialog with the Timezone dropdown open (list of time zones).')
    await c.esc()
    await dlg.getByLabel(t('schedules', 'dialog.nameLabel')).fill('Monthly billing (manual)')
    const en = dlg.getByRole('checkbox', { name: t('schedules', 'dialog.enabledLabel') })
    if ((await en.getAttribute('aria-checked')) === 'true') await en.click()
    await c.shot('schedule-filled', 'New Schedule dialog filled in: name, Monthly (1st, midnight) frequency and the Enabled box unticked so the schedule starts paused.', { el: '[role=dialog]' })
    if (!has) { await dlg.getByRole('button', { name: t('common', 'actions.save') }).click(); await page.waitForTimeout(2000) } else await c.esc()
  })
  await c.goto('/schedules')
  await c.tryStep('pause', async () => {
    const pb = page.getByRole('button', { name: t('schedules', 'table.pause') })
    while (await pb.count()) { await pb.first().click(); await page.waitForTimeout(1500) }
  })
  await c.shot('schedules-list', 'Schedules page with the user\'s schedule (Paused): name, map, schedule (cron), next run, format, status, planner column and the row action icons (Run now, Pause/Enable, History, Edit, Delete).')
  await c.tryStep('schedule-history', async () => {
    await page.getByRole('button', { name: t('schedules', 'table.history') }).first().click()
    await c.dialog()
    await c.shot('schedule-history-dialog', 'Execution History dialog for the schedule (no runs yet: "No runs yet.").', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('schedule-delete', async () => {
    await page.getByRole('button', { name: t('schedules', 'table.delete') }).first().click()
    await c.dialog()
    await c.shot('schedule-delete-dialog', 'Delete schedule confirmation dialog (Cancel pressed; nothing deleted).', { el: '[role=dialog]' })
    await c.esc()
  })
  // ---- runs + exports + dashboard
  await c.goto('/runs')
  await c.shot('runs', 'Runs page for a User: filters (map, status, kind) and the table of the user\'s runs with status, rows, duration, expiry and the Excel/CSV/PDF buttons of completed runs. No "Show every user\'s runs" checkbox.')
  await c.tryStep('runs-filters', async () => {
    const cbs = page.locator('main [role=combobox]')
    await openSelect(page, cbs.nth(1))
    await c.shot('runs-status-open', 'Runs page with the Status filter dropdown open.')
    await c.esc()
    await openSelect(page, cbs.nth(2))
    await c.shot('runs-kind-open', 'Runs page with the Kind filter dropdown open.')
    await c.esc()
  })
  await c.goto('/exports')
  await c.shot('exports', 'Exports page: the user\'s export jobs with map, format, status, rows and creation time and a Download button on completed ones.')
  await c.goto('/dashboard')
  await c.shot('dashboard', 'Dashboard for the User role: welcome heading, KPI cards (Total Maps with "N yours, M shared with you", executions, schedules) and the Recent Maps list.')
}

steps.viewer = async (c) => {
  const { page } = c
  await c.login('VIEWER')
  await c.goto('/dashboard')
  await c.shot('dashboard', 'Dashboard for the Viewer role with the Viewer sidebar (no Data Modeling section, no Migration link): Overview, Maps, Other (Schedules, Runs, Exports) and Settings.')
  await c.goto('/maps')
  await tab(c, 'shared').click(); await page.waitForTimeout(600)
  await c.shot('maps-shared', 'Maps list for a Viewer, tab "Shared with me": row icons are only Open (eye) - no Copy icon on maps or on the workbook rows, no Edit, Share, Schedule, Export or Delete.', { vp: WIDE })
  await tab(c, 'all').click(); await page.waitForTimeout(600)
  await c.shot('maps-all', 'Maps list for a Viewer, tab "All": every map the Viewer may open, again with only the Open icon.', { vp: WIDE })
  await c.goto(`/maps/${MAP}/view`)
  await c.shot('viewer-before-run', 'Map viewer for a Viewer before any run: same layout as for other roles - Run and Schedule management buttons and the empty Results panel.')
  await page.getByRole('button', { name: runLabel(), exact: true }).click()
  await c.dialog()
  { const ins = page.locator('[role=dialog] input'); await ins.nth(0).fill(RUN_PARAMS[0]); await ins.nth(1).fill(RUN_PARAMS[1]) }
  await c.shot('viewer-params-filled', 'Run parameters dialog for a Viewer with Ano = 2020 and produto = 125 filled in.', { el: '[role=dialog]' })
  await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
  await page.getByRole('button', { name: 'Excel', exact: true }).first().waitFor({ timeout: 60000 })
  await c.shot('viewer-results', 'Map viewer for a Viewer after a run: status line, Run again, row/time badges and Excel/CSV/PDF buttons over the blurred grid (no SQL or Plan buttons).')
  await c.goto('/runs')
  await c.shot('runs', 'Runs page for a Viewer: the Viewer\'s own runs only.')
  await c.goto('/exports')
  await c.shot('exports', 'Exports page for a Viewer (own exports; possibly empty: "No exports yet.").')
  await c.goto('/schedules')
  await c.shot('schedules', 'Schedules page for a Viewer: empty list "No schedules yet." with the New Schedule button.')
}

steps.manager = async (c) => {
  const { page } = c
  page.on('dialog', (d) => d.accept())
  await c.login('MANAGER')
  const email = creds.users.MANAGER
  await c.goto('/dashboard')
  await page.setViewportSize({ width: 1280, height: 1150 })
  await c.shot('dashboard-sidebar', 'Dashboard for the Manager role with its sidebar: Overview, Data Modeling (Custom Functions, Data Sources, Users only), Maps, Other (Schedules, Runs, Exports) and Settings. No Business Areas, Folders, Items, Joins, Hierarchies, Security, Audit Log or Migration.')
  await page.setViewportSize({ width: 1280, height: 800 })
  await ensureCopy(c, email)
  await c.goto('/maps')
  await tab(c, 'all').click(); await page.waitForTimeout(600)
  await c.shot('maps-all', 'Maps list for a Manager, tab "All": every map with the Owner column (blurred where it is another person), Copy, Share, Schedule and Export icons on every row, Edit and Delete only on the Manager\'s own map.', { vp: WIDE })
  await c.tryStep('share', async () => {
    await page.setViewportSize(WIDE)
    await rowIcon(page, 'GD_M.M10_V01.DIS', 'shareTooltip').first().click()
    await c.dialog()
    await c.shot('share-dialog', 'Share map dialog opened by a Manager on a map they do not own: search box, hint line and the user list with Can view / Can export / Can edit buttons (names other than the test accounts blurred).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('workbook-share', async () => {
    await page.setViewportSize(WIDE)
    await page.locator('[aria-label="' + t('mapViewer', 'workbookShare.shareButton') + '"]').first().click()
    await c.dialog()
    await c.shot('workbook-share-dialog', 'Share workbook dialog for a Manager: description "Give someone every worksheet in this workbook", user list and the "n of m worksheets" detail per person.', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('workbook-list', async () => {
    await page.setViewportSize(WIDE)
    await c.shot('workbooks-icons', 'Top of the Maps page for a Manager: Workbooks card with Share workbook, Copy workbook and Delete workbook icons on each workbook row.')
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const [p, slug, d] of [
    ['/admin/users', 'users', 'Users page for a Manager: read-only list (no "Credentials file" or "New User" buttons); the only row icon is "Maps this user can open". Real users blurred.'],
    ['/admin/data-sources', 'data-sources', 'Data Sources page for a Manager: the list and the read-only row icons; creating, editing and deleting are refused by the server.'],
    ['/admin/custom-functions', 'custom-functions', 'Custom Functions page for a Manager: full page with the list, Refresh all and New Function.'],
    ['/schedules', 'schedules', 'Schedules page for a Manager: own schedules only.'],
    ['/runs', 'runs', 'Runs page for a Manager: own runs only, without the "Show every user\'s runs" checkbox.'],
  ]) {
    await c.tryStep(slug, async () => { await c.goto(p); await c.shot(slug, d) })
  }
  await c.tryStep('users-maps', async () => {
    await c.goto('/admin/users')
    const nx = page.getByRole('button', { name: t('common', 'actions.next') })
    for (let i = 0; i < 3; i++) { if (await nx.isEnabled()) { await nx.click(); await page.waitForTimeout(800) } }
    await page.getByRole('row').filter({ hasText: 'Ursula User' }).getByRole('button', { name: t('admin', 'users.maps.button') }).click()
    await c.dialog()
    await c.shot('users-maps-dialog', 'Maps for a user dialog (Manager): the list of maps that user can open with badges, share-level select and owner/remove icons (user name blurred).', { el: '[role=dialog]' })
    await c.esc()
  })
}


async function chooseOpt(page, trigger, text) {
  await openSelect(page, trigger)
  const o = text ? page.getByRole('option', { name: text, exact: true }).first() : page.getByRole('option').first()
  await o.click(); await page.waitForTimeout(900)
}
const mainCb = (page, i) => page.locator('main [role=combobox]').nth(i)
const A = (k) => t('admin', k)

steps.admin = async (c) => {
  const { page } = c
  page.on('dialog', (d) => d.accept())
  await c.login('ADMIN')
  // ---------- dashboard / sidebar
  await c.goto('/dashboard')
  await page.setViewportSize({ width: 1280, height: 1150 })
  await c.shot('dashboard-sidebar', 'Dashboard for the Administrator with the full sidebar: Overview, Data Modeling (Business Areas, Folders, Items, Joins, Hierarchies, Custom Functions, Data Sources, Users, Security, Audit Log), Maps, Other (Schedules, Runs, Exports, Migration) and Settings; KPI cards and Recent Maps.')
  await page.setViewportSize({ width: 1280, height: 800 })
  // ---------- maps
  await c.goto('/maps')
  await tab(c, 'all').click(); await page.waitForTimeout(600)
  await c.shot('maps-all', 'Maps list for an Administrator, tab "All": every map, with Edit, Copy, Share, Schedule, Export and Delete icons on every row and the Workbooks card (Share, Copy, Delete workbook icons) above.', { vp: WIDE })
  // ---------- viewer with SQL/Plan
  await c.goto(`/maps/${MAP}/view`)
  await page.getByRole('button', { name: runLabel(), exact: true }).click()
  await c.dialog()
  { const ins = page.locator('[role=dialog] input'); await ins.nth(0).fill('2021'); await ins.nth(1).fill('125') }
  await page.getByRole('dialog').getByRole('button', { name: runLabel(), exact: true }).click()
  await page.getByRole('button', { name: 'Excel', exact: true }).first().waitFor({ timeout: 60000 })
  await c.shot('viewer-results', 'Map viewer for an Administrator after a run: identical to a User\'s except the results header also shows the SQL and Plan buttons next to Excel / CSV / PDF.')
  // ---------- runs
  await c.goto('/runs')
  await c.tryStep('runs', async () => {
    const cb = page.getByRole('checkbox').first()
    if (await cb.count()) { await cb.click(); await page.waitForTimeout(1500) }
    await c.shot('runs-every-user', 'Runs page for an Administrator with the "Show every user\'s runs" box ticked: runs of all accounts are listed (other people\'s rows blurred where they show names).')
  })
  await c.goto('/exports')
  await c.shot('exports', 'Exports page for an Administrator: own export jobs only (no owner column).')
  // ---------- business areas
  await c.goto('/admin/business-areas')
  await c.shot('business-areas', 'Business Areas page (Administrator): table of areas with status and created date, New Business Area button and per-row icons Manage grants, Edit, Delete.')
  await c.tryStep('ba-new', async () => {
    await page.getByRole('button', { name: A('businessAreas.createButton') }).click()
    const d = await c.dialog()
    await d.locator('input').first().fill('Example area')
    await c.shot('business-areas-new', 'New Business Area dialog: Name and Description fields, Save and Cancel (Cancel pressed).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('ba-grants', async () => {
    await page.getByRole('button', { name: A('businessAreas.manageGrantsTitle') }).first().click()
    await c.dialog()
    await c.shot('business-areas-grants', 'Manage grants dialog for a business area: users with checkboxes / current grants and the Permission select.', { el: '[role=dialog]' })
    const cb = page.locator('[role=dialog] [role=combobox]').last()
    await openSelect(page, cb)
    await c.shot('business-areas-grants-permission', 'Manage grants dialog with the Permission select open: VIEW, EXPORT, SCHEDULE, CREATE, EDIT, DELETE.')
    await c.esc(); await c.esc()
  })
  // ---------- folders
  await c.goto('/admin/folders')
  await c.shot('folders-empty', 'Folders page before choosing a business area: Business Area select showing "Select a business area", prompt text and the disabled New Folder / Refresh all buttons.')
  await c.tryStep('folders-list', async () => {
    await chooseOpt(page, mainCb(page, 0), 'DC')
    await c.shot('folders', 'Folders page with business area DC selected: table of folders with type, data source and row icons (Refresh from data source, Manage business areas, Edit, Delete).')
  })
  await c.tryStep('folders-wizard', async () => {
    await page.getByRole('button', { name: A('folders.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('folders-new-dialog', 'New Folder dialog (wizard) at the start: Folder Type, Data Source and name fields.', { el: '[role=dialog]' })
    const cbs = d.getByRole('combobox')
    await c.tryStep('folder-type', async () => { await openSelect(page, cbs.first()); await c.shot('folders-type-open', 'New Folder dialog with the Folder Type select open (Table, View, Complex...).'); await c.esc() })
    await c.tryStep('folder-ds', async () => {
      await chooseOpt(page, cbs.nth(1), null)
      const b = d.getByRole('button', { name: A('shared.discoverTablesButton') })
      await b.click(); await d.getByPlaceholder(A('folders.form.searchObjectsPlaceholder')).waitFor({ timeout: 90000 })
      await c.shot('folders-discovered', 'New Folder dialog after choosing a data source and pressing Discover Tables: filter box and the list of tables found.', { el: '[role=dialog]', vp: { width: 1280, height: 1500 } })
      await d.locator('div.overflow-y-auto button').nth(2).click()
      await page.waitForTimeout(1500)
      await c.shot('folders-picked', 'New Folder dialog after picking a table: "Items to create (n)" checklist with Select all / Clear.', { el: '[role=dialog]', vp: { width: 1280, height: 1500 } })
    })
    await c.esc()
  })
  await c.tryStep('folders-sharing', async () => {
    await page.getByRole('button', { name: A('folders.manageSharing') }).first().click()
    await c.dialog()
    await c.shot('folders-sharing', 'Business areas dialog for a folder: owner badge, share badges with X, "Share into" select and the Share button.', { el: '[role=dialog]' })
    await c.esc()
  })
  // ---------- items
  await c.goto('/admin/items')
  await c.tryStep('items', async () => {
    await chooseOpt(page, mainCb(page, 0), 'DC')
    await chooseOpt(page, mainCb(page, 1), null)
    await c.shot('items', 'Items page with a business area and folder selected: table with Type, Column, Data Type and Aggregation columns.')
  })
  await c.tryStep('items-new', async () => {
    await page.getByRole('button', { name: A('items.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('items-new-dialog', 'New Item dialog: name, Item Type (Database Item), column name, aggregation.', { el: '[role=dialog]' })
    await openSelect(page, d.getByRole('combobox').first())
    await c.shot('items-type-open', 'New Item dialog with the Item Type select open showing the seven item types.')
    await c.esc(); await c.esc()
  })
  // ---------- joins
  await c.goto('/admin/joins')
  await c.tryStep('joins', async () => {
    await chooseOpt(page, mainCb(page, 0), 'DC')
    await c.shot('joins', 'Joins page with business area DC selected: table of joins (multi-column joins shown as "a = b AND c = d").')
  })
  await c.tryStep('joins-new', async () => {
    await page.getByRole('button', { name: A('joins.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('joins-new-dialog', 'New Join dialog: two folder selects, Suggest Joins button, column pairs, operator and Join Type.', { el: '[role=dialog]' })
    await c.tryStep('join-op', async () => {
      await openSelect(page, d.getByRole('combobox').filter({ hasText: '=' }).first())
      await c.shot('joins-operator-open', 'New Join dialog with the operator select (between the Left Item and Right Item selects) open: the six comparison operators.')
      await c.esc()
    })
    await c.tryStep('join-type', async () => {
      const cbs = d.getByRole('combobox')
      const n = await cbs.count()
      await openSelect(page, cbs.nth(n - 1))
      await c.shot('joins-select-open', 'New Join dialog with the last select (Join Type / operator) open.')
      await c.esc()
    })
    await c.esc()
  })
  // ---------- hierarchies
  await c.goto('/admin/hierarchies')
  await c.tryStep('hier', async () => {
    await chooseOpt(page, mainCb(page, 0), 'DC')
    await c.shot('hierarchies', 'Hierarchies page with business area DC selected: table of hierarchies with "n level(s)".')
  })
  await c.tryStep('hier-new', async () => {
    await page.getByRole('button', { name: A('hierarchies.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('hierarchies-new-dialog', 'New Hierarchy dialog with no levels yet: message "No levels yet - add at least one." and disabled Save.', { el: '[role=dialog]' })
    await d.getByRole('button', { name: A('hierarchies.form.addLevelButton') }).click().catch(() => {})
    await page.waitForTimeout(500)
    await c.shot('hierarchies-level-added', 'New Hierarchy dialog after Add Level: a level row with drag handle, name, folder and item selects.', { el: '[role=dialog]' })
    await c.esc()
  })
  // ---------- custom functions
  await c.goto('/admin/custom-functions')
  await c.shot('custom-functions', 'Custom Functions page: filter box, Refresh all, New Function, table of functions with type, database function, data source, parameters and return type; pagination.')
  await c.tryStep('cf-new', async () => {
    await page.getByRole('button', { name: A('customFunctions.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('custom-functions-new-dialog', 'New Custom Function dialog: data source, search and the function fields.', { el: '[role=dialog]', vp: { width: 1280, height: 1500 } })
    await c.tryStep('cf-search', async () => {
      await d.getByPlaceholder(A('customFunctions.search.searchPlaceholder')).fill('FUN_ACERTO')
      await d.getByRole('button', { name: A('customFunctions.search.button'), exact: true }).click()
      await page.waitForTimeout(6000)
      await c.shot('custom-functions-search-results', 'New Custom Function dialog after searching for "FUN_ACERTO": the matching database functions listed below the search box.', { el: '[role=dialog]', vp: { width: 1280, height: 1500 } })
    })
    await c.esc()
  })
  // ---------- data sources
  await c.goto('/admin/data-sources')
  await c.shot('data-sources', 'Data Sources page: table with type, host, status, created; row icons Test connection, Introspect schema, Import tables, Edit, Delete.')
  await c.tryStep('ds-new', async () => {
    await page.getByRole('button', { name: A('dataSources.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('data-sources-new-dialog', 'New Data Source dialog: name, Connection Type, host, port, service name / SID (Oracle), user and password.', { el: '[role=dialog]' })
    await openSelect(page, d.getByRole('combobox').first())
    await c.shot('data-sources-type-open', 'New Data Source dialog with the Connection Type select open.')
    await c.esc(); await c.esc()
  })
  await c.tryStep('ds-edit', async () => {
    await page.getByRole('button', { name: t('common', 'actions.edit'), exact: true }).first().click()
    await c.dialog()
    await c.shot('data-sources-edit-dialog', 'Edit Data Source dialog: Password field with the "(leave blank to keep)" hint (Cancel pressed).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('ds-import', async () => {
    await page.getByRole('button', { name: A('dataSources.actions.importTables') }).first().click()
    const d = await c.dialog()
    await c.shot('data-sources-import-dialog', 'Import Tables dialog: Discover Tables button and "No tables discovered yet." (Cancel pressed; nothing imported).', { el: '[role=dialog]' })
    await c.esc()
  })
  // ---------- users
  await c.goto('/admin/users')
  await c.shot('users', 'Users page (Administrator): Credentials file and New User buttons; table of users with role and status (real users blurred; test accounts readable) and row icons Maps, Edit, Deactivate, Delete.')
  await c.tryStep('users-new', async () => {
    await page.getByRole('button', { name: A('users.createButton') }).first().click()
    const d = await c.dialog()
    await c.shot('users-new-dialog', 'New User dialog: Name, Email, Password and Role.', { el: '[role=dialog]' })
    await openSelect(page, d.getByRole('combobox').first())
    await c.shot('users-role-open', 'New User dialog with the Role select open showing the four roles and their descriptions.')
    await c.esc(); await c.esc()
  })
  const toLast = async () => { const nx = page.getByRole('button', { name: t('common', 'actions.next') }); for (let i = 0; i < 3; i++) { if (await nx.isEnabled()) { await nx.click(); await page.waitForTimeout(800) } } }
  await toLast()
  await c.tryStep('users-edit', async () => {
    const row = page.getByRole('row').filter({ hasText: 'Vasco Viewer' })
    await row.getByRole('button', { name: t('admin', 'users.editTooltip') }).click()
    await c.dialog()
    await c.shot('users-edit-dialog', 'Edit User dialog for the Viewer test account: Password label with the "(leave blank to keep current)" hint (Cancel pressed).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('users-deactivate', async () => {
    const row = page.getByRole('row').filter({ hasText: 'Vasco Viewer' })
    await row.getByRole('button', { name: A('users.status.deactivate') }).click()
    await c.dialog()
    await c.shot('users-deactivate-dialog', 'Deactivate confirmation dialog for a user (Cancel pressed; nothing changed).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('users-delete', async () => {
    const row = page.getByRole('row').filter({ hasText: 'Vasco Viewer' })
    await row.getByRole('button', { name: t('admin', 'users.deleteTooltip') }).click()
    await c.dialog()
    await c.shot('users-delete-dialog', 'Delete user confirmation dialog showing its wording (Cancel pressed; nothing deleted).', { el: '[role=dialog]' })
    await c.esc()
  })
  await c.tryStep('users-maps', async () => {
    const row = page.getByRole('row').filter({ hasText: 'Ursula User' })
    await row.getByRole('button', { name: A('users.maps.button') }).click()
    await c.dialog()
    await c.shot('users-maps-dialog', 'Maps for Ursula User dialog: each map with owner line, "via" badge (Owner/Shared/Public), share-level select and the owner/remove icons.', { el: '[role=dialog]' })
    await c.tryStep('newowner', async () => {
      await page.locator('[role=dialog]').getByRole('button', { name: A('users.maps.changeOwnerTooltip') }).first().click()
      await page.waitForTimeout(600)
      await c.shot('users-maps-new-owner', 'Maps dialog with the "New owner" picker expanded (user list blurred except test accounts).', { el: '[role=dialog]' })
    })
    await c.esc()
  })
  // ---------- security
  await c.goto('/admin/security')
  await c.shot('security', 'Security Policies page (Administrator): description, Test and New Policy buttons and the empty table with the fail-closed message.')
  await c.tryStep('security-new', async () => {
    await page.getByRole('button', { name: t('security', 'page.newPolicy') }).first().click()
    const d = await c.dialog()
    await c.shot('security-new-dialog', 'New Policy dialog: name, description and rules (Applies to, target, predicate) with Validate and Binds help.', { el: '[role=dialog]' })
    await c.tryStep('sec-applies', async () => {
      await openSelect(page, d.getByRole('combobox').first())
      await c.shot('security-applies-open', 'New Policy dialog with the rule "Applies to" select open: Business Area / Folder.')
      await c.esc()
    })
    await c.tryStep('sec-validate', async () => {
      await d.locator('textarea').last().fill('1 = 1')
      await d.getByRole('button', { name: /Validate|Validar|Valider/ }).click()
      await page.waitForTimeout(2500)
      await c.shot('security-validate', 'New Policy dialog after typing the predicate 1 = 1 and pressing Validate: the validation result message under the predicate (nothing saved).', { el: '[role=dialog]' })
    })
    await c.esc()
  })
  // ---------- audit
  await c.goto('/admin/audit')
  await c.shot('audit', 'Audit Log page top: Export CSV, three stat cards (total actions, top actions, actions per day chart) and the Filters section.')
  await c.tryStep('audit-table', async () => {
    await page.evaluate(() => document.querySelector('main')?.scrollTo?.(0, 99999))
    await page.mouse.wheel(0, 1500); await page.waitForTimeout(800)
    await c.shot('audit-table', 'Audit Log page scrolled: filters row (User, Action, dates), the entries table and the pagination (user names and e-mails blurred).')
  })
  await c.tryStep('audit-details', async () => {
    await page.getByRole('button', { name: t('audit', 'table.viewDetails') }).first().click()
    await c.dialog()
    await c.shot('audit-details-dialog', 'Audit entry details dialog: the JSON of the entry (may include e-mails/user names - blurred).', { el: '[role=dialog]' })
    await c.esc()
  })
  // ---------- migration
  await c.goto('/admin/migration')
  await c.shot('migration', 'Migration page (Administrator): Source card with the Oracle data source select, EUL schema owner, EUL version, Detect version, Analyze, Dry run checkbox, Run dry run, Re-import maps, Re-import everything, Compile calculated fields and their help text. Nothing was run.')
  await c.tryStep('mig-version', async () => {
    const cbs = page.locator('main [role=combobox]')
    await openSelect(page, cbs.nth(1))
    await c.shot('migration-eul-version-open', 'Migration page with the EUL version select open: Auto-detect, Force EUL4, Force EUL5.')
    await c.esc()
  })
  await c.tryStep('mig-live', async () => {
    const cb = page.getByRole('checkbox').first()
    await cb.click(); await page.waitForTimeout(500)
    await c.shot('migration-live', 'Migration page with Dry run unticked: the main button reads "Run migration" and a warning about writing live data appears (nothing was run).')
  })
}

//__STEPS__
main().catch((e) => { console.error(e); process.exit(1) })
