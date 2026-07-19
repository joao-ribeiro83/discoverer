import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Eye, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { AuditLogEntry } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const PAGE_SIZE = 25

interface AuditFilterState {
  userId: string
  action: string
  entityType: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: AuditFilterState = {
  userId: '',
  action: '',
  entityType: '',
  dateFrom: '',
  dateTo: '',
}

function actorLabel(entry: AuditLogEntry): string {
  if (entry.userName) return entry.userName
  if (entry.userEmail) return entry.userEmail
  return 'System / unauthenticated'
}

/** Client-side CSV of the currently loaded page — there is no bulk-export endpoint. */
function toCsv(rows: AuditLogEntry[]): string {
  const header = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address']
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      actorLabel(r),
      r.action,
      r.entityType,
      r.entityId ?? '',
      r.ipAddress ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

function downloadCsv(rows: AuditLogEntry[]) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilterState>(EMPTY_FILTERS)
  const [offset, setOffset] = useState(0)
  const [detail, setDetail] = useState<AuditLogEntry | null>(null)

  const apiFilters = {
    userId: filters.userId || undefined,
    action: filters.action || undefined,
    entityType: filters.entityType || undefined,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : undefined,
  }

  const logQuery = useQuery({
    queryKey: ['audit-log', apiFilters, offset],
    queryFn: async () =>
      (await apiClient.audit.query({ ...apiFilters, limit: PAGE_SIZE, offset })).data,
  })

  const statsQuery = useQuery({
    queryKey: ['audit-stats', apiFilters.dateFrom, apiFilters.dateTo],
    queryFn: async () => (await apiClient.audit.stats(apiFilters.dateFrom, apiFilters.dateTo)).data.data,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.users.list()).data.data,
  })

  function updateFilter<K extends keyof AuditFilterState>(key: K, value: AuditFilterState[K]) {
    setOffset(0)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const rows = logQuery.data?.data ?? []
  const total = logQuery.data?.total ?? 0
  const hasNextPage = offset + rows.length < total
  const hasPrevPage = offset > 0
  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm">
          {formatDate(row.original.createdAt, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <span className={row.original.userId ? '' : 'text-muted-foreground'}>
          {actorLabel(row.original)}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => <code className="text-xs">{row.original.action}</code>,
    },
    {
      accessorKey: 'entityType',
      header: 'Entity',
      cell: ({ row }) => (
        <div className="text-sm">
          <Badge variant="outline">{row.original.entityType}</Badge>
          {row.original.entityId && (
            <span
              className="ml-2 font-mono text-xs text-muted-foreground"
              title={row.original.entityId}
            >
              {row.original.entityId.slice(0, 8)}…
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP Address',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.ipAddress ?? '—'}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" title="View details" onClick={() => setDetail(row.original)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <AdminPageWrapper
      title="Audit Log"
      description="Every mutating request — data changes, exports, migrations, and authentication events — captured automatically."
      action={
        <Button variant="outline" onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV (this page)
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Actions</CardDescription>
            <CardTitle className="text-3xl">
              {statsQuery.isLoading ? '—' : (statsQuery.data?.totalActions ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {apiFilters.dateFrom || apiFilters.dateTo ? 'In the selected date range' : 'All time'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Actions</CardTitle>
            <CardDescription>Most frequent action types</CardDescription>
          </CardHeader>
          <CardContent>
            {statsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (statsQuery.data?.byActionType ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(statsQuery.data?.byActionType ?? []).slice(0, 8).map((a) => (
                  <Badge key={a.action} variant="secondary" className="font-mono text-xs">
                    {a.action} <span className="ml-1 text-muted-foreground">({a.count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions per Day</CardTitle>
          <CardDescription>Daily activity volume for the selected date range</CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (statsQuery.data?.byDay ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsQuery.data?.byDay} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Actions" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">User</Label>
              <select
                className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.userId}
                onChange={(e) => updateFilter('userId', e.target.value)}
                aria-label="Filter by user"
              >
                <option value="">All users</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="audit-entity-type">
                Entity type
              </Label>
              <Input
                id="audit-entity-type"
                className="w-40"
                placeholder="e.g. maps"
                value={filters.entityType}
                onChange={(e) => updateFilter('entityType', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="audit-action">
                Action
              </Label>
              <Input
                id="audit-action"
                className="w-56"
                placeholder="e.g. POST /api/maps"
                value={filters.action}
                onChange={(e) => updateFilter('action', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="audit-date-from">
                From
              </Label>
              <Input
                id="audit-date-from"
                type="date"
                className="w-40"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="audit-date-to">
                To
              </Label>
              <Input
                id="audit-date-to"
                type="date"
                className="w-40"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_FILTERS)
                  setOffset(0)
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={logQuery.isLoading}
        pageSize={PAGE_SIZE}
        emptyMessage="No audit entries match these filters."
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {total === 0
            ? 'No results'
            : `Showing ${offset + 1}–${offset + rows.length} of ${total}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>

      {detail && (
        <CreateEditDialog
          open
          onOpenChange={(open) => !open && setDetail(null)}
          title="Audit entry details"
          description={`${detail.action} — ${formatDate(detail.createdAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
        >
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted p-3 text-xs">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </CreateEditDialog>
      )}
    </AdminPageWrapper>
  )
}
