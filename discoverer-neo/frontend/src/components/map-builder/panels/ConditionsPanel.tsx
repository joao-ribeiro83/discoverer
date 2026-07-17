import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useMapBuilderStore,
  columnLabel,
  type MapBuilderCondition,
  type MapBuilderItem,
  type MapBuilderParameter,
} from '@/store/mapBuilder'
import type { ConditionOperator } from '@/lib/types'

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '=', label: '=' },
  { value: '<>', label: '<>' },
  { value: '<', label: '<' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '>=', label: '>=' },
  { value: 'LIKE', label: 'LIKE' },
  { value: 'IN', label: 'IN' },
  { value: 'BETWEEN', label: 'BETWEEN' },
  { value: 'IS_NULL', label: 'IS NULL' },
]

function valuePlaceholder(operator: ConditionOperator): string {
  if (operator === 'IN') return 'value1, value2, …'
  if (operator === 'BETWEEN') return 'low, high'
  return 'Value'
}

/**
 * Chunk an already-clustered conditions array into contiguous group runs, for
 * rendering. The store guarantees `conditions` stays clustered (see
 * `clusterConditions`/`reclusterConditions` in the store), so a simple
 * adjacency check is enough here.
 */
function chunkByGroup(conditions: MapBuilderCondition[]): MapBuilderCondition[][] {
  const chunks: MapBuilderCondition[][] = []
  for (const c of conditions) {
    const last = chunks[chunks.length - 1]
    if (last && last[0].groupId !== null && last[0].groupId === c.groupId) {
      last.push(c)
    } else {
      chunks.push([c])
    }
  }
  return chunks
}

export function ConditionsPanel() {
  const conditions = useMapBuilderStore((s) => s.conditions)
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const parameters = useMapBuilderStore((s) => s.parameters)
  const addCondition = useMapBuilderStore((s) => s.addCondition)
  const removeCondition = useMapBuilderStore((s) => s.removeCondition)
  const updateCondition = useMapBuilderStore((s) => s.updateCondition)
  const groupConditions = useMapBuilderStore((s) => s.groupConditions)
  const ungroupConditions = useMapBuilderStore((s) => s.ungroupConditions)

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const chunks = useMemo(() => chunkByGroup(conditions), [conditions])

  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleGroup() {
    groupConditions([...selectedKeys])
    setSelectedKeys(new Set())
  }

  let runningIndex = 0

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Conditions</h4>
        <Button size="sm" onClick={addCondition} disabled={selectedItems.length === 0}>
          <Plus className="h-3.5 w-3.5" /> Add Condition
        </Button>
      </div>

      {selectedItems.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add columns to the canvas before adding conditions.
        </p>
      )}

      {selectedKeys.size >= 2 && (
        <Button size="sm" variant="secondary" onClick={handleGroup} className="w-full">
          Group {selectedKeys.size} selected conditions
        </Button>
      )}

      {conditions.length === 0 ? (
        selectedItems.length > 0 && (
          <p className="text-sm text-muted-foreground">No conditions yet.</p>
        )
      ) : (
        <div className="space-y-3">
          {chunks.map((chunk) => {
            const startIndex = runningIndex
            runningIndex += chunk.length
            const isGroup = chunk.length > 1
            return (
              <div
                key={chunk[0].key}
                className={
                  isGroup
                    ? 'space-y-2 rounded-md border-2 border-dashed border-primary/40 bg-muted/30 p-2'
                    : 'space-y-2'
                }
              >
                {isGroup && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Group ({chunk.length})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => ungroupConditions(chunk[0].groupId!)}
                    >
                      Ungroup
                    </Button>
                  </div>
                )}
                {chunk.map((condition, i) => (
                  <ConditionRow
                    key={condition.key}
                    condition={condition}
                    isOverallFirst={startIndex + i === 0}
                    selected={selectedKeys.has(condition.key)}
                    onToggleSelected={() => toggleSelected(condition.key)}
                    selectedItems={selectedItems}
                    parameters={parameters}
                    onUpdate={(patch) => updateCondition(condition.key, patch)}
                    onRemove={() => removeCondition(condition.key)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ConditionRow({
  condition,
  isOverallFirst,
  selected,
  onToggleSelected,
  selectedItems,
  parameters,
  onUpdate,
  onRemove,
}: {
  condition: MapBuilderCondition
  isOverallFirst: boolean
  selected: boolean
  onToggleSelected: () => void
  selectedItems: MapBuilderItem[]
  parameters: MapBuilderParameter[]
  onUpdate: (patch: Partial<Omit<MapBuilderCondition, 'key'>>) => void
  onRemove: () => void
}) {
  const item = selectedItems.find((i) => i.itemId === condition.itemId)
  const showValue = condition.operator !== 'IS_NULL'
  const label = item ? columnLabel(item) : 'item'

  return (
    <div className="space-y-2 rounded-md border bg-card p-2">
      {!isOverallFirst && (
        <Select
          value={condition.logicOperator}
          onValueChange={(v) => onUpdate({ logicOperator: v as 'AND' | 'OR' })}
        >
          <SelectTrigger className="h-7 w-20 text-xs" aria-label="Logic operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
      )}

      <div className="flex items-start gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelected}
          aria-label={`Select condition on ${label}`}
          className="mt-2"
        />

        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Select value={condition.itemId} onValueChange={(v) => onUpdate({ itemId: v })}>
              <SelectTrigger className="h-8 flex-1" aria-label="Condition item">
                <SelectValue placeholder="Item" />
              </SelectTrigger>
              <SelectContent>
                {selectedItems.map((i) => (
                  <SelectItem key={i.itemId} value={i.itemId}>
                    {columnLabel(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(v) => onUpdate({ operator: v as ConditionOperator })}
            >
              <SelectTrigger className="h-8 w-28" aria-label="Operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showValue && (
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={condition.conditionType === 'STATIC' ? 'default' : 'outline'}
                className="h-7 flex-1 text-xs"
                onClick={() => onUpdate({ conditionType: 'STATIC', paramName: null })}
              >
                Static value
              </Button>
              <Button
                type="button"
                size="sm"
                variant={condition.conditionType === 'PARAMETER' ? 'default' : 'outline'}
                className="h-7 flex-1 text-xs"
                onClick={() =>
                  onUpdate({
                    conditionType: 'PARAMETER',
                    value: null,
                    paramName: condition.paramName ?? '',
                  })
                }
              >
                Prompt at runtime
              </Button>
            </div>
          )}

          {showValue && condition.conditionType === 'STATIC' && (
            <Input
              className="h-8"
              value={condition.value ?? ''}
              placeholder={valuePlaceholder(condition.operator)}
              onChange={(e) => onUpdate({ value: e.target.value })}
              aria-label="Condition value"
            />
          )}

          {showValue && condition.conditionType === 'PARAMETER' && (
            <>
              <Input
                className="h-8"
                list={`param-names-${condition.key}`}
                value={condition.paramName ?? ''}
                placeholder="Parameter name"
                onChange={(e) => onUpdate({ paramName: e.target.value })}
                aria-label="Parameter name"
              />
              <datalist id={`param-names-${condition.key}`}>
                {parameters.map((p) => (
                  <option key={p.key} value={p.name} />
                ))}
              </datalist>
            </>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label="Delete condition"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
