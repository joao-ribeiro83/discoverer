import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  FlaskConical,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import type {
  BusinessArea,
  Folder,
  PolicyTargetType,
  SecurityPolicy,
  SecurityPolicyAssignment,
  SecurityPolicyRuleInput,
} from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/auth'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { DataTable } from '@/components/admin/DataTable'
import { CreateEditDialog } from '@/components/admin/CreateEditDialog'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLES = ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] as const

let ruleKeyCounter = 0
const nextRuleKey = () => `rule-${++ruleKeyCounter}`

interface RuleDraft {
  key: string
  targetType: PolicyTargetType
  /** UI-only: scopes the folder picker; equals targetId for BA rules. */
  businessAreaId: string
  targetId: string
  sqlPredicate: string
  validation?: { valid: boolean; error?: string }
}

function emptyRule(): RuleDraft {
  return {
    key: nextRuleKey(),
    targetType: 'BUSINESS_AREA',
    businessAreaId: '',
    targetId: '',
    sqlPredicate: '',
  }
}

/** Per-rule editor row: target picker + predicate editor with validation. */
function RuleEditor({
  rule,
  businessAreas,
  onChange,
  onRemove,
}: {
  rule: RuleDraft
  businessAreas: BusinessArea[]
  onChange: (patch: Partial<RuleDraft>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation(['security', 'common'])

  const { data: folders } = useQuery({
    queryKey: ['folders', rule.businessAreaId],
    queryFn: async () =>
      (await apiClient.folders.listByBusinessArea(rule.businessAreaId)).data.data,
    enabled: rule.targetType === 'FOLDER' && !!rule.businessAreaId,
  })

  const validateMutation = useMutation({
    mutationFn: async (predicate: string) =>
      (
        await apiClient.security.test({
          sql: 'SELECT * FROM SAMPLE_TABLE',
          predicates: [predicate],
        })
      ).data.data,
    onSuccess: () => onChange({ validation: { valid: true } }),
    onError: (err) =>
      onChange({ validation: { valid: false, error: getErrorMessage(err) } }),
  })

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('security:rule.appliesTo')}</Label>
          <Select
            value={rule.targetType}
            onValueChange={(v) =>
              onChange({
                targetType: v as PolicyTargetType,
                targetId: v === 'BUSINESS_AREA' ? rule.businessAreaId : '',
              })
            }
          >
            <SelectTrigger className="w-40" aria-label={t('security:rule.targetTypeAriaLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUSINESS_AREA">{t('security:rule.businessArea')}</SelectItem>
              <SelectItem value="FOLDER">{t('security:rule.folder')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('security:rule.businessAreaLabel')}</Label>
          <Select
            value={rule.businessAreaId}
            onValueChange={(v) =>
              onChange({
                businessAreaId: v,
                targetId: rule.targetType === 'BUSINESS_AREA' ? v : '',
              })
            }
          >
            <SelectTrigger className="w-52" aria-label={t('security:rule.businessAreaAriaLabel')}>
              <SelectValue placeholder={t('security:rule.selectBusinessArea')} />
            </SelectTrigger>
            <SelectContent>
              {businessAreas.map((ba) => (
                <SelectItem key={ba.id} value={ba.id}>
                  {ba.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rule.targetType === 'FOLDER' && (
          <div className="space-y-1">
            <Label className="text-xs">{t('security:rule.folderLabel')}</Label>
            <Select
              value={rule.targetId}
              onValueChange={(v) => onChange({ targetId: v })}
              disabled={!rule.businessAreaId}
            >
              <SelectTrigger className="w-52" aria-label={t('security:rule.folderAriaLabel')}>
                <SelectValue placeholder={t('security:rule.selectFolder')} />
              </SelectTrigger>
              <SelectContent>
                {(folders ?? []).map((f: Folder) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={onRemove}
          title={t('security:rule.removeRule')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('security:rule.predicateLabel')}</Label>
        <Textarea
          value={rule.sqlPredicate}
          onChange={(e) =>
            onChange({ sqlPredicate: e.target.value, validation: undefined })
          }
          placeholder={
            rule.targetType === 'FOLDER'
              ? `{alias}."REGION" = 'EMEA'  or  {alias}."REP_ID" = :current_user_id`
              : `REGION = 'EMEA'  or  CREATED_BY = :current_user_id`
          }
          rows={2}
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!rule.sqlPredicate.trim() || validateMutation.isPending}
            onClick={() => validateMutation.mutate(rule.sqlPredicate)}
          >
            {validateMutation.isPending ? t('security:rule.validating') : t('common:actions.validate')}
          </Button>
          {rule.validation?.valid && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('security:rule.validPredicate')}
            </span>
          )}
          {rule.validation && !rule.validation.valid && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3.5 w-3.5" /> {rule.validation.error}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('security:rule.bindsLabel')} <code>:current_user_id</code>, <code>:current_user_email</code>,{' '}
          <code>:current_user_role</code>
          {rule.targetType === 'FOLDER' && (
            <>
              {' '}
              — <code>{'{alias}'}</code> {t('security:rule.aliasResolves')}
            </>
          )}
        </p>
      </div>
    </div>
  )
}

export function SecurityPage() {
  const { t } = useTranslation(['security', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SecurityPolicy | null>(null)
  const [deleting, setDeleting] = useState<SecurityPolicy | null>(null)
  const [assigningPolicy, setAssigningPolicy] = useState<SecurityPolicy | null>(null)
  const [testOpen, setTestOpen] = useState(false)

  // Policy form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule()])

  const { data: policies, isLoading } = useQuery({
    queryKey: ['security-policies'],
    queryFn: async () => (await apiClient.security.listPolicies()).data.data,
    enabled: isAdmin,
  })

  const { data: businessAreas } = useQuery({
    queryKey: ['business-areas'],
    queryFn: async () => (await apiClient.businessAreas.list()).data.data,
    enabled: isAdmin,
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setIsActive(true)
    setRules([emptyRule()])
    setDialogOpen(true)
  }

  const openEditMutation = useMutation({
    mutationFn: async (policy: SecurityPolicy) =>
      (await apiClient.security.getPolicy(policy.id)).data.data,
    onSuccess: (full) => {
      setEditing(full)
      setName(full.name)
      setDescription(full.description ?? '')
      setIsActive(full.isActive)
      setRules(
        (full.rules ?? []).map((r) => ({
          key: nextRuleKey(),
          targetType: r.targetType,
          // For folder rules the owning BA is unknown until folders load;
          // leave the scope empty — targetId is what actually matters.
          businessAreaId: r.targetType === 'BUSINESS_AREA' ? r.targetId : '',
          targetId: r.targetId,
          sqlPredicate: r.sqlPredicate,
        })),
      )
      setDialogOpen(true)
    },
    onError: (err) => {
      toast({ title: t('security:toasts.loadPolicyFailed'), description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rulesPayload: SecurityPolicyRuleInput[] = rules.map((r) => ({
        targetId: r.targetId,
        targetType: r.targetType,
        sqlPredicate: r.sqlPredicate.trim(),
      }))
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        rules: rulesPayload,
      }
      if (editing) {
        return (await apiClient.security.updatePolicy(editing.id, payload)).data.data
      }
      return (await apiClient.security.createPolicy(payload)).data.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security-policies'] })
      toast({ title: editing ? t('security:toasts.policyUpdated') : t('security:toasts.policyCreated') })
      setDialogOpen(false)
    },
    onError: (err) => {
      toast({ title: t('security:toasts.saveFailed'), description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.security.deletePolicy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['security-policies'] })
      toast({ title: t('security:toasts.policyDeleted') })
      setDeleting(null)
    },
    onError: (err) => {
      toast({ title: t('security:toasts.deleteFailed'), description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const canSave =
    name.trim().length > 0 &&
    rules.length > 0 &&
    rules.every((r) => r.targetId && r.sqlPredicate.trim())

  const columns: ColumnDef<SecurityPolicy>[] = [
      { accessorKey: 'name', header: t('common:labels.name') },
      {
        accessorKey: 'description',
        header: t('common:labels.description'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.description ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('common:labels.status'),
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge>{t('common:labels.active')}</Badge>
          ) : (
            <Badge variant="outline">{t('common:labels.inactive')}</Badge>
          ),
      },
      {
        accessorKey: 'ruleCount',
        header: t('security:table.rules'),
        cell: ({ row }) => row.original.ruleCount ?? 0,
      },
      {
        accessorKey: 'assignmentCount',
        header: t('security:table.assignments'),
        cell: ({ row }) => row.original.assignmentCount ?? 0,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAssigningPolicy(row.original)}
              title={t('security:table.assignments')}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditMutation.mutate(row.original)}
              title={t('common:actions.edit')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleting(row.original)}
              title={t('common:actions.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ]

  if (!isAdmin) {
    return (
      <AdminPageWrapper
        title={t('security:page.title')}
        description={t('security:page.nonAdminDescription')}
      >
        <p className="text-sm text-muted-foreground">
          {t('security:page.nonAdminMessage')}
        </p>
      </AdminPageWrapper>
    )
  }

  return (
    <AdminPageWrapper
      title={t('security:page.title')}
      description={t('security:page.description')}
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTestOpen(true)}>
            <FlaskConical className="h-4 w-4" /> {t('common:actions.test')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('security:page.newPolicy')}
          </Button>
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={policies ?? []}
        isLoading={isLoading}
        emptyMessage={t('security:page.emptyMessage')}
      />

      {/* Create / edit */}
      <CreateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t('security:dialog.editTitle') : t('security:dialog.newTitle')}
        description={t('security:dialog.description')}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="policy-name">{t('common:labels.name')}</Label>
            <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-description">{t('common:labels.description')}</Label>
            <Textarea
              id="policy-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="policy-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="policy-active">{t('common:labels.active')}</Label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('security:dialog.rulesLabel')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRules((prev) => [...prev, emptyRule()])}
              >
                <Plus className="h-3.5 w-3.5" /> {t('security:dialog.addRule')}
              </Button>
            </div>
            <div className="space-y-3">
              {rules.map((rule) => (
                <RuleEditor
                  key={rule.key}
                  rule={rule}
                  businessAreas={businessAreas ?? []}
                  onChange={(patch) =>
                    setRules((prev) =>
                      prev.map((r) => (r.key === rule.key ? { ...r, ...patch } : r)),
                    )
                  }
                  onRemove={() =>
                    setRules((prev) => prev.filter((r) => r.key !== rule.key))
                  }
                />
              ))}
              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('security:dialog.minRuleNotice')}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!canSave || saveMutation.isPending}>
              {saveMutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </CreateEditDialog>

      {assigningPolicy && (
        <AssignmentsDialog
          policy={assigningPolicy}
          onClose={() => {
            setAssigningPolicy(null)
            void queryClient.invalidateQueries({ queryKey: ['security-policies'] })
          }}
        />
      )}

      {testOpen && (
        <TestPolicyDialog policies={policies ?? []} onClose={() => setTestOpen(false)} />
      )}

      {deleting && (
        <DeleteConfirmDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={deleting.name}
          itemLabel={t('security:deleteConfirm.itemLabel')}
          onConfirm={() => deleteMutation.mutate(deleting.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </AdminPageWrapper>
  )
}

// ---------------------------------------------------------------------------
// Assignments dialog
// ---------------------------------------------------------------------------

function AssignmentsDialog({
  policy,
  onClose,
}: {
  policy: SecurityPolicy
  onClose: () => void
}) {
  const { t } = useTranslation(['security', 'common'])
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [mode, setMode] = useState<'user' | 'role'>('user')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['security-policy-assignments', policy.id],
    queryFn: async () => (await apiClient.security.listAssignments(policy.id)).data.data,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.users.list()).data.data,
  })

  const assignMutation = useMutation({
    mutationFn: async () =>
      apiClient.security.assign(
        policy.id,
        mode === 'user' ? { userId: selectedUserId } : { roleName: selectedRole },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['security-policy-assignments', policy.id],
      })
      setSelectedUserId('')
      setSelectedRole('')
      toast({ title: t('security:toasts.policyAssigned') })
    },
    onError: (err) => {
      toast({ title: t('security:toasts.assignFailed'), description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: async (assignment: SecurityPolicyAssignment) =>
      apiClient.security.unassign(policy.id, assignment.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['security-policy-assignments', policy.id],
      })
      toast({ title: t('security:toasts.assignmentRemoved') })
    },
    onError: (err) => {
      toast({ title: t('security:toasts.removeFailed'), description: getErrorMessage(err), variant: 'destructive' })
    },
  })

  const canAssign = mode === 'user' ? !!selectedUserId : !!selectedRole

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('security:assignments.title', { name: policy.name })}
      description={t('security:assignments.description')}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('security:assignments.assignTo')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'user' | 'role')}>
              <SelectTrigger className="w-28" aria-label={t('security:assignments.kindAriaLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t('security:assignments.user')}</SelectItem>
                <SelectItem value="role">{t('security:assignments.role')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'user' ? (
            <div className="space-y-1">
              <Label className="text-xs">{t('security:assignments.user')}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-64" aria-label={t('security:assignments.userAriaLabel')}>
                  <SelectValue placeholder={t('security:assignments.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">{t('security:assignments.role')}</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40" aria-label={t('security:assignments.roleAriaLabel')}>
                  <SelectValue placeholder={t('security:assignments.selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            type="button"
            disabled={!canAssign || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            <UserPlus className="h-4 w-4" /> {t('security:assignments.assign')}
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">{t('common:states.loading')}</p>}
          {!isLoading && (assignments ?? []).length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              {t('security:assignments.notAssigned')}
            </p>
          )}
          {(assignments ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              {a.userId ? (
                <span>
                  {a.userName ?? t('security:assignments.unknownUser')}{' '}
                  <span className="text-muted-foreground">({a.userEmail})</span>
                </span>
              ) : (
                <span>
                  {t('security:assignments.roleLabel')} <Badge variant="outline">{a.roleName}</Badge>
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                title={t('security:assignments.removeAssignment')}
                disabled={unassignMutation.isPending}
                onClick={() => unassignMutation.mutate(a)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
        </div>
      </div>
    </CreateEditDialog>
  )
}

// ---------------------------------------------------------------------------
// Test dialog
// ---------------------------------------------------------------------------

function TestPolicyDialog({
  policies,
  onClose,
}: {
  policies: SecurityPolicy[]
  onClose: () => void
}) {
  const { t } = useTranslation(['security', 'common'])
  const [policyId, setPolicyId] = useState('')
  const [sql, setSql] = useState('SELECT * FROM SALES')
  const [error, setError] = useState<string | null>(null)

  const testMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.security.test({ sql, policyId })).data.data,
    onSuccess: () => setError(null),
    onError: (err) => setError(getErrorMessage(err)),
  })

  return (
    <CreateEditDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('security:test.dialogTitle')}
      description={t('security:test.description')}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('security:test.policyLabel')}</Label>
          <Select value={policyId} onValueChange={setPolicyId}>
            <SelectTrigger aria-label={t('security:test.policyAriaLabel')}>
              <SelectValue placeholder={t('security:test.selectPolicy')} />
            </SelectTrigger>
            <SelectContent>
              {policies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-sql">{t('security:test.sampleQueryLabel')}</Label>
          <Textarea
            id="test-sql"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={!policyId || !sql.trim() || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            <FlaskConical className="h-4 w-4" />
            {testMutation.isPending ? t('security:test.testing') : t('security:test.runTest')}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {testMutation.data && !error && (
          <div className="space-y-2">
            <Label>{t('security:test.resultLabel')}</Label>
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs">
              {testMutation.data.securedSql}
            </pre>
          </div>
        )}
      </div>
    </CreateEditDialog>
  )
}
