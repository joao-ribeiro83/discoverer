import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { BindParameters, Connection } from 'oracledb';
import { db } from '../db/index.js';
import {
  folders,
  queryExecutionLog,
  securityPolicies,
  securityPolicyRules,
  users,
} from '../db/schema.js';
import {
  generateSql,
  loadMapDefinition,
  validateSql,
} from './sql-generator.js';
import type {
  ColumnFormat,
  GeneratedColumn,
  GeneratedTotal,
  GeneratedTotalsQuery,
  MapDefinition,
  SecurityPredicate,
} from '../types/sql.js';
import { getUserPolicies } from './security.service.js';
import {
  assertDataEntitlement,
  businessAreasForFolders,
  DataEntitlementError,
} from './business-area.service.js';
import {
  effectiveFolderSet,
  securityRelevantFolderIds,
} from '../lib/sql/folder-set.js';
import * as pool from './oracle-connection-pool.js';
import {
  resolveParametersForDefinitions,
  ParameterResolutionError,
} from './parameter-resolver.js';
import {
  evaluateCalculatedFields,
  CalculatedFieldError,
  type CalcFieldInput,
} from './calculated-field-evaluator.js';

// ---------------------------------------------------------------------------
// Safeguards / tunables
// ---------------------------------------------------------------------------

/** Rows returned by a synchronous execution before truncation kicks in. */
export const MAX_SYNC_ROWS = 1000;
/** Default and hard-max statement timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_TIMEOUT_MS = 30_000;
/** Upper bound on rows an async job buffers in memory. */
export const ASYNC_MAX_ROWS = 100_000;
const ASYNC_FETCH_BATCH = 1_000;

/**
 * node-oracledb's OUT_FORMAT_OBJECT constant. Hard-coded so this service stays
 * driver-agnostic (and unit-testable without the native module); the value is
 * a stable part of the oracledb public API.
 */
const OUT_FORMAT_OBJECT = 4002;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExecuteOptions {
  /** Statement timeout in ms; clamped to (0, MAX_TIMEOUT_MS]. */
  timeoutMs?: number;
  /** Sync row cap; clamped to (0, MAX_SYNC_ROWS]. */
  maxRows?: number;
  /**
   * Ad-hoc calculated columns evaluated in-process on the result rows after the
   * query returns. These reference the query's *output* columns and are added
   * without re-running the query. (Stored map calculated fields, by contrast,
   * are compiled into the SQL by the generator.)
   */
  calculatedFields?: CalcFieldInput[];
  /**
   * Row offset for "load more" pagination on the sync endpoint. The SQL
   * generator already supports OFFSET/FETCH (see `lib/sql/pagination.ts`), so
   * a page can be re-run with a growing offset instead of switching to the
   * async path. Ignored by the async job runner (which always streams the
   * full result up to `ASYNC_MAX_ROWS`).
   */
  offset?: number;
}

export interface ResultColumn extends ColumnFormat {
  /** Column name as reported by Oracle. */
  name: string;
  /** Human-facing label from the map definition. */
  label: string;
  isAggregate: boolean;
}

/**
 * One executed totals statement: the metadata the generator planned, plus the
 * numbers it returned.
 *
 * A grand-total group has exactly one row. A break group (`breakAlias` set)
 * has one row per distinct value of the break column, each carrying that value
 * under `breakAlias` — which is what lets a renderer drop a subtotal line in
 * at each change without matching on row position.
 */
export interface ResultTotalsGroup {
  breakAlias: string | null;
  breakLabel?: string;
  /** Alias of the break column in the main result set, when it is drawn. */
  breakTargetAlias?: string;
  totals: GeneratedTotal[];
  rows: Record<string, unknown>[];
}

export interface ExecuteResult {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  /** Number of rows returned to the caller (after any truncation). */
  rowCount: number;
  executionTimeMs: number;
  /** True when more rows existed than were returned. */
  truncated: boolean;
  /**
   * The generated SQL actually sent to Oracle. A user who can execute a map
   * already sees its underlying folders/tables in the map builder, so this
   * adds no new exposure; it lets the UI offer a "view SQL" affordance.
   */
  sql?: string;
  /**
   * Aliases of the group/break columns, outermost first — where a renderer
   * draws a break at each change. Absent when the map has no group sort.
   */
  groupBreakAliases?: string[];
  /**
   * Totals and subtotals the map defines, each already run. Absent when the
   * map defines none.
   */
  totals?: ResultTotalsGroup[];
  /**
   * Map semantics this run could not honour — a sort dropped because the
   * statement is `SELECT DISTINCT`, a total whose aggregate did not migrate, a
   * totals statement Oracle rejected. The rows above are still valid.
   */
  warnings?: string[];
}

