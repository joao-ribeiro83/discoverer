import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Loader2, X } from 'lucide-react'
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
import type { MapShare, SharePermissionLevel } from '@/lib/types'

const PERMISSION_LEVELS: SharePermissionLevel[] = ['VIEW', 'EXPORT', 'EDIT']

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapId: string
  isPublic: boolean
}

export function ShareDialog({ open, onOpenChange, mapId, isPublic }: ShareDialogProps) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [pendingPermission, setPendingPermission] = useState<SharePermissionLevel>('VIEW')

  const sharesQuery = useQuery({
    queryKey: ['map-shares', mapId],
    queryFn: () => apiClient.maps.listShares(mapId).then((r) => r.data.data),
    enabled: open,
  })

  const searchQuery = useQuery({
    queryKey: ['user-search', deferredSearch],
    queryFn: () => apiClient.users.search(deferredSearch).then((r) => r.data.data),
    enabled: open && deferredSearch.trim().length >= 2,
  })

  const shares = sharesQuery.data ?? []
  const sharedUserIds = new Set(shares.map((s) => s.sharedWithUserId))
  const searchResults = (searchQuery.data ?? []).filter((u) => !sharedUserIds.has(u.id))

  function invalidateShares() {
    void queryClient.invalidateQueries({ queryKey: ['map-shares', mapId] })
  }

  const shareMutation = useMutation({
    mutationFn: (vars: { userId: string; permissionLevel: SharePermissionLevel }) =>
      apiClient.maps.share(mapId, vars),
    onSuccess: () => {
      invalidateShares()
      setPendingUserId(null)
      setSearch('')
      toast({ title: t('mapBuilder:share.toastShared') })
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:share.toastShareFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { userId: string; permissionLevel: SharePermissionLevel }) =>
      apiClient.maps.updateShare(mapId, vars.userId, vars.permissionLevel),
    onSuccess: () => {
      invalidateShares()
      toast({ title: t('mapBuilder:share.toastPermissionUpdated') })
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:share.toastPermissionUpdateFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (userId: string) => apiClient.maps.revokeShare(mapId, userId),
    onSuccess: () => {
      invalidateShares()
      toast({ title: t('mapBuilder:share.toastRevoked') })
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:share.toastRevokeFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  async function copyLink() {
    const url = `${window.location.origin}/maps/${mapId}/view`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: t('mapBuilder:share.toastLinkCopied') })
    } catch {
      toast({
        title: t('mapBuilder:share.toastCopyFailedTitle'),
        description: url,
        variant: 'destructive',
      })
    }
  }

  function shareLabel(share: MapShare): string {
    return share.sharedWithName || share.sharedWithEmail || share.sharedWithUserId
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('mapBuilder:share.title')}</DialogTitle>
          <DialogDescription>{t('mapBuilder:share.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPendingUserId(null)
              }}
              placeholder={t('mapBuilder:share.searchPlaceholder')}
              aria-label={t('mapBuilder:share.searchAria')}
            />
            {search.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md">
                {searchQuery.isFetching && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('mapBuilder:share.searching')}
                  </div>
                )}
                {!searchQuery.isFetching && searchResults.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {t('mapBuilder:share.noMatchingUsers')}
                  </div>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setPendingUserId(u.id)
                      setSearch(u.name || u.email)
                    }}
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {pendingUserId && (
            <div className="flex items-center gap-2">
              <Select
                value={pendingPermission}
                onValueChange={(v) => setPendingPermission(v as SharePermissionLevel)}
              >
                <SelectTrigger className="h-9 flex-1" aria-label={t('mapBuilder:share.permissionAria')}>
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
                size="sm"
                disabled={shareMutation.isPending}
                onClick={() =>
                  shareMutation.mutate({ userId: pendingUserId, permissionLevel: pendingPermission })
                }
              >
                {shareMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('mapBuilder:share.shareButton')
                )}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('mapBuilder:share.peopleWithAccess')}</p>
          {sharesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common:states.loading')}
            </div>
          )}
          {!sharesQuery.isLoading && shares.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('mapBuilder:share.notSharedYet')}</p>
          )}
          <ul className="space-y-1">
            {shares.map((share) => (
              <li key={share.id} className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{shareLabel(share)}</p>
                  {share.sharedWithEmail && (
                    <p className="truncate text-xs text-muted-foreground">{share.sharedWithEmail}</p>
                  )}
                </div>
                <Select
                  value={share.permissionLevel}
                  onValueChange={(v) =>
                    updateMutation.mutate({
                      userId: share.sharedWithUserId,
                      permissionLevel: v as SharePermissionLevel,
                    })
                  }
                >
                  <SelectTrigger
                    className="h-8 w-[130px]"
                    aria-label={t('mapBuilder:share.permissionForAria', { name: shareLabel(share) })}
                  >
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
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t('mapBuilder:share.revokeAria', { name: shareLabel(share) })}
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(share.sharedWithUserId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {isPublic && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{t('mapBuilder:share.publicNotice')}</p>
              <Button variant="outline" size="sm" onClick={() => void copyLink()}>
                <Link2 className="h-3.5 w-3.5" /> {t('mapBuilder:share.copyLink')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
