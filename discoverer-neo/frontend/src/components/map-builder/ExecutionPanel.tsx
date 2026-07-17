import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  X,
  Clock,
  Rows3,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  PlayCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useMapExport } from '@/hooks/useMapExport'
import { apiClient, getErrorKind, getErrorMessage } from '@/lib/api'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import type { AsyncExecutionJob, AsyncJobStatus, ExecuteResult, ExecutionErrorKind } from '@/lib/types'

const TERMINAL_JOB_STATUSES: AsyncJobStatus[] = [
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
]

const ERROR_KIND_LABEL: Record<ExecutionErrorKind, string> = {
  CONFIG: 'Configuration error',
  CONNECT: 'Connection error',
  TIMEOUT: 'Query timed out',
  QUERY: 'Query error',
  CANCELLED: 'Cancelled',
}

export interface ExecutionPanelProps {
  mapId: string | null
  mapName: string
  /** The current result to display — owned by the caller (single source of truth). */
  result: ExecuteResult | null
  /** Parameter values the result (and any "load more"/export) should be run with. */
  parameters: Record<string, unknown>
  /** True while the caller's own primary "Run" mutation is in flight. */
  isRunning?: boolean
  /** The primary "Run" mutation's error, if any (mapped to CONFIG/QUERY/etc.). */
  runError?: unknown
  /** Called whenever this panel obtains a new/updated result (load more, background run). */
  onResultChange: (result: ExecuteResult | null) => void
  onClose?: () => void
}

/**
 * Execution results surface: row count / timing / SQL, the results grid,
 * export actions, incremental "load more" pagination, and an optional
 * full-result background run with progress polling. Supersedes the older,
 * non-virtualized `ResultsPanel` (capped at 200 rows client-side).
 */
export function ExecutionPanel({
  mapId,
  mapName,
  result,
  parameters,
  isRunning,
  runError,
  onResultChange,
  onClose,
}: ExecutionPanelProps) {
  const { toast } = useToast()
  const [sqlOpen, setSqlOpen] = useState(false)
  const [bgJobId, setBgJobId] = useState<string | null>(null)

  const exportCtl = useMapExport(mapId, mapName, parameters)

  // --- "Load more": re-executes with a growing offset, appending pages ------
  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      if (!mapId || !result) throw new Error('Nothing to load more of yet.')
      const res = await apiClient.maps.execute(mapId, {
        parameters,
        offset: result.rows.length,
      })
      return res.data.data
    },
    onSuccess: (page) => {
      if (!result) return
      onResultChange({
        columns: result.columns,
        rows: [...result.rows, ...page.rows],
        rowCount: result.rows.length + page.rows.length,
        executionTimeMs: page.executionTimeMs,
        truncated: page.truncated,
        sql: page.sql ?? result.sql,
      })
    },
    onError: (err) =>
      toast({ title: 'Load more failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // --- Background (async) run: full result up to the async row cap ---------
  const bgRunMutation = useMutation({
    mutationFn: async () => {
      if (!mapId) throw new Error('Save the map before running in the background.')
      const res = await apiClient.maps.executeAsync(mapId, { parameters })
      return res.data.data
    },
    onSuccess: ({ jobId }) => setBgJobId(jobId),
    onError: (err) =>
      toast({ title: 'Run failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const bgStatusQuery = useQuery({
    queryKey: ['map-execution-job', mapId, bgJobId],
    queryFn: async () => (await apiClient.maps.getExecutionStatus(mapId!, bgJobId!)).data.data,
    enabled: !!mapId && !!bgJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL_JOB_STATUSES.includes(status) ? false : 700
    },
  })

  const bgJob: AsyncExecutionJob | null = bgStatusQuery.data ?? null

  useEffect(() => {
    if (!bgJob || !bgJobId) return
    if (bgJob.status === 'COMPLETED' && bgJob.result) {
      onResultChange(bgJob.result)
      toast({ title: 'Background run complete', description: `${bgJob.result.rowCount} row(s) returned.` })
      setBgJobId(null)
    } else if (bgJob.status === 'FAILED' || bgJob.status === 'TIMEOUT') {
      toast({
        title: 'Background run failed',
        description: bgJob.error ?? 'The execution failed.',
        variant: 'destructive',
      })
      setBgJobId(null)
    } else if (bgJob.status === 'CANCELLED') {
      setBgJobId(null)
    }
    // Deliberately keyed on status alone (not `bgJob`/`onResultChange`/`toast`,
    // which are referentially unstable across renders) — this should fire
    // exactly once per terminal status transition, not on every render.
  }, [bgJob?.status])

  const bgRunning = bgRunMutation.isPending || (!!bgJob && !TERMINAL_JOB_STATUSES.includes(bgJob.status))

  const errorKind = runError ? getErrorKind(runError) : undefined
  const errorText = runError ? getErrorMessage(runError) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-semibold">Results</span>
        {result && (
          <>
            <Badge variant="secondary" className="gap-1">
              <Rows3 className="h-3.5 w-3.5" /> {result.rowCount} row{result.rowCount === 1 ? '' : 's'}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3.5 w-3.5" /> {result.executionTimeMs} ms
            </Badge>
            {result.truncated && (
              <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> More rows available
              </Badge>
            )}
            {result.sql && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setSqlOpen((v) => !v)}
              >
                {sqlOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                SQL
              </Button>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {result && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={exportCtl.isExporting || !mapId}
                onClick={() => exportCtl.exportFormat('XLSX')}
              >
                {exportCtl.isExporting && exportCtl.format === 'XLSX' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={exportCtl.isExporting || !mapId}
                onClick={() => exportCtl.exportFormat('CSV')}
              >
                {exportCtl.isExporting && exportCtl.format === 'CSV' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                CSV
              </Button>
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label="Close results"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {result?.sql && sqlOpen && (
        <pre className="max-h-40 overflow-auto border-b bg-muted/30 px-4 py-2 text-xs">
          <code>{result.sql}</code>
        </pre>
      )}

      {errorText && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              {errorKind ? ERROR_KIND_LABEL[errorKind] : 'Execution error'}
            </p>
            <p className="text-muted-foreground">{errorText}</p>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ResultsTable
          columns={result?.columns ?? []}
          rows={result?.rows ?? []}
          isLoading={isRunning}
          emptyMessage={result ? 'Query returned no rows.' : 'Run the map to see results.'}
        />
      </div>

      {result?.truncated && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>Not all rows are loaded.</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={loadMoreMutation.isPending || !mapId}
            onClick={() => loadMoreMutation.mutate()}
          >
            {loadMoreMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={bgRunning || !mapId}
            onClick={() => bgRunMutation.mutate()}
            title="Run the full query in the background (up to 100,000 rows)"
          >
            {bgRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            {bgRunning ? `Running… (${bgJob?.status ?? 'QUEUED'})` : 'Run full result'}
          </Button>
        </div>
      )}
    </div>
  )
}
