import { describe, it, expect } from '@jest/globals';
import {
  evaluateCalculatedFields,
  validateFormula,
  CalculatedFieldError,
  type ColumnRef,
} from '../services/calculated-field-evaluator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Evaluate a single formula against one row and return the computed value. */
function evalOne(
  formula: string,
  row: Record<string, unknown> = {},
  columns?: ColumnRef[],
): unknown {
  const { rows } = evaluateCalculatedFields(
    [row],
    [{ name: 'RESULT', formula }],
    columns ? { columns } : {},
  );
  return rows[0]!.RESULT;
}

const utc = (y: number, m: number, d: number, hh = 0, mi = 0, ss = 0): Date =>
  new Date(Date.UTC(y, m - 1, d, hh, mi, ss));

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

describe('arithmetic', () => {
  it('evaluates the four operators with correct precedence', () => {
    expect(evalOne('2 + 3 * 4')).toBe(14);
    expect(evalOne('(2 + 3) * 4')).toBe(20);
    expect(evalOne('10 - 4 - 3')).toBe(3);
    expect(evalOne('20 / 4 / 5')).toBe(1);
  });

  it('handles unary minus', () => {
    expect(evalOne('-5 + 2')).toBe(-3);
    expect(evalOne('-(3 * 2)')).toBe(-6);
  });

  it('references item values by name and multiplies', () => {
    expect(evalOne('AMOUNT * 2', { AMOUNT: 10 })).toBe(20);
    expect(evalOne('PRICE - COST', { PRICE: 100, COST: 30 })).toBe(70);
  });

  it('propagates NULL through arithmetic', () => {
    expect(evalOne('AMOUNT + 1', { AMOUNT: null })).toBeNull();
    expect(evalOne('AMOUNT * 2', { AMOUNT: null })).toBeNull();
  });

  it('throws on division by zero', () => {
    expect(() => evalOne('10 / 0')).toThrow(CalculatedFieldError);
  });
});

// ---------------------------------------------------------------------------
// String functions
// ---------------------------------------------------------------------------

