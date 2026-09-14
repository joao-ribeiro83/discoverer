import { describe, it, expect } from '@jest/globals';
import { calculatedFieldSql } from '../lib/sql/formula-parser.js';
import { SqlGenerationError } from '../types/sql.js';

const resolveItem = (name: string): string | null =>
  name.toUpperCase() === 'AMOUNT' ? '"AMOUNT"' : null;

describe('calculatedFieldSql', () => {
  it('parses formula directly for a Neo-authored field (no sourceTokens)', () => {
    const result = calculatedFieldSql(
      { name: 'Doubled', formula: 'AMOUNT * 2', sourceTokens: null, compiledSql: null, compileStatus: null },
      resolveItem,
    );
    expect(result.sql).toBe('"AMOUNT" * 2');
    expect(result.containsAggregate).toBe(false);
  });

  it('uses compiledSql, not formula, for a compiled migrated field', () => {
    const result = calculatedFieldSql(
      {
        name: 'PRÉMIO FIXO',
        // The raw Discoverer function-code text — parsing this would throw.
        formula: '[1,102](Cod Modalidade,[5,1,"2"],[1,115](),...)',
        sourceTokens: '[1,102](...)',
        compiledSql: 'DECODE("COD_MODALIDADE", \'2\', NULL, SUM("VALOR"))',
        compileStatus: 'COMPILED_UNVERIFIED',
      },
      resolveItem,
    );
    expect(result.sql).toBe('DECODE("COD_MODALIDADE", \'2\', NULL, SUM("VALOR"))');
    expect(result.containsAggregate).toBe(true);
    expect(result.bareReferences).toEqual([]);
  });

  it('accepts COMPILED the same as COMPILED_UNVERIFIED', () => {
    const result = calculatedFieldSql(
      {
        name: 'X',
        formula: '[1,68](A,B)',
        sourceTokens: '[1,68](A,B)',
        compiledSql: '"A" + "B"',
        compileStatus: 'COMPILED',
      },
      resolveItem,
    );
    expect(result.sql).toBe('"A" + "B"');
  });

  it('refuses a migrated field that has not compiled, instead of parsing raw tokens', () => {
    expect(() =>
      calculatedFieldSql(
        {
          name: 'Mora',
          formula: '[1,102](Cod Grupo,[5,1,"NAPL"],...)',
          sourceTokens: '[1,102](...)',
          compiledSql: null,
          compileStatus: 'QUARANTINED',
        },
        resolveItem,
      ),
    ).toThrow(SqlGenerationError);
  });

  it('refuses a migrated field whose compile_status has never been set', () => {
    expect(() =>
      calculatedFieldSql(
        {
          name: 'Mora',
          formula: '[1,102](...)',
          sourceTokens: '[1,102](...)',
          compiledSql: null,
          compileStatus: null,
        },
        resolveItem,
      ),
    ).toThrow(/has not compiled/);
  });

  it('requireCompiled forces the gate even for a field with no sourceTokens', () => {
    // where-clause.ts's own, older contract (predates sourceTokens tracking):
    // a condition refuses on an uncompiled field regardless of provenance.
    expect(() =>
      calculatedFieldSql(
        { name: 'Unverified', formula: 'AMOUNT * 2', sourceTokens: null, compiledSql: null, compileStatus: null },
        resolveItem,
        { requireCompiled: true },
      ),
    ).toThrow(/has not compiled/);
  });
});
