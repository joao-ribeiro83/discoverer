/**
 * Compile one stored calculated field into an Oracle expression, or refuse
 * with a stated reason (Phase 4.5, D-055 / D-059).
 *
 * This is the seam-2 classifier. It reads `map_calculated_fields.source_tokens`
 * — the verbatim token form dual storage keeps — never `formula`, which has
 * item names substituted into it and cannot be re-parsed (decoder analysis
 * C-8).
 *
 * The four buckets are D-059's, and the ceiling here is real:
 *
 *   COMPILED             requires a result proven against a real Oracle. The
 *                        Phase 9.1 contract tests are what can claim it, so
 *                        this function never returns it.
 *   COMPILED_UNVERIFIED  the token tree rendered to an Oracle expression.
 *   QUARANTINED(reason)  it did not render, and we can name why.
 *   FAILED               a path we do not handle. Raised by the caller when
 *                        this throws, never returned.
 *
 * **`compiled_sql` is evidence, not an execution path.** Column references are
 * emitted unqualified, because the folder alias a column needs is assigned by
 * the planner at generation time and a stored string cannot know it. The
 * runtime still generates its own SQL per query; what this column proves is
 * that the formula has a reading at all, which is the question F-02 left open.
 *
 * Security (Phase 4.5): a reason is a CODE, never a formula body and never the
 * detail string, which can carry customer item labels. The partition is
 * counts, ids and codes — nothing a shared log should not hold.
 */

import { expandCalculations } from '../semantics/expand.js';
import {
  Quarantined,
  createBindCollector,
  renderSql,
  type FunctionBinding,
  type ItemBinding,
  type SqlRenderContext,
} from '../semantics/render.js';

import { parseFormulaTree, type ElementBindings, type FormulaNode } from './workbook-parser.js';

/** D-059 bucket vocabulary. Mirrors `CompileBucket` in `migration-verify.ts`. */
export type FormulaBucket = 'COMPILED' | 'COMPILED_UNVERIFIED' | 'QUARANTINED' | 'FAILED';

export interface CompileVerdict {
  bucket: FormulaBucket;
  /**
   * Why, as a stable code — `UNRESOLVED_ELEMENT`, `UNFITTED_CODE`,
   * `NO_SOURCE_TOKENS`, … Undefined on a compiled row. Codes rather than
   * messages so the per-reason histogram aggregates, and so nothing customer-
   * specific reaches a shared log.
   */
  reason?: string;
  /** The Oracle expression, or null when the row did not compile. */
  sql: string | null;
  /** Read from the tree, for BE-05's GROUP BY. Never re-derived from text. */
  containsAggregate: boolean;
}

/** One stored row, as seam 2 reads it. */
export interface StoredFormula {
  id: string;
  /** The verbatim token form. Null on a row authored in Neo, or pre-4.5. */
  sourceTokens: string | null;
  /** `source_attrs.elementBindings`, or empty when the row carries none. */
  bindings: ElementBindings;
}

/**
 * Everything one map's formulas resolve against. Built once per map by the
 * caller, because every formula on a map shares it.
 */
export interface CompileScope {
  /** Item name (lower-cased) → the column it is. */
  columnByItemName: ReadonlyMap<string, ItemBinding>;
  /** Calculation name (lower-cased) → its own token tree, for expansion. */
  treeByCalcName: ReadonlyMap<string, FormulaNode>;
  /**
   * Every calculated field's bindings on this map, merged.
   *
   * Expansion substitutes a sibling calculation's *tree*, and that subtree's
   * `[6,n]` ids were written against the sibling's own bindings — not the
   * row's. Element ids are workbook-scoped, so one merged table per map is the
   * right lookup and the row's own bindings simply win where both name an id.
   * Without this every expanded formula quarantines as `UNRESOLVED_ELEMENT`,
   * which is exactly the false negative D-056 warns about.
   */
  mapBindings: ElementBindings;
  /** `custom_functions.name` (upper-cased) → its binding. Estate-wide. */
  functionByName: ReadonlyMap<string, FunctionBinding>;
}

export const EMPTY_BINDINGS: ElementBindings = { items: {}, parameters: {}, functions: {} };

/** The reason a row with no token form carries. Stated, not silent. */
export const NO_SOURCE_TOKENS = 'NO_SOURCE_TOKENS';

/**
 * Compile one row.
 *
 * Never throws `Quarantined` — it is caught and turned into a bucket. Anything
 * else propagates, so the caller can file it as `FAILED`: an unhandled path is
 * our bug and must not be laundered into a quarantine reason.
 */
export function compileStoredFormula(row: StoredFormula, scope: CompileScope): CompileVerdict {
  const refused = (reason: string): CompileVerdict => ({
    bucket: 'QUARANTINED',
    reason,
    sql: null,
    containsAggregate: false,
  });

  if (row.sourceTokens === null || row.sourceTokens.trim() === '') {
    // Not a renderer gap. Either the row predates dual storage, or it was
    // authored in Neo and has no token form to render. Both are quarantine
    // with a reason, because neither is a compiled row.
    return refused(NO_SOURCE_TOKENS);
  }

  const { tree } = parseFormulaTree(row.sourceTokens);
  if (tree === null) return refused('PARSE_FAILED');

  // The row's own bindings first, then the map's merged table for the ids an
  // expanded sibling's subtree brings with it. Never a guess in either case:
  // an id neither names resolves to null and the renderer refuses.
  const named = (
    part: keyof ElementBindings,
    elementId: number,
  ): string | undefined =>
    row.bindings[part][String(elementId)] ?? scope.mapBindings[part][String(elementId)];

  try {
    // Expansion first (Phase 4.4, Decision 7): a `[6,n]` naming a sibling
    // calculation is substituted, not named, so the compiled expression is the
    // whole computation rather than a reference to a string.
    const expanded = expandCalculations(tree, (elementId) => {
      const name = named('items', elementId);
      if (name === undefined) return null;
      return scope.treeByCalcName.get(name.toLowerCase()) ?? null;
    });

    const collector = createBindCollector();
    const ctx: SqlRenderContext = {
      resolveItem: (elementId) => {
        const name = named('items', elementId);
        if (name === undefined) return null;
        return scope.columnByItemName.get(name.toLowerCase()) ?? null;
      },
      resolveParameter: (elementId) => named('parameters', elementId) ?? null,
      resolveFunction: (elementId) => {
        const name = named('functions', elementId);
        if (name === undefined) return null;
        return scope.functionByName.get(name.toUpperCase()) ?? null;
      },
      bind: collector.bind,
    };

    const result = renderSql(expanded.node, ctx);
    if (!result.ok) return refused(result.reason);

    return {
      // Not COMPILED: nothing has run this against an Oracle. See the header.
      bucket: 'COMPILED_UNVERIFIED',
      sql: result.sql,
      containsAggregate: result.containsAggregate,
    };
  } catch (err) {
    // Expansion refuses with `Quarantined` too — CALCULATION_CYCLE,
    // EXPANSION_TOO_DEEP, EXPANSION_TOO_LARGE — and those are quarantines with
    // a named reason, not failures.
    if (err instanceof Quarantined) return refused(err.reason);
    throw err;
  }
}
