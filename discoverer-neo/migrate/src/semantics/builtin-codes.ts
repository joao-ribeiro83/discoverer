/**
 * The `[1,n]` codes this renderer implements, and how each one is written.
 *
 * Every row is transcribed from `corpus/builtin-code-table.json`, which Phase
 * 4.1 fitted against 37 971 aligned (stored, displayed) pairs. Nothing here is
 * inferred: `builtin-code-table.test.ts` pins each `shape`, `displayName` and
 * arity back to that JSON, so a re-fit that moves a code fails the build
 * rather than silently changing what the estate compiles to.
 *
 * ## The one trap
 *
 * **`shape` is how Oracle DISPLAYS the node. It is not the SQL.** The display
 * form is the oracle for *structure* — arity, fixity, argument order — and for
 * nothing else. `[1,117]` displays `COUNT_DISTINCT(a)` and means
 * `COUNT(DISTINCT a)`; `[1,126]` displays its argument alone and computes
 * something the rendering cannot show. So `shape` drives the fidelity
 * comparison and `sql` drives the emitted expression, and the two are
 * deliberately separate fields.
 *
 * ## What is in scope
 *
 * The ten highest-frequency codes of the phase brief, plus six more measured
 * as the cheapest way to clear its own >= 93 % gate — see `PHASE_4_2_CODES`.
 * Every other code, fitted or not, quarantines with a stated reason (D-058).
 */

import { AGGREGATE_FUNCTIONS, SCALAR_FUNCTIONS } from './allowlist.js';

/**
 * How Oracle writes the node on screen. A subset of the fitter's `Shape`
 * union — the shapes the implemented codes actually use.
 */
export type DisplayShape =
  | 'prefix' // NAME(a,b)
  | 'zeroBare' // NAME
  | 'infixTight' // a-b
  | 'infixSpaced' // a = b
  | 'bracketSpaced' // ( a )
  | 'unaryTight' // -a
  | 'between' // a BETWEEN b AND c
  | 'inList' // a IN (b,c)  /  a NOT IN (b,c)
  | 'passthrough' // a — the code leaves no mark on the rendering
  | 'whenThen' // WHEN a THEN b — a [1,163] branch, always inside a CASE
  | 'caseEnd' // CASE a b c... END — each child a whenThen or elseValue
  | 'elseValue'; // ELSE a — [1,164], optional, only as CASE's last child

/** How the node is emitted into SQL. Independent of `DisplayShape`. */
export type SqlForm =
  /** `NAME(a, b)` against the scalar allowlist. */
  | { kind: 'function'; name: string }
  /** `NAME(a)` against the aggregate allowlist; sets `containsAggregate`. */
  | { kind: 'aggregate'; name: string }
  /** `((a) OP (b))` — parenthesised unconditionally, D-051. */
  | { kind: 'operator'; op: string }
  /** A bare SQL keyword taking no arguments. */
  | { kind: 'keyword'; text: string }
  /** `(a)` — an explicit bracket the author wrote. */
  | { kind: 'group' }
  /** `(OP (a))` — a one-argument operator, D-051 parenthesised like the rest. */
  | { kind: 'unary'; op: string }
  /** `((a) BETWEEN (b) AND (c))`. */
  | { kind: 'between' }
  /** `((a) IN ((b),(c)))`, or `NOT IN` when `not`. */
  | { kind: 'inList'; not: boolean }
  /** `COUNT(DISTINCT a)` — refused today, see `UNREAGGREGABLE_FUNCTIONS`. */
  | { kind: 'aggregateDistinct'; name: string }
  /**
   * The rendering does not show what the node computes, so no SQL can be
   * derived from it. Displays fine; refuses on the SQL side with `reason`.
   */
  | { kind: 'displayOnly'; reason: 'UNKNOWN_SEMANTICS' }
  /** `WHEN a THEN b` — a [1,163] node, always a direct child of a CASE. */
  | { kind: 'whenThen' }
  /** `CASE a b c... END` — each arg already `WHEN...THEN...` or `ELSE...`. */
  | { kind: 'case' }
  /** `ELSE a` — a [1,164] node, optional, only as a CASE's last child. */
  | { kind: 'elseValue' };

export interface BuiltinCode {
  code: number;
  /** Oracle's own name for the code, used by the display renderer. */
  displayName: string;
  shape: DisplayShape;
  /** Inclusive `[min, max]` argument count, from the fitted attestations. */
  arity: readonly [number, number];
  sql: SqlForm;
}

