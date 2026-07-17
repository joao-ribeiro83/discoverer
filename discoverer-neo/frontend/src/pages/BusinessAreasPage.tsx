import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Users as UsersIcon, X } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { BusinessArea, UserOption } from '@/lib/types'
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
import { formatDate } from '@/lib/utils'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

const PERMISSION_LEVELS = ['VIEW', 'EXPORT', 'SCHEDULE', 'CREATE', 'EDIT', 'DELETE'] as const

export function BusinessAreasPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BusinessArea | null>(null)
  const [deleting, setDeleting] = useState<BusinessArea | null>(null)
  const [grantsFor, setGrantsFor] = useState<BusinessArea | null>(null)

  const { data: areas, isLoading } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { name: '', description: '' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '' })
    setDialogOpen(true)
  }

  function openEdit(area: BusinessArea) {
    setEditing(area)
    form.reset({ name: area.name, description: area.description ?? '' })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        return (await apiClient.businessAreas.update(editing.id, values)).data.data
      }
      return (await apiClient.businessAreas.create(values)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas'] })
      toast({ title: editing ? 'Business area updated' : 'Business area created' })
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
    mutationFn: async (id: string) => apiClient.businessAreas.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas'] })
      toast({ title: 'Business area deactivated' })
      setDeleting(null)
    },
    onError: (err) => {
      toast({
        title: 'Delete failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<BusinessArea>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || <span className="text-muted-foreground">—</span>,
    },
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
          <Button variant="ghost" size="icon" onClick={() => setGrantsFor(row.original)} title="Manage grants">
            <UsersIcon className="h-4 w-4" />
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
      title="Business Areas"
      description="Manage business areas for your data models."
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Business Area
        </Button>
      }
    >
      <DataTable columns={columns} data={areas ?? []} isLoading={isLoading} emptyMessage="No business areas yet." />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Business Area' : 'New Business Area'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}
        >
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
          itemLabel="business area"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {grantsFor && (
        <GrantsDialog businessArea={grantsFor} onClose={() => setGrantsFor(null)} />
      )}
    </AdminPageWrapper>
  )
}

function GrantsDialog({ businessArea, onClose }: { businessArea: BusinessArea; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [userId, setUserId] = useState('')
  const [permissionLevel, setPermissionLevel] = useState<string>('VIEW')

  const { data: grants, isLoading } = useQuery({
    queryKey: ['business-areas', businessArea.id, 'grants'],
    queryFn: async () => (await apiClient.businessAreas.grants(businessArea.id)).data.data,
  })

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users', 'options'],
    queryFn: async () => (await apiClient.users.list()).data.data,
    retry: false,
  })

  const grantMutation = useMutation({
    mutationFn: async () =>
      apiClient.businessAreas.grant(businessArea.id, { userId, permissionLevel }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas', businessArea.id, 'grants'] })
      setUserId('')
      toast({ title: 'Access granted' })
    },
    onError: (err) => {
      toast({
        title: 'Grant failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (targetUserId: string) => apiClient.businessAreas.revoke(businessArea.id, targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas', businessArea.id, 'grants'] })
      toast({ title: 'Access revoked' })
    },
  })

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Grants — ${businessArea.name}`}
      description="Control which users can access this business area and what they can do."
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-2">
            <Label>Permission</Label>
            <Select value={permissionLevel} onValueChange={setPermissionLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!userId || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
          >
            Add
          </Button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading grants...</p>}
          {!isLoading && (grants ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No grants yet.</p>
          )}
          {(grants ?? []).map((grant) => (
            <div key={grant.id} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">{grant.userName ?? grant.userEmail}</p>
                <p className="text-xs text-muted-foreground">{grant.userEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{grant.permissionLevel}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeMutation.mutate(grant.userId)}
                  title="Revoke"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </CreateEditDialog>
  )
}
