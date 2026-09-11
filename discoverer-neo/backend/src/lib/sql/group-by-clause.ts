/**
 * Build the GROUP BY clause. Oracle requires every non-aggregated SELECT
 * expression to appear in GROUP BY (expressions, not aliases).
 *
 * Duplicates are collapsed. Oracle tolerates a repeated GROUP BY expression,
 * but callers now feed this from two places — the item list and the bare
 * references inside an aggregating calculated field (BE-05) — so the same
 * column arriving twice is normal rather than a caller's mistake. Deduping
 * once here fixes it for every caller instead of in each of them.
 */
export function buildGroupByClause(
  hasAggregates: boolean,
  nonAggregateExprs: string[],
): string {
  if (!hasAggregates || nonAggregateExprs.length === 0) return '';
  return `GROUP BY ${[...new Set(nonAggregateExprs)].join(', ')}`;
}
