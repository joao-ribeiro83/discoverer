import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { PanelRightClose, PanelRightOpen, Loader2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { MapWithDetails, ExecuteResult } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useMapExport } from '@/hooks/useMapExport'
import {
  useMapBuilderStore,
  columnLabel,
  type MapBuilderItemSource,
} from '@/store/mapBuilder'
import { MapToolbar, type ExportFormat } from '@/components/map-builder/MapToolbar'
import { BusinessAreaTree, type TreeItemDragData } from '@/components/map-builder/BusinessAreaTree'
import { MapCanvas, CANVAS_DROPPABLE_ID } from '@/components/map-builder/MapCanvas'
import { ColumnConfigDialog } from '@/components/map-builder/ColumnConfigDialog'
import { RightPanelTabs } from '@/components/map-builder/panels/RightPanelTabs'
import { ExecutionPanel } from '@/components/map-builder/ExecutionPanel'
import { downloadXml } from '@/components/map-builder/export-utils'
import {
  ParameterPromptDialog,
  needsParameterPrompt,
} from '@/components/parameters/ParameterPromptDialog'

/** Discriminated union of what a drag can carry (tree source vs canvas chip). */
type DragData = TreeItemDragData | { type: 'canvas-item' }

export function MapBuilderPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [hydrating, setHydrating] = useState(!isNew)
  const [configKey, setConfigKey] = useState<string | null>(null)
  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [lastParameters, setLastParameters] = useState<Record<string, unknown>>({})
  const [paramPromptOpen, setParamPromptOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(true)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  const mapId = useMapBuilderStore((s) => s.mapId)
  const mapName = useMapBuilderStore((s) => s.name)
  const builderParameters = useMapBuilderStore((s) => s.parameters)
  const exportCtl = useMapExport(mapId, mapName, lastParameters)

  const promptParameters = useMemo(
    () =>
      builderParameters.map((p) => ({
        id: p.key,
        name: p.name,
        paramType: p.paramType,
        defaultValue: p.defaultValue,
        isRequired: p.isRequired,
      })),
    [builderParameters],
  )

  // Tracks which map id is currently loaded into the store so we never re-load
  // (and wipe unsaved edits) on re-render.
  const loadedRef = useRef<string | null>(null)

  // --- hydrate the store from the route -----------------------------------
  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      if (isNew) {
        useMapBuilderStore.getState().clearMap()
        loadedRef.current = 'new'
        setResult(null)
        setHydrating(false)
        return
      }
      if (loadedRef.current === id) return

      setHydrating(true)
      setResult(null)
      try {
        const map = (await apiClient.maps.get(id)).data.data
        // The map's items carry only ids; fetch each source item so chips can
        // show the real name/type without another round trip per render.
        const settled = await Promise.allSettled(
          map.items.map((mi) => apiClient.items.get(mi.itemId)),
        )
        if (cancelled) return

        const sources: Record<string, MapBuilderItemSource> = {}
        map.items.forEach((mi, i) => {
          const res = settled[i]
          if (res.status === 'fulfilled') {
            const it = res.value.data.data
            sources[mi.itemId] = {
              name: it.name,
              itemType: it.itemType,
              dataType: it.dataType,
              folderId: it.folderId,
              folderName: '',
              businessAreaId: map.businessAreaId,
            }
          }
        })

        useMapBuilderStore.getState().loadMap(map, sources)
        loadedRef.current = id
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Could not load map',
            description: getErrorMessage(err),
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [id, isNew, toast])

  // Reset the store when leaving so the next visit hydrates fresh.
  useEffect(() => () => useMapBuilderStore.getState().clearMap(), [])

  const maybeNavigate = useCallback(
    (map: MapWithDetails) => {
      loadedRef.current = map.id
      if (id !== map.id) void navigate(`/maps/${map.id}`, { replace: true })
    },
    [id, navigate],
  )

  // Persist the current store state (create when new, update otherwise).
  const persist = useCallback(async (): Promise<MapWithDetails> => {
    const state = useMapBuilderStore.getState()
    if (state.selectedItems.length === 0) {
      throw new Error('Add at least one column before saving.')
    }
    const input = state.toInput()
    let map: MapWithDetails
    if (state.mapId) {
      map = (await apiClient.maps.update(state.mapId, input)).data.data
    } else {
      if (!state.businessAreaId) throw new Error('No business area selected.')
      map = (await apiClient.maps.create(state.businessAreaId, input)).data.data
    }
    useMapBuilderStore.getState().markSaved(map.id)
    return map
  }, [])

  const saveMutation = useMutation({
    mutationFn: persist,
    onSuccess: (map) => {
      maybeNavigate(map)
      void queryClient.invalidateQueries({ queryKey: ['maps'] })
      toast({ title: 'Map saved' })
    },
    onError: (err) =>
      toast({ title: 'Save failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const runMutation = useMutation({
    mutationFn: async (parameters: Record<string, unknown>): Promise<ExecuteResult> => {
      let state = useMapBuilderStore.getState()
      if (state.selectedItems.length === 0) {
        throw new Error('Add at least one column before running.')
      }
      // Execution needs a persisted, up-to-date map.
      if (!state.mapId || state.isDirty) {
        const map = await persist()
        maybeNavigate(map)
        state = useMapBuilderStore.getState()
      }
      return (await apiClient.maps.execute(state.mapId!, { parameters })).data.data
    },
    onSuccess: (res, parameters) => {
      setResult(res)
      setLastParameters(parameters)
      void queryClient.invalidateQueries({ queryKey: ['maps'] })
      toast({ title: 'Map executed', description: `${res.rowCount} row(s) returned.` })
    },
    onError: (err) =>
      toast({ title: 'Run failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  /** Only prompt when at least one declared parameter lacks a usable default. */
  const triggerRun = useCallback(() => {
    const state = useMapBuilderStore.getState()
    if (state.selectedItems.length === 0) {
      toast({ title: 'Add at least one column before running.' })
      return
    }
    if (needsParameterPrompt(state.parameters)) {
      setParamPromptOpen(true)
      return
    }
    const defaults: Record<string, unknown> = {}
    for (const p of state.parameters) {
      if (p.defaultValue != null && p.defaultValue !== '') defaults[p.name] = p.defaultValue
    }
    runMutation.mutate(defaults)
  }, [runMutation, toast])

  const handleParamPromptSubmit = useCallback(
    (values: Record<string, unknown>) => {
      setParamPromptOpen(false)
      runMutation.mutate(values)
    },
    [runMutation],
  )

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const state = useMapBuilderStore.getState()
      if (!state.mapId) {
        toast({ title: 'Save the map first', description: 'Export needs a saved map.' })
        return
      }
      if (format === 'xml') {
        try {
          const xml = (await apiClient.maps.exportXml(state.mapId)).data
          downloadXml(xml, state.name)
        } catch (err) {
          toast({ title: 'Export failed', description: getErrorMessage(err), variant: 'destructive' })
        }
        return
      }
      exportCtl.exportFormat(format === 'csv' ? 'CSV' : 'XLSX')
    },
    [exportCtl, toast],
  )

  // --- drag and drop -------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragData | undefined
    if (data?.type === 'tree-item') {
      setActiveLabel(data.source.name)
    } else if (data?.type === 'canvas-item') {
      const found = useMapBuilderStore
        .getState()
        .selectedItems.find((i) => i.key === event.active.id)
      setActiveLabel(found ? columnLabel(found) : null)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLabel(null)
    if (!over) return

    const activeData = active.data.current as DragData | undefined
    const overIsCanvasItem =
      (over.data.current as DragData | undefined)?.type === 'canvas-item'

    if (activeData?.type === 'tree-item') {
      const overCanvas = over.id === CANVAS_DROPPABLE_ID || overIsCanvasItem
      if (!overCanvas) return
      const outcome = useMapBuilderStore.getState().addItem({
        itemId: activeData.itemId,
        source: activeData.source,
        defaultAggFunction: activeData.defaultAggFunction,
        defaultFormatMask: activeData.defaultFormatMask,
      })
      if (!outcome.ok) {
        toast(
          outcome.reason === 'duplicate'
            ? { title: 'Already added', description: `"${activeData.source.name}" is already on the canvas.` }
            : {
                title: 'Different business area',
                description: 'All columns in a map must come from the same business area.',
                variant: 'destructive',
              },
        )
      }
    } else if (activeData?.type === 'canvas-item') {
      if (active.id !== over.id && overIsCanvasItem) {
        useMapBuilderStore.getState().reorderItems(String(active.id), String(over.id))
      }
    }
  }

  if (hydrating) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading map…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background">
      <MapToolbar
        onRun={triggerRun}
        onSave={() => saveMutation.mutate()}
        onExport={(f) => void handleExport(f)}
        isRunning={runMutation.isPending}
        isSaving={saveMutation.isPending}
        isExporting={exportCtl.isExporting}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 overflow-x-auto">
          <aside className="w-[250px] shrink-0 border-r">
            <BusinessAreaTree />
          </aside>

          <div className="flex min-w-[360px] flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <MapCanvas onConfigure={setConfigKey} />
            </div>
            {(result || runMutation.isPending || runMutation.isError) && (
              <div className="h-64 shrink-0 border-t">
                <ExecutionPanel
                  mapId={mapId}
                  mapName={mapName}
                  result={result}
                  parameters={lastParameters}
                  isRunning={runMutation.isPending}
                  runError={runMutation.error}
                  onResultChange={setResult}
                  onClose={() => setResult(null)}
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 border-l">
            {rightOpen && (
              <aside className="w-[300px]">
                <RightPanelTabs />
              </aside>
            )}
            <button
              type="button"
              onClick={() => setRightOpen((v) => !v)}
              className={cn(
                'flex w-8 items-start justify-center py-3 text-muted-foreground hover:bg-accent hover:text-foreground',
                rightOpen && 'border-l',
              )}
              aria-label={rightOpen ? 'Collapse panel' : 'Expand panel'}
              title={rightOpen ? 'Collapse panel' : 'Expand panel'}
            >
              {rightOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeLabel ? (
            <div className="rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-lg">
              {activeLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ColumnConfigDialog
        columnKey={configKey}
        open={configKey !== null}
        onOpenChange={(open) => !open && setConfigKey(null)}
      />

      <ParameterPromptDialog
        parameters={promptParameters}
        open={paramPromptOpen}
        onOpenChange={setParamPromptOpen}
        onSubmit={handleParamPromptSubmit}
      />
    </div>
  )
}
