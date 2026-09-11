import { describe, it, expect } from '@jest/globals';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  measureAgreement,
  readFormulaCorpus,
  reportRendering,
  NO_RENDERER,
  TOKEN_RENDERER,
  type BucketPartition,
  type FormulaRenderer,
  reportSqlCompile,
} from '../services/formula-corpus-agreement.js';
import { displayMatches } from '../semantics/render.js';

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
  /** The Phase 4.2 acceptance criterion, as a percentage. */
  phaseGate: number;
  distinctPairs: number;
  totalOccurrences: number;
  /** The same rates over the rows the anonymiser left intact. */
  cleanDistinctRate: number;
  cleanWeightedRate: number;
  cleanDistinctPairs: number;
  cleanTotalOccurrences: number;
  /** The Phase 4.3 acceptance criterion, against the clean subset. */
  cleanPhaseGate: number;
  /** The Phase 4.4 gate: the D-059 partition, ratcheted per bucket. */
  buckets: BucketPartition;
  /** The Phase 4.5 gate: the same partition over the SQL rendering. */
  sqlBuckets: BucketPartition;
  renderer: string;
  measuredAt: string;
  comparison: string;
  ceiling: string;
  gate: string;
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
    const result = measureAgreement(rows, TOKEN_RENDERER, 10, displayMatches);

    expect(result.distinctRate).toBeGreaterThanOrEqual(baseline.distinctRate);
    expect(result.weightedRate).toBeGreaterThanOrEqual(baseline.weightedRate);
    const report = reportRendering(rows, 0);
    expect(report.cleanDistinctRate).toBeGreaterThanOrEqual(baseline.cleanDistinctRate);
    expect(report.cleanWeightedRate).toBeGreaterThanOrEqual(baseline.cleanWeightedRate);
    // An unhandled path is a bug; a stated "I do not do this yet" is not.
    expect(result.distinctThrew).toBe(0);
  });

  it('clears the Phase 4.2 gate on both denominators', () => {
    // The ratchet above only refuses a regression. This is the acceptance
    // criterion itself, so a future baseline edit cannot lower the bar by
    // accident: >= 93% of the aligned corpus renders exactly as Discoverer
    // rendered it, stated separately as weighted and distinct because they
    // are different numbers and a gate must say which it means.
    const result = measureAgreement(rows, TOKEN_RENDERER, 0, displayMatches);
    expect(result.weightedRate).toBeGreaterThanOrEqual(baseline.phaseGate);
    expect(result.distinctRate).toBeGreaterThanOrEqual(baseline.phaseGate);
  });

  it('clears the Phase 4.3 gate on the clean subset, on both denominators', () => {
    // >= 99%, and it has to be stated against the clean subset because the raw
    // denominator cannot reach it: Phase 0.5's anonymiser destroyed 912 rows
    // outright and a destroyed row can never match. That is the decoder spec's
    // own instruction (§11.1) and not a convenience — the alternative it
    // offers, rebuilding the corpus, needs `d4dumps/`, which is not on this
    // machine.
    //
    // The exclusion is only honest while the test below holds. Read them as
    // one gate.
    const report = reportRendering(rows, 0);
    expect(report.cleanWeightedRate).toBeGreaterThanOrEqual(baseline.cleanPhaseGate);
    expect(report.cleanDistinctRate).toBeGreaterThanOrEqual(baseline.cleanPhaseGate);
    expect(report.cleanTotalOccurrences).toBe(baseline.cleanTotalOccurrences);
    expect(report.cleanDistinctPairs).toBe(baseline.cleanDistinctPairs);
  });

  it('renders nothing wrongly that the corpus itself did not destroy', () => {
    // The number that matters, and the one that keeps the clean-subset gate
    // above honest. A quarantine is a gap a later phase closes; an unexplained
    // mismatch means the tree was read wrongly, and a formula the migrator
    // already wrote may be a wrong number in a real report.
    //
    // Zero, exactly. Every remaining mismatch on the whole 37 971-occurrence
    // corpus is a row `isAnonymiserDamage` can account for. If the damage
    // classifier were quietly absorbing renderer defects to flatter the clean
    // denominator, this is where it would show, so it is asserted as an
    // equality rather than a ceiling.
    const report = reportRendering(rows, 0);
    expect(report.weightedMismatchedUnexplained).toBe(0);
    expect(report.distinctMismatchedUnexplained).toBe(0);
  });

  it('has no FAILED formula — every row compiles or refuses with a reason', () => {
    // D-059's fourth bucket. A renderer that throws has hit a path nobody
    // wrote, which is a bug in this code; a renderer that quarantines has met
    // something it can name, which is a gap in the evidence. The two are
    // never added together, and the first must be empty.
    const report = reportRendering(rows, 0);
    expect(report.distinctThrew).toBe(0);
    for (const entry of report.quarantineHistogram) {
      expect(entry.reason).not.toBe('');
    }
  });

  describe('the D-059 four-bucket partition — the gate CI runs', () => {
    const report = reportRendering(rows, 0);

    it('puts every row in exactly one bucket', () => {
      // The property that makes the partition a gate rather than a summary. If
      // a row could fall out of all four, `FAILED = 0` would be satisfiable by
      // losing the failures instead of fixing them.
      const rowSum = Object.values(report.buckets).reduce((n, b) => n + b.rows, 0);
      const occSum = Object.values(report.buckets).reduce((n, b) => n + b.occurrences, 0);
      expect(rowSum).toBe(report.distinctPairs);
      expect(occSum).toBe(report.totalOccurrences);
    });

    it('asserts FAILED = 0', () => {
      // Not a ceiling. A FAILED row is either an unhandled path or a rendering
      // that contradicts an intact reference, and both are our bug.
      expect(report.buckets.FAILED).toEqual({ rows: 0, occurrences: 0 });
    });

    it('agrees with the rates measured independently', () => {
      // COMPILED is the same population `measureAgreement` calls agreed. The
      // two are computed by different loops, so they cross-check each other.
      expect(report.buckets.COMPILED.rows).toBe(report.distinctAgreed);
      expect(report.buckets.COMPILED.occurrences).toBe(report.weightedAgreed);
      // Unverifiable is exactly the anonymiser's damage, by construction.
      expect(report.buckets.COMPILED_UNVERIFIED.rows).toBe(report.distinctMismatchedDamaged);
      // Quarantined is exactly the histogram it reports reasons for.
      expect(report.buckets.QUARANTINED.occurrences).toBe(
        report.quarantineHistogram.reduce((n, e) => n + e.occurrences, 0),
      );
    });

    it('does not regress against the recorded bucket baseline', () => {
      // The ratchet, in the direction each bucket is allowed to move: more
      // COMPILED and fewer of everything else. Raise the baseline by hand in
      // the same commit that improves it, exactly as the rates above.
      expect(report.buckets.COMPILED.occurrences).toBeGreaterThanOrEqual(
        baseline.buckets.COMPILED.occurrences,
      );
      expect(report.buckets.QUARANTINED.occurrences).toBeLessThanOrEqual(
        baseline.buckets.QUARANTINED.occurrences,
      );
      expect(report.buckets.COMPILED_UNVERIFIED.occurrences).toBeLessThanOrEqual(
        baseline.buckets.COMPILED_UNVERIFIED.occurrences,
      );
    });

    it('fails a deliberate regression rather than absorbing it', () => {
      // The gate is only worth running if it bites. Two rows, hand-made:
      //
      //   1+2 against "1+2"    — renders and matches            -> COMPILED
      //   1+2 against "1+2+9"  — renders, every anchor the      -> FAILED
      //                          renderer wrote is present and
      //                          in order, so the anonymiser
      //                          cannot account for the extra
      //                          text; something was read wrongly
      //
      // That second row is exactly what a renderer defect looks like, and it
      // must land in FAILED, not be filed as unverifiable damage.
      const regressed = reportRendering(
        [
          { occurrences: 5, io: '[1,94]([5,2,"1"],[5,2,"2"])', display: '1+2' },
          { occurrences: 7, io: '[1,94]([5,2,"1"],[5,2,"2"])', display: '1+2+9' },
        ],
        0,
      );
      expect(regressed.buckets.COMPILED).toEqual({ rows: 1, occurrences: 5 });
      expect(regressed.buckets.FAILED).toEqual({ rows: 1, occurrences: 7 });
      // And the assertion CI runs would reject it.
      expect(regressed.buckets.FAILED).not.toEqual(baseline.buckets.FAILED);
    });

    it('names a reason for every quarantined row', () => {
      // `QUARANTINED(reason)`, not `QUARANTINED`. A refusal with no stated
      // reason is indistinguishable from a failure nobody looked at.
      const named = report.quarantineHistogram.reduce((n, e) => n + e.rows, 0);
      expect(named).toBe(report.buckets.QUARANTINED.rows);
    });
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

  describe('the SQL partition — Phase 4.5', () => {
    const report = reportSqlCompile(rows);

    it('puts every row in exactly one bucket', () => {
      const rowSum = Object.values(report.buckets).reduce((n, b) => n + b.rows, 0);
      const occSum = Object.values(report.buckets).reduce((n, b) => n + b.occurrences, 0);
      expect(rowSum).toBe(report.distinctPairs);
      expect(occSum).toBe(report.totalOccurrences);
    });

    it('asserts FAILED = 0', () => {
      // The defining assertion of Phase 4.5, on the SQL side. A FAILED row is
      // a renderer path nobody wrote — our bug — and never a data problem.
      expect(report.buckets.FAILED).toEqual({ rows: 0, occurrences: 0 });
    });

    it('never claims COMPILED', () => {
      // There is no reference Oracle result to check an emitted expression
      // against. Phase 9.1's contract tests are what can claim that bucket,
      // and a partition that claimed it here would be claiming a proof it
      // does not have.
      expect(report.buckets.COMPILED).toEqual({ rows: 0, occurrences: 0 });
    });

    it('names a reason for every quarantined row', () => {
      expect(report.buckets.QUARANTINED.occurrences).toBe(
        report.quarantineHistogram.reduce((n, e) => n + e.occurrences, 0),
      );
      for (const entry of report.quarantineHistogram) expect(entry.reason).not.toBe('');
    });

    it('does not regress against the recorded SQL bucket baseline', () => {
      // The ratchet, in the direction each bucket may move. Raise the baseline
      // by hand in the same commit that improves it.
      expect(report.buckets.COMPILED_UNVERIFIED.occurrences).toBeGreaterThanOrEqual(
        baseline.sqlBuckets.COMPILED_UNVERIFIED.occurrences,
      );
      expect(report.buckets.QUARANTINED.occurrences).toBeLessThanOrEqual(
        baseline.sqlBuckets.QUARANTINED.occurrences,
      );
    });
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
