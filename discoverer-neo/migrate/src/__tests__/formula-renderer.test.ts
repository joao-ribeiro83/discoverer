import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  builtinCode,
  IMPLEMENTED_CODES,
  PHASE_4_2_CODES,
  PHASE_4_2_TOP_TEN,
  PHASE_4_3_CODES,
} from '../semantics/builtin-codes.js';
import {
  createBindCollector,
  displayMatches,
  FITTED_CODES,
  renderDisplay,
  renderSql,
  type ItemBinding,
  type SqlRenderContext,
} from '../semantics/render.js';
import { AGGREGATE_FUNCTIONS, SCALAR_FUNCTIONS } from '../semantics/allowlist.js';
import { parseFormulaTree, type FormulaNode } from '../services/workbook-parser.js';
import { isAnonymiserDamage, readFormulaCorpus } from '../services/formula-corpus-agreement.js';

/**
 * The Phase 4.2 token renderer.
 *
 * Two things are being defended here and they are not the same thing:
 *
 * - **Fidelity.** Does the tree render back to what Discoverer showed? Every
 *   per-code case below is a real (stored, displayed) pair harvested from the
 *   estate by Phase 4.1 — not a case anyone invented — so a code whose fixity
 *   is read wrongly fails immediately.
 * - **Safety.** Is the emitted SQL built the way the backend's SQL builder
 *   builds SQL — allowlisted names, validated identifiers, bound values, and
 *   no string splicing anywhere?
 *
 * A renderer can pass one and fail the other, which is exactly the failure
 * this phase exists to prevent.
 */

const TABLE_PATH = resolve(process.cwd(), 'corpus', 'builtin-code-table.json');

interface CodeFit {
  code: number;
  name: string;
  state: string;
  shape: string | null;
  arities: number[];
  examples: { io: string; display: string }[];
}
const fitted = JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as { codes: CodeFit[] };
const fitByCode = new Map(fitted.codes.map((entry) => [entry.code, entry]));

function tree(io: string): FormulaNode {
  const parsed = parseFormulaTree(io);
  if (parsed.tree === null) throw new Error(`corpus row did not parse: ${parsed.error}`);
  return parsed.tree;
}

/** A resolver that names every element, so SQL tests exercise the happy path. */
function ctx(overrides: Partial<SqlRenderContext> = {}): SqlRenderContext {
  const binder = createBindCollector();
  return {
    resolveItem: (id) => ({ name: `ITEM_${id}`, qualifier: 'T1', column: `COL_${id}` }),
    resolveParameter: (id) => `P_${id}`,
    bind: binder.bind,
    ...overrides,
  };
}

describe('the implemented code table', () => {
  it('carries every code the phase brief names', () => {
    for (const code of PHASE_4_2_TOP_TEN) {
      expect(builtinCode(code)).toBeDefined();
    }
  });

  it('matches the fitted table for name, shape and arity', () => {
    // The fit is the evidence; this file is a transcription of it. A re-fit
    // that moves a code must fail the build rather than quietly change what
    // the estate compiles to.
    for (const entry of IMPLEMENTED_CODES) {
      const fit = fitByCode.get(entry.code);
      expect(fit).toBeDefined();
      expect(fit!.state).toBe('FITTED');
      expect(entry.displayName).toBe(fit!.name);
      expect(entry.shape).toBe(fit!.shape);
      const [min, max] = entry.arity;
      expect(Math.min(...fit!.arities)).toBeGreaterThanOrEqual(min);
      expect(Math.max(...fit!.arities)).toBeLessThanOrEqual(max);
    }
  });

  it('emits only allowlisted function names', () => {
    for (const entry of IMPLEMENTED_CODES) {
      if (entry.sql.kind === 'function') expect(SCALAR_FUNCTIONS.has(entry.sql.name)).toBe(true);
      if (entry.sql.kind === 'aggregate') expect(AGGREGATE_FUNCTIONS.has(entry.sql.name)).toBe(true);
    }
  });

  it('knows which codes the fit settled, so a refusal names the right gap', () => {
    // CODE_NOT_IMPLEMENTED is Phase 4.3's worklist; UNFITTED_CODE is not — it
    // needs the evidence rule widened or the corpus rebuilt. A drifted set
    // would file the second as the first and send someone after work that
    // cannot be done.
    const settled = fitted.codes.filter((c) => c.state === 'FITTED').map((c) => c.code);
    expect([...FITTED_CODES].sort((a, b) => a - b)).toEqual(settled.sort((a, b) => a - b));
  });

  it('implements exactly the codes it says it does', () => {
    expect([...IMPLEMENTED_CODES].map((e) => e.code).sort((a, b) => a - b)).toEqual(
      [...PHASE_4_2_CODES, ...PHASE_4_3_CODES].sort((a, b) => a - b),
    );
  });
});

