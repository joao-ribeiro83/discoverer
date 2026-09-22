import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { ConditionalFormatOperator, ConditionalFormatRule } from '@/lib/types'

const OPERATORS: ConditionalFormatOperator[] = ['=', '<>', '>', '<', '>=', '<=', 'LIKE', 'IN', 'BETWEEN', 'IS_NULL']
/** Operators whose value is entered as two comma-joined parts, not free text. */
const NO_VALUE_OPERATORS: ConditionalFormatOperator[] = ['IS_NULL']

interface ConditionalFormatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapId: string
}

interface DraftRule {
  mapItemId: string
  target: 'CELL' | 'ROW'
  operator: ConditionalFormatOperator
  value: string
  backgroundColor: string
  textColor: string
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
}

const BLANK_DRAFT: DraftRule = {
  mapItemId: '',
  target: 'CELL',
  operator: '>',
  value: '',
  backgroundColor: '#fde68a',
  textColor: '',
  isBold: false,
  isItalic: false,
  isUnderline: false,
}

export function ConditionalFormatDialog({ open, onOpenChange, mapId }: ConditionalFormatDialogProps) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState<DraftRule | null>(null)

  const mapQuery = useQuery({
    queryKey: ['map', mapId],
    queryFn: () => apiClient.maps.get(mapId).then((r) => r.data.data),
    enabled: open,
  })
  const rulesQuery = useQuery({
    queryKey: ['conditional-formats', mapId],
    queryFn: () => apiClient.maps.listConditionalFormats(mapId).then((r) => r.data.data),
    enabled: open,
  })

  // A migrated worksheet keeps query items that are not placed on the sheet
  // (`isHidden`: used only by a condition, a sort or a calculation). Only the
  // columns the map shows can carry a format.
  const columns = (mapQuery.data?.items ?? []).filter((c) => !c.isHidden)
  const rules = rulesQuery.data ?? []
  const labelForItem = (mapItemId: string | null): string => {
    const column = columns.find((c) => c.id === mapItemId)
    return column?.displayName || t('mapBuilder:conditionalFormat.unknownColumn')
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['conditional-formats', mapId] })
  }

  const createMutation = useMutation({
    mutationFn: (input: DraftRule) =>
      apiClient.maps.createConditionalFormat(mapId, {
        mapItemId: input.mapItemId,
        target: input.target,
        operator: input.operator,
        value: NO_VALUE_OPERATORS.includes(input.operator) ? null : input.value,
        backgroundColor: input.backgroundColor || null,
        textColor: input.textColor || null,
        isBold: input.isBold,
        isItalic: input.isItalic,
        isUnderline: input.isUnderline,
        displayOrder: rules.length,
      }),
    onSuccess: () => {
      invalidate()
      setDraft(null)
      toast({ title: t('mapBuilder:conditionalFormat.toastCreated') })
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:conditionalFormat.toastCreateFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (formatId: string) => apiClient.maps.deleteConditionalFormat(mapId, formatId),
    onSuccess: () => {
      invalidate()
      toast({ title: t('mapBuilder:conditionalFormat.toastDeleted') })
    },
    onError: (err) => {
      toast({
        title: t('mapBuilder:conditionalFormat.toastDeleteFailedTitle'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  function ruleSummary(rule: ConditionalFormatRule): string {
    const op = rule.operator ?? '?'
    const value = rule.value ?? ''
    return `${labelForItem(rule.mapItemId)} ${op} ${value}`.trim()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('mapBuilder:conditionalFormat.title')}</DialogTitle>
          <DialogDescription>{t('mapBuilder:conditionalFormat.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rulesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common:states.loading')}
            </div>
          )}
          {!rulesQuery.isLoading && rules.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('mapBuilder:conditionalFormat.noRules')}</p>
          )}
          <ul className="space-y-1">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: rule.backgroundColor ?? 'transparent' }}
                  aria-hidden
                />
                <span className="flex-1 truncate" title={ruleSummary(rule)}>
                  {ruleSummary(rule)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t(`mapBuilder:conditionalFormat.targets.${rule.target}`)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={t('mapBuilder:conditionalFormat.deleteRuleAria')}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(rule.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        {!draft ? (
          <Button
            variant="outline"
            size="sm"
            disabled={columns.length === 0}
            onClick={() => setDraft({ ...BLANK_DRAFT, mapItemId: columns[0]?.id ?? '' })}
          >
            <Plus className="h-4 w-4" /> {t('mapBuilder:conditionalFormat.addRule')}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('mapBuilder:conditionalFormat.column')}</Label>
                <Select value={draft.mapItemId} onValueChange={(v) => setDraft({ ...draft, mapItemId: v })}>
                  <SelectTrigger aria-label={t('mapBuilder:conditionalFormat.column')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName || c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t('mapBuilder:conditionalFormat.applyTo')}</Label>
                <Select
                  value={draft.target}
                  onValueChange={(v) => setDraft({ ...draft, target: v as 'CELL' | 'ROW' })}
                >
                  <SelectTrigger aria-label={t('mapBuilder:conditionalFormat.applyTo')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CELL">{t('mapBuilder:conditionalFormat.targets.CELL')}</SelectItem>
                    <SelectItem value="ROW">{t('mapBuilder:conditionalFormat.targets.ROW')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('mapBuilder:conditionalFormat.operator')}</Label>
                <Select
                  value={draft.operator}
                  onValueChange={(v) => setDraft({ ...draft, operator: v as ConditionalFormatOperator })}
                >
                  <SelectTrigger aria-label={t('mapBuilder:conditionalFormat.operator')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {t(`mapBuilder:conditionalFormat.operators.${op}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!NO_VALUE_OPERATORS.includes(draft.operator) && (
                <div className="space-y-1">
                  <Label htmlFor="conditional-format-value">{t('mapBuilder:conditionalFormat.value')}</Label>
                  <Input
                    id="conditional-format-value"
                    value={draft.value}
                    onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                    placeholder={
                      draft.operator === 'BETWEEN'
                        ? t('mapBuilder:conditionalFormat.valueBetweenPlaceholder')
                        : draft.operator === 'IN'
                          ? t('mapBuilder:conditionalFormat.valueInPlaceholder')
                          : undefined
                    }
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('mapBuilder:conditionalFormat.backgroundColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 shrink-0 rounded border"
                    value={draft.backgroundColor || '#ffffff'}
                    onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
                    aria-label={t('mapBuilder:conditionalFormat.backgroundColor')}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft({ ...draft, backgroundColor: '' })}
                  >
                    {t('mapBuilder:conditionalFormat.clearColor')}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t('mapBuilder:conditionalFormat.textColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 shrink-0 rounded border"
                    value={draft.textColor || '#000000'}
                    onChange={(e) => setDraft({ ...draft, textColor: e.target.value })}
                    aria-label={t('mapBuilder:conditionalFormat.textColor')}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, textColor: '' })}>
                    {t('mapBuilder:conditionalFormat.clearColor')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cf-bold"
                  checked={draft.isBold}
                  onCheckedChange={(v) => setDraft({ ...draft, isBold: v === true })}
                />
                <Label htmlFor="cf-bold" className="cursor-pointer font-normal">
                  {t('mapBuilder:conditionalFormat.bold')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cf-italic"
                  checked={draft.isItalic}
                  onCheckedChange={(v) => setDraft({ ...draft, isItalic: v === true })}
                />
                <Label htmlFor="cf-italic" className="cursor-pointer font-normal">
                  {t('mapBuilder:conditionalFormat.italic')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cf-underline"
                  checked={draft.isUnderline}
                  onCheckedChange={(v) => setDraft({ ...draft, isUnderline: v === true })}
                />
                <Label htmlFor="cf-underline" className="cursor-pointer font-normal">
                  {t('mapBuilder:conditionalFormat.underline')}
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                {t('common:actions.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!draft.mapItemId || createMutation.isPending}
                onClick={() => createMutation.mutate(draft)}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('common:actions.save')
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