export interface PreparedQuery {
  sql: string;
  bindParams: Record<string, unknown>;
  columns: GeneratedColumn[];
  dataSourceId: string;
  /** Break columns the statement sorts on first, outermost first. */
  groupBreakAliases?: string[];
  /** Totals statements to run alongside `sql`; empty when the map has none. */
  totals?: GeneratedTotalsQuery[];
  /** Advisories from generation; carried through to `ExecuteResult`. */
  warnings?: string[];
}

export type ExecutionErrorKind =
  | 'CONFIG'
  | 'CONNECT'
  | 'TIMEOUT'
  | 'QUERY'
  | 'CANCELLED'
  /** The user may see the map object but not the data it reads (D-016/D-116). */
  | 'FORBIDDEN';

export class MapExecutionError extends Error {
  constructor(
    public kind: ExecutionErrorKind,
    message: string,
    public override cause?: unknown,
  ) {
    super(message);
    this.name = 'MapExecutionError';
  }
}

export type AsyncJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export interface AsyncJob {
  jobId: string;
  mapId: string;
  status: AsyncJobStatus;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  rowCount?: number;
  executionTimeMs?: number;
  truncated?: boolean;
  error?: string;
  /** Populated once the job reaches COMPLETED. */
  result?: ExecuteResult;
}

/** Persisted-log status is a narrower set than the in-memory job status. */
export interface ExecutionLogEntry {
  mapId: string;
  executedBy: string;
  executionTimeMs: number;
  rowCount: number | null;
  sqlText: string | null;
  errorMessage: string | null;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
}

// ---------------------------------------------------------------------------
// Injectable dependencies (real implementations by default; mocked in tests)
// ---------------------------------------------------------------------------

export interface MapExecutionDeps {
  prepareQuery(
    mapId: string,
    parameterValues: Record<string, unknown>,
    userId: string,
    rowLimit?: number,
    offset?: number,
  ): Promise<PreparedQuery>;
  getConnection(dataSourceId: string): Promise<Connection>;
  releaseConnection(dataSourceId: string, conn: Connection): Promise<void>;
  recordExecution(entry: ExecutionLogEntry): Promise<void>;
}

export function defaultDeps(): MapExecutionDeps {
  return {
    prepareQuery: defaultPrepareQuery,
    getConnection: pool.getConnection,
    releaseConnection: pool.releaseConnection,
    recordExecution: defaultRecordExecution,
  };
}

/**
 * Resolve the single Oracle data source a map targets. A map's SQL cannot span
 * more than one physical database, so the folders it touches must agree.
 */
export function resolveDataSourceId(def: MapDefinition): string {
  const ids = new Set<string>();
  for (const { folder } of def.items) {
    if (folder.dataSourceId) ids.add(folder.dataSourceId);
  }
  for (const { folder } of def.conditions) {
    if (folder.dataSourceId) ids.add(folder.dataSourceId);
  }
  if (ids.size === 0) {
    throw new MapExecutionError(
      'CONFIG',
      'This map has no data source configured on its folders',
    );
  }
  if (ids.size > 1) {
    throw new MapExecutionError(
      'CONFIG',
      'This map spans multiple data sources, which cannot be executed as one query',
    );
  }
  return [...ids][0]!;
}

export interface ResolvedRowSecurity {
  predicates: SecurityPredicate[];
  /** Context binds predicates may reference; the WHERE builder includes only
   *  the ones an applied predicate actually uses. */
  bindParams: Record<string, unknown>;
}

/**
 * Row-level security predicates for the executing user.
 *
 * The user's ACTIVE assigned policies (direct or via role) are matched against
 * the map's EFFECTIVE FOLDER SET (D-115) — every folder whose column values
 * reach the statement, plus every join bridge that can change which rows come
 * back. `maps.business_area_id` is not consulted: it is advisory and nullable
 * (D-013), and `rule.targetId === null` would have matched nothing, silently
 * running every query unfiltered.
 *
 * A BUSINESS_AREA rule fires when any folder in that set belongs to the rule's
 * business area — owning it, or shared into it via `folder_business_areas`.
 * A FOLDER rule fires when it targets a folder in the set. Applicable
 * predicates are ANDed into the WHERE clause by the SQL generator; folder
 * rules may use `{alias}` for their folder's query alias, and any rule may use
 * the `:current_user_*` context binds.
 *
 * Fails closed twice:
 *  - an unknown executing user is refused rather than run without policies;
 *  - a folder in the set that SOMEONE's active policy targets, but for which
 *    THIS user resolves no predicate, is refused by name (D-116). Against an
 *    empty `security_policy_rules` table that rule is a no-op, and it becomes
 *    correct the instant the first policy is written.
 *
 * Exported for the security test-suite; production callers go through
 * `defaultPrepareQuery`.
 */
