import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  Info,
  Loader2,
  Play,
  ScanSearch,
  XCircle,
} from 'lucide-react'

import { apiClient, getErrorMessage } from '@/lib/api'
import type {
  AssessmentReport,
  DataSource,
  EulVersionInfo,
  MigrationJob,
  MigrationTable,
} from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** Poll interval while a migration job is running. */
const JOB_POLL_MS = 1000

const TABLE_LABELS: Record<MigrationTable, string> = {
  users: 'Users',
  business_areas: 'Business areas',
  folders: 'Folders',
  items: 'Items',
  joins: 'Joins',
  hierarchies: 'Hierarchies',
  hierarchy_levels: 'Hierarchy levels',
  custom_functions: 'Custom functions',
  maps: 'Maps',
  map_items: 'Map columns',
  user_business_area_grants: 'Grants',
}

const TABLE_ORDER = Object.keys(TABLE_LABELS) as MigrationTable[]

function VersionBadge({ version }: { version: string }) {
  const tone =
    version === 'EUL5'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
      : version === 'EUL4'
        ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  return <span className={`rounded px-2.5 py-1 text-lg font-bold tracking-tight ${tone}`}>{version}</span>
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Migration progress"
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function severityIcon(severity: 'info' | 'warning' | 'error') {
  if (severity === 'error') return <XCircle className="h-4 w-4 shrink-0 text-destructive" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
}

export function MigrationPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [dataSourceId, setDataSourceId] = useState('')
  const [schemaOwner, setSchemaOwner] = useState('')
  const [versionOverride, setVersionOverride] = useState<'auto' | 'EUL4' | 'EUL5'>('auto')
  const [dryRun, setDryRun] = useState(true)
  const [detected, setDetected] = useState<EulVersionInfo | null>(null)
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const logEndRef = useRef<HTMLDivElement | null>(null)

  const dataSourcesQuery = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => (await apiClient.dataSources.list()).data.data,
  })

  // Only Oracle data sources can be a migration source.
  const oracleSources = useMemo(
    () => (dataSourcesQuery.data ?? []).filter((ds: DataSource) => ds.connectionType === 'oracle'),
    [dataSourcesQuery.data],
  )

  const jobQuery = useQuery({
    queryKey: ['migration-job', activeJobId],
    queryFn: async () => (await apiClient.migration.getJob(activeJobId!)).data.data,
    enabled: activeJobId !== null,
    // Keep polling only while the job is still running.
    refetchInterval: (query) => (query.state.data?.status === 'RUNNING' ? JOB_POLL_MS : false),
  })
  const job: MigrationJob | undefined = jobQuery.data

  const detectMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.migration.detectVersion(dataSourceId, schemaOwner || undefined)).data.data,
    onSuccess: (version) => {
      setDetected(version)
      toast({
        title: `Detected ${version.version}`,
        description: `Discoverer ${version.discovererVersion} · schema ${version.schemaVersion}`,
      })
    },
    onError: (err) =>
      toast({ title: 'Detection failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const analyzeMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.migration.analyze(dataSourceId, schemaOwner || undefined)).data.data,
    onSuccess: (result) => {
      setReport(result)
      setDetected(result.version)
      toast({ title: 'Analysis complete', description: `Readiness ${result.readiness.score}/100` })
    },
    onError: (err) =>
      toast({ title: 'Analysis failed', description: getErrorMessage(err), variant: 'destructive' }),
  })

  const runMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.migration.run({
          dataSourceId,
          schemaOwner: schemaOwner || undefined,
          version: versionOverride,
          dryRun,
        })
      ).data.data,
    onSuccess: (started) => {
      setActiveJobId(started.id)
      toast({
        title: dryRun ? 'Dry run started' : 'Migration started',
        description: 'Progress updates below.',
      })
    },
    onError: (err) =>
      toast({ title: 'Could not start', description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Announce the outcome once, when the job leaves RUNNING.
  const lastStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!job || job.status === lastStatusRef.current) return
    if (lastStatusRef.current === 'RUNNING' || lastStatusRef.current === null) {
      if (job.status === 'COMPLETED') {
        toast({
          title: job.dryRun ? 'Dry run complete' : 'Migration complete',
          description: job.dryRun
            ? 'No rows were written.'
            : `Migrated from ${job.detectedVersion ?? 'the source'}.`,
        })
        if (!job.dryRun) void queryClient.invalidateQueries({ queryKey: ['business-areas'] })
      } else if (job.status === 'FAILED') {
        toast({
          title: 'Migration failed',
          description: job.error ?? 'See the log below.',
          variant: 'destructive',
        })
      }
    }
    lastStatusRef.current = job.status
  }, [job, toast, queryClient])

  // Keep the log viewer pinned to the newest line.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [job?.logs.length])

  const isRunning = job?.status === 'RUNNING'
  const busy = detectMutation.isPending || analyzeMutation.isPending || runMutation.isPending
  const canAct = dataSourceId !== '' && !busy && !isRunning

  const result = job?.result ?? null
  const counts = result ? (result.dryRun ? result.planned : result.inserted) : null

  return (
    <AdminPageWrapper
      title="Migration"
      description="Import an Oracle Discoverer End User Layer (EUL) into Discoverer Neo."
    >
      {/* ---------------------------------------------------------------- */}
      {/* Source configuration                                             */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Source</CardTitle>
          <CardDescription>
            Pick a registered Oracle data source. Its stored credentials are used on the server —
            passwords are never sent from this page. The migration always targets this
            Discoverer&nbsp;Neo database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="migration-source">Oracle data source</Label>
              <Select value={dataSourceId} onValueChange={setDataSourceId}>
                <SelectTrigger id="migration-source" aria-label="Oracle data source">
                  <SelectValue placeholder={oracleSources.length ? 'Select a data source' : 'No Oracle data sources'} />
                </SelectTrigger>
                <SelectContent>
                  {oracleSources.map((ds: DataSource) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="migration-schema-owner">EUL schema owner (optional)</Label>
              <Input
                id="migration-schema-owner"
                placeholder="e.g. EUL5_US"
                value={schemaOwner}
                onChange={(e) => setSchemaOwner(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="migration-version">EUL version</Label>
              <Select
                value={versionOverride}
                onValueChange={(v) => setVersionOverride(v as 'auto' | 'EUL4' | 'EUL5')}
              >
                <SelectTrigger id="migration-version" aria-label="EUL version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="EUL4">Force EUL4</SelectItem>
                  <SelectItem value="EUL5">Force EUL5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => detectMutation.mutate()} disabled={!canAct}>
              {detectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="mr-2 h-4 w-4" />
              )}
              Detect version
            </Button>
            <Button variant="outline" onClick={() => analyzeMutation.mutate()} disabled={!canAct}>
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="mr-2 h-4 w-4" />
              )}
              Analyze
            </Button>

            <div className="flex items-center gap-2">
              <Checkbox
                id="migration-dry-run"
                checked={dryRun}
                onCheckedChange={(v) => setDryRun(v === true)}
              />
              <Label htmlFor="migration-dry-run" className="cursor-pointer font-normal">
                Dry run (validate without writing)
              </Label>
            </div>

            <Button onClick={() => runMutation.mutate()} disabled={!canAct}>
              {runMutation.isPending || isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {dryRun ? 'Run dry run' : 'Run migration'}
            </Button>
          </div>

          {!dryRun && (
            <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              A live migration writes into this Discoverer Neo database. Run a dry run first and
              review the report below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Detected version                                                  */}
      {/* ---------------------------------------------------------------- */}
      {detected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Database className="h-5 w-5" />
              Detected source
              <VersionBadge version={detected.version} />
              {detected.supported ? (
                <Badge variant="secondary">Supported</Badge>
              ) : (
                <Badge variant="destructive">Not supported</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Discoverer release</dt>
                <dd className="font-medium">{detected.discovererVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">EUL schema version</dt>
                <dd className="font-medium">{detected.schemaVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Schema owner</dt>
                <dd className="font-medium">{detected.owner ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">EUL tables found</dt>
                <dd className="font-medium">{detected.tableNames.length}</dd>
              </div>
            </dl>
            {detected.warnings.length > 0 && (
              <ul className="space-y-1">
                {detected.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Assessment report                                                 */}
      {/* ---------------------------------------------------------------- */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment</CardTitle>
            <CardDescription>
              Readiness {report.readiness.score}/100 ({report.readiness.rating}) · complexity{' '}
              {report.complexity.score} · estimated effort {report.estimate.humanReadable}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ['Business areas', report.counts.businessAreas],
                  ['Folders', report.counts.folders],
                  ['Items', report.counts.items],
                  ['Joins', report.counts.joins],
                  ['Hierarchies', report.counts.hierarchies],
                  ['Custom functions', report.counts.customFunctions],
                  ['Workbooks', report.counts.workbooks],
                  ['Conditions', report.counts.conditions],
                  ['Security conditions', report.counts.securityConditions],
                  ['Users', report.counts.users],
                  ['Grants', report.counts.grants],
                  ['Orphaned objects', report.orphans.total],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {report.readiness.blockers.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-medium text-destructive">Blockers</h4>
                {report.readiness.blockers.map((b) => (
                  <p key={b} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    {b}
                  </p>
                ))}
              </div>
            )}

            {report.warnings.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-medium">Warnings ({report.warnings.length})</h4>
                <ul className="space-y-1">
                  {report.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`} className="flex items-start gap-2">
                      {severityIcon(w.severity)}
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">{w.code}</span>{' '}
                        {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Job progress + log                                                */}
      {/* ---------------------------------------------------------------- */}
      {job && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              {job.status === 'RUNNING' && <Loader2 className="h-5 w-5 animate-spin" />}
              {job.status === 'COMPLETED' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              {job.status === 'FAILED' && <XCircle className="h-5 w-5 text-destructive" />}
              {job.dryRun ? 'Dry run' : 'Migration'} — {job.status}
              {job.detectedVersion && <VersionBadge version={job.detectedVersion} />}
              {job.requestedVersion !== 'auto' && (
                <Badge variant="outline">requested {job.requestedVersion}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Started {new Date(job.startedAt).toLocaleString()}
              {job.currentPhase && ` · ${job.currentPhase}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <ProgressBar value={job.progress} />
              <p className="text-right text-xs text-muted-foreground">{job.progress}%</p>
            </div>

            {job.error && (
              <p className="flex items-start gap-2 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                {job.error}
              </p>
            )}

            {/* Row counts */}
            {counts && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {job.dryRun ? 'Rows that would be inserted' : 'Rows inserted'}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 font-medium">Table</th>
                        <th className="py-1 text-right font-medium">Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TABLE_ORDER.map((table) => (
                        <tr key={table} className="border-b last:border-0">
                          <td className="py-1">{TABLE_LABELS[table]}</td>
                          <td className="py-1 text-right tabular-nums">{counts[table]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Post-migration summary */}
            {result && (
              <div className="space-y-2 rounded border p-3 text-sm">
                <h4 className="font-medium">Summary</h4>
                <p className="text-muted-foreground">
                  Source integrity: {result.sourceValidation.valid ? 'valid' : 'invalid'} (
                  {result.sourceValidation.errorCount} error(s),{' '}
                  {result.sourceValidation.warningCount} warning(s)). Skipped{' '}
                  {result.skipped.length} object(s). Took {(result.durationMs / 1000).toFixed(1)}s.
                </p>
                {result.validation && (
                  <p
                    className={
                      result.validation.valid ? 'text-emerald-700 dark:text-emerald-500' : 'text-destructive'
                    }
                  >
                    Post-migration reconciliation:{' '}
                    {result.validation.valid ? 'row counts match' : 'MISMATCH'}
                    {result.validation.issues.map((issue) => (
                      <span key={issue} className="block">
                        {issue}
                      </span>
                    ))}
                  </p>
                )}
                {result.syntheticBusinessAreas > 0 && (
                  <p className="text-muted-foreground">
                    A “Migrated Workbooks” business area was created to host workbook maps; their
                    worksheet layout must be rebuilt manually.
                  </p>
                )}
                {!result.dryRun && (
                  <p className="text-muted-foreground">
                    Migrated user accounts cannot sign in until an admin sets a password.
                  </p>
                )}
                {result.warnings.length > 0 && (
                  <details>
                    <summary className="cursor-pointer font-medium">
                      Version-specific notes ({result.warnings.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(
                        result.warnings.reduce<Record<string, number>>((acc, w) => {
                          acc[w.code] = (acc[w.code] ?? 0) + 1
                          return acc
                        }, {}),
                      )
                        .sort((a, b) => b[1] - a[1])
                        .map(([code, n]) => (
                          <li key={code} className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              <span className="font-mono text-xs">{code}</span> ×{n} —{' '}
                              {result.warnings.find((w) => w.code === code)?.message}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {/* Log viewer */}
            <div>
              <h4 className="mb-2 text-sm font-medium">
                Migration log
                {job.droppedLogs > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({job.droppedLogs} earlier line(s) trimmed)
                  </span>
                )}
              </h4>
              <div
                className="max-h-72 overflow-y-auto rounded border bg-muted/40 p-3 font-mono text-xs"
                role="log"
                aria-label="Migration log"
              >
                {job.logs.length === 0 ? (
                  <p className="text-muted-foreground">No log entries yet.</p>
                ) : (
                  job.logs.map((line, i) => (
                    <div key={`${line.at}-${i}`} className="flex gap-2">
                      <span
                        className={
                          line.level === 'ERROR'
                            ? 'text-destructive'
                            : line.level === 'WARN'
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        }
                      >
                        [{line.level}]
                      </span>
                      <span className="text-muted-foreground">{line.phase}</span>
                      <span className="break-all">{line.message}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPageWrapper>
  )
}
