import type { Folder } from '../../db/schema.js';
import { SqlGenerationError, type MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { spanningJoinPath } from './folder-set.js';
import { quoteIdentifier } from './identifiers.js';

const JOIN_SQL: Record<string, string> = {
  INNER: 'INNER JOIN',
  LEFT: 'LEFT OUTER JOIN',
  RIGHT: 'RIGHT OUTER JOIN',
  FULL: 'FULL OUTER JOIN',
};

/**
 * SQL table reference for a folder. TABLE/VIEW-like folders reference their
 * underlying table; COMPLEX folders inline their (validated) custom SQL as a
 * derived table.
 */
export function folderTableRef(folder: Folder): string {
  if (folder.folderType === 'COMPLEX') {
    const sql = (folder.customSql ?? '').trim().replace(/;+\s*$/, '');
    if (!sql) {
      throw new SqlGenerationError(
        `COMPLEX folder "${folder.name}" has no custom SQL`,
      );
    }
    if (!/^select\s/i.test(sql) && !/^with\s/i.test(sql)) {
      throw new SqlGenerationError(
        `COMPLEX folder "${folder.name}" custom SQL must be a SELECT statement`,
      );
    }
    if (sql.includes(';')) {
      throw new SqlGenerationError(
        `COMPLEX folder "${folder.name}" custom SQL must be a single statement`,
      );
    }
    return `(${sql})`;
  }

  if (!folder.tableName) {
    throw new SqlGenerationError(
      `Folder "${folder.name}" has no underlying table`,
    );
  }
  const table = quoteIdentifier(folder.tableName);
  return folder.tableOwner
    ? `${quoteIdentifier(folder.tableOwner)}.${table}`
    : table;
}

export interface FromClauseOptions {
  /**
   * Whether the statement aggregates — a SELECT-list aggregate, an aggregate
   * hidden in a formula, or a totals query planned over the same FROM.
   *
   * Only used by the interim multi-folder refusal below.
   */
  hasAggregates?: boolean;
}

/**
 * Build the FROM clause. When the query spans multiple folders, a join path
 * connecting them is computed from the join metadata (BFS spanning tree,
 * pruned to the folders the query actually uses).
 */
export function buildFromClause(
  def: MapDefinition,
  ctx: GenerationContext,
  options: FromClauseOptions = {},
): string {
  const required = ctx.usedFolderIds();
  if (required.length === 0) {
    throw new SqlGenerationError('The query references no folders');
  }

  // INTERIM REFUSAL — D-014. Delete in Phase 3.4, when the fan-trap planner
  // lands, and not before.
  //
  // Until this commit, multi-folder maps failed earlier, at the "No join path
  // connects..." check below. That failure was an accidental fan-trap guard:
  // deriving the query scope from the referenced items (D-013) makes those
  // maps loadable, and a flat inner join across a master/detail pair then
  // returns every master measure multiplied by its detail count. Oracle's own
  // worked example puts the inflation at 2x-3x on two measures at once. A
  // wrong number that looks right is worse than a refusal.
  if (required.length > 1 && options.hasAggregates) {
    const names = required.map((id) => ctx.getFolder(id).name);
    throw new SqlGenerationError(
      `Multi-folder aggregate queries are refused until the fan-trap planner lands. Folders: ${names.join(', ')}`,
      { folders: names },
      'MULTI_FOLDER_AGGREGATE',
    );
  }

  const rootId = required[0]!;
  if (required.length === 1) {
    const folder = ctx.getFolder(rootId);
    return `FROM ${folderTableRef(folder)} ${ctx.aliasFor(rootId)}`;
  }

  const { edges, unreachable } = spanningJoinPath(required, def.joins);
  if (unreachable.length > 0) {
    const folder = ctx.getFolder(unreachable[0]!);
    throw new SqlGenerationError(
      `No join path connects folder "${folder.name}" to the rest of the query`,
      { folders: unreachable.map((id) => ctx.getFolder(id).name) },
      'NO_JOIN_PATH',
    );
  }

  const parts: string[] = [
    `FROM ${folderTableRef(ctx.getFolder(rootId))} ${ctx.aliasFor(rootId)}`,
  ];

  for (const edge of edges) {
    const j = def.joins[edge.joinIdx]!;
    const joinSql = JOIN_SQL[edge.joinType];
    if (!joinSql) {
      throw new SqlGenerationError(`Unknown join type "${j.join.joinType}"`);
    }

    const newFolder = ctx.getFolder(edge.to);
    const newAlias = ctx.aliasFor(edge.to);
    const leftExpr = ctx.itemExpression(j.leftItem, j.leftFolder);
    const rightExpr = ctx.itemExpression(j.rightItem, j.rightFolder);

    parts.push(
      `${joinSql} ${folderTableRef(newFolder)} ${newAlias} ON ${leftExpr} = ${rightExpr}`,
    );
  }

  return parts.join('\n');
}
