/**
 * Build the GROUP BY clause. Oracle requires every non-aggregated SELECT
 * expression to appear in GROUP BY (expressions, not aliases).
 */
export function buildGroupByClause(
  hasAggregates: boolean,
  nonAggregateExprs: string[],
): string {
  if (!hasAggregates || nonAggregateExprs.length === 0) return '';
  return `GROUP BY ${nonAggregateExprs.join(', ')}`;
}
