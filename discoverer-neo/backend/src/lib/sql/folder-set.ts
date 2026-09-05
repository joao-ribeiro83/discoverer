import type { MapDefinition } from '../../types/sql.js';
import { GenerationContext } from './context.js';
import { buildSelectClause } from './select-clause.js';
import { buildWhereClause } from './where-clause.js';
import { buildOrderByClause } from './order-by-clause.js';
import { planTotals } from './totals.js';
import { deriveJoinType } from './join-type.js';

/**
 * The folders a map's query actually touches, and how each one got there.
 *
 * **The rule this file exists to enforce (D-115):**
 *
 * > Any folder that can change the rows the user sees must resolve its
 * > policies, or the query refuses.
 *
 * Before this function there were two disagreeing derivations. Row-level
 * security walked `def.items` + `def.conditions` only, while the emitted SQL
 * reached folders two further ways:
 *
 *  - **Calculated-field references.** `def.formulaItems` is every item row the
 *    loader fetched, not the map's selected items. A formula naming an item in
 *    folder X routes `resolveFormulaReference -> itemExpression -> aliasFor(X)`,
 *    so X's column value lands in the SELECT list while X never entered the
 *    security set.
 *  - **Join bridges.** The FROM clause spans the required folders with a BFS
 *    tree over `def.joins`. An `INNER` bridge filters the result set, so its
 *    policy changes what the user sees.
 *
 * Both routes are closed by deriving the set from the clause builders
 * themselves rather than from a hand-maintained list of tables.
 */
export interface EffectiveFolderSet {
  /**
   * Folders whose column values reach the emitted statement — the map's items
   * and conditions, plus every folder reached transitively through a resolved
   * calculated-field reference, an ORDER BY on a hidden item, or a total.
   */
  columnBearingFolderIds: string[];
  /**
   * Folders the FROM clause adds purely to bridge the column-bearing ones,
   * tagged with the join type that brings each in. `rowChanging` is false only
   * for a master-side `LEFT OUTER` bridge, which preserves every existing row
   * and therefore cannot change what the user sees.
   */
  joinPathFolderIds: JoinPathFolder[];
}

export interface JoinPathFolder {
  folderId: string;
  /** Join type as emitted — already flipped when traversed right-to-left. */
  joinType: string;
  rowChanging: boolean;
}

/** One traversed edge of the join spanning tree. */
export interface JoinPathEdge {
  /** Index into `def.joins`. */
  joinIdx: number;
  /** Folder already in the query. */
  from: string;
  /** Folder this edge brings in — the right operand of the emitted JOIN. */
  to: string;
  /** Join type as emitted, flipped when traversed from the right side. */
  joinType: string;
}

/**
 * Flip LEFT/RIGHT when a join is traversed from its right (detail) side.
 *
 * No `FULL` entry: the flag combination that would produce it refuses in
 * `deriveJoinType` before it can reach here (D-038).
 */