export async function resolveSecurityPredicates(
  def: MapDefinition,
  userId: string,
): Promise<ResolvedRowSecurity> {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new MapExecutionError(
      'CONFIG',
      'Executing user not found — cannot resolve row-level security',
    );
  }

  const usedFolderIds = securityRelevantFolderIds(effectiveFolderSet(def));
  if (usedFolderIds.length === 0) return { predicates: [], bindParams: {} };

  const baByFolder = await businessAreasForFolders(usedFolderIds);

  const policies = await getUserPolicies(user.id, user.role);
  const predicates: SecurityPredicate[] = [];
  /** Folders this user actually resolved a predicate for. */
  const covered = new Set<string>();

  for (const policy of policies) {
    for (const rule of policy.rules) {
      if (rule.targetType === 'BUSINESS_AREA') {
        const matched = usedFolderIds.filter((folderId) =>
          (baByFolder.get(folderId) ?? []).includes(rule.targetId),
        );
        if (matched.length > 0) {
          predicates.push({ sql: rule.sqlPredicate });
          for (const folderId of matched) covered.add(folderId);
        }
      } else if (
        rule.targetType === 'FOLDER' &&
        usedFolderIds.includes(rule.targetId)
      ) {
        predicates.push({ sql: rule.sqlPredicate, folderId: rule.targetId });
        covered.add(rule.targetId);
      }
    }
  }

  await assertPolicyBearingFoldersCovered(usedFolderIds, baByFolder, covered);

  if (predicates.length === 0) return { predicates: [], bindParams: {} };

  return {
    predicates,
    bindParams: {
      current_user_id: user.id,
      current_user_email: user.email,
      current_user_role: user.role,
    },
  };
}

/**
 * Fail closed per policy-bearing folder (D-116).
 *
 * A folder is policy-bearing when at least one rule of an ACTIVE policy —
 * anyone's — targets it, or targets a business area it belongs to. If the
 * executing user resolved no predicate for such a folder, the query is refused
 * by name instead of running unfiltered.
 *
 * Deliberately NOT a global fail-closed. `getUserPolicies` returning empty
 * means "no predicates", and flipping that globally would return zero rows for
 * every map in the estate, because `security_policy_rules` is empty today. The
 * full treatment is Phase 6.3 (D-090). Inactive policies are excluded: their
 * rules apply to nobody, so treating their folders as policy-bearing would
 * lock everyone out with no way to satisfy the check.
 *
 * Admins are NOT exempt. They bypass the grant gate above; "which rows may I
 * see" is a different question, and a policy an admin silently escaped would
 * be no policy at all.
 */
async function assertPolicyBearingFoldersCovered(
  usedFolderIds: string[],
  baByFolder: globalThis.Map<string, string[]>,
  covered: Set<string>,
): Promise<void> {
  const uncovered = usedFolderIds.filter((id) => !covered.has(id));
  if (uncovered.length === 0) return;

  const businessAreaIds = [
    ...new Set(uncovered.flatMap((id) => baByFolder.get(id) ?? [])),
  ];
  const targetIds = [...new Set([...uncovered, ...businessAreaIds])];

  const rows = await db
    .select({
      targetId: securityPolicyRules.targetId,
      targetType: securityPolicyRules.targetType,
    })
    .from(securityPolicyRules)
    .innerJoin(
      securityPolicies,
      eq(securityPolicyRules.policyId, securityPolicies.id),
    )
    .where(
      and(
        eq(securityPolicies.isActive, true),
        inArray(securityPolicyRules.targetId, targetIds),
      ),
    );
  if (rows.length === 0) return;

  const targeted = new Set(rows.map((r) => r.targetId));
  const blocked = uncovered.filter(
    (id) =>
      targeted.has(id) ||
      (baByFolder.get(id) ?? []).some((ba) => targeted.has(ba)),
  );
  if (blocked.length === 0) return;

  const names = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(inArray(folders.id, blocked));
  const label = names.map((f) => `"${f.name}"`).join(', ') || blocked.join(', ');

  throw new MapExecutionError(
    'FORBIDDEN',
    `Refusing to run unfiltered: no row-level security policy resolves for you on folder(s) ${label}`,
  );
}

/**
 * Resolve a map's declared parameters against the supplied values: apply
 * defaults, coerce each to its declared type, and refuse execution if a
 * required parameter is missing.
 *
 * Callers supply values keyed by prompt (that is what the run-time dialog and
 * a schedule's stored values hold); what comes back is keyed by bind name,
 * which is what the WHERE builder looks up. Undeclared supplied values are
 * passed through untouched so a condition naming a parameter the map never
 * declared keeps working — those keys are already bind names.
 */
