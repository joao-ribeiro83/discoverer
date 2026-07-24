#!/usr/bin/env node
// Verifies a locale's translation JSON against the `en` baseline:
//   - every key present in en exists in the locale (and vice versa)
//   - every placeholder token in an en value survives, unchanged, in the translation
//   - no translated value is empty
//
// Usage: node scripts/i18n-check.mjs <locale> [<locale> ...]
// Exits non-zero if any namespace has issues.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = path.resolve(__dirname, '../frontend/src/locales')
const PLACEHOLDER_RE = /\{\{\s*[\w.]+\s*\}\}|%s|\{\d+\}/g

function loadJson(locale, namespace) {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function namespacesFromEn() {
  return readdirSync(path.join(LOCALES_DIR, 'en'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
}

/** Recursively walk an object, calling onLeaf(keyPath, value) for every string leaf. */
function walkLeaves(obj, keyPath, onLeaf) {
  for (const [k, v] of Object.entries(obj)) {
    const nextPath = keyPath ? `${keyPath}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      walkLeaves(v, nextPath, onLeaf)
    } else {
      onLeaf(nextPath, v)
    }
  }
}

function collectKeySet(obj) {
  const keys = new Set()
  walkLeaves(obj, '', (keyPath) => keys.add(keyPath))
  return keys
}

function getByPath(obj, keyPath) {
  return keyPath.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj)
}

function checkNamespace(locale, namespace) {
  const issues = []
  let enJson
  let localeJson
  try {
    enJson = loadJson('en', namespace)
  } catch (err) {
    issues.push(`could not load en/${namespace}.json: ${err.message}`)
    return issues
  }
  try {
    localeJson = loadJson(locale, namespace)
  } catch (err) {
    issues.push(`could not load ${locale}/${namespace}.json: ${err.message}`)
    return issues
  }

  const enKeys = collectKeySet(enJson)
  const localeKeys = collectKeySet(localeJson)

  for (const key of enKeys) {
    if (!localeKeys.has(key)) issues.push(`missing key "${key}"`)
  }
  for (const key of localeKeys) {
    if (!enKeys.has(key)) issues.push(`extra key "${key}" not present in en`)
  }

  for (const key of enKeys) {
    if (!localeKeys.has(key)) continue
    const enValue = getByPath(enJson, key)
    const localeValue = getByPath(localeJson, key)

    if (typeof localeValue !== 'string') {
      issues.push(`value at "${key}" is not a string`)
      continue
    }
    if (localeValue.trim() === '') {
      issues.push(`empty value at "${key}"`)
    }

    if (typeof enValue === 'string') {
      const enTokens = (enValue.match(PLACEHOLDER_RE) ?? []).sort()
      const localeTokens = (localeValue.match(PLACEHOLDER_RE) ?? []).sort()
      const enTokenSet = enTokens.join('|')
      const localeTokenSet = localeTokens.join('|')
      if (enTokenSet !== localeTokenSet) {
        issues.push(
          `placeholder mismatch at "${key}": en has [${enTokens.join(', ')}], ${locale} has [${localeTokens.join(', ')}]`,
        )
      }
    }
  }

  return issues
}

function checkLocale(locale) {
  const namespaces = namespacesFromEn()
  let totalIssues = 0
  for (const namespace of namespaces) {
    const issues = checkNamespace(locale, namespace)
    if (issues.length === 0) {
      console.log(`  ✓ ${namespace}`)
    } else {
      totalIssues += issues.length
      console.log(`  ✗ ${namespace} (${issues.length} issue${issues.length === 1 ? '' : 's'})`)
      for (const issue of issues) console.log(`      - ${issue}`)
    }
  }
  return totalIssues
}

const locales = process.argv.slice(2)
if (locales.length === 0) {
  console.error('Usage: node scripts/i18n-check.mjs <locale> [<locale> ...]')
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
