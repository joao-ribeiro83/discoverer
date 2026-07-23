import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

const PERMISSION_LEVELS = ['VIEW', 'EXPORT', 'SCHEDULE', 'CREATE', 'EDIT', 'DELETE'] as const

export function BusinessAreasPage() {
  const { t } = useTranslation(['admin', 'common'])
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
    resolver: standardSchemaResolver(buildFormSchema(t)),
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
      toast({ title: editing ? t('admin:businessAreas.toast.updated') : t('admin:businessAreas.toast.created') })
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
    mutationFn: async (id: string) => apiClient.businessAreas.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas'] })
      toast({ title: t('admin:businessAreas.toast.deactivated') })
      setDeleting(null)
    },
    onError: (err) => {
      toast({
        title: t('admin:shared.deleteFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<BusinessArea>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    {
      accessorKey: 'description',
      header: t('common:labels.description'),
      cell: ({ row }) => row.original.description || <span className="text-muted-foreground">—</span>,
    },
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
          <Button variant="ghost" size="icon" onClick={() => setGrantsFor(row.original)} title={t('admin:businessAreas.manageGrantsTitle')}>
            <UsersIcon className="h-4 w-4" />
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
      title={t('admin:businessAreas.title')}
      description={t('admin:businessAreas.description')}
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:businessAreas.createButton')}
        </Button>
      }
    >
      <DataTable columns={columns} data={areas ?? []} isLoading={isLoading} emptyMessage={t('admin:businessAreas.emptyMessage')} />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('admin:businessAreas.dialog.editTitle') : t('admin:businessAreas.dialog.createTitle')}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}
        >
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
          itemLabel={t('admin:businessAreas.entityLabel')}
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
  const { t } = useTranslation(['admin', 'common'])
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
      toast({ title: t('admin:businessAreas.grants.toast.accessGranted') })
    },
    onError: (err) => {
      toast({
        title: t('admin:businessAreas.grants.toast.grantFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (targetUserId: string) => apiClient.businessAreas.revoke(businessArea.id, targetUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-areas', businessArea.id, 'grants'] })
      toast({ title: t('admin:businessAreas.grants.toast.accessRevoked') })
    },
  })

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin:businessAreas.grants.dialogTitle', { name: businessArea.name })}
      description={t('admin:businessAreas.grants.dialogDescription')}
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>{t('admin:businessAreas.grants.userLabel')}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('admin:businessAreas.grants.selectUserPlaceholder')} />
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
            <Label>{t('admin:businessAreas.grants.permissionLabel')}</Label>
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
            {t('admin:businessAreas.grants.addButton')}
          </Button>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
          {isLoading && <p className="text-sm text-muted-foreground">{t('admin:businessAreas.grants.loadingGrants')}</p>}
          {!isLoading && (grants ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin:businessAreas.grants.noGrantsYet')}</p>
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
                  title={t('admin:businessAreas.grants.revokeTitle')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {t('admin:businessAreas.grants.closeButton')}
          </Button>
        </div>
      </div>
    </CreateEditDialog>
  )
}
