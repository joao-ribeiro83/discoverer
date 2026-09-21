import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { SharePermissionLevel } from '@/lib/types'

const PERMISSION_LEVELS: SharePermissionLevel[] = ['VIEW', 'EXPORT', 'EDIT']

interface WorkbookShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workbookId: string
  workbookName: string
}

/**
 * Hand over a whole workbook.
 *
 * Discoverer shared workbooks, never single worksheets, and this estate's
 * fifty grants were all written that way — so this is the shape the work
 * actually arrives in. It fans out to one share per worksheet, which is why a
 * person can appear holding 3 of 5: the per-map dialog is where that gets
 * tidied up.
 */
export function WorkbookShareDialog({
  open,
  onOpenChange,
  workbookId,
  workbookName,
}: WorkbookShareDialogProps) {
  const { t } = useTranslation(['mapViewer', 'mapBuilder', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingPermission, setPendingPermission] = useState<SharePermissionLevel>('EXPORT')

  const sharesQuery = useQuery({
    queryKey: ['workbook-shares', workbookId],
    queryFn: () => apiClient.workbooks.listShares(workbookId).then((r) => r.data.data),
    enabled: open,
  })

  const usersQuery = useQuery({
    queryKey: ['user-search', deferredSearch],
    queryFn: () => apiClient.users.search(deferredSearch).then((r) => r.data.data),
    enabled: open && deferredSearch.trim().length > 0,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['workbook-shares', workbookId] })
    void queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    void queryClient.invalidateQueries({ queryKey: ['maps'] })
  }

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!pendingUserId) throw new Error(t('mapViewer:workbookShare.pickUser'))
      return (await apiClient.workbooks.share(workbookId, pendingUserId, pendingPermission)).data.data
    },
    onSuccess: (data) => {
      invalidate()
      setPendingUserId(null)
      setSearch('')
      toast({
        title: t('mapViewer:workbookShare.shared', { count: data.shared }),
        // A worksheet the caller could see but not pass on is named, not dropped.
        description: data.refused.length > 0
          ? t('mapViewer:workbookShare.refused', { names: data.refused.join(', ') })
          : undefined,
      })
    },
    onError: (err) => {
      toast({
        title: t('mapViewer:workbookShare.shareFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) =>
      (await apiClient.workbooks.revokeShare(workbookId, userId)).data.data,
    onSuccess: () => {
      invalidate()
      toast({ title: t('mapViewer:workbookShare.revoked') })
    },
    onError: (err) => {
      toast({
        title: t('mapViewer:workbookShare.revokeFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const total = sharesQuery.data?.total ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('mapViewer:workbookShare.title', { name: workbookName })}</DialogTitle>
          <DialogDescription>
            {t('mapViewer:workbookShare.description', { count: total })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder={t('mapBuilder:share.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {usersQuery.data && usersQuery.data.length > 0 && (
            <div className="max-h-[40vh] overflow-auto rounded-md border divide-y">
              {usersQuery.data.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setPendingUserId(u.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent ${
                    pendingUserId === u.id ? 'bg-accent' : ''
                  }`}
                >
                  <span className="truncate">{u.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{u.email}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select
              value={pendingPermission}
              onValueChange={(v) => setPendingPermission(v as SharePermissionLevel)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`mapBuilder:share.permissions.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => shareMutation.mutate()}
              disabled={!pendingUserId || shareMutation.isPending}
            >
              {shareMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('mapViewer:workbookShare.shareButton')}
            </Button>
          </div>
        </div>

        <Separator />

        {sharesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
        ) : (sharesQuery.data?.shares.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('mapViewer:workbookShare.none')}</p>
        ) : (
          <ul className="max-h-[40vh] space-y-1 overflow-auto">
            {sharesQuery.data?.shares.map((s) => (
              <li key={s.userId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {s.name ?? s.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t(`mapBuilder:share.permissions.${s.permissionLevel as SharePermissionLevel}`)} ·{' '}
                    {t('mapViewer:workbookShare.sheetsHeld', { held: s.sheets, total })}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeMutation.mutate(s.userId)}
                  disabled={revokeMutation.isPending}
                  title={t('mapViewer:workbookShare.revokeButton')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