function resolveParametersForQuery(
  def: MapDefinition,
  parameterValues: Record<string, unknown>,
): Record<string, unknown> {
  let resolved: Record<string, unknown>;
  let missing: string[];
  try {
    ({ resolved, missing } = resolveParametersForDefinitions(
      def.parameters,
      parameterValues,
    ));
  } catch (err) {
    if (err instanceof ParameterResolutionError) {
      throw new MapExecutionError('CONFIG', err.message, err);
    }
    throw err;
  }

  if (missing.length > 0) {
    throw new MapExecutionError(
      'CONFIG',
      `Missing required parameter(s): ${missing.join(', ')}`,
    );
  }

  // Both spellings of a declared parameter are consumed above; only keys that
  // match neither are pass-throughs.
  const definedNames = new Set(
    def.parameters.flatMap((p) => [p.name, p.bindName]),
  );
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameterValues)) {
    if (!definedNames.has(key) && value !== undefined && value !== null) {
      merged[key] = value;
    }
  }
  // Declared parameters (typed + defaulted) take precedence over pass-throughs.
  Object.assign(merged, resolved);
  return merged;
}

/**
 * Apply ad-hoc calculated fields to a result set, appending their columns.
 * A malformed formula is a caller configuration error (CONFIG), not a DB fault.
 * Exported for reuse by `export.service.ts`.
 */
export function applyCalculatedFields(
  rows: Record<string, unknown>[],
  columns: ResultColumn[],
  calculatedFields: CalcFieldInput[] | undefined,
): { rows: Record<string, unknown>[]; columns: ResultColumn[] } {
  if (!calculatedFields || calculatedFields.length === 0) {
    return { rows, columns };
  }
  try {
    const evaluated = evaluateCalculatedFields(rows, calculatedFields, {
      columns: columns.map((c) => ({ name: c.name, label: c.label })),
    });
    const added: ResultColumn[] = evaluated.columns.map((c) => ({
      name: c.name,
      label: c.label,
      isAggregate: false,
    }));
    return { rows: evaluated.rows, columns: [...columns, ...added] };
  } catch (err) {
    if (err instanceof CalculatedFieldError) {
      throw new MapExecutionError('CONFIG', err.message, err);
    }
    throw err;
  }
}

async function defaultPrepareQuery(
  mapId: string,
  parameterValues: Record<string, unknown>,
  userId: string,
  rowLimit?: number,
  offset?: number,
): Promise<PreparedQuery> {
  const def = await loadMapDefinition(mapId);
  const dataSourceId = resolveDataSourceId(def);

  // GATE 2 of 2 (D-016). `canAccessMap` upstream answered "may you see this
  // map object"; this answers "may you read the data it touches". It runs on
  // every execute and export path — they all come through here — because four
  // of canAccessMap's five grant paths return before any business-area check,
  // so a shared or public map would otherwise be a grant escalation.
  try {
    await assertDataEntitlement(
      userId,
      securityRelevantFolderIds(effectiveFolderSet(def)),
    );
  } catch (err) {
    if (err instanceof DataEntitlementError) {
      throw new MapExecutionError('FORBIDDEN', err.message, err);
    }
    throw err;
  }

  const security = await resolveSecurityPredicates(def, userId);
  const resolvedParams = resolveParametersForQuery(def, parameterValues);

  const generated = generateSql(def, {
    parameterValues: resolvedParams,
    securityPredicates: security.predicates,
    securityBindParams: security.bindParams,
    rowLimit,
    offset,
  });

  // Defence in depth: the generator only ever emits a single SELECT, but we
  // refuse anything else before it reaches Oracle. Totals statements come off
  // the same generator and get the same check.
  for (const statement of [
    generated.sql,
    ...generated.totals.map((t) => t.sql),
  ]) {
    const check = validateSql(statement);
    if (!check.valid) {
      throw new MapExecutionError(
        'QUERY',
        `Refusing to execute generated SQL: ${check.error}`,
      );
    }
  }

  return {
    sql: generated.sql,
    bindParams: generated.bindParams,
    columns: generated.columns,
    dataSourceId,
    groupBreakAliases: generated.groupBreakAliases,
    totals: generated.totals,
    warnings: generated.warnings,
  };
}

/**
 * Run a prepared query's totals statements on the connection that just served
 * the detail rows.
 *
 * A failed totals statement degrades to a warning instead of failing the run:
 * a report whose subtotal line is missing is still the report, and refusing to
 * show any rows because a summary would not compute is the worse trade.
 */
