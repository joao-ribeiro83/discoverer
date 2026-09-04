import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
import {
  apiClient,
  getErrorKind,
  getErrorMessage,
  getRefusalCode,
  getRefusalDetails,
} from '@/lib/api'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import { CrosstabTable, crosstabAxes } from '@/components/data-table/CrosstabTable'
import { ExecutionRefusal } from '@/components/map-builder/ExecutionRefusal'
import type {
  AsyncExecutionJob,
  AsyncJobStatus,
  ExecuteResult,
  ExecutionErrorKind,
  MapType,
} from '@/lib/types'

const TERMINAL_JOB_STATUSES: AsyncJobStatus[] = [
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
]

// Short headline labels for the error banner, keyed by the backend's `kind`
// discriminant. Deliberately distinct from the longer `errors:execution.*`
// descriptions (which read as full sentences) — these are single-line
// headlines paired with the raw backend message underneath.
const ERROR_KIND_KEY: Record<ExecutionErrorKind, string> = {
  CONFIG: 'mapViewer:execution.errorKind.CONFIG',
  CONNECT: 'mapViewer:execution.errorKind.CONNECT',
  TIMEOUT: 'mapViewer:execution.errorKind.TIMEOUT',
  QUERY: 'mapViewer:execution.errorKind.QUERY',
  CANCELLED: 'mapViewer:execution.errorKind.CANCELLED',
  FORBIDDEN: 'mapViewer:execution.errorKind.FORBIDDEN',
  // REFUSED never reaches this banner — it renders as ExecutionRefusal.
  REFUSED: 'mapViewer:execution.errorKind.REFUSED',
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
  /**
   * The map's view type. `CROSSTAB` pivots the result instead of listing it;
   * everything else draws the worksheet grid.
   */
  mapType?: MapType
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
  mapType,
}: ExecutionPanelProps) {
  const { t } = useTranslation(['mapViewer', 'common'])
  const { toast } = useToast()
  const [sqlOpen, setSqlOpen] = useState(false)
  const [bgJobId, setBgJobId] = useState<string | null>(null)

  const exportCtl = useMapExport(mapId, mapName, parameters)

  // --- "Load more": re-executes with a growing offset, appending pages ------
  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      if (!mapId || !result) throw new Error(t('mapViewer:execution.nothingToLoadMore'))
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
        // Breaks and totals describe the whole filtered set, not the page, so
        // the newest run's copies apply to the appended rows too.
        groupBreakAliases: page.groupBreakAliases ?? result.groupBreakAliases,
        totals: page.totals ?? result.totals,
        warnings: page.warnings ?? result.warnings,
      })
    },
    onError: (err) =>
      toast({
        title: t('mapViewer:execution.loadMoreFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  })

  // --- Background (async) run: full result up to the async row cap ---------
  const bgRunMutation = useMutation({
    mutationFn: async () => {
      if (!mapId) throw new Error(t('mapViewer:execution.saveBeforeBackgroundRun'))
      const res = await apiClient.maps.executeAsync(mapId, { parameters })
      return res.data.data
    },
    onSuccess: ({ jobId }) => setBgJobId(jobId),
    onError: (err) =>
      toast({
        title: t('mapViewer:execution.runFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
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
      toast({
        title: t('mapViewer:execution.backgroundRunCompleteTitle'),
        description: t('mapViewer:execution.rowsReturned', { count: bgJob.result.rowCount }),
      })
      setBgJobId(null)
    } else if (bgJob.status === 'FAILED' || bgJob.status === 'TIMEOUT') {
      toast({
        title: t('mapViewer:execution.backgroundRunFailedTitle'),
        description: bgJob.error ?? t('mapViewer:execution.executionFailedFallback'),
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
  // A refusal is a separate surface, not a red banner (D-036). Only fall back
  // to the error banner when the backend sent no recognised refusal code.
  const refusalCode = errorKind === 'REFUSED' ? getRefusalCode(runError) : undefined
  const errorText = runError && !refusalCode ? getErrorMessage(runError) : null

  // A crosstab needs a column edge, and Discoverer records none — so a
  // migrated crosstab arrives with every axis column on the row edge and
  // cannot be pivoted until someone assigns one. Rather than draw an empty
  // pivot, fall back to the grid and say why.
  const wantsCrosstab = mapType === 'CROSSTAB'
  const canPivot = !!result && crosstabAxes(result.columns).canPivot
  const showCrosstab = wantsCrosstab && canPivot

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <span className="text-sm font-semibold">{t('mapViewer:execution.results')}</span>
        {result && (
          <>
            <Badge variant="secondary" className="gap-1">
              <Rows3 className="h-3.5 w-3.5" />{' '}
              {t('mapViewer:execution.rowCount', { count: result.rowCount })}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3.5 w-3.5" />{' '}
              {t('mapViewer:execution.executionTime', { ms: result.executionTimeMs })}
            </Badge>
            {result.truncated && (
              <Badge variant="outline" className="gap-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> {t('mapViewer:execution.moreRowsAvailable')}
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
                {t('mapViewer:execution.sql')}
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
                {t('mapViewer:execution.excel')}
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
                {t('mapViewer:execution.csv')}
              </Button>
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
              aria-label={t('mapViewer:execution.closeResults')}
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

      {refusalCode && (
        <ExecutionRefusal code={refusalCode} details={getRefusalDetails(runError)} />
      )}

      {errorText && (
        <div
          role="alert"
          data-testid="execution-error"
          className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              {errorKind ? t(ERROR_KIND_KEY[errorKind]) : t('mapViewer:execution.executionError')}
            </p>
            <p className="text-muted-foreground">{errorText}</p>
          </div>
        </div>
      )}

      {wantsCrosstab && result && !canPivot && (
        <div
          className="mx-4 mt-3 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground"
          data-testid="crosstab-fallback-note"
        >
          {t('mapViewer:crosstab.noColumnEdge')}
        </div>
      )}

      {/* Semantics the map defines that this run could not carry — a sort
          dropped under SELECT DISTINCT, a total whose Discoverer aggregate did
          not migrate. Advisory: the rows above them are valid. */}
      {result?.warnings && result.warnings.length > 0 && (
        <div className="mx-4 mt-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
            {t('mapViewer:execution.worksheetWarningsTitle', {
              count: result.warnings.length,
            })}
          </p>
          <ul className="ml-6 mt-1 list-disc text-muted-foreground">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {showCrosstab ? (
          <CrosstabTable
            columns={result?.columns ?? []}
            rows={result?.rows ?? []}
            emptyMessage={
              result ? t('mapViewer:execution.noRows') : t('mapViewer:execution.runToSeeResults')
            }
          />
        ) : (
          <ResultsTable
            columns={result?.columns ?? []}
            rows={result?.rows ?? []}
            isLoading={isRunning}
            emptyMessage={
              result ? t('mapViewer:execution.noRows') : t('mapViewer:execution.runToSeeResults')
            }
            groupBreakAliases={result?.groupBreakAliases}
            totals={result?.totals}
          />
        )}
      </div>

      {result?.truncated && (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{t('mapViewer:execution.notAllRowsLoaded')}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={loadMoreMutation.isPending || !mapId}
            onClick={() => loadMoreMutation.mutate()}
          >
            {loadMoreMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('common:actions.loadMore')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={bgRunning || !mapId}
            onClick={() => bgRunMutation.mutate()}
            title={t('mapViewer:execution.runFullResultTooltip')}
          >
            {bgRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            {bgRunning
              ? t('mapViewer:execution.runningStatus', { status: bgJob?.status ?? 'QUEUED' })
              : t('mapViewer:execution.runFullResult')}
          </Button>
        </div>
      )}
    </div>
  )
}
