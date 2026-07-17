import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const mapsQuery = useQuery({
    queryKey: ['maps', 'mine'],
    queryFn: async () => (await apiClient.maps.listMine()).data.data,
  })

  const mine = mapsQuery.data?.mine ?? []
  const shared = mapsQuery.data?.shared ?? []
  const totalMaps = mine.length + shared.length

  const recentMaps = [...mine]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h2>
        <p className="text-muted-foreground">Overview of your Discoverer Neo workspace.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Maps</CardDescription>
            <CardTitle className="text-3xl">{mapsQuery.isLoading ? '—' : totalMaps}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {mine.length} yours, {shared.length} shared with you
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Executions</CardDescription>
            <CardTitle
              className="text-3xl"
              title="No workspace-wide execution count endpoint exists yet — see each map's history for its own runs."
            >
              —
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Per-map history is on each map&apos;s viewer.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scheduled Maps</CardDescription>
            <CardTitle className="text-3xl" title="Scheduling has not been built yet.">
              —
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Coming with the Schedules feature.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data Sources</CardDescription>
            <CardTitle className="text-3xl" title="See Admin -> Data Sources for the full list.">
              —
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Manage connections under Admin.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Maps</CardTitle>
            <CardDescription>Your last 5 updated maps.</CardDescription>
          </CardHeader>
          <CardContent>
            {mapsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentMaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No maps yet. Create one from the Maps page.
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
                        {formatDate(m.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scheduled Results</CardTitle>
            <CardDescription>Last 5 scheduled runs.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Scheduling isn&apos;t available yet — this section will populate once schedules ship.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
