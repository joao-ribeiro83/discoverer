import { randomUUID } from 'node:crypto';
import type { Connection } from 'oracledb';
import { loadMapDefinition, planQuery } from './sql-generator.js';
import { refusalError } from '../lib/sql/planner.js';
import { GenerationContext } from '../lib/sql/context.js';
import { buildSelectClause } from '../lib/sql/select-clause.js';
import {
  defaultDeps,
  prepareQueryForDefinition,
  buildColumns,
  wrapExecutionError,
  safeRecord,
  isTimeoutError,
  DEFAULT_TIMEOUT_MS,
  OUT_FORMAT_OBJECT,
  type MapExecutionDeps,
  type ExecuteResult,
  type ExecutionErrorKind,
} from './map-execution.service.js';
import type { MapDefinition } from '../types/sql.js';

/**
 * "Drill to detail": given a row from an aggregated worksheet, show the raw
 * rows it was computed from — Discoverer's own Drill to Detail. The map's
 * hierarchy-based drill up/down has nothing to run against in this estate
 * (`hierarchies` / `hierarchy_levels` are empty by design — see Decision 12's
 * sibling finding for conditional formats, and `AUDIT_LEGACY_COMPATIBILITY_
 * MATRIX.md`'s "Hierarchies: 508 → 0", correct per Phase 5.1) and no research
 * document survives in this repo to define its SQL semantics precisely, so it
 * is refused rather than guessed (`refuseHierarchyDrill` below) — this file
 * only implements the one drill direction that is well-defined and
 * verifiable without either.
 */

const MAX_DETAIL_ROWS = 1_000;

export class DrillNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrillNotAvailableError';
  }
}

/** Hierarchy-based drill (up/down along a level) has no data and no spec to build against. Callers refuse loudly with this rather than silently no-op. */
export function refuseHierarchyDrill(): never {
  throw new DrillNotAvailableError(
    'Drill up/down needs a hierarchy, and this estate has none: every source hierarchy is Discoverer\'s auto-generated date boilerplate, which Neo correctly does not migrate (Decision 12). Drill to detail on a row is available instead.',
  );
}

interface ResolvedAlias {
  itemId: string;
  folder: MapDefinition['items'][number]['folder'];
  /** True when the *un-drilled* query wrapped this column in an aggregate. */
  isAggregate: boolean;
}

/**
 * Resolve each drawn map item to the column alias the *un-drilled* query
 * would give it — the same alias `ExecuteResult.columns` already carries, so
 * a client's `rowValues` (keyed by that alias) resolves back to an item
 * without the client ever seeing a `map_items.id`.
 */
function resolveAliasToItem(def: MapDefinition): globalThis.Map<string, ResolvedAlias> {
  const plan = planQuery(def);
  const ctx = new GenerationContext(def, plan.kind === 'REFUSE' ? [] : plan.folderIds);
  const select = buildSelectClause(def, ctx);
  const byItemId = new globalThis.Map(def.items.map((e) => [e.mapItem.id, e]));
  const columnByAlias = new globalThis.Map(select.columns.map((c) => [c.alias, c]));
  const out = new globalThis.Map<string, ResolvedAlias>();
  for (const [mapItemId, alias] of select.aliasByMapItemId) {
    const entry = byItemId.get(mapItemId);
    if (entry) {
      out.set(alias, {
        itemId: entry.item.id,
        folder: entry.folder,
        isAggregate: columnByAlias.get(alias)?.isAggregate ?? false,
      });
    }
  }
  return out;
}

