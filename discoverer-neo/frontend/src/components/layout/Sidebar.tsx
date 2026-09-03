import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FolderTree,
  FolderOpen,
  Database,
  Users,
  Map,
  CalendarClock,
  ArrowRightLeft,
  Settings,
  Table2,
  GitMerge,
  Layers,
  FunctionSquare,
  ShieldCheck,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const mainNavItems = [
  { to: '/dashboard', labelKey: 'items.dashboard', icon: LayoutDashboard },
]

const adminNavItems = [
  { to: '/admin/business-areas', labelKey: 'items.businessAreas', icon: FolderTree },
  { to: '/admin/folders', labelKey: 'items.folders', icon: FolderOpen },
  { to: '/admin/items', labelKey: 'items.items', icon: Table2 },
  { to: '/admin/joins', labelKey: 'items.joins', icon: GitMerge },
  { to: '/admin/hierarchies', labelKey: 'items.hierarchies', icon: Layers },
  { to: '/admin/custom-functions', labelKey: 'items.customFunctions', icon: FunctionSquare },
  { to: '/admin/data-sources', labelKey: 'items.dataSources', icon: Database },
  { to: '/admin/users', labelKey: 'items.users', icon: Users },
  { to: '/admin/security', labelKey: 'items.security', icon: ShieldCheck },
  { to: '/admin/audit', labelKey: 'items.auditLog', icon: ScrollText },
]

const mapsNavItems = [
  { to: '/maps', labelKey: 'items.maps', icon: Map },
]

const otherNavItems = [
  { to: '/schedules', labelKey: 'items.schedules', icon: CalendarClock },
  { to: '/admin/migration', labelKey: 'items.migration', icon: ArrowRightLeft },
]

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string
  items: typeof mainNavItems
  onNavigate?: () => void
}) {
  const { t } = useTranslation('nav')
  return (
    <div className="px-3 py-2">
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-sidebar-foreground">{title}</h2>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-sidebar-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('nav')
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Database className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-sidebar-foreground">{t('appName')}</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <NavSection title={t('sections.overview')} items={mainNavItems} onNavigate={onNavigate} />
        <Separator className="my-2" />
        <NavSection
          title={t('sections.dataModeling')}
          items={adminNavItems}
          onNavigate={onNavigate}
        />
        <Separator className="my-2" />
        <NavSection title={t('sections.maps')} items={mapsNavItems} onNavigate={onNavigate} />
        <Separator className="my-2" />
        <NavSection title={t('sections.other')} items={otherNavItems} onNavigate={onNavigate} />
      </nav>
      <div className="border-t p-3">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent text-accent-foreground' : 'text-sidebar-foreground'
            )
          }
        >
          <Settings className="h-4 w-4" />
          {t('items.settings')}
        </NavLink>
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <div className="hidden h-full w-64 flex-col border-r bg-sidebar md:flex">
      <SidebarNav />
    </div>
  )
}
