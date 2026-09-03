import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2, Play } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
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
    onError: (err) =>
      toast({
        title: t('mapViewer:viewer.runFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
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

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{map.name}</h2>
          {map.description && <p className="text-muted-foreground">{map.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRun} disabled={runMutation.isPending}>
            {runMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('common:actions.run')}
          </Button>
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
