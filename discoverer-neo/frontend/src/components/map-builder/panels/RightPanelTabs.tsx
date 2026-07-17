import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMapBuilderStore } from '@/store/mapBuilder'
import { ConditionsPanel } from './ConditionsPanel'
import { SortPanel } from './SortPanel'
import { ParametersPanel } from './ParametersPanel'
import { CalculatedFieldsPanel } from './CalculatedFieldsPanel'

export function RightPanelTabs() {
  const description = useMapBuilderStore((s) => s.description)
  const isPublic = useMapBuilderStore((s) => s.isPublic)
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const conditions = useMapBuilderStore((s) => s.conditions)
  const parameters = useMapBuilderStore((s) => s.parameters)
  const calculatedFields = useMapBuilderStore((s) => s.calculatedFields)
  const setDescription = useMapBuilderStore((s) => s.setDescription)
  const setIsPublic = useMapBuilderStore((s) => s.setIsPublic)

  const sortedCount = selectedItems.filter((i) => i.sortDirection !== null).length

  return (
    <Tabs defaultValue="properties" className="flex h-full flex-col">
      <div className="overflow-x-auto border-b p-2">
        <TabsList className="w-max">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="conditions">
            Conditions{conditions.length > 0 ? ` (${conditions.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="sort">Sort{sortedCount > 0 ? ` (${sortedCount})` : ''}</TabsTrigger>
          <TabsTrigger value="parameters">
            Parameters{parameters.length > 0 ? ` (${parameters.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="calc">
            Calculated Fields{calculatedFields.length > 0 ? ` (${calculatedFields.length})` : ''}
          </TabsTrigger>
        </TabsList>
      </div>

      <ScrollArea className="flex-1">
        <TabsContent value="properties" className="mt-0 space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="map-description">Description</Label>
            <Textarea
              id="map-description"
              rows={3}
              value={description ?? ''}
              onChange={(e) => setDescription(e.target.value || null)}
              placeholder="Describe what this map reports on…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="map-public"
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(v === true)}
            />
            <Label htmlFor="map-public" className="cursor-pointer">
              Public (visible to everyone in the business area)
            </Label>
          </div>
          <dl className="space-y-1 rounded-md border p-3 text-sm">
            <SummaryRow label="Columns" value={selectedItems.length} />
            <SummaryRow label="Conditions" value={conditions.length} />
            <SummaryRow label="Parameters" value={parameters.length} />
            <SummaryRow label="Calculated fields" value={calculatedFields.length} />
          </dl>
        </TabsContent>

        <TabsContent value="conditions" className="mt-0">
          <ConditionsPanel />
        </TabsContent>

        <TabsContent value="sort" className="mt-0">
          <SortPanel />
        </TabsContent>

        <TabsContent value="parameters" className="mt-0">
          <ParametersPanel />
        </TabsContent>

        <TabsContent value="calc" className="mt-0">
          <CalculatedFieldsPanel />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
