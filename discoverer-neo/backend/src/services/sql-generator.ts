import { eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  items,
  folders,
  joins,
  joinPredicates,
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  mapCalculatedFields,
  mapTotals,
  type Item,
  type Folder,
} from '../db/schema.js';
import {
  SqlGenerationError,
  type ExplainPlan,
  type GeneratedSql,
  type MapDefinition,
  type SqlGenerationOptions,
} from '../types/sql.js';
import { GenerationContext } from '../lib/sql/context.js';
import { buildSelectClause } from '../lib/sql/select-clause.js';
import { buildFromClause } from '../lib/sql/from-clause.js';
import { buildWhereClause } from '../lib/sql/where-clause.js';
import { buildGroupByClause } from '../lib/sql/group-by-clause.js';
import { buildOrderByClause } from '../lib/sql/order-by-clause.js';
import { buildPagination } from '../lib/sql/pagination.js';
import { planTotals } from '../lib/sql/totals.js';
import { planQuery, refusalError } from '../lib/sql/planner.js';
import { renderRewrite } from '../lib/sql/rewrite.js';
import type { QueryPlan, RewritePlan } from '../lib/sql/query-plan.js';

export { SqlGenerationError } from '../types/sql.js';
export { validateFormula } from '../lib/sql/formula-parser.js';
export { planQuery } from '../lib/sql/planner.js';

// ---------------------------------------------------------------------------
// Pure generator (unit-testable without a database)
// ---------------------------------------------------------------------------

/**
 * Convert a fully-loaded map definition into a parameterized Oracle SQL
 * statement.
 *
 * Safety contract:
 *  - identifiers come only from metadata and are validated + quoted
 *  - every runtime value is a bind variable — no exceptions
 *  - formulas are parsed against a strict grammar and re-emitted from the AST
 */
export function generateSql(
  def: MapDefinition,
  options: SqlGenerationOptions = {},
): GeneratedSql {
  // The plan comes first, always. It is what decides FLAT (D-018), and it
  // carries the folder set the whole generation is scoped to — the emitter
  // never re-derives one. Callers that have already planned (the execution
  // service, the `/plan` endpoint) pass theirs in rather than planning twice.
  const plan = options.plan ?? planQuery(def);
  if (plan.kind === 'REFUSE') throw refusalError(plan);
  if (plan.kind === 'REWRITE') return generateRewrite(def, plan, options);

  const ctx = new GenerationContext(def, plan.folderIds);

  // SELECT first: it assigns folder aliases in display order and detects
  // aggregates (including those hidden inside formulas).
  const select = buildSelectClause(def, ctx);
  const where = buildWhereClause(def, ctx, options);
  // ORDER BY and the totals plan come before FROM, not after: a sort on a
  // hidden item and a total on a column no other clause names both reach
  // folders nothing else has aliased yet, and FROM joins whatever has been
  // aliased by the time it runs.
  const orderBy = buildOrderByClause(def, ctx, select);
  const totalsPlan = planTotals(def, ctx, select, plan);
  // FROM is built last so every folder already has its alias.
  const from = buildFromClause(def, ctx, { plan });
  const groupBy = buildGroupByClause(select.hasAggregates, select.nonAggregateExprs);
  const pagination = buildPagination(options);

  const sql = [select.sql, from, where.sql, groupBy, orderBy.sql, pagination.sql]
    .filter(Boolean)
    .join('\n');

  // Totals reuse the main query's FROM and WHERE — and so its bind parameters
  // — but never its GROUP BY, ORDER BY or pagination: a total is one row over
  // the whole filtered set, or one row per break value.
  const totals = totalsPlan.entries.map((entry) => ({
    breakAlias: entry.breakAlias,
    breakLabel: entry.breakLabel,
    breakTargetAlias: entry.breakTargetAlias,
    sql: [
      `SELECT ${entry.selectParts.join(',\n       ')}`,
      from,
      where.sql,
      entry.groupByExpr ? `GROUP BY ${entry.groupByExpr}` : '',
      entry.groupByExpr ? 'ORDER BY 1' : '',
    ]
      .filter(Boolean)
      .join('\n'),
    bindParams: { ...where.bindParams },
    totals: entry.totals,
  }));

  return {
    sql,
    bindParams: { ...where.bindParams, ...pagination.bindParams },
    hasAggregates: select.hasAggregates,
    columns: select.columns,
    distinct: select.distinct,
    groupBreakAliases: orderBy.groupMapItemIds.flatMap((id) => {
      const alias = select.aliasByMapItemId.get(id);
      return alias ? [alias] : [];
    }),
    totals,
    warnings: [...orderBy.warnings, ...totalsPlan.warnings],
  };
}

