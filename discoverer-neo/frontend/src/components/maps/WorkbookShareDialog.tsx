import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { SharePermissionLevel } from '@/lib/types'
import { ShareUserList } from './ShareUserList'

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

  const sharesQuery = useQuery({
    queryKey: ['workbook-shares', workbookId],
    queryFn: () => apiClient.workbooks.listShares(workbookId).then((r) => r.data.data),
    enabled: open,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['workbook-shares', workbookId] })
    void queryClient.invalidateQueries({ queryKey: ['workbooks'] })
    void queryClient.invalidateQueries({ queryKey: ['maps'] })
  }

  const shareMutation = useMutation({
    mutationFn: async ({ userId, level }: { userId: string; level: SharePermissionLevel }) =>
      (await apiClient.workbooks.share(workbookId, userId, level)).data.data,
    onSuccess: (data) => {
      invalidate()
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
  const shares = sharesQuery.data?.shares ?? []
  const current = new Map(shares.map((s) => [s.userId, s.permissionLevel as SharePermissionLevel]))
  const sheetsOf = new Map(shares.map((s) => [s.userId, s.sheets]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('mapViewer:workbookShare.title', { name: workbookName })}</DialogTitle>
          <DialogDescription>
            {t('mapViewer:workbookShare.description', { count: total })}
          </DialogDescription>
        </DialogHeader>

        <ShareUserList
          current={current}
          busy={shareMutation.isPending || revokeMutation.isPending}
          onSet={(userId, level) => shareMutation.mutate({ userId, level })}
          onRemove={(userId) => revokeMutation.mutate(userId)}
          detail={(userId) =>
            t('mapViewer:workbookShare.sheetsHeld', { held: sheetsOf.get(userId) ?? 0, total })
          }
        />
      </DialogContent>
    </Dialog>
  )
}
