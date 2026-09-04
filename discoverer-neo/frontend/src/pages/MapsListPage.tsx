import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Eye, Pencil, Share2, CalendarClock, Download, Trash2, X } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { MapSummary, SharePermissionLevel } from '@/lib/types'
import { useAuthStore } from '@/store/auth'
import { useLocale } from '@/hooks/useLocale'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { ShareDialog } from '@/components/map-builder/ShareDialog'

type MapRow = MapSummary & { sharePermission?: SharePermissionLevel }
type MapsTab = 'mine' | 'shared' | 'all'
type SortKey = 'recency' | 'name'

const ROW_HEIGHT = 56
const GRID_COLS = '1fr 200px 130px 150px 220px'

export function MapsListPage() {
  const { t } = useTranslation(['mapViewer', 'common'])
  const { locale } = useLocale()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)

  const [tab, setTab] = useState<MapsTab>('mine')
  const [search, setSearch] = useState('')
  const [businessAreaId, setBusinessAreaId] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('recency')
  const [sharingMap, setSharingMap] = useState<MapRow | null>(null)
  const [deleting, setDeleting] = useState<MapRow | null>(null)

  const ownedQuery = useQuery({
    queryKey: ['maps', 'mine'],
    queryFn: async () => (await apiClient.maps.listMine()).data.data,
  })
  const allQuery = useQuery({
    queryKey: ['maps', 'all'],
    queryFn: async () => (await apiClient.maps.listAll()).data.data,
  })
  const businessAreasQuery = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const baNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const ba of businessAreasQuery.data ?? []) m.set(ba.id, ba.name)
    return m
  }, [businessAreasQuery.data])

  const rowsForTab: MapRow[] = useMemo(() => {
    if (tab === 'mine') return ownedQuery.data?.mine ?? []
    if (tab === 'shared') return ownedQuery.data?.shared ?? []
    return allQuery.data?.all ?? []
  }, [tab, ownedQuery.data, allQuery.data])

  const totalVisible = allQuery.data?.all?.length ?? 0

  const filtered = useMemo(() => {
    let rows = rowsForTab
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q))
    if (businessAreaId !== 'all') rows = rows.filter((r) => r.businessAreaId === businessAreaId)
    return [...rows].sort((a, b) =>
      sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [rowsForTab, search, businessAreaId, sortKey])

  const isLoading = ownedQuery.isLoading || allQuery.isLoading || businessAreasQuery.isLoading
  const loadError = ownedQuery.error ?? allQuery.error
  const hasActiveFilters = search.trim() !== '' || businessAreaId !== 'all'

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.maps.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maps'] })
      toast({ title: t('mapViewer:mapsList.toast.deleted') })
      setDeleting(null)
    },
    onError: (err) => {
      toast({
        title: t('mapViewer:mapsList.toast.deleteFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  // ponytail: "all" scope doesn't carry per-row permission, so admin/owner/explicit
  // share level is all the client can see; the server re-checks on every action.
  function canManage(row: MapRow): boolean {
    return currentUser?.role === 'ADMIN' || row.createdBy === currentUser?.id || row.sharePermission === 'EDIT'
  }

  function emptyMessage(): string | null {
    if (isLoading || loadError) return null
    if (rowsForTab.length === 0) {
      if (tab === 'mine') return t('mapViewer:mapsList.emptyTabMine', { count: totalVisible })
      if (tab === 'shared') return t('mapViewer:mapsList.emptyTabShared', { count: totalVisible })
      return t('mapViewer:mapsList.emptyNoneAtAll')
    }
    if (filtered.length === 0) return t('mapViewer:mapsList.emptyNoMatches')
    return null
  }
  const empty = emptyMessage()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('mapViewer:mapsList.title')}</h2>
          <p className="text-muted-foreground">{t('mapViewer:mapsList.description')}</p>
        </div>
        <Button asChild>
          <Link to="/maps/new">
            <Plus className="h-4 w-4" /> {t('mapViewer:mapsList.createButton')}
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as MapsTab)}>
        <TabsList>
          <TabsTrigger value="mine">{t('mapViewer:mapsList.tabs.mine')}</TabsTrigger>
          <TabsTrigger value="shared">{t('mapViewer:mapsList.tabs.shared')}</TabsTrigger>
          <TabsTrigger value="all">{t('mapViewer:mapsList.tabs.all')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mapViewer:mapsList.searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('mapViewer:mapsList.businessAreaAllOption')}</SelectItem>
            {(businessAreasQuery.data ?? []).map((ba) => (
              <SelectItem key={ba.id} value={ba.id}>
                {ba.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recency">{t('mapViewer:mapsList.sortRecency')}</SelectItem>
            <SelectItem value="name">{t('mapViewer:mapsList.sortName')}</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setBusinessAreaId('all')
            }}
          >
            <X className="h-4 w-4" /> {t('common:actions.clear')}
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {t('mapViewer:mapsList.rowCount', { shown: filtered.length, total: rowsForTab.length })}
        </span>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {getErrorMessage(loadError)}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>
      ) : empty ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="rounded-md border">
          <div
            className="grid gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <span>{t('common:labels.name')}</span>
            <span>{t('mapViewer:mapsList.columns.businessArea')}</span>
            <span>{t('common:labels.type')}</span>
            <span>{t('common:labels.updatedAt')}</span>
            <span className="text-right">{t('common:labels.actions')}</span>
          </div>
          <div ref={parentRef} className="h-[560px] overflow-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const row = filtered[vi.index]
                const manage = canManage(row)
                return (
                  <div
                    key={row.id}
                    className="grid items-center gap-2 border-b px-3 text-sm"
                    style={{
                      gridTemplateColumns: GRID_COLS,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vi.size,
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <Link to={`/maps/${row.id}`} className="truncate font-medium hover:underline">
                      {row.name}
                    </Link>
                    <span className="truncate text-muted-foreground">
                      {baNameById.get(row.businessAreaId) ?? '—'}
                    </span>
                    <Badge variant="outline" className="w-fit">
                      {row.mapType}
                    </Badge>
                    <span className="text-muted-foreground">{formatDate(row.updatedAt, locale)}</span>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title={t('common:actions.view')}>
                        <Link to={`/maps/${row.id}/view`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {manage && (
                        <>
                          <Button variant="ghost" size="icon" asChild title={t('mapViewer:mapsList.actions.open')}>
                            <Link to={`/maps/${row.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('mapViewer:mapsList.actions.share')}
                            onClick={() => setSharingMap(row)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title={t('mapViewer:mapsList.actions.schedule')}>
                            <Link to={`/schedules?mapId=${row.id}`}>
                              <CalendarClock className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title={t('common:actions.export')}>
                            <Link to={`/maps/${row.id}`}>
                              <Download className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('common:actions.delete')}
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {sharingMap && (
        <ShareDialog
          open={!!sharingMap}
          onOpenChange={(open) => !open && setSharingMap(null)}
          mapId={sharingMap.id}
          isPublic={sharingMap.isPublic}
        />
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel={t('mapViewer:mapsList.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