/**
 * The fan-trap rewrite path: one inline view per branch, joined back on the
 * master key (`legacy-analysis.md` §1.4, emitted by `renderRewrite`).
 *
 * **Totals are suppressed here, deliberately.** A total is emitted by re-running
 * the main query's FROM and WHERE without its GROUP BY — and the flat FROM is
 * exactly the fanning join the rewrite exists to avoid, so reusing it would
 * print the inflated number the whole guard was built to prevent. §1.6 already
 * blanks a total whose columns span branches; this widens that to every total on
 * a rewritten query, which is the same honest answer for the same reason. The
 * user sees a blank cell and the explanation in `docs/troubleshooting/`, never a
 * wrong number.
 */
function generateRewrite(
  def: MapDefinition,
  plan: RewritePlan,
  options: SqlGenerationOptions,
): GeneratedSql {
  const { sql, bindParams, columns } = renderRewrite(def, plan, options);
  const pagination = buildPagination(options);

  const totalCount = def.totals?.length ?? 0;
  const warnings = totalCount
    ? [
        `${totalCount} total${totalCount === 1 ? '' : 's'} left blank: this ` +
          'worksheet summarises more than one set of detail rows, and a total across them ' +
          'cannot be calculated without double-counting.',
      ]
    : [];

  return {
    sql: [sql, pagination.sql].filter(Boolean).join('\n'),
    bindParams: { ...bindParams, ...pagination.bindParams },
    // A rewrite exists only because the query aggregates — step 0 sends
    // `|M| = 0` down the flat path.
    hasAggregates: true,
    columns,
    distinct: false,
    groupBreakAliases: [],
    totals: [],
    warnings,
  };
}

/**
 * Basic sanity validation of generated (or custom) SQL: a single SELECT
 * statement with no DDL/DML keywords in statement position.
 */
export function validateSql(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (!/^(select|with)\b/i.test(trimmed)) {
    return { valid: false, error: 'Only SELECT statements are allowed' };
  }
  if (trimmed.replace(/;+\s*$/, '').includes(';')) {
    return { valid: false, error: 'Multiple statements are not allowed' };
  }
  return { valid: true };
}

/**
 * Build the Oracle EXPLAIN PLAN statements for a query. Purely textual —
 * execution happens in the map execution service (Session 2.3), which runs
 * `explainStatement` then reads `planQuery`. EXPLAIN PLAN accepts queries
 * that still contain bind placeholders, so generated SQL needs no rewriting.
 */
export function explainSql(
  sql: string,
  statementId = 'DISCOVERER_NEO',
): ExplainPlan {
  const check = validateSql(sql);
  if (!check.valid) {
    throw new SqlGenerationError(`Cannot explain: ${check.error}`);
  }
  // The statement id lands inside a string literal — restrict it instead of
  // trying to escape it. 30 chars is the PLAN_TABLE STATEMENT_ID limit.
  if (!/^[A-Za-z0-9_]{1,30}$/.test(statementId)) {
    throw new SqlGenerationError(
      'Statement id must be 1-30 alphanumeric/underscore characters',
    );
  }
  return {
    statementId,
    explainStatement: `EXPLAIN PLAN SET STATEMENT_ID = '${statementId}' FOR\n${sql
      .trim()
      .replace(/;+\s*$/, '')}`,
    planQuery: `SELECT PLAN_TABLE_OUTPUT FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, '${statementId}', 'TYPICAL'))`,
  };
}

// ---------------------------------------------------------------------------
// Database-backed loader + wrapper
// ---------------------------------------------------------------------------