/** A row value coerced to the string a STATIC condition compares against. */
function conditionValueOf(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Turn a map definition into the one "drill to detail" needs: every item's
 * aggregation stripped (so a total or a grouped measure shows its raw
 * per-row value), no totals, no `SELECT DISTINCT`, and one extra equality
 * condition per pinned column — Oracle's `STATIC` condition machinery
 * already handles type coercion and `IS NULL`, so this reuses it rather than
 * hand-rolling a second WHERE-fragment builder.
 */
function toDrillDetailDefinition(
  def: MapDefinition,
  rowValues: Record<string, unknown>,
): MapDefinition {
  const aliasToItem = resolveAliasToItem(def);
  const folderByItemId = new globalThis.Map(def.items.map((e) => [e.item.id, e.folder]));

  const pinned: MapDefinition['conditions'] = [];
  for (const [alias, value] of Object.entries(rowValues)) {
    const resolved = aliasToItem.get(alias);
    if (!resolved) continue; // stale/unknown column — ignore rather than refuse on a harmless extra key
    // An aggregate column's displayed value is a SUM/COUNT/etc over the whole
    // group, not any one underlying row's value — pinning it as an equality
    // condition against the un-aggregated rows would wrongly filter out every
    // detail row except (by coincidence) a group of exactly one.
    if (resolved.isAggregate) continue;
    const item = def.items.find((e) => e.item.id === resolved.itemId)?.item;
    const folder = folderByItemId.get(resolved.itemId);
    if (!item || !folder) continue;
    const isNull = value === null || value === undefined;
    pinned.push({
      condition: {
        id: `drill-${randomUUID()}`,
        mapId: def.map.id,
        itemId: item.id,
        calculatedFieldId: null,
        operator: isNull ? 'IS_NULL' : '=',
        value: isNull ? null : conditionValueOf(value),
        paramName: null,
        conditionType: 'STATIC',
        groupId: null,
        logicOperator: 'AND',
        displayOrder: 10_000,
        negated: false,
        caseSensitive: true,
        createdAt: new Date(),
      },
      item,
      folder,
    });
  }

  if (pinned.length === 0) {
    throw new DrillNotAvailableError(
      'None of the given column values matched a column on this map — nothing to drill on.',
    );
  }

  return {
    ...def,
    map: { ...def.map, selectDistinct: false },
    items: def.items.map(({ mapItem, item, folder }) => ({
      mapItem: { ...mapItem, aggFunction: 'NONE' },
      item: { ...item, aggFunction: null },
      folder,
    })),
    totals: [],
    conditionalFormats: [],
    conditions: [...def.conditions, ...pinned],
  };
}

export interface DrillToDetailOptions {
  maxRows?: number;
  timeoutMs?: number;
  correlationId?: string;
}

/**
 * Run a drill-to-detail query and return its rows the same shape a normal
 * execute does. Refuses (`DrillNotAvailableError`, mapped to CONFIG) when the
 * plan is a fan-trap REWRITE: a rewritten query's rows are branch-joined
 * inline views, and there is no single "the row you clicked" to pin a
 * detail query to without knowing which branch it came from — exactly the
 * "grouped hierarchy levels and the GROUP BY" shape of unknown the phase
 * plan says to refuse rather than guess.
 */
export async function drillToDetail(
  mapId: string,
  parameterValues: Record<string, unknown>,
  userId: string,
  rowValues: Record<string, unknown>,
  options: DrillToDetailOptions = {},
  deps: MapExecutionDeps = defaultDeps(),
): Promise<ExecuteResult> {
  const def = await loadMapDefinition(mapId);
  const plan = planQuery(def);
  if (plan.kind === 'REFUSE') throw refusalError(plan);
  if (plan.kind === 'REWRITE') {
    throw new DrillNotAvailableError(
      'This worksheet fans out across more than one set of detail rows (the same shape a total refuses to add up across), so there is no single row to drill from without guessing which set it belongs to.',
    );
  }

  const detailDef = toDrillDetailDefinition(def, rowValues);
  const maxRows = Math.min(Math.max(options.maxRows ?? MAX_DETAIL_ROWS, 1), MAX_DETAIL_ROWS);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const correlationId = options.correlationId ?? randomUUID();

  const prepared = await prepareQueryForDefinition(
    detailDef,
    parameterValues,
    userId,
    maxRows + 1,
  );

  const start = Date.now();
  const planDecision = `DRILL(${prepared.planDecision ?? plan.decision})`;

  let conn: Connection;
  try {
    conn = await deps.getConnection(prepared.dataSourceId);
  } catch (err) {
    const wrapped = wrapExecutionError(err, 'CONNECT', correlationId);
    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs: Date.now() - start,
      rowCount: null,
      sqlText: prepared.sql,
      planDecision,
      errorMessage: wrapped.message,
      status: 'FAILED',
    });
    throw wrapped;
  }

  try {
    conn.callTimeout = timeoutMs;
    const result = await conn.execute(
      prepared.sql,
      prepared.bindParams as never,
      { outFormat: OUT_FORMAT_OBJECT, maxRows: maxRows + 1 },
    );
    const allRows = (result.rows ?? []) as Record<string, unknown>[];
    const truncated = allRows.length > maxRows;
    const rows = truncated ? allRows.slice(0, maxRows) : allRows;
    const columns = buildColumns(prepared.columns, result.metaData);
    const executionTimeMs = Date.now() - start;

    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs,
      rowCount: rows.length,
      sqlText: prepared.sql,
      planDecision,
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
      ...(prepared.warnings?.length ? { warnings: prepared.warnings } : {}),
    };
  } catch (err) {
    const kind: ExecutionErrorKind = isTimeoutError(err) ? 'TIMEOUT' : 'QUERY';
    const wrapped = wrapExecutionError(err, kind, correlationId);
    await safeRecord(deps, {
      mapId,
      executedBy: userId,
      executionTimeMs: Date.now() - start,
      rowCount: null,
      sqlText: prepared.sql,
      planDecision,
      errorMessage: wrapped.message,
      status: wrapped.kind === 'TIMEOUT' ? 'TIMEOUT' : 'FAILED',
    });
    throw wrapped;
  } finally {
    try {
      await deps.releaseConnection(prepared.dataSourceId, conn);
    } catch {
      // A connection we cannot return is the pool's problem, not this call's.
    }
  }
}
