import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import { CrosstabTable, crosstabAxes } from '@/components/data-table/CrosstabTable'
import { buildWorksheetRows } from '@/components/data-table/worksheet-rows'
import {
  applyDateMask,
  applyFormatMask,
  interpolateTotalLabel,
  maskKind,
  stringifyCell,
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

  it('falls back when the template is whitespace-only', () => {
    expect(interpolateTotalLabel('   ', {}, 'Fallback')).toBe('Fallback')
  })

  it('interpolates &item and blanks any part not supplied', () => {
    expect(interpolateTotalLabel('Total for &item', {}, 'x')).toBe('Total for')
    expect(interpolateTotalLabel('&value / &item', { value: 'East' }, 'x')).toBe('East /')
  })

  it('treats a whitespace-only or unrecognized mask as unknown', () => {
    expect(maskKind('   ')).toBe('unknown')
    expect(maskKind('ABC')).toBe('unknown')
  })

  it('formats a currency mask with the USD symbol', () => {
    expect(applyFormatMask(1234.5, '$9,999.00', 'en')).toBe('$1,234.50')
  })

  it('falls back to the default locale for one Neo does not support', () => {
    expect(applyFormatMask(1234.5, '999,999.00', 'xx-XX')).toBe('1,234.50')
  })

  it('returns null for an empty-string value', () => {
    expect(applyFormatMask('', '999', 'en')).toBeNull()
  })

  it('formats a date mask from a non-Date value via its string form', () => {
    const result = applyFormatMask('2026-08-05T12:00:00.000Z', 'DD-MON-YYYY', 'en')
    expect(result).toMatch(/^\d{2}-[A-Z]{3}-\d{4}$/)
  })

  it('returns null when a date mask cannot parse the value', () => {
    expect(applyFormatMask('not a date', 'DD-MON-YYYY', 'en')).toBeNull()
  })

  // Exercises the two-digit (unpadded) side of pad2, the PM branch, and the
  // non-noon side of the 12-hour conversion — all zero on the DD-MON-YYYY
  // fixture above, which only ever sees single-digit, midnight values.
  it('formats two-digit date parts and PM correctly', () => {
    const date = new Date(2026, 11, 25, 14, 30, 45) // Dec 25 2026, 14:30:45
    expect(applyDateMask(date, 'YYYY-MM-DD HH24:MI:SS HH AM', 'en')).toBe(
      '2026-12-25 14:30:45 02 PM',
    )
  })

  // `DD-MON-RRRR` is the mask on 2 732 of the live estate's 3 720 date
  // columns. `RRRR` used to survive substitution and print itself, so the
  // worksheet showed `30-SEP-RRRR` — the year simply missing.
  it('renders Oracle round-year tokens as years', () => {
    const date = new Date(2026, 8, 30) // 30 Sep 2026
    expect(maskKind('DD-MON-RRRR')).toBe('date')
    expect(applyDateMask(date, 'DD-MON-RRRR', 'en')).toBe('30-SEP-2026')
    expect(applyDateMask(date, 'DD-MM-RR', 'en')).toBe('30-09-26')
  })

  // Oracle takes the name's case from the token's, and the estate has
  // `DD-Mon-YY` masks that the old always-uppercase path could not honour.
  it('takes a name element case from the token', () => {
    const date = new Date(2026, 8, 30)
    expect(applyDateMask(date, 'DD-Mon-YY', 'en')).toBe('30-Sep-26')
    expect(applyDateMask(date, 'DD-mon-YY', 'en')).toBe('30-sep-26')
  })
})