/**
 * Load everything the generator needs for a map in one pass.
 * Throws SqlGenerationError when the map does not exist.
 */
export async function loadMapDefinition(mapId: string): Promise<MapDefinition> {
  const [map] = await db
    .select()
    .from(maps)
    .where(eq(maps.id, mapId))
    .limit(1);
  if (!map || !map.isActive) {
    throw new SqlGenerationError(`Map "${mapId}" not found`);
  }

  const [
    mapItemRows,
    conditionRows,
    parameterRows,
    calculatedFieldRows,
    totalRows,
  ] = await Promise.all([
    db.select().from(mapItems).where(eq(mapItems.mapId, mapId)),
    db.select().from(mapConditions).where(eq(mapConditions.mapId, mapId)),
    db.select().from(mapParameters).where(eq(mapParameters.mapId, mapId)),
    db
      .select()
      .from(mapCalculatedFields)
      .where(eq(mapCalculatedFields.mapId, mapId)),
    db.select().from(mapTotals).where(eq(mapTotals.mapId, mapId)),
  ]);

  return assembleDefinition({
    map,
    mapItemRows,
    conditionRows,
    parameterRows,
    calculatedFieldRows,
    totalRows,
  });
}

/**
 * Turn a map's own rows into a `MapDefinition`, resolving the folders, items
 * and joins the query can reach.
 *
 * Split out from `loadMapDefinition` so the validate-only planner (D-117) can
 * plan a canvas that has never been saved: it supplies the same rows from the
 * builder's draft and gets the same definition back, so a refusal is reported
 * before Run rather than after a round trip to production Oracle.
 */
