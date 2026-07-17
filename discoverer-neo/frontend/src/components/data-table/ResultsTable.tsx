import { useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn, formatDate, formatNumber } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResultColumn } from '@/lib/types'

const ROW_HEIGHT = 32
/** Cap how many rows are sampled to infer a column's display kind — cheap even at 100k rows. */
const KIND_SAMPLE_SIZE = 200

type ColumnKind = 'number' | 'date' | 'string'
type RowRecord = Record<string, unknown>

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ].*)?$/

function looksLikeDate(value: unknown): boolean {
  if (value instanceof Date) return true
  return typeof value === 'string' && ISO_DATE_RE.test(value)
}

/** Infer a column's display kind by sampling a bounded number of non-empty values. */
function inferColumnKind(rows: RowRecord[], name: string): ColumnKind {
  let sawValue = false
  let allNumber = true
  let allDate = true
  const limit = Math.min(rows.length, KIND_SAMPLE_SIZE)
  for (let i = 0; i < limit; i++) {
    const v = rows[i][name]
    if (v == null || v === '') continue
    sawValue = true
    if (typeof v !== 'number') allNumber = false
    if (!looksLikeDate(v)) allDate = false
    if (!allNumber && !allDate) break
  }
  if (!sawValue) return 'string'
  if (allNumber) return 'number'
  if (allDate) return 'date'
  return 'string'
}

function CellValue({ value, kind }: { value: unknown; kind: ColumnKind }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-muted-foreground" title="NULL">
        ∅
      </span>
    )
  }
  if (value === '') return null
  if (value instanceof Date) return <>{formatDate(value)}</>
  if (typeof value === 'string') {
    if (kind === 'date') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return <>{formatDate(d)}</>
    }
    return <>{value}</>
  }
  if (typeof value === 'number') {
    return <>{kind === 'number' ? formatNumber(value) : value}</>
  }
  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return <>{String(value)}</>
  }
  // Arrays/plain objects: JSON.stringify (not String()/toString()) so this
  // never silently prints "[object Object]".
  return <>{JSON.stringify(value)}</>
}

export interface ResultsTableProps {
  columns: ResultColumn[]
  rows: RowRecord[]
  isLoading?: boolean
  emptyMessage?: string
  className?: string
}

/**
 * Virtualized, sortable, filterable results grid for query result sets — used
 * for map execution previews (up to 1000/100k rows), distinct from
 * `components/admin/DataTable.tsx` (small, paginated admin CRUD lists).
 */
export function ResultsTable({
  columns,
  rows,
  isLoading,
  emptyMessage = 'No rows.',
  className,
}: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const columnKinds = useMemo(() => {
    const kinds: Record<string, ColumnKind> = {}
    for (const c of columns) kinds[c.name] = inferColumnKind(rows, c.name)
    return kinds
  }, [columns, rows])

  const labelByName = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.name, c.label])),
    [columns],
  )

  const tableColumns = useMemo<ColumnDef<RowRecord>[]>(
    () =>
      columns.map((c) => ({
        id: c.name,
        accessorKey: c.name,
        header: c.label,
        size: 180,
        minSize: 70,
        filterFn: 'includesString',
        cell: ({ getValue }) => (
          <CellValue value={getValue()} kind={columnKinds[c.name] ?? 'string'} />
        ),
      })),
    [columns, columnKinds],
  )

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  })

  const tableRows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  if (isLoading) {
    return (
      <div className={cn('space-y-2 p-3', className)} data-testid="results-table-loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  if (columns.length === 0) {
    return <p className={cn('p-4 text-sm text-muted-foreground', className)}>{emptyMessage}</p>
  }

  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div ref={scrollRef} className="flex-1 overflow-auto rounded-md border">
        <table className="w-full text-sm" style={{ display: 'grid' }}>
          <thead
            className="bg-background [&_tr]:border-b"
            style={{ display: 'grid', position: 'sticky', top: 0, zIndex: 1 }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ display: 'flex', width: '100%' }}>
                {headerGroup.headers.map((header) => {
                  const kind = columnKinds[header.column.id] ?? 'string'
                  const sortState = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className="relative shrink-0 border-r text-muted-foreground last:border-r-0"
                      style={{ display: 'flex', flexDirection: 'column', width: header.getSize() }}
                    >
                      <button
                        type="button"
                        className={cn(
                          'flex h-9 flex-1 items-center gap-1 px-2 text-left text-xs font-medium hover:bg-muted/50',
                          kind === 'number' && 'flex-row-reverse text-right',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sortState === 'asc' && <ArrowUp className="h-3 w-3 shrink-0" />}
                        {sortState === 'desc' && <ArrowDown className="h-3 w-3 shrink-0" />}
                        {!sortState && <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />}
                      </button>
                      <Input
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                        placeholder="Filter…"
                        aria-label={`Filter ${labelByName[header.column.id] ?? header.column.id}`}
                        className="h-7 rounded-none border-0 border-t px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-border"
                      />
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody style={{ display: 'grid', height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {tableRows.length === 0 ? (
              <tr style={{ display: 'flex', width: '100%' }}>
                <td className="flex-1 p-4 text-center text-muted-foreground">{emptyMessage}</td>
              </tr>
            ) : (
              virtualItems.map((virtualRow) => {
                const row = tableRows[virtualRow.index]
                return (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50"
                    style={{
                      display: 'flex',
                      position: 'absolute',
                      transform: `translateY(${virtualRow.start}px)`,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const kind = columnKinds[cell.column.id] ?? 'string'
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'shrink-0 items-center truncate px-2 py-1.5',
                            kind === 'number' && 'text-right tabular-nums',
                          )}
                          style={{ display: 'flex', width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {formatNumber(tableRows.length)} row{tableRows.length === 1 ? '' : 's'}
          {tableRows.length !== rows.length && ` (filtered from ${formatNumber(rows.length)})`}
        </span>
      </div>
    </div>
  )
}