/**
 * The ten codes named by the Phase 4.2 brief, in its own frequency order.
 *
 * Measured coverage on the aligned corpus: **82.83 % weighted, 85.85 %
 * distinct**. The brief's "93.5 %" counts *built-in node uses* across all 547
 * whole dumps; the gate counts *whole formulas* in the aligned corpus, and a
 * formula renders only when every code in it is implemented. The two are
 * different denominators and they do not meet.
 */
export const PHASE_4_2_TOP_TEN: readonly number[] = [
  102, 95, 12, 115, 96, 94, 61, 58, 68, 55,
];

/**
 * Six further FITTED codes, added to clear the phase's own >= 93 % gate.
 *
 * Chosen by measurement, not taste: greedily, each is the single code that
 * buys the most weighted coverage given the ones before it. Running total on
 * the aligned corpus, weighted — TRUNC 85.47, SUM 87.51, `=` 89.45, LIKE
 * 91.24, `()` 92.67, `/` **93.83**. Stopping at ten leaves the gate
 * unreachable by 10.2 points; these six are the shortest path to it.
 *
 * They are listed apart from the ten so the delta stays visible and
 * reversible. The remaining FITTED codes are Phase 4.3's.
 *
 * `[1,82]` `<>` is deliberately NOT here, though it is FITTED and its family
 * is. All eleven corpus rows that use it are either anonymiser casualties or
 * blocked by `[1,98]` `AND`, so it has no clean attestation to test against
 * and implementing it would buy exactly zero exact matches. An implemented
 * code with no evidence behind it is the guess this phase exists to refuse.
 */
export const PHASE_4_2_GATE_CLOSERS: readonly number[] = [
  49, 1, 81, 87, 106, 97, 85, 86, 83, 84, 104,
];

/** Everything 4.2 renders. */
export const PHASE_4_2_CODES: readonly number[] = [
  ...PHASE_4_2_TOP_TEN,
  ...PHASE_4_2_GATE_CLOSERS,
];

/**
 * Phase 4.3's tail, batch A — every remaining `FITTED` code above 100 uses.
 *
 * Worked in descending frequency because the exact-match percentage is the
 * progress signal, and these nine carry 1 611 of the 1 637 occurrences 4.2
 * left quarantined.
 *
 * `[1,88]` `IN` and `[1,91]` `NOT IN` are a caveat worth stating. The fitter
 * hard-codes `' IN ('` for the `inList` shape and ignores the code's name, so
 * `[1,91]` "fits" only because its strict placeholder swallows the word `NOT`
 * — `Xkzoub Krwa NOT` is a legal identifier under that class. The rendering
 * itself is not in doubt: the attested row reads `Xkzoub Krwa NOT IN ('M','A')`
 * and `EUL_FUNCTION_NAMES[91]` is `NOT IN`. So this renderer writes the code's
 * own name into the list form, which is what the corpus shows, not what the
 * fitter's regex happened to accept.
 */
export const PHASE_4_3_BATCH_A: readonly number[] = [92, 88, 98, 48, 18, 11, 42, 99, 103];

/**
 * Phase 4.3's tail, batch B — every `FITTED` code that remains.
 *
 * With these twelve, all 42 codes Phase 4.1 settled are implemented and
 * `CODE_NOT_IMPLEMENTED` has no population left. What still refuses is the
 * `UNTESTED` and `AMBIGUOUS` set, which is a different problem: it needs
 * evidence, not code.
 *
 * Two of them are only half implemented, and deliberately so — the display
 * side is fitted, the SQL side is not derivable from it:
 *
 * - `[1,117]` `COUNT_DISTINCT` means `COUNT(DISTINCT a)`, which the fan-trap
 *   planner cannot re-aggregate, so it refuses `UNREAGGREGABLE` (§10).
 * - `[1,126]` `2_Pass_Percentage` displays as its argument alone. Whatever it
 *   computes is not visible in the rendering, so it refuses
 *   `UNKNOWN_SEMANTICS` — the one code here that renders perfectly and can
 *   never be compiled from this evidence.
 */
export const PHASE_4_3_BATCH_B: readonly number[] = [
  79, 44, 82, 43, 28, 73, 114, 126, 91, 23, 32, 117,
];

/** Everything 4.3 adds. */
export const PHASE_4_3_CODES: readonly number[] = [
  ...PHASE_4_3_BATCH_A,
  ...PHASE_4_3_BATCH_B,
];

