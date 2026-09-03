import { eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  items,
  folders,
  joins,
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

export { SqlGenerationError } from '../types/sql.js';
export { validateFormula } from '../lib/sql/formula-parser.js';

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
  const ctx = new GenerationContext(def);

  // SELECT first: it assigns folder aliases in display order and detects
  // aggregates (including those hidden inside formulas).
  const select = buildSelectClause(def, ctx);
  const where = buildWhereClause(def, ctx, options);
  // ORDER BY and the totals plan come before FROM, not after: a sort on a
  // hidden item and a total on a column no other clause names both reach
  // folders nothing else has aliased yet, and FROM joins whatever has been
  // aliased by the time it runs.
  const orderBy = buildOrderByClause(def, ctx, select);
  const totalsPlan = planTotals(def, ctx, select);
  // FROM is built last so it sees every folder the query touches. It also
  // carries the interim multi-folder aggregate refusal (D-014), so it has to
  // be told whether the statement aggregates — including through a totals
  // query, which reuses this very FROM clause.
  const from = buildFromClause(def, ctx, {
    hasAggregates: select.hasAggregates || totalsPlan.entries.length > 0,
  });
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
    joins: joinRows.flatMap((j) => {
      if (!j.leftItemId || !j.rightItemId) return [];
      const leftItem = itemById.get(j.leftItemId);
      const rightItem = itemById.get(j.rightItemId);
      const leftFolder = folderById.get(j.leftFolderId);
      const rightFolder = folderById.get(j.rightFolderId);
      // Skip joins whose endpoints fall outside the business area.
      if (!leftItem || !rightItem || !leftFolder || !rightFolder) return [];
      return [{ join: j, leftItem, rightItem, leftFolder, rightFolder }];
    }),
    formulaItems: itemRows.flatMap((item) => {
      const folder = folderById.get(item.folderId);
      return folder ? [{ item, folder }] : [];
    }),
  };
}

/** Generate SQL for a stored map. */
export async function generateSqlForMap(
  mapId: string,
  options: SqlGenerationOptions = {},
): Promise<GeneratedSql> {
  const def = await loadMapDefinition(mapId);
  return generateSql(def, options);
}
