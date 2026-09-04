import axios, { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { useAuthStore } from '@/store/auth'
import type {
  BusinessArea,
  Grant,
  DataSource,
  IntrospectedTable,
  ImportResult,
  Folder,
  Item,
  Join,
  JoinSuggestion,
  Hierarchy,
  CustomFunction,
  AppUser,
  MapSummary,
  MapWithDetails,
  DashboardStats,
  CreateMapInput,
  UpdateMapInput,
  ExecuteResult,
  ExecuteMapBody,
  AsyncExecutionJob,
  ExecutionHistoryEntry,
  ExecutionErrorKind,
  RefusalCode,
  ExportJob,
  ExportJobStatus,
  ExportMapBody,
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  ScheduledResult,
  MapShare,
  CreateMapShareInput,
  SharePermissionLevel,
  UserOption,
  SecurityPolicy,
  SecurityPolicyAssignment,
  SecurityPolicyTestResult,
  CreateSecurityPolicyInput,
  UpdateSecurityPolicyInput,
  AssessmentReport,
  EulVersionInfo,
  MigrationJob,
  StartMapReimportInput,
  StartMigrationInput,
  AuditLogEntry,
  AuditQueryFilters,
  AuditQueryResponse,
  AuditStats,
} from '@/lib/types'

type Envelope<T> = { data: T }

/** Oracle server errors. Never shown to a user — logged, and reported by `kind` (SEC-07). */
const ORACLE_ERROR_TEXT = /\bORA-\d{3,5}\b/

/**
 * A user-facing message for a failed request, always in the active locale.
 *
 * The default fallback is resolved through i18next rather than being an English
 * literal: the failures with no server body — a dropped connection, a timeout,
 * a non-JSON 5xx, a CORS rejection — are exactly the ones a Portuguese estate
 * hits most, and 53 call sites were passing no fallback at all. Callers may
 * still pass a more specific translated string.
 */
export function getErrorMessage(err: unknown, fallback = i18n.t('errors:generic')): string {
  if (!isAxiosError<{ error?: string }>(err)) return fallback
  // No response at all: the request never reached the server.
  if (!err.response) return i18n.t('errors:network')

  const message = err.response.data?.error
  if (!message) return fallback

  // SEC-07: an ORA- string names the schema and the failing construct. Report
  // the kind instead and keep the detail in the console for support.
  if (ORACLE_ERROR_TEXT.test(message)) {
    // eslint-disable-next-line no-console -- the detail must reach support somewhere (SEC-07)
    console.error('[api] suppressed Oracle error detail:', message)
    const kind = getErrorKind(err)
    return kind ? i18n.t(`errors:execution.${kind}`) : fallback
  }
  return message
}

/** Backend execution/export errors optionally carry a `kind` discriminant (see `ExecutionErrorKind`). */
export function getErrorKind(err: unknown): ExecutionErrorKind | undefined {
  if (isAxiosError<{ kind?: ExecutionErrorKind }>(err)) {
    return err.response?.data?.kind
  }
  return undefined
}

/** The machine-readable reason behind a `REFUSED` execution (see `RefusalCode`). */
export function getRefusalCode(err: unknown): RefusalCode | undefined {
  if (isAxiosError<{ code?: RefusalCode }>(err)) {
    return err.response?.data?.code
  }
  return undefined
}

/** Free-form context the backend attaches to a refusal — e.g. the folder names involved. */
export function getRefusalDetails(err: unknown): Record<string, unknown> | undefined {
  if (isAxiosError<{ details?: Record<string, unknown> }>(err)) {
    return err.response?.data?.details
  }
  return undefined
}

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach JWT token from the auth store (single source
// of truth; avoids a shadow localStorage key that can desync from it).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — force a logout+redirect on a 401 from an
// already-authenticated call (an expired/invalid session). Login and refresh
// requests report their own 401s locally (inline form error / useAuth's
// session-expired flow) and must not be short-circuited here.
const AUTH_SELF_HANDLED_PATHS = ['/auth/login', '/auth/refresh']

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? ''
      const selfHandled = AUTH_SELF_HANDLED_PATHS.some((path) => url.includes(path))
      if (!selfHandled) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
)

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  // Added in Session 7.1 — the user's saved UI preferences.
  locale?: string
  theme?: string
  // Added alongside the Allianz Trade-inspired color palette — independent
  // of theme (light/dark/high-contrast), see PaletteProvider.
  colorPalette?: string
}

