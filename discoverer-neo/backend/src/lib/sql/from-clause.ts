import type { Folder } from '../../db/schema.js';
import { SqlGenerationError, type MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { quoteIdentifier } from './identifiers.js';

const JOIN_SQL: Record<string, string> = {
  INNER: 'INNER JOIN',
  LEFT: 'LEFT OUTER JOIN',
  RIGHT: 'RIGHT OUTER JOIN',
  FULL: 'FULL OUTER JOIN',
};

/** Flip LEFT/RIGHT when a join is traversed from its right side. */
const FLIPPED_JOIN: Record<string, string> = {
  INNER: 'INNER',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
  FULL: 'FULL',
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

/**
 * Build the FROM clause. When the query spans multiple folders, a join path
 * connecting them is computed from the business area's join metadata (BFS
 * spanning tree, pruned to the folders the query actually uses).
 */
export function buildFromClause(
  def: MapDefinition,
  ctx: GenerationContext,
): string {
  const required = ctx.usedFolderIds();
  if (required.length === 0) {
    throw new SqlGenerationError('The query references no folders');
  }

  const rootId = required[0]!;
  if (required.length === 1) {
    const folder = ctx.getFolder(rootId);
    return `FROM ${folderTableRef(folder)} ${ctx.aliasFor(rootId)}`;
  }

  // Adjacency list over join metadata.
  type Edge = { joinIdx: number; from: string; to: string };
  const adjacency = new globalThis.Map<string, Edge[]>();
  def.joins.forEach((j, joinIdx) => {
    const l = j.join.leftFolderId;
    const r = j.join.rightFolderId;
    if (!adjacency.has(l)) adjacency.set(l, []);
    if (!adjacency.has(r)) adjacency.set(r, []);
    adjacency.get(l)!.push({ joinIdx, from: l, to: r });
    adjacency.get(r)!.push({ joinIdx, from: r, to: l });
  });

  // BFS spanning tree from the root folder.
  const parentEdge = new globalThis.Map<string, Edge>();
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of adjacency.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parentEdge.set(edge.to, edge);
      queue.push(edge.to);
    }
  }

  for (const folderId of required) {
    if (!visited.has(folderId)) {
      const folder = ctx.getFolder(folderId);
      throw new SqlGenerationError(
        `No join path connects folder "${folder.name}" to the rest of the query`,
      );
    }
  }

  // Keep only the tree edges on paths from required folders to the root.
  const needed = new Set<string>();
  const edgesInOrder: Edge[] = [];
  for (const folderId of required) {
    let node = folderId;
    const chain: Edge[] = [];
    while (node !== rootId && !needed.has(node)) {
      const edge = parentEdge.get(node)!;
      chain.unshift(edge);
      needed.add(node);
      node = edge.from;
    }
    edgesInOrder.push(...chain);
  }

  const parts: string[] = [
    `FROM ${folderTableRef(ctx.getFolder(rootId))} ${ctx.aliasFor(rootId)}`,
  ];

  for (const edge of edgesInOrder) {
    const j = def.joins[edge.joinIdx]!;
    const joinedForward = edge.from === j.join.leftFolderId;
    const joinType = joinedForward
      ? j.join.joinType
      : FLIPPED_JOIN[j.join.joinType]!;
    const joinSql = JOIN_SQL[joinType];
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
