import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { Folder, Item } from '@/lib/types'
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

// CO first: it is the plain column-backed item and the overwhelmingly common
// case in a real EUL. CI is a *created* item (a calculation). See
// migrate/EUL_SCHEMA_GROUND_TRUTH.md §3.2 — these two were previously
// inverted in both the labels and the form logic below.
const ITEM_TYPES = ['CO', 'CI', 'CU', 'JI', 'HI', 'AG', 'FU'] as const

/** Item types that are bound to a physical column rather than a formula. */
const COLUMN_BACKED_ITEM_TYPES: readonly string[] = ['CO']

function buildItemTypeOptions(t: (key: string) => string) {
  return [
    { value: 'CO', label: t('admin:items.itemTypes.co') },
    { value: 'CI', label: t('admin:items.itemTypes.ci') },
    { value: 'CU', label: t('admin:items.itemTypes.cu') },
    { value: 'JI', label: t('admin:items.itemTypes.ji') },
    { value: 'HI', label: t('admin:items.itemTypes.hi') },
    { value: 'AG', label: t('admin:items.itemTypes.ag') },
    { value: 'FU', label: t('admin:items.itemTypes.fu') },
  ] as const
}

const AGG_FUNCTIONS = ['NONE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX'] as const

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
    itemType: z.enum(ITEM_TYPES),
    columnName: z.string().optional(),
    formula: z.string().optional(),
    dataType: z.string().optional(),
    formatMask: z.string().optional(),
    aggFunction: z.string().optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

export function ItemsPage() {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const ITEM_TYPE_OPTIONS = buildItemTypeOptions(t)

  const [businessAreaId, setBusinessAreaId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ['folders', businessAreaId],
    queryFn: async () => (await apiClient.folders.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  const { data: items, isLoading } = useQuery({
    queryKey: ['items', folderId],
    queryFn: async () => (await apiClient.items.listByFolder(folderId)).data.data,
    enabled: !!folderId,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildFormSchema(t)),
    defaultValues: { name: '', description: '', itemType: 'CO', columnName: '', formula: '', dataType: '', formatMask: '', aggFunction: 'NONE' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '', itemType: 'CO', columnName: '', formula: '', dataType: '', formatMask: '', aggFunction: 'NONE' })
    setDialogOpen(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    form.reset({
      name: item.name,
      description: item.description ?? '',
      itemType: item.itemType,
      columnName: item.columnName ?? '',
      formula: item.formula ?? '',
      dataType: item.dataType ?? '',
      formatMask: item.formatMask ?? '',
      aggFunction: item.aggFunction ?? 'NONE',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        itemType: values.itemType,
        columnName: values.columnName || undefined,
        formula: values.formula || undefined,
        dataType: values.dataType || undefined,
        formatMask: values.formatMask || undefined,
        aggFunction: values.aggFunction && values.aggFunction !== 'NONE' ? values.aggFunction : undefined,
      }

      if (editing) {
        return (await apiClient.items.update(editing.id, payload)).data.data
      }
      return (await apiClient.items.create(folderId, payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items', folderId] })
      toast({ title: editing ? t('admin:items.toast.updated') : t('admin:items.toast.created') })
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
    mutationFn: async (id: string) => apiClient.items.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items', folderId] })
      toast({ title: t('admin:items.toast.deactivated') })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Item>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    { accessorKey: 'itemType', header: t('common:labels.type'), cell: ({ row }) => <Badge variant="outline">{row.original.itemType}</Badge> },
    { accessorKey: 'columnName', header: t('admin:items.columns.column'), cell: ({ row }) => row.original.columnName || '—' },
    { accessorKey: 'dataType', header: t('admin:items.columns.dataType'), cell: ({ row }) => row.original.dataType || '—' },
    { accessorKey: 'aggFunction', header: t('admin:items.columns.aggregation'), cell: ({ row }) => row.original.aggFunction || '—' },
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

  const itemType = form.watch('itemType')

  return (
    <AdminPageWrapper
      title={t('admin:items.title')}
      description={t('admin:items.description')}
      action={
        <Button onClick={openCreate} disabled={!folderId}>
          <Plus className="h-4 w-4" /> {t('admin:items.createButton')}
        </Button>
      }
    >
      <div className="flex gap-4">
        <div className="w-64 space-y-2">
          <Label>{t('admin:shared.businessAreaLabel')}</Label>
          <Select
            value={businessAreaId}
            onValueChange={(v) => {
              setBusinessAreaId(v)
              setFolderId('')
            }}
          >
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
        <div className="w-64 space-y-2">
          <Label>{t('admin:shared.folderLabel')}</Label>
          <Select value={folderId} onValueChange={setFolderId} disabled={!businessAreaId}>
            <SelectTrigger aria-label={t('admin:shared.folderLabel')}>
              <SelectValue placeholder={t('admin:items.selectFolderPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {(folders ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {folderId ? (
        <DataTable columns={columns} data={items ?? []} isLoading={isLoading} emptyMessage={t('admin:items.emptyMessage')} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('admin:items.selectBusinessAreaPrompt')}</p>
      )}

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? t('admin:items.dialog.editTitle') : t('admin:items.dialog.createTitle')}>
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
            <Label>{t('admin:items.form.itemTypeLabel')}</Label>
            <Select value={itemType} onValueChange={(v) => form.setValue('itemType', v as FormValues['itemType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {COLUMN_BACKED_ITEM_TYPES.includes(itemType) ? (
            <div className="space-y-2">
              <Label htmlFor="columnName">{t('admin:items.form.columnNameLabel')}</Label>
              <Input id="columnName" {...form.register('columnName')} placeholder={t('admin:items.form.columnNamePlaceholder')} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="formula">{t('admin:items.form.formulaLabel')}</Label>
              <Textarea id="formula" rows={4} {...form.register('formula')} placeholder={t('admin:items.form.formulaPlaceholder')} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataType">{t('admin:items.form.dataTypeLabel')}</Label>
              <Input id="dataType" {...form.register('dataType')} placeholder={t('admin:items.form.dataTypePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formatMask">{t('admin:items.form.formatMaskLabel')}</Label>
              <Input id="formatMask" {...form.register('formatMask')} placeholder={t('admin:items.form.formatMaskPlaceholder')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('admin:items.form.aggregationLabel')}</Label>
            <Select value={form.watch('aggFunction')} onValueChange={(v) => form.setValue('aggFunction', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGG_FUNCTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          itemLabel={t('admin:items.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