async function runTotalsQueries(
  conn: Connection,
  totals: GeneratedTotalsQuery[],
): Promise<{ groups: ResultTotalsGroup[]; warnings: string[] }> {
  const groups: ResultTotalsGroup[] = [];
  const warnings: string[] = [];

  for (const query of totals) {
    try {
      const result = await conn.execute(
        query.sql,
        query.bindParams as BindParameters,
        { outFormat: OUT_FORMAT_OBJECT },
      );
      groups.push({
        breakAlias: query.breakAlias,
        breakLabel: query.breakLabel,
        breakTargetAlias: query.breakTargetAlias,
        totals: query.totals,
        rows: (result.rows ?? []) as Record<string, unknown>[],
      });
    } catch (err) {
      warnings.push(
        query.breakLabel
          ? `Subtotals by "${query.breakLabel}" could not be computed: ${errorMessage(err)}`
          : `Totals could not be computed: ${errorMessage(err)}`,
      );
    }
  }

  return { groups, warnings };
}

async function defaultRecordExecution(entry: ExecutionLogEntry): Promise<void> {
  await db.insert(queryExecutionLog).values({
    mapId: entry.mapId,
    executedBy: entry.executedBy,
    executionTimeMs: entry.executionTimeMs,
    rowCount: entry.rowCount,
    sqlText: entry.sqlText,
    errorMessage: entry.errorMessage,
    status: entry.status,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampTimeout(ms?: number): number {
  if (ms == null || Number.isNaN(ms)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(ms), 1_000), MAX_TIMEOUT_MS);
}

function clampSyncMaxRows(n?: number): number {
  if (n == null || Number.isNaN(n)) return MAX_SYNC_ROWS;
  return Math.min(Math.max(Math.floor(n), 1), MAX_SYNC_ROWS);
}

/** Oracle raises DPI-1067 / an ORA timeout when callTimeout aborts a call. */
function isTimeoutError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === 'DPI-1067' ||
    /\bDPI-1067\b/.test(message) ||
    /call\s*timeout|callTimeout|timed?\s*out|timeout/i.test(message)
  );
}

/** `connection.break()` surfaces as ORA-01013 (user requested cancel). */
function isCancelError(err: unknown): boolean {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : String(err);
  return code === 'ORA-01013' || /\bORA-01013\b|cancel/i.test(message);
}

/** Extract a printable message from a thrown value. Exported for reuse by `export.service.ts`. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function asExecutionError(
  err: unknown,
  kind: ExecutionErrorKind,
): MapExecutionError {
  if (err instanceof MapExecutionError) return err;
  return new MapExecutionError(kind, errorMessage(err), err);
}

/**
 * Reconcile the generator's declared columns with the driver's actual result
 * metadata. Exported so `export.service.ts` can build the same column shape
 * without duplicating this logic.
 */
export function buildColumns(
  gen: GeneratedColumn[],
  metaData?: Array<{ name: string }>,
): ResultColumn[] {
  const format = (c: GeneratedColumn | undefined): ColumnFormat => ({
    dataType: c?.dataType,
    formatMask: c?.formatMask,
    columnWidth: c?.columnWidth,
    alignment: c?.alignment,
    wordWrap: c?.wordWrap,
    headingFormatMask: c?.headingFormatMask,
    axisType: c?.axisType,
    axisEdge: c?.axisEdge,
  });

  if (metaData && metaData.length === gen.length) {
    return gen.map((c, i) => ({
      name: metaData[i]!.name,
      label: c.label,
      isAggregate: c.isAggregate,
      ...format(c),
    }));
  }
  if (metaData && metaData.length > 0) {
    return metaData.map((m, i) => ({
      name: m.name,
      label: gen[i]?.label ?? m.name,
      isAggregate: gen[i]?.isAggregate ?? false,
      ...format(gen[i]),
    }));
  }
  return gen.map((c) => ({
    name: c.alias,
    label: c.label,
    isAggregate: c.isAggregate,
    ...format(c),
  }));
}

async function safeRecord(
  deps: MapExecutionDeps,
  entry: ExecutionLogEntry,
): Promise<void> {
  try {
    await deps.recordExecution(entry);
  } catch {
    // Never let a logging failure mask the real execution outcome.
  }
}

// ---------------------------------------------------------------------------
// Synchronous execution
// ---------------------------------------------------------------------------

