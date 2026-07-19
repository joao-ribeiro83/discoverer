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

// ---------------------------------------------------------------------------
// Scalar string functions
// ---------------------------------------------------------------------------

describe('scalar string functions', () => {
  it('INITCAP capitalises each word', () => {
    expect(evalOne("INITCAP('hello world')")).toBe('Hello World');
  });

  it('TRIM/LTRIM/RTRIM strip whitespace', () => {
    expect(evalOne("TRIM('  hi  ')")).toBe('hi');
    expect(evalOne("LTRIM('  hi')")).toBe('hi');
    expect(evalOne("RTRIM('hi  ')")).toBe('hi');
  });

  it('LTRIM/RTRIM strip a custom character set', () => {
    expect(evalOne("LTRIM('xxabc', 'x')")).toBe('abc');
    expect(evalOne("RTRIM('abcxx', 'x')")).toBe('abc');
  });

  it('INSTR returns a 1-based index (0 when absent)', () => {
    expect(evalOne("INSTR('abcabc', 'c')")).toBe(3);
    expect(evalOne("INSTR('abc', 'z')")).toBe(0);
  });

  it('REPLACE substitutes occurrences, defaulting to removal', () => {
    expect(evalOne("REPLACE('a-b-c', '-', '+')")).toBe('a+b+c');
    expect(evalOne("REPLACE('a-b-c', '-')")).toBe('abc');
    expect(evalOne("REPLACE('abc', '', 'x')")).toBe('abc');
  });

  it('CONCAT joins two values, treating NULL as empty', () => {
    expect(evalOne("CONCAT('foo', 'bar')")).toBe('foobar');
    expect(evalOne('CONCAT(A, B)', { A: 'foo', B: null })).toBe('foo');
  });

  it('LPAD/RPAD pad and truncate', () => {
    expect(evalOne("LPAD('7', 3, '0')")).toBe('007');
    expect(evalOne("RPAD('7', 3, '.')")).toBe('7..');
    expect(evalOne("LPAD('abcd', 2)")).toBe('ab');
    expect(evalOne("LPAD('x', 3)")).toBe('  x');
  });

  it('SUBSTR handles negative start and length', () => {
    expect(evalOne("SUBSTR('abcdef', 2, 3)")).toBe('bcd');
    expect(evalOne("SUBSTR('abcdef', -2)")).toBe('ef');
    expect(evalOne("SUBSTR('abcdef', 0)")).toBe('abcdef');
    expect(evalOne("SUBSTR('abcdef', 2, 0)")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scalar numeric functions
// ---------------------------------------------------------------------------

describe('scalar numeric functions', () => {
  it('ROUND/TRUNC with and without digits', () => {
    expect(evalOne('ROUND(3.14159, 2)')).toBeCloseTo(3.14);
    expect(evalOne('ROUND(3.7)')).toBe(4);
    expect(evalOne('TRUNC(3.789, 1)')).toBeCloseTo(3.7);
    expect(evalOne('TRUNC(3.9)')).toBe(3);
  });

  it('FLOOR/CEIL/ABS/SIGN', () => {
    expect(evalOne('FLOOR(3.9)')).toBe(3);
    expect(evalOne('CEIL(3.1)')).toBe(4);
    expect(evalOne('ABS(-5)')).toBe(5);
    expect(evalOne('SIGN(-3)')).toBe(-1);
    expect(evalOne('SIGN(3)')).toBe(1);
  });

  it('MOD including Oracle MOD(x,0) = x', () => {
    expect(evalOne('MOD(10, 3)')).toBe(1);
    expect(evalOne('MOD(10, 0)')).toBe(10);
  });

  it('POWER/SQRT', () => {
    expect(evalOne('POWER(2, 10)')).toBe(1024);
    expect(evalOne('SQRT(144)')).toBe(12);
  });

  it('GREATEST/LEAST over numbers and strings, NULL if any arg is NULL', () => {
    expect(evalOne('GREATEST(3, 7, 5)')).toBe(7);
    expect(evalOne('LEAST(3, 7, 5)')).toBe(3);
    expect(evalOne("GREATEST('apple', 'pear', 'kiwi')")).toBe('pear');
    expect(evalOne('GREATEST(A, B)', { A: 1, B: null })).toBeNull();
  });

  it('TO_NUMBER coerces text', () => {
    expect(evalOne("TO_NUMBER('42')")).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Null-handling functions
// ---------------------------------------------------------------------------

describe('null-handling functions', () => {
  it('NVL returns the fallback only when null', () => {
    expect(evalOne('NVL(A, 0)', { A: null })).toBe(0);
    expect(evalOne('NVL(A, 0)', { A: 5 })).toBe(5);
  });

  it('NVL2 picks by nullness of the first arg', () => {
    expect(evalOne("NVL2(A, 'has', 'none')", { A: 1 })).toBe('has');
    expect(evalOne("NVL2(A, 'has', 'none')", { A: null })).toBe('none');
  });

  it('COALESCE returns the first non-null', () => {
    expect(evalOne('COALESCE(A, B, 9)', { A: null, B: null })).toBe(9);
    expect(evalOne('COALESCE(A, B, 9)', { A: null, B: 3 })).toBe(3);
  });

  it('DECODE matches, treats two NULLs as equal, and falls through to a default', () => {
    expect(evalOne("DECODE(G, 'A', 1, 'B', 2, 0)", { G: 'B' })).toBe(2);
    expect(evalOne("DECODE(G, 'A', 1, 0)", { G: 'Z' })).toBe(0);
    expect(evalOne("DECODE(G, 'A', 1)", { G: 'Z' })).toBeNull();
    expect(evalOne('DECODE(G, NULLC, 1, 0)', { G: null, NULLC: null })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Date functions and formatting
// ---------------------------------------------------------------------------

describe('date functions', () => {
  it('ADD_MONTHS clamps to month-end', () => {
    const r = evalOne('ADD_MONTHS(D, 1)', { D: utc(2020, 1, 31) }) as Date;
    expect(r.getUTCMonth()).toBe(1); // February
    expect(r.getUTCDate()).toBe(29); // 2020 leap year
  });

  it('MONTHS_BETWEEN', () => {
    const v = evalOne('MONTHS_BETWEEN(A, B)', {
      A: utc(2020, 3, 15),
      B: utc(2020, 1, 15),
    }) as number;
    expect(v).toBeCloseTo(2);
  });

  it('LAST_DAY returns the final day of the month', () => {
    const r = evalOne('LAST_DAY(D)', { D: utc(2021, 2, 10) }) as Date;
    expect(r.getUTCDate()).toBe(28);
  });

  it('TRUNC on a date strips time / rounds to unit', () => {
    const day = evalOne('TRUNC(D)', { D: utc(2021, 5, 6, 13, 30) }) as Date;
    expect(day.getUTCHours()).toBe(0);
    const month = evalOne("TRUNC(D, 'MM')", { D: utc(2021, 5, 6) }) as Date;
    expect(month.getUTCDate()).toBe(1);
    const year = evalOne("TRUNC(D, 'YYYY')", { D: utc(2021, 5, 6) }) as Date;
    expect(year.getUTCMonth()).toBe(0);
  });

  it('TO_CHAR of a date honours a mask', () => {
    expect(evalOne("TO_CHAR(D, 'YYYY-MM-DD')", { D: utc(2021, 7, 4) })).toBe(
      '2021-07-04',
    );
    expect(evalOne("TO_CHAR(D, 'MON')", { D: utc(2021, 1, 1) })).toMatch(/jan/i);
  });

  it('TO_CHAR of a number honours grouping and decimals', () => {
    expect(evalOne("TO_CHAR(N, '999,999.00')", { N: 1234567.5 })).toBe(
      '1,234,567.50',
    );
    expect(evalOne('TO_CHAR(N)', { N: 42 })).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Function arity errors
// ---------------------------------------------------------------------------

describe('function arity validation', () => {
  it('rejects the wrong number of arguments', () => {
    expect(() => evalOne('ABS(1, 2)')).toThrow(CalculatedFieldError);
    expect(() => evalOne('MOD(1)')).toThrow(CalculatedFieldError);
  });
});
