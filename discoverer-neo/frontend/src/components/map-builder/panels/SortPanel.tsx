import { useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMapBuilderStore, columnLabel, type MapBuilderItem } from '@/store/mapBuilder'
import type { SortDirection } from '@/lib/types'

const UNSORTED_PLACEHOLDER = '__pick__'

/**
 * Pure reorder+renumber step a drag-end triggers: move `activeKey` to
 * `overKey`'s position within the sorted subset, then renumber `sortOrder`
 * sequentially (0-based) for the new order. Extracted from `handleDragEnd` so
 * it's directly unit-testable without simulating real pointer geometry in
 * jsdom (dnd-kit's own pointer/keyboard sensors need real layout rects, which
 * jsdom doesn't provide).
 */
export function reorderAndRenumber(
  sorted: MapBuilderItem[],
  activeKey: string,
  overKey: string,
): { key: string; sortOrder: number }[] {
  const from = sorted.findIndex((i) => i.key === activeKey)
  const to = sorted.findIndex((i) => i.key === overKey)
  const next = sorted.slice()
  if (from !== -1 && to !== -1 && from !== to) {
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
  }
  return next.map((item, index) => ({ key: item.key, sortOrder: index }))
}

export function SortPanel() {
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const updateItem = useMapBuilderStore((s) => s.updateItem)

  const sorted = useMemo(
    () =>
      selectedItems
        .filter((i) => i.sortDirection !== null)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [selectedItems],
  )
  const unsorted = useMemo(
    () => selectedItems.filter((i) => i.sortDirection === null),
    [selectedItems],
  )

  const [pickKey, setPickKey] = useState(UNSORTED_PLACEHOLDER)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const updates = reorderAndRenumber(sorted, String(active.id), String(over.id))
    updates.forEach(({ key, sortOrder }) => updateItem(key, { sortOrder }))
  }

  function handleAddSort() {
    if (pickKey === UNSORTED_PLACEHOLDER) return
    updateItem(pickKey, { sortDirection: 'ASC', sortOrder: sorted.length })
    setPickKey(UNSORTED_PLACEHOLDER)
  }

  if (selectedItems.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Add columns to configure sorting.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Sort order</h4>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No columns are sorted yet.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sorted.map((item, index) => (
                  <SortRow
                    key={item.key}
                    item={item}
                    priority={index + 1}
                    onDirectionChange={(dir) => updateItem(item.key, { sortDirection: dir })}
                    onRemove={() => updateItem(item.key, { sortDirection: null, sortOrder: null })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {unsorted.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs">Add sort</Label>
          <div className="flex gap-2">
            <Select value={pickKey} onValueChange={setPickKey}>
              <SelectTrigger className="h-8 flex-1" aria-label="Pick column to sort">
                <SelectValue placeholder="Choose a column" />
              </SelectTrigger>
              <SelectContent>
                {unsorted.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {columnLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleAddSort} disabled={pickKey === UNSORTED_PLACEHOLDER}>
              Add Sort
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortRow({
  item,
  priority,
  onDirectionChange,
  onRemove,
}: {
  item: MapBuilderItem
  priority: number
  onDirectionChange: (dir: SortDirection) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card px-2 py-2',
        isDragging && 'opacity-50',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${columnLabel(item)}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
        {priority}
      </span>
      <span className="flex-1 truncate text-sm">{columnLabel(item)}</span>
      <Select
        value={item.sortDirection ?? 'ASC'}
        onValueChange={(v) => onDirectionChange(v as SortDirection)}
      >
        <SelectTrigger className="h-8 w-28" aria-label={`Sort direction for ${columnLabel(item)}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ASC">Ascending</SelectItem>
          <SelectItem value="DESC">Descending</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onRemove}
        aria-label={`Remove sort on ${columnLabel(item)}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
