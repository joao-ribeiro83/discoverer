import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  itemLabel?: string
  /** Replaces the default soft-delete wording, for items whose delete is permanent. */
  description?: ReactNode
  onConfirm: () => void
  isPending?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  itemLabel,
  description,
  onConfirm,
  isPending,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const label = itemLabel ?? t('admin:shared.defaultItemLabel')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin:shared.deleteConfirmTitle', { itemLabel: label })}</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                {t('admin:shared.deleteConfirmDescriptionPrefix')}{' '}
                <span className="font-medium text-foreground">{itemName}</span>.{' '}
                {t('admin:shared.deleteConfirmDescriptionSuffix')}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? t('admin:shared.deleting') : t('common:actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
