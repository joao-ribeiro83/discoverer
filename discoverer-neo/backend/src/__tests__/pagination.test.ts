import { describe, it, expect } from '@jest/globals';
import { buildPagination } from '../lib/sql/pagination.js';

describe('buildPagination (BE-06)', () => {
  it('emits no tiebreaker when no pagination is requested', () => {
    expect(buildPagination({}, false).sql).toBe('');
  });

  it('emits no tiebreaker when the query already has an ORDER BY', () => {
    const { sql } = buildPagination({ rowLimit: 50 }, true);
    expect(sql).not.toContain('ORDER BY');
    expect(sql).toContain('FETCH NEXT');
  });

  it('appends ORDER BY 1 when paginating an unsorted query (offset only)', () => {
    const { sql } = buildPagination({ offset: 50 }, false);
    expect(sql.startsWith('ORDER BY 1')).toBe(true);
    expect(sql).toContain('OFFSET :row_offset ROWS');
  });

  it('appends ORDER BY 1 when paginating an unsorted query (limit only)', () => {
    const { sql } = buildPagination({ rowLimit: 50 }, false);
    expect(sql.startsWith('ORDER BY 1')).toBe(true);
    expect(sql).toContain('FETCH NEXT :row_limit ROWS ONLY');
  });

  it('keeps the bind params unaffected by the tiebreaker', () => {
    const { bindParams } = buildPagination({ offset: 10, rowLimit: 20 }, false);
    expect(bindParams).toEqual({ row_offset: 10, row_limit: 20 });
  });
});
