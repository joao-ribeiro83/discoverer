import type { Folder, Item } from '../../db/schema.js';
import { SqlGenerationError, type MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { spanningJoinPath } from './folder-set.js';
import { quoteIdentifier } from './identifiers.js';

/**
 * Emitted SQL per derived join type. No `FULL`: the flag combination that
 * would mean it refuses instead (D-038), so it never reaches here.
 */
const JOIN_SQL: Record<string, string> = {
  INNER: 'INNER JOIN',
  LEFT: 'LEFT OUTER JOIN',
  RIGHT: 'RIGHT OUTER JOIN',
};

/**
 * The operators a join predicate may emit — a CLOSED set, looked up by key.
 *
 * The operator is the one part of a join that becomes SQL syntax rather than
 * a quoted identifier or a bind, so it is never interpolated from stored data:
 * a value outside this table is an error, not a string to splice. The database
 * carries the same six as a CHECK constraint, so this is the second of two
 * gates, not the only one.
 */
const PREDICATE_OPERATOR_SQL: Record<string, string> = {
  '=': '=',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
  '<>': '<>',
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
      throw new SqlGenerationError(`Unknown join type "${edge.joinType}"`);
    }

    const newFolder = ctx.getFolder(edge.to);
    const newAlias = ctx.aliasFor(edge.to);

    parts.push(
      `${joinSql} ${folderTableRef(newFolder)} ${newAlias} ON ${joinOnClause(j, ctx)}`,
    );
  }

  return parts.join('\n');
}

/**
 * The `ON` clause for one join: every component of its predicate, ANDed in
 * `seq` order.
 *
 * **A join with no usable predicate refuses, by name (D-039).** Until Phase
 * 3.2 such a join was dropped silently by the loader, which left its folders
 * unlinked and surfaced — later, and somewhere else — as "No join path
 * connects folder X to the rest of the query". The folders were fine; the
 * predicate was missing. Every one of the estate's ten joins was in that
 * state, and the message never once said which join was at fault.
 *
 * A component whose item endpoint did not migrate refuses for the same reason
 * the row is stored at all: emitting only the components that DID resolve
 * would shorten `a = b AND c = d` to `a = b`, which returns MORE rows than the
 * source did (D-058 — refuse rather than distort).
 */
function joinOnClause(
  j: MapDefinition['joins'][number],
  ctx: GenerationContext,
): string {
  const { join, predicates, leftFolder, rightFolder } = j;
  if (predicates.length === 0) {
    throw new SqlGenerationError(
      `Join "${join.name}" has no join condition, so the folders it connects cannot be queried together.`,
      { joins: [join.name] },
      'JOIN_NO_PREDICATE',
    );
  }

  const folderOf = (item: Item): Folder =>
    item.folderId === leftFolder.id ? leftFolder : rightFolder;

  return [...predicates]
    .sort((a, b) => a.predicate.seq - b.predicate.seq)
    .map(({ predicate, leftItem, rightItem }) => {
      if (!leftItem || !rightItem) {
        throw new SqlGenerationError(
          `Join "${join.name}" has a join condition whose column did not migrate, ` +
            'so the condition would be incomplete and would return too many rows.',
          { joins: [join.name] },
          'JOIN_NO_PREDICATE',
        );
      }
      const operator = PREDICATE_OPERATOR_SQL[predicate.operator];
      if (!operator) {
        throw new SqlGenerationError(
          `Join "${join.name}" uses an unsupported comparison ${JSON.stringify(predicate.operator)}`,
        );
      }
      // Both sides go through `itemExpression`, which validates and quotes the
      // identifier or throws — a column name carrying a quote is rejected, not
      // escaped.
      const left = ctx.itemExpression(leftItem, folderOf(leftItem));
      const right = ctx.itemExpression(rightItem, folderOf(rightItem));
      return `${left} ${operator} ${right}`;
    })
    .join(' AND ');
}