/**
 * `CASE`/`WHEN`/`ELSE` — added investigating Phase 7.2's schedule migration,
 * not a numbered phase brief. Left UNTESTED at 4.1 (`state: "UNTESTED"`,
 * `evidenceRows: 0` in the corpus table — a hypothesis, never fitted) and
 * refuse-only ever since (4.3's own note: "CASE/WHEN/ELSE... refuse-only").
 *
 * FITTED here from a real, unredacted (`IOFormula`, `DisplayFormula`) pair —
 * `d4wkdmp.exe` against the live estate's `GD_M.M04_V46.DIS2` workbook,
 * 2026-09-14 — not the anonymised corpus, which is why `evidenceRows`/
 * `matchedRows` in `builtin-code-table.json` stay 0 even with `state`
 * flipped to `FITTED`: those fields count corpus rows specifically, and none
 * of the corpus's own 28 have been checked against this implementation yet.
 * The formula-corpus.tsv row for [1,164] (untruncated, unlike the JSON's own
 * 240-char-capped `examples`) is what confirms ELSE is a *separate* code —
 * `[1,164](value)`, arity exactly 1 — not a differently-shaped [1,163].
 */
export const PHASE_4_4_CODES: readonly number[] = [162, 163, 164];

const TABLE: readonly BuiltinCode[] = [
  // --- the ten ------------------------------------------------------------
  { code: 102, displayName: 'DECODE', shape: 'prefix', arity: [3, 60], sql: { kind: 'function', name: 'DECODE' } },
  { code: 95, displayName: '-', shape: 'infixTight', arity: [2, 2], sql: { kind: 'operator', op: '-' } },
  { code: 12, displayName: 'SIGN', shape: 'prefix', arity: [1, 1], sql: { kind: 'function', name: 'SIGN' } },
  { code: 115, displayName: 'NULL', shape: 'zeroBare', arity: [0, 0], sql: { kind: 'keyword', text: 'NULL' } },
  { code: 96, displayName: '*', shape: 'infixTight', arity: [2, 2], sql: { kind: 'operator', op: '*' } },
  { code: 94, displayName: '+', shape: 'infixTight', arity: [2, 2], sql: { kind: 'operator', op: '+' } },
  // Widened to 3 for the live estate's TO_NUMBER(expr, format, nlsparam) —
  // Oracle's own documented 3-arg form, not a corpus attestation: the
  // fitted corpus (`arities: [1]` in builtin-code-table.json, deliberately
  // left untouched) only ever saw the 1-arg call. `d4wkdmp` gives no
  // DisplayFormula for this specific field (it is an EUL Private Item —
  // none of those carry one in the dump, confirmed against a sibling
  // DECODE that doesn't have this arity question either), so this is a
  // standard-syntax judgement call, not a verified (stored, displayed)
  // pair. If the argument order or meaning were ever wrong, Oracle would
  // reject the generated SQL outright rather than compute a wrong number —
  // this is not a case-branch guess.
  { code: 61, displayName: 'TO_NUMBER', shape: 'prefix', arity: [1, 3], sql: { kind: 'function', name: 'TO_NUMBER' } },
  { code: 58, displayName: 'TO_DATE', shape: 'prefix', arity: [1, 2], sql: { kind: 'function', name: 'TO_DATE' } },
  { code: 68, displayName: 'NVL', shape: 'prefix', arity: [2, 2], sql: { kind: 'function', name: 'NVL' } },
  { code: 55, displayName: 'TO_CHAR', shape: 'prefix', arity: [1, 2], sql: { kind: 'function', name: 'TO_CHAR' } },
  // --- the six that close the gate ----------------------------------------
  { code: 49, displayName: 'TRUNC', shape: 'prefix', arity: [1, 1], sql: { kind: 'function', name: 'TRUNC' } },
  { code: 1, displayName: 'SUM', shape: 'prefix', arity: [1, 1], sql: { kind: 'aggregate', name: 'SUM' } },
  { code: 81, displayName: '=', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '=' } },
  { code: 87, displayName: 'LIKE', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: 'LIKE' } },
  { code: 106, displayName: '()', shape: 'bracketSpaced', arity: [1, 1], sql: { kind: 'group' } },
  { code: 97, displayName: '/', shape: 'infixTight', arity: [2, 2], sql: { kind: 'operator', op: '/' } },
  { code: 85, displayName: '<=', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '<=' } },
  { code: 86, displayName: '>=', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '>=' } },
  { code: 83, displayName: '>', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '>' } },
  { code: 84, displayName: '<', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '<' } },
  { code: 104, displayName: '!=', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '!=' } },
  // --- Phase 4.3, batch A: every remaining FITTED code above 100 uses ------
  { code: 92, displayName: 'BETWEEN', shape: 'between', arity: [3, 3], sql: { kind: 'between' } },
  { code: 88, displayName: 'IN', shape: 'inList', arity: [2, 13], sql: { kind: 'inList', not: false } },
  { code: 98, displayName: 'AND', shape: 'infixSpaced', arity: [2, 7], sql: { kind: 'operator', op: 'AND' } },
  { code: 48, displayName: 'SYSDATE', shape: 'zeroBare', arity: [0, 0], sql: { kind: 'keyword', text: 'SYSDATE' } },
  { code: 18, displayName: 'TRUNC', shape: 'prefix', arity: [1, 1], sql: { kind: 'function', name: 'TRUNC' } },
  { code: 11, displayName: 'ROUND', shape: 'prefix', arity: [1, 2], sql: { kind: 'function', name: 'ROUND' } },
  { code: 42, displayName: 'ADD_MONTHS', shape: 'prefix', arity: [2, 2], sql: { kind: 'function', name: 'ADD_MONTHS' } },
  { code: 99, displayName: 'OR', shape: 'infixSpaced', arity: [2, 7], sql: { kind: 'operator', op: 'OR' } },
  { code: 103, displayName: '||', shape: 'infixTight', arity: [2, 2], sql: { kind: 'operator', op: '||' } },
  // --- Phase 4.3, batch B: the FITTED tail, 3 to 83 uses each --------------
  { code: 79, displayName: 'ABS', shape: 'prefix', arity: [1, 1], sql: { kind: 'function', name: 'ABS' } },
  { code: 44, displayName: 'MONTHS_BETWEEN', shape: 'prefix', arity: [2, 2], sql: { kind: 'function', name: 'MONTHS_BETWEEN' } },
  { code: 82, displayName: '<>', shape: 'infixSpaced', arity: [2, 2], sql: { kind: 'operator', op: '<>' } },
  { code: 43, displayName: 'LAST_DAY', shape: 'prefix', arity: [1, 1], sql: { kind: 'function', name: 'LAST_DAY' } },
  { code: 28, displayName: 'REPLACE', shape: 'prefix', arity: [3, 3], sql: { kind: 'function', name: 'REPLACE' } },
  { code: 73, displayName: 'COUNT', shape: 'prefix', arity: [1, 1], sql: { kind: 'aggregate', name: 'COUNT' } },
  { code: 114, displayName: '-', shape: 'unaryTight', arity: [1, 1], sql: { kind: 'unary', op: '-' } },
  { code: 126, displayName: '2_Pass_Percentage', shape: 'passthrough', arity: [1, 1], sql: { kind: 'displayOnly', reason: 'UNKNOWN_SEMANTICS' } },
  { code: 91, displayName: 'NOT IN', shape: 'inList', arity: [3, 3], sql: { kind: 'inList', not: true } },
  { code: 23, displayName: 'LPAD', shape: 'prefix', arity: [3, 3], sql: { kind: 'function', name: 'LPAD' } },
  { code: 32, displayName: 'SUBSTR', shape: 'prefix', arity: [3, 3], sql: { kind: 'function', name: 'SUBSTR' } },
  { code: 117, displayName: 'COUNT_DISTINCT', shape: 'prefix', arity: [1, 1], sql: { kind: 'aggregateDistinct', name: 'COUNT' } },
  // --- 4.4 (CASE/WHEN/ELSE, see PHASE_4_4_CODES) --------------------------
  { code: 162, displayName: 'CASE', shape: 'caseEnd', arity: [1, 60], sql: { kind: 'case' } },
  { code: 163, displayName: 'WHEN', shape: 'whenThen', arity: [2, 2], sql: { kind: 'whenThen' } },
  { code: 164, displayName: 'ELSE', shape: 'elseValue', arity: [1, 1], sql: { kind: 'elseValue' } },
];

const BY_CODE = new Map(TABLE.map((entry) => [entry.code, entry]));

export function builtinCode(code: number): BuiltinCode | undefined {
  return BY_CODE.get(code);
}

export const IMPLEMENTED_CODES: readonly BuiltinCode[] = TABLE;

/**
 * Every emitted function name is in the allowlist — checked once, at load, so
 * a table edit that adds an unallowed name fails immediately instead of at
 * the first estate that happens to use it.
 */
for (const entry of TABLE) {
  const { sql } = entry;
  if (sql.kind === 'function' && !SCALAR_FUNCTIONS.has(sql.name)) {
    throw new Error(`[1,${entry.code}] emits "${sql.name}", which is not in SCALAR_FUNCTIONS`);
  }
  if (sql.kind === 'aggregate' && !AGGREGATE_FUNCTIONS.has(sql.name)) {
    throw new Error(`[1,${entry.code}] emits "${sql.name}", which is not in AGGREGATE_FUNCTIONS`);
  }
}
