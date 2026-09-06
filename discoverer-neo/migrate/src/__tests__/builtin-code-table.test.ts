import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readFormulaCorpus } from '../services/formula-corpus-agreement.js';
import { parseFormulaTree, EUL_FUNCTION_NAMES, type FormulaNode } from '../services/workbook-parser.js';

/**
 * The `[1,n]` built-in code table (Phase 4.1) — the artefact Phases 4.2 and
 * 4.3 implement the renderer directly from.
 *
 * These are the three claims the table has to keep true, and they are the
 * three that matter: the corpus parses completely, every code the estate uses
 * is accounted for, and no code is left in a state where a renderer could
 * quietly do something with it. Everything else about the table is evidence
 * to be read, not a contract to be pinned.
 */

const CORPUS_PATH = resolve(process.cwd(), 'corpus', 'formula-corpus.tsv');
const TABLE_PATH = resolve(process.cwd(), 'corpus', 'builtin-code-table.json');

type FitState = 'FITTED' | 'AMBIGUOUS' | 'CONTRADICTED' | 'UNTESTED' | 'UNATTESTED';

interface CodeFit {
  code: number;
  name: string;
  state: FitState;
  shape: string | null;
  arities: number[];
  occurrences: number;
}

interface Table {
  corpus: { rows: number; occurrences: number; parseFailures: number; unknownNodes: number };
  dateLiteral: { shape: string; total: number; nonMidnight: number };
  codes: CodeFit[];
}

const table = JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as Table;

function walk(node: FormulaNode, visit: (n: FormulaNode) => void): void {
  visit(node);
  if (node.type === 'call' || node.type === 'function' || node.type === 'unknown') {
    for (const arg of node.args) walk(arg, visit);
  }
}

describe('the formula corpus round-trips through the parser', () => {
  const rows = readFormulaCorpus(CORPUS_PATH);

  it('reads every row the table was fitted from', () => {
    expect(rows.length).toBe(table.corpus.rows);
    expect(rows.reduce((n, r) => n + r.occurrences, 0)).toBe(table.corpus.occurrences);
  });

  it('parses every stored formula into a tree with no unknown node', () => {
    const failures: string[] = [];
    const unknowns: string[] = [];
    for (const row of rows) {
      const parsed = parseFormulaTree(row.io);
      if (parsed.tree === null) {
        failures.push(row.io.slice(0, 80));
        continue;
      }
      walk(parsed.tree, (node) => {
        if (node.type === 'unknown') unknowns.push(row.io.slice(0, 80));
      });
    }
    // Bounded output: the corpus is 5 MB and a failure list must not be.
    expect({ failures: failures.length, sample: failures.slice(0, 3) }).toEqual({
      failures: 0,
      sample: [],
    });
    expect({ unknowns: unknowns.length, sample: unknowns.slice(0, 3) }).toEqual({
      unknowns: 0,
      sample: [],
    });
  });
});

describe('the [1,n] built-in code table', () => {
  it('covers the 56 codes the estate uses, and names them from Oracle', () => {
    expect(table.codes).toHaveLength(56);
    for (const fit of table.codes) {
      expect(EUL_FUNCTION_NAMES[fit.code]).toBe(fit.name);
    }
  });

  it('records [1,64] GREATEST as unattested rather than inventing its fixity', () => {
    // It appears in the dumps only in an `IOFormula` with no `DisplayFormula`,
    // so the aligned corpus attests 55 codes, not 56 — see
    // docs/migration/formula-corpus.md.
    const greatest = table.codes.find((c) => c.code === 64);
    expect(greatest).toMatchObject({ name: 'GREATEST', state: 'UNATTESTED', shape: null });
  });

  it('gives every code either a fitted shape or an explicit refuse-only state', () => {
    // D-058: refuse rather than distort. A code with no shape must say so in
    // a state the renderer can branch on, never by carrying a null shape in a
    // state that reads like success.
    for (const fit of table.codes) {
      if (fit.state === 'FITTED') expect(typeof fit.shape).toBe('string');
      else expect(fit.shape).toBeNull();
    }
    const states = new Set(table.codes.map((c) => c.state));
    for (const state of states) {
      expect(['FITTED', 'AMBIGUOUS', 'CONTRADICTED', 'UNTESTED', 'UNATTESTED']).toContain(state);
    }
  });

  it('holds the fitted share of the estate at or above what 4.1 achieved', () => {
    // A ratchet, like the corpus agreement gate: a change may raise this and
    // may not lower it. 42 codes carrying 99.78 % of built-in uses.
    const total = table.codes.reduce((n, c) => n + c.occurrences, 0);
    const fitted = table.codes
      .filter((c) => c.state === 'FITTED')
      .reduce((n, c) => n + c.occurrences, 0);
    expect(table.codes.filter((c) => c.state === 'FITTED').length).toBeGreaterThanOrEqual(42);
    expect((fitted / total) * 100).toBeGreaterThanOrEqual(99.78);
  });

  it('settles the [5,4] date literal, and finds no time component to lose', () => {
    expect(table.dateLiteral.shape).toBe('yy.mm.dd');
    expect(table.dateLiteral.nonMidnight).toBe(0);
    expect(table.dateLiteral.total).toBeGreaterThan(0);
  });
});
