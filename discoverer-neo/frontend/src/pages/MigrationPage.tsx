import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  Info,
  Loader2,
  Play,
  RefreshCw,
  ScanSearch,
  XCircle,
} from 'lucide-react'

import { apiClient, getErrorMessage } from '@/lib/api'
import type {
  AssessmentReport,
  DataSource,
  EulVersionInfo,
  MapReimportCounts,
  MigrationJob,
  MigrationTable,
} from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useLocale } from '@/hooks/useLocale'
import { formatDateTime } from '@/lib/format'
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

/** Target tables the migrator writes, in dependency order (see MigrationTable). */
const TABLE_ORDER: MigrationTable[] = [
  'users',
  'business_areas',
  'folders',
  'items',
  'joins',
  'hierarchies',
  'hierarchy_levels',
  'custom_functions',
  'maps',
  'map_items',
  'map_conditions',
  'map_parameters',
  'map_calculated_fields',
  'map_layouts',
  'map_totals',
  'map_page_setup',
  'map_conditional_formats',
  'user_business_area_grants',
]

/** Tables a maps-only re-import writes, in the order it writes them. */
const MAP_TABLE_ORDER = [
  'maps',
  'map_items',
  'map_conditions',
  'map_parameters',
  'map_calculated_fields',
  'map_layouts',
  'map_totals',
  'map_page_setup',
] as const satisfies readonly (keyof MapReimportCounts)[]

function VersionBadge({ version }: { version: string }) {
  const tone =
    version === 'EUL5'
      ? 'bg-success text-success-foreground'
      : version === 'EUL4'
        ? 'bg-info text-info-foreground'
        : 'bg-warning text-warning-foreground'
  return <span className={`rounded px-2.5 py-1 text-lg font-bold tracking-tight ${tone}`}>{version}</span>
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
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
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
  return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
}