const FLIPPED_JOIN: Record<string, string> = {
  INNER: 'INNER',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

/**
 * A `LEFT OUTER JOIN <new folder>` keeps every row the query already had, so
 * the joined folder cannot remove or add rows. Every other join type can.
 */
function isRowChanging(joinType: string): boolean {
  return joinType !== 'LEFT';
}

/**
 * BFS spanning tree over the join metadata, pruned to the paths that connect
 * the required folders to the first one.
 *
 * Shared by `buildFromClause` (which emits the edges) and `effectiveFolderSet`
 * (which only needs to know which folders they drag in), so the security set
 * and the FROM clause can never drift apart.
 */
export function spanningJoinPath(
  requiredFolderIds: string[],
  joins: MapDefinition['joins'],
): { rootId: string; edges: JoinPathEdge[]; unreachable: string[] } {
  const rootId = requiredFolderIds[0]!;
  if (requiredFolderIds.length <= 1) {
    return { rootId, edges: [], unreachable: [] };
  }

  const adjacency = new globalThis.Map<string, JoinPathEdge[]>();
  joins.forEach((j, joinIdx) => {
    const l = j.join.leftFolderId;
    const r = j.join.rightFolderId;
    // Derived from the two outer-join flags, never read from a column
    // (D-032). A join that sets both refuses here, before any folder set or
    // FROM clause is built on top of a shape Neo cannot express (D-038).
    const joinType = deriveJoinType(j.join, j.join.name);
    if (!adjacency.has(l)) adjacency.set(l, []);
    if (!adjacency.has(r)) adjacency.set(r, []);
    adjacency.get(l)!.push({ joinIdx, from: l, to: r, joinType });
    adjacency.get(r)!.push({
      joinIdx,
      from: r,
      to: l,
      joinType: FLIPPED_JOIN[joinType] ?? joinType,
    });
  });

  const parentEdge = new globalThis.Map<string, JoinPathEdge>();
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

  const unreachable = requiredFolderIds.filter((id) => !visited.has(id));
  if (unreachable.length > 0) {
    return { rootId, edges: [], unreachable };
  }

  // Keep only the tree edges on paths from required folders back to the root.
  const needed = new Set<string>();
  const edges: JoinPathEdge[] = [];
  for (const folderId of requiredFolderIds) {
    let node = folderId;
    const chain: JoinPathEdge[] = [];
    while (node !== rootId && !needed.has(node)) {
      const edge = parentEdge.get(node)!;
      chain.unshift(edge);
      needed.add(node);
      node = edge.from;
    }
    edges.push(...chain);
  }

  return { rootId, edges, unreachable: [] };
}

/**
 * Derive the folder set a map's query touches. Pure function of the
 * definition — no database, no options, no side effects on the caller's
 * generation context.
 *
 * The column-bearing half is obtained by running the clause builders that
 * assign folder aliases against a throwaway context, which is the only way to
 * follow a formula wherever it leads. It is therefore exactly what the real
 * generation will touch, rather than an approximation that has to be kept in
 * step by hand.
 *
 * A definition whose SQL cannot be generated at all (an unparseable formula, a
 * STATIC condition with no value) throws here, with the same error the
 * generator would raise a moment later.
 */
export function effectiveFolderSet(def: MapDefinition): EffectiveFolderSet {
  const ctx = new GenerationContext(def);

  // Same order as `generateSql`: SELECT assigns aliases in display order, then
  // the clauses that can reach folders nothing else has named yet.
  const select = buildSelectClause(def, ctx);
  buildWhereClause(def, ctx);
  buildOrderByClause(def, ctx, select);
  planTotals(def, ctx, select);

  const columnBearingFolderIds = ctx.usedFolderIds();
  const columnBearing = new Set(columnBearingFolderIds);

  const { edges, unreachable } = spanningJoinPath(
    columnBearingFolderIds,
    def.joins,
  );
  // A disconnected folder set has no join path, and therefore no bridges. The
  // FROM clause raises the error; deriving the security set must not.
  if (unreachable.length > 0) {
    return { columnBearingFolderIds, joinPathFolderIds: [] };
  }

  const joinPathFolderIds: JoinPathFolder[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    if (columnBearing.has(edge.to) || seen.has(edge.to)) continue;
    seen.add(edge.to);
    joinPathFolderIds.push({
      folderId: edge.to,
      joinType: edge.joinType,
      rowChanging: isRowChanging(edge.joinType),
    });
  }

  return { columnBearingFolderIds, joinPathFolderIds };
}

/**
 * The folders row-level security must resolve policies for: every
 * column-bearing folder, plus every bridge folder whose join can change the
 * rows returned.
 */
export function securityRelevantFolderIds(set: EffectiveFolderSet): string[] {
  return [
    ...set.columnBearingFolderIds,
    ...set.joinPathFolderIds.filter((f) => f.rowChanging).map((f) => f.folderId),
  ];
}
