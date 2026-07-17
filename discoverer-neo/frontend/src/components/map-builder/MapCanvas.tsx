import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, ArrowUp, ArrowDown, Sigma, Tag, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useMapBuilderStore,
  columnLabel,
  type MapBuilderItem,
} from '@/store/mapBuilder'
import { itemRole } from './item-utils'

export const CANVAS_DROPPABLE_ID = 'canvas-dropzone'

export function MapCanvas({ onConfigure }: { onConfigure: (key: string) => void }) {
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Columns</h3>
        <Badge variant="secondary" className="ml-auto">
          {selectedItems.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div
          ref={setNodeRef}
          data-testid="map-canvas-dropzone"
          className={cn(
            'm-3 min-h-[calc(100%-1.5rem)] rounded-lg border-2 border-dashed p-3 transition-colors',
            isOver ? 'border-primary bg-primary/5' : 'border-muted',
          )}
        >
          {selectedItems.length === 0 ? (
            <EmptyState isOver={isOver} />
          ) : (
            <SortableContext
              items={selectedItems.map((i) => i.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <ColumnRow key={item.key} item={item} onConfigure={onConfigure} />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function EmptyState({ isOver }: { isOver: boolean }) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center">
      <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">
        {isOver ? 'Drop to add this column' : 'Drag items here to build your map'}
      </p>
      <p className="text-xs text-muted-foreground">
        Pick dimensions and measures from the tree on the left.
      </p>
    </div>
  )
}

function ColumnRow({
  item,
  onConfigure,
}: {
  item: MapBuilderItem
  onConfigure: (key: string) => void
}) {
  const removeItem = useMapBuilderStore((s) => s.removeItem)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key, data: { type: 'canvas-item' } })

  const role = itemRole({
    itemType: item.source.itemType,
    dataType: item.source.dataType,
    aggFunction: item.aggFunction,
  })
  const agg = item.aggFunction && item.aggFunction !== 'NONE' ? item.aggFunction : null

  return (
    <div
      ref={setNodeRef}
      data-testid="canvas-column-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card px-2 py-2 shadow-sm',
        isDragging && 'opacity-50',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Reorder column"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {role === 'measure' ? (
        <Sigma className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Tag className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
      )}

      <button
        type="button"
        onClick={() => onConfigure(item.key)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title="Configure column"
      >
        <span className="truncate text-sm font-medium">{columnLabel(item)}</span>
        {agg && (
          <Badge variant="outline" className="h-5 px-1.5 text-xs">
            {agg}
          </Badge>
        )}
        {item.sortDirection === 'ASC' && <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />}
        {item.sortDirection === 'DESC' && <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => removeItem(item.key)}
        aria-label={`Remove ${columnLabel(item)}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
