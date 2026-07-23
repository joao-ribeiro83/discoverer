import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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

function buildParametersJsonSchema(t: (key: string) => string) {
  return z.string().superRefine((val, ctx) => {
    if (!val.trim()) return
    try {
      const parsed: unknown = JSON.parse(val)
      if (!Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('admin:customFunctions.validation.parametersMustBeArray') })
        return
      }
      for (const p of parsed as unknown[]) {
        const record = p as Record<string, unknown> | null
        if (typeof record !== 'object' || record === null || !record.name || !record.type) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('admin:customFunctions.validation.parameterNeedsNameAndType') })
          return
        }
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t('admin:customFunctions.validation.invalidJson') })
    }
  })
}

function buildFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
    functionType: z.enum(FUNCTION_TYPES),
    parametersJson: buildParametersJsonSchema(t),
    returnType: z.string().optional(),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

export function CustomFunctionsPage() {
  const { t } = useTranslation(['admin', 'common'])
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
    resolver: standardSchemaResolver(buildFormSchema(t)),
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
      toast({ title: editing ? t('admin:customFunctions.toast.updated') : t('admin:customFunctions.toast.created') })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({
        title: t('admin:shared.saveFailed'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.customFunctions.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-functions'] })
      toast({ title: t('admin:customFunctions.toast.deactivated') })
      setDeleting(null)
    },
  })

  const columns: ColumnDef<CustomFunction>[] = [
    { accessorKey: 'name', header: t('common:labels.name') },
    { accessorKey: 'functionType', header: t('common:labels.type'), cell: ({ row }) => <Badge variant="outline">{row.original.functionType}</Badge> },
    {
      accessorKey: 'parameters',
      header: t('admin:customFunctions.columns.parameters'),
      cell: ({ row }) => row.original.parameters?.length ? t('admin:customFunctions.columns.parametersCount', { count: row.original.parameters.length }) : '—',
    },
    { accessorKey: 'returnType', header: t('admin:customFunctions.columns.returnType'), cell: ({ row }) => row.original.returnType || '—' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)} title={t('common:actions.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)} title={t('common:actions.delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AdminPageWrapper
      title={t('admin:customFunctions.title')}
      description={t('admin:customFunctions.description')}
      action={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> {t('admin:customFunctions.createButton')}
        </Button>
      }
    >
      <DataTable columns={columns} data={functions ?? []} isLoading={isLoading} emptyMessage={t('admin:customFunctions.emptyMessage')} />

      <CreateEditDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? t('admin:customFunctions.dialog.editTitle') : t('admin:customFunctions.dialog.createTitle')}>
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <div className="space-y-2">
            <Label htmlFor="name">{t('common:labels.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{t('common:labels.description')}</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('admin:customFunctions.form.functionTypeLabel')}</Label>
              <Select value={form.watch('functionType')} onValueChange={(v) => form.setValue('functionType', v as FormValues['functionType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUNCTION_TYPES.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {ft}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="returnType">{t('admin:customFunctions.form.returnTypeLabel')}</Label>
              <Input id="returnType" {...form.register('returnType')} placeholder={t('admin:customFunctions.form.returnTypePlaceholder')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parametersJson">{t('admin:customFunctions.form.parametersLabel')}</Label>
            <Textarea id="parametersJson" rows={6} placeholder={t('admin:customFunctions.form.parametersPlaceholder')} {...form.register('parametersJson')} />
            {form.formState.errors.parametersJson && (
              <p className="text-sm text-destructive">{form.formState.errors.parametersJson.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('admin:shared.saving') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel={t('admin:customFunctions.entityLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}
