import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { CustomFunction } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const FUNCTION_TYPES = ['SQL', 'PLSQL', 'PACKAGE'] as const

const parametersJsonSchema = z.string().superRefine((val, ctx) => {
  if (!val.trim()) return
  try {
    const parsed: unknown = JSON.parse(val)
    if (!Array.isArray(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Parameters must be a JSON array' })
      return
    }
    for (const p of parsed as unknown[]) {
      const record = p as Record<string, unknown> | null
      if (typeof record !== 'object' || record === null || !record.name || !record.type) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each parameter needs a "name" and "type"' })
        return
      }
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON' })
  }
})

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  functionType: z.enum(FUNCTION_TYPES),
  parametersJson: parametersJsonSchema,
  returnType: z.string().optional(),
})
type FormValues = z.infer<typeof formSchema>

const PARAM_PLACEHOLDER = `[
  { "name": "p_id", "type": "NUMBER", "required": true }
]`

export function CustomFunctionsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFunction | null>(null)
  const [deleting, setDeleting] = useState<CustomFunction | null>(null)

  const { data: functions, isLoading } = useQuery({
    queryKey: ['custom-functions'],
    queryFn: async () => (await apiClient.customFunctions.list()).data.data,
  })

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { name: '', description: '', functionType: 'SQL', parametersJson: '', returnType: '' },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', description: '', functionType: 'SQL', parametersJson: '', returnType: '' })
    setDialogOpen(true)
  }

  function openEdit(fn: CustomFunction) {
    setEditing(fn)
    form.reset({
      name: fn.name,
      description: fn.description ?? '',
      functionType: fn.functionType,
      parametersJson: fn.parameters ? JSON.stringify(fn.parameters, null, 2) : '',
      returnType: fn.returnType ?? '',
    })
    setDialogOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        functionType: values.functionType,
        returnType: values.returnType || undefined,
        parameters: values.parametersJson.trim() ? JSON.parse(values.parametersJson) : undefined,
      }

      if (editing) {
        return (await apiClient.customFunctions.update(editing.id, payload)).data.data
      }
      return (await apiClient.customFunctions.create(payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-functions'] })
      toast({ title: editing ? 'Function updated' : 'Function created' })
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
    mutationFn: async (id: string) => apiClient.customFunctions.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-functions'] })
      toast({ title: 'Function deactivated' })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<CustomFunction>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'functionType', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.functionType}</Badge> },
    {
      accessorKey: 'parameters',
      header: 'Parameters',
      cell: ({ row }) => row.original.parameters?.length ? `${row.original.parameters.length} param(s)` : '—',
    },
    { accessorKey: 'returnType', header: 'Return Type', cell: ({ row }) => row.original.returnType || '—' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AdminPageWrapper
      title="Custom Functions"
      description="Register custom SQL, PL/SQL, and package functions available to calculated items."
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Function
        </Button>
      }
    >
      <DataTable columns={columns} data={functions ?? []} isLoading={isLoading} emptyMessage="No custom functions yet." />

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Custom Function' : 'New Custom Function'}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Function Type</Label>
              <Select value={form.watch('functionType')} onValueChange={(v) => form.setValue('functionType', v as FormValues['functionType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNCTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="returnType">Return Type</Label>
              <Input id="returnType" {...form.register('returnType')} placeholder="e.g. NUMBER" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parametersJson">Parameters (JSON)</Label>
            <Textarea id="parametersJson" rows={6} placeholder={PARAM_PLACEHOLDER} {...form.register('parametersJson')} />
            {form.formState.errors.parametersJson && (
              <p className="text-sm text-destructive">{form.formState.errors.parametersJson.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel="custom function"
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
