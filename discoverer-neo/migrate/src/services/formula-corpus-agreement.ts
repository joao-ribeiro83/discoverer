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

import {
  createBindCollector,
  DISPLAY_NAME_MARK,
  displayMatches,
  Quarantined,
  renderDisplay,
  renderSql,
  type SqlRenderContext,
} from '../semantics/render.js';
import type { FormulaBucket } from './formula-compile.js';
import { parseFormulaTree } from './workbook-parser.js';

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
 * Every anchor the renderer wrote, in the order it wrote them.
 *
 * An anchor is text the renderer produced itself rather than took from the
 * corpus: a quoted literal, a bare number, or a word-shaped built-in name
 * (`AND`, `BETWEEN`, `TO_DATE`). Anything inside a `DISPLAY_NAME_MARK` span is an
 * identifier the corpus anonymised and is deliberately skipped, and symbol
 * operators are skipped too — the anonymiser preserved punctuation, so a
 * surviving `=` proves nothing either way.
 *
 * Read off the rendered template rather than re-walked from the tree, so the
 * order is the renderer's own and cannot drift from it.
 */
const ANCHOR = /'[^']*'|[A-Za-z][A-Za-z0-9_]*|[0-9][0-9.]*/g;

function displayAnchors(template: string): string[] {
  const anchors: string[] = [];
  const spans = template.split(DISPLAY_NAME_MARK);
  // Splitting on a paired marker yields literal, name, literal, name, …
  for (let i = 0; i < spans.length; i += 2) {
    anchors.push(...(spans[i]!.match(ANCHOR) ?? []));
  }
  return anchors;
}

/**
 * Did Phase 0.5's anonymiser destroy this row?
 *
 * A Discoverer private filter's `Name` is frequently its own `DisplayFormula`
 * verbatim, so the identifier map registered whole display strings as single
 * identifiers and replaced them wholesale — byte-class- and
 * length-preserving. Oracle's own keywords went with them while the
 * punctuation survived: `[1,98]` rendered `AND` and the display says `ZCK`.
 *
 * The test is that every anchor the renderer wrote can still be found in
 * Discoverer's own string, **in the same order**. Order and multiplicity are
 * both load bearing, and a plain `includes` test has neither: a row rendering
 * `… = 100 AND … = 1 AND …` against a display whose second literal was
 * rewritten to `5` still "contains" `1`, because `100` does; and a row
 * rendering six `AND`s against a display carrying four still "contains" `AND`.
 * Both are damage, both passed the old test, and both are common — `[1,98]`
 * is the code the clobbering hits hardest.
 *
 * This is why the achievable ceiling on the committed corpus is about 96 %,
 * and it is the one-line fix in the decoder spec §11.1 that would lift it.
 *
 * The limit of the method, stated plainly: it cannot separate "the anonymiser
 * removed an anchor" from "the renderer put the anchors in the wrong order".
 * A genuine fixity defect would be misfiled here. That is why the
 * `UNEXPLAINED` sample list exists and is read by hand at every gate, and why
 * a code is only ever implemented from an attested shape.
 */
export function isAnonymiserDamage(rendered: string, display: string): boolean {
  let from = 0;
  for (const anchor of displayAnchors(rendered)) {
    const at = display.indexOf(anchor, from);
    if (at === -1) return true;
    from = at + anchor.length;
  }
  return false;
}

/**
 * The D-059 bucket vocabulary, applied to the committed corpus.
 *
 * The gate is a partition with reasons, not a percentage. A bare compile rate
 * is this project's signature failure mode — three separate mechanisms have
 * reported success over a system that did not work — so every corpus row lands
 * in exactly one of four buckets and the counts must sum to the whole.
 *
 * Read against what the corpus actually is:
 *
 * - `COMPILED` — rendered, and it reproduces the string Discoverer showed.
 *   This corpus *has* a reference rendering for every row, which is why the
 *   bucket is reachable here at all; the verifier's own partition over the
 *   49 819 stored formulas has no reference and so tops out at
 *   `COMPILED_UNVERIFIED` until the Phase 9.1 Oracle contract tests exist.
 * - `COMPILED_UNVERIFIED` — rendered, but Phase 0.5's anonymiser destroyed the
 *   reference (`isAnonymiserDamage`), so there is nothing left to check it
 *   against. Not a pass and not a defect: an unverifiable row.
 * - `QUARANTINED` — refused, with one of the enumerated reasons.
 * - `FAILED` — **must be zero.** Two ways in, and both are our bug rather than
 *   the data's: an exception that is not a stated refusal, and a rendering
 *   that contradicts a reference the anonymiser left intact. The second is the
 *   dangerous one — it means a tree was read wrongly, and something already
 *   migrated may be a wrong number.
 *
 * Calculation-reference expansion (D-056) does not appear here: a corpus row
 * is one formula with no worksheet around it, so there is no calculation set
 * for a `[6,n]` to resolve into. Expansion is measured by the differ, against
 * dumps, where the reference set exists.
 */
