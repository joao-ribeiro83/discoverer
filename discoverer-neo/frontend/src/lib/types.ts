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
}

export interface IntrospectedTable {
  tableName: string
  tableOwner: string
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
}

export type ItemType = 'CI' | 'CU' | 'CO' | 'JI' | 'HI' | 'AG' | 'FU'

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

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'

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
  joinType: JoinType
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
}

export interface CustomFunction {
  id: string
  name: string
  description: string | null
  functionType: FunctionType
  parameters: FunctionParameter[] | null
  returnType: string | null
  isActive: boolean
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER'

export interface AppUser {
  id: string
  email: string
  name: string
  role: UserRole
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
  createdAt: string
}

export interface MapCondition {
  id: string
  mapId: string
  itemId: string
  operator: ConditionOperator
  value: string | null
  paramName: string | null
  conditionType: 'PARAMETER' | 'STATIC'
  groupId: string | null
  logicOperator: 'AND' | 'OR'
  displayOrder: number
  createdAt: string
}

export interface MapParameter {
  id: string
  mapId: string
  name: string
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
  createdAt: string
  updatedAt: string
}

export interface MapWithDetails extends MapSummary {
  items: MapItem[]
  conditions: MapCondition[]
  parameters: MapParameter[]
  calculatedFields: MapCalculatedField[]
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
}

export interface MapConditionInput {
  itemId: string
  operator: ConditionOperator
  value?: string | null
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

export interface ResultColumn {
  name: string
  label: string
  isAggregate: boolean
}

export interface ExecuteResult {
  columns: ResultColumn[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
  truncated: boolean
  /** The generated SQL actually executed, when the backend includes it. */
  sql?: string
}

export interface ExecuteMapBody {
  parameters?: Record<string, unknown>
  timeoutMs?: number
  calculatedFields?: MapCalculatedFieldInput[]
  /** Row offset for "load more" pagination (sync execute only). */
  offset?: number
}

/** Mirrors the backend's `ExecutionErrorKind` (see `KIND_STATUS` in map-execution.ts). */
export type ExecutionErrorKind = 'CONFIG' | 'CONNECT' | 'TIMEOUT' | 'QUERY' | 'CANCELLED'

export type AsyncJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED'

export interface AsyncExecutionJob {
  jobId: string
  mapId: string
  status: AsyncJobStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  rowCount?: number
  executionTimeMs?: number
  truncated?: boolean
  error?: string
  result?: ExecuteResult
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

// --- data export (Excel/CSV) -------------------------------------------------

export type ExportFileFormat = 'XLSX' | 'CSV'
export type ExportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface ExportJob {
  jobId: string
  mapId: string
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

export interface ExportMapBody {
  format: ExportFileFormat
  parameters?: Record<string, unknown>
  calculatedFields?: MapCalculatedFieldInput[]
}

// --- schedules ---------------------------------------------------------

export interface ScheduleParameterValue {
  paramName: string
  paramValue: string | null
}

export interface Schedule {
  id: string
  mapId: string
  name: string
  cronExpression: string
  timezone: string
  validFrom: string | null
  validUntil: string | null
  outputFormat: ExportFileFormat
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  parameters: ScheduleParameterValue[]
  /** Computed server-side; null once the schedule has no further occurrence. */
  nextRunAt: string | null
}

export interface CreateScheduleInput {
  name: string
  cronExpression: string
  timezone?: string
  validFrom?: string | null
  validUntil?: string | null
  outputFormat: ExportFileFormat
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

export interface AssessmentReport {
  version: EulVersionInfo
  counts: MigrationAssessmentCounts
  folderTypeBreakdown: Record<string, number>
  orphans: { total: number }
  complexity: { score: 'simple' | 'medium' | 'complex'; points: number }
  warnings: AssessmentWarning[]
  estimate: { totalObjects: number; estimatedMinutes: number; humanReadable: string }
  readiness: {
    score: number
    rating: 'ready' | 'ready-with-warnings' | 'needs-attention' | 'not-supported'
    blockers: string[]
    notes: string[]
  }
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
  durationMs: number
}

export interface MigrationLogLine {
  level: 'INFO' | 'WARN' | 'ERROR'
  phase: string
  message: string
  at: string
}

export interface MigrationJob {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
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
  error: string | null
}

export interface StartMigrationInput {
  dataSourceId: string
  schemaOwner?: string
  dryRun?: boolean
  version?: 'auto' | 'EUL4' | 'EUL5'
}
