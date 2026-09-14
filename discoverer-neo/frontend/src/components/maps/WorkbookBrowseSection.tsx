import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiClient } from '@/lib/api'

/**
 * Workbooks as Discoverer users think of them: a named document holding
 * ordered worksheets. Sits above the flat Maps list, which stays — this is
 * grouping only, not a second copy of the data or its access checks.
 */
export function WorkbookBrowseSection() {
  const { t } = useTranslation(['mapViewer', 'common'])

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
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {t('mapViewer:mapsList.workbooks.worksheetCount', { count: wb.maps.length })}
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
    </div>
  )
}