/**
 * The busiest real (stored, displayed) pair using each implemented code.
 *
 * Drawn from the corpus rather than from `builtin-code-table.json`'s
 * `examples`, which the fitter truncates at 240 characters — five of the
 * implemented codes have no untruncated example there, and a test that parses
 * a truncated token string is testing the truncation.
 *
 * Only rows whose every code is implemented qualify, so a failure names the
 * code under test rather than an unimplemented neighbour — and rows the
 * anonymiser destroyed are skipped, because those can never match whatever the
 * renderer does. The comparison operators are the ones this matters for: a
 * private filter's Name is frequently its own DisplayFormula, so the busiest
 * `=`, `<>`, `>=` and `LIKE` rows in the corpus are all clobbered.
 */
const CASE_BY_CODE = (() => {
  const rows = readFormulaCorpus(resolve(process.cwd(), 'corpus', 'formula-corpus.tsv'));
  const implemented = new Set(IMPLEMENTED_CODES.map((entry) => entry.code));
  const best = new Map<number, { io: string; display: string; occurrences: number }>();
  for (const row of rows) {
    const parsed = parseFormulaTree(row.io);
    if (parsed.tree === null) continue;
    const codes = new Set<number>();
    const walk = (node: FormulaNode): void => {
      if (node.type === 'call') codes.add(node.code);
      if (node.type === 'call' || node.type === 'function' || node.type === 'unknown') {
        node.args.forEach(walk);
      }
    };
    walk(parsed.tree);
    if (codes.size === 0 || [...codes].some((c) => !implemented.has(c))) continue;
    let rendered: string;
    try {
      rendered = renderDisplay(parsed.tree);
    } catch {
      continue;
    }
    if (isAnonymiserDamage(rendered, row.display)) continue;
    for (const code of codes) {
      const seen = best.get(code);
      if (seen === undefined || row.occurrences > seen.occurrences) {
        best.set(code, { io: row.io, display: row.display, occurrences: row.occurrences });
      }
    }
  }
  return best;
})();

describe('per-code fidelity, against Oracle’s own rendering', () => {
  // One case per implemented code, each a real pair from a real workbook.
  for (const entry of IMPLEMENTED_CODES) {
    const label = `[1,${entry.code}] ${entry.displayName}`;
    it(`${label} renders as Discoverer rendered it`, () => {
      const example = CASE_BY_CODE.get(entry.code);
      // Every implemented code is FITTED, and FITTED means it was fitted from
      // rows — so no attestation at all is a corrupt corpus, not a skip.
      if (example === undefined) throw new Error(`${label} has no attestation in the corpus`);
      expect(displayMatches(renderDisplay(tree(example.io)), example.display)).toBe(true);
    });
  }

  it('rejects a rendering that reads one item two different ways', () => {
    // The back-reference is a real constraint, not decoration: without it a
    // wrong reading could bind the same element to two different names and
    // still "match".
    const io = '[1,94]([6,7],[6,7])';
    expect(displayMatches(renderDisplay(tree(io)), 'Alpha+Alpha')).toBe(true);
    expect(displayMatches(renderDisplay(tree(io)), 'Alpha+Beta')).toBe(false);
  });

  it('does not let a placeholder swallow structure', () => {
    // `a+b` and `a` are different formulas. A placeholder allowed to eat
    // brackets and commas would make every shape match every string.
    expect(displayMatches(renderDisplay(tree('[6,7]')), 'DECODE(A,B)')).toBe(false);
  });
});

