import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ExternalLink,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { MapRun } from '@/lib/types'
import { useMapExport } from '@/hooks/useMapExport'
import { useToast } from '@/hooks/use-toast'
import { useLocale } from '@/hooks/useLocale'
import { useAuthStore } from '@/store/auth'
import { formatDateTime, formatInteger, formatExpiresIn } from '@/lib/format'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Statuses a row keeps refreshing under — same idea as ExportsPage's ACTIVE. */
const ACTIVE: MapRun['status'][] = ['QUEUED', 'RUNNING']
const TERMINAL: MapRun['status'][] = ['COMPLETED', 'FAILED', 'CANCELLED']
const POLL_MS = 2000
/** With nothing in flight, still look for runs started elsewhere (viewer, another tab, a schedule). */
const IDLE_POLL_MS = 30_000
const LIST_LIMIT = 200

function isExpired(run: MapRun): boolean {
  return new Date(run.expiresAt).getTime() <= Date.now()
}

function canExportRun(run: MapRun): boolean {
  return run.status === 'COMPLETED' && !isExpired(run)
}

function StatusBadge({ status, t }: { status: MapRun['status']; t: (key: string) => string }) {
  const label = t(`runs:statuses.${status}`)
  if (status === 'COMPLETED') {
    return (
      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="h-3 w-3" />
        {label}
      </Badge>
    )
  }
  if (status === 'FAILED' || status === 'CANCELLED') {
    return (
      <Badge variant={status === 'FAILED' ? 'destructive' : 'secondary'} className="gap-1">
        <XCircle className="h-3 w-3" />
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      {status === 'RUNNING' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {label}
    </Badge>
  )
}

function parametersSummary(parameters: Record<string, unknown>, noneLabel: string): { text: string; title: string } {
  const entries = Object.entries(parameters)
  if (entries.length === 0) return { text: noneLabel, title: '' }
  const pairs = entries.map(([k, v]) => `${k}=${String(v)}`)
  return { text: pairs.slice(0, 3).join(', ') + (pairs.length > 3 ? '…' : ''), title: pairs.join(', ') }
}

/** Per-row export buttons — `useMapExport` is a hook, so each row gets its own instance. */
function RunExportButtons({ run }: { run: MapRun }) {
  const { t } = useTranslation(['runs'])
  const exportCtl = useMapExport(run.mapId, run.mapName, run.parameters, run.id)
  if (!canExportRun(run)) return null
  return (
    <>
      {(['XLSX', 'CSV', 'PDF'] as const).map((format) => (
        <Button
          key={format}
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={exportCtl.isExporting}
          onClick={() => exportCtl.exportFormat(format)}
        >
          {exportCtl.isExporting && exportCtl.format === format ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {t(`runs:actions.${format.toLowerCase()}`)}
        </Button>
      ))}
    </>
  )
}

/**
 * A user's own run history (an admin can see everyone's): what ran, what it
 * returned, and how long the stored result stays valid — mirrors
 * `ExportsPage`'s "where did my thing go" job, one layer up the stack.
 */
export function RunsPage() {
  const { t } = useTranslation(['runs'])
  const { toast } = useToast()
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const isAdmin = role === 'ADMIN'

  const [allUsers, setAllUsers] = useState(false)
  const [mapFilter, setMapFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<MapRun['status'] | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<MapRun['kind'] | 'all'>('all')
  const [deleting, setDeleting] = useState<MapRun | null>(null)

  const { data: runs, isLoading } = useQuery({
    queryKey: ['runs', isAdmin && allUsers],
    queryFn: async () =>
      (await apiClient.runs.list({ all: isAdmin && allUsers, limit: LIST_LIMIT })).data.data,
    // The app-wide 5 min staleTime would show a cached list on a return
    // visit and miss the run the user just requested; always refetch on
    // mount and window focus instead.
    staleTime: 0,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => ACTIVE.includes(r.status)) ? POLL_MS : IDLE_POLL_MS,
  })

  const maps = useMemo(() => {
    const byId = new Map<string, string>()
    for (const r of runs ?? []) byId.set(r.mapId, r.mapName)
    return [...byId.entries()]
  }, [runs])

  const filtered = useMemo(() => {
    return (runs ?? []).filter(
      (r) =>
        (mapFilter === 'all' || r.mapId === mapFilter) &&
        (statusFilter === 'all' || r.status === statusFilter) &&
        (kindFilter === 'all' || r.kind === kindFilter),
    )
  }, [runs, mapFilter, statusFilter, kindFilter])

  const runAgainMutation = useMutation({
    mutationFn: (run: MapRun) =>
      apiClient.maps.requestRun(run.mapId, {
        parameters: run.parameters,
        calculatedFields: run.calculatedFields,
        force: false,
      }),
    onSuccess: ({ reused }) => {
      toast({
        title: reused ? t('runs:toasts.reusedTitle') : t('runs:toasts.queuedTitle'),
        description: reused ? t('runs:toasts.reusedDescription') : t('runs:toasts.queuedDescription'),
      })
      void queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
    onError: (err) =>
      toast({ title: t('runs:toasts.runAgainFailedTitle'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.runs.cancel(id),
    onSuccess: () => {
      toast({ title: t('runs:toasts.cancelledTitle') })
      void queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
    onError: (err) =>
      toast({ title: t('runs:toasts.cancelFailedTitle'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.runs.cancel(id),
    onSuccess: () => {
      toast({ title: t('runs:toasts.deletedTitle') })
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
    onError: (err) =>
      toast({ title: t('runs:toasts.deleteFailedTitle'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  return (
    <AdminPageWrapper title={t('runs:title')} description={t('runs:description')}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mapFilter} onValueChange={setMapFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('runs:filters.allMaps')}</SelectItem>
            {maps.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('runs:filters.allStatuses')}</SelectItem>
            {(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`runs:statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('runs:filters.allKinds')}</SelectItem>
            {(['LIVE', 'SCHEDULED'] as const).map((k) => (
              <SelectItem key={k} value={k}>
                {t(`runs:kinds.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={allUsers} onCheckedChange={(v) => setAllUsers(v === true)} />
            {t('runs:filters.allUsers')}
          </label>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('runs:columns.map')}</TableHead>
              <TableHead>{t('runs:columns.kind')}</TableHead>
              <TableHead>{t('runs:columns.parameters')}</TableHead>
              <TableHead>{t('runs:columns.status')}</TableHead>
              <TableHead>{t('runs:columns.rows')}</TableHead>
              <TableHead>{t('runs:columns.duration')}</TableHead>
              <TableHead>{t('runs:columns.ranAt')}</TableHead>
              <TableHead>{t('runs:columns.expiresIn')}</TableHead>
              <TableHead>{t('runs:columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {t('runs:loading')}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {t('runs:empty')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((run) => {
                const summary = parametersSummary(run.parameters, t('runs:noParameters'))
                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link to={`/maps/${run.mapId}/view`} className="hover:underline">
                        {run.mapName}
                      </Link>
                    </TableCell>
                    <TableCell>{t(`runs:kinds.${run.kind}`)}</TableCell>
                    <TableCell title={summary.title} className="max-w-[240px] truncate text-muted-foreground">
                      {summary.text}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} t={t} />
                    </TableCell>
                    <TableCell>{run.rowCount != null ? formatInteger(run.rowCount, locale) : '—'}</TableCell>
                    <TableCell>{run.executionTimeMs != null ? `${formatInteger(run.executionTimeMs, locale)} ms` : '—'}</TableCell>
                    <TableCell>{formatDateTime(run.createdAt, locale)}</TableCell>
                    <TableCell>{formatExpiresIn(run.expiresAt, t)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" size="icon" title={t('runs:actions.open')} asChild>
                          <Link to={`/maps/${run.mapId}/view?run=${run.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('runs:actions.runAgain')}
                          disabled={runAgainMutation.isPending}
                          onClick={() => runAgainMutation.mutate(run)}
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <RunExportButtons run={run} />
                        {run.status === 'QUEUED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('runs:actions.cancel')}
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(run.id)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        {TERMINAL.includes(run.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('runs:actions.delete')}
                            onClick={() => setDeleting(run)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        itemName={deleting?.mapName ?? ''}
        itemLabel={t('runs:deleteConfirmItemLabel')}
        description={t('runs:deleteConfirmDescription', { name: deleting?.mapName ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </AdminPageWrapper>
  )
}
