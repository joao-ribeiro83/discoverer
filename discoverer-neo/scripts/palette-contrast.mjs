// Generates the derived colour palettes under frontend/src/styles/palettes/
// and prints the WCAG contrast ratios each file documents.
//
//   node scripts/palette-contrast.mjs            # print ratios only
//   node scripts/palette-contrast.mjs --write    # rewrite the generated .css files
//
// navy.css is hand-tuned from Allianz Trade's tokens and is NOT generated here;
// the palettes below reuse its lightness/chroma steps and only move the hue.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function oklchToRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)))
}
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
function ratio(c1, c2) {
  const a = luminance(oklchToRgb(...c1))
  const b = luminance(oklchToRgb(...c2))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
const ok = (L, C, h) => `oklch(${L} ${C} ${h})`

// Status colours are semantics, not brand: identical to navy.css in every palette.
const STATUS_LIGHT = {
  destructive: [0.575, 0.205, 19.2],
  success: [0.528, 0.142, 150.5],
  warning: [0.554, 0.18, 84.4],
  info: [0.552, 0.125, 239.5],
}
const STATUS_DARK = {
  destructive: [0.66, 0.19, 19.2],
  success: [0.66, 0.15, 150.5],
  warning: [0.7, 0.15, 84.4],
  info: [0.72, 0.1, 239.5],
}

export const PALETTES = [
  {
    id: 'forest',
    hue: 155,
    L: 0.34,
    C: 0.08,
    midL: 0.52,
    midC: 0.11,
    hoverL: 0.42,
    blurb: 'deep evergreen — ledger-paper and bank-note green, a quieter read than navy.',
  },
  {
    id: 'wine',
    hue: 5,
    L: 0.36,
    C: 0.12,
    midL: 0.52,
    midC: 0.15,
    hoverL: 0.44,
    blurb: 'Douro red — a dark burgundy primary with a warm crimson accent.',
  },
  {
    id: 'ocean',
    hue: 205,
    L: 0.38,
    C: 0.09,
    midL: 0.51,
    midC: 0.11,
    hoverL: 0.46,
    blurb: 'Atlantic teal — a cool blue-green primary; the chart series rotate with it.',
  },
  {
    id: 'ochre',
    hue: 62,
    L: 0.4,
    C: 0.08,
    midL: 0.56,
    midC: 0.11,
    hoverL: 0.48,
    blurb: 'warm ochre — brown-amber in the register of cork and the old printed manuals; the one warm option.',
  },
]

function tokens(p) {
  const h = p.hue
  const rot = (deg) => (h + deg) % 360
  const light = {
    primary: [p.L, p.C, h],
    'primary-foreground': [0.985, 0, 0],
    secondary: [0.93, 0.02, h],
    'secondary-foreground': [0.3, 0.11, h],
    accent: [0.93, 0.02, h],
    'accent-foreground': [p.L, p.C, h],
    ...STATUS_LIGHT,
    border: [0.912, 0.008, h],
    input: [0.912, 0.008, h],
    ring: [p.midL, p.midC, h],
    'chart-1': [p.midL, p.midC, h],
    'chart-2': [0.63, 0.1, rot(60)],
    'chart-3': [0.53, 0.14, rot(150)],
    'chart-4': [0.56, 0.17, rot(210)],
    'chart-5': [0.47, 0.13, rot(300)],
    sidebar: [p.L, p.C, h],
    'sidebar-foreground': [0.985, 0, 0],
    'sidebar-primary': [p.midL, p.midC, h],
    'sidebar-primary-foreground': [0.985, 0, 0],
    'sidebar-accent': [p.hoverL, 0.1, h],
    'sidebar-accent-foreground': [0.985, 0, 0],
    'sidebar-border': [Math.round((p.L + 0.3) * 100) / 100, 0.08, h],
    'sidebar-ring': [p.midL, p.midC, h],
  }
  const dark = {
    primary: [0.74, 0.09, h],
    'primary-foreground': [0.16, 0.03, h],
    secondary: [0.28, 0.05, h],
    'secondary-foreground': [0.9, 0.02, h],
    accent: [0.28, 0.05, h],
    'accent-foreground': [0.9, 0.02, h],
    ...STATUS_DARK,
    border: [0.28, 0.02, h],
    input: [0.28, 0.02, h],
    ring: [0.65, 0.11, h],
    'chart-1': [0.74, 0.1, h],
    'chart-2': [0.7, 0.09, rot(60)],
    'chart-3': [0.66, 0.15, rot(150)],
    'chart-4': [0.68, 0.16, rot(210)],
    'chart-5': [0.62, 0.12, rot(300)],
    sidebar: [0.184, 0.038, h],
    'sidebar-foreground': [0.985, 0, 0],
    'sidebar-primary': [0.65, 0.11, h],
    'sidebar-primary-foreground': [0.145, 0, 0],
    'sidebar-accent': [0.26, 0.05, h],
    'sidebar-accent-foreground': [0.985, 0, 0],
    'sidebar-border': [0.53, 0.06, h],
    'sidebar-ring': [0.65, 0.11, h],
  }
  return { light, dark }
}

// Text pairs must clear AA (4.5:1); the last two are non-text UI boundaries (3:1).
const PAIRS = [
  ['primary-foreground/primary', 'primary-foreground', 'primary', 4.5],
  ['secondary-foreground/secondary', 'secondary-foreground', 'secondary', 4.5],
  ['accent-foreground/accent', 'accent-foreground', 'accent', 4.5],
  ['sidebar-foreground/sidebar', 'sidebar-foreground', 'sidebar', 4.5],
  ['sidebar-primary-foreground/sidebar-primary', 'sidebar-primary-foreground', 'sidebar-primary', 4.5],
  ['sidebar-accent-foreground/sidebar-accent', 'sidebar-accent-foreground', 'sidebar-accent', 4.5],
  ['sidebar/sidebar-border (UI boundary)', 'sidebar', 'sidebar-border', 3],
  ['ring/background (UI boundary)', 'ring', 'background', 3],
]

function check(t, background) {
  const withBg = { ...t, background }
  return PAIRS.map(([name, a, b, floor]) => {
    const r = ratio(withBg[a], withBg[b])
    return { name, r, pass: r >= floor }
  })
}

function render(p) {
  const { light, dark } = tokens(p)
  const lightChecks = check(light, [1, 0, 0])
  const darkChecks = check(dark, [0.145, 0, 0])
  const line = (label, c) => ` *   ${label} ${c.name.padEnd(44)} ${c.r.toFixed(2)}:1`
  const block = (sel, t) =>
    `${sel} {\n${Object.entries(t)
      .map(([k, v]) => `  --${k}: ${ok(...v)};`)
      .join('\n')}\n}\n`
  const css = `/*
 * '${p.id}' color palette — ${p.blurb}
 *
 * GENERATED by scripts/palette-contrast.mjs — edit the PALETTES entry there,
 * not this file. Same shape and lightness/chroma steps as navy.css (which
 * documents the method); only the brand hue moves (${p.hue}°).
 * --background/--foreground/--card/--muted stay as light.css/dark.css define
 * them, and destructive/success/warning/info are navy.css's exact values —
 * they are semantics, not brand, so every palette shares them.
 *
 * Deliberately has NO [data-theme='high-contrast'] variant, for the reason
 * navy.css gives.
 *
 * WCAG contrast (OKLCH -> linear sRGB -> relative luminance, computed):
 *
${lightChecks.map((c) => line('LIGHT', c)).join('\n')}
${darkChecks.map((c) => line('DARK ', c)).join('\n')}
 */

${block(`[data-theme='light'][data-palette='${p.id}']`, light)}
${block(`[data-theme='dark'][data-palette='${p.id}']`, dark)}`
  return { css, failures: [...lightChecks, ...darkChecks].filter((c) => !c.pass) }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(here, '..', 'frontend', 'src', 'styles', 'palettes')
const write = process.argv.includes('--write')
let failed = false
for (const p of PALETTES) {
  const { css, failures } = render(p)
  if (write) fs.writeFileSync(path.join(outDir, `${p.id}.css`), css)
  const status = failures.length === 0 ? 'ok' : `FAIL ${failures.map((f) => `${f.name}=${f.r.toFixed(2)}`).join(', ')}`
  console.log(`${p.id.padEnd(8)} ${status}`)
  if (failures.length) failed = true
}
process.exit(failed ? 1 : 0)
