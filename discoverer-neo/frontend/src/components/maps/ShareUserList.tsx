import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiClient } from '@/lib/api'
import type { SharePermissionLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const LEVELS: SharePermissionLevel[] = ['VIEW', 'EXPORT', 'EDIT']

interface ShareUserListProps {
  /** Who holds a share now, and at which level. */
  current: Map<string, SharePermissionLevel>
  /** Give or change a share. */
  onSet: (userId: string, level: SharePermissionLevel) => void
  onRemove: (userId: string) => void
  busy?: boolean
  /** Extra line under a user who holds a share, e.g. "3 of 5 worksheets". */
  detail?: (userId: string) => ReactNode
}

/**
 * Every user, each with one button per share level. Click a level to share at
 * that level (or change it); the highlighted button is what they hold now; ✕
 * takes the share away. People who already hold a share are listed first.
 */
export function ShareUserList({ current, onSet, onRemove, busy, detail }: ShareUserListProps) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const [filter, setFilter] = useState('')

  // A blank search lists everyone (the backend caps it) — the whole point is
  // to pick without having to remember a name.
  const usersQuery = useQuery({
    queryKey: ['user-search', ''],
    queryFn: () => apiClient.users.search('').then((r) => r.data.data),
  })

  const needle = filter.trim().toLowerCase()
  const users = (usersQuery.data ?? [])
    .filter(
      (u) =>
        !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
    )
    .sort((a, b) => Number(current.has(b.id)) - Number(current.has(a.id)))

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t('mapBuilder:share.searchPlaceholder')}
        aria-label={t('mapBuilder:share.searchAria')}
      />
      <p className="text-xs text-muted-foreground">{t('mapBuilder:share.listHint')}</p>
      <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
        {usersQuery.isLoading && (
          <li className="px-3 py-2 text-sm text-muted-foreground">{t('common:states.loading')}</li>
        )}
        {!usersQuery.isLoading && users.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">{t('mapBuilder:share.noMatchingUsers')}</li>
        )}
        {users.map((u) => {
          const held = current.get(u.id)
          return (
            <li key={u.id} className="flex items-center gap-2 px-3 py-1.5">
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm', held && 'font-medium')}>{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {held && detail ? <> · {detail(u.id)}</> : null}
                </p>
              </div>
              <div
                className="flex shrink-0 gap-1"
                role="group"
                aria-label={t('mapBuilder:share.permissionForAria', { name: u.name })}
              >
                {LEVELS.map((level) => (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={held === level ? 'default' : 'outline'}
                    className="h-7 px-2 text-xs"
                    aria-pressed={held === level}
                    disabled={busy}
                    title={t(`mapBuilder:share.permissionHelp.${level}`)}
                    onClick={() => held !== level && onSet(u.id, level)}
                  >
                    {t(`mapBuilder:share.permissions.${level}`)}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn('h-7 w-7', !held && 'invisible')}
                  disabled={busy || !held}
                  title={t('mapBuilder:share.revokeAria', { name: u.name })}
                  aria-label={t('mapBuilder:share.revokeAria', { name: u.name })}
                  onClick={() => onRemove(u.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
