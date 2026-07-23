import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Play, History, Download, Pause } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { Schedule, ScheduleParameterValue, MapParameter } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useLocale } from '@/hooks/useLocale'
import { formatDateTime, formatNumber } from '@/lib/format'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ---------------------------------------------------------------------------
// Cron presets — a raw expression input covers everything else ("Custom").
// Labels are translated at render time (see `useCronPresets` below); this
// module-level list only carries the value/expression pairing.
// ---------------------------------------------------------------------------

const CRON_PRESETS = [
  { value: 'daily', expr: '0 0 * * *' },
  { value: 'weekly', expr: '0 0 * * 0' },
  { value: 'monthly', expr: '0 0 1 * *' },
  { value: 'custom', expr: null as string | null },
] as const

function presetForExpression(expr: string): (typeof CRON_PRESETS)[number]['value'] {
  return CRON_PRESETS.find((p) => p.expr === expr)?.value ?? 'custom'
}

// A short, curated list rather than every IANA zone — covers the common
// cases; "Custom" lets anyone type an exact zone name.
const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
]

function paramInputType(paramType: MapParameter['paramType']): 'text' | 'number' | 'date' {
  if (paramType === 'NUMBER') return 'number'
  if (paramType === 'DATE') return 'date'
  return 'text'
}

