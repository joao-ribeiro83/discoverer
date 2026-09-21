import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type { CustomFunction, DatabaseFunction } from '@/lib/types'
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

/** Same rule the backend and the SQL renderer enforce on every name part. */
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_$#]*$/

/** `OWNER.PACKAGE.NAME@LINK` — what SQL actually calls. */
function functionReference(fn: Pick<CustomFunction, 'extOwner' | 'extPackage' | 'extName' | 'extDbLink'>): string | null {
  if (!fn.extName) return null
  const parts = [fn.extOwner, fn.extPackage, fn.extName].filter(Boolean).join('.')
  return fn.extDbLink ? `${parts}@${fn.extDbLink}` : parts
}

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
  const identifier = z
    .string()
    .max(128)
    .refine((v) => !v || IDENTIFIER.test(v), t('admin:customFunctions.validation.invalidIdentifier'))
  return z.object({
    name: z.string().min(1, t('admin:shared.validation.nameRequired')).max(255),
    description: z.string().optional(),
    functionType: z.enum(FUNCTION_TYPES),
    parametersJson: buildParametersJsonSchema(t),
    returnType: z.string().optional(),
    dataSourceId: z.string(),
    extOwner: identifier,
    extPackage: identifier,
    extName: identifier,
    extDbLink: z
      .string()
      .max(128)
      .refine((v) => !v || v.split('.').every((p) => IDENTIFIER.test(p)), t('admin:customFunctions.validation.invalidIdentifier')),
  })
}
type FormValues = z.infer<ReturnType<typeof buildFormSchema>>

const EMPTY_FORM: FormValues = {
  name: '',
  description: '',
  functionType: 'PLSQL',
  parametersJson: '',
  returnType: '',
  dataSourceId: '',
  extOwner: '',
  extPackage: '',
  extName: '',
  extDbLink: '',
}

