import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2, Play } from 'lucide-react'
import { apiClient, getErrorKind, getErrorMessage } from '@/lib/api'
import type { ExecuteResult } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import {
  ParameterPromptDialog,
  needsParameterPrompt,
} from '@/components/parameters/ParameterPromptDialog'

export function MapViewerPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const { t } = useTranslation(['mapViewer', 'common'])

  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [lastParameters, setLastParameters] = useState<Record<string, unknown>>({})
  const [promptOpen, setPromptOpen] = useState(false)

  const mapQuery = useQuery({
    queryKey: ['maps', id],
    queryFn: async () => (await apiClient.maps.get(id!)).data.data,
    enabled: !!id,
  })

  const runMutation = useMutation({
    mutationFn: async (parameters: Record<string, unknown>): Promise<ExecuteResult> =>
      (await apiClient.maps.execute(id!, { parameters })).data.data,
    onSuccess: (res, parameters) => {
      setResult(res)
      setLastParameters(parameters)
      toast({
        title: t('mapViewer:viewer.executedTitle'),
        description: t('mapViewer:viewer.rowsReturned', { count: res.rowCount }),
      })
    },
    onError: (err) => {
      // A refusal is not a failure — the panel explains it in full, so the
      // toast says "not run", never "failed", and is not destructive-styled.
      const refused = getErrorKind(err) === 'REFUSED'
      toast({
        title: refused
          ? t('mapViewer:viewer.runRefusedTitle')
          : t('mapViewer:viewer.runFailedTitle'),
        description: refused ? t('mapViewer:viewer.runRefusedDescription') : getErrorMessage(err),
        variant: refused ? 'default' : 'destructive',
      })
    },
  })

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
    runMutation.mutate(defaults)
  }

  function handlePromptSubmit(values: Record<string, unknown>) {
    setPromptOpen(false)
    runMutation.mutate(values)
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
  const noOutputColumns = map.items.length === 0
  const disabledReason = noOutputColumns ? t('mapViewer:viewer.cannotRunNoColumns') : null

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{map.name}</h2>
          {map.description && <p className="text-muted-foreground">{map.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={handleRun}
              disabled={runMutation.isPending || !!disabledReason}
              title={disabledReason ?? undefined}
              aria-describedby={disabledReason ? 'run-disabled-reason' : undefined}
            >
              {runMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {runMutation.isPending ? t('common:actions.running') : t('common:actions.run')}
            </Button>
            {disabledReason && (
              <p id="run-disabled-reason" className="text-xs text-muted-foreground">
                {disabledReason}
              </p>
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
            parameters={lastParameters}
            isRunning={runMutation.isPending}
            runError={runMutation.error}
            onResultChange={setResult}
          />
        </CardContent>
      </Card>

      <ParameterPromptDialog
        parameters={map.parameters}
        open={promptOpen}
        onOpenChange={setPromptOpen}
        onSubmit={handlePromptSubmit}
      />
    </div>
  )
}