describe('stringifyCell', () => {
  it('stringifies primitives, dates, and structured values distinctly', () => {
    expect(stringifyCell(null)).toBe('')
    expect(stringifyCell(undefined)).toBe('')
    expect(stringifyCell(42)).toBe('42')
    expect(stringifyCell(true)).toBe('true')
    expect(stringifyCell(10n)).toBe('10')
    const date = new Date(2026, 0, 1)
    expect(stringifyCell(date)).toBe(date.toISOString())
    expect(stringifyCell({ a: 1 })).toBe('{"a":1}')
    expect(stringifyCell([1, 2])).toBe('[1,2]')
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

  it('compares break values by time, not object identity, for Date columns', () => {
    const d1 = new Date(2026, 0, 1)
    const d1sameTime = new Date(2026, 0, 1)
    const d2 = new Date(2026, 0, 2)
    const display = buildWorksheetRows({
      rows: [{ REGION: d1, V: 1 }, { REGION: d1sameTime, V: 2 }, { REGION: d2, V: 3 }],
      groupBreakAliases: ['REGION'],
      totals: [],
    })
    expect(display.map((d) => (d.kind === 'data' ? d.suppressed : null))).toEqual([
      [],
      ['REGION'],
      [],
    ])
  })

  it('does not treat null and undefined break values as the same group', () => {
    const display = buildWorksheetRows({
      rows: [{ REGION: null, V: 1 }, { REGION: undefined, V: 2 }],
      groupBreakAliases: ['REGION'],
      totals: [],
    })
    expect(display[1]).toMatchObject({ kind: 'data', suppressed: [] })
  })

  it('treats break values as equal when their string forms match, across types', () => {
    const display = buildWorksheetRows({
      rows: [{ REGION: 10, V: 1 }, { REGION: '10', V: 2 }],
      groupBreakAliases: ['REGION'],
      totals: [],
    })
    expect(display[1]).toMatchObject({ kind: 'data', suppressed: ['REGION'] })
  })

  // A totals group with an empty-string breakAlias (not null) is treated the
  // same as "no total configured" — dropped rather than crashing or being
  // mistaken for a grand total.
  it('drops a totals group whose breakAlias is an empty string', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION'],
      totals: [{ ...subtotals, breakAlias: '' }],
    })
    expect(display.some((d) => d.kind === 'subtotal' || d.kind === 'grand')).toBe(false)
  })

  // breakTargetAlias is optional; when absent, the group can never match a
  // drawn break column, so it is folded into the grand-total footer.
  it('sends a totals group with no breakTargetAlias to the grand-total footer', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION'],
      totals: [
        {
          breakAlias: 'FOO',
          breakLabel: 'Foo',
          breakTargetAlias: undefined,
          totals: subtotals.totals,
          rows: [{ FOO: 'x', SUM_AMOUNT: 42 }],
        },
      ],
    })
    const grand = display.find((d) => d.kind === 'grand')
    expect(grand).toMatchObject({ kind: 'grand', entries: [{ value: 42 }] })
  })

  // A break level with no matching totals group at all must not blow up
  // closeBreaks — it is simply skipped while sibling levels still total.
  it('skips a break level that has no totals group configured', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: ['REGION', 'CUSTOMER'],
      totals: [subtotals], // only REGION has a totals group
    })
    const subtotalAliases = display
      .filter((d) => d.kind === 'subtotal')
      .map((d) => (d.kind === 'subtotal' ? d.breakAlias : ''))
    expect(subtotalAliases).toEqual(['REGION', 'REGION'])
  })

  // A break value with no corresponding row in the totals group's own result
  // set (e.g. it fell outside the totals query somehow) closes silently
  // instead of emitting an empty subtotal line.
  it('skips a subtotal line when no totals row matches the break value', () => {
    const display = buildWorksheetRows({
      rows: [
        { REGION: 'East', CUSTOMER: 'Acme', AMOUNT: 10 },
        { REGION: 'West', CUSTOMER: 'Cog', AMOUNT: 30 },
        { REGION: 'North', CUSTOMER: 'Delta', AMOUNT: 5 },
      ],
      groupBreakAliases: ['REGION'],
      totals: [
        {
          ...subtotals,
          rows: [
            { REGION: 'East', SUM_AMOUNT: 10 },
            { REGION: 'West', SUM_AMOUNT: 30 },
            // deliberately no North row
          ],
        },
      ],
    })
    const subtotalValues = display
      .filter((d) => d.kind === 'subtotal')
      .map((d) => (d.kind === 'subtotal' ? d.breakValue : null))
    expect(subtotalValues).toEqual(['East', 'West'])
  })

  // A grand-totals group with no rows at all contributes nothing, so the
  // footer is omitted rather than drawn empty.
  // Two totals out of displayOrder actually exercises the sort comparator
  // (a single-entry totals list never calls it at all).
  it('sorts multiple totals in a group by displayOrder', () => {
    const twoTotals: ResultTotalsGroup = {
      breakAlias: null,
      totals: [
        { ...grandTotals.totals[0], alias: 'SECOND', displayOrder: 1 },
        { ...grandTotals.totals[0], alias: 'FIRST', displayOrder: 0 },
      ],
      rows: [{ FIRST: 1, SECOND: 2 }],
    }
    const display = buildWorksheetRows({ rows, groupBreakAliases: [], totals: [twoTotals] })
    const grand = display.find((d) => d.kind === 'grand')
    expect(grand).toMatchObject({
      kind: 'grand',
      entries: [{ total: { alias: 'FIRST' } }, { total: { alias: 'SECOND' } }],
    })
  })

  it('omits the grand-total row when its totals group has no rows', () => {
    const display = buildWorksheetRows({
      rows,
      groupBreakAliases: [],
      totals: [{ breakAlias: null, totals: grandTotals.totals, rows: [] }],
    })
    expect(display.some((d) => d.kind === 'grand')).toBe(false)
  })

  it('falls back to the break alias when the group has no breakLabel', () => {
    const { breakLabel: _unused, ...noLabel } = subtotals
    const display = buildWorksheetRows({ rows, groupBreakAliases: ['REGION'], totals: [noLabel] })
    const first = display.find((d) => d.kind === 'subtotal')
    expect(first).toMatchObject({ breakLabel: 'REGION' })
  })

  it('returns an empty display for an empty result set', () => {
    const display = buildWorksheetRows({ rows: [], groupBreakAliases: ['REGION'], totals: [subtotals] })
    expect(display).toEqual([])
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