export async function executeMap(
  mapId: string,
  parameterValues: Record<string, unknown>,
  userId: string,
  options: ExecuteOptions = {},
  deps: MapExecutionDeps = defaultDeps(),
): Promise<ExecuteResult> {
  const maxRows = clampSyncMaxRows(options.maxRows);
  const timeoutMs = clampTimeout(options.timeoutMs);

  // Row offset for "load more" pagination; only meaningful with a positive value.
  const offset =
    options.offset != null && options.offset > 0
      ? Math.floor(options.offset)
      : undefined;

  // Push the cap (plus one probe row for truncation detection) into the SQL.
  const prepared = await deps.prepareQuery(
    mapId,
    parameterValues,
    userId,
    maxRows + 1,
    offset,
  );

  const start = Date.now();

  let conn: Connection;
  try {
    conn = await deps.getConnection(prepared.dataSourceId);
  } catch (err) {
    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs: Date.now() - start,
      rowCount: null,
      sqlText: prepared.sql,
      errorMessage: errorMessage(err),
      status: 'FAILED',
    });
    throw asExecutionError(err, 'CONNECT');
  }

  try {
    conn.callTimeout = timeoutMs;
    const result = await conn.execute(
      prepared.sql,
      prepared.bindParams as BindParameters,
      {
        outFormat: OUT_FORMAT_OBJECT,
        maxRows: maxRows + 1,
      },
    );

    const allRows = (result.rows ?? []) as Record<string, unknown>[];
    const truncated = allRows.length > maxRows;
    const baseRows = truncated ? allRows.slice(0, maxRows) : allRows;
    const baseColumns = buildColumns(prepared.columns, result.metaData);
    const { rows, columns } = applyCalculatedFields(
      baseRows,
      baseColumns,
      options.calculatedFields,
    );

    // Totals run on the same connection, after the detail rows, and over the
    // whole filtered set rather than the fetched page.
    const totals = prepared.totals ?? [];
    const totalsRun = totals.length
      ? await runTotalsQueries(conn, totals)
      : { groups: [], warnings: [] };
    const warnings = [...(prepared.warnings ?? []), ...totalsRun.warnings];

    const executionTimeMs = Date.now() - start;

    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs,
      rowCount: rows.length,
      sqlText: prepared.sql,
      errorMessage: null,
      status: 'SUCCESS',
    });

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
      truncated,
      sql: prepared.sql,
      ...(prepared.groupBreakAliases?.length
        ? { groupBreakAliases: prepared.groupBreakAliases }
        : {}),
      ...(totalsRun.groups.length ? { totals: totalsRun.groups } : {}),
      ...(warnings.length ? { warnings } : {}),
    };
  } catch (err) {
    const timedOut = isTimeoutError(err);
    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs: Date.now() - start,
      rowCount: null,
      sqlText: prepared.sql,
      errorMessage: errorMessage(err),
      status: timedOut ? 'TIMEOUT' : 'FAILED',
    });
    throw asExecutionError(err, timedOut ? 'TIMEOUT' : 'QUERY');
  } finally {
    await deps.releaseConnection(prepared.dataSourceId, conn);
  }
}

// ---------------------------------------------------------------------------
// Asynchronous execution (in-process job runner)
//
// Large result sets run in the background so the request can return a job id.
// State lives in-process: this is single-instance today. When file export
// (a later session) introduces a durable queue/worker, `runAsyncJob` is the
// seam to move onto it — the public API here does not change.
// ---------------------------------------------------------------------------

const jobs = new Map<string, AsyncJob>();
const activeConnections = new Map<
  string,
  { dataSourceId: string; conn: Connection }
>();
const cancelRequested = new Set<string>();

export function executeMapAsync(
  mapId: string,
  parameterValues: Record<string, unknown>,
  userId: string,
  options: ExecuteOptions = {},
  deps: MapExecutionDeps = defaultDeps(),
): Promise<{ jobId: string }> {
  const jobId = randomUUID();
  jobs.set(jobId, { jobId, mapId, status: 'QUEUED', createdAt: new Date() });
  // Fire-and-forget; runAsyncJob owns all state transitions and cleanup.
  void runAsyncJob(jobId, mapId, parameterValues, userId, options, deps);
  return Promise.resolve({ jobId });
}

/**
 * A lazily-consumed cursor over a result set.
 *
 * `metaData` is available immediately (it comes back with the `execute` call,
 * before any row is fetched), so callers can build their column shape and write
 * a file header before pulling the first batch.
 */
export interface RowStream {
  metaData?: Array<{ name: string }>;
  /** Successive non-empty batches of rows. Closes the cursor when exhausted. */
  batches: AsyncIterableIterator<Record<string, unknown>[]>;
  /** Idempotent; safe to call even after `batches` has finished. */
  close(): Promise<void>;
}

/**
 * Open a result set and hand back an async iterator over its batches, without
 * accumulating anything.
 *
 * This is the primitive `export.service.ts` needs: an export of 1M+ rows can
 * never hold the result set in memory, so it pulls one batch at a time and
 * hands each straight to a file writer. `streamRows` (below) is the buffering
 * convenience wrapper for callers that genuinely want an array.
 */
