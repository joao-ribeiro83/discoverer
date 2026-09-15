#!/usr/bin/env node
// Verifies every localized doc category has the same set of files in each
// locale as the English baseline (file existence only — content is a human
// translation review, not something a script can grade).
//
// Only admin-guide/, user-guide/ and troubleshooting/ are localized by
// convention (developer-guide, api, deployment, migration, decisions and the
// master-plan are engineer/ops-facing and stay English-only). If a new
// category should be localized, add it to LOCALIZED_CATEGORIES below.
//
// Usage: node scripts/docs-i18n-check.mjs <locale> [<locale> ...]
// Exits non-zero if any locale is missing a file the en baseline has.

import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.resolve(__dirname, '../docs')
const LOCALIZED_CATEGORIES = ['admin-guide', 'user-guide', 'troubleshooting']

function filesIn(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

function checkLocale(locale) {
  let issues = 0
  for (const category of LOCALIZED_CATEGORIES) {
    const enFiles = filesIn(path.join(DOCS_DIR, category))
    const localeDir = path.join(DOCS_DIR, locale, category)
    const localeFiles = new Set(filesIn(localeDir))

    const missing = enFiles.filter((f) => !localeFiles.has(f))
    const extra = [...localeFiles].filter((f) => !enFiles.includes(f))

    if (missing.length === 0 && extra.length === 0) {
      console.log(`  ✓ ${category} (${enFiles.length} files)`)
    } else {
      issues += missing.length + extra.length
      console.log(`  ✗ ${category}`)
      for (const f of missing) console.log(`      - missing docs/${locale}/${category}/${f}`)
      for (const f of extra) console.log(`      - extra docs/${locale}/${category}/${f} (not in en)`)
    }
  }
  return issues
}

const locales = process.argv.slice(2)
if (locales.length === 0) {
  console.error('Usage: node scripts/docs-i18n-check.mjs <locale> [<locale> ...]')
  process.exit(2)
}

let grandTotal = 0
for (const locale of locales) {
  console.log(`\n${locale}:`)
  grandTotal += checkLocale(locale)
}

console.log()
if (grandTotal > 0) {
  console.log(`FAILED: ${grandTotal} issue(s) found.`)
  process.exit(1)
} else {
  console.log('All checks passed.')
}