export function CustomFunctionsPage() {
  const { t } = useTranslation(['admin', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFunction | null>(null)
  const [deleting, setDeleting] = useState<CustomFunction | null>(null)
  const [filter, setFilter] = useState('')

  const { data: functions, isLoading } = useQuery({
    queryKey: ['custom-functions'],
    queryFn: async () => (await apiClient.customFunctions.list()).data.data,
  })

  const { data: dataSources } = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => (await apiClient.dataSources.list()).data.data,
  })
  const dataSourceName = useMemo(
    () => new Map((dataSources ?? []).map((ds) => [ds.id, ds.name])),
    [dataSources],
  )

  const visibleFunctions = useMemo(() => {
    const needle = filter.trim().toUpperCase()
    if (!needle) return functions ?? []
    return (functions ?? []).filter(
      (fn) => fn.name.toUpperCase().includes(needle) || (functionReference(fn) ?? '').toUpperCase().includes(needle),
    )
  }, [functions, filter])

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildFormSchema(t)),
    defaultValues: EMPTY_FORM,
  })

  function openCreate() {
    setEditing(null)
    form.reset({ ...EMPTY_FORM, dataSourceId: dataSources?.length === 1 ? dataSources[0].id : '' })
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
      dataSourceId: fn.dataSourceId ?? '',
      extOwner: fn.extOwner ?? '',
      extPackage: fn.extPackage ?? '',
      extName: fn.extName ?? '',
      extDbLink: fn.extDbLink ?? '',
    })
    setDialogOpen(true)
  }

  /** Fill the form from a function found in the database. */
  function applyDatabaseFunction(dbFn: DatabaseFunction) {
    const opts = { shouldDirty: true, shouldValidate: true }
    if (!form.getValues('name')) form.setValue('name', dbFn.name, opts)
    form.setValue('functionType', dbFn.packageName ? 'PACKAGE' : 'PLSQL', opts)
    form.setValue('extOwner', dbFn.owner, opts)
    form.setValue('extPackage', dbFn.packageName ?? '', opts)
    form.setValue('extName', dbFn.name, opts)
    form.setValue('extDbLink', '', opts)
    form.setValue('returnType', dbFn.returnType, opts)
    form.setValue('parametersJson', JSON.stringify(dbFn.parameters, null, 2), opts)
  }

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        description: values.description || undefined,
        functionType: values.functionType,
        returnType: values.returnType || undefined,
        parameters: values.parametersJson.trim() ? JSON.parse(values.parametersJson) : undefined,
        dataSourceId: values.dataSourceId || null,
        extOwner: values.extOwner.toUpperCase() || null,
        extPackage: values.extPackage.toUpperCase() || null,
        extName: values.extName.toUpperCase() || null,
        extDbLink: values.extDbLink.toUpperCase() || null,
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
      id: 'reference',
      header: t('admin:customFunctions.columns.databaseFunction'),
      cell: ({ row }) => {
        const ref = functionReference(row.original)
        return ref ? <code className="text-xs">{ref}</code> : <span className="text-muted-foreground">{t('admin:customFunctions.columns.noReference')}</span>
      },
    },
    {
      id: 'dataSource',
      header: t('admin:customFunctions.columns.dataSource'),
      cell: ({ row }) => (row.original.dataSourceId ? dataSourceName.get(row.original.dataSourceId) ?? '—' : '—'),
    },
    {
      accessorKey: 'parameters',
      header: t('admin:customFunctions.columns.parameters'),
      cell: ({ row }) => {
        const params = row.original.parameters
        if (!params?.length) return '—'
        return (
          <span title={params.map((p) => `${p.name} ${p.type}${p.required === false ? '?' : ''}`).join(', ')}>
            {t('admin:customFunctions.columns.parametersCount', { count: params.length })}
          </span>
        )
      },
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

  const selectedDataSourceId = form.watch('dataSourceId')
  const selectedDataSource = dataSources?.find((ds) => ds.id === selectedDataSourceId)

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
      <div className="mb-4 max-w-sm">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('admin:customFunctions.filterPlaceholder')}
          aria-label={t('admin:customFunctions.filterPlaceholder')}
        />
      </div>
      <DataTable columns={columns} data={visibleFunctions} isLoading={isLoading} emptyMessage={t('admin:customFunctions.emptyMessage')} />

      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('admin:customFunctions.dialog.editTitle') : t('admin:customFunctions.dialog.createTitle')}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        <form className="space-y-4" onSubmit={(e) => void form.handleSubmit((values) => saveMutation.mutate(values))(e)}>
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">{t('admin:customFunctions.form.databaseFunctionLegend')}</legend>
            <div className="space-y-2">
              <Label>{t('admin:customFunctions.form.dataSourceLabel')}</Label>
              <Select value={selectedDataSourceId} onValueChange={(v) => form.setValue('dataSourceId', v, { shouldDirty: true })}>
                <SelectTrigger aria-label={t('admin:customFunctions.form.dataSourceLabel')}>
                  <SelectValue placeholder={t('admin:customFunctions.form.dataSourcePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(dataSources ?? []).map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDataSource?.connectionType === 'oracle' && (
              <DatabaseFunctionSearch
                key={selectedDataSource.id}
                dataSourceId={selectedDataSource.id}
                defaultOwner={selectedDataSource.username ?? ''}
                onPick={applyDatabaseFunction}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {(['extOwner', 'extPackage', 'extName', 'extDbLink'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={field}>{t(`admin:customFunctions.form.${field}Label`)}</Label>
                  <Input id={field} className="font-mono" {...form.register(field)} />
                  {form.formState.errors[field] && (
                    <p className="text-sm text-destructive">{form.formState.errors[field]?.message}</p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>

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
            <Textarea id="parametersJson" rows={6} className="font-mono text-xs" placeholder={t('admin:customFunctions.form.parametersPlaceholder')} {...form.register('parametersJson')} />
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

/** Search a data source's database for a function and hand the pick back. */
function DatabaseFunctionSearch({
  dataSourceId,
  defaultOwner,
  onPick,
}: {
  dataSourceId: string
  defaultOwner: string
  onPick: (fn: DatabaseFunction) => void
}) {
  const { t } = useTranslation(['admin'])
  const [owner, setOwner] = useState(defaultOwner.toUpperCase())
  const [search, setSearch] = useState('')

  const results = useQuery({
    queryKey: ['data-sources', dataSourceId, 'functions', owner, search],
    queryFn: async () => (await apiClient.customFunctions.searchDatabase(dataSourceId, { owner, search })).data.data,
    enabled: false,
  })

  function runSearch() {
    void results.refetch()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="w-40 space-y-1">
          <Label htmlFor="fn-owner">{t('admin:customFunctions.search.ownerLabel')}</Label>
          <Input id="fn-owner" className="font-mono" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="fn-search">{t('admin:customFunctions.search.searchLabel')}</Label>
          <Input
            id="fn-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                runSearch()
              }
            }}
            placeholder={t('admin:customFunctions.search.searchPlaceholder')}
          />
        </div>
        <Button type="button" onClick={runSearch} disabled={results.isFetching}>
          <Search className="h-4 w-4" /> {t('admin:customFunctions.search.button')}
        </Button>
      </div>

      {results.isError && <p className="text-sm text-destructive">{getErrorMessage(results.error)}</p>}
      {results.data && (
        <div className="max-h-[45vh] overflow-y-auto rounded-md border">
          {results.data.functions.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t('admin:customFunctions.search.noResults')}</p>
          ) : (
            <ul className="divide-y">
              {results.data.functions.map((fn) => (
                <li key={`${fn.packageName ?? ''}.${fn.name}.${fn.overload ?? ''}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!fn.callableFromSql}
                    onClick={() => onPick(fn)}
                    title={fn.reason ?? undefined}
                  >
                    <code className="text-xs">
                      {[fn.packageName, fn.name].filter(Boolean).join('.')}(
                      {fn.parameters.map((p) => `${p.name} ${p.type}${p.required === false ? '?' : ''}`).join(', ')}) → {fn.returnType}
                    </code>
                    {fn.overload && <Badge variant="outline" className="ml-2">#{fn.overload}</Badge>}
                    {!fn.callableFromSql && (
                      <span className="block text-xs text-muted-foreground">
                        {t('admin:customFunctions.search.notCallable', { reason: fn.reason })}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.data.truncated && (
            <p className="border-t p-2 text-xs text-muted-foreground">{t('admin:customFunctions.search.truncated')}</p>
          )}
        </div>
      )}
    </div>
  )
}
