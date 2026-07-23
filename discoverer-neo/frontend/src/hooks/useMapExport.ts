import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiClient, getErrorMessage } from '@/lib/api'
import { downloadBlob, safeFilename } from '@/components/map-builder/export-utils'
import { useToast } from '@/hooks/use-toast'
import type { ExportFileFormat, ExportJobStatus, MapCalculatedFieldInput } from '@/lib/types'

const TERMINAL: ExportJobStatus[] = ['COMPLETED', 'FAILED']
/** How long to poll quietly before surfacing a "queued" toast for a slow export. */
const QUIET_POLL_MS = 1500

export interface UseMapExportResult {
  /** Kick off a background export job for the given format. */
  exportFormat: (format: ExportFileFormat, options?: { calculatedFields?: MapCalculatedFieldInput[] }) => void
  isExporting: boolean
  status: ExportJobStatus | null
  progress: number
  format: ExportFileFormat | null
  errorMessage: string | null
}

/**
 * Server-side data export flow: create the job, poll it, and trigger a
 * browser download the moment it completes. Shared by `ExecutionPanel`,
 * `MapToolbar` (via `MapBuilderPage`), and `MapViewerPage` so every export
 * entry point behaves identically.
 */
export function useMapExport(
  mapId: string | null,
  mapName: string,
  parameters: Record<string, unknown> = {},
): UseMapExportResult {
  const { t } = useTranslation(['mapViewer'])
  const { toast } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [downloadedJobId, setDownloadedJobId] = useState<string | null>(null)
  const queuedToastShown = useRef(false)
  const startedAt = useRef(0)

  const createMutation = useMutation({
    mutationFn: async ({
      format,
      calculatedFields,
    }: {
      format: ExportFileFormat
      calculatedFields?: MapCalculatedFieldInput[]
    }) => {
      if (!mapId) throw new Error(t('mapViewer:export.saveBeforeExport'))
      const res = await apiClient.maps.createExport(mapId, { format, parameters, calculatedFields })
      return res.data.data
    },
    onMutate: () => {
      queuedToastShown.current = false
      startedAt.current = Date.now()
    },
    onSuccess: ({ jobId: id }) => setJobId(id),
    onError: (err) =>
      toast({
        title: t('mapViewer:export.exportFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  })

  const statusQuery = useQuery({
    // Job ids are globally unique, so the map is not part of the key.
    queryKey: ['export-job', jobId],
    queryFn: async () => (await apiClient.exports.getStatus(jobId!)).data.data,
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && TERMINAL.includes(status) ? false : 700
    },
  })

  const job = statusQuery.data ?? null

  // Slow exports get a one-time "queued" toast so the user isn't left guessing.
  useEffect(() => {
    if (!jobId || !job) return
    if (job.status !== 'PENDING' && job.status !== 'PROCESSING') return
    if (queuedToastShown.current) return
    if (Date.now() - startedAt.current < QUIET_POLL_MS) return
    queuedToastShown.current = true
    toast({
      title: t('mapViewer:export.exportQueuedTitle'),
      description: t('mapViewer:export.exportQueuedDescription'),
    })
  }, [job, jobId, toast, t])

  const download = useCallback(async () => {
    if (!jobId || !job) return
    try {
      const res = await apiClient.exports.download(jobId)
      const ext = job.format === 'CSV' ? 'csv' : 'xlsx'
      downloadBlob(res.data, `${safeFilename(mapName)}.${ext}`)
      setDownloadedJobId(jobId)
    } catch (err) {
      toast({
        title: t('mapViewer:export.downloadFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }, [jobId, job, mapName, toast, t])

  // Auto-download the instant a job completes (fast exports never show a
  // "queued" state at all — this just fires before the user notices).
  useEffect(() => {
    if (job?.status === 'COMPLETED' && jobId && downloadedJobId !== jobId) {
      void download()
    }
    if (job?.status === 'FAILED') {
      toast({
        title: t('mapViewer:export.exportFailedTitle'),
        description: job.errorMessage ?? t('mapViewer:export.exportJobFailedFallback'),
        variant: 'destructive',
      })
    }
  }, [job, jobId, downloadedJobId, download, toast, t])

  const exportFormat = useCallback(
    (format: ExportFileFormat, options?: { calculatedFields?: MapCalculatedFieldInput[] }) => {
      setJobId(null)
      setDownloadedJobId(null)
      createMutation.mutate({ format, calculatedFields: options?.calculatedFields })
    },
    [createMutation],
  )

  const isExporting =
    createMutation.isPending || (!!job && !TERMINAL.includes(job.status)) || false

  return {
    exportFormat,
    isExporting,
    status: job?.status ?? null,
    progress: job?.progress ?? 0,
    format: job?.format ?? null,
    errorMessage: job?.errorMessage ?? null,
  }
}
