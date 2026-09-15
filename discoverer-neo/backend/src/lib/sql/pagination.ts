import type { SqlGenerationOptions } from '../../types/sql.js';

export interface PaginationResult {
  sql: string;
  bindParams: Record<string, number>;
}

/**
 * Row limiting / pagination using Oracle 12c+ OFFSET/FETCH syntax, with
 * bind variables for both values.
 *
 * `hasOrderBy` is whether the query already carries an ORDER BY. Oracle
 * guarantees no row order without one, so paginating an unordered query can
 * repeat one row and skip another across pages (BE-06); a bare `ORDER BY 1`
 * is enough to make paging deterministic without changing what the map asked
 * for.
 */
export function buildPagination(
  options: SqlGenerationOptions = {},
  hasOrderBy = false,
): PaginationResult {
  const parts: string[] = [];
  const bindParams: Record<string, number> = {};

  const isPaginating =
    (options.offset !== undefined && options.offset > 0) ||
    (options.rowLimit !== undefined && options.rowLimit > 0);

  if (isPaginating && !hasOrderBy) {
    parts.push('ORDER BY 1');
  }

  if (options.offset !== undefined && options.offset > 0) {
    parts.push('OFFSET :row_offset ROWS');
    bindParams.row_offset = Math.floor(options.offset);
  }
  if (options.rowLimit !== undefined && options.rowLimit > 0) {
    parts.push('FETCH NEXT :row_limit ROWS ONLY');
    bindParams.row_limit = Math.floor(options.rowLimit);
  }

  return { sql: parts.join(' '), bindParams };
}
