import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { KeyRound, Map as MapIcon, Plus, Pencil, Trash2, UserCheck, UserCog, UserX, X } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { AppUser, SharePermissionLevel } from '@/lib/types'
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
  // A MANAGER may read the list and tidy each user's maps; changing users stays admin-only.
  const canView = isAdmin || currentUser?.role === 'MANAGER'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState<AppUser | null>(null)
  const [deactivating, setDeactivating] = useState<AppUser | null>(null)
  const [viewingMaps, setViewingMaps] = useState<AppUser | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.users.list()).data.data,
    enabled: canView,
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

  // Re-issues a temporary password to every account still on one and hands
  // back the CSV. The migration's own file is swept on a timer, so without
  // this an operator who missed it has no way to get the passwords at all.
  const credentialsMutation = useMutation({
    mutationFn: async () => (await apiClient.users.issueCredentials()).data,
    onSuccess: (csv) => {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `discoverer-neo-credentials-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: t('admin:users.credentials.issued') })
    },
    onError: (err) => {
      toast({
        title: t('admin:users.credentials.failed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

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

  const activeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await apiClient.users.update(id, { isActive })).data.data,
    onSuccess: (_data, { isActive }) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: isActive ? t('admin:users.toast.activated') : t('admin:users.toast.deactivated') })
      setDeactivating(null)
    },
    onError: (err) => {
      toast({
        title: t('admin:shared.saveFailed'),
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
      id: 'status',
      header: t('admin:users.columns.status'),
      cell: ({ row }) =>
        row.original.isActive === false ? (
          <Badge variant="secondary">{t('admin:users.status.inactive')}</Badge>
        ) : (
          <Badge variant="outline">{t('admin:users.status.active')}</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const user = row.original
        const active = user.isActive !== false
        const isSelf = user.id === currentUser?.id
        return (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewingMaps(user)}
            title={t('admin:users.maps.button')}
            aria-label={t('admin:users.maps.button')}
          >
            <MapIcon className="h-4 w-4" />
          </Button>
          {isAdmin && (
          <>
          <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title={t('admin:users.editTooltip')}>
            <Pencil className="h-4 w-4" />
          </Button>
          {active ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeactivating(user)}
              title={isSelf ? t('admin:users.status.cannotDeactivateSelf') : t('admin:users.status.deactivate')}
              aria-label={t('admin:users.status.deactivate')}
              disabled={isSelf}
            >
              <UserX className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => activeMutation.mutate({ id: user.id, isActive: true })}
              title={t('admin:users.status.activate')}
              aria-label={t('admin:users.status.activate')}
              disabled={activeMutation.isPending}
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleting(user)}
            title={t('admin:users.deleteTooltip')}
            disabled={isSelf}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          </>
          )}
        </div>
        )
      },
    },
  ]

  if (!canView) {
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
        isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => credentialsMutation.mutate()}
              disabled={credentialsMutation.isPending}
              title={t('admin:users.credentials.hint')}
            >
              <KeyRound className="h-4 w-4" /> {t('admin:users.credentials.button')}
            </Button>
            <Button onClick={openCreate} title={t('admin:users.createTooltip')}>
              <Plus className="h-4 w-4" /> {t('admin:users.createButton')}
            </Button>
          </div>
        )
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
            {/* What each role may do; the chosen one is highlighted. */}
            <ul className="space-y-1 rounded-md bg-muted/50 p-2 text-xs" data-testid="role-help">
              {ROLES.map((r) => (
                <li
                  key={r}
                  className={r === form.watch('role') ? 'text-foreground' : 'text-muted-foreground'}
                >
                  <span className="font-semibold">{r}</span> — {t(`admin:users.roleHelp.${r}`)}
                </li>
              ))}
            </ul>
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
          // DELETE /api/users/:id is a hard delete, not the default soft-delete wording.
          description={t('admin:users.deleteConfirmDescription', { name: deleting.name })}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {viewingMaps && (
        <UserMapsDialog user={viewingMaps} users={users ?? []} onClose={() => setViewingMaps(null)} />
      )}

      <Dialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:users.deactivateDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('admin:users.deactivateDialog.description', { name: deactivating?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)} disabled={activeMutation.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deactivating && activeMutation.mutate({ id: deactivating.id, isActive: false })}
              disabled={activeMutation.isPending}
            >
              {activeMutation.isPending ? t('admin:users.status.deactivating') : t('admin:users.status.deactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageWrapper>
  )
}

const SHARE_LEVELS: SharePermissionLevel[] = ['VIEW', 'EXPORT', 'EDIT']

/**
 * Every map one user can open, and why — with the tidy-up an admin or a
 * manager needs: change or remove a share, or hand the map to a new owner.
 * The server re-checks each action (`canManageShares`, the owner route).
 */
function UserMapsDialog({
  user,
  users,
  onClose,
}: {
  user: AppUser
  users: AppUser[]
  onClose: () => void
}) {
  const { t } = useTranslation(['admin', 'mapBuilder', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [changingOwnerOf, setChangingOwnerOf] = useState<string | null>(null)

  const mapsQuery = useQuery({
    queryKey: ['users', user.id, 'maps'],
    queryFn: async () => (await apiClient.users.maps(user.id)).data.data,
  })

  function refresh(title: string) {
    void queryClient.invalidateQueries({ queryKey: ['users', user.id, 'maps'] })
    void queryClient.invalidateQueries({ queryKey: ['maps'] })
    toast({ title })
  }
  function fail(err: unknown) {
    toast({ title: t('admin:shared.saveFailed'), description: getErrorMessage(err), variant: 'destructive' })
  }

  const levelMutation = useMutation({
    mutationFn: ({ mapId, level }: { mapId: string; level: SharePermissionLevel }) =>
      apiClient.maps.updateShare(mapId, user.id, level),
    onSuccess: () => refresh(t('admin:users.maps.toast.shareChanged')),
    onError: fail,
  })
  const revokeMutation = useMutation({
    mutationFn: (mapId: string) => apiClient.maps.revokeShare(mapId, user.id),
    onSuccess: () => refresh(t('admin:users.maps.toast.shareRemoved')),
    onError: fail,
  })
  const ownerMutation = useMutation({
    mutationFn: ({ mapId, ownerId }: { mapId: string; ownerId: string }) =>
      apiClient.maps.transferOwner(mapId, ownerId),
    onSuccess: () => {
      setChangingOwnerOf(null)
      refresh(t('admin:users.maps.toast.ownerChanged'))
    },
    onError: fail,
  })
  const busy = levelMutation.isPending || revokeMutation.isPending || ownerMutation.isPending

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('admin:users.maps.title', { name: user.name })}</DialogTitle>
          <DialogDescription>
            {mapsQuery.data
              ? t('admin:users.maps.count', { count: mapsQuery.data.length })
              : t('admin:users.maps.description')}
          </DialogDescription>
        </DialogHeader>
        {mapsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
        ) : mapsQuery.error ? (
          <p className="text-sm text-destructive">{getErrorMessage(mapsQuery.error)}</p>
        ) : mapsQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin:users.maps.empty')}</p>
        ) : (
          <ul className="max-h-[60vh] divide-y overflow-y-auto">
            {mapsQuery.data?.map((m) => (
              <li key={m.id} className="space-y-1 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/maps/${m.id}/view`} className="block truncate hover:underline" title={m.name}>
                      {m.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t('admin:users.maps.owner', { name: m.ownerName ?? '—' })}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {m.via === 'SHARE' && m.sharePermission ? (
                      <Select
                        value={m.sharePermission}
                        onValueChange={(v) => levelMutation.mutate({ mapId: m.id, level: v as SharePermissionLevel })}
                        disabled={busy}
                      >
                        <SelectTrigger
                          className="h-8 w-[130px]"
                          title={t('admin:users.maps.shareLevelTooltip')}
                          aria-label={t('admin:users.maps.shareLevelTooltip')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHARE_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {t(`mapBuilder:share.permissions.${level}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{t(`admin:users.maps.via.${m.via}`)}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => setChangingOwnerOf(changingOwnerOf === m.id ? null : m.id)}
                      title={t('admin:users.maps.changeOwnerTooltip')}
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>
                    {m.via === 'SHARE' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={busy}
                        onClick={() => revokeMutation.mutate(m.id)}
                        title={t('admin:users.maps.removeShareTooltip')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {changingOwnerOf === m.id && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('admin:users.maps.newOwner')}</span>
                    <Select
                      value={m.ownerId}
                      onValueChange={(ownerId) => {
                        if (ownerId !== m.ownerId) ownerMutation.mutate({ mapId: m.id, ownerId })
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 flex-1" aria-label={t('admin:users.maps.newOwner')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter((u) => u.isActive !== false)
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