/** User preferences payload (Session 7.1 backend: /api/users/me/preferences). */
export interface UserPreferences {
  locale: string
  theme: string
  colorPalette: string
}

// Typed API client — placeholder methods for future endpoints
export const apiClient = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      api.post<{ data: { token: string; user: AuthUser } }>('/auth/login', {
        email,
        password,
      }),
    logout: () => api.post('/auth/logout'),
    me: () => api.get<{ data: AuthUser }>('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post<Envelope<{ message: string }>>('/auth/change-password', {
        currentPassword,
        newPassword,
      }),
    refresh: (token: string) =>
      api.post<{ data: { token: string } }>('/auth/refresh', { token }),
  },
  // Business Areas
  businessAreas: {
    list: () => api.get<Envelope<BusinessArea[]>>('/business-areas'),
    get: (id: string) => api.get<Envelope<BusinessArea & { grants: Grant[]; permissions: string[] }>>(`/business-areas/${id}`),
    create: (data: unknown) => api.post<Envelope<BusinessArea>>('/business-areas', data),
    update: (id: string, data: unknown) => api.put<Envelope<BusinessArea>>(`/business-areas/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/business-areas/${id}`),
    grants: (id: string) => api.get<Envelope<Grant[]>>(`/business-areas/${id}/grants`),
    grant: (id: string, data: unknown) => api.post<Envelope<Grant>>(`/business-areas/${id}/grants`, data),
    revoke: (id: string, userId: string) =>
      api.delete<Envelope<{ message: string }>>(`/business-areas/${id}/grants/${userId}`),
  },
  // Folders (scoped to a business area for list/create; flat for get/update/delete)
  folders: {
    listByBusinessArea: (businessAreaId: string) =>
      api.get<Envelope<Folder[]>>(`/business-areas/${businessAreaId}/folders`),
    get: (id: string) => api.get<Envelope<Folder>>(`/folders/${id}`),
    create: (businessAreaId: string, data: unknown) =>
      api.post<Envelope<Folder>>(`/business-areas/${businessAreaId}/folders`, data),
    update: (id: string, data: unknown) => api.put<Envelope<Folder>>(`/folders/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/folders/${id}`),
    // Folder↔business-area is many-to-many in Discoverer (BA_OBJ_LINKS): a
    // folder is owned by one area and can be shared into others.
    listSharedBusinessAreas: (id: string) =>
      api.get<Envelope<string[]>>(`/folders/${id}/business-areas`),
    shareWithBusinessArea: (id: string, businessAreaId: string) =>
      api.post<Envelope<{ message: string }>>(`/folders/${id}/business-areas`, {
        businessAreaId,
      }),
    unshareWithBusinessArea: (id: string, businessAreaId: string) =>
      api.delete<Envelope<{ message: string }>>(
        `/folders/${id}/business-areas/${businessAreaId}`,
      ),
  },
  // Items (scoped to a folder for list/create; flat for get/update/delete)
  items: {
    listByFolder: (folderId: string) => api.get<Envelope<Item[]>>(`/folders/${folderId}/items`),
    get: (id: string) => api.get<Envelope<Item>>(`/items/${id}`),
    create: (folderId: string, data: unknown) => api.post<Envelope<Item>>(`/folders/${folderId}/items`, data),
    update: (id: string, data: unknown) => api.put<Envelope<Item>>(`/items/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/items/${id}`),
    import: (folderId: string, columns: unknown) =>
      api.post<Envelope<{ created: unknown[]; skipped: unknown[] }>>(`/folders/${folderId}/items/import`, { columns }),
  },
  // Joins (scoped to a business area for list/create; flat for get/update/delete)
  joins: {
    listByBusinessArea: (businessAreaId: string) =>
      api.get<Envelope<Join[]>>(`/business-areas/${businessAreaId}/joins`),
    get: (id: string) => api.get<Envelope<Join>>(`/joins/${id}`),
    create: (businessAreaId: string, data: unknown) =>
      api.post<Envelope<Join>>(`/business-areas/${businessAreaId}/joins`, data),
    update: (id: string, data: unknown) => api.put<Envelope<Join>>(`/joins/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/joins/${id}`),
    suggestions: (folderId: string) => api.get<Envelope<JoinSuggestion[]>>(`/folders/${folderId}/joins/suggestions`),
  },
  // Hierarchies (scoped to a business area for list/create; flat for get/update/delete)
  hierarchies: {
    listByBusinessArea: (businessAreaId: string) =>
      api.get<Envelope<Hierarchy[]>>(`/business-areas/${businessAreaId}/hierarchies`),
    get: (id: string) => api.get<Envelope<Hierarchy>>(`/hierarchies/${id}`),
    create: (businessAreaId: string, data: unknown) =>
      api.post<Envelope<Hierarchy>>(`/business-areas/${businessAreaId}/hierarchies`, data),
    update: (id: string, data: unknown) => api.put<Envelope<Hierarchy>>(`/hierarchies/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/hierarchies/${id}`),
  },
  // Custom Functions
  customFunctions: {
    list: () => api.get<Envelope<CustomFunction[]>>('/custom-functions'),
    get: (id: string) => api.get<Envelope<CustomFunction>>(`/custom-functions/${id}`),
    create: (data: unknown) => api.post<Envelope<CustomFunction>>('/custom-functions', data),
    update: (id: string, data: unknown) => api.put<Envelope<CustomFunction>>(`/custom-functions/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/custom-functions/${id}`),
  },
  // Data Sources
  dataSources: {
    list: () => api.get<Envelope<DataSource[]>>('/data-sources'),
    get: (id: string) => api.get<Envelope<DataSource>>(`/data-sources/${id}`),
    create: (data: unknown) => api.post<Envelope<DataSource>>('/data-sources', data),
    update: (id: string, data: unknown) => api.put<Envelope<DataSource>>(`/data-sources/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/data-sources/${id}`),
    testConnection: (id: string) =>
      api.post<Envelope<{ success: boolean; message: string; latencyMs: number }>>(`/data-sources/${id}/test`),
    introspect: (id: string, tableOwner?: string) =>
      api.post<Envelope<{ tables: IntrospectedTable[]; count: number; cached: boolean }>>(
        `/data-sources/${id}/introspect`,
        undefined,
        { params: { tableOwner } }
      ),
    tables: (id: string, tableOwner?: string) =>
      api.get<Envelope<{ tables: IntrospectedTable[]; count: number }>>(`/data-sources/${id}/tables`, {
        params: { tableOwner },
      }),
    importTables: (
      id: string,
      data: { tableNames: string[]; tableOwner: string; businessAreaId: string }
    ) => api.post<Envelope<ImportResult>>(`/data-sources/${id}/import`, data),
  },
  // Users
  users: {
    list: () => api.get<Envelope<AppUser[]>>('/users'),
    get: (id: string) => api.get<Envelope<AppUser>>(`/users/${id}`),
    create: (data: unknown) => api.post<Envelope<AppUser>>('/users', data),
    update: (id: string, data: unknown) => api.put<Envelope<AppUser>>(`/users/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ message: string }>>(`/users/${id}`),
    // Unlike the CRUD methods above (admin-only), search is available to any
    // authenticated user — it backs the map-sharing user picker.
    search: (q: string) => api.get<Envelope<UserOption[]>>('/users/search', { params: { q } }),
    // Current user's UI preferences (locale/theme). Available to any
    // authenticated user for their own row (Session 7.1).
    getPreferences: () => api.get<Envelope<UserPreferences>>('/users/me/preferences'),
    updatePreferences: (data: Partial<UserPreferences>) =>
      api.patch<Envelope<UserPreferences>>('/users/me/preferences', data),
  },
  // Maps
  // Note: maps are created under a business area
  // (POST /business-areas/:baId/maps), while get/update/delete are flat.
  maps: {
    listMine: () =>
      api.get<Envelope<{ mine: MapSummary[]; shared: MapSummary[] }>>('/maps', {
        params: { scope: 'owned' },
      }),
    // Every map the caller may see (Phase 2.1's "all" tab) — explicit `scope=all`
    // rather than relying on the endpoint's role-based default.
    listAll: () =>
      api.get<Envelope<{ all: MapSummary[] }>>('/maps', { params: { scope: 'all' } }),
    listByBusinessArea: (businessAreaId: string) =>
      api.get<Envelope<MapSummary[]>>(`/business-areas/${businessAreaId}/maps`),
    get: (id: string) => api.get<Envelope<MapWithDetails>>(`/maps/${id}`),
    create: (businessAreaId: string, data: CreateMapInput) =>
      api.post<Envelope<MapWithDetails>>(`/business-areas/${businessAreaId}/maps`, data),
    update: (id: string, data: UpdateMapInput) =>
      api.put<Envelope<MapWithDetails>>(`/maps/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ deleted: boolean }>>(`/maps/${id}`),
    duplicate: (id: string, name?: string) =>
      api.post<Envelope<MapWithDetails>>(`/maps/${id}/duplicate`, { name }),
    execute: (id: string, body: ExecuteMapBody = {}) =>
      api.post<Envelope<ExecuteResult>>(`/maps/${id}/execute`, body),
    executeAsync: (id: string, body: ExecuteMapBody = {}) =>
      api.post<Envelope<{ jobId: string }>>(`/maps/${id}/execute-async`, body),
    getExecutionStatus: (id: string, jobId: string) =>
      api.get<Envelope<AsyncExecutionJob>>(`/maps/${id}/executions/${jobId}`),
    cancelExecution: (id: string, jobId: string) =>
      api.delete<Envelope<{ cancelled: boolean; status: string }>>(
        `/maps/${id}/executions/${jobId}`
      ),
    getHistory: (id: string, limit?: number) =>
      api.get<Envelope<ExecutionHistoryEntry[]>>(`/maps/${id}/history`, { params: { limit } }),
    exportXml: (id: string) => api.get<string>(`/maps/${id}/export`, { responseType: 'text' }),
    // Data export (Excel/CSV) — distinct from exportXml (map definition).
    // Creating one is map-scoped; everything after is keyed by the job id and
    // lives under `exports` below.
    createExport: (id: string, body: ExportMapBody) =>
      api.post<Envelope<{ jobId: string; status: ExportJobStatus }>>(
        `/maps/${id}/export`,
        body
      ),
    // Sharing — managed by the map owner or an admin. Reads live under the
    // map (matching map-shares.ts's route nesting).
    listShares: (id: string) => api.get<Envelope<MapShare[]>>(`/maps/${id}/shares`),
    share: (id: string, data: CreateMapShareInput) =>
      api.post<Envelope<MapShare>>(`/maps/${id}/shares`, data),
    updateShare: (id: string, userId: string, permissionLevel: SharePermissionLevel) =>
      api.put<Envelope<MapShare>>(`/maps/${id}/shares/${userId}`, { permissionLevel }),
    revokeShare: (id: string, userId: string) =>
      api.delete<Envelope<{ revoked: boolean }>>(`/maps/${id}/shares/${userId}`),
    sharedWithMe: () => api.get<Envelope<MapSummary[]>>('/maps/shared-with-me'),
  },
  // Export jobs. Addressed by their globally-unique job id rather than nested
  // under a map, which is what allows listing a user's exports across maps.
  exports: {
    list: (limit?: number) =>
      api.get<Envelope<ExportJob[]>>('/exports', { params: { limit } }),
    getStatus: (jobId: string) => api.get<Envelope<ExportJob>>(`/exports/${jobId}`),
    // Fetched as a blob (not a plain <a href>) because the download route
    // requires the same bearer token as every other API call.
    download: (jobId: string) =>
      api.get<Blob>(`/exports/${jobId}/download`, { responseType: 'blob' }),
  },
  // Schedules
  // Note: creation is map-scoped (POST /maps/:mapId/schedules), while
  // everything else is keyed by the schedule's own id — same shape as exports.
  schedules: {
    listMine: () => api.get<Envelope<Schedule[]>>('/schedules'),
    listByMap: (mapId: string) => api.get<Envelope<Schedule[]>>(`/maps/${mapId}/schedules`),
    get: (id: string) => api.get<Envelope<Schedule>>(`/schedules/${id}`),
    create: (mapId: string, data: CreateScheduleInput) =>
      api.post<Envelope<Schedule>>(`/maps/${mapId}/schedules`, data),
    update: (id: string, data: UpdateScheduleInput) =>
      api.put<Envelope<Schedule>>(`/schedules/${id}`, data),
    delete: (id: string) => api.delete<Envelope<{ deleted: boolean }>>(`/schedules/${id}`),
    toggle: (id: string, isActive: boolean) =>
      api.post<Envelope<Schedule>>(`/schedules/${id}/toggle`, { isActive }),
    trigger: (id: string) => api.post<Envelope<{ queued: boolean }>>(`/schedules/${id}/trigger`),
    history: (id: string, limit?: number) =>
      api.get<Envelope<ScheduledResult[]>>(`/schedules/${id}/history`, { params: { limit } }),
    downloadResult: (id: string, resultId: string) =>
      api.get<Blob>(`/schedules/${id}/results/${resultId}/download`, { responseType: 'blob' }),
  },
  // Row-level security policies (admin-only routes)
  security: {
    listPolicies: () => api.get<Envelope<SecurityPolicy[]>>('/security/policies'),
    getPolicy: (id: string) => api.get<Envelope<SecurityPolicy>>(`/security/policies/${id}`),
    createPolicy: (data: CreateSecurityPolicyInput) =>
      api.post<Envelope<SecurityPolicy>>('/security/policies', data),
    updatePolicy: (id: string, data: UpdateSecurityPolicyInput) =>
      api.put<Envelope<SecurityPolicy>>(`/security/policies/${id}`, data),
    deletePolicy: (id: string) =>
      api.delete<Envelope<{ deleted: boolean }>>(`/security/policies/${id}`),
    listAssignments: (policyId: string) =>
      api.get<Envelope<SecurityPolicyAssignment[]>>(`/security/policies/${policyId}/assignments`),
    assign: (policyId: string, data: { userId?: string; roleName?: string }) =>
      api.post<Envelope<SecurityPolicyAssignment>>(`/security/policies/${policyId}/assignments`, data),
    unassign: (policyId: string, assignmentId: string) =>
      api.delete<Envelope<{ deleted: boolean }>>(
        `/security/policies/${policyId}/assignments/${assignmentId}`,
      ),
    test: (data: { sql: string; policyId?: string; predicates?: string[] }) =>
      api.post<Envelope<SecurityPolicyTestResult>>('/security/policies/test', data),
  },
  // Migration (admin-only; source credentials come from the registered data
  // source, never from the browser)
  migration: {
    detectVersion: (dataSourceId: string, schemaOwner?: string) =>
      api.post<Envelope<EulVersionInfo>>('/migration/detect', { dataSourceId, schemaOwner }),
    analyze: (dataSourceId: string, schemaOwner?: string) =>
      api.post<Envelope<AssessmentReport>>('/migration/analyze', { dataSourceId, schemaOwner }),
    run: (data: StartMigrationInput) => api.post<Envelope<MigrationJob>>('/migration/run', data),
    // Rebuilds only the maps, for a database migrated before the tool could
    // read the workbook body. Destructive for migrated maps — see the
    // migration docs.
    reimportMaps: (data: StartMapReimportInput) =>
      api.post<Envelope<MigrationJob>>('/migration/reimport-maps', data),
    listJobs: () => api.get<Envelope<MigrationJob[]>>('/migration/jobs'),
    getJob: (jobId: string) => api.get<Envelope<MigrationJob>>(`/migration/jobs/${jobId}`),
  },
  // Audit log (admin-only)
  audit: {
    query: (filters: AuditQueryFilters) =>
      api.get<AuditQueryResponse>('/audit', { params: filters }),
    stats: (dateFrom?: string, dateTo?: string) =>
      api.get<Envelope<AuditStats>>('/audit/stats', { params: { dateFrom, dateTo } }),
    entityHistory: (entityType: string, entityId: string) =>
      api.get<Envelope<AuditLogEntry[]>>(`/audit/entity/${entityType}/${entityId}`),
    userActivity: (userId: string, limit?: number) =>
      api.get<Envelope<AuditLogEntry[]>>(`/audit/user/${userId}`, { params: { limit } }),
  },
  dashboard: {
    getStats: () => api.get<Envelope<DashboardStats>>('/dashboard/stats'),
  },
}

export default api
