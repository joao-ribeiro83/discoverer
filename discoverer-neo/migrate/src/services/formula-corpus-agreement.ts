/**
 * Agreement harness for the committed formula corpus (D-114), and the CI gate
 * that stops the token renderer regressing.
 *
 * `corpus/formula-corpus.tsv` holds 37 971 aligned pairs from 547 real
 * workbooks, stored as 22 748 distinct rows carrying an `occurrences` count:
 * the left column is what Discoverer STORED (`[1,95]([1,58](…),[5,2,"200"])`)
 * and the right is what Discoverer SHOWED (`TO_DATE('01.12.01')-200`). A
 * renderer's job is to turn the first into the second, and this measures how
 * often it does.
 *
 * Two rates, because they answer different questions. The DISTINCT rate is how
 * much of the formula language is covered; the WEIGHTED rate is how many real
 * formulas in a real estate would render, which is what an operator feels.
 * A renderer that handles one very common shape scores well on one and badly
 * on the other, and both facts matter.
 *
 * Output discipline: the corpus is 5 MB. Nothing here returns formula text
 * beyond a bounded sample, and callers get counts.
 */

import { readFileSync } from 'node:fs';

/**
 * Render a stored formula into its display form, or return null for "I do not
 * handle this yet". Null is a miss, not a crash — a renderer that throws is
 * counted separately, because an unhandled path is a bug and a stated gap
 * is not.
 */
export type FormulaRenderer = (ioFormula: string) => string | null;

export interface AgreementSample {
  ioFormula: string;
  expected: string;
  actual: string | null;
  occurrences: number;
}

export interface AgreementResult {
  /** Distinct (io, display) pairs read from the corpus. */
  distinctPairs: number;
  /** Sum of `occurrences` — real formula instances behind those pairs. */
  totalOccurrences: number;
  distinctAgreed: number;
  weightedAgreed: number;
  /** Renderer returned null: a stated gap. */
  distinctUnrendered: number;
  /** Renderer threw: an unhandled path, which is a bug. */
  distinctThrew: number;
  /** 0–100, two decimals. */
  distinctRate: number;
  weightedRate: number;
  /** Bounded, highest-occurrence disagreements first. */
  samples: AgreementSample[];
}

interface CorpusRow {
  occurrences: number;
  io: string;
  display: string;
}

/**
 * The corpus is latin1 (cp1252), single-byte, exactly as the dumps are, and
 * its sha256 is pinned. Decoding it as UTF-8 would silently mangle every
 * accented identifier in a Portuguese estate.
 */
export function readFormulaCorpus(path: string): CorpusRow[] {
  const text = readFileSync(path, 'latin1');
  const lines = text.split('\n');
  const rows: CorpusRow[] = [];
  // Line 0 is the header.
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined || line === '') continue;
    const [occurrences, io, display] = line.split('\t');
    if (io === undefined || display === undefined) continue;
    rows.push({ occurrences: Number(occurrences) || 0, io, display });
  }
  return rows;
}

export function measureAgreement(
  rows: readonly CorpusRow[],
  render: FormulaRenderer,
  sampleLimit = 10,
): AgreementResult {
  let distinctAgreed = 0;
  let weightedAgreed = 0;
  let totalOccurrences = 0;
  let distinctUnrendered = 0;
  let distinctThrew = 0;
  const misses: AgreementSample[] = [];

  for (const row of rows) {
    totalOccurrences += row.occurrences;
    let actual: string | null;
    try {
      actual = render(row.io);
    } catch {
      distinctThrew += 1;
      misses.push({ ioFormula: row.io, expected: row.display, actual: null, occurrences: row.occurrences });
      continue;
    }
    if (actual === null) {
      distinctUnrendered += 1;
      misses.push({ ioFormula: row.io, expected: row.display, actual: null, occurrences: row.occurrences });
      continue;
    }
    if (actual === row.display) {
      distinctAgreed += 1;
      weightedAgreed += row.occurrences;
    } else {
      misses.push({ ioFormula: row.io, expected: row.display, actual, occurrences: row.occurrences });
    }
  }

  const rate = (part: number, whole: number): number =>
    whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 100;

  return {
    distinctPairs: rows.length,
    totalOccurrences,
    distinctAgreed,
    weightedAgreed,
    distinctUnrendered,
    distinctThrew,
    distinctRate: rate(distinctAgreed, rows.length),
    weightedRate: rate(weightedAgreed, totalOccurrences),
    samples: misses
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, sampleLimit),
  };
}

/**
 * The renderer as it stands today: there is not one. `[class,id]` tokens are
 * parsed into a tree (`parseConditionTokens`) but never rendered back into
 * Discoverer's display form, which is why 49 027 of 49 819 stored formulas sit
 * in the verifier's QUARANTINED bucket. Phase 4 replaces this.
 *
 * It is a named export rather than an inline stub so the swap is one edit and
 * the baseline it produces is attributable.
 */
export const NO_RENDERER: FormulaRenderer = () => null;
