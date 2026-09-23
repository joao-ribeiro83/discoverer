export interface BusinessArea {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface Grant {
  id: string
  userId: string
  userEmail: string
  userName: string | null
  permissionLevel: 'CREATE' | 'EDIT' | 'DELETE' | 'EXPORT' | 'SCHEDULE' | 'VIEW'
  grantedAt: string
}

export interface UserOption {
  id: string
  email: string
  name: string
}

export interface DataSource {
  id: string
  name: string
  description: string | null
  connectionType: 'oracle' | 'postgres'
  host: string | null
  port: number | null
  serviceName: string | null
  sid: string | null
  username: string | null
  isActive: boolean
  createdAt: string
  hasPassword: boolean
  hasConnectionString: boolean
}

export interface IntrospectedColumn {
  columnName: string
  dataType: string
  dataLength: number | null
  nullable: boolean
  /** The column's comment in Oracle, if any — prefills the item description. */
  comments: string | null
}

export interface IntrospectedTable {
  tableName: string
  tableOwner: string
  objectType: 'TABLE' | 'VIEW'
  comments: string | null
  columns: IntrospectedColumn[]
}

export interface ImportResult {
  created: Array<{ folderId: string; name: string; tableName: string }>
  skipped: Array<{ tableName: string; reason: string }>
}

export type FolderType = 'TABLE' | 'VIEW' | 'DERIVED' | 'COMPLEX' | 'JOIN' | 'SUMMARY'

export interface Folder {
  id: string
  businessAreaId: string
  name: string
  description: string | null
  folderType: FolderType
  tableName: string | null
  tableOwner: string | null
  customSql: string | null
  dataSourceId: string | null
  dataSourceName: string | null
  isActive: boolean
  /**
   * Only present when listing folders by business area: true when the folder
   * is shared INTO that area rather than owned by it. Discoverer models
   * folder↔business-area as many-to-many (BA_OBJ_LINKS).
   */
  isShared?: boolean
}

/** A custom-function refresh: each function's outcome, then the recompile (null when nothing changed). */
export interface FunctionRefreshResponse {
  results: Array<{
    functionId: string
    name: string
    /** `parameters`, `return type` — empty when Oracle agrees. */
    changed: string[]
    /** Oracle no longer has it; the function is kept. */
    missing: boolean
    error: string | null
  }>
  compile: { ok: boolean; message: string } | null
}

/** One folder's outcome of a refresh from its data source. */
export interface FolderRefreshResult {
  folderId: string
  folderName: string
  /** Columns new in the source, now items. */
  added: string[]
  /** Items whose data type changed (and the folder, if TABLE/VIEW flipped). */
  updated: string[]
  /** Items whose column is gone from the source — reported, not deleted. */
  missing: string[]
  error: string | null
}

// CO is the plain column-backed database item; CI is a *created* item (a
// calculation). Listed CO-first to match how they are presented in the UI.
export type ItemType = 'CO' | 'CI' | 'CU' | 'JI' | 'HI' | 'AG' | 'FU'

export interface Item {
  id: string
  folderId: string
  name: string
  description: string | null
  itemType: ItemType
  columnName: string | null
  formula: string | null
  dataType: string | null
  formatMask: string | null
  aggFunction: string | null
  isActive: boolean
}

/**
 * No `FULL`: the flag combination that would mean a full outer join is a
 * refusal, not a join type Neo emits (D-038).
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT'

export interface Join {
  id: string
  name: string
  leftFolderId: string
  rightFolderId: string
  leftFolderName: string
  rightFolderName: string
  leftItemId: string | null
  rightItemId: string | null
  leftItemName: string | null
  rightItemName: string | null
  /** Derived from the join's outer-join flags, not a stored column (D-032). */
  joinType: JoinType
  /** Fan-trap detection only. Never affects the emitted SQL. */
  oneToOne: boolean
  allowMasterNoDetail: boolean
  allowDetailNoMaster: boolean
  /** Referential-integrity assertion; unlocks join trimming, not a join type. */
  mandatory: boolean
  /** How many column pairs the predicate has. 0 means the join cannot run. */
  predicateCount: number
}

