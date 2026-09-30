import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Space kept under the table: the pager row, its gap, and `<main>`'s bottom padding. */
const RESERVED_BELOW_PX = 72
const MIN_ROWS = 5

/**
 * How many rows fit between the top of a table body and the bottom of the
 * page's scroll area, so a table fills the window instead of a fixed 10 rows.
 *
 * Re-measures on window resize. Pass `hasData` only when the body holds real
 * data rows (not a loading or empty placeholder), so the row height is read
 * from one. Until then (or where layout is not real, as in jsdom, where every
 * height is 0), it returns `fallback`.
 */
export function useFitPageSize(
  bodyRef: RefObject<HTMLTableSectionElement | null>,
  hasData: boolean,
  fallback = 10,
): number {
  const [rows, setRows] = useState(fallback)
  const [viewport, setViewport] = useState(() => window.innerHeight)

  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    const body = bodyRef.current
    const rowHeight = body?.rows[0]?.getBoundingClientRect().height ?? 0
    if (!hasData || !body || rowHeight <= 0) return
    // `<main>` scrolls, not the window — measure from its top, scroll-independent.
    const scroller = body.closest('main') ?? document.documentElement
    const top =
      body.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const available = scroller.clientHeight - top - RESERVED_BELOW_PX
    setRows(Math.max(MIN_ROWS, Math.floor(available / rowHeight)))
  }, [bodyRef, viewport, hasData])

  return rows
}

/**
 * Client-side paging for a plain `<Table>`, fitted to the window like
 * `DataTable`. Put `bodyRef` on the `<TableBody>`, render `pageRows`, and
 * pass `page`/`pageCount`/`setPage` to `<Pager>`.
 */
export function usePagedRows<T>(rows: T[], isLoading = false) {
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const size = useFitPageSize(bodyRef, !isLoading && rows.length > 0)
  const [wanted, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  // A filter or a bigger window can shrink the page count under the current page.
  const page = Math.min(wanted, pageCount - 1)
  const pageRows = rows.slice(page * size, (page + 1) * size)
  return { bodyRef, pageRows, page, pageCount, setPage }
}
