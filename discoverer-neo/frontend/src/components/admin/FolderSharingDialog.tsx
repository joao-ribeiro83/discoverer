import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Share2, X } from 'lucide-react'
import { useState } from 'react'

import { apiClient, getErrorMessage } from '@/lib/api'
import type { BusinessArea, Folder } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

/**
 * Manage which business areas a folder appears in.
 *
 * Oracle Discoverer models folder↔business-area as many-to-many
 * (`BA_OBJ_LINKS`): a shared dimension folder — Time, Organisation — commonly
 * appears in several areas at once. Neo keeps one OWNING area on the folder
 * itself and records the rest as shares, so the owning area is shown here but
 * cannot be removed.
 */
export function FolderSharingDialog({
  folder,
  businessAreas,
  onClose,
}: {
  folder: Folder
  businessAreas: BusinessArea[]
  onClose: () => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('')

  const sharesQuery = useQuery({
    queryKey: ['folder-shares', folder.id],
    queryFn: async () => (await apiClient.folders.listSharedBusinessAreas(folder.id)).data.data,
  })
  const shares = sharesQuery.data ?? []

  const nameOf = (id: string) =>
    businessAreas.find((ba) => ba.id === id)?.name ?? id

  function invalidateAffected(businessAreaId: string) {
    // Both areas' folder lists change: the target gains or loses a member.
    void queryClient.invalidateQueries({ queryKey: ['folder-shares', folder.id] })
    void queryClient.invalidateQueries({ queryKey: ['folders', businessAreaId] })
    void queryClient.invalidateQueries({ queryKey: ['folders', folder.businessAreaId] })
  }

  const shareMutation = useMutation({
    mutationFn: async (businessAreaId: string) =>
      apiClient.folders.shareWithBusinessArea(folder.id, businessAreaId),
    onSuccess: (_res, businessAreaId) => {
      invalidateAffected(businessAreaId)
      setSelected('')
      toast({ title: t('admin:folders.sharing.shared') })
    },
    onError: (err) =>
      toast({
        title: t('admin:folders.sharing.shareFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  })

  const unshareMutation = useMutation({
    mutationFn: async (businessAreaId: string) =>
      apiClient.folders.unshareWithBusinessArea(folder.id, businessAreaId),
    onSuccess: (_res, businessAreaId) => {
      invalidateAffected(businessAreaId)
      toast({ title: t('admin:folders.sharing.unshared') })
    },
    onError: (err) =>
      toast({
        title: t('admin:folders.sharing.unshareFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      }),
  })

  // Neither the owning area nor an existing share can be added again.
  const available = businessAreas.filter(
    (ba) => ba.id !== folder.businessAreaId && !shares.includes(ba.id),
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('admin:folders.sharing.title', { name: folder.name })}
          </DialogTitle>
          <DialogDescription>{t('admin:folders.sharing.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('admin:folders.sharing.memberOf')}</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default" title={t('admin:folders.sharing.owningTooltip')}>
                {nameOf(folder.businessAreaId)} · {t('admin:folders.sharing.owning')}
              </Badge>
              {shares.map((baId) => (
                <Badge key={baId} variant="secondary" className="gap-1">
                  {nameOf(baId)}
                  <button
                    type="button"
                    aria-label={t('admin:folders.sharing.removeShare', { name: nameOf(baId) })}
                    className="ml-1 rounded-sm hover:bg-muted"
                    onClick={() => unshareMutation.mutate(baId)}
                    disabled={unshareMutation.isPending}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {shares.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t('admin:folders.sharing.noShares')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-ba">{t('admin:folders.sharing.addTo')}</Label>
            <div className="flex gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="share-ba" aria-label={t('admin:folders.sharing.addTo')}>
                  <SelectValue
                    placeholder={
                      available.length
                        ? t('admin:folders.sharing.selectPlaceholder')
                        : t('admin:folders.sharing.noneAvailable')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {available.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => shareMutation.mutate(selected)}
                disabled={!selected || shareMutation.isPending}
              >
                {t('admin:folders.sharing.share')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
