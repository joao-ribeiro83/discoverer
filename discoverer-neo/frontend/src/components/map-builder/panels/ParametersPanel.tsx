import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
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
import { useMapBuilderStore, type MapBuilderParameter } from '@/store/mapBuilder'
import type { MapParameter } from '@/lib/types'

const PARAM_TYPES: MapParameter['paramType'][] = ['STRING', 'NUMBER', 'DATE', 'LIST']

function inputType(paramType: MapParameter['paramType']): 'text' | 'number' | 'date' {
  if (paramType === 'NUMBER') return 'number'
  if (paramType === 'DATE') return 'date'
  return 'text'
}

export function ParametersPanel() {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const parameters = useMapBuilderStore((s) => s.parameters)
  const addParameter = useMapBuilderStore((s) => s.addParameter)
  const removeParameter = useMapBuilderStore((s) => s.removeParameter)
  const updateParameter = useMapBuilderStore((s) => s.updateParameter)

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{t('mapBuilder:panels.parameters.title')}</h4>
        <Button size="sm" onClick={addParameter}>
          <Plus className="h-3.5 w-3.5" /> {t('mapBuilder:panels.parameters.addButton')}
        </Button>
      </div>

      {parameters.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('mapBuilder:panels.parameters.empty')}</p>
      ) : (
        <div className="space-y-3">
          {parameters.map((p) => (
            <ParameterRow
              key={p.key}
              parameter={p}
              onUpdate={(patch) => updateParameter(p.key, patch)}
              onRemove={() => removeParameter(p.key)}
            />
          ))}
        </div>
      )}

      {parameters.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs text-muted-foreground">
            {t('mapBuilder:panels.parameters.previewLabel')}
          </Label>
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            {parameters.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs">
                  {p.name || t('mapBuilder:panels.parameters.unnamed')}
                  {p.isRequired && <span className="text-destructive"> *</span>}
                </Label>
                <PreviewInput parameter={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ParameterRow({
  parameter,
  onUpdate,
  onRemove,
}: {
  parameter: MapBuilderParameter
  onUpdate: (patch: Partial<Omit<MapBuilderParameter, 'key'>>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  return (
    <div className="space-y-2 rounded-md border bg-card p-2">
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1"
          value={parameter.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder={t('mapBuilder:panels.parameters.namePlaceholder')}
          aria-label={t('mapBuilder:panels.parameters.nameAria')}
        />
        <Select
          value={parameter.paramType}
          onValueChange={(v) => onUpdate({ paramType: v as MapBuilderParameter['paramType'] })}
        >
          <SelectTrigger className="h-8 w-28" aria-label={t('mapBuilder:panels.parameters.typeAria')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PARAM_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {pt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onRemove}
          aria-label={t('mapBuilder:panels.parameters.deleteAria', { name: parameter.name || '' })}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <DefaultValueInput parameter={parameter} onChange={(value) => onUpdate({ defaultValue: value })} />

      <div className="flex items-center gap-2">
        <Checkbox
          id={`param-required-${parameter.key}`}
          checked={parameter.isRequired}
          onCheckedChange={(v) => onUpdate({ isRequired: v === true })}
        />
        <Label htmlFor={`param-required-${parameter.key}`} className="cursor-pointer text-xs">
          {t('common:labels.required')}
        </Label>
      </div>
    </div>
  )
}

function DefaultValueInput({
  parameter,
  onChange,
}: {
  parameter: MapBuilderParameter
  onChange: (value: string | null) => void
}) {
  const { t } = useTranslation(['mapBuilder'])
  const placeholder =
    parameter.paramType === 'LIST'
      ? t('mapBuilder:panels.parameters.defaultValueListPlaceholder')
      : t('mapBuilder:panels.parameters.defaultValuePlaceholder')
  return (
    <Input
      className="h-8"
      type={inputType(parameter.paramType)}
      value={parameter.defaultValue ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      aria-label={t('mapBuilder:panels.parameters.defaultValueAria')}
    />
  )
}

function PreviewInput({ parameter }: { parameter: MapBuilderParameter }) {
  const { t } = useTranslation(['mapBuilder'])
  return (
    <Input
      className="h-8"
      type={inputType(parameter.paramType)}
      disabled
      defaultValue={parameter.defaultValue ?? ''}
      placeholder={
        parameter.paramType === 'LIST'
          ? t('mapBuilder:panels.parameters.defaultValueListPlaceholder')
          : t('mapBuilder:panels.parameters.previewValuePlaceholder')
      }
    />
  )
}