async function assembleDefinition({
  map,
  mapItemRows,
  conditionRows,
  parameterRows,
  calculatedFieldRows,
  totalRows,
}: {
  map: MapDefinition['map'];
  mapItemRows: (typeof mapItems.$inferSelect)[];
  conditionRows: (typeof mapConditions.$inferSelect)[];
  parameterRows: (typeof mapParameters.$inferSelect)[];
  calculatedFieldRows: (typeof mapCalculatedFields.$inferSelect)[];
  totalRows: (typeof mapTotals.$inferSelect)[];
}): Promise<MapDefinition> {
  // ---------------------------------------------------------------------
  // Derived query scope (D-013)
  //
  // The scope is the folders the map's own items and conditions live in, plus
  // everything reachable from them through join metadata — NOT the folders of
  // `maps.business_area_id`. That column is advisory (UI grouping) and
  // nullable, and a Discoverer worksheet's folders were never constrained to
  // one business area in the first place: `BA_OBJ_LINKS` is many-to-many, and
  // `folder_business_areas` records the same thing here.
  // ---------------------------------------------------------------------
  const referencedItemIds = [
    ...new Set([
      ...mapItemRows.map((r) => r.itemId),
      ...conditionRows.map((r) => r.itemId),
    ]),
  ];
  const seedItems = referencedItemIds.length
    ? await db.select().from(items).where(inArray(items.id, referencedItemIds))
    : [];

  const scopeFolderIds = new Set<string>(seedItems.map((i) => i.folderId));
  // Transitive closure over the join graph: a folder joined to one in scope is
  // reachable by the query, and its items are addressable from formulas.
  let frontier = [...scopeFolderIds];
  while (frontier.length > 0) {
    const edges = await db
      .select()
      .from(joins)
      .where(
        or(
          inArray(joins.leftFolderId, frontier),
          inArray(joins.rightFolderId, frontier),
        ),
      );
    const next: string[] = [];
    for (const edge of edges) {
      for (const id of [edge.leftFolderId, edge.rightFolderId]) {
        if (!scopeFolderIds.has(id)) {
          scopeFolderIds.add(id);
          next.push(id);
        }
      }
    }
    frontier = next;
  }

  const folderIds = [...scopeFolderIds];
  const folderRows = folderIds.length
    ? await db.select().from(folders).where(inArray(folders.id, folderIds))
    : [];
  const folderById = new globalThis.Map<string, Folder>(
    folderRows.map((f) => [f.id, f]),
  );

  const itemRows = folderIds.length
    ? await db.select().from(items).where(inArray(items.folderId, folderIds))
    : [];
  const itemById = new globalThis.Map<string, Item>(
    itemRows.map((i) => [i.id, i]),
  );

  // Both endpoints must be in scope — the closure above guarantees that for
  // every join touching a scoped folder, so this only filters dangling rows.
  const joinRows = folderIds.length
    ? await db
        .select()
        .from(joins)
        .where(inArray(joins.leftFolderId, folderIds))
    : [];

  // A join's predicate: 1..n column pairs, ANDed in `seq` order. Loaded even
  // when a component's item is missing, because a short `ON` clause returns
  // MORE rows than the source did — the FROM clause refuses instead (D-039).
  const predicateRows = joinRows.length
    ? await db
        .select()
        .from(joinPredicates)
        .where(
          inArray(
            joinPredicates.joinId,
            joinRows.map((j) => j.id),
          ),
        )
        .orderBy(joinPredicates.joinId, joinPredicates.seq)
    : [];
  const predicatesByJoinId = new globalThis.Map<
    string,
    (typeof predicateRows)[number][]
  >();
  for (const row of predicateRows) {
    const list = predicatesByJoinId.get(row.joinId);
    if (list) list.push(row);
    else predicatesByJoinId.set(row.joinId, [row]);
  }

  function itemWithFolder(itemId: string): { item: Item; folder: Folder } {
    const item = itemById.get(itemId);
    if (!item) {
      throw new SqlGenerationError(
        `Item "${itemId}" not found in the map's business area`,
      );
    }
    const folder = folderById.get(item.folderId);
    if (!folder) {
      throw new SqlGenerationError(
        `Folder for item "${item.name}" not found`,
      );
    }
    return { item, folder };
  }

  return {
    map,
    items: mapItemRows.map((mi) => ({
      mapItem: mi,
      ...itemWithFolder(mi.itemId),
    })),
    conditions: conditionRows.map((c) => ({
      condition: c,
      ...itemWithFolder(c.itemId),
    })),
    parameters: parameterRows,
    calculatedFields: calculatedFieldRows,
    totals: totalRows,
    // A join is kept whenever both its FOLDERS are in scope. It is NOT dropped
    // for a missing predicate or a missing predicate item: that was the old
    // behaviour, and it turned every one of the estate's ten joins into an
    // absent edge, which then surfaced far away as an unattributable "No join
    // path connects folder X…". The predicate travels with the join, empty if
    // that is what the source gave, and `buildFromClause` refuses BY NAME when
    // a query actually needs it (D-039).
    joins: joinRows.flatMap((j) => {
      const leftFolder = folderById.get(j.leftFolderId);
      const rightFolder = folderById.get(j.rightFolderId);
      // Skip joins whose folders fall outside the business area.
      if (!leftFolder || !rightFolder) return [];
      const predicates = (predicatesByJoinId.get(j.id) ?? []).map((p) => ({
        predicate: p,
        leftItem: p.leftItemId ? (itemById.get(p.leftItemId) ?? null) : null,
        rightItem: p.rightItemId ? (itemById.get(p.rightItemId) ?? null) : null,
      }));
      return [{ join: j, predicates, leftFolder, rightFolder }];
    }),
    formulaItems: itemRows.flatMap((item) => {
      const folder = folderById.get(item.folderId);
      return folder ? [{ item, folder }] : [];
    }),
  };
}

/** One column of a builder canvas, as the validate-only planner needs it. */
export interface DraftItem {
  itemId: string;
  aggFunction?: string | null;
  axisType?: 'AXIS' | 'MEASURE' | 'PAGE' | null;
  isHidden?: boolean;
}

/**
 * Plan a canvas that has not been saved (D-117).
 *
 * The builder calls this on change, so a refusal — "these two folders are
 * joined to each other", "COUNT DISTINCT cannot be recalculated from partial
 * totals" — is reported while the user is still composing, instead of after
 * they press Run, wait for production Oracle, and read an explanation.
 *
 * Only the columns are needed. What the planner decides turns on which folders
 * they live in, which of them aggregate, and the join metadata between those
 * folders; a condition changes which branch it lands in, never whether the
 * query refuses.
 */
