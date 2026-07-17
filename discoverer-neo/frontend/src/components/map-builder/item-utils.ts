import type { ItemType } from '@/lib/types'

export type ItemRole = 'dimension' | 'measure'

const NUMERIC_TYPE_HINTS = [
  'NUMBER',
  'NUMERIC',
  'INTEGER',
  'INT',
  'FLOAT',
  'DECIMAL',
  'DOUBLE',
  'REAL',
  'MONEY',
  'BIGINT',
  'SMALLINT',
]

export function isNumericType(dataType: string | null | undefined): boolean {
  if (!dataType) return false
  const t = dataType.toUpperCase()
  return NUMERIC_TYPE_HINTS.some((hint) => t.includes(hint))
}

/**
 * Classify an item as a dimension (grouping/axis) or a measure (aggregatable
 * data point). Mirrors Discoverer's axis-item vs data-point distinction with a
 * pragmatic heuristic: anything aggregated or numeric reads as a measure.
 */
export function itemRole(opts: {
  itemType: ItemType
  dataType: string | null
  aggFunction?: string | null
}): ItemRole {
  if (opts.aggFunction && opts.aggFunction.toUpperCase() !== 'NONE') return 'measure'
  if (opts.itemType === 'AG') return 'measure'
  if (isNumericType(opts.dataType)) return 'measure'
  return 'dimension'
}
