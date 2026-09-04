import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

export function DashboardPage() {
  const { t } = useTranslation(['mapViewer', 'common'])
  const { locale } = useLocale()
  const user = useAuthStore((s) => s.user)

  const mapsQuery = useQuery({
    queryKey: ['maps', 'all'],
    queryFn: async () => (await apiClient.maps.listAll()).data.data.all,
  })
  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => (await apiClient.dashboard.getStats()).data.data,
  })

  const allMaps = mapsQuery.data ?? []
  const totalMaps = allMaps.length
  const mine = allMaps.filter((m) => m.createdBy === user?.id)
  const sharedCount = totalMaps - mine.length

  const recentMaps = [...mine]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {user?.name
            ? t('mapViewer:dashboard.welcomeWithName', { name: user.name })
            : t('mapViewer:dashboard.welcome')}
        </h2>
        <p className="text-muted-foreground">{t('mapViewer:dashboard.subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('mapViewer:dashboard.totalMaps')}</CardDescription>
            <CardTitle className="text-3xl">{mapsQuery.isLoading ? '—' : totalMaps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('mapViewer:dashboard.totalMapsBreakdown', {
                mine: mine.length,
                shared: sharedCount,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('mapViewer:dashboard.totalExecutions')}</CardDescription>
            <CardTitle className="text-3xl">
              {statsQuery.isLoading ? '—' : statsQuery.data?.totalExecutions ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t('mapViewer:dashboard.totalExecutionsDescription')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('mapViewer:dashboard.scheduledMaps')}</CardDescription>
            <CardTitle className="text-3xl">
              {statsQuery.isLoading ? '—' : statsQuery.data?.scheduledMaps ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/schedules" className="text-xs text-muted-foreground hover:underline">
              {t('mapViewer:dashboard.viewSchedules')}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('mapViewer:dashboard.scheduledResults')}</CardDescription>
            <CardTitle className="text-3xl">
              {statsQuery.isLoading ? '—' : statsQuery.data?.scheduledResults ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/schedules" className="text-xs text-muted-foreground hover:underline">
              {t('mapViewer:dashboard.viewSchedules')}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mapViewer:dashboard.recentMaps')}</CardTitle>
          <CardDescription>{t('mapViewer:dashboard.recentMapsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {mapsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
          ) : recentMaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {totalMaps === 0
                ? t('mapViewer:mapsList.emptyNoneAtAll')
                : t('mapViewer:mapsList.emptyTabMine', { count: totalMaps })}
            </p>
          ) : (
            <ul className="divide-y">
              {recentMaps.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/maps/${m.id}`}
                    className="flex items-center justify-between gap-2 py-2 text-sm hover:underline"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <MapIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(m.updatedAt, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
