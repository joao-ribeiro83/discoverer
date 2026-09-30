import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useFitPageSize } from '@/hooks/useFitPageSize'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  emptyMessage?: string
  /** Fixed rows per page. Omit it and the table fits as many rows as the window holds. */
  pageSize?: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  emptyMessage,
  pageSize,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation(['admin', 'common'])
  const resolvedEmptyMessage = emptyMessage ?? t('admin:shared.defaultEmptyMessage')
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const fitted = useFitPageSize(bodyRef, !isLoading && data.length > 0)
  const effectivePageSize = pageSize ?? fitted
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: effectivePageSize } },
  })

  useEffect(() => {
    if (table.getState().pagination.pageSize !== effectivePageSize) {
      table.setPageSize(effectivePageSize)
    }
  }, [table, effectivePageSize])

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody ref={bodyRef}>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t('admin:shared.loading')}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pager
        page={table.getState().pagination.pageIndex}
        pageCount={table.getPageCount()}
        onPage={(p) => table.setPageIndex(p)}
      />
    </div>
  )
}

/** "Page x of y" with Previous / Next. Renders nothing for a single page. */
export function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number
  pageCount: number
  onPage: (page: number) => void
}) {
  const { t } = useTranslation('common')
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {t('common:pagination.pageOf', { page: page + 1, total: pageCount })}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 0}>
          {t('common:actions.previous')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
        >
          {t('common:actions.next')}
        </Button>
      </div>
    </div>
  )
}
