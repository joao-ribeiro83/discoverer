import { describe, it, expect } from 'vitest'
import { safeFilename } from '@/components/map-builder/export-utils'

describe('safeFilename', () => {
  it('keeps a normal name intact', () => {
    expect(safeFilename('Sales by Region')).toBe('Sales_by_Region')
  })

  it('falls back to "map" when nothing survives sanitizing', () => {
    expect(safeFilename('###')).toBe('map')
  })
})