export async function planDraft(items: DraftItem[]): Promise<QueryPlan> {
  const now = new Date();
  const map: MapDefinition['map'] = {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Draft',
    description: null,
    mapType: 'TABLE',
    businessAreaId: null,
    createdBy: '00000000-0000-0000-0000-000000000000',
    isPublic: false,
    isActive: true,
    selectDistinct: false,
    createdAt: now,
    updatedAt: now,
  };

  const def = await assembleDefinition({
    map,
    mapItemRows: items.map((item, index) => ({
      id: `draft-${index}`,
      mapId: map.id,
      itemId: item.itemId,
      displayOrder: index,
      displayName: null,
      formatMask: null,
      aggFunction: item.aggFunction ?? null,
      sortDirection: null,
      sortOrder: null,
      columnWidth: null,
      axisType: item.axisType ?? null,
      axisEdge: null,
      axisOrder: null,
      isHidden: item.isHidden ?? false,
      dataType: null,
      headingFormatMask: null,
      alignment: null,
      wordWrap: null,
      sortRank: null,
      sortGroup: false,
      sourceElementId: null,
      sourceAttrs: null,
      createdAt: now,
    })),
    conditionRows: [],
    parameterRows: [],
    calculatedFieldRows: [],
    totalRows: [],
  });

  return planQuery(def);
}

/**
 * One map's FINAL decision, for the planner-decision histogram (D-037, B-7).
 *
 * The planner's own verdict is not the whole answer. Two of the outcomes a user
 * actually meets are raised by the emitter, not the planner:
 *
 * - **DISCONNECTED** — the folders the map uses are not linked by any join.
 *   The planner records `FLAT(DISCONNECTED)` and leaves the refusal to the FROM
 *   clause, which names the folder. 271 of this estate's 341 multi-folder maps
 *   are in this state (`research/baseline-counts.md`).
 * - **NO_PREDICATE** — a join exists but carries no usable condition (D-039).
 *
 * A histogram that counted only planner verdicts would put both in `FLAT` and
 * report a guard doing work it never did. So the decision is taken after
 * generation: whatever refusal fires first, by name.
 *
 * Anything else generation throws is NOT a planner outcome — an unrendered
 * formula token is Phase 4's problem — and is reported as `ERROR` so it is
 * counted separately rather than diluting the histogram.
 */
export function decideMap(def: MapDefinition): { decision: string; measures: number } {
  const plan = planQuery(def);
  const measures = plan.measures.length;
  if (plan.kind === 'REFUSE') return { decision: `REFUSE(${plan.rule})`, measures };

  try {
    generateSql(def, { plan });
  } catch (err) {
    const code = err instanceof SqlGenerationError ? err.code : undefined;
    if (code) return { decision: `REFUSE(${HISTOGRAM_RULE[code] ?? code})`, measures };
    return { decision: 'ERROR', measures };
  }

  return {
    decision: plan.kind === 'REWRITE' ? `REWRITE(${plan.branches.length})` : 'FLAT',
    measures,
  };
}

/**
 * Refusal codes renamed for the histogram, so its vocabulary reads as the
 * decision procedure states it rather than as the emitter spells it
 * (`legacy-analysis.md` §1.11 step 10, extended by review R-07/B-03).
 */
const HISTOGRAM_RULE: Record<string, string> = {
  NO_JOIN_PATH: 'DISCONNECTED',
  JOIN_NO_PREDICATE: 'NO_PREDICATE',
  JOIN_BOTH_OUTER: 'BOTH_OUTER',
  FAN_TRAP_R1: 'R1',
  FAN_TRAP_R2: 'R2',
  FAN_TRAP_R3: 'R3',
  FAN_TRAP_R4: 'R4',
  FAN_TRAP_REAGG: 'REAGG',
};

/** Generate SQL for a stored map. */
export async function generateSqlForMap(
  mapId: string,
  options: SqlGenerationOptions = {},
): Promise<GeneratedSql> {
  const def = await loadMapDefinition(mapId);
  return generateSql(def, options);
}
