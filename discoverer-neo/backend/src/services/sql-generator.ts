import { eq, inArray } from 'drizzle-orm';
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
  // FROM is built last so it sees every folder the query touches.
  const from = buildFromClause(def, ctx);
  const groupBy = buildGroupByClause(select.hasAggregates, select.nonAggregateExprs);
  const orderBy = buildOrderByClause(def);
  const pagination = buildPagination(options);

  const sql = [select.sql, from, where.sql, groupBy, orderBy, pagination.sql]
    .filter(Boolean)
    .join('\n');

  return {
    sql,
    bindParams: { ...where.bindParams, ...pagination.bindParams },
    hasAggregates: select.hasAggregates,
    columns: select.columns,
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
  ] = await Promise.all([
    db.select().from(mapItems).where(eq(mapItems.mapId, mapId)),
    db.select().from(mapConditions).where(eq(mapConditions.mapId, mapId)),
    db.select().from(mapParameters).where(eq(mapParameters.mapId, mapId)),
    db
      .select()
      .from(mapCalculatedFields)
      .where(eq(mapCalculatedFields.mapId, mapId)),
  ]);

  // All folders + items of the business area (formula references may reach
  // beyond the selected items).
  const folderRows = await db
    .select()
    .from(folders)
    .where(eq(folders.businessAreaId, map.businessAreaId));
  const folderIds = folderRows.map((f) => f.id);
  const folderById = new globalThis.Map<string, Folder>(
    folderRows.map((f) => [f.id, f]),
  );

  const itemRows = folderIds.length
    ? await db.select().from(items).where(inArray(items.folderId, folderIds))
    : [];
  const itemById = new globalThis.Map<string, Item>(
    itemRows.map((i) => [i.id, i]),
  );

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
