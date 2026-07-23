import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Save, Download, CalendarClock, Share2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useMapBuilderStore } from '@/store/mapBuilder'
import { ShareDialog } from '@/components/map-builder/ShareDialog'
import type { MapType } from '@/lib/types'

const MAP_TYPES: { value: MapType; labelKey: string }[] = [
  { value: 'TABLE', labelKey: 'mapBuilder:toolbar.mapTypes.table' },
  { value: 'CROSSTAB', labelKey: 'mapBuilder:toolbar.mapTypes.crosstab' },
  { value: 'PAGE_DETAIL', labelKey: 'mapBuilder:toolbar.mapTypes.pageDetail' },
  { value: 'CHART', labelKey: 'mapBuilder:toolbar.mapTypes.chart' },
]

export type ExportFormat = 'csv' | 'excel' | 'xml'

interface MapToolbarProps {
  onRun: () => void
  onSave: () => void
  onExport: (format: ExportFormat) => void
  isRunning: boolean
  isSaving: boolean
  isExporting?: boolean
}

export function MapToolbar({
  onRun,
  onSave,
  onExport,
  isRunning,
  isSaving,
  isExporting,
}: MapToolbarProps) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const { toast } = useToast()
  const name = useMapBuilderStore((s) => s.name)
  const mapType = useMapBuilderStore((s) => s.mapType)
  const mapId = useMapBuilderStore((s) => s.mapId)
  const isPublic = useMapBuilderStore((s) => s.isPublic)
  const isDirty = useMapBuilderStore((s) => s.isDirty)
  const setName = useMapBuilderStore((s) => s.setName)
  const setMapType = useMapBuilderStore((s) => s.setMapType)
  const [shareOpen, setShareOpen] = useState(false)

  function comingSoon(feature: string) {
    toast({
      title: t('mapBuilder:toolbar.comingSoonTitle', { feature }),
      description: t('mapBuilder:toolbar.comingSoonDescription', { feature }),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label={t('mapBuilder:toolbar.mapNameAria')}
        className="h-9 w-56 border-transparent text-base font-semibold hover:border-input focus-visible:border-input"
      />

      <Select value={mapType} onValueChange={(v) => setMapType(v as MapType)}>
        <SelectTrigger className="h-9 w-[150px]" aria-label={t('mapBuilder:toolbar.mapTypeAria')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAP_TYPES.map((mt) => (
            <SelectItem key={mt.value} value={mt.value}>
              {t(mt.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isDirty && (
        <span className="text-xs text-muted-foreground" title={t('mapBuilder:toolbar.unsavedTitle')}>
          {t('mapBuilder:toolbar.unsavedLabel')}
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={onRun} disabled={isRunning}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {t('common:actions.run')}
        </Button>

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('common:actions.save')}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('common:actions.export')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('mapBuilder:toolbar.exportDataHeader')}</DropdownMenuLabel>
            <DropdownMenuItem disabled={!mapId || isExporting} onSelect={() => onExport('excel')}>
              {t('mapBuilder:toolbar.exportExcel')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!mapId || isExporting} onSelect={() => onExport('csv')}>
              {t('mapBuilder:toolbar.exportCsv')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!mapId} onSelect={() => onExport('xml')}>
              {t('mapBuilder:toolbar.exportXml')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          onClick={() => comingSoon(t('mapBuilder:toolbar.featureScheduling'))}
        >
          <CalendarClock className="h-4 w-4" /> {t('mapBuilder:toolbar.schedule')}
        </Button>

        <Button
          variant="outline"
          disabled={!mapId}
          title={mapId ? undefined : t('mapBuilder:toolbar.shareDisabledTitle')}
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="h-4 w-4" /> {t('mapBuilder:toolbar.share')}
        </Button>
      </div>

      {mapId && (
        <ShareDialog open={shareOpen} onOpenChange={setShareOpen} mapId={mapId} isPublic={isPublic} />
      )}
    </div>
  )
}
