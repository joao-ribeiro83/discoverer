/**
 * Diagnostic: what would the calculated fields in an already-migrated target
 * look like if the display renderer had been run over them?
 *
 * `map_calculated_fields.formula` is written by `humanizeFormula`, which
 * substitutes `[6,n]` elements and `[8,n]` parameters and leaves every `[1,n]`
 * builtin code exactly as it found it. `semantics/render.ts` has the renderer
 * that turns a token tree into Oracle's own display form, fitted in Phase 4.1
 * against 37 971 aligned pairs — the migration just never calls it.
 *
 * This reads `source_tokens`, re-parses the tree, and reports:
 *  - how many rows still carry a raw `[1,n]` in `formula`;
 *  - the code histogram across the whole estate, split by whether this
 *    renderer implements the code;
 *  - a sample of before/after renderings.
 *
 *   DATABASE_URL=... npx tsx src/scripts/probe-calc-rendering.ts [sampleSize]
 *
 * Read-only. Prints a report; writes nothing.
 */

import { sql } from 'drizzle-orm';

import { createTargetDb } from '../db/client.js';
import { parseFormulaTree } from '../services/workbook-parser.js';
import { FITTED_CODES, renderDisplay } from '../semantics/render.js';

interface Row {
  id: string;
  name: string;
  formula: string | null;
  source_tokens: string | null;
}

function codesIn(tokens: string): number[] {
  return [...tokens.matchAll(/\[1,(\d+)\]/g)].map((m) => Number(m[1]));
}

async function main(): Promise<void> {
  const sampleSize = Number(process.argv[2] ?? 12);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const target = createTargetDb({ connectionString: url });

  const result = await target.db.execute(
    sql`SELECT id::text AS id, name, formula, source_tokens FROM map_calculated_fields`,
  );
  const rows = (result as unknown as { rows: Row[] }).rows;
  console.log(`calculated fields: ${rows.length}`);

  // 1. How many stored formulas still read as opcodes?
  const rawInFormula = rows.filter((r) => r.formula !== null && /\[\d+,\d+/.test(r.formula));
  console.log(`formula still carrying a raw token: ${rawInFormula.length}`);

  // 2. Code histogram, split by whether the renderer implements the code.
  const uses = new Map<number, number>();
  for (const row of rows) {
    if (!row.source_tokens) continue;
    for (const code of codesIn(row.source_tokens)) uses.set(code, (uses.get(code) ?? 0) + 1);
  }
  const sorted = [...uses].sort((a, b) => b[1] - a[1]);
  const totalUses = sorted.reduce((n, [, c]) => n + c, 0);
  const missingUses = sorted
    .filter(([code]) => !FITTED_CODES.has(code))
    .reduce((n, [, c]) => n + c, 0);
  console.log(
    `\ndistinct [1,n] codes: ${sorted.length}; uses: ${totalUses}; ` +
      `uses of a code this renderer does NOT implement: ${missingUses} ` +
      `(${((missingUses / Math.max(totalUses, 1)) * 100).toFixed(2)}%)`,
  );
  const unimplemented = sorted.filter(([code]) => !FITTED_CODES.has(code));
  console.log(
    `\ncodes this renderer does NOT implement: ${
      unimplemented.map(([c, n]) => `[1,${c}] x${n}`).join(', ') || 'none'
    }`,
  );

  console.log('\ncode   uses  implemented');
  for (const [code, count] of sorted.slice(0, 30)) {
    console.log(
      `[1,${String(code).padEnd(3)}] ${String(count).padStart(6)}  ${FITTED_CODES.has(code) ? 'yes' : 'NO'}`,
    );
  }

  // 3. Re-render a sample and show what the row would read as.
  console.log('\n--- what the renderer produces, on real rows ---');
  let shown = 0;
  let rendered = 0;
  let refused = 0;
  for (const row of rows) {
    if (!row.source_tokens) continue;
    let display: string;
    const parsed = parseFormulaTree(row.source_tokens);
    if (parsed.tree === null) {
      refused += 1;
      display = `<unparsed: ${(parsed.error ?? 'unknown').slice(0, 60)}>`;
    } else {
      try {
        display = renderDisplay(parsed.tree);
        rendered += 1;
      } catch (err) {
        refused += 1;
        display = `<refused: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}>`;
      }
    }
    if (shown < sampleSize && /\[\d+,\d+/.test(row.formula ?? '')) {
      console.log(`\n  name    ${row.name}`);
      console.log(`  stored  ${(row.formula ?? '').slice(0, 120)}`);
      console.log(`  would   ${display.slice(0, 120)}`);
      shown += 1;
    }
  }
  console.log(`\nrendered: ${rendered}   refused: ${refused}`);

  await target.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
