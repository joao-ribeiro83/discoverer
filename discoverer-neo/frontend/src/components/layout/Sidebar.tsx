import { NavLink } from 'react-router-dom'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const adminNavItems = [
  { to: '/admin/business-areas', label: 'Business Areas', icon: FolderTree },
  { to: '/admin/folders', label: 'Folders', icon: FolderOpen },
  { to: '/admin/items', label: 'Items', icon: Table2 },
  { to: '/admin/joins', label: 'Joins', icon: GitMerge },
  { to: '/admin/hierarchies', label: 'Hierarchies', icon: Layers },
  { to: '/admin/custom-functions', label: 'Custom Functions', icon: FunctionSquare },
  { to: '/admin/data-sources', label: 'Data Sources', icon: Database },
  { to: '/admin/users', label: 'Users', icon: Users },
]

const mapsNavItems = [
  { to: '/maps', label: 'Maps', icon: Map },
]

const otherNavItems = [
  { to: '/schedules', label: 'Schedules', icon: CalendarClock },
  { to: '/admin/migration', label: 'Migration', icon: ArrowRightLeft },
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
  return (
    <div className="px-3 py-2">
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Database className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Discoverer Neo</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <NavSection title="Overview" items={mainNavItems} onNavigate={onNavigate} />
        <Separator className="my-2" />
        <NavSection title="Data Modeling" items={adminNavItems} onNavigate={onNavigate} />
        <Separator className="my-2" />
        <NavSection title="Maps" items={mapsNavItems} onNavigate={onNavigate} />
        <Separator className="my-2" />
        <NavSection title="Other" items={otherNavItems} onNavigate={onNavigate} />
      </nav>
      <div className="border-t p-3">
        <NavLink
          to="/admin/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
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
