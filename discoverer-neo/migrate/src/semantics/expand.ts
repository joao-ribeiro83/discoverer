/**
 * Calculation-reference expansion (D-056, Phase 4.4).
 *
 * A `[6,n]` leaf usually names a plain EUL item. Sometimes `n` is another
 * worksheet calculation, and Oracle's own dump tool substitutes *that
 * calculation's formula* in its place, recursively — so a workbook's
 * `IOFormula` for a two-level chain already carries the whole expanded tree
 * while our parser stops at the reference. That gap is the whole of WB-04's
 * "formula disagreements": they are the unwalked chain, by design, not defects
 * (`workbook-parser.ts` `humanizeFormula` docstring).
 *
 * ## Why this runs at render time, not at migration time
 *
 * The stored token string stays exactly what Discoverer stored. Expansion is a
 * function of the tree plus the worksheet's calculation set, applied when
 * something is rendered — so improving the renderer never means re-migrating
 * an estate (D-056).
 *
 * ## Why the bounds are not optional
 *
 * The reference graph comes from customer data, so the traversal must be
 * bounded in both directions before it walks anything:
 *
 * - A **cycle** — a calculation reaching itself directly or through others —
 *   is refused with the chain named. Never a stack overflow: an unhandled
 *   recursion in a request path is an availability defect, and the whole point
 *   of the D-059 bucket vocabulary is that a refusal states its reason.
 * - **Depth** is bounded, and the deepest chain actually walked is reported,
 *   so the bound can be checked against what an estate really contains rather
 *   than guessed at.
 * - **Size** is bounded separately, because depth alone does not bound the
 *   work. A perfectly acyclic diamond — `d` names `c` twice, `c` names `b`
 *   twice, `b` names `a` twice — is four calculations deep and expands to
 *   eight leaves; twenty levels of it expands to a million. Substitution
 *   turns a DAG into a tree, and a tree is exponential in the DAG.
 *
 * Expansion produces *nodes*, never text. It is not a splice path: the
 * expanded tree goes through `renderSql` exactly as an unexpanded one does, so
 * identifier validation, the allowlist and the bind discipline all still
 * apply, once, in the one place that owns them.
 */

import type { FormulaNode } from '../services/workbook-parser.js';
import { parseFormulaTree } from '../services/workbook-parser.js';
import { Quarantined } from './render.js';

/**
 * The deepest chain of calculation references expansion will walk.
 *
 * Discoverer's own editor builds a chain one calculation at a time, so a real
 * one is short. Sixteen is well clear of anything observed and still refuses
 * long before a stack is at risk.
 */
export const MAX_EXPANSION_DEPTH = 16;

/**
 * The most nodes an expanded tree may contain. See the diamond note above:
 * this is the bound that actually stops the exponential case.
 */
export const MAX_EXPANSION_NODES = 20_000;

/** `[6,n]` -> that calculation's own tree, or null when `n` is a plain item. */
export type ResolveCalculation = (elementId: number) => FormulaNode | null;

export interface ExpansionResult {
  /** The tree with every calculation reference substituted. */
  node: FormulaNode;
  /**
   * The deepest chain actually walked; 0 when nothing expanded. Reported so an
   * estate's real maximum can be measured against `MAX_EXPANSION_DEPTH`.
   */
  maxDepth: number;
  /** How many `[6,n]` references were substituted. */
  substitutions: number;
  /** Nodes in the expanded tree, against `MAX_EXPANSION_NODES`. */
  nodes: number;
}

export interface ExpansionLimits {
  maxDepth?: number;
  maxNodes?: number;
}

/**
 * Substitute every calculation reference in `root`, recursively.
 *
 * Throws `Quarantined` — `CALCULATION_CYCLE`, `EXPANSION_TOO_DEEP` or
 * `EXPANSION_TOO_LARGE` — rather than returning a partial tree. A half-expanded
 * formula is a wrong number, which is the one outcome D-058 forbids.
 */
export function expandCalculations(
  root: FormulaNode,
  resolveCalculation: ResolveCalculation,
  limits: ExpansionLimits = {},
): ExpansionResult {
  const maxDepth = limits.maxDepth ?? MAX_EXPANSION_DEPTH;
  const maxNodes = limits.maxNodes ?? MAX_EXPANSION_NODES;

  // The ids on the current descent, in order. A Set alone would answer "is
  // this a cycle" but could not name the chain, and a refusal nobody can read
  // is not much better than a crash.
  const path: number[] = [];
  let maxObserved = 0;
  let substitutions = 0;
  let nodes = 0;

  const chain = (...ids: number[]): string =>
    [...path, ...ids].map((id) => `[6,${id}]`).join(' -> ');

  function walk(node: FormulaNode, depth: number): FormulaNode {
    nodes += 1;
    if (nodes > maxNodes) {
      throw new Quarantined('EXPANSION_TOO_LARGE', `passed ${maxNodes} nodes at ${chain()}`);
    }

    if (node.type === 'item') {
      const body = resolveCalculation(node.elementId);
      if (body === null) return node;
      if (path.includes(node.elementId)) {
        throw new Quarantined('CALCULATION_CYCLE', chain(node.elementId));
      }
      if (depth + 1 > maxDepth) {
        throw new Quarantined(
          'EXPANSION_TOO_DEEP',
          `more than ${maxDepth} references deep at ${chain(node.elementId)}`,
        );
      }
      path.push(node.elementId);
      substitutions += 1;
      if (depth + 1 > maxObserved) maxObserved = depth + 1;
      const expanded = walk(body, depth + 1);
      path.pop();
      return expanded;
    }

    // A leaf with no argument list is returned as it stands; nothing below it
    // can hold a reference, and rebuilding it would only churn allocations.
    if (!('args' in node) || node.args.length === 0) return node;
    return { ...node, args: node.args.map((arg) => walk(arg, depth)) };
  }

  const expanded = walk(root, 0);
  return { node: expanded, maxDepth: maxObserved, substitutions, nodes };
}

/**
 * Build a `ResolveCalculation` over a worksheet's own calculations.
 *
 * Takes the parsed calculations as the workbook parser produces them —
 * `elementId` plus the stored `tokens` — and parses each body once, on first
 * use. A calculation whose own token string will not parse resolves to null,
 * which leaves the reference standing as a plain `[6,n]`; the renderer then
 * refuses it as an unresolved element, with a reason, instead of expansion
 * inventing a shape for it.
 */
export function calculationResolver(
  calculations: readonly { elementId: number; tokens: string | null }[],
): ResolveCalculation {
  const source = new Map<number, string | null>();
  for (const calc of calculations) source.set(calc.elementId, calc.tokens);

  const parsed = new Map<number, FormulaNode | null>();
  return (elementId) => {
    if (parsed.has(elementId)) return parsed.get(elementId) ?? null;
    if (!source.has(elementId)) return null;
    const { tree } = parseFormulaTree(source.get(elementId) ?? null);
    parsed.set(elementId, tree);
    return tree;
  };
}