export async function openRowStream(
  conn: Connection,
  prepared: PreparedQuery,
  batchSize: number = ASYNC_FETCH_BATCH,
): Promise<RowStream> {
  const result = await conn.execute(
    prepared.sql,
    prepared.bindParams as BindParameters,
    {
      outFormat: OUT_FORMAT_OBJECT,
      resultSet: true,
    },
  );

  const rs = result.resultSet;

  if (!rs) {
    // No result set (should not happen for a SELECT) — fall back to rows.
    const rows = (result.rows ?? []) as Record<string, unknown>[];
    async function* single(): AsyncIterableIterator<Record<string, unknown>[]> {
      if (rows.length > 0) yield rows;
    }
    return {
      metaData: result.metaData,
      batches: single(),
      close: () => Promise.resolve(),
    };
  }

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await rs.close();
    } catch {
      // ignore — the connection is released by the caller regardless.
    }
  };

  // The `finally` also runs when a consumer breaks out of `for await` early
  // (which invokes the generator's `return`), so an abandoned cursor is still
  // closed. `close` is idempotent, so a belt-and-braces call by the caller is
  // harmless.
  async function* batches(): AsyncIterableIterator<Record<string, unknown>[]> {
    try {
      for (;;) {
        const batch = (await rs!.getRows(batchSize)) as Record<
          string,
          unknown
        >[];
        if (batch.length === 0) break;
        yield batch;
      }
    } finally {
      await close();
    }
  }

  return { metaData: result.metaData, batches: batches(), close };
}

/**
 * Buffer a result set into an array, up to `cap` rows.
 *
 * Used by the sync/async *execution* paths, which return rows over HTTP and so
 * are bounded by `ASYNC_MAX_ROWS` anyway. Exports must not use this — see
 * `openRowStream`.
 */
export async function streamRows(
  conn: Connection,
  prepared: PreparedQuery,
  cap: number,
): Promise<{
  rows: Record<string, unknown>[];
  truncated: boolean;
  metaData?: Array<{ name: string }>;
}> {
  const stream = await openRowStream(conn, prepared);

  const rows: Record<string, unknown>[] = [];
  let truncated = false;
  try {
    for await (const batch of stream.batches) {
      for (const row of batch) {
        if (rows.length >= cap) {
          truncated = true;
          break;
        }
        rows.push(row);
      }
      if (truncated) break;
    }
  } finally {
    await stream.close();
  }

  return { rows, truncated, metaData: stream.metaData };
}

