import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
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

const ITEM_TYPES = [
  { value: 'CI', label: 'Column Item (CI)' },
  { value: 'CU', label: 'Calculated Item (CU)' },
  { value: 'CO', label: 'Condition (CO)' },
  { value: 'JI', label: 'Join Item (JI)' },
  { value: 'HI', label: 'Hierarchy Item (HI)' },
  { value: 'AG', label: 'Aggregation (AG)' },
  { value: 'FU', label: 'Function (FU)' },
] as const

const AGG_FUNCTIONS = ['NONE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX'] as const

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  itemType: z.enum(['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU']),
  columnName: z.string().optional(),
  formula: z.string().optional(),
  dataType: z.string().optional(),
  formatMask: z.string().optional(),
  aggFunction: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

export function ItemsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

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
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { name: '', description: '', itemType: 'CI', columnName: '', formula: '', dataType: '', formatMask: '', aggFunction: 'NONE' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '', itemType: 'CI', columnName: '', formula: '', dataType: '', formatMask: '', aggFunction: 'NONE' })
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
      toast({ title: editing ? 'Item updated' : 'Item created' })
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
    mutationFn: async (id: string) => apiClient.items.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items', folderId] })
      toast({ title: 'Item deactivated' })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Item>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'itemType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.itemType}</Badge> },
    { accessorKey: 'columnName', header: 'Column', cell: ({ row }) => row.original.columnName || '—' },
    { accessorKey: 'dataType', header: 'Data Type', cell: ({ row }) => row.original.dataType || '—' },
    { accessorKey: 'aggFunction', header: 'Aggregation', cell: ({ row }) => row.original.aggFunction || '—' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
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

  const itemType = form.watch('itemType')

  return (
    <AdminPageWrapper
      title="Items"
      description="Manage items exposed from folders — columns, calculations, and aggregations."
      action={
        <Button onClick={openCreate} disabled={!folderId}>
          <Plus className="h-4 w-4" /> New Item
        </Button>
      }
    >
      <div className="flex gap-4">
        <div className="w-64 space-y-2">
          <Label>Business Area</Label>
          <Select
            value={businessAreaId}
            onValueChange={(v) => {
              setBusinessAreaId(v)
              setFolderId('')
            }}
          >
            <SelectTrigger aria-label="Business Area">
              <SelectValue placeholder="Select a business area" />
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
          <Label>Folder</Label>
          <Select value={folderId} onValueChange={setFolderId} disabled={!businessAreaId}>
            <SelectTrigger aria-label="Folder">
              <SelectValue placeholder="Select a folder" />
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
        <DataTable columns={columns} data={items ?? []} isLoading={isLoading} emptyMessage="No items in this folder yet." />
      ) : (
        <p className="text-sm text-muted-foreground">Select a business area and folder to view its items.</p>
      )}

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Item' : 'New Item'}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select value={itemType} onValueChange={(v) => form.setValue('itemType', v as FormValues['itemType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itemType === 'CI' ? (
            <div className="space-y-2">
              <Label htmlFor="columnName">Column Name</Label>
              <Input id="columnName" {...form.register('columnName')} placeholder="e.g. CUSTOMER_ID" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="formula">Formula</Label>
              <Textarea id="formula" rows={4} {...form.register('formula')} placeholder="e.g. QUANTITY * UNIT_PRICE" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Input id="dataType" {...form.register('dataType')} placeholder="e.g. NUMBER" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formatMask">Format Mask</Label>
              <Input id="formatMask" {...form.register('formatMask')} placeholder="e.g. 999,999.00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Aggregation</Label>
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
          itemLabel="item"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
