import type { SqlGenerationOptions } from '../../types/sql.js';

export interface PaginationResult {
  sql: string;
  bindParams: Record<string, number>;
}

/**
 * Row limiting / pagination using Oracle 12c+ OFFSET/FETCH syntax, with
 * bind variables for both values.
 */
export function buildPagination(
  options: SqlGenerationOptions = {},
): PaginationResult {
  const parts: string[] = [];
  const bindParams: Record<string, number> = {};

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
