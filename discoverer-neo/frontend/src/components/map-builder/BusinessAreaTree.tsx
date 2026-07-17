import { memo, useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDraggable } from '@dnd-kit/core'
import {
  ChevronRight,
  Database,
  Folder as FolderIcon,
  Search,
  Sigma,
  Tag,
  Check,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { BusinessArea, Folder, Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMapBuilderStore } from '@/store/mapBuilder'
import { itemRole } from './item-utils'

/** Payload attached to a draggable tree item; read in the page's onDragEnd. */
export interface TreeItemDragData {
  type: 'tree-item'
  itemId: string
  source: {
    name: string
    itemType: Item['itemType']
    dataType: string | null
    folderId: string
    folderName: string
    businessAreaId: string
  }
  defaultAggFunction: string | null
  defaultFormatMask: string | null
}

export function BusinessAreaTree() {
  const [search, setSearch] = useState('')
  // Filtering re-renders every expanded folder's item list on each keystroke;
  // deferring the value lets React finish an in-flight render before
  // starting the next one instead of queuing one render per keystroke.
  const deferredSearch = useDeferredValue(search)

  const { data: businessAreas, isLoading } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <h3 className="mb-2 text-sm font-semibold">Business Areas</h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter items…"
            className="h-8 pl-8"
            aria-label="Filter items"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (businessAreas ?? []).length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No business areas.</p>
          ) : (
            (businessAreas ?? []).map((ba) => (
              <BusinessAreaNode key={ba.id} ba={ba} search={deferredSearch.trim().toLowerCase()} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

const BusinessAreaNode = memo(function BusinessAreaNode({
  ba,
  search,
}: {
  ba: BusinessArea
  search: string
}) {
  const [expanded, setExpanded] = useState(false)

  const { data: folders } = useQuery({
    queryKey: ['folders', ba.id],
    queryFn: async () => (await apiClient.folders.listByBusinessArea(ba.id)).data.data,
    enabled: expanded,
  })

  return (
    <div>
      <TreeRow
        depth={0}
        expandable
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
        label={ba.name}
      />
      {expanded && (
        <div>
          {(folders ?? []).map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              businessAreaId={ba.id}
              search={search}
            />
          ))}
          {folders && folders.length === 0 && (
            <EmptyRow depth={1}>No folders</EmptyRow>
          )}
        </div>
      )}
    </div>
  )
})

const FolderNode = memo(function FolderNode({
  folder,
  businessAreaId,
  search,
}: {
  folder: Folder
  businessAreaId: string
  search: string
}) {
  const [expanded, setExpanded] = useState(false)

  const { data: items } = useQuery({
    queryKey: ['items', folder.id],
    queryFn: async () => (await apiClient.items.listByFolder(folder.id)).data.data,
    enabled: expanded,
  })

  const visibleItems = useMemo(() => {
    const active = (items ?? []).filter((i) => i.isActive)
    if (!search) return active
    return active.filter((i) => i.name.toLowerCase().includes(search))
  }, [items, search])

  return (
    <div>
      <TreeRow
        depth={1}
        expandable
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        icon={<FolderIcon className="h-4 w-4 text-muted-foreground" />}
        label={folder.name}
        trailing={
          items ? (
            <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs font-normal">
              {visibleItems.length}
            </Badge>
          ) : null
        }
      />
      {expanded && (
        <div>
          {visibleItems.map((item) => (
            <ItemNode
              key={item.id}
              item={item}
              folderName={folder.name}
              businessAreaId={businessAreaId}
            />
          ))}
          {items && visibleItems.length === 0 && (
            <EmptyRow depth={2}>{search ? 'No matching items' : 'No items'}</EmptyRow>
          )}
        </div>
      )}
    </div>
  )
})

const ItemNode = memo(function ItemNode({
  item,
  folderName,
  businessAreaId,
}: {
  item: Item
  folderName: string
  businessAreaId: string
}) {
  const selected = useMapBuilderStore((s) =>
    s.selectedItems.some((c) => c.itemId === item.id),
  )
  const role = itemRole({
    itemType: item.itemType,
    dataType: item.dataType,
    aggFunction: item.aggFunction,
  })

  const dragData: TreeItemDragData = {
    type: 'tree-item',
    itemId: item.id,
    source: {
      name: item.name,
      itemType: item.itemType,
      dataType: item.dataType,
      folderId: item.folderId,
      folderName,
      businessAreaId,
    },
    defaultAggFunction: item.aggFunction,
    defaultFormatMask: item.formatMask,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tree:${item.id}`,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`tree-item-${item.id}`}
      style={{ paddingLeft: 2 * 16 + 8 }}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-md py-1.5 pr-2 text-sm hover:bg-accent active:cursor-grabbing',
        isDragging && 'opacity-40',
        selected && 'text-muted-foreground',
      )}
      title={role === 'measure' ? 'Measure' : 'Dimension'}
    >
      {role === 'measure' ? (
        <Sigma className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Tag className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
      )}
      <span className="truncate">{item.name}</span>
      {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Row primitives
// ---------------------------------------------------------------------------

function TreeRow({
  depth,
  expandable,
  expanded,
  onToggle,
  icon,
  label,
  trailing,
}: {
  depth: number
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  icon: React.ReactNode
  label: string
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ paddingLeft: depth * 16 + 4 }}
      className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-accent"
    >
      {expandable ? (
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      {icon}
      <span className="truncate font-medium">{label}</span>
      {trailing}
    </button>
  )
}

function EmptyRow({ depth, children }: { depth: number; children: React.ReactNode }) {
  return (
    <p
      style={{ paddingLeft: depth * 16 + 8 }}
      className="py-1.5 text-xs italic text-muted-foreground"
    >
      {children}
    </p>
  )
}