/** `datetime-local` inputs need `YYYY-MM-DDTHH:mm`; ISO strings need a `Z`. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | undefined {
  if (!value) return undefined
  return new Date(value).toISOString()
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

function formatScheduleDateTime(iso: string | null, locale: string): string {
  if (!iso) return '—'
  return formatDateTime(iso, locale, DATE_TIME_OPTIONS)
}

// Built with a translator so validation messages localize with the UI.
function buildFormSchema(t: (key: string) => string) {
  return z.object({
    mapId: z.string().uuid(t('schedules:validation.selectMap')),
    name: z.string().min(1, t('schedules:validation.nameRequired')).max(255),
    cronPreset: z.enum(['daily', 'weekly', 'monthly', 'custom']),
    cronExpression: z.string().min(1, t('schedules:validation.cronExpressionRequired')),
    timezone: z.string().min(1),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    outputFormat: z.enum(['XLSX', 'CSV']),
    isActive: z.boolean(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

export function SchedulesPage() {
  const { t } = useTranslation(['schedules', 'common'])
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [deleting, setDeleting] = useState<Schedule | null>(null)
  const [historyFor, setHistoryFor] = useState<Schedule | null>(null)
  const [parameters, setParameters] = useState<ScheduleParameterValue[]>([])

  const cronPresets = useMemo(
    () =>
      CRON_PRESETS.map((p) => ({ ...p, label: t(`schedules:cronPresets.${p.value}`) })),
    [t],
  )

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: async () => (await apiClient.schedules.listMine()).data.data,
  })

  const { data: mapOptions } = useQuery({
    queryKey: ['maps'],
    queryFn: async () => (await apiClient.maps.listMine()).data.data,
  })

  const mapNameById = useMemo(() => {
    const lookup = new Map<string, string>()
    for (const m of [...(mapOptions?.mine ?? []), ...(mapOptions?.shared ?? [])]) {
      lookup.set(m.id, m.name)
    }
    return lookup
  }, [mapOptions])

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildFormSchema(t)),
    defaultValues: {
      mapId: '',
      name: '',
      cronPreset: 'daily',
      cronExpression: CRON_PRESETS[0].expr,
      timezone: 'UTC',
      outputFormat: 'CSV',
      isActive: true,
    },
  })

  const selectedMapId = form.watch('mapId')

  // Declared parameters of the selected map, so preset values line up with
  // what the map actually accepts (name + type-appropriate input).
  const { data: selectedMap } = useQuery({
    queryKey: ['maps', selectedMapId],
    queryFn: async () => (await apiClient.maps.get(selectedMapId)).data.data,
    enabled: !!selectedMapId,
  })

  function openCreate() {
    setEditing(null)
    setParameters([])
    form.reset({
      mapId: '',
      name: '',
      cronPreset: 'daily',
      cronExpression: CRON_PRESETS[0].expr,
      timezone: 'UTC',
      validFrom: '',
      validUntil: '',
      outputFormat: 'CSV',
      isActive: true,
    })
    setDialogOpen(true)
  }

  function openEdit(schedule: Schedule) {
    setEditing(schedule)
    setParameters(schedule.parameters)
    form.reset({
      mapId: schedule.mapId,
      name: schedule.name,
      cronPreset: presetForExpression(schedule.cronExpression),
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone,
      validFrom: toDatetimeLocal(schedule.validFrom),
      validUntil: toDatetimeLocal(schedule.validUntil),
      outputFormat: schedule.outputFormat,
      isActive: schedule.isActive,
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        cronExpression: values.cronExpression,
        timezone: values.timezone,
        validFrom: fromDatetimeLocal(values.validFrom ?? ''),
        validUntil: fromDatetimeLocal(values.validUntil ?? ''),
        outputFormat: values.outputFormat,
        isActive: values.isActive,
        parameters,
      }
      if (editing) {
        return (await apiClient.schedules.update(editing.id, payload)).data.data
      }
      return (await apiClient.schedules.create(values.mapId, payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast({
        title: editing ? t('schedules:toasts.scheduleUpdated') : t('schedules:toasts.scheduleCreated'),
      })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({
        title: t('schedules:toasts.saveFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.schedules.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast({ title: t('schedules:toasts.scheduleDeleted') })
      setDeleting(null)
    },
    onError: (err) => {
      toast({
        title: t('schedules:toasts.deleteFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (schedule: Schedule) =>
      apiClient.schedules.toggle(schedule.id, !schedule.isActive),
    onSuccess: (_res, schedule) => {
      void queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast({
        title: schedule.isActive
          ? t('schedules:toasts.schedulePaused')
          : t('schedules:toasts.scheduleEnabled'),
      })
    },
    onError: (err) => {
      toast({
        title: t('schedules:toasts.updateFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const triggerMutation = useMutation({
    mutationFn: async (id: string) => apiClient.schedules.trigger(id),
    onSuccess: () => {
      toast({
        title: t('schedules:toasts.runQueuedTitle'),
        description: t('schedules:toasts.runQueuedDescription'),
      })
    },
    onError: (err) => {
      toast({
        title: t('schedules:toasts.triggerFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  function updateParameter(paramName: string, paramValue: string) {
    setParameters((prev) => {
      const next = prev.filter((p) => p.paramName !== paramName)
      next.push({ paramName, paramValue: paramValue === '' ? null : paramValue })
      return next
    })
  }

  function parameterValue(paramName: string): string {
    return parameters.find((p) => p.paramName === paramName)?.paramValue ?? ''
  }

  const columns: ColumnDef<Schedule>[] = [
    { accessorKey: 'name', header: t('schedules:table.name') },
    {
      id: 'map',
      header: t('schedules:table.map'),
      cell: ({ row }) => mapNameById.get(row.original.mapId) ?? row.original.mapId.slice(0, 8),
    },
    { accessorKey: 'cronExpression', header: t('schedules:table.schedule') },
    {
      id: 'nextRun',
      header: t('schedules:table.nextRun'),
      cell: ({ row }) => formatScheduleDateTime(row.original.nextRunAt, locale),
    },
    {
      accessorKey: 'outputFormat',
      header: t('schedules:table.format'),
      cell: ({ row }) => <Badge variant="outline">{row.original.outputFormat}</Badge>,
    },
    {
      accessorKey: 'isActive',
      header: t('schedules:table.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? t('schedules:table.active') : t('schedules:table.paused')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={t('schedules:table.runNow')}
            onClick={() => triggerMutation.mutate(row.original.id)}
            disabled={!row.original.isActive || triggerMutation.isPending}
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={row.original.isActive ? t('schedules:table.pause') : t('schedules:table.enable')}
            onClick={() => toggleMutation.mutate(row.original)}
            disabled={toggleMutation.isPending}
          >
            <Pause className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('schedules:table.history')}
            onClick={() => setHistoryFor(row.original)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('schedules:table.edit')}
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('schedules:table.delete')}
            onClick={() => setDeleting(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const allMapOptions = [
    ...(mapOptions?.mine ?? []).map((m) => ({ ...m, owned: true })),
    ...(mapOptions?.shared ?? []).map((m) => ({ ...m, owned: false })),
  ]

  return (
    <AdminPageWrapper
      title={t('schedules:page.title')}
      description={t('schedules:page.description')}
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('schedules:page.newSchedule')}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={schedules ?? []}
        isLoading={isLoading}
        emptyMessage={t('schedules:page.emptyMessage')}
      />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('schedules:dialog.editTitle') : t('schedules:dialog.createTitle')}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}
        >
          {!editing && (
            <div className="space-y-2">
              <Label>{t('schedules:dialog.mapLabel')}</Label>
              <Select value={form.watch('mapId')} onValueChange={(v) => form.setValue('mapId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('schedules:dialog.mapPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allMapOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{' '}
                      {!m.owned && (
                        <span className="text-muted-foreground">
                          {t('schedules:dialog.sharedSuffix')}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.mapId && (
                <p className="text-sm text-destructive">{form.formState.errors.mapId.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('schedules:dialog.nameLabel')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('schedules:dialog.frequencyLabel')}</Label>
              <Select
                value={form.watch('cronPreset')}
                onValueChange={(v) => {
                  const preset = CRON_PRESETS.find((p) => p.value === v)!
                  form.setValue('cronPreset', preset.value)
                  if (preset.expr) form.setValue('cronExpression', preset.expr)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cronPresets.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('schedules:dialog.timezoneLabel')}</Label>
              <Select value={form.watch('timezone')} onValueChange={(v) => form.setValue('timezone', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.watch('cronPreset') === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="cronExpression">{t('schedules:dialog.cronExpressionLabel')}</Label>
              <Input
                id="cronExpression"
                placeholder="0 9 * * 1-5"
                {...form.register('cronExpression')}
              />
              <p className="text-xs text-muted-foreground">
                {t('schedules:dialog.cronExpressionHelp')}
              </p>
              {form.formState.errors.cronExpression && (
                <p className="text-sm text-destructive">{form.formState.errors.cronExpression.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="validFrom">{t('schedules:dialog.validFromLabel')}</Label>
              <Input id="validFrom" type="datetime-local" {...form.register('validFrom')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">{t('schedules:dialog.validUntilLabel')}</Label>
              <Input id="validUntil" type="datetime-local" {...form.register('validUntil')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('schedules:dialog.outputFormatLabel')}</Label>
            <Select
              value={form.watch('outputFormat')}
              onValueChange={(v) => form.setValue('outputFormat', v as 'XLSX' | 'CSV')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XLSX">{t('schedules:dialog.formatExcel')}</SelectItem>
                <SelectItem value="CSV">{t('schedules:dialog.formatCsv')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedMap && selectedMap.parameters.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs text-muted-foreground">
                {t('schedules:dialog.parameterPresetsLabel')}
              </Label>
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                {selectedMap.parameters.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <Label className="text-xs">
                      {p.name}
                      {p.isRequired && <span className="text-destructive"> *</span>}
                    </Label>
                    <Input
                      className="h-8"
                      type={paramInputType(p.paramType)}
                      value={parameterValue(p.name)}
                      placeholder={p.defaultValue ?? t('schedules:dialog.parameterValuePlaceholder')}
                      onChange={(e) => updateParameter(p.name, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v === true)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              {t('schedules:dialog.enabledLabel')}
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('schedules:dialog.saving') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('schedules:deleteDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('schedules:deleteDialog.descriptionBefore')}{' '}
                <span className="font-medium text-foreground">{deleting.name}</span>{' '}
                {t('schedules:deleteDialog.descriptionAfter')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t('schedules:deleteDialog.deleting') : t('common:actions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {historyFor && <ScheduleHistoryDialog schedule={historyFor} onClose={() => setHistoryFor(null)} />}
    </AdminPageWrapper>
  )
}

function ScheduleHistoryDialog({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const { t } = useTranslation(['schedules'])
  const { locale } = useLocale()
  const { toast } = useToast()

  const { data: history, isLoading } = useQuery({
    queryKey: ['schedules', schedule.id, 'history'],
    queryFn: async () => (await apiClient.schedules.history(schedule.id, 50)).data.data,
  })

  async function download(resultId: string) {
    try {
      const res = await apiClient.schedules.downloadResult(schedule.id, resultId)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${schedule.name}-${resultId}.${schedule.outputFormat === 'XLSX' ? 'xlsx' : 'csv'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: t('schedules:toasts.downloadFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('schedules:history.title', { name: schedule.name })}
      className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('schedules:history.executed')}</TableHead>
              <TableHead>{t('schedules:history.status')}</TableHead>
              <TableHead>{t('schedules:history.rows')}</TableHead>
              <TableHead>{t('schedules:history.duration')}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {t('schedules:history.loading')}
                </TableCell>
              </TableRow>
            ) : (history ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {t('schedules:history.noRuns')}
                </TableCell>
              </TableRow>
            ) : (
              (history ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatScheduleDateTime(r.executedAt, locale)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === 'SUCCESS' ? 'default' : r.status === 'TIMEOUT' ? 'secondary' : 'destructive'
                      }
                      title={r.errorMessage ?? undefined}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.rowCount ?? '—'}</TableCell>
                  <TableCell>
                    {r.executionTimeMs != null
                      ? t('schedules:history.durationSeconds', {
                          seconds: formatNumber(r.executionTimeMs / 1000, locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          }),
                        })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {r.status === 'SUCCESS' && r.filePath && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('schedules:history.download')}
                        onClick={() => void download(r.id)}
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
    </CreateEditDialog>
  )
}
