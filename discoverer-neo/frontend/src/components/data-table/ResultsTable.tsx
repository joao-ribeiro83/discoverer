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
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatInteger, formatNumber } from '@/lib/format'
import { applyFormatMask, interpolateTotalLabel, stringifyCell } from '@/lib/worksheet-format'
import { useLocale } from '@/hooks/useLocale'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResultColumn, ResultTotalsGroup } from '@/lib/types'
import { buildWorksheetRows, type DisplayRow, type TotalEntry } from './worksheet-rows'

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

/**
 * Which way a column's cells are aligned.
 *
 * The map item's own `alignment` wins where the worksheet recorded one. It
 * usually did not — Discoverer's alignment code is undecoded, so the migration
 * leaves it null rather than guessing — and then numbers go right and
 * everything else goes left, as before.
 */
function alignmentClass(column: ResultColumn | undefined, kind: ColumnKind): string {
  switch (column?.alignment) {
    case 'RIGHT':
      return 'justify-end text-right'
    case 'CENTER':
      return 'justify-center text-center'
    case 'LEFT':
      return 'justify-start text-left'
    default:
      return kind === 'number' ? 'justify-end text-right' : 'justify-start text-left'
  }
}

function CellValue({
  value,
  kind,
  column,
}: {
  value: unknown
  kind: ColumnKind
  column?: ResultColumn
}) {
  const { t } = useTranslation(['mapViewer'])
  const { locale } = useLocale()

  if (value === null || value === undefined) {
    return (
      <span className="text-muted-foreground" title={t('mapViewer:resultsTable.nullValue')}>
        ∅
      </span>
    )
  }
  if (value === '') return null

  // The map's own format mask comes first: it is what the worksheet drew.
  // `applyFormatMask` returns null when the mask does not apply to this value,
  // and the locale-aware defaults below take over.
  const masked = applyFormatMask(value, column?.formatMask, locale)
  if (masked !== null) return <>{masked}</>

  if (value instanceof Date) return <>{formatDate(value, locale)}</>
  if (typeof value === 'string') {
    if (kind === 'date') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return <>{formatDate(d, locale)}</>
    }
    return <>{value}</>
  }
  if (typeof value === 'number') {
    return <>{kind === 'number' ? formatNumber(value, locale) : value}</>
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
  /**
   * Break columns, outermost first. When present, repeated values in these
   * columns are drawn blank and a subtotal line closes each group.
   */
  groupBreakAliases?: string[]
  /** Totals and subtotals the map defines, already computed by the backend. */
  totals?: ResultTotalsGroup[]
}

/**
 * Virtualized, sortable, filterable results grid for query result sets — used
 * for map execution previews (up to 1000/100k rows), distinct from
 * `components/admin/DataTable.tsx` (small, paginated admin CRUD lists).
 *
 * With `groupBreakAliases` and `totals` it draws the worksheet the way
 * Discoverer did: repeated group values suppressed, a subtotal at each change,
 * grand totals at the foot. That layout only holds while the rows are in the
 * order the query returned them, so sorting or filtering a column here drops
 * back to a plain grid — a subtotal stranded among re-sorted rows would be a
 * number in the wrong place.
 */
