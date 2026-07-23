import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plug, Plus, Pencil, Trash2, Search, Download } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { DataSource } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils'

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
    connectionType: z.enum(['oracle', 'postgres']),
    host: z.string().optional(),
    port: z.coerce.number().int().positive().optional().or(z.literal('')),
    serviceName: z.string().optional(),
    sid: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

export function DataSourcesPage() {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DataSource | null>(null)
  const [deleting, setDeleting] = useState<DataSource | null>(null)
  const [importFor, setImportFor] = useState<DataSource | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const { data: sources, isLoading } = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => (await apiClient.dataSources.list()).data.data,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildFormSchema(t)),
    defaultValues: { name: '', description: '', connectionType: 'oracle' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '', connectionType: 'oracle', host: '', port: '', serviceName: '', sid: '', username: '', password: '' })
    setDialogOpen(true)
  }

  function openEdit(ds: DataSource) {
    setEditing(ds)
    form.reset({
      name: ds.name,
      description: ds.description ?? '',
      connectionType: ds.connectionType,
      host: ds.host ?? '',
      port: ds.port ?? '',
      serviceName: ds.serviceName ?? '',
      sid: ds.sid ?? '',
      username: ds.username ?? '',
      password: '',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        connectionType: values.connectionType,
        host: values.host || undefined,
        port: values.port === '' ? undefined : values.port,
        serviceName: values.serviceName || undefined,
        sid: values.sid || undefined,
        username: values.username || undefined,
      }
      if (values.password) payload.passwordEnc = values.password

      if (editing) {
        return (await apiClient.dataSources.update(editing.id, payload)).data.data
      }
      return (await apiClient.dataSources.create(payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      toast({ title: editing ? t('admin:dataSources.toast.updated') : t('admin:dataSources.toast.created') })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({
        title: t('admin:shared.saveFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.dataSources.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      toast({ title: t('admin:dataSources.toast.deactivated') })
      setDeleting(null)
    },
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.dataSources.testConnection(id)).data.data,
    onSuccess: (result, id) => {
      setTestResult({ id, success: result.success, message: result.message })
      toast({
        title: result.success ? t('admin:dataSources.toast.connectionSucceeded') : t('admin:dataSources.toast.connectionFailed'),
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      })
    },
    onError: (err) => {
      toast({
        title: t('admin:dataSources.toast.testFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const introspectMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.dataSources.introspect(id)).data.data,
    onSuccess: (result) => {
      toast({ title: t('admin:dataSources.toast.introspectionComplete'), description: t('admin:dataSources.toast.introspectionCompleteDescription', { count: result.count }) })
    },
    onError: (err) => {
      toast({
        title: t('admin:dataSources.toast.introspectionFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<DataSource>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    { accessorKey: 'connectionType', header: t('common:labels.type'), cell: ({ row }) => <Badge variant="outline">{row.original.connectionType}</Badge> },
    { accessorKey: 'host', header: t('admin:dataSources.columns.host'), cell: ({ row }) => row.original.host || '—' },
    {
      accessorKey: 'isActive',
      header: t('common:labels.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? t('common:labels.active') : t('common:labels.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: t('common:labels.createdAt'),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title={t('admin:dataSources.actions.testConnection')}
            onClick={() => testMutation.mutate(row.original.id)}
            disabled={testMutation.isPending}
          >
            <Plug className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={t('admin:dataSources.actions.introspectSchema')}
            onClick={() => introspectMutation.mutate(row.original.id)}
            disabled={introspectMutation.isPending || row.original.connectionType !== 'oracle'}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t('admin:dataSources.actions.importTables')} onClick={() => setImportFor(row.original)}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title={t('common:actions.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} title={t('common:actions.delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AdminPageWrapper
      title={t('admin:dataSources.title')}
      description={t('admin:dataSources.description')}
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:dataSources.createButton')}
        </Button>
      }
    >
      {testResult && (
        <div
          className={`rounded-md border p-3 text-sm ${testResult.success ? 'border-success/50 bg-success/10' : 'border-destructive/50 bg-destructive/10'}`}
        >
          {testResult.message}
        </div>
      )}

      <DataTable columns={columns} data={sources ?? []} isLoading={isLoading} emptyMessage={t('admin:dataSources.emptyMessage')} />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('admin:dataSources.dialog.editTitle') : t('admin:dataSources.dialog.createTitle')}
      >
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">{t('common:labels.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('admin:dataSources.form.connectionTypeLabel')}</Label>
            <Select
              value={form.watch('connectionType')}
              onValueChange={(v) => form.setValue('connectionType', v as 'oracle' | 'postgres')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oracle">{t('admin:dataSources.form.connectionTypeOracle')}</SelectItem>
                <SelectItem value="postgres">{t('admin:dataSources.form.connectionTypePostgres')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">{t('admin:dataSources.form.hostLabel')}</Label>
              <Input id="host" {...form.register('host')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">{t('admin:dataSources.form.portLabel')}</Label>
              <Input id="port" type="number" {...form.register('port')} />
            </div>
          </div>
          {form.watch('connectionType') === 'oracle' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceName">{t('admin:dataSources.form.serviceNameLabel')}</Label>
                <Input id="serviceName" {...form.register('serviceName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sid">{t('admin:dataSources.form.sidLabel')}</Label>
                <Input id="sid" {...form.register('sid')} />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('admin:dataSources.form.usernameLabel')}</Label>
              <Input id="username" {...form.register('username')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {t('admin:dataSources.form.passwordLabel')} {editing?.hasPassword && <span className="text-muted-foreground">{t('admin:dataSources.form.passwordKeepHint')}</span>}
              </Label>
              <Input id="password" type="password" {...form.register('password')} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('admin:shared.saving') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel={t('admin:dataSources.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {importFor && <ImportTablesDialog dataSource={importFor} onClose={() => setImportFor(null)} />}
    </AdminPageWrapper>
  )
}

function ImportTablesDialog({ dataSource, onClose }: { dataSource: DataSource; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const { toast } = useToast()
  const [tableOwner, setTableOwner] = useState(dataSource.username ?? '')
  const [businessAreaId, setBusinessAreaId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const tablesQuery = useQuery({
    queryKey: ['data-sources', dataSource.id, 'tables', tableOwner],
    queryFn: async () => (await apiClient.dataSources.tables(dataSource.id, tableOwner || undefined)).data.data.tables,
    enabled: false,
  })

  const importMutation = useMutation({
    mutationFn: async () =>
      apiClient.dataSources.importTables(dataSource.id, {
        tableNames: Array.from(selected),
        tableOwner,
        businessAreaId,
      }),
    onSuccess: (res) => {
      const { created, skipped } = res.data.data
      toast({
        title: t('admin:dataSources.import.toast.importComplete'),
        description: t('admin:dataSources.import.toast.importCompleteDescription', { created: created.length, skipped: skipped.length }),
      })
      onClose()
    },
    onError: (err) => {
      toast({
        title: t('admin:dataSources.import.toast.importFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  function toggle(tableName: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tableName)) next.delete(tableName)
      else next.add(tableName)
      return next
    })
  }

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin:dataSources.import.dialogTitle', { name: dataSource.name })}
      description={t('admin:dataSources.import.dialogDescription')}
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>{t('admin:dataSources.import.tableOwnerLabel')}</Label>
            <Input value={tableOwner} onChange={(e) => setTableOwner(e.target.value)} placeholder={t('admin:dataSources.import.tableOwnerPlaceholder')} />
          </div>
          <Button onClick={() => void tablesQuery.refetch()} disabled={tablesQuery.isFetching}>
            <Search className="h-4 w-4" /> {t('admin:shared.discoverTablesButton')}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>{t('admin:shared.businessAreaLabel')}</Label>
          <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
            <SelectTrigger>
              <SelectValue placeholder={t('admin:dataSources.import.selectDestinationPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {(businessAreas ?? []).map((ba) => (
                <SelectItem key={ba.id} value={ba.id}>
                  {ba.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
          {tablesQuery.isFetching && <p className="text-sm text-muted-foreground">{t('admin:dataSources.import.discoveringTables')}</p>}
          {!tablesQuery.isFetching && (tablesQuery.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin:dataSources.import.noTablesDiscovered')}</p>
          )}
          {(tablesQuery.data ?? []).map((tbl) => (
            <label key={tbl.tableName} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
              <Checkbox checked={selected.has(tbl.tableName)} onCheckedChange={() => toggle(tbl.tableName)} />
              <span className="text-sm">{tbl.tableName}</span>
              <span className="text-xs text-muted-foreground">{t('admin:dataSources.import.columnsCount', { count: tbl.columns.length })}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            disabled={selected.size === 0 || !businessAreaId || !tableOwner || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? t('admin:dataSources.import.importing') : t('admin:dataSources.import.importButton', { count: selected.size })}
          </Button>
        </div>
      </div>
    </CreateEditDialog>
  )
}
