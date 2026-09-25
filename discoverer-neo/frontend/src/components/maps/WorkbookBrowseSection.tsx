import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Pencil, Search, Share2, Trash2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { WorkbookShareDialog } from './WorkbookShareDialog'
import { WorkbookDuplicateDialog } from './WorkbookDuplicateDialog'

/**
 * Workbooks as Discoverer users think of them: a named document holding
 * ordered worksheets. Sits above the flat Maps list, which stays — this is
 * grouping only, not a second copy of the data or its access checks.
 */
export function WorkbookBrowseSection() {
  const { t } = useTranslation(['mapViewer', 'common'])
  const role = useAuthStore((s) => s.user?.role)
  const userId = useAuthStore((s) => s.user?.id)
  // Handing a workbook to someone is an administrator's job, and a manager's
  // whole job. Everyone else just reads the list.
  const canShare = role === 'ADMIN' || role === 'MANAGER'
  // Same client-side hint as the Maps table; the server re-checks every action.
  const owns = (m: { createdBy: string }) => role === 'ADMIN' || m.createdBy === userId
  const [sharing, setSharing] = useState<{ id: string; name: string } | null>(null)
  const [copying, setCopying] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string; count: number } | null>(null)
  const [filter, setFilter] = useState('')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.workbooks.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workbooks'] })
      void queryClient.invalidateQueries({ queryKey: ['maps'] })
      toast({ title: t('mapViewer:workbookDelete.done') })
      setDeleting(null)
    },
    onError: (err) => {
      toast({
        title: t('mapViewer:workbookDelete.failed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const workbooksQuery = useQuery({
    queryKey: ['workbooks'],
    queryFn: async () => (await apiClient.workbooks.listBrowse()).data.data,
  })

  const workbooks = workbooksQuery.data ?? []
  if (!workbooksQuery.isLoading && !workbooksQuery.isError && workbooks.length === 0) {
    return null
  }

  // Matches the workbook name or any of its worksheet names.
  const needle = filter.trim().toLowerCase()
  const shown = needle
    ? workbooks.filter(
        (wb) =>
          wb.name.toLowerCase().includes(needle) ||
          wb.maps.some((m) => m.name.toLowerCase().includes(needle)),
      )
    : workbooks

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight">{t('mapViewer:mapsList.workbooks.title')}</h3>
      {workbooksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : workbooksQuery.isError ? (
        <p className="text-sm text-destructive">{t('mapViewer:mapsList.workbooks.loadError')}</p>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('mapViewer:mapsList.workbooks.filterPlaceholder')}
              aria-label={t('mapViewer:mapsList.workbooks.filterPlaceholder')}
              className="pl-8"
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('mapViewer:mapsList.workbooks.noMatch')}</p>
          ) : (
            <div className="max-h-[300px] overflow-auto rounded-md border divide-y">
              {shown.map((wb) => (
                <details key={wb.id} className="px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between">
                    <span className="truncate font-medium">{wb.name}</span>
                    <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {t('mapViewer:mapsList.workbooks.worksheetCount', { count: wb.maps.length })}
                      {/* Anyone may try: the server applies the per-worksheet copy rule. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t('mapViewer:workbookDuplicate.button')}
                        aria-label={t('mapViewer:workbookDuplicate.button')}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setCopying({ id: wb.id, name: wb.name })
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {canShare && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={t('mapViewer:workbookShare.shareButton')}
                          onClick={(e) => {
                            // Inside a <summary>: a click would toggle the details.
                            e.preventDefault()
                            e.stopPropagation()
                            setSharing({ id: wb.id, name: wb.name })
                          }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {wb.maps.every(owns) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title={t('mapViewer:workbookDelete.button')}
                          aria-label={t('mapViewer:workbookDelete.button')}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDeleting({ id: wb.id, name: wb.name, count: wb.maps.length })
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  </summary>
                  <ul className="mt-2 space-y-1 border-t pt-2 pl-4">
                    {wb.maps.map((m) => (
                      <li key={m.id} className="flex items-center gap-1">
                        <Link to={`/maps/${m.id}/view`} className="truncate text-sm hover:underline">
                          {m.name}
                        </Link>
                        {owns(m) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                            <Link
                              to={`/maps/${m.id}`}
                              title={t('mapViewer:workbookDelete.editSheet')}
                              aria-label={t('mapViewer:workbookDelete.editSheet')}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {sharing && (
        <WorkbookShareDialog
          open
          onOpenChange={(open) => { if (!open) setSharing(null) }}
          workbookId={sharing.id}
          workbookName={sharing.name}
        />
      )}
      {copying && (
        <WorkbookDuplicateDialog
          open
          onOpenChange={(open) => { if (!open) setCopying(null) }}
          workbookId={copying.id}
          workbookName={copying.name}
        />
      )}
      {deleting && (
        <DeleteConfirmDialog
          open
          onOpenChange={(open) => { if (!open) setDeleting(null) }}
          itemName={deleting.name}
          itemLabel={t('mapViewer:workbookDelete.entityLabel')}
          description={t('mapViewer:workbookDelete.description', { name: deleting.name, count: deleting.count })}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
