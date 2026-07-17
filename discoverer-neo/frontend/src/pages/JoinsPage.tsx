import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Wand2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { Folder, Item, Join, JoinSuggestion } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  leftFolderId: z.string().min(1, 'Left folder is required'),
  rightFolderId: z.string().min(1, 'Right folder is required'),
  leftItemId: z.string().optional(),
  rightItemId: z.string().optional(),
  joinType: z.enum(JOIN_TYPES),
})
type FormValues = z.infer<typeof formSchema>

export function JoinsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [businessAreaId, setBusinessAreaId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Join | null>(null)
  const [deleting, setDeleting] = useState<Join | null>(null)
  const [suggestions, setSuggestions] = useState<JoinSuggestion[]>([])

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ['folders', businessAreaId],
    queryFn: async () => (await apiClient.folders.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  const { data: joins, isLoading } = useQuery({
    queryKey: ['joins', businessAreaId],
    queryFn: async () => (await apiClient.joins.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { name: '', leftFolderId: '', rightFolderId: '', leftItemId: '', rightItemId: '', joinType: 'INNER' },
  })

  const leftFolderId = form.watch('leftFolderId')
  const rightFolderId = form.watch('rightFolderId')

  const { data: leftItems } = useQuery<Item[]>({
    queryKey: ['items', leftFolderId],
    queryFn: async () => (await apiClient.items.listByFolder(leftFolderId)).data.data,
    enabled: !!leftFolderId,
  })

  const { data: rightItems } = useQuery<Item[]>({
    queryKey: ['items', rightFolderId],
    queryFn: async () => (await apiClient.items.listByFolder(rightFolderId)).data.data,
    enabled: !!rightFolderId,
  })

  function openCreate() {
    setEditing(null)
    setSuggestions([])
    form.reset({ name: '', leftFolderId: '', rightFolderId: '', leftItemId: '', rightItemId: '', joinType: 'INNER' })
    setDialogOpen(true)
  }

  function openEdit(join: Join) {
    setEditing(join)
    setSuggestions([])
    form.reset({
      name: join.name,
      leftFolderId: join.leftFolderId,
      rightFolderId: join.rightFolderId,
      leftItemId: join.leftItemId ?? '',
      rightItemId: join.rightItemId ?? '',
      joinType: join.joinType,
    })
    setDialogOpen(true)
  }

  const suggestMutation = useMutation({
    mutationFn: async (folderId: string) => (await apiClient.joins.suggestions(folderId)).data.data,
    onSuccess: (result) => {
      setSuggestions(result)
      if (result.length === 0) {
        toast({ title: 'No join suggestions found for this folder' })
      }
    },
    onError: (err) => {
      toast({
        title: 'Suggestion failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  function applySuggestion(s: JoinSuggestion) {
    form.setValue('leftFolderId', s.leftFolderId)
    form.setValue('rightFolderId', s.rightFolderId)
    form.setValue('leftItemId', s.leftItemId)
    form.setValue('rightItemId', s.rightItemId)
    form.setValue('joinType', s.suggestedJoinType)
    if (!form.getValues('name')) {
      form.setValue('name', `${s.leftColumnName} = ${s.rightColumnName}`)
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        leftFolderId: values.leftFolderId,
        rightFolderId: values.rightFolderId,
        leftItemId: values.leftItemId || null,
        rightItemId: values.rightItemId || null,
        joinType: values.joinType,
      }

      if (editing) {
        return (await apiClient.joins.update(editing.id, payload)).data.data
      }
      return (await apiClient.joins.create(businessAreaId, payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['joins', businessAreaId] })
      toast({ title: editing ? 'Join updated' : 'Join created' })
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
    mutationFn: async (id: string) => apiClient.joins.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['joins', businessAreaId] })
      toast({ title: 'Join deactivated' })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Join>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'leftFolderName', header: 'Left Folder' },
    { accessorKey: 'rightFolderName', header: 'Right Folder' },
    { accessorKey: 'joinType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.joinType}</Badge> },
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

  return (
    <AdminPageWrapper
      title="Joins"
      description="Define relationships between folders within a business area."
      action={
        <Button onClick={openCreate} disabled={!businessAreaId}>
          <Plus className="h-4 w-4" /> New Join
        </Button>
      }
    >
      <div className="w-72 space-y-2">
        <Label>Business Area</Label>
        <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
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

      {businessAreaId ? (
        <DataTable columns={columns} data={joins ?? []} isLoading={isLoading} emptyMessage="No joins in this business area yet." />
      ) : (
        <p className="text-sm text-muted-foreground">Select a business area to view its joins.</p>
      )}

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Join' : 'New Join'}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Left Folder</Label>
              <Select value={leftFolderId} onValueChange={(v) => form.setValue('leftFolderId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {(folders ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.leftFolderId && (
                <p className="text-sm text-destructive">{form.formState.errors.leftFolderId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Right Folder</Label>
              <Select value={rightFolderId} onValueChange={(v) => form.setValue('rightFolderId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {(folders ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.rightFolderId && (
                <p className="text-sm text-destructive">{form.formState.errors.rightFolderId.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!leftFolderId || suggestMutation.isPending}
              onClick={() => leftFolderId && suggestMutation.mutate(leftFolderId)}
            >
              <Wand2 className="h-4 w-4" /> Suggest Joins
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
              {suggestions.map((s, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                >
                  {s.leftColumnName} = {s.rightColumnName}{' '}
                  <span className="text-xs text-muted-foreground">({s.reason})</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Left Item</Label>
              <Select value={form.watch('leftItemId')} onValueChange={(v) => form.setValue('leftItemId', v)} disabled={!leftFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {(leftItems ?? []).map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Right Item</Label>
              <Select value={form.watch('rightItemId')} onValueChange={(v) => form.setValue('rightItemId', v)} disabled={!rightFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {(rightItems ?? []).map((it) => (
                    <SelectItem key={it.id} value={it.id}>
                      {it.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Join Type</Label>
            <Select value={form.watch('joinType')} onValueChange={(v) => form.setValue('joinType', v as FormValues['joinType'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOIN_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
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
          itemLabel="join"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
