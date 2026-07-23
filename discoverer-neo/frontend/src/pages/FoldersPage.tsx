import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Wand2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { DataSource, Folder, IntrospectedTable } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const FOLDER_TYPES = ['TABLE', 'VIEW', 'DERIVED', 'COMPLEX', 'JOIN', 'SUMMARY'] as const

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
    folderType: z.enum(FOLDER_TYPES),
    dataSourceId: z.string().optional(),
    tableName: z.string().optional(),
    tableOwner: z.string().optional(),
    customSql: z.string().optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

export function FoldersPage() {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [businessAreaId, setBusinessAreaId] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Folder | null>(null)
  const [deleting, setDeleting] = useState<Folder | null>(null)
  const [discovered, setDiscovered] = useState<IntrospectedTable[]>([])

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: async () => (await apiClient.dataSources.list()).data.data,
    retry: false,
  })

  const { data: folders, isLoading } = useQuery({
    queryKey: ['folders', businessAreaId],
    queryFn: async () => (await apiClient.folders.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildFormSchema(t)),
    defaultValues: { name: '', description: '', folderType: 'TABLE', dataSourceId: '', tableName: '', tableOwner: '', customSql: '' },
  })

  function openCreate() {
    setEditing(null)
    setDiscovered([])
    form.reset({ name: '', description: '', folderType: 'TABLE', dataSourceId: '', tableName: '', tableOwner: '', customSql: '' })
    setDialogOpen(true)
  }

  function openEdit(folder: Folder) {
    setEditing(folder)
    setDiscovered([])
    form.reset({
      name: folder.name,
      description: folder.description ?? '',
      folderType: folder.folderType,
      dataSourceId: folder.dataSourceId ?? '',
      tableName: folder.tableName ?? '',
      tableOwner: folder.tableOwner ?? '',
      customSql: folder.customSql ?? '',
    })
    setDialogOpen(true)
  }

  const discoverMutation = useMutation({
    mutationFn: async (dataSourceId: string) => (await apiClient.dataSources.tables(dataSourceId)).data.data.tables,
    onSuccess: (tables) => setDiscovered(tables),
    onError: (err) => {
      toast({
        title: t('admin:folders.toast.discoveryFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  function applyDiscoveredTable(table: { tableName: string; tableOwner?: string }) {
    form.setValue('tableName', table.tableName)
    if (table.tableOwner) form.setValue('tableOwner', table.tableOwner)
    if (!form.getValues('name')) form.setValue('name', table.tableName)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        folderType: values.folderType,
        dataSourceId: values.dataSourceId || undefined,
        tableName: values.tableName || undefined,
        tableOwner: values.tableOwner || undefined,
        customSql: values.customSql || undefined,
      }

      if (editing) {
        return (await apiClient.folders.update(editing.id, payload)).data.data
      }
      return (await apiClient.folders.create(businessAreaId, payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders', businessAreaId] })
      toast({ title: editing ? t('admin:folders.toast.updated') : t('admin:folders.toast.created') })
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
    mutationFn: async (id: string) => apiClient.folders.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['folders', businessAreaId] })
      toast({ title: t('admin:folders.toast.deactivated') })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Folder>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    { accessorKey: 'folderType', header: t('common:labels.type'), cell: ({ row }) => <Badge variant="outline">{row.original.folderType}</Badge> },
    { accessorKey: 'tableName', header: t('admin:folders.columns.tableName'), cell: ({ row }) => row.original.tableName || '—' },
    { accessorKey: 'dataSourceName', header: t('admin:folders.columns.dataSource'), cell: ({ row }) => row.original.dataSourceName || '—' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
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

  const selectedDataSourceId = form.watch('dataSourceId')

  return (
    <AdminPageWrapper
      title={t('admin:folders.title')}
      description={t('admin:folders.description')}
      action={
        <Button onClick={openCreate} disabled={!businessAreaId}>
          <Plus className="h-4 w-4" /> {t('admin:folders.createButton')}
        </Button>
      }
    >
      <div className="w-72 space-y-2">
        <Label>{t('admin:shared.businessAreaLabel')}</Label>
        <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
          <SelectTrigger aria-label={t('admin:shared.businessAreaLabel')}>
            <SelectValue placeholder={t('admin:shared.selectBusinessAreaPlaceholder')} />
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

      {businessAreaId ? (
        <DataTable columns={columns} data={folders ?? []} isLoading={isLoading} emptyMessage={t('admin:folders.emptyMessage')} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin:folders.selectBusinessAreaPrompt')}</p>
      )}

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? t('admin:folders.dialog.editTitle') : t('admin:folders.dialog.createTitle')}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">{t('common:labels.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('common:labels.description')}</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="space-y-2">
            <Label>{t('admin:folders.form.folderTypeLabel')}</Label>
            <Select value={form.watch('folderType')} onValueChange={(v) => form.setValue('folderType', v as FormValues['folderType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLDER_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {ft}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.watch('folderType') === 'DERIVED' || form.watch('folderType') === 'COMPLEX' ? (
            <div className="space-y-2">
              <Label htmlFor="customSql">{t('admin:folders.form.customSqlLabel')}</Label>
              <Textarea id="customSql" rows={4} {...form.register('customSql')} />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t('admin:folders.form.dataSourceLabel')}</Label>
                <div className="flex gap-2">
                  <Select value={selectedDataSourceId} onValueChange={(v) => form.setValue('dataSourceId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin:folders.form.selectDataSourcePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(dataSources ?? []).map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedDataSourceId || discoverMutation.isPending}
                    onClick={() => selectedDataSourceId && discoverMutation.mutate(selectedDataSourceId)}
                  >
                    <Wand2 className="h-4 w-4" /> {t('admin:shared.discoverTablesButton')}
                  </Button>
                </div>
              </div>

              {discovered.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {discovered.map((dt) => (
                    <button
                      type="button"
                      key={dt.tableName}
                      onClick={() => applyDiscoveredTable(dt)}
                      className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    >
                      {dt.tableName}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tableName">{t('admin:folders.form.tableNameLabel')}</Label>
                  <Input id="tableName" {...form.register('tableName')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tableOwner">{t('admin:folders.form.tableOwnerLabel')}</Label>
                  <Input id="tableOwner" {...form.register('tableOwner')} />
                </div>
              </div>
            </>
          )}

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
          itemLabel={t('admin:folders.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
