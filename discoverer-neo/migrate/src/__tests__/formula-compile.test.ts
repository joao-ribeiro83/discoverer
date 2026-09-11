import { describe, it, expect } from '@jest/globals';

import {
  compileStoredFormula,
  EMPTY_BINDINGS,
  NO_SOURCE_TOKENS,
  type CompileScope,
  type StoredFormula,
} from '../services/formula-compile.js';
import { parseFormulaTree, type ElementBindings } from '../services/workbook-parser.js';
import type { FunctionBinding, ItemBinding } from '../semantics/render.js';

/**
 * The Phase 4.5 compile step — one stored row in, one D-059 bucket out.
 *
 * The renderer itself is defended in `formula-renderer.test.ts` against real
 * (stored, displayed) pairs. What is defended here is the part that only
 * exists once a formula is in the target database: resolving `[6,n]` through
 * the bindings dual storage kept, expanding a sibling calculation, and
 * refusing with a code rather than a message.
 *
 * `[1,1]` is SUM and `[1,97]` is `/`, both from the Phase 4.1 fit.
 */

function bindings(over: Partial<ElementBindings> = {}): ElementBindings {
  return { ...EMPTY_BINDINGS, ...over };
}

function scope(over: Partial<CompileScope> = {}): CompileScope {
  return {
    columnByItemName: new Map<string, ItemBinding>([
      ['amount', { name: 'AMOUNT', column: 'AMOUNT' }],
      ['region', { name: 'REGION', column: 'REGION' }],
    ]),
    treeByCalcElementId: new Map(),
    mapBindings: EMPTY_BINDINGS,
    functionByName: new Map<string, FunctionBinding>([
      ['PKG_RATE', { name: 'PKG_RATE', arity: null }],
    ]),
    ...over,
  };
}

function row(over: Partial<StoredFormula> = {}): StoredFormula {
  return { id: 'f1', sourceTokens: null, bindings: EMPTY_BINDINGS, ...over };
}

describe('compileStoredFormula', () => {
  it('compiles a token formula through the bindings, and says it is unverified', () => {
    const verdict = compileStoredFormula(
      row({
        sourceTokens: '[1,1]([6,27])',
        bindings: bindings({ items: { '27': 'AMOUNT' } }),
      }),
      scope(),
    );

    expect(verdict.bucket).toBe('COMPILED_UNVERIFIED');
    expect(verdict.sql).toBe('SUM("AMOUNT")');
    // Not COMPILED. Nothing here has run against an Oracle, and the Phase 9.1
    // contract tests are what can claim that bucket.
    expect(verdict.bucket).not.toBe('COMPILED');
  });

  it('reads containsAggregate off the tree, for BE-05', () => {
    const mixed = compileStoredFormula(
      row({
        sourceTokens: '[1,97]([1,1]([6,27]),[6,29])',
        bindings: bindings({ items: { '27': 'AMOUNT', '29': 'REGION' } }),
      }),
      scope(),
    );
    expect(mixed.sql).toBe('((SUM("AMOUNT")) / ("REGION"))');
    expect(mixed.containsAggregate).toBe(true);

    const flat = compileStoredFormula(
      row({ sourceTokens: '[6,27]', bindings: bindings({ items: { '27': 'AMOUNT' } }) }),
      scope(),
    );
    expect(flat.containsAggregate).toBe(false);
  });

  it('never touches the token form it compiled from', () => {
    // D-055's whole point: the compiled expression is derived, so the token
    // form must come back out of a compile run byte for byte.
    const stored = row({
      sourceTokens: '[1,1]([6,27])',
      bindings: bindings({ items: { '27': 'AMOUNT' } }),
    });
    const before = stored.sourceTokens;
    const verdict = compileStoredFormula(stored, scope());

    expect(stored.sourceTokens).toBe(before);
    expect(verdict.sql).not.toBe(stored.sourceTokens);
  });

  it('expands a `[6,n]` that names a sibling calculation', () => {
    const margin = parseFormulaTree('[1,1]([6,27])').tree!;
    const verdict = compileStoredFormula(
      row({
        sourceTokens: '[1,97]([6,900],[6,29])',
        bindings: bindings({ items: { '900': 'Margin', '29': 'REGION' } }),
      }),
      scope({
        // Keyed by the element id `[6,900]` names, not by the name "Margin":
        // the parser disambiguates same-named siblings, so the name detour
        // missed 50 378 bindings on the live estate.
        treeByCalcElementId: new Map([[900, margin]]),
        // Margin's own `[6,27]` — the substituted subtree brings ids the row
        // itself never named, which is what the merged table is for.
        mapBindings: bindings({ items: { '27': 'AMOUNT' } }),
      }),
    );

    // Substituted, not named: the compiled expression is the whole
    // computation, which is why WB-04's chains are not disagreements.
    expect(verdict.bucket).toBe('COMPILED_UNVERIFIED');
    expect(verdict.sql).toBe('((SUM("AMOUNT")) / ("REGION"))');
  });

  it('quarantines a row with no token form, and names that as the reason', () => {
    const verdict = compileStoredFormula(row({ sourceTokens: null }), scope());
    expect(verdict.bucket).toBe('QUARANTINED');
    expect(verdict.reason).toBe(NO_SOURCE_TOKENS);
    expect(verdict.sql).toBeNull();
  });

  it('quarantines an unparseable token string', () => {
    const verdict = compileStoredFormula(row({ sourceTokens: '[1,1]([6,' }), scope());
    expect(verdict).toMatchObject({ bucket: 'QUARANTINED', reason: 'PARSE_FAILED' });
  });

  it('quarantines an element the bindings do not name', () => {
    const verdict = compileStoredFormula(
      row({ sourceTokens: '[1,1]([6,27])', bindings: EMPTY_BINDINGS }),
      scope(),
    );
    expect(verdict).toMatchObject({ bucket: 'QUARANTINED', reason: 'UNRESOLVED_ELEMENT' });
  });

  it('quarantines an item the map does not carry', () => {
    const verdict = compileStoredFormula(
      row({ sourceTokens: '[1,1]([6,27])', bindings: bindings({ items: { '27': 'GHOST' } }) }),
      scope(),
    );
    expect(verdict).toMatchObject({ bucket: 'QUARANTINED', reason: 'UNRESOLVED_ELEMENT' });
  });

  it('quarantines a calculation cycle rather than looping', () => {
    // `[6,900]` is Self, whose own tree references `[6,900]`.
    const self = parseFormulaTree('[1,1]([6,900])').tree!;
    const verdict = compileStoredFormula(
      row({ sourceTokens: '[1,1]([6,900])', bindings: bindings({ items: { '900': 'Self' } }) }),
      scope({ treeByCalcElementId: new Map([[900, self]]) }),
    );
    expect(verdict).toMatchObject({ bucket: 'QUARANTINED', reason: 'CALCULATION_CYCLE' });
  });

  it('reports a reason as a code, never as a formula body', () => {
    // The compile run reads customer formulas at scale. A reason lands in
    // `compile_reason` and in a shared log, so it must carry no content.
    const secret = '[1,1]([6,27])';
    const verdict = compileStoredFormula(row({ sourceTokens: secret }), scope());
    expect(verdict.reason).not.toContain('[6,');
    expect(verdict.reason).toMatch(/^[A-Z_]+$/);
  });
});