/**
 * The D-059 vocabulary itself lives in `formula-compile.ts`, beside the
 * classifier that assigns it. One declaration, for BE-09's reason: three
 * copies of the same union is three things that can drift apart.
 */
export type { FormulaBucket };

export interface BucketCounts {
  rows: number;
  occurrences: number;
}

export type BucketPartition = Record<FormulaBucket, BucketCounts>;

export interface RenderReport extends AgreementResult {
  /**
   * Every row in exactly one bucket. `rows` sums to `distinctPairs` and
   * `occurrences` to `totalOccurrences`; `formula-corpus-agreement.test.ts`
   * asserts both, so a bucket cannot be quietly dropped from the partition.
   */
  buckets: BucketPartition;
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
  /**
   * The same two rates over the rows the anonymiser left intact.
   *
   * This is the denominator Phase 4.3's `>= 99 %` gate is stated against, and
   * it is the decoder spec's own instruction rather than a convenience: a
   * clobbered row can never match whatever the renderer does, so the committed
   * corpus has a hard ceiling of about 96 % raw (§11.1). The spec says "state
   * the gates against the clean subset, or rebuild the corpus", and rebuilding
   * needs `d4dumps/`, which is not on this machine.
   *
   * Reported *beside* the raw rates, never instead of them. Excluding rows
   * from a denominator is exactly how a measurement flatters itself, so the
   * exclusion is one function — `isAnonymiserDamage` — with its limits written
   * down, and `weightedMismatchedUnexplained` stays the check on it: if the
   * classifier were quietly absorbing real defects, that number would not be
   * zero.
   */
  cleanWeightedRate: number;
  cleanDistinctRate: number;
  cleanTotalOccurrences: number;
  cleanDistinctPairs: number;
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

  const buckets: BucketPartition = {
    COMPILED: { rows: 0, occurrences: 0 },
    COMPILED_UNVERIFIED: { rows: 0, occurrences: 0 },
    QUARANTINED: { rows: 0, occurrences: 0 },
    FAILED: { rows: 0, occurrences: 0 },
  };
  const put = (bucket: FormulaBucket, occurrences: number): void => {
    buckets[bucket].rows += 1;
    buckets[bucket].occurrences += occurrences;
  };

  for (const row of rows) {
    const { tree } = parseFormulaTree(row.io);
    let reason: string | null = null;
    if (tree === null) {
      reason = 'PARSE_FAILED';
    } else {
      try {
        const rendered = renderDisplay(tree);
        if (displayMatches(rendered, row.display)) {
          put('COMPILED', row.occurrences);
        } else {
          distinctMismatched += 1;
          weightedMismatched += row.occurrences;
          if (isAnonymiserDamage(rendered, row.display)) {
            distinctMismatchedDamaged += 1;
            weightedMismatchedDamaged += row.occurrences;
            // Rendered, but the reference it would be checked against is gone.
            put('COMPILED_UNVERIFIED', row.occurrences);
          } else {
            // Rendered, and it contradicts an intact reference. That is a bug.
            put('FAILED', row.occurrences);
            unexplained.push({
              ioFormula: row.io,
              expected: row.display,
              actual: rendered,
              occurrences: row.occurrences,
            });
          }
        }
      } catch (err) {
        if (err instanceof Quarantined) {
          reason = err.reason;
        } else {
          // An unhandled path. Bucketed rather than rethrown, so the report
          // stays a partition and CI fails on the assertion that says why,
          // instead of on a stack trace that says where.
          put('FAILED', row.occurrences);
        }
      }
    }
    if (reason !== null) {
      put('QUARANTINED', row.occurrences);
      const seen = byReason.get(reason) ?? { rows: 0, occurrences: 0 };
      seen.rows += 1;
      seen.occurrences += row.occurrences;
      byReason.set(reason, seen);
    }
  }

