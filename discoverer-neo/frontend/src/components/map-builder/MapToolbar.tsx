import { useState } from 'react'
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

const MAP_TYPES: { value: MapType; label: string }[] = [
  { value: 'TABLE', label: 'Table' },
  { value: 'CROSSTAB', label: 'Crosstab' },
  { value: 'PAGE_DETAIL', label: 'Page-Detail' },
  { value: 'CHART', label: 'Chart' },
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
      title: `${feature} coming soon`,
      description: `${feature} will be available in a later session.`,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Map name"
        className="h-9 w-56 border-transparent text-base font-semibold hover:border-input focus-visible:border-input"
      />

      <Select value={mapType} onValueChange={(v) => setMapType(v as MapType)}>
        <SelectTrigger className="h-9 w-[150px]" aria-label="Map type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAP_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isDirty && (
        <span className="text-xs text-muted-foreground" title="Unsaved changes">
          ● Unsaved
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={onRun} disabled={isRunning}>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run
        </Button>

        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Data (re-runs the query on the server)</DropdownMenuLabel>
            <DropdownMenuItem disabled={!mapId || isExporting} onSelect={() => onExport('excel')}>
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!mapId || isExporting} onSelect={() => onExport('csv')}>
              CSV (.csv)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!mapId} onSelect={() => onExport('xml')}>
              Map definition (.xml)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" onClick={() => comingSoon('Scheduling')}>
          <CalendarClock className="h-4 w-4" /> Schedule
        </Button>

        <Button
          variant="outline"
          disabled={!mapId}
          title={mapId ? undefined : 'Save the map before sharing it'}
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </div>

      {mapId && (
        <ShareDialog open={shareOpen} onOpenChange={setShareOpen} mapId={mapId} isPublic={isPublic} />
      )}
    </div>
  )
}
