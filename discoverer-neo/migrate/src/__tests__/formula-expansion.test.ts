import { describe, it, expect } from '@jest/globals';
import { resolve } from 'node:path';

import { readFormulaCorpus } from '../services/formula-corpus-agreement.js';
import {
  calculationResolver,
  expandCalculations,
  MAX_EXPANSION_DEPTH,
} from '../semantics/expand.js';
import { Quarantined, renderDisplay } from '../semantics/render.js';
import { formatFormulaTree, parseFormulaTree } from '../services/workbook-parser.js';

/**
 * Calculation-reference expansion (D-056).
 *
 * What is being defended here is the pair of properties that make expansion
 * safe to run over customer data: it reproduces what Oracle's own dump tool
 * produced, and it *terminates with a stated reason* on every graph that is
 * not a plain tree. A cycle must not reach the stack, and an acyclic graph
 * must not be allowed to expand without limit either.
 */

function tree(tokens: string) {
  const { tree: parsed, error } = parseFormulaTree(tokens);
  if (parsed === null) throw new Error(`fixture did not parse: ${error}`);
  return parsed;
}

/** A worksheet whose calculations are given as `elementId -> token string`. */
function worksheet(calcs: Record<number, string>) {
  return calculationResolver(
    Object.entries(calcs).map(([elementId, tokens]) => ({
      elementId: Number(elementId),
      tokens,
    })),
  );
}

/** Expand and write the result back out in Oracle's own token notation. */
function expanded(tokens: string, calcs: Record<number, string>): string {
  return formatFormulaTree(expandCalculations(tree(tokens), worksheet(calcs)).node);
}

