import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { AppUser } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/auth'
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

const ROLES = ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const

function buildCreateSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    email: z.string().email(t('admin:users.validation.emailInvalid')),
    password: z.string().min(8, t('admin:users.validation.passwordMinLength')),
    role: z.enum(ROLES),
  })
}

function buildEditSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    email: z.string().email(t('admin:users.validation.emailInvalid')),
    password: z.string().min(8, t('admin:users.validation.passwordMinLength')).or(z.literal('')),
    role: z.enum(ROLES),
  })
}

type FormValues = z.infer<ReturnType<typeof buildCreateSchema>>

export function UsersPage() {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState<AppUser | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.users.list()).data.data,
    enabled: isAdmin,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(editing ? buildEditSchema(t) : buildCreateSchema(t)),
    defaultValues: { name: '', email: '', password: '', role: 'USER' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', email: '', password: '', role: 'USER' })
    setDialogOpen(true)
  }

  function openEdit(user: AppUser) {
    setEditing(user)
    form.reset({ name: user.name, email: user.email, password: '', role: user.role })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const payload: Record<string, unknown> = { name: values.name, email: values.email, role: values.role }
        if (values.password) payload.password = values.password
        return (await apiClient.users.update(editing.id, payload)).data.data
      }
      return (await apiClient.users.create(values)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: editing ? t('admin:users.toast.updated') : t('admin:users.toast.created') })
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
    mutationFn: async (id: string) => apiClient.users.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: t('admin:users.toast.deleted') })
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

  const columns: ColumnDef<AppUser>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    { accessorKey: 'email', header: t('admin:users.columns.email') },
    { accessorKey: 'role', header: t('admin:users.columns.role'), cell: ({ row }) => <Badge variant="outline">{row.original.role}</Badge> },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title={t('common:actions.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleting(row.original)}
            title={t('common:actions.delete')}
            disabled={row.original.id === currentUser?.id}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (!isAdmin) {
    return (
      <AdminPageWrapper title={t('admin:users.title')} description={t('admin:users.description')}>
        <p className="text-sm text-muted-foreground">{t('admin:users.adminOnlyMessage')}</p>
      </AdminPageWrapper>
    )
  }

  return (
    <AdminPageWrapper
      title={t('admin:users.title')}
      description={t('admin:users.description')}
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:users.createButton')}
        </Button>
      }
    >
      <DataTable columns={columns} data={users ?? []} isLoading={isLoading} emptyMessage={t('admin:users.emptyMessage')} />

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? t('admin:users.dialog.editTitle') : t('admin:users.dialog.createTitle')}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">{t('common:labels.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('admin:users.form.emailLabel')}</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              {t('admin:users.form.passwordLabel')} {editing && <span className="text-muted-foreground">{t('admin:users.form.passwordKeepHint')}</span>}
            </Label>
            <Input id="password" type="password" {...form.register('password')} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('admin:users.form.roleLabel')}</Label>
            <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v as FormValues['role'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
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
          itemLabel={t('admin:users.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
