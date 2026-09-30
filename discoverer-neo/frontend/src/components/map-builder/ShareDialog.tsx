import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { SharePermissionLevel } from '@/lib/types'
import { ShareUserList } from '@/components/maps/ShareUserList'

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

  const sharesQuery = useQuery({
    queryKey: ['map-shares', mapId],
    queryFn: () => apiClient.maps.listShares(mapId).then((r) => r.data.data),
    enabled: open,
  })

  const shares = sharesQuery.data ?? []
  const current = new Map(shares.map((s) => [s.sharedWithUserId, s.permissionLevel]))

  function invalidateShares() {
    void queryClient.invalidateQueries({ queryKey: ['map-shares', mapId] })
  }

  // New share, or a changed level on an existing one.
  const shareMutation = useMutation({
    mutationFn: (vars: { userId: string; permissionLevel: SharePermissionLevel }) =>
      current.has(vars.userId)
        ? apiClient.maps.updateShare(mapId, vars.userId, vars.permissionLevel)
        : apiClient.maps.share(mapId, vars),
    onSuccess: (_res, vars) => {
      toast({
        title: current.has(vars.userId)
          ? t('mapBuilder:share.toastPermissionUpdated')
          : t('mapBuilder:share.toastShared'),
      })
      invalidateShares()
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:share.toastShareFailedTitle'),
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
    const url = `${window.location.origin}${import.meta.env.BASE_URL}maps/${mapId}/view`
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('mapBuilder:share.title')}</DialogTitle>
          <DialogDescription>{t('mapBuilder:share.description')}</DialogDescription>
        </DialogHeader>

        <ShareUserList
          current={current}
          busy={shareMutation.isPending || revokeMutation.isPending}
          onSet={(userId, permissionLevel) => shareMutation.mutate({ userId, permissionLevel })}
          onRemove={(userId) => revokeMutation.mutate(userId)}
        />

        {isPublic && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{t('mapBuilder:share.publicNotice')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copyLink()}
                title={t('mapBuilder:share.copyLinkTooltip')}
              >
                <Link2 className="h-3.5 w-3.5" /> {t('mapBuilder:share.copyLink')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
