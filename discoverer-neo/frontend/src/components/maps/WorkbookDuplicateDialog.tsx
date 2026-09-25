import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { apiClient, getErrorMessage } from '@/lib/api'

interface WorkbookDuplicateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workbookId: string
  workbookName: string
}

/** Discoverer's "Save As" for a workbook: copy it under a new name. */
export function WorkbookDuplicateDialog({
  open,
  onOpenChange,
  workbookId,
  workbookName,
}: WorkbookDuplicateDialogProps) {
  const { t } = useTranslation(['mapViewer', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState(t('mapViewer:workbookDuplicate.defaultName', { name: workbookName }))

  const mutation = useMutation({
    mutationFn: async () => (await apiClient.workbooks.duplicate(workbookId, name.trim())).data.data,
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: ['workbooks'] })
      void queryClient.invalidateQueries({ queryKey: ['maps'] })
      toast({ title: t('mapViewer:workbookDuplicate.done', { name: copy.name }) })
      onOpenChange(false)
    },
    onError: (err) => {
      toast({
        title: t('mapViewer:workbookDuplicate.failed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('mapViewer:workbookDuplicate.title', { name: workbookName })}</DialogTitle>
            <DialogDescription>{t('mapViewer:workbookDuplicate.description')}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1 text-sm">
            <span>{t('mapViewer:workbookDuplicate.nameLabel')}</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
              autoFocus
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending || name.trim() === ''}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('mapViewer:workbookDuplicate.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
