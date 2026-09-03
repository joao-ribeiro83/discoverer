import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import { CrosstabTable, crosstabAxes } from '@/components/data-table/CrosstabTable'
import { buildWorksheetRows } from '@/components/data-table/worksheet-rows'
import {
  applyFormatMask,
  interpolateTotalLabel,
  maskKind,
} from '@/lib/worksheet-format'
import type { ResultColumn, ResultTotalsGroup } from '@/lib/types'

// Same fake as results-table.test.tsx: jsdom reports zero height, so the real
// virtualizer would render no rows at all.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 32, size: 32, key: i })),
    getTotalSize: () => count * 32,
  }),
}))

const columns: ResultColumn[] = [
  { name: 'REGION', label: 'Region', isAggregate: false, axisType: 'AXIS' },
  { name: 'CUSTOMER', label: 'Customer', isAggregate: false, axisType: 'AXIS' },
  { name: 'AMOUNT', label: 'Amount', isAggregate: true, axisType: 'MEASURE' },
]

const rows: Record<string, unknown>[] = [
  { REGION: 'East', CUSTOMER: 'Acme', AMOUNT: 10 },
  { REGION: 'East', CUSTOMER: 'Bolt', AMOUNT: 20 },
  { REGION: 'West', CUSTOMER: 'Cog', AMOUNT: 30 },
]

const subtotals: ResultTotalsGroup = {
  breakAlias: 'REGION',
  breakLabel: 'Region',
  breakTargetAlias: 'REGION',
  totals: [
    {
      id: 't1',
      kind: 'TOTAL',
      alias: 'SUM_AMOUNT',
      targetAlias: 'AMOUNT',
      targetLabel: 'Amount',
      aggFunction: 'SUM',
      label: 'Total for &value',
      displayOrder: 0,
    },
  ],
  rows: [
    { REGION: 'East', SUM_AMOUNT: 30 },
    { REGION: 'West', SUM_AMOUNT: 30 },
  ],
}

const grandTotals: ResultTotalsGroup = {
  breakAlias: null,
  totals: [
    {
      id: 't2',
      kind: 'TOTAL',
      alias: 'SUM_AMOUNT',
      targetAlias: 'AMOUNT',
      targetLabel: 'Amount',
      aggFunction: 'SUM',
      displayOrder: 0,
    },
  ],
  rows: [{ SUM_AMOUNT: 60 }],
}

// ---------------------------------------------------------------------------
// Format masks
// ---------------------------------------------------------------------------

describe('worksheet format masks', () => {
  it('reads a mask as a number or a date', () => {
    expect(maskKind('999,999.00')).toBe('number')
    expect(maskKind('$9,999')).toBe('number')
    expect(maskKind('DD-MON-YYYY')).toBe('date')
    expect(maskKind('')).toBe('unknown')
    expect(maskKind(null)).toBe('unknown')
  })

  it('applies grouping and decimal places from a number mask', () => {
    expect(applyFormatMask(1234.5, '999,999.00', 'en')).toBe('1,234.50')
    expect(applyFormatMask(1234.5, '999999', 'en')).toBe('1235')
  })

  // The mask says "grouped, two decimals"; the locale says how that looks.
  // Which glyph separates the thousands is ICU's call and varies by platform,
  // so assert the decimal comma and the grouping rather than the exact string.
  it('renders a mask through the active locale', () => {
    const formatted = applyFormatMask(1234.5, '999,999.00', 'pt-PT')
    expect(formatted).toMatch(/^1\D234,50$/)
    expect(applyFormatMask(1234.5, '999,999.00', 'en')).toBe('1,234.50')
  })

  // Discoverer stores the computed value, so multiplying would show it 100x.
  it('appends a percent sign without multiplying', () => {
    expect(applyFormatMask(12.3, '990.0%', 'en')).toBe('12.3%')
  })

  it('substitutes date mask elements', () => {
    const result = applyFormatMask(new Date(2026, 7, 5), 'DD-MON-YYYY', 'en')
    expect(result).toBe('05-AUG-2026')
  })

  it('returns null when the mask does not fit the value', () => {
    expect(applyFormatMask('not a number', '999.99', 'en')).toBeNull()
    expect(applyFormatMask(5, '', 'en')).toBeNull()
    expect(applyFormatMask(null, '999', 'en')).toBeNull()
  })

  it('fills in a Discoverer total label, either capitalisation', () => {
    expect(interpolateTotalLabel('Total for &value', { value: 'East' }, 'x')).toBe('Total for East')
    expect(interpolateTotalLabel('SubTotal por &Value', { value: 'Sul' }, 'x')).toBe(
      'SubTotal por Sul',
    )
    expect(interpolateTotalLabel(null, {}, 'Fallback')).toBe('Fallback')
  })
})

// ---------------------------------------------------------------------------
// Display-row model
// ---------------------------------------------------------------------------

