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
  FolderRefreshResult,
  FunctionRefreshResponse,
  Item,
  ItemValues,
  Join,
  JoinSuggestion,
  Hierarchy,
  CustomFunction,
  DatabaseFunction,
  AppUser,
  MapSummary,
  MapWithDetails,
  WorkbookWithMaps,
  WorkbookShares,
  DashboardStats,
  CreateMapInput,
  UpdateMapInput,
  MapCalculatedFieldInput,
  ExecuteResult,
  ExecuteMapBody,
  DrillToDetailBody,
  MapRun,
  ExecutionHistoryEntry,
  ExecutionErrorKind,
  RefusalCode,
  QueryPlanSummary,
  PlanDraftItem,
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
  ConditionalFormatRule,
  ConditionalFormatInput,
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

let refreshInFlight: Promise<string> | null = null

/**
 * Exchange the refresh token for a new token pair; resolves to the new access
 * token. Concurrent callers share one request: each refresh token works once,
 * so two parallel refreshes would spend it twice and end the session.
 */
export function refreshSession(): Promise<string> {
  refreshInFlight ??= (async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) throw new Error('No refresh token')
    const response = await api.post<{ data: { token: string; refreshToken: string } }>(
      '/auth/refresh',
      { refreshToken }
    )
    const { token, refreshToken: next } = response.data.data
    useAuthStore.getState().setTokens(token, next)
    return token
  })().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