describe('SQL emission', () => {
  it('parenthesises every infix node unconditionally (D-051)', () => {
    // ((a) - (b)) * (c) — no precedence table anywhere, and none needed.
    const result = renderSql(tree('[1,96]([1,95]([6,1],[6,2]),[6,3])'), ctx());
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error('unreachable');
    // The inner node parenthesises itself and the outer parenthesises its
    // operands, so a nested infix picks up a redundant pair. Redundant is the
    // point: it is what removes precedence from the problem.
    expect(result.sql).toBe('(((("T1"."COL_1") - ("T1"."COL_2"))) * ("T1"."COL_3"))');
  });

  it('parenthesises even a single infix node', () => {
    const result = renderSql(tree('[1,94]([6,1],[6,2])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(("T1"."COL_1") + ("T1"."COL_2"))');
  });

  it('binds every runtime value, splicing none of them', () => {
    const binder = createBindCollector();
    const result = renderSql(
      tree(String.raw`[1,68]([6,1],[5,1,"O'Brien"])`),
      ctx({ bind: binder.bind }),
    );
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('NVL("T1"."COL_1", :v1)');
    // The value never reaches the SQL text — not even escaped.
    expect(result.sql).not.toContain('Brien');
    expect(binder.values).toEqual({ v1: "O'Brien" });
  });

  it('binds a numeric literal too', () => {
    // A "number" here is whatever bytes the workbook stored. Splicing it
    // because it looks numeric is how the first injection gets in.
    const binder = createBindCollector();
    const result = renderSql(tree('[1,95]([6,1],[5,2,"200"])'), ctx({ bind: binder.bind }));
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(("T1"."COL_1") - (:v1))');
    expect(binder.values).toEqual({ v1: '200' });
  });

  it('rejects an identifier containing a quote rather than escaping it', () => {
    const evil: ItemBinding = { name: 'x', column: 'COL"; DROP TABLE T --' };
    const result = renderSql(tree('[6,1]'), ctx({ resolveItem: () => evil }));
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_IDENTIFIER' });
  });

  it('rejects a quoted qualifier too', () => {
    const result = renderSql(
      tree('[6,1]'),
      ctx({ resolveItem: () => ({ name: 'x', qualifier: 'A"B', column: 'COL' }) }),
    );
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_IDENTIFIER' });
  });

  it('rejects a parameter whose bind name is not a legal bind name', () => {
    const result = renderSql(tree('[8,9]'), ctx({ resolveParameter: () => 'Apólice nº' }));
    expect(result).toMatchObject({ ok: false, reason: 'INVALID_IDENTIFIER' });
  });

  it('refuses an element the workbook table does not carry', () => {
    const result = renderSql(tree('[6,1]'), ctx({ resolveItem: () => null }));
    expect(result).toMatchObject({ ok: false, reason: 'UNRESOLVED_ELEMENT' });
  });

  it('emits NULL as a keyword, not a bind', () => {
    const result = renderSql(tree('[1,68]([6,1],[1,115]())'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('NVL("T1"."COL_1", NULL)');
  });

  it('reports every item it referenced', () => {
    const result = renderSql(tree('[1,94]([6,1],[1,95]([6,2],[6,1]))'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.referencedItems).toEqual(['ITEM_1', 'ITEM_2', 'ITEM_1']);
  });
});

/**
 * The SQL forms Phase 4.3 adds. The display side of each is already pinned by
 * a real corpus pair above; these pin what actually executes, which the
 * display form cannot tell you (see `builtin-codes.ts`, "the one trap").
 */
describe('SQL emission — the Phase 4.3 forms', () => {
  it('emits BETWEEN with both bounds parenthesised', () => {
    const result = renderSql(tree('[1,92]([6,1],[5,2,"1"],[5,2,"9"])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(("T1"."COL_1") BETWEEN (:v1) AND (:v2))');
  });

  it('emits IN with every list member bound', () => {
    const result = renderSql(tree('[1,88]([6,1],[5,1,"M"],[5,1,"D"])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(("T1"."COL_1") IN ((:v1), (:v2)))');
  });

  it('emits NOT IN as NOT IN, never as IN', () => {
    // D-058's founding example: migrating NOT IN as IN inverts the filter and
    // the number it produces is wrong, not missing.
    const result = renderSql(tree('[1,91]([6,1],[5,1,"3"],[5,1,"5"])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(("T1"."COL_1") NOT IN ((:v1), (:v2)))');
  });

  it('emits unary minus parenthesised, so it cannot bind wrongly', () => {
    const result = renderSql(tree('[1,96]([1,114]([6,1]),[6,2])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('(((-("T1"."COL_1"))) * ("T1"."COL_2"))');
  });

  it('refuses COUNT_DISTINCT, which the fan-trap planner cannot re-aggregate', () => {
    const result = renderSql(tree('[1,117]([6,1])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'UNREAGGREGABLE' });
  });

  it('refuses a code whose rendering does not show what it computes', () => {
    // [1,126] 2_Pass_Percentage displays as its argument alone. It renders
    // perfectly and can never be compiled from that evidence.
    expect(displayMatches(renderDisplay(tree('[1,126]([6,7])')), 'Alpha')).toBe(true);
    expect(renderSql(tree('[1,126]([6,1])'), ctx())).toMatchObject({
      ok: false,
      reason: 'UNKNOWN_SEMANTICS',
    });
  });
});

describe('containsAggregate — the fan-trap planner depends on it', () => {
  it('is true when the tree carries an aggregate', () => {
    const result = renderSql(tree('[1,1]([6,1])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toBe('SUM("T1"."COL_1")');
    expect(result.containsAggregate).toBe(true);
  });

  it('is true when the aggregate is nested, not at the root', () => {
    const result = renderSql(tree('[1,97]([1,1]([6,1]),[5,2,"100"])'), ctx());
    if (!result.ok) throw new Error('expected a render');
    expect(result.containsAggregate).toBe(true);
  });

  it('is false for a scalar tree, however aggregate-looking the column', () => {
    // Read from the tree, never from the emitted text: a text scan would call
    // a column named SUM_TOTAL an aggregate and rewrite a query that needs no
    // rewriting.
    const result = renderSql(
      tree('[1,68]([6,1],[5,2,"0"])'),
      ctx({ resolveItem: () => ({ name: 'SUM_TOTAL', qualifier: 'T1', column: 'SUM_TOTAL' }) }),
    );
    if (!result.ok) throw new Error('expected a render');
    expect(result.sql).toContain('SUM_TOTAL');
    expect(result.containsAggregate).toBe(false);
  });
});

describe('refusal (D-058) — never a best-effort render', () => {
  it('has no FITTED code left unimplemented', () => {
    // Phase 4.3 closes the FITTED set, so CODE_NOT_IMPLEMENTED now has no
    // population. The reason stays in the union because a re-fit that settles
    // a new code re-opens it — but until then, a refusal citing it would mean
    // the table and the fit had drifted apart.
    const implemented = new Set(IMPLEMENTED_CODES.map((entry) => entry.code));
    expect([...FITTED_CODES].filter((code) => !implemented.has(code))).toEqual([]);
  });

  it('quarantines a code the fit could not settle', () => {
    // [1,89] IS NULL is AMBIGUOUS: four clean rows attest one shape and the
    // degenerate shape also covers them. Guessing would invert a filter.
    const result = renderSql(tree('[1,89]([6,1])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'UNFITTED_CODE' });
  });

  it('quarantines rather than rendering an unsettled code best-effort', () => {
    // The display renderer refuses on the same terms, so an unfitted code can
    // never reach the fidelity comparison as a near-miss either.
    expect(() => renderDisplay(tree('[1,89]([6,1])'))).toThrow('UNFITTED_CODE');
  });

  it('quarantines an unknown node', () => {
    const result = renderSql(tree('[9,1]'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'UNKNOWN_NODE' });
  });

  it('quarantines a custom function, which the aligned corpus cannot attest', () => {
    const result = renderSql(tree('[2,20]([6,1])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'UNRESOLVED_FUNCTION' });
  });

  it('quarantines an argument count no attestation supports', () => {
    const result = renderSql(tree('[1,68]([6,1])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'BAD_ARITY' });
  });

  it('refuses a date literal rather than emitting a two-digit year', () => {
    // 'TO_DATE(''01.12.01'')' would make the century depend on
    // NLS_DATE_FORMAT. 4.3 emits an explicit mask.
    const result = renderSql(tree('[1,58]([5,4,"20011201000000"])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'DATE_LITERAL_NOT_IMPLEMENTED' });
  });

  it('refuses a date carrying a time rather than truncating it', () => {
    const result = renderSql(tree('[1,58]([5,4,"20011201143000"])'), ctx());
    expect(result).toMatchObject({ ok: false, reason: 'DATE_WITH_TIME' });
    // …and the display side refuses it identically, so the two never disagree.
    expect(() => renderDisplay(tree('[1,58]([5,4,"20011201143000"])'))).toThrow('DATE_WITH_TIME');
  });

  it('renders the date literal that IS attested, on the display side', () => {
    // yy.mm.dd reproduces 846 date-bearing rows; every rival scores lower.
    expect(renderDisplay(tree('[5,4,"20011201000000"]'))).toBe("'01.12.01'");
  });
});
