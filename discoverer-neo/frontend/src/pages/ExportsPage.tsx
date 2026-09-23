import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { ExportJob, ExportJobStatus } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useLocale } from '@/hooks/useLocale'
import { formatDateTime } from '@/lib/format'
import { downloadBlob, safeFilename } from '@/components/map-builder/export-utils'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const ACTIVE: ExportJobStatus[] = ['PENDING', 'PROCESSING']
/** How often to re-poll the list while any job is still running. */
const POLL_MS = 2000
/** With nothing in flight, still look for exports requested elsewhere (viewer, runs page, another tab). */
const IDLE_POLL_MS = 30_000
const LIST_LIMIT = 100

function StatusBadge({ status }: { status: ExportJobStatus }) {
  const { t } = useTranslation(['mapViewer'])
  const label = t(`mapViewer:exportHistory.statuses.${status}`)
  if (status === 'COMPLETED') {
    return (
      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </Badge>
    )
  }
  if (status === 'FAILED') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {status === 'PROCESSING' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </Badge>
  )
}

/**
 * A user's own past and in-flight data exports — "where did my export go",
 * the first-week question every enterprise BI tool gets asked. Lists what
 * `export_jobs` already records; re-download reuses the same ownership-gated
 * route the original download used (`routes/export.ts`'s `loadOwnJob`), so
 * this view can show nothing it isn't independently allowed to open.
 */
export function ExportsPage() {
  const { t } = useTranslation(['mapViewer'])
  const { toast } = useToast()
  const { locale } = useLocale()

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['exports'],
    queryFn: async () => (await apiClient.exports.list(LIST_LIMIT)).data.data,
    // The app-wide 5 min staleTime would serve a return visit from cache and
    // miss the export just requested; always refetch on mount and focus.
    staleTime: 0,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j) => ACTIVE.includes(j.status)) ? POLL_MS : IDLE_POLL_MS,
  })

  async function download(job: ExportJob) {
    try {
      const res = await apiClient.exports.download(job.jobId)
      const ext = job.format === 'CSV' ? 'csv' : job.format === 'PDF' ? 'pdf' : 'xlsx'
      const name = job.mapName ?? job.mapId
      downloadBlob(res.data, `${safeFilename(name)}.${ext}`)
    } catch (err) {
      toast({
        title: t('mapViewer:export.downloadFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <AdminPageWrapper
      title={t('mapViewer:exportHistory.title')}
      description={t('mapViewer:exportHistory.description')}
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('mapViewer:exportHistory.map')}</TableHead>
              <TableHead>{t('mapViewer:exportHistory.format')}</TableHead>
              <TableHead>{t('mapViewer:exportHistory.status')}</TableHead>
              <TableHead>{t('mapViewer:exportHistory.rows')}</TableHead>
              <TableHead>{t('mapViewer:exportHistory.created')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t('mapViewer:exportHistory.loading')}
                </TableCell>
              </TableRow>
            ) : (jobs ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {t('mapViewer:exportHistory.noExports')}
                </TableCell>
              </TableRow>
            ) : (
              (jobs ?? []).map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell className="font-medium" title={job.mapId}>
                    {job.mapName ?? job.mapId.slice(0, 8)}
                  </TableCell>
                  <TableCell>{job.format}</TableCell>
                  <TableCell title={job.errorMessage ?? undefined}>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>{job.rowCount ?? '—'}</TableCell>
                  <TableCell>{formatDateTime(job.createdAt, locale)}</TableCell>
                  <TableCell>
                    {job.status === 'COMPLETED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('mapViewer:exportHistory.download')}
                        onClick={() => void download(job)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminPageWrapper>
  )
}