  const cleanTotalOccurrences = agreement.totalOccurrences - weightedMismatchedDamaged;
  const cleanDistinctPairs = agreement.distinctPairs - distinctMismatchedDamaged;
  const rate = (part: number, whole: number): number =>
    whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 100;

  return {
    ...agreement,
    buckets,
    cleanTotalOccurrences,
    cleanDistinctPairs,
    cleanWeightedRate: rate(agreement.weightedAgreed, cleanTotalOccurrences),
    cleanDistinctRate: rate(agreement.distinctAgreed, cleanDistinctPairs),
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

// ---------------------------------------------------------------------------
// The SQL partition — Phase 4.5's projection
// ---------------------------------------------------------------------------

export interface SqlCompileReport {
  distinctPairs: number;
  totalOccurrences: number;
  buckets: BucketPartition;
  /** Every refusal reason, weighted, largest first. The improvement backlog. */
  quarantineHistogram: { reason: string; rows: number; occurrences: number }[];
}

/**
 * Render every corpus row to **SQL** and partition the result (D-059).
 *
 * `reportRendering` above measures the *display* form against what Discoverer
 * printed — fidelity. This measures the *SQL* form, which has no reference to
 * check against and so can never reach `COMPILED`; what it answers is whether
 * the renderer has a reading of the tree at all.
 *
 * **Why it exists beside `dn-migrate verify --compile`.** The verifier is the
 * real compile run, and it reports whatever the estate happens to carry — on
 * an estate migrated before dual storage, that is `NO_SOURCE_TOKENS` for every
 * row and says nothing about the renderer. This runs the same renderer over
 * the same estate's committed token strings, so the projection is reproducible
 * in CI with no database and no Oracle.
 *
 * Every element resolves, deliberately. That isolates renderer coverage from
 * the per-map item lookup: a row that quarantines here is a formula language
 * gap, while `UNRESOLVED_ELEMENT` on the live run is a metadata question.
 */
export function reportSqlCompile(rows: readonly CorpusRow[]): SqlCompileReport {
  const buckets: BucketPartition = {
    COMPILED: { rows: 0, occurrences: 0 },
    COMPILED_UNVERIFIED: { rows: 0, occurrences: 0 },
    QUARANTINED: { rows: 0, occurrences: 0 },
    FAILED: { rows: 0, occurrences: 0 },
  };
  const byReason = new Map<string, { rows: number; occurrences: number }>();
  let totalOccurrences = 0;

  const put = (bucket: FormulaBucket, occurrences: number): void => {
    buckets[bucket].rows += 1;
    buckets[bucket].occurrences += occurrences;
  };
  const tally = (reason: string, occurrences: number): void => {
    const seen = byReason.get(reason) ?? { rows: 0, occurrences: 0 };
    seen.rows += 1;
    seen.occurrences += occurrences;
    byReason.set(reason, seen);
  };

  for (const row of rows) {
    totalOccurrences += row.occurrences;
    const { tree } = parseFormulaTree(row.io);
    if (tree === null) {
      put('QUARANTINED', row.occurrences);
      tally('PARSE_FAILED', row.occurrences);
      continue;
    }
    try {
      const result = renderSql(tree, permissiveContext());
      if (result.ok) {
        // Never COMPILED: no Oracle has run this. Phase 9.1 owns that bucket.
        put('COMPILED_UNVERIFIED', row.occurrences);
      } else {
        put('QUARANTINED', row.occurrences);
        tally(result.reason, row.occurrences);
      }
    } catch (err) {
      // The renderer threw rather than refusing. That is our bug, and FAILED
      // is the only bucket CI gates on.
      put('FAILED', row.occurrences);
      tally(`THREW_${err instanceof Error ? err.name : 'UNKNOWN'}`, row.occurrences);
    }
  }

  return {
    distinctPairs: rows.length,
    totalOccurrences,
    buckets,
    quarantineHistogram: [...byReason.entries()]
      .map(([reason, counts]) => ({ reason, ...counts }))
      .sort((a, b) => b.occurrences - a.occurrences),
  };
}

/**
 * A context in which every element resolves. See `reportSqlCompile` — the
 * point is to measure the renderer, not the estate's metadata.
 */
function permissiveContext(): SqlRenderContext {
  const binder = createBindCollector();
  return {
    resolveItem: (id) => ({ name: `ITEM_${id}`, column: `COL_${id}` }),
    resolveParameter: (id) => `P_${id}`,
    resolveFunction: (id) => ({ name: `FN_${id}`, arity: null }),
    bind: binder.bind,
  };
}
