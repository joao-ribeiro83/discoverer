import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, GripVertical, X } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { Folder, Item, Hierarchy } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface LevelDraft {
  key: string
  levelName: string
  folderId: string
  itemId: string
}

function newDraftKey() {
  return Math.random().toString(36).slice(2)
}

export function HierarchiesPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [businessAreaId, setBusinessAreaId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Hierarchy | null>(null)
  const [deleting, setDeleting] = useState<Hierarchy | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [levels, setLevels] = useState<LevelDraft[]>([])

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
  })

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ['folders', businessAreaId],
    queryFn: async () => (await apiClient.folders.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  const { data: hierarchies, isLoading } = useQuery({
    queryKey: ['hierarchies', businessAreaId],
    queryFn: async () => (await apiClient.hierarchies.listByBusinessArea(businessAreaId)).data.data,
    enabled: !!businessAreaId,
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setLevels([])
    setDialogOpen(true)
  }

  async function openEdit(h: Hierarchy) {
    const full = (await apiClient.hierarchies.get(h.id)).data.data
    setEditing(full)
    setName(full.name)
    setDescription(full.description ?? '')

    const sortedLevels = [...full.levels].sort((a, b) => a.levelNumber - b.levelNumber)
    const itemDetails: Item[] = await Promise.all(
      sortedLevels.map((l) => apiClient.items.get(l.itemId).then((r) => r.data.data))
    )

    setLevels(
      sortedLevels.map((l, i) => ({
        key: newDraftKey(),
        levelName: l.levelName,
        folderId: itemDetails[i]?.folderId ?? '',
        itemId: l.itemId,
      }))
    )
    setDialogOpen(true)
  }

  function addLevel() {
    setLevels((prev) => [...prev, { key: newDraftKey(), levelName: '', folderId: '', itemId: '' }])
  }

  function removeLevel(key: string) {
    setLevels((prev) => prev.filter((l) => l.key !== key))
  }

  function updateLevel(key: string, patch: Partial<LevelDraft>) {
    setLevels((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLevels((prev) => {
      const oldIndex = prev.findIndex((l) => l.key === active.id)
      const newIndex = prev.findIndex((l) => l.key === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || undefined,
        levels: levels.map((l, i) => ({
          levelName: l.levelName,
          itemId: l.itemId,
          levelNumber: i + 1,
        })),
      }

      if (editing) {
        return (await apiClient.hierarchies.update(editing.id, payload)).data.data
      }
      return (await apiClient.hierarchies.create(businessAreaId, payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hierarchies', businessAreaId] })
      toast({ title: editing ? 'Hierarchy updated' : 'Hierarchy created' })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({
        title: 'Save failed',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.hierarchies.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hierarchies', businessAreaId] })
      toast({ title: 'Hierarchy deactivated' })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<Hierarchy>[] = [
    { accessorKey: 'name', header: 'Name' },
    {
      accessorKey: 'levels',
      header: 'Levels',
      cell: ({ row }) => `${row.original.levels?.length ?? 0} level(s)`,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => void openEdit(row.original)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const canSave = name.trim().length > 0 && levels.length > 0 && levels.every((l) => l.levelName.trim() && l.itemId)

  return (
    <AdminPageWrapper
      title="Hierarchies"
      description="Define drill-down hierarchies by ordering items into levels."
      action={
        <Button onClick={openCreate} disabled={!businessAreaId}>
          <Plus className="h-4 w-4" /> New Hierarchy
        </Button>
      }
    >
      <div className="w-72 space-y-2">
        <Label>Business Area</Label>
        <Select value={businessAreaId} onValueChange={setBusinessAreaId}>
          <SelectTrigger aria-label="Business Area">
            <SelectValue placeholder="Select a business area" />
          </SelectTrigger>
          <SelectContent>
            {(businessAreas ?? []).map((ba) => (
              <SelectItem key={ba.id} value={ba.id}>
                {ba.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {businessAreaId ? (
        <DataTable columns={columns} data={hierarchies ?? []} isLoading={isLoading} emptyMessage="No hierarchies in this business area yet." />
      ) : (
        <p className="text-sm text-muted-foreground">Select a business area to view its hierarchies.</p>
      )}

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Hierarchy' : 'New Hierarchy'}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hname">Name</Label>
            <Input id="hname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hdesc">Description</Label>
            <Textarea id="hdesc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Levels (top to bottom)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                <Plus className="h-4 w-4" /> Add Level
              </Button>
            </div>

            {levels.length === 0 && <p className="text-sm text-muted-foreground">No levels yet — add at least one.</p>}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={levels.map((l) => l.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {levels.map((level, index) => (
                    <LevelRow
                      key={level.key}
                      level={level}
                      index={index}
                      folders={folders ?? []}
                      onChange={(patch) => updateLevel(level.key, patch)}
                      onRemove={() => removeLevel(level.key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </CreateEditDialog>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel="hierarchy"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}

function LevelRow({
  level,
  index,
  folders,
  onChange,
  onRemove,
}: {
  level: LevelDraft
  index: number
  folders: Folder[]
  onChange: (patch: Partial<LevelDraft>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: level.key })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const { data: folderItems } = useQuery<Item[]>({
    queryKey: ['items', level.folderId],
    queryFn: async () => (await apiClient.items.listByFolder(level.folderId)).data.data,
    enabled: !!level.folderId,
  })

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border bg-background p-2">
      <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-xs text-muted-foreground">{index + 1}</span>
      <Input
        className="w-40"
        placeholder="Level name"
        value={level.levelName}
        onChange={(e) => onChange({ levelName: e.target.value })}
      />
      <Select value={level.folderId} onValueChange={(v) => onChange({ folderId: v, itemId: '' })}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Folder" />
        </SelectTrigger>
        <SelectContent>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={level.itemId} onValueChange={(v) => onChange({ itemId: v })} disabled={!level.folderId}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Item" />
        </SelectTrigger>
        <SelectContent>
          {(folderItems ?? []).map((it) => (
            <SelectItem key={it.id} value={it.id}>
              {it.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
