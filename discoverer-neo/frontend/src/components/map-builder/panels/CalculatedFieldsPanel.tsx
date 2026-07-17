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
import { GripVertical, X, Sigma } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMapBuilderStore, type MapBuilderCalculatedField } from '@/store/mapBuilder'
import { FormulaEditorDialog } from './FormulaEditorDialog'

export function CalculatedFieldsPanel() {
  const calculatedFields = useMapBuilderStore((s) => s.calculatedFields)
  const addCalculatedField = useMapBuilderStore((s) => s.addCalculatedField)
  const removeCalculatedField = useMapBuilderStore((s) => s.removeCalculatedField)
  const updateCalculatedField = useMapBuilderStore((s) => s.updateCalculatedField)
  const reorderCalculatedFields = useMapBuilderStore((s) => s.reorderCalculatedFields)

  const [editingKey, setEditingKey] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...calculatedFields].sort((a, b) => a.displayOrder - b.displayOrder),
    [calculatedFields],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderCalculatedFields(String(active.id), String(over.id))
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Calculated fields</h4>
        <Button size="sm" onClick={addCalculatedField}>
          <Sigma className="h-3.5 w-3.5" /> Add Calculated Field
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No calculated fields. Add one to derive a new column from a formula.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sorted.map((f) => f.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sorted.map((field) => (
                <CalculatedFieldRow
                  key={field.key}
                  field={field}
                  onUpdate={(patch) => updateCalculatedField(field.key, patch)}
                  onRemove={() => removeCalculatedField(field.key)}
                  onEditFormula={() => setEditingKey(field.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FormulaEditorDialog
        fieldKey={editingKey}
        open={editingKey !== null}
        onOpenChange={(open) => !open && setEditingKey(null)}
      />
    </div>
  )
}

function CalculatedFieldRow({
  field,
  onUpdate,
  onRemove,
  onEditFormula,
}: {
  field: MapBuilderCalculatedField
  onUpdate: (patch: Partial<Omit<MapBuilderCalculatedField, 'key'>>) => void
  onRemove: () => void
  onEditFormula: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('space-y-2 rounded-md border bg-card p-2', isDragging && 'opacity-50')}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${field.name || 'calculated field'}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          className="h-8 flex-1"
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Field name"
          aria-label="Calculated field name"
        />
        <Input
          type="number"
          className="h-8 w-16"
          value={field.displayOrder}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onUpdate({ displayOrder: n })
          }}
          aria-label="Display order"
          title="Display order"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={`Delete ${field.name || 'calculated field'}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start truncate font-mono text-xs font-normal"
        onClick={onEditFormula}
      >
        {field.formula.trim() ? field.formula : 'Click to write a formula…'}
      </Button>
    </div>
  )
}
