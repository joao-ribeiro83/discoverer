import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import type { ResultColumn } from '@/lib/types'

// jsdom has no real layout (clientHeight is always 0), so @tanstack/react-virtual
// can't compute a meaningful visible range there. Swap in a fake that just
// "virtualizes" every row — plenty for these small test datasets, and it
// keeps the sort/filter/format assertions independent of layout quirks.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 32, size: 32, key: i })),
    getTotalSize: () => count * 32,
  }),
}))

const columns: ResultColumn[] = [
  { name: 'REGION', label: 'Region', isAggregate: false },
  { name: 'AMOUNT', label: 'Amount', isAggregate: false },
]

const rows: Record<string, unknown>[] = [
  { REGION: 'East', AMOUNT: 50 },
  { REGION: 'West', AMOUNT: 100 },
  { REGION: null, AMOUNT: 25 },
]

describe('ResultsTable', () => {
  it('shows a loading skeleton', () => {
    render(<ResultsTable columns={columns} rows={[]} isLoading />)
    expect(screen.getByTestId('results-table-loading')).toBeInTheDocument()
  })

  it('shows an empty-columns message before any query has run', () => {
    render(<ResultsTable columns={[]} rows={[]} emptyMessage="Run the map to see results." />)
    expect(screen.getByText('Run the map to see results.')).toBeInTheDocument()
  })

  it('shows an empty-rows message when a query returns no rows', () => {
    render(<ResultsTable columns={columns} rows={[]} emptyMessage="No rows." />)
    expect(screen.getByText('No rows.')).toBeInTheDocument()
  })

  it('renders row values, right-aligns/formats numbers, and shows a null indicator', () => {
    render(<ResultsTable columns={columns} rows={rows} />)
    expect(screen.getByText('East')).toBeInTheDocument()
    expect(screen.getByText('West')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('∅')).toBeInTheDocument()
    expect(screen.getByText('3 rows')).toBeInTheDocument()
  })

  it('sorts by clicking a numeric column header, then reverses on a second click', () => {
    const { container } = render(<ResultsTable columns={columns} rows={rows} />)
    const header = screen.getByRole('button', { name: /Amount/i })
    const firstCellText = () =>
      container.querySelector('tbody tr:first-child td:nth-child(2)')?.textContent

    // Unsorted order starts with 50 (East); the very first click must change it.
    expect(firstCellText()).toBe('50')
    fireEvent.click(header)
    const afterFirstClick = firstCellText()
    expect(afterFirstClick).not.toBe('50')
    expect(['25', '100']).toContain(afterFirstClick)

    // A second click reverses the direction.
    fireEvent.click(header)
    const afterSecondClick = firstCellText()
    expect(afterSecondClick).not.toBe(afterFirstClick)
    expect(['25', '100']).toContain(afterSecondClick)
  })

  it('filters rows via a column text filter', () => {
    render(<ResultsTable columns={columns} rows={rows} />)
    fireEvent.change(screen.getByLabelText('Filter Region'), { target: { value: 'east' } })
    expect(screen.getByText('East')).toBeInTheDocument()
    expect(screen.queryByText('West')).not.toBeInTheDocument()
    expect(screen.getByText('1 row (filtered from 3)')).toBeInTheDocument()
  })
})
