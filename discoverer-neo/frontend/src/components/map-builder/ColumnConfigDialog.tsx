import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useMapBuilderStore, columnLabel } from '@/store/mapBuilder'
import type { AggFunction, MapAxisEdge, MapAxisType, SortDirection } from '@/lib/types'

const AGG_FUNCTIONS: AggFunction[] = ['NONE', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX']

// Radix SelectItem forbids empty-string values, so presets only *set* a mask;
// clear the field via the free-text input instead.
const FORMAT_PRESETS = [
  { id: 'number', value: '999,999,999' },
  { id: 'decimal', value: '999,999,999.00' },
  { id: 'currency', value: '$999,999,999.00' },
  { id: 'percent', value: '990.0%' },
  { id: 'dateDmy', value: 'DD-MON-YYYY' },
  { id: 'dateYmd', value: 'YYYY-MM-DD' },
] as const

const SORT_NONE = 'NONE'
/** Radix forbids an empty SelectItem value, so "not recorded" needs a token. */
const AXIS_UNSET = 'UNSET'

/**
 * Where the column sits on the sheet.
 *
 * `AXIS` groups and `MEASURE` is aggregated — the SQL generator reads this to
 * decide whether an item's default aggregation applies. `PAGE` is Discoverer's
 * page axis. A migrated worksheet always arrives with one of the three; a
 * column added here starts unset and behaves as it always has.
 */
const AXIS_TYPES: MapAxisType[] = ['AXIS', 'MEASURE', 'PAGE']

interface FormState {
  displayName: string
  aggFunction: string
  formatMask: string
  sortDirection: SortDirection | typeof SORT_NONE
  sortOrder: string
  columnWidth: string
  axisType: MapAxisType | typeof AXIS_UNSET
  axisEdge: MapAxisEdge | typeof AXIS_UNSET
  sortGroup: boolean
  isHidden: boolean
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
  const { t } = useTranslation(['mapBuilder', 'common'])
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
    axisType: AXIS_UNSET,
    axisEdge: AXIS_UNSET,
    sortGroup: false,
    isHidden: false,
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
      axisType: item.axisType ?? AXIS_UNSET,
      axisEdge: item.axisEdge ?? AXIS_UNSET,
      sortGroup: item.sortGroup,
      isHidden: item.isHidden,
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
      axisType: form.axisType === AXIS_UNSET ? null : form.axisType,
      // An edge only means anything on an axis column; storing one on a
      // measure would put a value in the crosstab's column headings that the
      // pivot then has nothing to measure.
      axisEdge:
        form.axisEdge === AXIS_UNSET || form.axisType === 'MEASURE' ? null : form.axisEdge,
      sortGroup: form.sortGroup,
      isHidden: form.isHidden,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('mapBuilder:columnConfig.title')}</DialogTitle>
          <DialogDescription>
            {item ? columnLabel(item) : t('mapBuilder:columnConfig.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="col-display-name">{t('mapBuilder:columnConfig.displayName')}</Label>
            <Input
              id="col-display-name"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder={item?.source.name ?? ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('mapBuilder:columnConfig.aggregation')}</Label>
              <Select value={form.aggFunction} onValueChange={(v) => set('aggFunction', v)}>
                <SelectTrigger aria-label={t('mapBuilder:columnConfig.aggregation')}>
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
              <Label>{t('mapBuilder:columnConfig.sortDirection')}</Label>
              <Select
                value={form.sortDirection}
                onValueChange={(v) => set('sortDirection', v as FormState['sortDirection'])}
              >
                <SelectTrigger aria-label={t('mapBuilder:columnConfig.sortDirection')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SORT_NONE}>{t('common:labels.none')}</SelectItem>
                  <SelectItem value="ASC">{t('mapBuilder:sortDirections.asc')}</SelectItem>
                  <SelectItem value="DESC">{t('mapBuilder:sortDirections.desc')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="col-format-mask">{t('mapBuilder:columnConfig.formatMask')}</Label>
            <div className="flex gap-2">
              <Input
                id="col-format-mask"
                value={form.formatMask}
                onChange={(e) => set('formatMask', e.target.value)}
                placeholder={t('mapBuilder:columnConfig.formatMaskPlaceholder')}
                className="flex-1"
              />
              <Select value="" onValueChange={(v) => set('formatMask', v)}>
                <SelectTrigger
                  className="w-[130px]"
                  aria-label={t('mapBuilder:columnConfig.formatPresetsAria')}
                >
                  <SelectValue placeholder={t('mapBuilder:columnConfig.formatPresetsPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.value}>
                      {t(`mapBuilder:columnConfig.presets.${p.id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="col-sort-order">{t('mapBuilder:columnConfig.sortOrder')}</Label>
              <Input
                id="col-sort-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
                placeholder={t('mapBuilder:columnConfig.sortOrderPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="col-width">{t('mapBuilder:columnConfig.columnWidth')}</Label>
              <Input
                id="col-width"
                type="number"
                min={1}
                value={form.columnWidth}
                onChange={(e) => set('columnWidth', e.target.value)}
                placeholder={t('mapBuilder:columnConfig.columnWidthPlaceholder')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('mapBuilder:columnConfig.axisType')}</Label>
              <Select
                value={form.axisType}
                onValueChange={(v) => set('axisType', v as FormState['axisType'])}
              >
                <SelectTrigger aria-label={t('mapBuilder:columnConfig.axisType')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AXIS_UNSET}>{t('common:labels.none')}</SelectItem>
                  {AXIS_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`mapBuilder:columnConfig.axisTypes.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('mapBuilder:columnConfig.axisEdge')}</Label>
              <Select
                value={form.axisEdge}
                onValueChange={(v) => set('axisEdge', v as FormState['axisEdge'])}
                disabled={form.axisType === 'MEASURE'}
              >
                <SelectTrigger aria-label={t('mapBuilder:columnConfig.axisEdge')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AXIS_UNSET}>{t('common:labels.none')}</SelectItem>
                  <SelectItem value="ROW">{t('mapBuilder:columnConfig.axisEdges.ROW')}</SelectItem>
                  <SelectItem value="COLUMN">
                    {t('mapBuilder:columnConfig.axisEdges.COLUMN')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t('mapBuilder:columnConfig.axisEdgeHint')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="col-sort-group"
                checked={form.sortGroup}
                onCheckedChange={(v) => set('sortGroup', v === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="col-sort-group">{t('mapBuilder:columnConfig.sortGroup')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('mapBuilder:columnConfig.sortGroupHint')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="col-hidden"
                checked={form.isHidden}
                onCheckedChange={(v) => set('isHidden', v === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="col-hidden">{t('mapBuilder:columnConfig.isHidden')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('mapBuilder:columnConfig.isHiddenHint')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!item}>
            {t('common:actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
