import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { ExecuteResult, MapCalculatedFieldInput, MapRun } from '@/lib/types'

const TERMINAL: MapRun['status'][] = ['COMPLETED', 'FAILED', 'CANCELLED']
const ROWS_PAGE_SIZE = 500

export interface UseMapRunResult {
  run: MapRun | null
  /** Rows loaded so far, 500 at a time via `loadMore`. */
  rows: Record<string, unknown>[]
  isQueued: boolean
  isRunning: boolean
  /** True when the last `request()` re-used a still-valid result instead of queueing a new run. */
  isReused: boolean
  error: string | null
  /** `ExecuteResult` built from the run's columns/decoration and the rows loaded so far — the shape `ExecutionPanel` already renders. */
  result: ExecuteResult | null
  request: (body: {
    parameters?: Record<string, unknown>
    calculatedFields?: MapCalculatedFieldInput[]
    force?: boolean
  }) => Promise<void>
  /** Load an existing run (from the Runs page or `?run=`). */
  open: (runId: string) => Promise<void>
  cancel: () => Promise<void>
  /** Next page of rows, 500 at a time. */
  loadMore: () => Promise<void>
}

/**
 * Drives a `map_runs` execution: request or open a run, poll it while queued
 * or running, and page through its stored rows once it completes. Mirrors
 * `useMapExport`'s polling shape (`refetchInterval` + a `TERMINAL` set).
 */
export function useMapRun(mapId: string | undefined): UseMapRunResult {
  const queryClient = useQueryClient()
  const [runId, setRunId] = useState<string | null>(null)
  const [reused, setReused] = useState(false)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rowsLoadedForRunId = useRef<string | null>(null)

  const runQuery = useQuery({
    queryKey: ['map-run', runId],
    queryFn: async () => (await apiClient.runs.get(runId!)).data.data,
    enabled: !!runId,
    // `request`/`open` seed the cache directly (a fresh run, or the reused
    // result already in hand) — never treat that as stale and refetch it a
    // second time on mount. `refetchInterval` below still drives polling.
    staleTime: Infinity,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL.includes(status) ? false : 1000
    },
  })

  const run = runQuery.data ?? null

  const loadRows = useCallback(async (id: string, off: number) => {
    try {
      const res = await apiClient.runs.rows(id, off, ROWS_PAGE_SIZE)
      setRows((prev) => (off === 0 ? res.data.data : [...prev, ...res.data.data]))
      setOffset(off + res.data.data.length)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [])

  // Load the first page the moment a run reaches COMPLETED — whether that
  // happened synchronously (a reused result) or after polling.
  useEffect(() => {
    if (run?.status === 'COMPLETED' && rowsLoadedForRunId.current !== run.id) {
      rowsLoadedForRunId.current = run.id
      void loadRows(run.id, 0)
    }
  }, [run, loadRows])

  const resetForNewRun = useCallback((newRun: MapRun, wasReused: boolean) => {
    rowsLoadedForRunId.current = null
    setRows([])
    setOffset(0)
    setReused(wasReused)
    queryClient.setQueryData(['map-run', newRun.id], newRun)
    setRunId(newRun.id)
  }, [queryClient])

  const request = useCallback(
    async (body: { parameters?: Record<string, unknown>; calculatedFields?: MapCalculatedFieldInput[]; force?: boolean }) => {
      if (!mapId) return
      setError(null)
      try {
        const { data: newRun, reused: wasReused } = await apiClient.maps.requestRun(mapId, body)
        resetForNewRun(newRun, wasReused)
      } catch (err) {
        setError(getErrorMessage(err))
      }
    },
    [mapId, resetForNewRun],
  )

  const open = useCallback((id: string) => {
    setError(null)
    rowsLoadedForRunId.current = null
    setRows([])
    setOffset(0)
    setReused(false)
    setRunId(id)
    return Promise.resolve()
  }, [])

  const cancel = useCallback(async () => {
    if (!runId) return
    try {
      await apiClient.runs.cancel(runId)
      queryClient.setQueryData<MapRun | undefined>(['map-run', runId], (old) =>
        old ? { ...old, status: 'CANCELLED' } : old,
      )
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [runId, queryClient])

  const loadMore = useCallback(async () => {
    if (!runId) return
    await loadRows(runId, offset)
  }, [runId, offset, loadRows])

  const result: ExecuteResult | null =
    run?.columns
      ? {
          columns: run.columns,
          rows,
          rowCount: run.rowCount ?? rows.length,
          executionTimeMs: run.executionTimeMs ?? 0,
          truncated: run.truncated,
          groupBreakAliases: run.decoration?.groupBreakAliases,
          totals: run.decoration?.totals,
          conditionalFormats: run.decoration?.conditionalFormats,
          warnings: run.decoration?.warnings,
        }
      : null

  return {
    run,
    rows,
    isQueued: run?.status === 'QUEUED',
    isRunning: run?.status === 'RUNNING',
    isReused: reused,
    error,
    result,
    request,
    open,
    cancel,
    loadMore,
  }
}