export interface JoinSuggestion {
  leftFolderId: string
  rightFolderId: string
  leftItemId: string
  rightItemId: string
  leftColumnName: string
  rightColumnName: string
  suggestedJoinType: JoinType
  reason: string
}

export interface HierarchyLevel {
  id?: string
  levelName: string
  itemId: string
  levelNumber: number
}

export interface Hierarchy {
  id: string
  name: string
  description: string | null
  businessAreaId: string
  levels: HierarchyLevel[]
}

export type FunctionType = 'SQL' | 'PLSQL' | 'PACKAGE'

export interface FunctionParameter {
  name: string
  type: string
  required?: boolean
  defaultValue?: string | number | boolean | null
  position?: number
}

/** A function found in a data source's database, ready to register. */
export interface DatabaseFunction {
  owner: string
  packageName: string | null
  name: string
  overload: string | null
  returnType: string
  parameters: FunctionParameter[]
  callableFromSql: boolean
  reason: string | null
}

export interface CustomFunction {
  id: string
  name: string
  description: string | null
  functionType: FunctionType
  parameters: FunctionParameter[] | null
  returnType: string | null
  extOwner: string | null
  extPackage: string | null
  extName: string | null
  extDbLink: string | null
  dataSourceId: string | null
  isActive: boolean
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
  /**
   * True when this principal is an Oracle database ROLE migrated from the EUL
   * (EUL_USERS.EU_ROLE_FLAG), not a person. Roles hold grants and cannot sign in.
   */
  isRole?: boolean
  /** False once an admin deactivates the account; absent means active. */
  isActive?: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

export type MapType = 'TABLE' | 'CROSSTAB' | 'PAGE_DETAIL' | 'CHART'

export type ConditionOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'BETWEEN'
  | 'IS_NULL'

export type SortDirection = 'ASC' | 'DESC'

export type AggFunction = 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'NONE'

/** A persisted column of a map (a row of `map_items`). */
export interface MapItem {
  id: string
  mapId: string
  itemId: string
  displayOrder: number
  displayName: string | null
  formatMask: string | null
  aggFunction: string | null
  sortDirection: SortDirection | null
  sortOrder: number | null
  columnWidth: number | null
  /** Worksheet placement — see `MapItemInput` for what each field means. */
  axisType: MapAxisType | null
  axisEdge: MapAxisEdge | null
  axisOrder: number | null
  isHidden: boolean
  sortGroup: boolean
  dataType: string | null
  headingFormatMask: string | null
  alignment: MapAlignment | null
  wordWrap: boolean | null
  createdAt: string
}

export interface MapCondition {
  id: string
  mapId: string
  itemId: string
  operator: ConditionOperator
  value: string | null
  /** The referenced parameter's `bindName` — see `MapParameter`. */
  paramName: string | null
  conditionType: 'PARAMETER' | 'STATIC'
  groupId: string | null
  logicOperator: 'AND' | 'OR'
  displayOrder: number
  createdAt: string
}

/**
 * An item's live list of values.
 *
 * Nothing here is stored: the backend runs `SELECT DISTINCT` against the
 * customer's database each time the cache misses, because a Discoverer LOV was
 * always "the values in the column the item is based on" and freezing them
 * would go stale the day after a migration.
 */
export interface ItemValues {
  /**
   * `values` — here is the list.
   * `search` — too many distinct values to show; type to narrow it first.
   */
  mode: 'values' | 'search'
  values: string[]
  /** The cap cut the list short; there are more values than these. */
  truncated: boolean
  /** The item class that configured this, or null when it fell back to the item. */
  itemClassId: string | null
  cardinality: number | null
}

export interface MapParameter {
  id: string
  mapId: string
  /** The prompt shown to the user, and the key its value is submitted under. */
  name: string
  /**
   * The Oracle identifier this prompt binds as, derived server-side from
   * `name`. `MapCondition.paramName` holds this, not the prompt.
   */
  bindName: string
  paramType: 'STRING' | 'NUMBER' | 'DATE' | 'LIST'
  defaultValue: string | null
  isRequired: boolean
  createdAt: string
}

export interface MapCalculatedField {
  id: string
  mapId: string
  name: string
  formula: string
  displayOrder: number
  createdAt: string
}

/** A map row without its child collections (list responses). */
export interface MapSummary {
  id: string
  name: string
  description: string | null
  mapType: MapType
  businessAreaId: string
  createdBy: string
  isPublic: boolean
  isActive: boolean
  workbookId?: string | null
  createdAt: string
  updatedAt: string
}

/** A workbook — Discoverer's unit of saving/sharing/scheduling — with its worksheets. */
export interface WorkbookWithMaps {
  id: string
  name: string
  description: string | null
  sourceId: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  maps: MapSummary[]
}

/**
 * Who holds a workbook. The shares are per worksheet, so `sheets` out of
 * `total` is how much of it each person actually has; `permissionLevel` is
 * the narrowest level they hold across those sheets.
 */
export interface WorkbookShares {
  total: number
  shares: Array<{
    userId: string
    email: string | null
    name: string | null
    permissionLevel: string
    sheets: number
  }>
}

export interface DashboardStats {
  totalExecutions: number
  scheduledMaps: number
  scheduledResults: number
}

export interface MapWithDetails extends MapSummary {
  items: MapItem[]
  conditions: MapCondition[]
  parameters: MapParameter[]
  calculatedFields: MapCalculatedField[]
  /**
   * Filters this worksheet had in Discoverer and this map does not, each with
   * the condition as its author wrote it. Present only on a migrated map that
   * lost one — and it matters, because a lost filter has no other symptom: the
   * map runs, and quietly returns more rows than the original did.
   */
  droppedFilters?: Array<{ text: string; reason: string }> | null
}

export type SharePermissionLevel = 'VIEW' | 'EDIT' | 'EXPORT'

export interface MapShare {
  id: string
  mapId: string
  sharedWithUserId: string
  sharedWithEmail: string | null
  sharedWithName: string | null
  permissionLevel: SharePermissionLevel
  sharedBy: string
  sharedAt: string
}

export interface CreateMapShareInput {
  userId: string
  permissionLevel: SharePermissionLevel
}

// --- create/update payloads (mirror the backend zod schemas) ---------------

export interface MapItemInput {
  itemId: string
  displayOrder?: number
  displayName?: string | null
  formatMask?: string | null
  aggFunction?: string | null
  sortDirection?: SortDirection | null
  sortOrder?: number | null
  columnWidth?: number | null
  /** `AXIS` groups, `MEASURE` is aggregated, `PAGE` filters the whole sheet. */
  axisType?: MapAxisType | null
  /** Which edge of a crosstab an `AXIS` column sits on. */
  axisEdge?: MapAxisEdge | null
  axisOrder?: number | null
  /** The query names the item but draws no column for it. */
  isHidden?: boolean
  /** Group/break sort: suppress repeats and give a subtotal its boundary. */
  sortGroup?: boolean
}

export interface MapConditionInput {
  itemId: string
  operator: ConditionOperator
  value?: string | null
  /**
   * The parameter this condition prompts for, named either by its prompt or by
   * its `bindName`. The server resolves it to a bind name before storing, so
   * sending the prompt is what lets a renamed parameter keep its conditions.
   */
  paramName?: string | null
  conditionType: 'PARAMETER' | 'STATIC'
  groupId?: string | null
  logicOperator?: 'AND' | 'OR'
  displayOrder?: number
}

export interface MapParameterInput {
  name: string
  paramType: 'STRING' | 'NUMBER' | 'DATE' | 'LIST'
  defaultValue?: string | null
  isRequired?: boolean
}

export interface MapCalculatedFieldInput {
  name: string
  formula: string
  displayOrder?: number
}

export interface CreateMapInput {
  name: string
  description?: string | null
  mapType: MapType
  isPublic?: boolean
  items: MapItemInput[]
  conditions?: MapConditionInput[]
  parameters?: MapParameterInput[]
  calculatedFields?: MapCalculatedFieldInput[]
}

export type UpdateMapInput = Partial<CreateMapInput>

// --- execution -------------------------------------------------------------

export type MapAxisType = 'AXIS' | 'MEASURE' | 'PAGE'
export type MapAxisEdge = 'ROW' | 'COLUMN'
export type MapAlignment = 'LEFT' | 'CENTER' | 'RIGHT'

/**
 * A result column plus the presentation the map defines for it. Everything
 * after `isAggregate` comes from the map item and is absent for columns with
 * no map item behind them (ad-hoc calculated fields).
 */
export interface ResultColumn {
  name: string
  label: string
  isAggregate: boolean
  /** Raw Oracle data type of the source item, e.g. 'NUMBER', 'DATE'. */
  dataType?: string
  /** Oracle-style format mask, e.g. '999,999.00' or 'DD-MON-YYYY'. */
  formatMask?: string
  /** Preferred column width in pixels. */
  columnWidth?: number
  alignment?: MapAlignment
  wordWrap?: boolean
  headingFormatMask?: string
  axisType?: MapAxisType
  axisEdge?: MapAxisEdge
}

/** One total or percentage in a totals group. */
export interface ResultTotal {
  id: string
  kind: 'TOTAL' | 'PERCENTAGE'
  /** Key of this value in the group's rows. */
  alias: string
  /** Result column this total belongs under, when the map draws it. */
  targetAlias?: string
  targetLabel: string
  /** 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX', or 'INLINE' for a calculation. */
  aggFunction: string
  /** Discoverer's label template, `&value` / `&item` interpolation intact. */
  label?: string
  displayOrder: number
}

/**
 * One executed totals statement. A grand-total group has `breakAlias === null`
 * and exactly one row; a subtotal group has one row per distinct value of the
 * break column, each carrying that value under `breakAlias`.
 */
export interface ResultTotalsGroup {
  breakAlias: string | null
  breakLabel?: string
  /** The break column's alias in the main result set, when it is drawn. */
  breakTargetAlias?: string
  totals: ResultTotal[]
  rows: Record<string, unknown>[]
}

/** A conditional format rule's operator — Discoverer's Exception test. */
export type ConditionalFormatOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'BETWEEN'
  | 'IS_NULL'

/** One conditional format rule (Discoverer's Exception), as the CRUD API shapes it. */
export interface ConditionalFormatRule {
  id: string
  mapId: string
  name: string | null
  mapItemId: string | null
  target: 'CELL' | 'ROW'
  operator: ConditionalFormatOperator | null
  /** `BETWEEN` stores `low,high` and `IN` a comma-joined list, one column. */
  value: string | null
  backgroundColor: string | null
  textColor: string | null
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  displayOrder: number
}

export interface ConditionalFormatInput {
  name?: string | null
  mapItemId: string
  target: 'CELL' | 'ROW'
  operator: ConditionalFormatOperator
  value: string | null
  backgroundColor?: string | null
  textColor?: string | null
  isBold?: boolean
  isItalic?: boolean
  isUnderline?: boolean
  displayOrder?: number
}

/** A conditional format rule resolved to a result column, as a query result carries it. */
export interface ResultConditionalFormat {
  id: string
  /** Result column this rule tests, when the map draws it. */
  targetAlias?: string
  target: 'CELL' | 'ROW'
  operator: ConditionalFormatOperator | null
  value: string | null
  backgroundColor: string | null
  textColor: string | null
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  displayOrder: number
}

export interface ExecuteResult {
  columns: ResultColumn[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  truncated: boolean
  /** The generated SQL actually executed, when the backend includes it. */
  sql?: string
  /**
   * Columns the query sorted on first, outermost first — where the grid draws
   * a break at each change.
   */
  groupBreakAliases?: string[]
  /** Totals and subtotals the map defines, already computed. */
  totals?: ResultTotalsGroup[]
  /** Conditional formats (Exceptions) the map defines, already resolved to `columns`. */
  conditionalFormats?: ResultConditionalFormat[]
  /**
   * Map semantics this run could not honour — a sort dropped under
   * `SELECT DISTINCT`, a total whose Discoverer aggregate did not migrate.
   * The rows are still valid.
   */
  warnings?: string[]
  /**
   * The worksheet heading with its `&Date`, `&Time` and `&<ParamName>` tokens
   * replaced by the values this run actually used. Present on `/execute` only:
   * before a run there is no "now" and no entered parameter to print.
   */
  heading?: { title: string | null; description: string | null }
}

export interface ExecuteMapBody {
  parameters?: Record<string, unknown>
  timeoutMs?: number
  calculatedFields?: MapCalculatedFieldInput[]
  /** Row offset for "load more" pagination (sync execute only). */
  offset?: number
}

/**
 * Discoverer's "Drill to Detail": rerun the worksheet with aggregation
 * stripped and one clicked row's values pinned as conditions, so a total or
 * grouped figure shows the raw rows behind it. `rowValues` is keyed by the
 * same column alias `ExecuteResult.columns` carries — the same row the user
 * clicked in the grid, unmodified.
 */
export interface DrillToDetailBody {
  parameters?: Record<string, unknown>
  rowValues: Record<string, unknown>
}

/**
 * Mirrors the backend's `ExecutionErrorKind` (see `KIND_STATUS` in
 * map-execution.ts). `FORBIDDEN` is what `assertDataEntitlement` raises — the
 * caller may open the map but not run it. `REFUSED` is not a failure at all:
 * the planner declined a request it cannot answer correctly (D-036), and the
 * client renders it as an explanation, never as an error.
 */
export type ExecutionErrorKind =
  | 'CONFIG'
  | 'CONNECT'
  | 'TIMEOUT'
  | 'QUERY'
  | 'CANCELLED'
  | 'FORBIDDEN'
  | 'REFUSED'

/** Machine-readable reason behind a `REFUSED` execution. Keys the explanation copy. */
export type RefusalCode =
  | 'NO_JOIN_PATH'
  | 'JOIN_NO_PREDICATE'
  | 'JOIN_BOTH_OUTER'
  /**
   * The fan-trap planner refused. One code per rule, because the five say
   * genuinely different things and each needs its own "what to change".
   */
  | 'FAN_TRAP_R1'
  | 'FAN_TRAP_R2'
  | 'FAN_TRAP_R3'
  | 'FAN_TRAP_R4'
  | 'FAN_TRAP_REAGG'

/** One canvas column, as `POST /api/maps/plan` needs it. */
export interface PlanDraftItem {
  itemId: string
  aggFunction?: string | null
  axisType?: 'AXIS' | 'MEASURE' | 'PAGE' | null
  isHidden?: boolean
}

/** What `POST /api/maps/plan` says about a canvas, before anything is run. */
export interface QueryPlanSummary {
  kind: 'FLAT' | 'REWRITE' | 'REFUSE'
  /** `FLAT(NO_MEASURES)`, `REWRITE(2)`, `REFUSE(R3)`. */
  decision: string
  branches: number
  /** Present on a REFUSE plan. */
  rule?: 'R1' | 'R2' | 'R3' | 'R4' | 'REAGG'
  folders?: string[]
  message?: string
}

// --- map runs (async run queue) ---------------------------------------------

/** Presentation extras resolved once for a run and reused for every page of its rows. */
export interface ResultDecoration {
  groupBreakAliases?: string[]
  totals?: ResultTotalsGroup[]
  conditionalFormats?: ResultConditionalFormat[]
  warnings?: string[]
  /**
   * The worksheet heading with this run's own parameter values substituted —
   * mirrors `ExecuteResult.heading`. Present once the run completes.
   */
  heading?: { title: string | null; description: string | null }
  /**
   * Set only when the run failed (fix round 1): the error's `kind` and, for a
   * deliberate refusal (D-036), the `code`/`details` the old synchronous
   * `/execute` route used to return in its HTTP response. A queued run's
   * failure has no response to carry that on, so it lives here instead —
   * deliberately not a new column (controller ruling).
   */
  error?: {
    kind: ExecutionErrorKind
    refusal?: { code: RefusalCode; details?: Record<string, unknown> }
  }
}

/** A queued/running/finished map execution, backed by `map_runs` (see `POST /maps/:id/runs`). */
export interface MapRun {
  id: string
  mapId: string
  mapName: string
  kind: 'LIVE' | 'SCHEDULED'
  scheduleId: string | null
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  parameters: Record<string, unknown>
  calculatedFields: MapCalculatedFieldInput[]
  columns: ResultColumn[] | null
  decoration: ResultDecoration | null
  rowCount: number | null
  truncated: boolean
  executionTimeMs: number | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
}

export interface ExecutionHistoryEntry {
  id: string
  mapId: string | null
  executedBy: string | null
  executedAt: string
  executionTimeMs: number | null
  rowCount: number | null
  sqlText: string | null
  errorMessage: string | null
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT'
}

// --- data export (Excel/CSV/PDF) ---------------------------------------------

export type ExportFileFormat = 'XLSX' | 'CSV' | 'PDF'
export type ExportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ExportJob {
  jobId: string
  mapId: string
  /** Present in the export list; null once the map is deleted. */
  mapName?: string | null
  format: ExportFileFormat
  status: ExportJobStatus
  /**
   * 0-100. Between the start and end of streaming this is an estimate: the
   * server cannot know the row total without a second count query, so prefer
   * `rowCount` when showing a quantity.
   */
  progress: number
  /** Rows written. Null until the export completes. */
  rowCount: number | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

/** PDF export choices: paper, orientation and which result columns to print. */
export interface PdfExportRequest {
  pageSize?: 'A4' | 'A3' | 'LETTER'
  orientation?: 'PORTRAIT' | 'LANDSCAPE'
  /** `ResultColumn.name`s to print; omitted = all. */
  columns?: string[]
}

export interface ExportMapBody {
  format: ExportFileFormat
  /**
   * The completed run this export reads its rows from — the backend requires
   * it (exports are built from stored run rows, never from Oracle) and 400s
   * without one.
   */
  runId: string
  parameters?: Record<string, unknown>
  calculatedFields?: MapCalculatedFieldInput[]
  /** Locale for a grand/subtotal row's label text. Defaults to `en`. */
  locale?: string
  /** PDF only. */
  pdf?: PdfExportRequest
}

// --- schedules ---------------------------------------------------------

export interface ScheduleParameterValue {
  paramName: string
  paramValue: string | null
}

/** Scheduled delivery only ever produces a file someone downloads unattended later — PDF stays interactive-only. */
export type ScheduleOutputFormat = 'XLSX' | 'CSV'

export interface Schedule {
  id: string
  mapId: string
  name: string
  cronExpression: string
  timezone: string
  validFrom: string | null
  validUntil: string | null
  outputFormat: ScheduleOutputFormat
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  parameters: ScheduleParameterValue[]
  /** Computed server-side; null once the schedule has no further occurrence. */
  nextRunAt: string | null
  /** The fan-trap planner's last decision for this schedule's map, e.g.
   *  `FLAT(NO_MEASURES)` or `REFUSE(R3)`. Null if never planned. */
  plannerDecision: string | null
  /** The refusal's plain-language message when `plannerDecision` is a
   *  `REFUSE(...)`. Null otherwise. */
  plannerRefusalDetail: string | null
}

export interface CreateScheduleInput {
  name: string
  cronExpression: string
  timezone?: string
  validFrom?: string | null
  validUntil?: string | null
  outputFormat: ScheduleOutputFormat
  isActive?: boolean
  parameters?: ScheduleParameterValue[]
}

export type UpdateScheduleInput = Partial<CreateScheduleInput>

export type ScheduleRunStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT'

export interface ScheduledResult {
  id: string
  scheduleId: string
  executedAt: string
  rowCount: number | null
  filePath: string | null
  executionTimeMs: number | null
  status: ScheduleRunStatus
  errorMessage: string | null
  /** The map run this result reads its rows from, when it used the run queue rather than a written file. */
  runId: string | null
  /** How long that run's stored rows stay valid, joined from `map_runs`. Null when there is no run. */
  expiresAt: string | null
}

// ---------------------------------------------------------------------------
// Row-level security policies
// ---------------------------------------------------------------------------

export type PolicyTargetType = 'BUSINESS_AREA' | 'FOLDER'

export interface SecurityPolicyRule {
  id: string
  policyId: string
  targetId: string
  targetType: PolicyTargetType
  sqlPredicate: string
  createdAt: string
}

export interface SecurityPolicy {
  id: string
  name: string
  description: string | null
  policyType: 'ROW_LEVEL'
  isActive: boolean
  createdAt: string
  /** Present on list responses. */
  ruleCount?: number
  assignmentCount?: number
  /** Present on detail responses. */
  rules?: SecurityPolicyRule[]
}

export interface SecurityPolicyRuleInput {
  targetId: string
  targetType: PolicyTargetType
  sqlPredicate: string
}

export interface CreateSecurityPolicyInput {
  name: string
  description?: string | null
  isActive?: boolean
  rules: SecurityPolicyRuleInput[]
}

export type UpdateSecurityPolicyInput = Partial<CreateSecurityPolicyInput>

export interface SecurityPolicyAssignment {
  id: string
  policyId: string
  userId: string | null
  roleName: string | null
  userEmail: string | null
  userName: string | null
}

export interface SecurityPolicyTestResult {
  originalSql: string
  securedSql: string
  predicates: string[]
}

// ---------------------------------------------------------------------------
// Migration (EUL → Discoverer Neo)
// ---------------------------------------------------------------------------

export type EulVersion = 'EUL3' | 'EUL4' | 'EUL5'

export interface EulVersionInfo {
  version: EulVersion
  prefix: string
  discovererVersion: string
  schemaVersion: string
  tableNames: string[]
  owner?: string
  supported: boolean
  warnings: string[]
}

export interface MigrationAssessmentCounts {
  businessAreas: number
  folders: number
  items: number
  calculatedItems: number
  conditions: number
  securityConditions: number
  joins: number
  hierarchies: number
  customFunctions: number
  workbooks: number
  users: number
  grants: number
}

export interface AssessmentWarning {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
}

/** Coverage of the worksheet-fidelity model (layout, sort, totals, joins). */
export interface WorksheetFidelitySummary {
  totalWorksheets: number
  layoutDecoded: number
  layoutUndecoded: number
  crosstabs: number
  withSorts: number
  withTotals: number
  withForcedJoins: number
  selectDistinct: number
}

export interface AssessmentReport {
  version: EulVersionInfo
  counts: MigrationAssessmentCounts
  folderTypeBreakdown: Record<string, number>
  orphans: { total: number }
  complexity: { score: 'simple' | 'medium' | 'complex'; points: number }
  warnings: AssessmentWarning[]
  estimate: { totalObjects: number; estimatedMinutes: number; humanReadable: string }
  /**
   * Scores the SOURCE only. No rating here says "ready" — nothing in this
   * report has seen a target. `dn-migrate verify` is the gate on that.
   */
  readiness: {
    score: number
    rating: 'source-clean' | 'source-minor-issues' | 'source-needs-work' | 'source-not-supported'
    blockers: string[]
    notes: string[]
    targetVerified: false
  }
  worksheetFidelity: WorksheetFidelitySummary
}

/** Target tables the migrator writes, in dependency order. */
export type MigrationTable =
  | 'users'
  | 'business_areas'
  | 'folders'
  | 'items'
  | 'joins'
  | 'hierarchies'
  | 'hierarchy_levels'
  | 'custom_functions'
  | 'maps'
  | 'map_items'
  | 'map_conditions'
  | 'map_parameters'
  | 'map_calculated_fields'
  | 'map_layouts'
  | 'map_totals'
  | 'map_page_setup'
  | 'map_conditional_formats'
  | 'folder_business_areas'
  | 'user_business_area_grants'

export type MigrationTableCounts = Record<MigrationTable, number>

export interface MigrationSkip {
  table: string
  sourceId: number
  reason: string
}

export interface MigrationReconciliation {
  table: MigrationTable
  baseline: number
  inserted: number
  expected: number
  actual: number
  ok: boolean
}

export interface MigrationResult {
  runId: string | null
  dryRun: boolean
  version: EulVersionInfo
  planned: MigrationTableCounts
  inserted: MigrationTableCounts
  skipped: MigrationSkip[]
  warnings: { code: string; message: string; sourceId?: number }[]
  sourceValidation: { valid: boolean; errorCount: number; warningCount: number }
  validation?: {
    valid: boolean
    reconciliations: MigrationReconciliation[]
    issues: string[]
  }
  syntheticBusinessAreas: number
  migrationUserEmail: string
  /** Target-side check; a dry run reports it instead of throwing. */
  preflight: { alreadyMigrated: boolean; message: string | null }
  durationMs: number
}

export interface MigrationLogLine {
  level: 'INFO' | 'WARN' | 'ERROR'
  phase: string
  message: string
  at: string
}

/** 'FULL' is the whole pipeline; 'MAPS' rebuilds only the migrated maps. */
export type MigrationJobKind = 'FULL' | 'MAPS' | 'DELTA' | 'COMPILE'

/** Mirrors the backend's DeltaSummary — what a "re-import everything" job reports. */
export interface DeltaSummary {
  dryRun: boolean
  adopted: boolean
  noop: boolean
  objects: number
  durationMs: number
  counts: Record<string, Record<string, number>>
  refused: string[]
  verifyStatus: string | null
}

export interface MigrationJob {
  id: string
  kind: MigrationJobKind
  /**
   * COMPLETED_WITH_BLOCKERS: the run committed, and something it produced does
   * not hold. Treat it as done-but-not-ready, never as success.
   */
  status: 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_BLOCKERS' | 'FAILED'
  dataSourceId: string
  dryRun: boolean
  requestedVersion: 'auto' | 'EUL4' | 'EUL5'
  detectedVersion: string | null
  startedBy: string
  startedAt: string
  finishedAt: string | null
  progress: number
  currentPhase: string | null
  logs: MigrationLogLine[]
  droppedLogs: number
  result: MigrationResult | null
  /** Set instead of `result` when `kind` is 'MAPS'. */
  mapsResult: MapReimportResult | null
  /** Set instead of `result` when `kind` is 'DELTA'. */
  deltaResult: DeltaSummary | null
  error: string | null
}

export interface MapReimportCounts {
  workbooks: number
  worksheets: number
  maps: number
  map_items: number
  map_conditions: number
  map_parameters: number
  map_calculated_fields: number
  map_totals: number
  map_layouts: number
  map_page_setup: number
}

export interface MapReimportResult {
  dryRun: boolean
  /** Maps that were in the host business area before the run. */
  replacedMaps: number
  written: MapReimportCounts
  planned: MapReimportCounts
  unresolvedItems: number
  /** Conditions dropped because an item they filter is no longer in the EUL. */
  unresolvedConditions: number
  /** Totals dropped because the column they aggregate is no longer in the EUL. */
  unresolvedTotals: number
  /** Conditions Neo's filter model cannot express; the job log gives each reason. */
  inexpressibleConditions: number
  durationMs: number
}

export interface StartMigrationInput {
  dataSourceId: string
  schemaOwner?: string
  dryRun?: boolean
  version?: 'auto' | 'EUL4' | 'EUL5'
}

/** A maps re-import takes no version override — it re-reads the same source. */
export interface StartMapReimportInput {
  dataSourceId: string
  schemaOwner?: string
  dryRun?: boolean
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  action: string
  entityType: string
  entityId: string | null
  details: unknown
  ipAddress: string | null
  createdAt: string
}

export interface AuditQueryFilters {
  userId?: string
  action?: string
  entityType?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export interface AuditQueryResponse {
  data: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditStats {
  totalActions: number
  byDay: { date: string; count: number }[]
  byUser: { userId: string | null; userName: string | null; count: number }[]
  byActionType: { action: string; count: number }[]
}
