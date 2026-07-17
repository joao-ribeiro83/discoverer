import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
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

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  connectionType: z.enum(['oracle', 'postgres']),
  host: z.string().optional(),
  port: z.coerce.number().int().positive().optional().or(z.literal('')),
  serviceName: z.string().optional(),
  sid: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function DataSourcesPage() {
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
    resolver: standardSchemaResolver(formSchema),
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
      toast({ title: editing ? 'Data source updated' : 'Data source created' })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.dataSources.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      toast({ title: 'Data source deactivated' })
      setDeleting(null)
    },
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.dataSources.testConnection(id)).data.data,
    onSuccess: (result, id) => {
      setTestResult({ id, success: result.success, message: result.message })
      toast({
        title: result.success ? 'Connection succeeded' : 'Connection failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      })
    },
    onError: (err) => {
      toast({
        title: 'Test failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const introspectMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.dataSources.introspect(id)).data.data,
    onSuccess: (result) => {
      toast({ title: 'Introspection complete', description: `Discovered ${result.count} table(s).` })
    },
    onError: (err) => {
      toast({
        title: 'Introspection failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<DataSource>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'connectionType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.connectionType}</Badge> },
    { accessorKey: 'host', header: 'Host', cell: ({ row }) => row.original.host || '—' },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
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
            title="Test connection"
            onClick={() => testMutation.mutate(row.original.id)}
            disabled={testMutation.isPending}
          >
            <Plug className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Introspect schema"
            onClick={() => introspectMutation.mutate(row.original.id)}
            disabled={introspectMutation.isPending || row.original.connectionType !== 'oracle'}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Import tables" onClick={() => setImportFor(row.original)}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AdminPageWrapper
      title="Data Sources"
      description="Manage database connections used to introspect and import schema."
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Data Source
        </Button>
      }
    >
      {testResult && (
        <div
          className={`rounded-md border p-3 text-sm ${testResult.success ? 'border-green-500/50 bg-green-500/10' : 'border-destructive/50 bg-destructive/10'}`}
        >
          {testResult.message}
        </div>
      )}

      <DataTable columns={columns} data={sources ?? []} isLoading={isLoading} emptyMessage="No data sources yet." />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Data Source' : 'New Data Source'}
      >
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Connection Type</Label>
            <Select
              value={form.watch('connectionType')}
              onValueChange={(v) => form.setValue('connectionType', v as 'oracle' | 'postgres')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oracle">Oracle</SelectItem>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" {...form.register('host')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" {...form.register('port')} />
            </div>
          </div>
          {form.watch('connectionType') === 'oracle' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service Name</Label>
                <Input id="serviceName" {...form.register('serviceName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sid">SID</Label>
                <Input id="sid" {...form.register('sid')} />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...form.register('username')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Password {editing?.hasPassword && <span className="text-muted-foreground">(leave blank to keep)</span>}
              </Label>
              <Input id="password" type="password" {...form.register('password')} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel="data source"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {importFor && <ImportTablesDialog dataSource={importFor} onClose={() => setImportFor(null)} />}
    </AdminPageWrapper>
  )
}

function ImportTablesDialog({ dataSource, onClose }: { dataSource: DataSource; onClose: () => void }) {
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
        title: 'Import complete',
        description: `Created ${created.length} folder(s), skipped ${skipped.length}.`,
      })
      onClose()
    },
    onError: (err) => {
      toast({
        title: 'Import failed',
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
      title={`Import Tables — ${dataSource.name}`}
      description="Discover tables and import selected tables as folders."
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>Table Owner / Schema</Label>
            <Input value={tableOwner} onChange={(e) => setTableOwner(e.target.value)} placeholder="e.g. SCOTT" />
          </div>
          <Button onClick={() => void tablesQuery.refetch()} disabled={tablesQuery.isFetching}>
            <Search className="h-4 w-4" /> Discover Tables
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Business Area</Label>
          <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination business area" />
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
          {tablesQuery.isFetching && <p className="text-sm text-muted-foreground">Discovering tables...</p>}
          {!tablesQuery.isFetching && (tablesQuery.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No tables discovered yet.</p>
          )}
          {(tablesQuery.data ?? []).map((t) => (
            <label key={t.tableName} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
              <Checkbox checked={selected.has(t.tableName)} onCheckedChange={() => toggle(t.tableName)} />
              <span className="text-sm">{t.tableName}</span>
              <span className="text-xs text-muted-foreground">({t.columns.length} columns)</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0 || !businessAreaId || !tableOwner || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? 'Importing...' : `Import ${selected.size} table(s)`}
          </Button>
        </div>
      </div>
    </CreateEditDialog>
  )
}