async function runAsyncJob(
  jobId: string,
  mapId: string,
  parameterValues: Record<string, unknown>,
  userId: string,
  options: ExecuteOptions,
  deps: MapExecutionDeps,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const timeoutMs = clampTimeout(options.timeoutMs);
  job.status = 'RUNNING';
  job.startedAt = new Date();
  const start = Date.now();

  let prepared: PreparedQuery;
  try {
    prepared = await deps.prepareQuery(
      mapId,
      parameterValues,
      userId,
      ASYNC_MAX_ROWS + 1,
    );
  } catch (err) {
    finalizeFailure(job, deps, {
      userId,
      sqlText: null,
      err,
      elapsed: Date.now() - start,
    });
    return;
  }

  // Honour a cancel that arrived before we acquired a connection.
  if (cancelRequested.has(jobId)) {
    cancelRequested.delete(jobId);
    job.status = 'CANCELLED';
    job.executionTimeMs = Date.now() - start;
    job.finishedAt = new Date();
    job.error = 'Execution cancelled before it started';
    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs: job.executionTimeMs,
      rowCount: null,
      sqlText: prepared.sql,
      errorMessage: job.error,
      status: 'FAILED',
    });
    return;
  }

  let conn: Connection;
  try {
    conn = await deps.getConnection(prepared.dataSourceId);
  } catch (err) {
    finalizeFailure(job, deps, {
      userId,
      sqlText: prepared.sql,
      err,
      elapsed: Date.now() - start,
    });
    return;
  }

  activeConnections.set(jobId, { dataSourceId: prepared.dataSourceId, conn });

  /**
   * The terminal status is assigned LAST, in `finally`, once the execution-log
   * row and `finishedAt` are already in place. It used to be set first, so a
   * caller that polled to COMPLETED and immediately read the execution history
   * could find nothing there — the job said done while the audit trail said
   * nothing had happened. That race is what made the async-execution test
   * intermittent (F-23); it was a real defect, not a flaky assertion.
   */
  let terminal: AsyncJobStatus | null = null;

  try {
    conn.callTimeout = timeoutMs;
    const {
      rows: baseRows,
      truncated,
      metaData,
    } = await streamRows(conn, prepared, ASYNC_MAX_ROWS);
    const { rows, columns } = applyCalculatedFields(
      baseRows,
      buildColumns(prepared.columns, metaData),
      options.calculatedFields,
    );
    const executionTimeMs = Date.now() - start;

    terminal = 'COMPLETED';
    job.rowCount = rows.length;
    job.truncated = truncated;
    job.executionTimeMs = executionTimeMs;
    job.result = {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
      truncated,
      sql: prepared.sql,
    };

    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs,
      rowCount: rows.length,
      sqlText: prepared.sql,
      errorMessage: null,
      status: 'SUCCESS',
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    job.executionTimeMs = elapsed;

    if (cancelRequested.has(jobId) || isCancelError(err)) {
      terminal = 'CANCELLED';
      job.error = 'Execution cancelled by user';
      await safeRecord(deps, {
        mapId,
        executedBy: userId,
        executionTimeMs: elapsed,
        rowCount: null,
        sqlText: prepared.sql,
        errorMessage: job.error,
        status: 'FAILED',
      });
    } else if (isTimeoutError(err)) {
      terminal = 'TIMEOUT';
      job.error = errorMessage(err);
      await safeRecord(deps, {
        mapId,
        executedBy: userId,
        executionTimeMs: elapsed,
        rowCount: null,
        sqlText: prepared.sql,
        errorMessage: job.error,
        status: 'TIMEOUT',
      });
    } else {
      terminal = 'FAILED';
      job.error = errorMessage(err);
      await safeRecord(deps, {
        mapId,
        executedBy: userId,
        executionTimeMs: elapsed,
        rowCount: null,
        sqlText: prepared.sql,
        errorMessage: job.error,
        status: 'FAILED',
      });
    }
  } finally {
    activeConnections.delete(jobId);
    cancelRequested.delete(jobId);
    job.finishedAt = new Date();
    // Everything the status implies is now true. Flip it before releasing the
    // connection, so a poller is not held up by driver teardown.
    if (terminal) job.status = terminal;
    await deps.releaseConnection(prepared.dataSourceId, conn);
  }
}

function finalizeFailure(
  job: AsyncJob,
  deps: MapExecutionDeps,
  args: { userId: string; sqlText: string | null; err: unknown; elapsed: number },
): void {
  const timedOut = isTimeoutError(args.err);
  job.status = timedOut ? 'TIMEOUT' : 'FAILED';
  job.error = errorMessage(args.err);
  job.executionTimeMs = args.elapsed;
  job.finishedAt = new Date();
  void safeRecord(deps, {
    mapId: job.mapId,
    executedBy: args.userId,
    executionTimeMs: args.elapsed,
    rowCount: null,
    sqlText: args.sqlText,
    errorMessage: job.error,
    status: timedOut ? 'TIMEOUT' : 'FAILED',
  });
}

/** Snapshot of an async job's state, or null if the id is unknown. */
export function getExecutionStatus(jobId: string): AsyncJob | null {
  const job = jobs.get(jobId);
  return job ? { ...job } : null;
}

/**
 * Request cancellation of a running async job. Returns null for an unknown job.
 * Interrupts the in-flight Oracle call via `connection.break()` when possible.
 */
export async function cancelExecution(
  jobId: string,
): Promise<{ cancelled: boolean; status: AsyncJobStatus } | null> {
  const job = jobs.get(jobId);
  if (!job) return null;

  const terminal: AsyncJobStatus[] = ['COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED'];
  if (terminal.includes(job.status)) {
    return { cancelled: false, status: job.status };
  }

  cancelRequested.add(jobId);
  job.status = 'CANCELLED';

  const active = activeConnections.get(jobId);
  if (active) {
    try {
      await active.conn.break();
    } catch {
      // The call may have finished between our check and break() — the runner
      // still observes cancelRequested and settles the job as CANCELLED.
    }
  }

  return { cancelled: true, status: 'CANCELLED' };
}

/** Recent executions for a map, newest first. */
export async function getExecutionHistory(
  mapId: string,
  limit = 20,
): Promise<Array<typeof queryExecutionLog.$inferSelect>> {
  const capped = Math.min(Math.max(Math.floor(limit) || 20, 1), 200);
  return db
    .select()
    .from(queryExecutionLog)
    .where(eq(queryExecutionLog.mapId, mapId))
    .orderBy(desc(queryExecutionLog.executedAt))
    .limit(capped);
}

/** Test-only: clear in-memory async job state between test cases. */
export function _resetAsyncState(): void {
  jobs.clear();
  activeConnections.clear();
  cancelRequested.clear();
}
