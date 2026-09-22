import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2, Play } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import { useMapRun } from '@/hooks/useMapRun'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import {
  ParameterPromptDialog,
  itemIdForParameter,
  needsParameterPrompt,
} from '@/components/parameters/ParameterPromptDialog'

export function MapViewerPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { t } = useTranslation(['mapViewer', 'common'])

  const [promptOpen, setPromptOpen] = useState(false)
  // `request()`/`open()` queue or fetch a run and resolve as soon as that
  // call lands — not when the run itself finishes — so this tracks only the
  // brief round trip to the server, distinct from `isQueued`/`isRunning`.
  const [isRequesting, setIsRequesting] = useState(false)

  const mapQuery = useQuery({
    queryKey: ['maps', id],
    queryFn: async () => (await apiClient.maps.get(id!)).data.data,
    enabled: !!id,
  })

  const { run, result, isQueued, isRunning, isReused, error, request, open } = useMapRun(id)

  // `?run=<id>` (from the Runs page, or a shared link) opens that run instead
  // of starting a new one. `open` is a stable callback, so this only re-fires
  // if the query string itself changes.
  useEffect(() => {
    const runParam = searchParams.get('run')
    if (runParam) void open(runParam)
  }, [searchParams, open])

  useEffect(() => {
    if (error) {
      toast({
        title: t('mapViewer:viewer.runFailedTitle'),
        description: error,
        variant: 'destructive',
      })
    }
  }, [error, toast, t])

  async function runWith(parameters: Record<string, unknown>, force = false) {
    setIsRequesting(true)
    try {
      await request({ parameters, force })
    } finally {
      setIsRequesting(false)
    }
  }

  function handleRun() {
    const parameters = mapQuery.data?.parameters ?? []
    if (needsParameterPrompt(parameters)) {
      setPromptOpen(true)
      return
    }
    const defaults: Record<string, unknown> = {}
    for (const p of parameters) {
      if (p.defaultValue != null && p.defaultValue !== '') defaults[p.name] = p.defaultValue
    }
    void runWith(defaults)
  }

  function handlePromptSubmit(values: Record<string, unknown>) {
    setPromptOpen(false)
    void runWith(values)
  }

  function handleRunAgain() {
    void runWith(run?.parameters ?? {}, true)
  }

  // "Queued (position unknown)" / "Running…" while the run is in flight, then
  // "Result from <time>, valid until <time>" once it lands — the line the
  // "Run again" button sits under.
  function statusLine(): string | null {
    if (isQueued) return t('mapViewer:viewer.statusQueued')
    if (isRunning) return t('mapViewer:viewer.statusRunning')
    if (run?.status === 'COMPLETED') {
      const time = run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : ''
      const until = new Date(run.expiresAt).toLocaleString()
      return isReused
        ? t('mapViewer:viewer.statusResultReused', { time, until })
        : t('mapViewer:viewer.statusResult', { time, until })
    }
    return null
  }

  if (mapQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('mapViewer:viewer.loading')}
      </div>
    )
  }

  if (mapQuery.isError || !mapQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('mapViewer:viewer.notFound')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(mapQuery.error, t('mapViewer:viewer.notFoundDescription'))}
          </p>
        </CardContent>
      </Card>
    )
  }

  const map = mapQuery.data

  // D-102: a disabled primary action must state its reason. The one condition
  // the client can know before it asks the server is an empty column list — a
  // migrated worksheet whose items did not resolve. Everything else that can
  // stop a run (no data-source connection, no data entitlement) is only
  // knowable server-side and comes back as a CONNECT/FORBIDDEN error kind.
  // A prompt shows a pick-list when it can be traced to an item, which a
  // parameter does only through the condition written over it.
  const promptParameters = map.parameters.map((p) => ({
    ...p,
    itemId: itemIdForParameter(p, map.conditions),
  }))

  const noOutputColumns = map.items.length === 0
  const disabledReason = noOutputColumns ? t('mapViewer:viewer.cannotRunNoColumns') : null
  const running = isRequesting || isQueued || isRunning
  const status = statusLine()

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{map.name}</h2>
          {map.description && (
            <p className="whitespace-pre-line text-muted-foreground">{map.description}</p>
          )}
          {/* A filter that did not migrate has no other symptom: the map runs
              and returns more rows than Discoverer did. Say so. */}
          {map.droppedFilters && map.droppedFilters.length > 0 && (
            <details className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-warning-foreground">
                {t('mapViewer:droppedFilters.summary', { count: map.droppedFilters.length })}
              </summary>
              <ul className="mt-2 space-y-1">
                {map.droppedFilters.map((f, i) => (
                  <li key={i} className="text-muted-foreground">
                    <code className="text-xs">{f.text}</code>
                    <span className="block text-xs">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={handleRun}
              disabled={running || !!disabledReason}
              title={disabledReason ?? undefined}
              aria-describedby={disabledReason ? 'run-disabled-reason' : undefined}
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? t('common:actions.running') : t('common:actions.run')}
            </Button>
            {disabledReason && (
              <p id="run-disabled-reason" className="text-xs text-muted-foreground">
                {disabledReason}
              </p>
            )}
            {status && <p className="text-xs text-muted-foreground">{status}</p>}
            {run?.status === 'COMPLETED' && (
              <Button variant="ghost" size="sm" onClick={handleRunAgain} disabled={running}>
                {t('mapViewer:viewer.runAgain')}
              </Button>
            )}
          </div>
          <Button variant="outline" asChild>
            <Link to="/schedules">
              <CalendarClock className="h-4 w-4" /> {t('mapViewer:viewer.scheduleManagement')}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="min-h-0 flex-1 p-0">
          <ExecutionPanel
            mapId={map.id}
            mapName={map.name}
            mapType={map.mapType}
            result={result}
            run={run}
            parameters={run?.parameters ?? {}}
            isRunning={running}
            runError={error}
            onResultChange={() => {}}
          />
        </CardContent>
      </Card>

      <ParameterPromptDialog
        parameters={promptParameters}
        open={promptOpen}
        onOpenChange={setPromptOpen}
        onSubmit={handlePromptSubmit}
      />
    </div>
  )
}
