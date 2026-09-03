import { describe, it, expect } from '@jest/globals';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  measureAgreement,
  readFormulaCorpus,
  NO_RENDERER,
  type FormulaRenderer,
} from '../services/formula-corpus-agreement.js';

/**
 * The corpus agreement gate (item 7 of Phase 1.3).
 *
 * The differ harness this repository already had was exceptional and ran
 * against nothing committed: the real dumps are customer report metadata and
 * are never checked in. Phase 0.5 fixed that by building an anonymised corpus
 * of 37 971 aligned (stored, displayed) formula pairs. This runs the renderer
 * over it on every CI build and refuses a drop.
 *
 * The gate is a RATCHET, not a target. `agreement-baseline.json` records what
 * the renderer achieves today; the test fails if a change makes it worse, and
 * the baseline is raised by hand when a change makes it better. That is the
 * whole mechanism — it is what turns "the parser probably still works" into a
 * number the build can defend.
 */

const CORPUS_PATH = resolve(process.cwd(), 'corpus', 'formula-corpus.tsv');
const BASELINE_PATH = resolve(process.cwd(), 'corpus', 'agreement-baseline.json');

interface Baseline {
  distinctRate: number;
  weightedRate: number;
  distinctPairs: number;
  totalOccurrences: number;
  renderer: string;
  measuredAt: string;
  note: string;
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;

describe('formula corpus agreement gate', () => {
  const rows = readFormulaCorpus(CORPUS_PATH);

  it('reads the corpus the meta file describes', () => {
    // A corpus that failed to parse would score 0% agreement and pass every
    // ratchet below it — so the denominator is checked before the rate.
    expect(rows.length).toBe(baseline.distinctPairs);
    expect(rows.reduce((n, r) => n + r.occurrences, 0)).toBe(baseline.totalOccurrences);
  });

  it('does not fall below the recorded agreement baseline', () => {
    const result = measureAgreement(rows, NO_RENDERER);

    expect(result.distinctRate).toBeGreaterThanOrEqual(baseline.distinctRate);
    expect(result.weightedRate).toBeGreaterThanOrEqual(baseline.weightedRate);
    // An unhandled path is a bug; a stated "I do not do this yet" is not.
    expect(result.distinctThrew).toBe(0);
  });

  it('measures both rates, because they answer different questions', () => {
    // A renderer handling only the single most common shape scores badly on
    // coverage and well on what an operator feels. Reporting one number would
    // hide whichever fact was inconvenient.
    const commonest = rows.reduce((a, b) => (b.occurrences > a.occurrences ? b : a));
    const oneShape: FormulaRenderer = (io) => (io === commonest.io ? commonest.display : null);

    const result = measureAgreement(rows, oneShape);
    expect(result.distinctAgreed).toBe(1);
    expect(result.weightedAgreed).toBe(commonest.occurrences);
    expect(result.weightedRate).toBeGreaterThan(result.distinctRate);
  });

  it('counts a throwing renderer separately from one that declines', () => {
    const throws = measureAgreement(rows.slice(0, 50), () => {
      throw new Error('unhandled token');
    });
    expect(throws.distinctThrew).toBe(50);
    expect(throws.distinctUnrendered).toBe(0);

    const declines = measureAgreement(rows.slice(0, 50), NO_RENDERER);
    expect(declines.distinctThrew).toBe(0);
    expect(declines.distinctUnrendered).toBe(50);
  });

  it('skips malformed lines rather than scoring them as disagreements', () => {
    // A truncated or re-encoded corpus must not read as "the renderer got
    // worse" — that is a ratchet failing for the wrong reason, which is how a
    // gate stops being believed.
    const path = resolve(tmpdir(), 'corpus-malformed.tsv');
    const TAB = '\t';
    writeFileSync(
      path,
      [
        `occurrences${TAB}io_formula${TAB}display_formula`,
        `3${TAB}[1,1]${TAB}A`,
        'no-tabs-here',
        '',
        `x${TAB}[1,2]${TAB}B`,
      ].join('\n'),
      'latin1',
    );
    try {
      const parsed = readFormulaCorpus(path);
      expect(parsed).toHaveLength(2);
      // A non-numeric count is 0, not NaN — NaN would poison every total.
      expect(parsed.map((r) => r.occurrences)).toEqual([3, 0]);
    } finally {
      rmSync(path, { force: true });
    }
  });

  it('reports 0%, not NaN, over an empty corpus', () => {
    const empty = measureAgreement([], NO_RENDERER);
    expect(empty.distinctRate).toBe(0);
    expect(empty.weightedRate).toBe(0);
  });

  it('bounds its sample, whatever the size of the corpus', () => {
    // The corpus is 5 MB. A harness that returned every disagreement would be
    // unusable in a log and unreadable in a report.
    const result = measureAgreement(rows, NO_RENDERER, 5);
    expect(result.samples).toHaveLength(5);
    // Highest-occurrence first: fix what people actually hit.
    const counts = result.samples.map((s) => s.occurrences);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});
