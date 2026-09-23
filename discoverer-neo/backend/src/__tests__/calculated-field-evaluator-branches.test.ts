import { describe, it, expect } from '@jest/globals';
import {
  evaluateCalculatedFields,
  validateFormula,
  CalculatedFieldError,
} from '../services/calculated-field-evaluator.js';

/**
 * Branch coverage for calculated-field-evaluator.ts that
 * calculated-fields.test.ts does not exercise: tokenizer error paths,
 * logical/NOT/IS [NOT] NULL operators, additional TO_CHAR/TRUNC date-mask
 * branches, and a handful of function edge cases (empty COALESCE result,
 * zero-arg GREATEST, too-few-arg DECODE, direct date comparison, and the
 * row-key case-insensitive fallback in reference resolution).
 */

function evalOne(formula: string, row: Record<string, unknown> = {}): unknown {
  const { rows } = evaluateCalculatedFields([row], [{ name: 'RESULT', formula }]);
  return rows[0]!.RESULT;
}

const utc = (y: number, m: number, d: number, hh = 0, mi = 0, ss = 0): Date =>
  new Date(Date.UTC(y, m - 1, d, hh, mi, ss));

// ---------------------------------------------------------------------------
// Tokenizer error paths
// ---------------------------------------------------------------------------

describe('tokenizer errors', () => {
  it('rejects an unterminated string literal', () => {
    expect(() => evalOne("'unterminated")).toThrow(CalculatedFieldError);
    expect(() => evalOne("'unterminated")).toThrow(/Unterminated string/);
  });

  it('unescapes a doubled single quote inside a string literal', () => {
    expect(evalOne("'it''s'")).toBe("it's");
  });

  it('rejects an unterminated bracketed reference', () => {
    expect(() => evalOne('[AMOUNT')).toThrow(/Unterminated column reference/);
  });

  it('rejects an empty bracketed reference', () => {
    expect(() => evalOne('[]')).toThrow(/Empty column reference/);
  });
});

// ---------------------------------------------------------------------------
// Logical operators (AND / OR / NOT) with three-valued logic
// ---------------------------------------------------------------------------

