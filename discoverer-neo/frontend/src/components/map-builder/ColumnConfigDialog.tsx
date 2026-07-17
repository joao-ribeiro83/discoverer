import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMapBuilderStore, columnLabel } from '@/store/mapBuilder'
import type { AggFunction, SortDirection } from '@/lib/types'

const AGG_FUNCTIONS: AggFunction[] = ['NONE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX']

// Radix SelectItem forbids empty-string values, so presets only *set* a mask;
// clear the field via the free-text input instead.
const FORMAT_PRESETS = [
  { label: 'Number (1,234)', value: '999,999,999' },
  { label: 'Decimal (1,234.00)', value: '999,999,999.00' },
  { label: 'Currency ($1,234.00)', value: '$999,999,999.00' },
  { label: 'Percent (12.3%)', value: '990.0%' },
  { label: 'Date (DD-MON-YYYY)', value: 'DD-MON-YYYY' },
  { label: 'Date (YYYY-MM-DD)', value: 'YYYY-MM-DD' },
]

const SORT_NONE = 'NONE'

interface FormState {
  displayName: string
  aggFunction: string
  formatMask: string
  sortDirection: SortDirection | typeof SORT_NONE
  sortOrder: string
  columnWidth: string
}

export function ColumnConfigDialog({
  columnKey,
  open,
  onOpenChange,
}: {
  columnKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const item = useMapBuilderStore((s) =>
    columnKey ? s.selectedItems.find((c) => c.key === columnKey) : undefined,
  )
  const updateItem = useMapBuilderStore((s) => s.updateItem)

  const [form, setForm] = useState<FormState>({
    displayName: '',
    aggFunction: 'NONE',
    formatMask: '',
    sortDirection: SORT_NONE,
    sortOrder: '',
    columnWidth: '',
  })

  // Re-seed the form whenever a different column is opened.
  useEffect(() => {
    if (!open || !item) return
    setForm({
      displayName: item.displayName ?? '',
      aggFunction: item.aggFunction || 'NONE',
      formatMask: item.formatMask ?? '',
      sortDirection: item.sortDirection ?? SORT_NONE,
      sortOrder: item.sortOrder != null ? String(item.sortOrder) : '',
      columnWidth: item.columnWidth != null ? String(item.columnWidth) : '',
    })
  }, [open, item])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSave() {
    if (!columnKey) return
    const sortOrderNum = form.sortOrder.trim() === '' ? null : Number(form.sortOrder)
    const columnWidthNum = form.columnWidth.trim() === '' ? null : Number(form.columnWidth)
    updateItem(columnKey, {
      displayName: form.displayName.trim() === '' ? null : form.displayName.trim(),
      aggFunction: form.aggFunction === 'NONE' ? null : form.aggFunction,
      formatMask: form.formatMask.trim() === '' ? null : form.formatMask.trim(),
      sortDirection: form.sortDirection === SORT_NONE ? null : form.sortDirection,
      sortOrder: sortOrderNum != null && Number.isFinite(sortOrderNum) ? sortOrderNum : null,
      columnWidth:
        columnWidthNum != null && Number.isFinite(columnWidthNum) && columnWidthNum > 0
          ? columnWidthNum
          : null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure column</DialogTitle>
          <DialogDescription>
            {item ? columnLabel(item) : 'Column settings'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col-display-name">Display name</Label>
            <Input
              id="col-display-name"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder={item?.source.name ?? ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Aggregation</Label>
              <Select value={form.aggFunction} onValueChange={(v) => set('aggFunction', v)}>
                <SelectTrigger aria-label="Aggregation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGG_FUNCTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort direction</Label>
              <Select
                value={form.sortDirection}
                onValueChange={(v) => set('sortDirection', v as FormState['sortDirection'])}
              >
                <SelectTrigger aria-label="Sort direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SORT_NONE}>None</SelectItem>
                  <SelectItem value="ASC">Ascending</SelectItem>
                  <SelectItem value="DESC">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="col-format-mask">Format mask</Label>
            <div className="flex gap-2">
              <Input
                id="col-format-mask"
                value={form.formatMask}
                onChange={(e) => set('formatMask', e.target.value)}
                placeholder="e.g. 999,999.00"
                className="flex-1"
              />
              <Select value="" onValueChange={(v) => set('formatMask', v)}>
                <SelectTrigger className="w-[130px]" aria-label="Format presets">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="col-sort-order">Sort order</Label>
              <Input
                id="col-sort-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-width">Column width (px)</Label>
              <Input
                id="col-width"
                type="number"
                min={1}
                value={form.columnWidth}
                onChange={(e) => set('columnWidth', e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!item}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
