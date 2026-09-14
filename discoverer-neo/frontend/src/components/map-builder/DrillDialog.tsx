import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient, getErrorMessage } from '@/lib/api'
import { ResultsTable } from '@/components/data-table/ResultsTable'
import type { ExecuteResult } from '@/lib/types'

interface DrillDialogProps {
  mapId: string
  /** The clicked row's values, keyed by column alias — null closes the dialog. */
  rowValues: Record<string, unknown> | null
  onClose: () => void
  parameters: Record<string, unknown>
}

/**
 * Discoverer's "Drill to Detail": reruns the worksheet with aggregation
 * stripped and the clicked row's values pinned, showing the raw rows behind
 * a total or grouped figure. Opens on a row double-click in `ResultsTable`.
 */
export function DrillDialog({ mapId, rowValues, onClose, parameters }: DrillDialogProps) {
  const { t } = useTranslation(['mapViewer'])
  const [result, setResult] = useState<ExecuteResult | null>(null)

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const res = await apiClient.maps.drillToDetail(mapId, { parameters, rowValues: values })
      return res.data.data
    },
    onSuccess: setResult,
  })

  useEffect(() => {
    if (!rowValues) {
      setResult(null)
      return
    }
    mutation.mutate(rowValues)
    // Only the clicked row should re-trigger a fetch, not every render.
  }, [rowValues])

  return (
    <Dialog open={!!rowValues} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>{t('mapViewer:execution.drill.title')}</DialogTitle>
          <DialogDescription>{t('mapViewer:execution.drill.description')}</DialogDescription>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('mapViewer:execution.drill.loading')}
          </div>
        )}

        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{getErrorMessage(mutation.error)}</p>
          </div>
        )}

        {result && (
          <div className="min-h-0 flex-1">
            <ResultsTable columns={result.columns} rows={result.rows} className="h-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
