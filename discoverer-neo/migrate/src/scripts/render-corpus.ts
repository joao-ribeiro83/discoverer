/**
 * Run the Phase 4.2 renderer over the whole aligned corpus and report.
 *
 * ```bash
 * cd discoverer-neo && npm run render-corpus -w @discoverer-neo/core
 * ```
 *
 * Prints exact / mismatch / quarantined against both denominators, because a
 * single percentage hides whichever fact is inconvenient:
 *
 * - **weighted** (of 37 971 occurrences) — how many real formulas in a real
 *   estate would render. This is the gate.
 * - **distinct** (of 22 748 rows) — how much of the formula language is
 *   covered.
 *
 * Output is bounded: the corpus is 5 MB and none of it reaches stdout beyond
 * ten sampled disagreements.
 */

import { resolve } from 'node:path';

import { readFormulaCorpus, reportRendering } from '../services/formula-corpus-agreement.js';

const CORPUS_PATH = resolve(process.cwd(), 'corpus', 'formula-corpus.tsv');

function main(): void {
  const rows = readFormulaCorpus(CORPUS_PATH);
  const report = reportRendering(rows, 10);
  const pc = (part: number, whole: number): string =>
    `${((part / whole) * 100).toFixed(2)}%`;

  const { distinctPairs: d, totalOccurrences: w } = report;
  console.log(`corpus            ${d} distinct rows, ${w} occurrences\n`);
  console.log('                       weighted            distinct');
  console.log(
    `exact              ${String(report.weightedAgreed).padStart(8)} ${pc(report.weightedAgreed, w).padStart(8)}` +
      `   ${String(report.distinctAgreed).padStart(7)} ${pc(report.distinctAgreed, d).padStart(8)}`,
  );
  console.log(
    `mismatch           ${String(report.weightedMismatched).padStart(8)} ${pc(report.weightedMismatched, w).padStart(8)}` +
      `   ${String(report.distinctMismatched).padStart(7)} ${pc(report.distinctMismatched, d).padStart(8)}`,
  );
  const qRows = report.distinctUnrendered;
  const qOcc = report.quarantineHistogram.reduce((n, e) => n + e.occurrences, 0);
  console.log(
    `quarantined        ${String(qOcc).padStart(8)} ${pc(qOcc, w).padStart(8)}` +
      `   ${String(qRows).padStart(7)} ${pc(qRows, d).padStart(8)}`,
  );
  console.log(
    `  of which damaged ${String(report.weightedMismatchedDamaged).padStart(8)} ${pc(report.weightedMismatchedDamaged, w).padStart(8)}` +
      `   ${String(report.distinctMismatchedDamaged).padStart(7)} ${pc(report.distinctMismatchedDamaged, d).padStart(8)}`,
  );
  console.log(
    `  UNEXPLAINED      ${String(report.weightedMismatchedUnexplained).padStart(8)} ${pc(report.weightedMismatchedUnexplained, w).padStart(8)}` +
      `   ${String(report.distinctMismatchedUnexplained).padStart(7)} ${pc(report.distinctMismatchedUnexplained, d).padStart(8)}`,
  );
  console.log(`\nthrew (a bug):     ${report.distinctThrew}`);

  console.log('\nquarantine reasons');
  for (const entry of report.quarantineHistogram) {
    console.log(
      `  ${entry.reason.padEnd(30)} ${String(entry.occurrences).padStart(7)} occ ` +
        `${pc(entry.occurrences, w).padStart(7)}   ${String(entry.rows).padStart(6)} rows`,
    );
  }

  if (report.unexplainedSamples.length > 0) {
    console.log('\nUNEXPLAINED mismatches — the renderer read these wrongly');
    for (const sample of report.unexplainedSamples) {
      console.log(`  x${sample.occurrences}`);
      console.log(`    io       ${sample.ioFormula.slice(0, 140)}`);
      console.log(`    expected ${sample.expected.slice(0, 140)}`);
      console.log(`    actual   ${(sample.actual ?? '(refused)').slice(0, 140)}`);
    }
  }
}

main();
