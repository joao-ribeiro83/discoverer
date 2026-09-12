import { describe, it, expect } from '@jest/globals';
import { buildLovQuery, LOV_MAX_LIMIT, LOV_SEARCH_THRESHOLD } from '../services/lov.service.js';
import { quoteIdentifier } from '../lib/sql/identifiers.js';
import { SqlGenerationError } from '../types/sql.js';

/**
 * Pure-SQL tests for the list-of-values query.
 *
 * The live path (entitlement, row-level security, caching, Oracle) is covered
 * by `integration/lov.integration.test.ts`; what matters here is the shape of
 * the statement itself, because this is a NEW place where metadata becomes SQL.
 */

const source = {
  tableRef: '"GL"."GL_BALANCES_V"',
  valueColumn: '"COST_CENTRE"',
  sortColumn: null as string | null,
};

const noSecurity = { predicates: [] as string[], binds: {} as Record<string, unknown> };

describe('buildLovQuery', () => {
  it('selects DISTINCT over the one column, nulls excluded', () => {
    const { sql } = buildLovQuery(source, noSecurity, { limit: 200, offset: 0 });

    expect(sql).toContain('DISTINCT "COST_CENTRE" AS LOV_VALUE');
    expect(sql).toContain('FROM "GL"."GL_BALANCES_V" lov');
    expect(sql).toContain('"COST_CENTRE" IS NOT NULL');
  });

  // A Discoverer 4.1 estate is routinely still on Oracle 11g, where
  // `OFFSET … FETCH FIRST` is a syntax error.
  it('caps with ROWNUM, not FETCH FIRST', () => {
    const { sql, binds } = buildLovQuery(source, noSecurity, { limit: 50, offset: 0 });

    expect(sql).toContain('ROWNUM <= :lov_last');
    expect(sql).not.toMatch(/FETCH\s+FIRST/i);
    // One past the cap, so a full page is recognisable as truncated without a
    // second counting query.
    expect(binds.lov_last).toBe(51);
  });

  it('pages by offset', () => {
    const { sql, binds } = buildLovQuery(source, noSecurity, { limit: 50, offset: 100 });

    expect(sql).toContain('LOV_RN > :lov_first');
    expect(binds.lov_first).toBe(100);
    expect(binds.lov_last).toBe(151);
  });

  // The search term is a runtime value. It is bound, and the user's own
  // wildcards stay literal rather than becoming patterns.
  it('binds the search term and escapes its wildcards', () => {
    const { sql, binds } = buildLovQuery(source, noSecurity, {
      search: "100%_o'brien",
      limit: 20,
      offset: 0,
    });

    expect(sql).toContain(':lov_search');
    expect(sql).not.toContain("o'brien");
    expect(binds.lov_search).toBe("100\\%\\_O'BRIEN");
    expect(sql).toContain("ESCAPE '\\'");
  });

  it('orders by the alternative-sort column when the class names one', () => {
    const { sql } = buildLovQuery(
      { ...source, sortColumn: '"COST_CENTRE_SEQ"' },
      noSecurity,
      { limit: 20, offset: 0 },
    );

    expect(sql).toContain('"COST_CENTRE_SEQ" AS LOV_SORT');
    expect(sql).toContain('ORDER BY LOV_SORT, LOV_VALUE');
  });

  it('orders by the value itself when there is no sort item', () => {
    const { sql } = buildLovQuery(source, noSecurity, { limit: 20, offset: 0 });

    expect(sql).toContain('ORDER BY LOV_VALUE');
    expect(sql).not.toContain('LOV_SORT');
  });

  describe('row-level security', () => {
    it('ANDs each applicable predicate in, resolving {alias}', () => {
      const { sql } = buildLovQuery(
        source,
        { predicates: ['{alias}.REGION = :current_user_role'], binds: { current_user_role: 'USER', current_user_id: 'u1' } },
        { limit: 20, offset: 0 },
      );

      expect(sql).toContain('(lov.REGION = :current_user_role)');
      expect(sql).not.toContain('{alias}');
    });

    // An unused bind is an error on some drivers and noise on all of them.
    it('passes only the context binds a predicate actually names', () => {
      const { binds } = buildLovQuery(
        source,
        { predicates: ['{alias}.OWNER = :current_user_id'], binds: { current_user_id: 'u1', current_user_role: 'USER' } },
        { limit: 20, offset: 0 },
      );

      expect(binds.current_user_id).toBe('u1');
      expect(binds).not.toHaveProperty('current_user_role');
    });
  });
});

/**
 * The identifiers reaching `buildLovQuery` have already been through
 * `quoteIdentifier`, which REJECTS rather than escapes. This pins that: a
 * hostile table or column name coming out of an EUL nobody here controls must
 * not produce SQL at all.
 */
describe('hostile identifiers from metadata', () => {
  it.each([
    'COST_CENTRE" FROM DUAL--',
    'X"; DROP TABLE GL_BALANCES_V; --',
    "O'BRIEN",
    'COL UMN',
    '',
  ])('rejects %p rather than escaping it', (hostile) => {
    expect(() => quoteIdentifier(hostile)).toThrow(SqlGenerationError);
  });

  it('accepts an ordinary Oracle column name', () => {
    expect(quoteIdentifier('COST_CENTRE')).toBe('"COST_CENTRE"');
  });
});

describe('limits', () => {
  it('caps a dropdown well short of a result set', () => {
    expect(LOV_MAX_LIMIT).toBeLessThanOrEqual(1000);
    expect(LOV_SEARCH_THRESHOLD).toBeLessThanOrEqual(LOV_MAX_LIMIT);
  });
});