describe('string functions', () => {
  it('UPPER / LOWER / LENGTH', () => {
    expect(evalOne('UPPER(REGION)', { REGION: 'east' })).toBe('EAST');
    expect(evalOne('LOWER(REGION)', { REGION: 'EAST' })).toBe('east');
    expect(evalOne('LENGTH(REGION)', { REGION: 'east' })).toBe(4);
  });

  it('SUBSTR is 1-based and supports negative offsets', () => {
    expect(evalOne("SUBSTR('discoverer', 1, 4)")).toBe('disc');
    expect(evalOne("SUBSTR('discoverer', 5)")).toBe('overer');
    expect(evalOne("SUBSTR('discoverer', -3)")).toBe('rer');
  });

  it('concatenates with || treating NULL as empty', () => {
    expect(evalOne("REGION || '-' || 'X'", { REGION: 'E' })).toBe('E-X');
    expect(evalOne("REGION || '!'", { REGION: null })).toBe('!');
  });

  it('returns NULL when a string function gets NULL', () => {
    expect(evalOne('UPPER(REGION)', { REGION: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Date functions
// ---------------------------------------------------------------------------

describe('date functions', () => {
  it('TRUNC truncates a date to the month', () => {
    const result = evalOne('TRUNC(D, \'MM\')', { D: utc(2024, 3, 17, 9, 30) });
    expect(result).toEqual(utc(2024, 3, 1));
  });

  it('TO_CHAR formats a date', () => {
    expect(evalOne("TO_CHAR(D, 'YYYY-MM-DD')", { D: utc(2024, 3, 5) })).toBe(
      '2024-03-05',
    );
    expect(evalOne("TO_CHAR(D, 'MON YYYY')", { D: utc(2024, 3, 5) })).toBe(
      'MAR 2024',
    );
  });

  it('TRUNC truncates a number toward zero at given digits', () => {
    expect(evalOne('TRUNC(123.456, 1)')).toBeCloseTo(123.4, 5);
    expect(evalOne('TRUNC(123.456)')).toBe(123);
  });

  it('ADD_MONTHS clamps to the last day of the target month', () => {
    expect(
      evalOne("TO_CHAR(ADD_MONTHS(TO_DATE('2024-01-31'), 1), 'YYYY-MM-DD')"),
    ).toBe('2024-02-29');
  });

  it('computes the day difference between two dates', () => {
    expect(evalOne("TO_DATE('2024-03-10') - TO_DATE('2024-03-01')")).toBe(9);
  });

  it('adds a number of days to a date', () => {
    expect(
      evalOne("TO_CHAR(TO_DATE('2024-03-01') + 5, 'YYYY-MM-DD')"),
    ).toBe('2024-03-06');
  });
});

// ---------------------------------------------------------------------------
// Conditional / null handling
// ---------------------------------------------------------------------------

describe('conditional expressions', () => {
  it('evaluates a searched CASE expression', () => {
    const formula =
      "CASE WHEN AMOUNT > 100 THEN 'BIG' WHEN AMOUNT > 10 THEN 'MID' ELSE 'SMALL' END";
    expect(evalOne(formula, { AMOUNT: 500 })).toBe('BIG');
    expect(evalOne(formula, { AMOUNT: 50 })).toBe('MID');
    expect(evalOne(formula, { AMOUNT: 5 })).toBe('SMALL');
  });

  it('CASE with no matching WHEN and no ELSE yields NULL', () => {
    expect(evalOne('CASE WHEN 1 = 2 THEN 1 END')).toBeNull();
  });

  it('NVL and COALESCE substitute for NULL', () => {
    expect(evalOne('NVL(AMOUNT, 0)', { AMOUNT: null })).toBe(0);
    expect(evalOne('NVL(AMOUNT, 0)', { AMOUNT: 7 })).toBe(7);
    expect(evalOne('COALESCE(A, B, 9)', { A: null, B: null })).toBe(9);
    expect(evalOne('COALESCE(A, B, 9)', { A: null, B: 3 })).toBe(3);
  });

  it('applies three-valued logic in CASE conditions', () => {
    // NULL > 100 is unknown, so the WHEN does not match.
    expect(evalOne("CASE WHEN AMOUNT > 100 THEN 'Y' ELSE 'N' END", { AMOUNT: null })).toBe(
      'N',
    );
  });

  it('supports LIKE with wildcards', () => {
    expect(evalOne("CASE WHEN NAME LIKE 'A%' THEN 1 ELSE 0 END", { NAME: 'Apple' })).toBe(
      1,
    );
    expect(evalOne("CASE WHEN NAME LIKE 'A%' THEN 1 ELSE 0 END", { NAME: 'Banana' })).toBe(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// Reference resolution
// ---------------------------------------------------------------------------

describe('reference resolution', () => {
  it('resolves bracketed references by column label', () => {
    const columns: ColumnRef[] = [{ name: 'C1', label: 'Order Amount' }];
    expect(evalOne('[Order Amount] * 2', { C1: 21 }, columns)).toBe(42);
  });

  it('resolves references by row key when no columns are given', () => {
    expect(evalOne('amount + 1', { AMOUNT: 9 })).toBe(10);
  });

  it('throws on an unknown reference by default', () => {
    expect(() => evalOne('NOPE + 1', { AMOUNT: 1 })).toThrow(CalculatedFieldError);
  });

  it('yields NULL for an unknown reference when non-strict', () => {
    const { rows } = evaluateCalculatedFields(
      [{ AMOUNT: 1 }],
      [{ name: 'R', formula: 'NOPE + 1' }],
      { strictReferences: false },
    );
    expect(rows[0]!.R).toBeNull();
  });

  it('lets a later calculated field reference an earlier one', () => {
    const { rows, columns } = evaluateCalculatedFields(
      [{ AMOUNT: 5 }],
      [
        { name: 'Doubled', formula: 'AMOUNT * 2', displayOrder: 1 },
        { name: 'Quadrupled', formula: 'Doubled * 2', displayOrder: 2 },
      ],
      { columns: [{ name: 'AMOUNT' }] },
    );
    expect(rows[0]).toEqual({ AMOUNT: 5, Doubled: 10, Quadrupled: 20 });
    expect(columns.map((c) => c.name)).toEqual(['Doubled', 'Quadrupled']);
  });
});

// ---------------------------------------------------------------------------
// evaluateCalculatedFields behaviour
// ---------------------------------------------------------------------------

describe('evaluateCalculatedFields', () => {
  it('adds a calculated column to every row without mutating the input', () => {
    const input = [{ AMOUNT: 10 }, { AMOUNT: 20 }];
    const { rows, columns } = evaluateCalculatedFields(input, [
      { name: 'DOUBLE', formula: 'AMOUNT * 2' },
    ]);
    expect(rows).toEqual([
      { AMOUNT: 10, DOUBLE: 20 },
      { AMOUNT: 20, DOUBLE: 40 },
    ]);
    expect(columns).toEqual([{ name: 'DOUBLE', label: 'DOUBLE' }]);
    // input rows untouched
    expect(input).toEqual([{ AMOUNT: 10 }, { AMOUNT: 20 }]);
  });

  it('evaluates fields in displayOrder', () => {
    const { rows } = evaluateCalculatedFields(
      [{ N: 2 }],
      [
        { name: 'B', formula: 'A + 1', displayOrder: 2 },
        { name: 'A', formula: 'N * 10', displayOrder: 1 },
      ],
      { columns: [{ name: 'N' }] },
    );
    expect(rows[0]).toMatchObject({ A: 20, B: 21 });
  });

  it('returns rows unchanged when there are no calculated fields', () => {
    const input = [{ A: 1 }];
    const { rows, columns } = evaluateCalculatedFields(input, []);
    expect(rows).toBe(input);
    expect(columns).toEqual([]);
  });

  it('rejects duplicate calculated field names', () => {
    expect(() =>
      evaluateCalculatedFields(
        [{ A: 1 }],
        [
          { name: 'X', formula: 'A' },
          { name: 'x', formula: 'A + 1' },
        ],
      ),
    ).toThrow(CalculatedFieldError);
  });

  it('prefixes the field name onto evaluation errors', () => {
    expect(() =>
      evaluateCalculatedFields([{ A: 1 }], [{ name: 'Bad', formula: '1 / 0' }]),
    ).toThrow(/Bad/);
  });
});

// ---------------------------------------------------------------------------
// validateFormula
// ---------------------------------------------------------------------------

describe('validateFormula', () => {
  it('accepts a well-formed formula', () => {
    expect(validateFormula('AMOUNT * 2 + 1')).toEqual({ valid: true });
    expect(
      validateFormula("CASE WHEN X > 0 THEN UPPER(Y) ELSE 'n/a' END"),
    ).toEqual({ valid: true });
  });

  it('rejects unbalanced parentheses', () => {
    expect(validateFormula('(AMOUNT * 2').valid).toBe(false);
    expect(validateFormula('AMOUNT * 2)').valid).toBe(false);
  });

  it('rejects an empty formula', () => {
    expect(validateFormula('').valid).toBe(false);
    expect(validateFormula('   ').valid).toBe(false);
  });

  it('rejects disallowed functions', () => {
    const result = validateFormula('EXECUTE_IMMEDIATE(1)');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it('rejects aggregate functions', () => {
    const result = validateFormula('SUM(AMOUNT)');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/aggregate/i);
  });

  it('rejects statement separators and PL/SQL punctuation', () => {
    expect(validateFormula('1 ; DROP').valid).toBe(false);
    expect(validateFormula('DBMS_LOB.SUBSTR(X, 1, 1)').valid).toBe(false);
  });

  it('validates references against a known set when provided', () => {
    expect(validateFormula('AMOUNT + TAX', ['AMOUNT', 'TAX'])).toEqual({
      valid: true,
    });
    const bad = validateFormula('AMOUNT + MYSTERY', ['AMOUNT']);
    expect(bad.valid).toBe(false);
    expect(bad.error).toMatch(/MYSTERY/);
  });

  it('skips reference checking when no known set is given', () => {
    expect(validateFormula('ANYTHING + 1').valid).toBe(true);
  });
});
