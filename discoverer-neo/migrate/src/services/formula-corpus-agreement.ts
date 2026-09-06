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

import { builtinCode } from '../semantics/builtin-codes.js';
import { displayDateLiteral, displayMatches, Quarantined, renderDisplay } from '../semantics/render.js';
import { parseFormulaTree, type FormulaNode } from './workbook-parser.js';

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

export interface CorpusRow {
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

/**
 * Does a rendering reproduce what Discoverer showed?
 *
 * Defaults to string equality. The token renderer passes `displayMatches`
 * instead, because the committed corpus is anonymised (D-114) and carries no
 * workbook element table: a `[6,18]` leaf has no name to render, so the
 * renderer marks the span and the comparator unifies it with a back-reference.
 * Everything outside a marked span is still compared byte for byte, and a name
 * used twice in one formula must unify to the same text — so this is weaker
 * than `===` only where the corpus itself destroyed the evidence.
 */
export type DisplayComparator = (actual: string, expected: string) => boolean;

const EXACT: DisplayComparator = (actual, expected) => actual === expected;

export function measureAgreement(
  rows: readonly CorpusRow[],
  render: FormulaRenderer,
  sampleLimit = 10,
  agrees: DisplayComparator = EXACT,
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
    if (agrees(actual, row.display)) {
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
 * parsed into a tree (`parseFormulaTree`) but never rendered back into
 * Discoverer's display form, which is why 49 027 of 49 819 stored formulas sit
 * in the verifier's QUARANTINED bucket. Phase 4 replaces this.
 *
 * It is a named export rather than an inline stub so the swap is one edit and
 * the baseline it produces is attributable.
 */
export const NO_RENDERER: FormulaRenderer = () => null;

/**
 * The Phase 4.2 renderer, wired to the harness.
 *
 * Returns null for anything it refuses — a stated gap is a miss, not a crash —
 * so `distinctThrew` stays the signal it was meant to be: an unhandled path,
 * which is a bug.
 *
 * Pair it with `displayMatches`, not `===`. See `DisplayComparator`.
 */
export const TOKEN_RENDERER: FormulaRenderer = (io) => {
  const { tree } = parseFormulaTree(io);
  if (tree === null) return null;
  try {
    return renderDisplay(tree);
  } catch (err) {
    if (err instanceof Quarantined) return null;
    throw err;
  }
};

/**
 * A word-shaped built-in name — `AND`, `BETWEEN`, `TO_DATE`. Symbol operators
 * are excluded because the anonymiser preserved punctuation, so their absence
 * proves nothing.
 */
const WORD_NAME = /^[A-Za-z][A-Za-z0-9_]*(?: [A-Za-z][A-Za-z0-9_]*)*$/;

/**
 * Did Phase 0.5's anonymiser destroy this row?
 *
 * A Discoverer private filter's `Name` is frequently its own `DisplayFormula`
 * verbatim, so the identifier map registered whole display strings as single
 * identifiers and replaced them wholesale — byte-class- and
 * length-preserving. Oracle's own keywords went with them while the
 * punctuation survived: `[1,98]` rendered `AND` and the display says `ZCK`.
 *
 * Detected exactly as `fit-builtin-codes.ts` detects it, by the same two
 * signals: a literal that has gone missing from the display, or a word-shaped
 * built-in name that has. This is why the achievable ceiling on the committed
 * corpus is about 96 %, and it is the one-line fix in the decoder spec §11.1
 * that would lift it.
 */
export function isAnonymiserDamage(node: FormulaNode, display: string): boolean {
  if (node.type === 'literal') {
    if (node.literalKind === 4) {
      // The date payload is reshaped on the way to the screen, so only the
      // rendered form is evidence.
      let rendered: string;
      try {
        rendered = displayDateLiteral(node.value);
      } catch {
        return false;
      }
      if (!display.includes(rendered)) return true;
    } else if (!display.includes(node.value)) {
      return true;
    }
  }
  if (node.type === 'call') {
    const entry = builtinCode(node.code);
    if (entry !== undefined && WORD_NAME.test(entry.displayName) && !display.includes(entry.displayName)) {
      return true;
    }
  }
  const args = node.type === 'call' || node.type === 'function' || node.type === 'unknown' ? node.args : [];
  return args.some((arg) => isAnonymiserDamage(arg, display));
}

export interface RenderReport extends AgreementResult {
  /** Weighted occurrences behind each refusal reason, largest first. */
  quarantineHistogram: { reason: string; rows: number; occurrences: number }[];
  /** Rendered, but not the string Discoverer showed. */
  distinctMismatched: number;
  weightedMismatched: number;
  /**
   * Mismatches the anonymiser explains. These can never match and are not
   * renderer defects — see `isAnonymiserDamage`.
   */
  distinctMismatchedDamaged: number;
  weightedMismatchedDamaged: number;
  /**
   * Mismatches nothing explains. **This is the number that matters.** A row
   * here means the tree was read wrongly and something already migrated may be
   * a wrong number; it is not a coverage gap that a later phase closes.
   */
  distinctMismatchedUnexplained: number;
  weightedMismatchedUnexplained: number;
  /** Bounded sample of the unexplained ones, highest-occurrence first. */
  unexplainedSamples: AgreementSample[];
}

/**
 * The full Phase 4.2 report: exact / mismatch / quarantined, with the reason
 * histogram the next stage works from.
 *
 * A mismatch and a refusal are different failures and are never added
 * together. A refusal is a gap someone can close; a mismatch means the tree
 * was read wrongly and something already migrated may be a wrong number.
 */
export function reportRendering(rows: readonly CorpusRow[], sampleLimit = 10): RenderReport {
  const agreement = measureAgreement(rows, TOKEN_RENDERER, sampleLimit, displayMatches);
  const byReason = new Map<string, { rows: number; occurrences: number }>();
  let distinctMismatched = 0;
  let weightedMismatched = 0;
  let distinctMismatchedDamaged = 0;
  let weightedMismatchedDamaged = 0;
  const unexplained: AgreementSample[] = [];

  for (const row of rows) {
    const { tree } = parseFormulaTree(row.io);
    let reason: string | null = null;
    if (tree === null) {
      reason = 'PARSE_FAILED';
    } else {
      try {
        const rendered = renderDisplay(tree);
        if (!displayMatches(rendered, row.display)) {
          distinctMismatched += 1;
          weightedMismatched += row.occurrences;
          if (isAnonymiserDamage(tree, row.display)) {
            distinctMismatchedDamaged += 1;
            weightedMismatchedDamaged += row.occurrences;
          } else {
            unexplained.push({
              ioFormula: row.io,
              expected: row.display,
              actual: rendered,
              occurrences: row.occurrences,
            });
          }
        }
      } catch (err) {
        if (!(err instanceof Quarantined)) throw err;
        reason = err.reason;
      }
    }
    if (reason !== null) {
      const seen = byReason.get(reason) ?? { rows: 0, occurrences: 0 };
      seen.rows += 1;
      seen.occurrences += row.occurrences;
      byReason.set(reason, seen);
    }
  }

  return {
    ...agreement,
    distinctMismatched,
    weightedMismatched,
    distinctMismatchedDamaged,
    weightedMismatchedDamaged,
    distinctMismatchedUnexplained: distinctMismatched - distinctMismatchedDamaged,
    weightedMismatchedUnexplained: weightedMismatched - weightedMismatchedDamaged,
    unexplainedSamples: unexplained
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, sampleLimit),
    quarantineHistogram: [...byReason.entries()]
      .map(([reason, counts]) => ({ reason, ...counts }))
      .sort((a, b) => b.occurrences - a.occurrences),
  };
}
