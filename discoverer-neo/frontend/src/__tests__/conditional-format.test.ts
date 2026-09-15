import { describe, it, expect } from 'vitest'
import {
  evaluateConditionalFormat,
  styleForCell,
  rowHasMatch,
} from '@/lib/conditional-format'
import type { ResultConditionalFormat } from '@/lib/types'

function mkRule(overrides: Partial<ResultConditionalFormat> = {}): ResultConditionalFormat {
  return {
    id: 'r1',
    targetAlias: 'AMOUNT',
    target: 'CELL',
    operator: '>',
    value: '1000',
    backgroundColor: '#ffcc00',
    textColor: null,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    displayOrder: 0,
    ...overrides,
  }
}

describe('evaluateConditionalFormat', () => {
  it('compares numbers numerically', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '>', value: '1000' }), 1500)).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '>', value: '1000' }), 500)).toBe(false)
  })

  it('handles <, <=, >=, =, <>', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '<', value: '10' }), 5)).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '<=', value: '10' }), 10)).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '>=', value: '10' }), 10)).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '=', value: '10' }), 10)).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '<>', value: '10' }), 10)).toBe(false)
  })

  it('BETWEEN checks the inclusive range', () => {
    const rule = mkRule({ operator: 'BETWEEN', value: '10,20' })
    expect(evaluateConditionalFormat(rule, 10)).toBe(true)
    expect(evaluateConditionalFormat(rule, 20)).toBe(true)
    expect(evaluateConditionalFormat(rule, 15)).toBe(true)
    expect(evaluateConditionalFormat(rule, 21)).toBe(false)
  })

  it('IN matches any listed value', () => {
    const rule = mkRule({ operator: 'IN', value: 'OPEN, PENDING,CLOSED' })
    expect(evaluateConditionalFormat(rule, 'PENDING')).toBe(true)
    expect(evaluateConditionalFormat(rule, 'DONE')).toBe(false)
  })

  it('LIKE supports % and _ wildcards, case-insensitively', () => {
    const rule = mkRule({ operator: 'LIKE', value: 'AC%' })
    expect(evaluateConditionalFormat(rule, 'active')).toBe(true)
    expect(evaluateConditionalFormat(rule, 'inactive')).toBe(false)
  })

  it('IS_NULL matches null, undefined and empty string only', () => {
    const rule = mkRule({ operator: 'IS_NULL', value: null })
    expect(evaluateConditionalFormat(rule, null)).toBe(true)
    expect(evaluateConditionalFormat(rule, undefined)).toBe(true)
    expect(evaluateConditionalFormat(rule, '')).toBe(true)
    expect(evaluateConditionalFormat(rule, 0)).toBe(false)
  })

  it('a null cell never matches a non-IS_NULL operator', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '=', value: '0' }), null)).toBe(false)
  })

  it('compares strings lexically when the cell is not numeric', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '>', value: 'M' }), 'West')).toBe(true)
    expect(evaluateConditionalFormat(mkRule({ operator: '>', value: 'M' }), 'East')).toBe(false)
  })

  it('returns false when the rule has no operator', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: null }), 5)).toBe(false)
  })

  it('returns false when the rule value is null for a comparison operator', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '=', value: null }), 5)).toBe(false)
  })

  it('returns false for an operator it does not recognize', () => {
    expect(
      evaluateConditionalFormat(mkRule({ operator: 'BOGUS' as never, value: '1' }), 5),
    ).toBe(false)
  })

  it('BETWEEN with a malformed value (no upper bound) returns false', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: 'BETWEEN', value: '10' }), 15)).toBe(false)
  })

  it('compares Date cell values numerically against their epoch millis', () => {
    const rule = mkRule({ operator: '>', value: String(new Date('2020-01-01').getTime()) })
    expect(evaluateConditionalFormat(rule, new Date('2020-06-01'))).toBe(true)
    expect(evaluateConditionalFormat(rule, new Date('2019-01-01'))).toBe(false)
  })

  it('falls back to string comparison for a non-primitive, non-Date cell value', () => {
    expect(evaluateConditionalFormat(mkRule({ operator: '=', value: 'true' }), true)).toBe(true)
  })
})

describe('styleForCell', () => {
  it('applies a CELL rule only to its own column', () => {
    const rules = [mkRule({ target: 'CELL', targetAlias: 'AMOUNT', operator: '>', value: '1000' })]
    expect(styleForCell('AMOUNT', { AMOUNT: 1500 }, rules)).toEqual({ backgroundColor: '#ffcc00' })
    expect(styleForCell('REGION', { AMOUNT: 1500, REGION: 'West' }, rules)).toEqual({})
  })

  it('applies a ROW rule to every column once its test column matches', () => {
    const rules = [
      mkRule({ target: 'ROW', targetAlias: 'STATUS', operator: '=', value: 'OVERDUE', backgroundColor: '#ff0000' }),
    ]
    const row = { STATUS: 'OVERDUE', REGION: 'West' }
    expect(styleForCell('REGION', row, rules)).toEqual({ backgroundColor: '#ff0000' })
    expect(styleForCell('STATUS', row, rules)).toEqual({ backgroundColor: '#ff0000' })
  })

  it('merges bold/italic/underline and lets the later rule win a shared color', () => {
    const rules = [
      mkRule({ id: 'a', displayOrder: 0, backgroundColor: '#111111', isBold: true }),
      mkRule({ id: 'b', displayOrder: 1, backgroundColor: '#222222', isItalic: true }),
    ]
    expect(styleForCell('AMOUNT', { AMOUNT: 1500 }, rules)).toEqual({
      backgroundColor: '#222222',
      fontWeight: 'bold',
      fontStyle: 'italic',
    })
  })

  it('ignores a rule with no target column', () => {
    const rules = [mkRule({ targetAlias: undefined })]
    expect(styleForCell('AMOUNT', { AMOUNT: 1500 }, rules)).toEqual({})
  })

  it('ignores a rule whose test does not match the row', () => {
    const rules = [mkRule({ operator: '>', value: '99999' })]
    expect(styleForCell('AMOUNT', { AMOUNT: 1500 }, rules)).toEqual({})
  })

  it('applies textColor and underline independently of backgroundColor', () => {
    const rules = [mkRule({ backgroundColor: null, textColor: '#ffffff', isUnderline: true })]
    expect(styleForCell('AMOUNT', { AMOUNT: 1500 }, rules)).toEqual({
      color: '#ffffff',
      textDecoration: 'underline',
    })
  })
})

describe('rowHasMatch', () => {
  it('is true only for a matching ROW rule, not a CELL rule', () => {
    const cellRule = mkRule({ target: 'CELL', targetAlias: 'AMOUNT', operator: '>', value: '1000' })
    const rowRule = mkRule({ target: 'ROW', targetAlias: 'STATUS', operator: '=', value: 'OVERDUE' })
    expect(rowHasMatch({ AMOUNT: 1500, STATUS: 'OK' }, [cellRule])).toBe(false)
    expect(rowHasMatch({ AMOUNT: 1500, STATUS: 'OVERDUE' }, [rowRule])).toBe(true)
  })
})