export function ResultsTable({
  columns,
  rows,
  isLoading,
  emptyMessage,
  className,
  groupBreakAliases,
  totals,
}: ResultsTableProps) {
  const { t } = useTranslation(['mapViewer'])
  const { locale } = useLocale()
  const resolvedEmptyMessage = emptyMessage ?? t('mapViewer:resultsTable.noRows')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const columnKinds = useMemo(() => {
    const kinds: Record<string, ColumnKind> = {}
    for (const c of columns) kinds[c.name] = inferColumnKind(rows, c.name)
    return kinds
  }, [columns, rows])

  const columnByName = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.name, c])),
    [columns],
  )

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
        // The worksheet's own column width, when it recorded one.
        size: c.columnWidth && c.columnWidth > 0 ? c.columnWidth : 180,
        minSize: 70,
        filterFn: 'includesString',
        cell: ({ getValue }) => (
          <CellValue value={getValue()} kind={columnKinds[c.name] ?? 'string'} column={c} />
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

  // Breaks and subtotals only make sense in the query's own order.
  const worksheetLayout = sorting.length === 0 && columnFilters.length === 0
  const breaks = useMemo(
    () => (groupBreakAliases ?? []).filter((alias) => alias in columnByName),
    [groupBreakAliases, columnByName],
  )
  const hasTotals = (totals?.length ?? 0) > 0

  const displayRows = useMemo<DisplayRow[] | null>(() => {
    if (!worksheetLayout) return null
    if (breaks.length === 0 && !hasTotals) return null
    return buildWorksheetRows({ rows, groupBreakAliases: breaks, totals: totals ?? [] })
  }, [worksheetLayout, breaks, hasTotals, rows, totals])

  const virtualCount = displayRows ? displayRows.length : tableRows.length

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
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
    return <p className={cn('p-4 text-sm text-muted-foreground', className)}>{resolvedEmptyMessage}</p>
  }

  const virtualItems = rowVirtualizer.getVirtualItems()
  const leafColumns = table.getVisibleLeafColumns()

  /** One totals line — a subtotal or the grand total — laid over the grid. */
  function renderTotalsRow(entries: TotalEntry[], label: string, indent: number) {
    const byTarget = new globalThis.Map<string, TotalEntry>()
    const unplaced: TotalEntry[] = []
    for (const entry of entries) {
      if (entry.total.targetAlias && entry.total.targetAlias in columnByName) {
        byTarget.set(entry.total.targetAlias, entry)
      } else {
        unplaced.push(entry)
      }
    }

    return leafColumns.map((column, columnIndex) => {
      const entry = byTarget.get(column.id)
      const kind = columnKinds[column.id] ?? 'string'
      const resultColumn = columnByName[column.id]
      return (
        <td
          key={column.id}
          className={cn(
            'flex shrink-0 items-center truncate px-2 py-1.5',
            alignmentClass(resultColumn, entry ? 'number' : kind),
          )}
          style={{ width: column.getSize(), paddingLeft: columnIndex === 0 ? 8 + indent * 12 : undefined }}
        >
          {columnIndex === 0 && (
            <span className="truncate font-medium" title={label}>
              {label}
            </span>
          )}
          {entry && (
            <span className="tabular-nums">
              <CellValue value={entry.value} kind="number" column={resultColumn} />
            </span>
          )}
          {/* Totals with no column of their own (a hidden item, or a break
              Neo cannot draw) would otherwise vanish; they ride in the last
              cell with their own label. */}
          {columnIndex === leafColumns.length - 1 &&
            unplaced.map((u) => (
              <span key={u.total.id} className="ml-2 whitespace-nowrap text-xs">
                {u.total.targetLabel}:{' '}
                <span className="tabular-nums">
                  <CellValue value={u.value} kind="number" />
                </span>
              </span>
            ))}
        </td>
      )
    })
  }

  function renderVirtualRow(virtualRow: { index: number; start: number; size: number }) {
    const style = {
      display: 'flex',
      position: 'absolute' as const,
      transform: `translateY(${virtualRow.start}px)`,
      width: '100%',
      height: `${virtualRow.size}px`,
    }

    if (displayRows) {
      const display = displayRows[virtualRow.index]

      if (display.kind === 'subtotal') {
        const label = interpolateTotalLabel(
          display.entries[0]?.total.label,
          {
            value: stringifyCell(display.breakValue),
            item: display.breakLabel,
          },
          t('mapViewer:resultsTable.subtotalFor', {
            value: stringifyCell(display.breakValue),
          }),
        )
        return (
          <tr
            key={`subtotal-${display.breakAlias}-${virtualRow.index}`}
            className="border-b border-t bg-muted/40 text-sm"
            style={style}
            data-testid="results-subtotal-row"
          >
            {renderTotalsRow(display.entries, label, display.level)}
          </tr>
        )
      }

      if (display.kind === 'grand') {
        return (
          <tr
            key="grand-total"
            className="border-b-2 border-t-2 bg-muted/70 text-sm font-semibold"
            style={style}
            data-testid="results-grand-total-row"
          >
            {renderTotalsRow(display.entries, t('mapViewer:resultsTable.grandTotal'), 0)}
          </tr>
        )
      }

      // A data row: the table's own row model still owns the cells, so
      // resizing, formatting and null rendering behave identically.
      const row = tableRows[display.index]
      if (!row) return null
      const suppressed = new Set(display.suppressed)
      return (
        <tr key={row.id} className="border-b hover:bg-muted/50" style={style}>
          {row.getVisibleCells().map((cell) => {
            const kind = columnKinds[cell.column.id] ?? 'string'
            const resultColumn = columnByName[cell.column.id]
            return (
              <td
                key={cell.id}
                className={cn(
                  'flex shrink-0 items-center px-2 py-1.5',
                  resultColumn?.wordWrap ? 'whitespace-normal break-words' : 'truncate',
                  alignmentClass(resultColumn, kind),
                  kind === 'number' && 'tabular-nums',
                )}
                style={{ width: cell.column.getSize() }}
              >
                {suppressed.has(cell.column.id)
                  ? null
                  : flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            )
          })}
        </tr>
      )
    }

    const row = tableRows[virtualRow.index]
    return (
      <tr key={row.id} className="border-b hover:bg-muted/50" style={style}>
        {row.getVisibleCells().map((cell) => {
          const kind = columnKinds[cell.column.id] ?? 'string'
          const resultColumn = columnByName[cell.column.id]
          return (
            <td
              key={cell.id}
              className={cn(
                'flex shrink-0 items-center px-2 py-1.5',
                resultColumn?.wordWrap ? 'whitespace-normal break-words' : 'truncate',
                alignmentClass(resultColumn, kind),
                kind === 'number' && 'tabular-nums',
              )}
              style={{ width: cell.column.getSize() }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          )
        })}
      </tr>
    )
  }

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
                  const isBreak = breaks.includes(header.column.id)
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
                        {isBreak && (
                          <span
                            className="shrink-0 rounded bg-muted px-1 text-[10px] font-normal uppercase"
                            title={t('mapViewer:resultsTable.groupBreakHint')}
                          >
                            {t('mapViewer:resultsTable.groupBreakBadge')}
                          </span>
                        )}
                        {sortState === 'asc' && <ArrowUp className="h-3 w-3 shrink-0" />}
                        {sortState === 'desc' && <ArrowDown className="h-3 w-3 shrink-0" />}
                        {!sortState && <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />}
                      </button>
                      <Input
                        value={(header.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                        placeholder={t('mapViewer:resultsTable.filterPlaceholder')}
                        aria-label={t('mapViewer:resultsTable.filterAriaLabel', {
                          column: labelByName[header.column.id] ?? header.column.id,
                        })}
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
            {virtualCount === 0 ? (
              <tr style={{ display: 'flex', width: '100%' }}>
                <td className="flex-1 p-4 text-center text-muted-foreground">{resolvedEmptyMessage}</td>
              </tr>
            ) : (
              virtualItems.map(renderVirtualRow)
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-1.5 text-xs text-muted-foreground">
        <span>
          {t('mapViewer:resultsTable.rowCount', {
            count: tableRows.length,
            formattedCount: formatInteger(tableRows.length, locale),
          })}
          {tableRows.length !== rows.length &&
            ` ${t('mapViewer:resultsTable.filteredFrom', {
              total: formatInteger(rows.length, locale),
            })}`}
        </span>
        {!worksheetLayout && (breaks.length > 0 || hasTotals) && (
          <span>{t('mapViewer:resultsTable.worksheetLayoutPaused')}</span>
        )}
      </div>
    </div>
  )
}