describe('logical operators', () => {
  it('evaluates OR', () => {
    expect(evalOne('A > 1 OR B > 1', { A: 5, B: 0 })).toBe(true);
    expect(evalOne('A > 1 OR B > 1', { A: 0, B: 0 })).toBe(false);
  });

  it('OR is true if either side is true, even when the other is unknown', () => {
    expect(evalOne('A > 1 OR B > 1', { A: 5, B: null })).toBe(true);
  });

  it('OR is unknown (NULL) when neither side is true but one is unknown', () => {
    expect(evalOne('A > 1 OR B > 1', { A: 0, B: null })).toBeNull();
  });

  it('evaluates AND', () => {
    expect(evalOne('A > 1 AND B > 1', { A: 5, B: 5 })).toBe(true);
    expect(evalOne('A > 1 AND B > 1', { A: 5, B: 0 })).toBe(false);
  });

  it('AND is false if either side is false, even when the other is unknown', () => {
    expect(evalOne('A > 1 AND B > 1', { A: null, B: 0 })).toBe(false);
  });

  it('AND is unknown (NULL) when neither side is false but one is unknown', () => {
    expect(evalOne('A > 1 AND B > 1', { A: 5, B: null })).toBeNull();
  });

  it('evaluates NOT', () => {
    expect(evalOne('NOT (A > 1)', { A: 5 })).toBe(false);
    expect(evalOne('NOT (A > 1)', { A: 0 })).toBe(true);
  });

  it('NOT of an unknown value is unknown', () => {
    expect(evalOne('NOT (A > 1)', { A: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// IS [NOT] NULL
// ---------------------------------------------------------------------------

describe('IS [NOT] NULL', () => {
  it('IS NULL', () => {
    expect(evalOne('A IS NULL', { A: null })).toBe(true);
    expect(evalOne('A IS NULL', { A: 1 })).toBe(false);
  });

  it('IS NOT NULL', () => {
    expect(evalOne('A IS NOT NULL', { A: 1 })).toBe(true);
    expect(evalOne('A IS NOT NULL', { A: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Comparison operators beyond '>' (already exercised via CASE WHEN elsewhere)
// ---------------------------------------------------------------------------

describe('comparison operators', () => {
  it('<>, <, <=, >=', () => {
    expect(evalOne('A <> B', { A: 1, B: 2 })).toBe(true);
    expect(evalOne('A < B', { A: 1, B: 2 })).toBe(true);
    expect(evalOne('A <= B', { A: 2, B: 2 })).toBe(true);
    expect(evalOne('A >= B', { A: 2, B: 2 })).toBe(true);
  });

  it('compares two dates directly', () => {
    expect(evalOne('A > B', { A: utc(2024, 2, 1), B: utc(2024, 1, 1) })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser error paths
// ---------------------------------------------------------------------------

describe('parser errors', () => {
  it('rejects a bare keyword with no primary-expression meaning', () => {
    expect(() => evalOne('END')).toThrow(/Unexpected keyword/);
  });

  it('rejects a token with no primary-expression meaning', () => {
    expect(() => evalOne('* 2')).toThrow(/Unexpected token/);
  });

  it('rejects CASE with no WHEN clauses', () => {
    expect(() => evalOne('CASE END')).toThrow(/at least one WHEN/);
  });
});

// ---------------------------------------------------------------------------
// Value coercion errors
// ---------------------------------------------------------------------------

describe('value coercion errors', () => {
  it('throws when a non-numeric string is used as a number', () => {
    expect(() => evalOne("'abc' + 1")).toThrow(/as a number/);
  });

  it('throws when TO_DATE gets an unparsable value', () => {
    expect(() => evalOne("TO_DATE('not-a-date')")).toThrow(/as a date/);
  });
});

// ---------------------------------------------------------------------------
// Date formatting — remaining TO_CHAR mask tokens
// ---------------------------------------------------------------------------

describe('TO_CHAR date mask branches', () => {
  const d = utc(2024, 3, 5, 13, 45, 9); // a Tuesday

  it('YY / YYY', () => {
    expect(evalOne("TO_CHAR(D, 'YY')", { D: d })).toBe('24');
    expect(evalOne("TO_CHAR(D, 'YYY')", { D: d })).toBe('024');
  });

  it('MONTH (long)', () => {
    expect(evalOne("TO_CHAR(D, 'MONTH')", { D: d })).toBe('MARCH');
  });

  it('DAY (long) / DY (short)', () => {
    expect(evalOne("TO_CHAR(D, 'DAY')", { D: d })).toBe('TUESDAY');
    expect(evalOne("TO_CHAR(D, 'DY')", { D: d })).toBe('TUE');
  });

  it('HH24:MI:SS', () => {
    expect(evalOne("TO_CHAR(D, 'HH24:MI:SS')", { D: d })).toBe('13:45:09');
  });

  it('HH12/HH with AM/PM', () => {
    expect(evalOne("TO_CHAR(D, 'HH12:MI AM')", { D: d })).toBe('01:45 PM');
    expect(evalOne("TO_CHAR(D, 'HH:MI AM')", { D: utc(2024, 3, 5, 9, 5) })).toBe('09:05 AM');
  });
});

// ---------------------------------------------------------------------------
// TRUNC on dates — remaining unit branches
// ---------------------------------------------------------------------------

describe('TRUNC date-unit branches', () => {
  const d = utc(2021, 5, 6, 13, 45, 9);

  it('HH24 / HH12 truncate to the hour', () => {
    const r = evalOne("TRUNC(D, 'HH24')", { D: d }) as Date;
    expect(r).toEqual(utc(2021, 5, 6, 13));
  });

  it('MI truncates to the minute', () => {
    const r = evalOne("TRUNC(D, 'MI')", { D: d }) as Date;
    expect(r).toEqual(utc(2021, 5, 6, 13, 45));
  });
});

// ---------------------------------------------------------------------------
// ROUND on a Date (delegates to truncDate)
// ---------------------------------------------------------------------------

describe('ROUND on a date', () => {
  it('rounds a date the way TRUNC does (day granularity by default)', () => {
    const r = evalOne('ROUND(D)', { D: utc(2021, 5, 15, 10, 30) }) as Date;
    expect(r).toEqual(utc(2021, 5, 15));
  });
});

// ---------------------------------------------------------------------------
// Function edge cases
// ---------------------------------------------------------------------------

describe('function edge cases', () => {
  it('COALESCE with no non-null argument and no trailing default returns NULL', () => {
    expect(evalOne('COALESCE(A, B)', { A: null, B: null })).toBeNull();
  });

  it('GREATEST/LEAST with zero arguments throws', () => {
    expect(() => evalOne('GREATEST()')).toThrow(/at least one argument/);
  });

  it('DECODE with fewer than 3 arguments throws', () => {
    expect(() => evalOne('DECODE(A, B)', { A: 1, B: 2 })).toThrow(/at least 3 arguments/);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic — the reversed-operand and date-minus-number date branches
// ---------------------------------------------------------------------------

describe('date arithmetic — remaining operand orders', () => {
  it('number + date adds days on the left-hand side', () => {
    const r = evalOne('5 + D', { D: utc(2024, 3, 1) }) as Date;
    expect(r).toEqual(utc(2024, 3, 6));
  });

  it('date - number subtracts days', () => {
    const r = evalOne('D - 5', { D: utc(2024, 3, 6) }) as Date;
    expect(r).toEqual(utc(2024, 3, 1));
  });
});

// ---------------------------------------------------------------------------
// Reference resolution — row-key fallback when a columns list is supplied
// ---------------------------------------------------------------------------

describe('reference resolution fallback', () => {
  it('falls back to a case-insensitive row key when the name matches no known column', () => {
    const { rows } = evaluateCalculatedFields(
      [{ Amount: 7 }],
      [{ name: 'R', formula: 'AMOUNT + 1' }],
      { columns: [{ name: 'OTHER' }] },
    );
    expect(rows[0]!.R).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// evaluateCalculatedFields — empty-formula rejection through the field path
// ---------------------------------------------------------------------------

describe('evaluateCalculatedFields with an empty formula', () => {
  it('rejects an empty formula, prefixed with the field name', () => {
    expect(() =>
      evaluateCalculatedFields([{ A: 1 }], [{ name: 'Empty', formula: '   ' }]),
    ).toThrow(/Empty/);
  });
});

// ---------------------------------------------------------------------------
// validateFormula — trailing-token rejection (distinct from unbalanced parens)
// ---------------------------------------------------------------------------

describe('validateFormula trailing token', () => {
  it('rejects trailing content after a complete expression', () => {
    expect(validateFormula('1 1').valid).toBe(false);
  });

  it('tolerates a nullish formula the same way as an empty one', () => {
    expect(validateFormula(undefined as unknown as string).valid).toBe(false);
  });

  it('names the expected token when a required keyword is missing', () => {
    const result = validateFormula('CASE WHEN 1 = 1 ELSE 2 END');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expected "THEN"/);
  });
});

// ---------------------------------------------------------------------------
// Tokenizer — remaining shapes
// ---------------------------------------------------------------------------

describe('tokenizer — remaining shapes', () => {
  it('tokenizes a leading-dot number literal', () => {
    expect(evalOne('.5 * 2')).toBe(1);
  });

  it('tokenizes != as the <> operator', () => {
    expect(evalOne('A != B', { A: 1, B: 2 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parser — remaining error shapes
// ---------------------------------------------------------------------------

describe('parser — remaining error shapes', () => {
  it('reports the EOF token when a formula ends mid-expression', () => {
    expect(() => evalOne('1 +')).toThrow(/EOF/);
  });

  it('need() reports a range "min-max" when min and max differ', () => {
    expect(() => evalOne("SUBSTR('a')")).toThrow(/2-3/);
  });
});

// ---------------------------------------------------------------------------
// Value coercion — remaining toNum / toText branches
// ---------------------------------------------------------------------------

describe('value coercion — remaining branches', () => {
  it('toNum coerces a boolean', () => {
    expect(evalOne('A + 1', { A: true })).toBe(2);
    expect(evalOne('A + 1', { A: false })).toBe(1);
  });

  it('toNum coerces a Date via getTime (reached through a non date-aware operator)', () => {
    expect(evalOne('D * 1', { D: utc(2024, 1, 1) })).toBe(utc(2024, 1, 1).getTime());
  });

  it('toText renders a Date when concatenated', () => {
    expect(evalOne("D || '!'", { D: utc(2024, 3, 5) })).toBe('2024-03-05!');
  });
});

// ---------------------------------------------------------------------------
// Unary operators — NULL propagation and the '+' branch
// ---------------------------------------------------------------------------

describe('unary operators — remaining branches', () => {
  it('unary minus of NULL is NULL', () => {
    expect(evalOne('-A', { A: null })).toBeNull();
  });

  it('unary plus is a no-op', () => {
    expect(evalOne('+A', { A: 5 })).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// LIKE with a NULL operand
// ---------------------------------------------------------------------------

describe('LIKE with NULL', () => {
  it('is NULL when either side is NULL', () => {
    expect(evalOne("A LIKE 'x%'", { A: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// compareValues — equality and ordering for dates and strings
// ---------------------------------------------------------------------------

describe('compareValues — dates and strings', () => {
  it('dates compare equal and less-than, not just greater-than', () => {
    expect(evalOne('A = B', { A: utc(2024, 1, 1), B: utc(2024, 1, 1) })).toBe(true);
    expect(evalOne('A < B', { A: utc(2024, 1, 1), B: utc(2024, 2, 1) })).toBe(true);
  });

  it('strings compare equal and less-than', () => {
    expect(evalOne('A = B', { A: 'x', B: 'x' })).toBe(true);
    expect(evalOne('A < B', { A: 'a', B: 'b' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// padStr — length <= 0 and a falsy explicit pad character
// ---------------------------------------------------------------------------

describe('LPAD/RPAD edge cases', () => {
  it('a non-positive length yields an empty string', () => {
    expect(evalOne("LPAD('abc', 0)")).toBe('');
  });

  it('an empty explicit pad character falls back to a space', () => {
    expect(evalOne("LPAD('a', 3, '')")).toBe('  a');
  });
});

// ---------------------------------------------------------------------------
// GREATEST/LEAST — the "equal" branch of the string comparator
// ---------------------------------------------------------------------------

describe('GREATEST/LEAST tie-break', () => {
  it('treats equal string arguments as a tie', () => {
    expect(evalOne("GREATEST('a', 'a')")).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// formatNumber (TO_CHAR on a number) — remaining mask shapes
// ---------------------------------------------------------------------------

describe('TO_CHAR number-mask branches', () => {
  it('groups without a decimal point', () => {
    expect(evalOne("TO_CHAR(N, '999,999')", { N: 1234567 })).toBe('1,234,567');
  });

  it('a mask with a dot but no 0/9 placeholders after it yields zero decimals', () => {
    expect(evalOne("TO_CHAR(N, '999.XX')", { N: 42 })).toBe('42');
  });

  it('a decimal mask without grouping returns the fixed value directly', () => {
    expect(evalOne("TO_CHAR(N, '990.00')", { N: 7.5 })).toBe('7.50');
  });

  it('a negative grouped number carries its sign outside the digits', () => {
    expect(evalOne("TO_CHAR(N, '999,999.00')", { N: -1234567.5 })).toBe('-1,234,567.50');
  });
});

// ---------------------------------------------------------------------------
// TO_CHAR on a date with the default mask (1-arg form)
// ---------------------------------------------------------------------------

describe('TO_CHAR date default mask', () => {
  it('defaults to YYYY-MM-DD when no mask is given', () => {
    expect(evalOne('TO_CHAR(D)', { D: utc(2024, 3, 5) })).toBe('2024-03-05');
  });
});

// ---------------------------------------------------------------------------
// ROUND on a date with an explicit format
// ---------------------------------------------------------------------------

describe('ROUND on a date with an explicit format', () => {
  it('truncates to the given unit, same as TRUNC', () => {
    const r = evalOne("ROUND(D, 'MM')", { D: utc(2021, 5, 15, 10, 30) }) as Date;
    expect(r).toEqual(utc(2021, 5, 1));
  });
});

// ---------------------------------------------------------------------------
// Reference resolution — the NULL-value sub-branch of both resolver paths
// ---------------------------------------------------------------------------

describe('reference resolution — NULL-valued matches', () => {
  it('a column-key match whose row value is NULL resolves to NULL, not undefined', () => {
    const { rows } = evaluateCalculatedFields(
      [{ AMOUNT: null }],
      [{ name: 'R', formula: 'AMOUNT + 1' }],
      { columns: [{ name: 'AMOUNT' }] },
    );
    expect(rows[0]!.R).toBeNull();
  });

  it('a case-insensitive row-key fallback match whose value is NULL resolves to NULL', () => {
    const { rows } = evaluateCalculatedFields(
      [{ Amount: null }],
      [{ name: 'R', formula: 'AMOUNT + 1' }],
      { columns: [{ name: 'OTHER' }] },
    );
    expect(rows[0]!.R).toBeNull();
  });
});
