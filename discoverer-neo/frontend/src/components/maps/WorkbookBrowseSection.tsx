import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Share2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { WorkbookShareDialog } from './WorkbookShareDialog'

/**
 * Workbooks as Discoverer users think of them: a named document holding
 * ordered worksheets. Sits above the flat Maps list, which stays — this is
 * grouping only, not a second copy of the data or its access checks.
 */
export function WorkbookBrowseSection() {
  const { t } = useTranslation(['mapViewer', 'common'])
  const role = useAuthStore((s) => s.user?.role)
  // Handing a workbook to someone is an administrator's job, and a manager's
  // whole job. Everyone else just reads the list.
  const canShare = role === 'ADMIN' || role === 'MANAGER'
  const [sharing, setSharing] = useState<{ id: string; name: string } | null>(null)

  const workbooksQuery = useQuery({
    queryKey: ['workbooks'],
    queryFn: async () => (await apiClient.workbooks.listBrowse()).data.data,
  })

  const workbooks = workbooksQuery.data ?? []
  if (!workbooksQuery.isLoading && !workbooksQuery.isError && workbooks.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold tracking-tight">{t('mapViewer:mapsList.workbooks.title')}</h3>
      {workbooksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : workbooksQuery.isError ? (
        <p className="text-sm text-destructive">{t('mapViewer:mapsList.workbooks.loadError')}</p>
      ) : (
        <div className="max-h-[300px] overflow-auto rounded-md border divide-y">
          {workbooks.map((wb) => (
            <details key={wb.id} className="px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="truncate font-medium">{wb.name}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {t('mapViewer:mapsList.workbooks.worksheetCount', { count: wb.maps.length })}
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
                </span>
              </summary>
              <ul className="mt-2 space-y-1 border-t pt-2 pl-4">
                {wb.maps.map((m) => (
                  <li key={m.id}>
                    <Link to={`/maps/${m.id}/view`} className="text-sm hover:underline">
                      {m.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}

      {sharing && (
        <WorkbookShareDialog
          open
          onOpenChange={(open) => { if (!open) setSharing(null) }}
          workbookId={sharing.id}
          workbookName={sharing.name}
        />
      )}
    </div>
  )
}