export function MigrationPage() {
  const { t } = useTranslation(['migration', 'common'])
  const { toast } = useToast()
  const { locale } = useLocale()
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
        title: t('migration:toasts.detectedTitle', { version: version.version }),
        description: t('migration:toasts.detectedDescription', {
          discovererVersion: version.discovererVersion,
          schemaVersion: version.schemaVersion,
        }),
      })
    },
    onError: (err) =>
      toast({ title: t('migration:toasts.detectionFailed'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  const analyzeMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.migration.analyze(dataSourceId, schemaOwner || undefined)).data.data,
    onSuccess: (result) => {
      setReport(result)
      setDetected(result.version)
      toast({
        title: t('migration:toasts.analysisComplete'),
        description: t('migration:toasts.analysisCompleteDescription', { score: result.readiness.score }),
      })
    },
    onError: (err) =>
      toast({ title: t('migration:toasts.analysisFailed'), description: getErrorMessage(err), variant: 'destructive' }),
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
        title: dryRun ? t('migration:toasts.dryRunStarted') : t('migration:toasts.migrationStarted'),
        description: t('migration:toasts.progressUpdatesBelow'),
      })
    },
    onError: (err) =>
      toast({ title: t('migration:toasts.couldNotStart'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Rebuilds only the maps of an already-migrated database. Separate from the
  // run mutation because it is refused-by-design as a full re-run, and because
  // it deletes the existing migrated maps before writing new ones.
  const reimportMapsMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.migration.reimportMaps({
          dataSourceId,
          schemaOwner: schemaOwner || undefined,
          dryRun,
        })
      ).data.data,
    onSuccess: (started) => {
      setActiveJobId(started.id)
      toast({
        title: dryRun
          ? t('migration:toasts.dryRunStarted')
          : t('migration:toasts.mapReimportStarted'),
        description: t('migration:toasts.progressUpdatesBelow'),
      })
    },
    onError: (err) =>
      toast({ title: t('migration:toasts.couldNotStart'), description: getErrorMessage(err), variant: 'destructive' }),
  })

  // Announce the outcome once, when the job leaves RUNNING.
  const lastStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!job || job.status === lastStatusRef.current) return
    if (lastStatusRef.current === 'RUNNING' || lastStatusRef.current === null) {
      if (job.status === 'COMPLETED') {
        toast({
          title: job.dryRun ? t('migration:toasts.dryRunComplete') : t('migration:toasts.migrationComplete'),
          description: job.dryRun
            ? t('migration:toasts.noRowsWritten')
            : t('migration:toasts.migratedFrom', {
                source: job.detectedVersion ?? t('migration:toasts.theSource'),
              }),
        })
        if (!job.dryRun) void queryClient.invalidateQueries({ queryKey: ['business-areas'] })
      } else if (job.status === 'FAILED') {
        toast({
          title: t('migration:toasts.migrationFailed'),
          description: job.error ?? t('migration:toasts.seeLogBelow'),
          variant: 'destructive',
        })
      }
    }
    lastStatusRef.current = job.status
  }, [job, toast, queryClient, t])

  // Keep the log viewer pinned to the newest line.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [job?.logs.length])

  const isRunning = job?.status === 'RUNNING'
  const busy =
    detectMutation.isPending ||
    analyzeMutation.isPending ||
    runMutation.isPending ||
    reimportMapsMutation.isPending
  const canAct = dataSourceId !== '' && !busy && !isRunning

  const result = job?.result ?? null
  const counts = result ? (result.dryRun ? result.planned : result.inserted) : null
  // A maps re-import reports its own counts; a dry run reports what it planned.
  const mapsResult = job?.mapsResult ?? null
  const mapsCounts = mapsResult ? (mapsResult.dryRun ? mapsResult.planned : mapsResult.written) : null

  return (
    <AdminPageWrapper
      title={t('migration:page.title')}
      description={t('migration:page.description')}
    >
      {/* ---------------------------------------------------------------- */}
      {/* Source configuration                                             */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t('migration:source.title')}</CardTitle>
          <CardDescription>
            {t('migration:source.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="migration-source">{t('migration:source.dataSourceLabel')}</Label>
              <Select value={dataSourceId} onValueChange={setDataSourceId}>
                <SelectTrigger id="migration-source" aria-label={t('migration:source.dataSourceLabel')}>
                  <SelectValue placeholder={oracleSources.length ? t('migration:source.selectDataSourcePlaceholder') : t('migration:source.noOracleDataSources')} />
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
              <Label htmlFor="migration-schema-owner">{t('migration:source.schemaOwnerLabel')}</Label>
              <Input
                id="migration-schema-owner"
                placeholder={t('migration:source.schemaOwnerPlaceholder')}
                value={schemaOwner}
                onChange={(e) => setSchemaOwner(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="migration-version">{t('migration:source.versionLabel')}</Label>
              <Select
                value={versionOverride}
                onValueChange={(v) => setVersionOverride(v as 'auto' | 'EUL4' | 'EUL5')}
              >
                <SelectTrigger id="migration-version" aria-label={t('migration:source.versionLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t('migration:source.autoDetect')}</SelectItem>
                  <SelectItem value="EUL4">{t('migration:source.forceEul4')}</SelectItem>
                  <SelectItem value="EUL5">{t('migration:source.forceEul5')}</SelectItem>
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
              {t('migration:actions.detectVersion')}
            </Button>
            <Button variant="outline" onClick={() => analyzeMutation.mutate()} disabled={!canAct}>
              {analyzeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="mr-2 h-4 w-4" />
              )}
              {t('migration:actions.analyze')}
            </Button>

            <div className="flex items-center gap-2">
              <Checkbox
                id="migration-dry-run"
                checked={dryRun}
                onCheckedChange={(v) => setDryRun(v === true)}
              />
              <Label htmlFor="migration-dry-run" className="cursor-pointer font-normal">
                {t('migration:source.dryRunLabel')}
              </Label>
            </div>

            <Button onClick={() => runMutation.mutate()} disabled={!canAct}>
              {runMutation.isPending || isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {dryRun ? t('migration:actions.runDryRun') : t('migration:actions.runMigration')}
            </Button>

            <Button
              variant="outline"
              onClick={() => reimportMapsMutation.mutate()}
              disabled={!canAct}
            >
              {reimportMapsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('migration:actions.reimportMaps')}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('migration:source.reimportMapsHelp')}
          </p>

          {!dryRun && (
            <p className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('migration:source.liveMigrationWarning')}
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
              {t('migration:detected.title')}
              <VersionBadge version={detected.version} />
              {detected.supported ? (
                <Badge variant="secondary">{t('migration:detected.supported')}</Badge>
              ) : (
                <Badge variant="destructive">{t('migration:detected.notSupported')}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">{t('migration:detected.discovererRelease')}</dt>
                <dd className="font-medium">{detected.discovererVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('migration:detected.schemaVersion')}</dt>
                <dd className="font-medium">{detected.schemaVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('migration:detected.schemaOwner')}</dt>
                <dd className="font-medium">{detected.owner ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('migration:detected.tablesFound')}</dt>
                <dd className="font-medium">{detected.tableNames.length}</dd>
              </div>
            </dl>
            {detected.warnings.length > 0 && (
              <ul className="space-y-1">
                {detected.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
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
            <CardTitle>{t('migration:assessment.title')}</CardTitle>
            <CardDescription>
              {t('migration:assessment.description', {
                score: report.readiness.score,
                rating: report.readiness.rating,
                complexity: report.complexity.score,
                estimate: report.estimate.humanReadable,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  [t('migration:assessment.counts.businessAreas'), report.counts.businessAreas],
                  [t('migration:assessment.counts.folders'), report.counts.folders],
                  [t('migration:assessment.counts.items'), report.counts.items],
                  [t('migration:assessment.counts.joins'), report.counts.joins],
                  [t('migration:assessment.counts.hierarchies'), report.counts.hierarchies],
                  [t('migration:assessment.counts.customFunctions'), report.counts.customFunctions],
                  [t('migration:assessment.counts.workbooks'), report.counts.workbooks],
                  [t('migration:assessment.counts.conditions'), report.counts.conditions],
                  [t('migration:assessment.counts.securityConditions'), report.counts.securityConditions],
                  [t('migration:assessment.counts.users'), report.counts.users],
                  [t('migration:assessment.counts.grants'), report.counts.grants],
                  [t('migration:assessment.counts.orphanedObjects'), report.orphans.total],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {report.worksheetFidelity.totalWorksheets > 0 && (
              <div>
                <h4 className="mb-2 font-medium">{t('migration:assessment.fidelity.title')}</h4>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-7">
                  {(
                    [
                      [t('migration:assessment.fidelity.totalWorksheets'), report.worksheetFidelity.totalWorksheets],
                      [t('migration:assessment.fidelity.layoutDecoded'), report.worksheetFidelity.layoutDecoded],
                      [t('migration:assessment.fidelity.crosstabs'), report.worksheetFidelity.crosstabs],
                      [t('migration:assessment.fidelity.withSorts'), report.worksheetFidelity.withSorts],
                      [t('migration:assessment.fidelity.withTotals'), report.worksheetFidelity.withTotals],
                      [t('migration:assessment.fidelity.withForcedJoins'), report.worksheetFidelity.withForcedJoins],
                      [t('migration:assessment.fidelity.selectDistinct'), report.worksheetFidelity.selectDistinct],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-lg font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {report.readiness.blockers.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-medium text-destructive">{t('migration:assessment.blockers')}</h4>
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
                <h4 className="font-medium">{t('migration:assessment.warningsCount', { count: report.warnings.length })}</h4>
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
              {job.status === 'COMPLETED' && <CheckCircle2 className="h-5 w-5 text-success" />}
              {job.status === 'FAILED' && <XCircle className="h-5 w-5 text-destructive" />}
              {job.dryRun ? t('migration:job.dryRunLabel') : t('migration:job.migrationLabel')} — {job.status}
              {job.detectedVersion && <VersionBadge version={job.detectedVersion} />}
              {job.requestedVersion !== 'auto' && (
                <Badge variant="outline">{t('migration:job.requestedVersion', { version: job.requestedVersion })}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('migration:job.started')} {formatDateTime(job.startedAt, locale)}
              {job.currentPhase && ` · ${job.currentPhase}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <ProgressBar value={job.progress} label={t('migration:job.progressAriaLabel')} />
              <p className="text-right text-xs text-muted-foreground">{job.progress}%</p>
            </div>

            {job.error && (
              <p className="flex items-start gap-2 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                {job.error}
              </p>
            )}

            {/* A dry run finishes against an already-migrated target; without
                this it would report a clean plan for a run that cannot run. */}
            {result?.preflight.alreadyMigrated && (
              <div className="space-y-1 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  {t('migration:job.targetBlockedTitle')}
                </p>
                <p className="text-muted-foreground">{result.preflight.message}</p>
              </div>
            )}

            {/* Row counts */}
            {counts && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {job.dryRun ? t('migration:job.rowsPlanned') : t('migration:job.rowsInserted')}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 font-medium">{t('migration:job.tableColumn')}</th>
                        <th className="py-1 text-right font-medium">{t('migration:job.rowsColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TABLE_ORDER.map((table) => (
                        <tr key={table} className="border-b last:border-0">
                          <td className="py-1">{t(`migration:tables.${table}`)}</td>
                          <td className="py-1 text-right tabular-nums">{counts[table]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Maps re-import counts */}
            {mapsCounts && (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  {job.dryRun ? t('migration:job.rowsPlanned') : t('migration:job.rowsInserted')}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 font-medium">{t('migration:job.tableColumn')}</th>
                        <th className="py-1 text-right font-medium">{t('migration:job.rowsColumn')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MAP_TABLE_ORDER.map((table) => (
                        <tr key={table} className="border-b last:border-0">
                          <td className="py-1">{t(`migration:tables.${table}`)}</td>
                          <td className="py-1 text-right tabular-nums">{mapsCounts[table]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Maps re-import summary */}
            {mapsResult && (
              <div className="space-y-2 rounded border p-3 text-sm">
                <h4 className="font-medium">{t('migration:job.summary')}</h4>
                <p className="text-muted-foreground">
                  {t('migration:job.mapsReimportSummary', {
                    replaced: mapsResult.replacedMaps,
                    workbooks: mapsResult.planned.workbooks,
                    worksheets: mapsResult.planned.worksheets,
                    duration: (mapsResult.durationMs / 1000).toFixed(1),
                  })}
                </p>
                {(mapsResult.unresolvedItems > 0 ||
                  mapsResult.unresolvedConditions +
                    mapsResult.inexpressibleConditions >
                    0) && (
                  <p className="text-warning">
                    {/* One total here; the job log above splits it into the two
                        causes and names each condition with its own reason. */}
                    {t('migration:job.mapsReimportUnresolved', {
                      columns: mapsResult.unresolvedItems,
                      conditions:
                        mapsResult.unresolvedConditions +
                        mapsResult.inexpressibleConditions,
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Post-migration summary */}
            {result && (
              <div className="space-y-2 rounded border p-3 text-sm">
                <h4 className="font-medium">{t('migration:job.summary')}</h4>
                <p className="text-muted-foreground">
                  {t('migration:job.sourceIntegrity', {
                    status: result.sourceValidation.valid ? t('migration:job.valid') : t('migration:job.invalid'),
                    errorCount: result.sourceValidation.errorCount,
                    warningCount: result.sourceValidation.warningCount,
                    skippedCount: result.skipped.length,
                    duration: (result.durationMs / 1000).toFixed(1),
                  })}
                </p>
                {result.validation && (
                  <p
                    className={
                      result.validation.valid ? 'text-success' : 'text-destructive'
                    }
                  >
                    {t('migration:job.reconciliation', {
                      status: result.validation.valid ? t('migration:job.rowCountsMatch') : t('migration:job.mismatch'),
                    })}
                    {result.validation.issues.map((issue) => (
                      <span key={issue} className="block">
                        {issue}
                      </span>
                    ))}
                  </p>
                )}
                {result.syntheticBusinessAreas > 0 && (
                  <p className="text-muted-foreground">
                    {t('migration:job.syntheticBusinessAreasNotice')}
                  </p>
                )}
                {!result.dryRun && (
                  <p className="text-muted-foreground">
                    {t('migration:job.migratedAccountsNotice')}
                  </p>
                )}
                {result.warnings.length > 0 && (
                  <details>
                    <summary className="cursor-pointer font-medium">
                      {t('migration:job.versionSpecificNotes', { count: result.warnings.length })}
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
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
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
                {t('migration:job.logTitle')}
                {job.droppedLogs > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t('migration:job.droppedLogsNotice', { count: job.droppedLogs })}
                  </span>
                )}
              </h4>
              <div
                className="max-h-72 overflow-y-auto rounded border bg-muted/40 p-3 font-mono text-xs"
                role="log"
                aria-label={t('migration:job.logTitle')}
              >
                {job.logs.length === 0 ? (
                  <p className="text-muted-foreground">{t('migration:job.noLogEntries')}</p>
                ) : (
                  job.logs.map((line, i) => (
                    <div key={`${line.at}-${i}`} className="flex gap-2">
                      <span
                        className={
                          line.level === 'ERROR'
                            ? 'text-destructive'
                            : line.level === 'WARN'
                              ? 'text-warning'
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