describe('buildWorksheetRows', () => {
  it('suppresses repeated break values and closes each group with a subtotal', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION'],
      totals: [subtotals],
    })

    expect(display.map((d) => d.kind)).toEqual(['data', 'data', 'subtotal', 'data', 'subtotal'])
    // First row of a group shows its value; the second repeats it, so it is blank.
    expect(display[0]).toMatchObject({ kind: 'data', suppressed: [] })
    expect(display[1]).toMatchObject({ kind: 'data', suppressed: ['REGION'] })
    expect(display[2]).toMatchObject({ kind: 'subtotal', breakValue: 'East' })
  })

  it('matches a subtotal to its group by value, not by position', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION'],
      // Deliberately in the opposite order to the data.
      totals: [{ ...subtotals, rows: [...subtotals.rows].reverse() }],
    })
    const first = display.find((d) => d.kind === 'subtotal')
    expect(first).toMatchObject({ breakValue: 'East' })
    expect(first && first.kind === 'subtotal' && first.entries[0].value).toBe(30)
  })

  it('closes nested breaks innermost first', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION', 'CUSTOMER'],
      totals: [
        subtotals,
        {
          breakAlias: 'CUSTOMER',
          breakLabel: 'Customer',
          breakTargetAlias: 'CUSTOMER',
          totals: subtotals.totals,
          rows: [
            { CUSTOMER: 'Acme', SUM_AMOUNT: 10 },
            { CUSTOMER: 'Bolt', SUM_AMOUNT: 20 },
            { CUSTOMER: 'Cog', SUM_AMOUNT: 30 },
          ],
        },
      ],
    })

    const levels = display
      .filter((d) => d.kind === 'subtotal')
      .map((d) => (d.kind === 'subtotal' ? d.breakAlias : ''))
    // Customer (inner) closes before Region (outer) every time.
    expect(levels).toEqual(['CUSTOMER', 'CUSTOMER', 'REGION', 'CUSTOMER', 'REGION'])
  })

  it('puts grand totals last', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: [],
      totals: [grandTotals],
    })
    expect(display[display.length - 1]).toMatchObject({ kind: 'grand' })
  })

  // A subtotal whose break column is not one the rows are clustered by cannot
  // be drawn in place; it is shown at the foot rather than dropped.
  it('keeps a subtotal whose break column is not a group column', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: [],
      totals: [subtotals],
    })
    expect(display.filter((d) => d.kind === 'subtotal')).toHaveLength(0)
    expect(display[display.length - 1]).toMatchObject({ kind: 'grand' })
  })

  it('returns only data rows when there is nothing to group or total', () => {
    const display = buildWorksheetRows({ rows, groupBreakAliases: [], totals: [] })
    expect(display).toHaveLength(3)
    expect(display.every((d) => d.kind === 'data')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

describe('ResultsTable worksheet layout', () => {
  it('draws subtotal and grand-total rows', () => {
    render(
      <ResultsTable
        columns={columns}
        rows={rows}
        groupBreakAliases={['REGION']}
        totals={[grandTotals, subtotals]}
      />,
    )
    expect(screen.getAllByTestId('results-subtotal-row')).toHaveLength(2)
    expect(screen.getByTestId('results-grand-total-row')).toBeInTheDocument()
    expect(screen.getByText('Total for East')).toBeInTheDocument()
  })

  it('marks the break column in the header', () => {
    render(<ResultsTable columns={columns} rows={rows} groupBreakAliases={['REGION']} />)
    expect(screen.getByRole('button', { name: /Region/i })).toHaveTextContent('Group')
  })

  // A subtotal stranded among re-sorted rows is a number in the wrong place.
  it('drops back to a plain grid once a column is sorted', () => {
    render(
      <ResultsTable
        columns={columns}
        rows={rows}
        groupBreakAliases={['REGION']}
        totals={[subtotals]}
      />,
    )
    expect(screen.getAllByTestId('results-subtotal-row')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /Amount/i }))
    expect(screen.queryByTestId('results-subtotal-row')).not.toBeInTheDocument()
  })

  it('formats cells with the column mask', () => {
    render(
      <ResultsTable
        columns={[{ name: 'AMOUNT', label: 'Amount', isAggregate: false, formatMask: '999,999.00' }]}
        rows={[{ AMOUNT: 1234.5 }]}
      />,
    )
    expect(screen.getByText('1,234.50')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Crosstab
// ---------------------------------------------------------------------------

describe('crosstabAxes', () => {
  // Discoverer records no column edge, so a migrated worksheet cannot pivot
  // until someone sets one in Neo.
  it('refuses to pivot when no column has a crosstab edge', () => {
    const axes = crosstabAxes(columns)
    expect(axes.canPivot).toBe(false)
    expect(axes.rowFields.map((c) => c.name)).toEqual(['REGION', 'CUSTOMER'])
    expect(axes.measures.map((c) => c.name)).toEqual(['AMOUNT'])
  })

  it('pivots once a column is put on the top edge', () => {
    const axes = crosstabAxes([
      columns[0],
      { ...columns[1], axisEdge: 'COLUMN' },
      columns[2],
    ])
    expect(axes.canPivot).toBe(true)
    expect(axes.columnFields.map((c) => c.name)).toEqual(['CUSTOMER'])
  })

  it('leaves page items out of the grid entirely', () => {
    const axes = crosstabAxes([...columns, { name: 'YEAR', label: 'Year', isAggregate: false, axisType: 'PAGE' }])
    const named = [...axes.rowFields, ...axes.columnFields, ...axes.measures].map((c) => c.name)
    expect(named).not.toContain('YEAR')
  })
})

describe('CrosstabTable', () => {
  const pivotColumns: ResultColumn[] = [
    columns[0],
    { ...columns[1], axisEdge: 'COLUMN' },
    columns[2],
  ]

  it('renders row-edge values down the side and column-edge values across the top', () => {
    render(<CrosstabTable columns={pivotColumns} rows={rows} />)
    const table = screen.getByTestId('crosstab-table')
    expect(table).toHaveTextContent('East')
    expect(table).toHaveTextContent('West')
    expect(table).toHaveTextContent('Acme')
    expect(table).toHaveTextContent('Cog')
    expect(table).toHaveTextContent('20')
  })

  it('explains itself instead of drawing an empty pivot', () => {
    render(<CrosstabTable columns={columns} rows={rows} />)
    expect(screen.queryByTestId('crosstab-table')).not.toBeInTheDocument()
    expect(screen.getByText(/no column edge/i)).toBeInTheDocument()
  })
})