describe('calculation-reference expansion', () => {
  it('substitutes a reference to another calculation', () => {
    // NET = GROSS - TAX, where [6,40] is itself the calculation GROSS + FEE.
    expect(expanded('[1,95]([6,40],[6,7])', { 40: '[1,94]([6,1],[6,2])' })).toBe(
      '[1,95]([1,94]([6,1],[6,2]),[6,7])',
    );
  });

  it('leaves a reference to a plain EUL item alone', () => {
    expect(expanded('[1,95]([6,40],[6,7])', {})).toBe('[1,95]([6,40],[6,7])');
  });

  it('expands a two-level chain', () => {
    expect(
      expanded('[1,49]([6,3])', { 3: '[1,94]([6,2],[5,2,"1"])', 2: '[1,95]([6,1],[5,2,"2"])' }),
    ).toBe('[1,49]([1,94]([1,95]([6,1],[5,2,"2"]),[5,2,"1"]))');
  });

  it('reports the deepest chain it walked', () => {
    const three = expandCalculations(
      tree('[6,3]'),
      worksheet({ 3: '[6,2]', 2: '[6,1]', 1: '[1,94]([6,90],[6,91])' }),
    );
    expect(three.maxDepth).toBe(3);
    expect(three.substitutions).toBe(3);

    expect(expandCalculations(tree('[1,94]([6,90],[6,91])'), worksheet({})).maxDepth).toBe(0);
  });

  it('counts a calculation used twice as two substitutions, not a cycle', () => {
    // A diamond is acyclic. Both arms must expand.
    const result = expandCalculations(
      tree('[1,94]([6,5],[6,5])'),
      worksheet({ 5: '[1,95]([6,1],[5,2,"1"])' }),
    );
    expect(result.substitutions).toBe(2);
    expect(formatFormulaTree(result.node)).toBe(
      '[1,94]([1,95]([6,1],[5,2,"1"]),[1,95]([6,1],[5,2,"1"]))',
    );
  });

  it('quarantines a calculation that references itself', () => {
    let thrown: unknown;
    try {
      expandCalculations(tree('[1,94]([6,5],[5,2,"1"])'), worksheet({ 5: '[1,94]([6,5],[6,1])' }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Quarantined);
    expect((thrown as Quarantined).reason).toBe('CALCULATION_CYCLE');
    expect((thrown as Quarantined).detail).toBe('[6,5] -> [6,5]');
  });

  it('quarantines a cycle through other calculations, and names the chain', () => {
    let thrown: unknown;
    try {
      expandCalculations(tree('[6,1]'), worksheet({ 1: '[6,2]', 2: '[6,3]', 3: '[6,1]' }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Quarantined);
    expect((thrown as Quarantined).reason).toBe('CALCULATION_CYCLE');
    expect((thrown as Quarantined).detail).toBe('[6,1] -> [6,2] -> [6,3] -> [6,1]');
  });

  it('refuses a chain deeper than the bound rather than walking it', () => {
    // A long acyclic chain: 1 -> 2 -> 3 -> … Nothing here repeats, so only the
    // depth bound stops it.
    const calcs: Record<number, string> = {};
    for (let id = 1; id <= MAX_EXPANSION_DEPTH + 5; id += 1) calcs[id] = `[6,${id + 1}]`;

    expect(() => expandCalculations(tree('[6,1]'), worksheet(calcs))).toThrow(Quarantined);
    try {
      expandCalculations(tree('[6,1]'), worksheet(calcs));
    } catch (err) {
      expect((err as Quarantined).reason).toBe('EXPANSION_TOO_DEEP');
    }
  });

  it('refuses an acyclic graph that expands exponentially', () => {
    // Each level names the one below it twice, so level n expands to 2^n
    // leaves. Twelve levels is 4 096 — well inside the depth bound and well
    // outside a sane node count. Depth alone would not catch this.
    const calcs: Record<number, string> = {};
    for (let id = 1; id <= 12; id += 1) calcs[id] = `[1,94]([6,${id + 1}],[6,${id + 1}])`;

    let thrown: unknown;
    try {
      expandCalculations(tree('[6,1]'), worksheet(calcs), { maxNodes: 500 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Quarantined);
    expect((thrown as Quarantined).reason).toBe('EXPANSION_TOO_LARGE');
  });

  it('leaves a reference standing when the referenced calculation will not parse', () => {
    // Not an invented shape: the reference survives as `[6,9]` and the
    // renderer refuses it as an unresolved element, with a reason.
    expect(expanded('[6,9]', { 9: 'not a token tree' })).toBe('[6,9]');
  });

  it('renders the expanded tree through the ordinary renderer', () => {
    const result = expandCalculations(
      tree('[1,49]([6,40])'),
      worksheet({ 40: '[1,94]([6,1],[6,2])' }),
    );
    // TRUNC of a sum: expansion produced nodes, so the renderer sees a shape
    // it already knows and no new path was added to it.
    expect(renderDisplay(result.node)).toContain('TRUNC(');
  });
});

describe('token-tree serialisation', () => {
  it('round-trips every node kind', () => {
    for (const tokens of [
      '[6,18]',
      '[8,9]',
      '[5,1,"hello"]',
      '[5,2,"200"]',
      '[5,4,"20011201000000"]',
      '[1,115]()',
      '[1,94]([6,1],[6,2])',
      '[2,16]([6,1])',
    ]) {
      expect(formatFormulaTree(tree(tokens))).toBe(tokens);
    }
  });

  it('escapes a literal that carries a quote or a backslash', () => {
    const node = tree('[5,1,"a\\"b\\\\c"]');
    expect(formatFormulaTree(node)).toBe('[5,1,"a\\"b\\\\c"]');
    expect(formatFormulaTree(tree(formatFormulaTree(node)))).toBe(formatFormulaTree(node));
  });

  it('writes every corpus token string back byte for byte', () => {
    // The serialiser only earns the differ's trust if Oracle's own notation is
    // reproduced exactly — including `()` on a zero-argument call. 22 748 real
    // token strings is the evidence for that, not a handful of fixtures.
    const rows = readFormulaCorpus(
      resolve(process.cwd(), 'corpus', 'formula-corpus.tsv'),
    );
    expect(rows.length).toBeGreaterThan(20_000);

    const differing: string[] = [];
    for (const row of rows) {
      const { tree: parsed } = parseFormulaTree(row.io);
      if (parsed === null) continue;
      if (formatFormulaTree(parsed) !== row.io) differing.push(row.io);
    }
    expect(differing.slice(0, 5)).toEqual([]);
  });
});
