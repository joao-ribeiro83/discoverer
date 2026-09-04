import { memo, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  Plus,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { BusinessArea, Folder, Item } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
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

/**
 * Height of a single tree row, in px. Must track the row classes below
 * (`py-1.5` + `text-sm` => 6 + 20 + 6). Rows are uniform by construction, so a
 * fixed size avoids per-row measurement.
 */
const ROW_HEIGHT = 32
const INDENT = 16

// ---------------------------------------------------------------------------
// Flattened row model
//
// The tree is rendered from a single flat array rather than nested components
// so that one virtualizer can cover the whole thing. Oracle EUL fact tables
// routinely carry hundreds of columns — a folder of 2,000 items mounted 2,000
// draggable rows and took ~700ms to become interactive, and every one of those
// nodes stayed in the DOM afterwards.
// ---------------------------------------------------------------------------

type Row =
  | { kind: 'ba'; key: string; ba: BusinessArea; expanded: boolean }
  | {
      kind: 'folder'
      key: string
      folder: Folder
      businessAreaId: string
      expanded: boolean
      /** Visible item count, or null while the folder's items are unloaded. */
      count: number | null
    }
  | { kind: 'item'; key: string; item: Item; folderName: string; businessAreaId: string }
  | { kind: 'empty'; key: string; depth: number; text: string }

export function BusinessAreaTree() {
  const { t } = useTranslation(['mapBuilder'])
  const [search, setSearch] = useState('')
  // Filtering re-renders every expanded folder's item list on each keystroke;
  // deferring the value lets React finish an in-flight render before
  // starting the next one instead of queuing one render per keystroke.
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = deferredSearch.trim().toLowerCase()

  // Expansion is held here rather than in each node: the flat row list has to
  // be derivable in one pass, which means the parent needs to know what is open.
  const [expandedBusinessAreas, setExpandedBusinessAreas] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: businessAreas, isLoading } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  // One query per expanded business area / folder. Collapsing drops the query
  // from the list but react-query keeps the data cached, so re-expanding is
  // instant and does not refetch.
  const expandedBaIds = useMemo(() => [...expandedBusinessAreas], [expandedBusinessAreas])
  const expandedFolderIds = useMemo(() => [...expandedFolders], [expandedFolders])

  const folderQueries = useQueries({
    queries: expandedBaIds.map((baId) => ({
      queryKey: ['folders', baId],
      queryFn: async () => (await apiClient.folders.listByBusinessArea(baId)).data.data,
    })),
  })

  const itemQueries = useQueries({
    queries: expandedFolderIds.map((folderId) => ({
      queryKey: ['items', folderId],
      queryFn: async () => (await apiClient.items.listByFolder(folderId)).data.data,
    })),
  })

  const foldersByBusinessArea = useMemo(() => {
    const map = new Map<string, Folder[] | undefined>()
    expandedBaIds.forEach((baId, i) => map.set(baId, folderQueries[i]?.data))
    return map
  }, [expandedBaIds, folderQueries])

  const itemsByFolder = useMemo(() => {
    const map = new Map<string, Item[] | undefined>()
    expandedFolderIds.forEach((folderId, i) => map.set(folderId, itemQueries[i]?.data))
    return map
  }, [expandedFolderIds, itemQueries])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []

    for (const ba of businessAreas ?? []) {
      const baExpanded = expandedBusinessAreas.has(ba.id)
      out.push({ kind: 'ba', key: `ba:${ba.id}`, ba, expanded: baExpanded })
      if (!baExpanded) continue

      const folders = foldersByBusinessArea.get(ba.id)
      // Still loading — render nothing rather than a flash of "No folders".
      if (!folders) continue
      if (folders.length === 0) {
        out.push({
          kind: 'empty',
          key: `ba:${ba.id}:empty`,
          depth: 1,
          text: t('mapBuilder:tree.emptyFolders'),
        })
        continue
      }

      for (const folder of folders) {
        const folderExpanded = expandedFolders.has(folder.id)
        const items = itemsByFolder.get(folder.id)
        const visible = items
          ? items.filter(
              (i) =>
                i.isActive &&
                (!normalizedSearch || i.name.toLowerCase().includes(normalizedSearch)),
            )
          : undefined

        out.push({
          kind: 'folder',
          key: `folder:${folder.id}`,
          folder,
          businessAreaId: ba.id,
          expanded: folderExpanded,
          count: visible?.length ?? null,
        })

        if (!folderExpanded || !visible) continue
        if (visible.length === 0) {
          out.push({
            kind: 'empty',
            key: `folder:${folder.id}:empty`,
            depth: 2,
            text: normalizedSearch
              ? t('mapBuilder:tree.emptyMatchingItems')
              : t('mapBuilder:tree.emptyItems'),
          })
          continue
        }
        for (const item of visible) {
          out.push({
            kind: 'item',
            key: `item:${item.id}`,
            item,
            folderName: folder.name,
            businessAreaId: ba.id,
          })
        }
      }
    }

    return out
  }, [
    businessAreas,
    expandedBusinessAreas,
    expandedFolders,
    foldersByBusinessArea,
    itemsByFolder,
    normalizedSearch,
    t,
  ])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  const toggleBusinessArea = (id: string) =>
    setExpandedBusinessAreas((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const toggleFolder = (id: string) =>
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <h3 className="mb-2 text-sm font-semibold">{t('mapBuilder:tree.title')}</h3>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mapBuilder:tree.filterPlaceholder')}
            className="h-8 pl-8"
            aria-label={t('mapBuilder:tree.filterAria')}
          />
        </div>
      </div>

      {/* Plain scroll container rather than <ScrollArea>: the virtualizer needs
          a real scrolling element to measure, and Radix owns its viewport. */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('mapBuilder:tree.loading')}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{t('mapBuilder:tree.emptyBusinessAreas')}</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              return (
                <div
                  key={row.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.kind === 'ba' ? (
                    <TreeRow
                      depth={0}
                      expandable
                      expanded={row.expanded}
                      onToggle={() => toggleBusinessArea(row.ba.id)}
                      icon={<Database className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      label={row.ba.name}
                    />
                  ) : row.kind === 'folder' ? (
                    <TreeRow
                      depth={1}
                      expandable
                      expanded={row.expanded}
                      onToggle={() => toggleFolder(row.folder.id)}
                      icon={<FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      label={row.folder.name}
                      trailing={
                        row.count === null ? null : (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 px-1.5 text-xs font-normal"
                          >
                            {row.count}
                          </Badge>
                        )
                      }
                    />
                  ) : row.kind === 'item' ? (
                    <ItemNode
                      item={row.item}
                      folderName={row.folderName}
                      businessAreaId={row.businessAreaId}
                    />
                  ) : (
                    <EmptyRow depth={row.depth}>{row.text}</EmptyRow>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const ItemNode = memo(function ItemNode({
  item,
  folderName,
  businessAreaId,
}: {
  item: Item
  folderName: string
  businessAreaId: string
}) {
  const { t } = useTranslation(['mapBuilder'])
  const { toast } = useToast()
  const selected = useMapBuilderStore((s) =>
    s.selectedItems.some((c) => c.itemId === item.id),
  )
  const role = itemRole({
    itemType: item.itemType,
    dataType: item.dataType,
    aggFunction: item.aggFunction,
  })

  // Keyboard/pointer route onto the canvas, alongside the drag route below.
  // Both call the same guarded store action — see MapBuilderPage's
  // onDragEnd for the drag-path equivalent of this outcome handling.
  function handleAdd() {
    const outcome = useMapBuilderStore.getState().addItem({
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
    })
    if (outcome.ok) {
      toast({
        title: t('mapBuilder:tree.addedTitle'),
        description: t('mapBuilder:tree.addedDescription', { name: item.name }),
      })
    } else {
      toast(
        outcome.reason === 'duplicate'
          ? {
              title: t('mapBuilder:page.duplicateTitle'),
              description: t('mapBuilder:page.duplicateDescription', { name: item.name }),
            }
          : {
              title: t('mapBuilder:page.crossBusinessAreaTitle'),
              description: t('mapBuilder:page.crossBusinessAreaDescription'),
              variant: 'destructive',
            },
      )
    }
  }

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

  // Safe to unmount while a drag is in flight: the page renders a dnd-kit
  // <DragOverlay>, so the thing following the cursor is not this node.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tree:${item.id}`,
    data: dragData,
  })

  // The draggable node below carries dnd-kit's own role="button" — nesting a
  // real <button> inside it would be an invalid interactive-in-interactive
  // pattern (and collapse both into one accessible name). The Add button is
  // a sibling instead, sharing this row's padding and hover background.
  return (
    <div
      style={{ paddingLeft: 2 * INDENT + 8 }}
      className={cn(
        'flex items-center gap-1 rounded-md pr-2 hover:bg-accent',
        selected && 'text-muted-foreground',
      )}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        data-testid={`tree-item-${item.id}`}
        className={cn(
          'flex min-w-0 flex-1 cursor-grab items-center gap-2 py-1.5 text-sm active:cursor-grabbing',
          isDragging && 'opacity-40',
        )}
        title={role === 'measure' ? t('mapBuilder:tree.roleMeasure') : t('mapBuilder:tree.roleDimension')}
      >
        {role === 'measure' ? (
          <Sigma className="h-4 w-4 shrink-0 text-chart-1" />
        ) : (
          <Tag className="h-4 w-4 shrink-0 text-chart-2" />
        )}
        <span className="truncate">{item.name}</span>
        {selected && <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        aria-label={t('mapBuilder:tree.addAria', { name: item.name })}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleAdd}
      >
        <Plus className="h-4 w-4" />
      </Button>
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
      style={{ paddingLeft: depth * INDENT + 4 }}
      className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-accent"
    >
      {expandable ? (
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
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
      style={{ paddingLeft: depth * INDENT + 8 }}
      className="py-1.5 text-xs italic text-muted-foreground"
    >
      {children}
    </p>
  )
}
