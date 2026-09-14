import { stringifyCell } from '@/lib/worksheet-format'
import type { ResultConditionalFormat } from '@/lib/types'

/**
 * Evaluate a conditional format rule (Discoverer's Exception) against one
 * cell value, client-side. Rules are a display decision over rows the query
 * already returned — not something the query computes — so this mirrors the
 * `map_operator` enum's semantics in plain JS rather than reusing the SQL
 * generator's WHERE-clause builder, which emits SQL text, not a boolean.
 */

function toComparable(value: unknown): number | string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const n = Number(value)
    return value.trim() !== '' && !Number.isNaN(n) ? n : value
  }
  return stringifyCell(value)
}

/** -1 / 0 / 1, comparing numerically when both sides parse as numbers, else as strings. */
function compare(cellValue: unknown, ruleOperand: string): number {
  const a = toComparable(cellValue)
  const b = toComparable(ruleOperand)
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0
  const sa = stringifyCell(cellValue)
  const sb = ruleOperand
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/** Oracle `LIKE`: `%` = any run of characters, `_` = exactly one. */
function likeMatches(cellValue: unknown, pattern: string): boolean {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')
  return regex.test(stringifyCell(cellValue))
}

/** Evaluate one rule's operator/value against one cell. */
export function evaluateConditionalFormat(
  rule: Pick<ResultConditionalFormat, 'operator' | 'value'>,
  cellValue: unknown,
): boolean {
  const { operator, value } = rule
  if (!operator) return false
  if (operator === 'IS_NULL') return cellValue === null || cellValue === undefined || cellValue === ''
  if (cellValue === null || cellValue === undefined) return false
  if (value === null) return false

  switch (operator) {
    case 'BETWEEN': {
      const [lo, hi] = value.split(',').map((s) => s.trim())
      if (lo === undefined || hi === undefined) return false
      return compare(cellValue, lo) >= 0 && compare(cellValue, hi) <= 0
    }
    case 'IN':
      return value
        .split(',')
        .map((s) => s.trim())
        .some((v) => compare(cellValue, v) === 0)
    case 'LIKE':
      return likeMatches(cellValue, value)
    case '=':
      return compare(cellValue, value) === 0
    case '<>':
      return compare(cellValue, value) !== 0
    case '>':
      return compare(cellValue, value) > 0
    case '<':
      return compare(cellValue, value) < 0
    case '>=':
      return compare(cellValue, value) >= 0
    case '<=':
      return compare(cellValue, value) <= 0
    default:
      return false
  }
}

export interface AppliedFormat {
  backgroundColor?: string
  color?: string
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
}

/** Merge every matching rule's style, in display order — a later rule wins a property a earlier one also set. */
function mergeStyles(rules: ResultConditionalFormat[]): AppliedFormat {
  const style: AppliedFormat = {}
  for (const rule of [...rules].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (rule.backgroundColor) style.backgroundColor = rule.backgroundColor
    if (rule.textColor) style.color = rule.textColor
    if (rule.isBold) style.fontWeight = 'bold'
    if (rule.isItalic) style.fontStyle = 'italic'
    if (rule.isUnderline) style.textDecoration = 'underline'
  }
  return style
}

/**
 * The style a specific cell should carry: its own CELL-target rules, plus
 * every ROW-target rule whose own test column matched anywhere in the row.
 */
export function styleForCell(
  columnName: string,
  row: Record<string, unknown>,
  rules: ResultConditionalFormat[],
): AppliedFormat {
  const matched = rules.filter((rule) => {
    if (!rule.targetAlias) return false
    if (!evaluateConditionalFormat(rule, row[rule.targetAlias])) return false
    return rule.target === 'ROW' || rule.targetAlias === columnName
  })
  return mergeStyles(matched)
}

/** True when any ROW-target rule matches this row — callers use this to style the row shell, not just cells. */
export function rowHasMatch(row: Record<string, unknown>, rules: ResultConditionalFormat[]): boolean {
  return rules.some(
    (rule) =>
      rule.target === 'ROW' &&
      rule.targetAlias &&
      evaluateConditionalFormat(rule, row[rule.targetAlias]),
  )
}