// Response interceptor — on a 401 from an already-authenticated call, refresh
// once and retry (access tokens live 15 minutes, so an expired one is routine).
// If that fails the session is over: logout+redirect. Login and refresh
// requests report their own 401s locally (inline form error / useAuth's
// session-expired flow) and must not be short-circuited here.
const AUTH_SELF_HANDLED_PATHS = ['/auth/login', '/auth/refresh']

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401 && error.config) {
      const config = error.config as typeof error.config & { _retried?: boolean }
      const url = config.url ?? ''
      const selfHandled = AUTH_SELF_HANDLED_PATHS.some((path) => url.includes(path))
      if (!selfHandled) {
        if (!config._retried && useAuthStore.getState().refreshToken) {
          config._retried = true
          try {
            config.headers.Authorization = `Bearer ${await refreshSession()}`
            return await api(config)
          } catch {
            // fall through: the session cannot be renewed
          }
        }
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
      api.post<{ data: { token: string; refreshToken: string; user: AuthUser } }>('/auth/login', {
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
    // Re-read the table/view from the data source and sync the items.
    refresh: (id: string) => api.post<Envelope<FolderRefreshResult[]>>(`/folders/${id}/refresh`),
    refreshAll: (businessAreaId: string) =>
      api.post<Envelope<FolderRefreshResult[]>>(`/business-areas/${businessAreaId}/folders/refresh`),
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
    /**
     * The item's live list of values — read from the customer's database at
     * call time, never a stored enum. 422 means "this item has no pick-list",
     * which is a fact about the metadata, not an error to surface.
     */
    values: (id: string, params: { search?: string; limit?: number } = {}) =>
      api.get<Envelope<ItemValues>>(`/items/${id}/values`, { params }),
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
    // Re-read signatures from Oracle; recompiles calculated fields when one changed.
    refresh: (id: string) => api.post<Envelope<FunctionRefreshResponse>>(`/custom-functions/${id}/refresh`),
    refreshAll: () => api.post<Envelope<FunctionRefreshResponse>>('/custom-functions/refresh'),
    searchDatabase: (dataSourceId: string, params: { owner?: string; search?: string }) =>
      api.get<Envelope<{ owner: string; functions: DatabaseFunction[]; truncated: boolean }>>(
        `/data-sources/${dataSourceId}/functions`,
        { params },
      ),
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
    // One page; the server caps a page at 1000 objects (F-14). `tablesAll`
    // walks every page so a dialog can offer the whole schema.
    tables: (id: string, tableOwner?: string, page: { limit?: number; offset?: number } = {}) =>
      api.get<Envelope<{ tables: IntrospectedTable[]; count: number; total: number; limit: number; offset: number }>>(
        `/data-sources/${id}/tables`,
        { params: { tableOwner, ...page } },
      ),
    tablesAll: async (id: string, tableOwner?: string): Promise<IntrospectedTable[]> => {
      const limit = 1000
      const all: IntrospectedTable[] = []
      for (let offset = 0; ; offset += limit) {
        const { data } = (await apiClient.dataSources.tables(id, tableOwner, { limit, offset })).data
        all.push(...data.tables)
        if (data.tables.length === 0 || all.length >= data.total) return all
      }
    },
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
    /**
     * Re-issue temporary passwords and download them as a CSV. Omit `userIds`
     * for every account still on a temporary password — the migrated ones.
     * The response is the file itself, not JSON.
     */
    issueCredentials: (userIds?: string[]) =>
      api.post<string>('/users/credentials', userIds ? { userIds } : {}, {
        responseType: 'text',
      }),
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
    /**
     * Classify a canvas without running it (D-117).
     *
     * Called as the builder's canvas changes, so a fan-trap refusal is shown
     * while the user is still composing — rather than after they press Run,
     * wait for production Oracle, and read an explanation.
     */
    plan: (items: PlanDraftItem[]) =>
      api.post<Envelope<QueryPlanSummary>>('/maps/plan', { items }),
    execute: (id: string, body: ExecuteMapBody = {}) =>
      api.post<Envelope<ExecuteResult>>(`/maps/${id}/execute`, body),
    /**
     * Request a run (Task 3.1's queue, replacing `executeAsync`). The backend
     * answers `200` when it re-used a still-valid result and `202` when it
     * queued a new one (see Spec > "same map, same conditions") — the HTTP
     * status is the only signal for that, there is no field for it in the body.
     */
    requestRun: async (
      id: string,
      body: { parameters?: Record<string, unknown>; calculatedFields?: MapCalculatedFieldInput[]; force?: boolean } = {}
    ): Promise<{ data: MapRun; reused: boolean }> => {
      const res = await api.post<Envelope<MapRun>>(`/maps/${id}/runs`, body)
      return { data: res.data.data, reused: res.status === 200 }
    },
    /** Oracle's execution plan for the map's statement. Administrators only. */
    explain: (id: string, body: ExecuteMapBody = {}) =>
      api.post<Envelope<{ sql: string; plan: string }>>(`/maps/${id}/explain`, body),
    drillToDetail: (id: string, body: DrillToDetailBody) =>
      api.post<Envelope<ExecuteResult>>(`/maps/${id}/drill-to-detail`, body),
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
    // Conditional formats — kept off the general map update (a save replaces
    // every map item, which anchors these); own lifecycle, own routes.
    listConditionalFormats: (id: string) =>
      api.get<Envelope<ConditionalFormatRule[]>>(`/maps/${id}/conditional-formats`),
    createConditionalFormat: (id: string, data: ConditionalFormatInput) =>
      api.post<Envelope<ConditionalFormatRule>>(`/maps/${id}/conditional-formats`, data),
    updateConditionalFormat: (id: string, formatId: string, data: Partial<ConditionalFormatInput>) =>
      api.put<Envelope<ConditionalFormatRule>>(`/maps/${id}/conditional-formats/${formatId}`, data),
    deleteConditionalFormat: (id: string, formatId: string) =>
      api.delete<void>(`/maps/${id}/conditional-formats/${formatId}`),
  },
  // Map runs — the queue behind `maps.requestRun`. Addressed by their own id
  // (not nested under the map), same shape as `exports` below.
  runs: {
    list: (
      params: { mapId?: string; status?: MapRun['status']; kind?: MapRun['kind']; limit?: number; all?: boolean } = {}
    ) => api.get<Envelope<MapRun[]>>('/runs', { params }),
    get: (id: string) => api.get<Envelope<MapRun>>(`/runs/${id}`),
    rows: (id: string, offset?: number, limit?: number) =>
      api.get<Envelope<Record<string, unknown>[]>>(`/runs/${id}/rows`, {
        params: { offset, limit },
      }),
    // Cancels a still-QUEUED run, or deletes a finished one and its batches.
    cancel: (id: string) =>
      api.delete<Envelope<{ cancelled: boolean; deleted?: boolean }>>(`/runs/${id}`),
  },
  // Workbook browse view (Phase 7.1b) — read-only grouping of maps by their
  // source workbook. Same visibility as maps.listAll(); see workbooks.ts.
  workbooks: {
    listBrowse: () => api.get<Envelope<WorkbookWithMaps[]>>('/workbooks'),
    /** Who holds the workbook, and on how many of its worksheets. */
    listShares: (id: string) =>
      api.get<Envelope<WorkbookShares>>(`/workbooks/${id}/shares`),
    /**
     * Share every worksheet of a workbook at once — the unit Discoverer
     * shared in. Admin and manager only. `refused` names any worksheet the
     * caller could see but not pass on.
     */
    share: (id: string, userId: string, permissionLevel: SharePermissionLevel) =>
      api.post<Envelope<{ shared: number; refused: string[] }>>(`/workbooks/${id}/shares`, {
        userId,
        permissionLevel,
      }),
    revokeShare: (id: string, userId: string) =>
      api.delete<Envelope<{ revoked: number }>>(`/workbooks/${id}/shares/${userId}`),
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
    // Re-imports every object in place with the current migrator (delta).
    reimportAll: (data: StartMapReimportInput) =>
      api.post<Envelope<MigrationJob>>('/migration/delta', data),
    // Compiles every calculated field in place; reads no EUL.
    compile: () => api.post<Envelope<MigrationJob>>('/migration/compile'),
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
