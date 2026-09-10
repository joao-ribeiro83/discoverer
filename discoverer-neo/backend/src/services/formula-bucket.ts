/**
 * Classify one stored formula into the D-059 bucket vocabulary, for seam 2 of
 * the migration verifier.
 *
 * **Since Phase 4.5 this covers only the rows with no token form** — a
 * calculated field authored in Neo, or one migrated before dual storage
 * landed. Everything with `source_tokens` is compiled by the Phase 4 renderer
 * in `@discoverer-neo/core`'s `formula-compile.ts`, which is where the
 * partition actually comes from. This remains the backend's own parser answer
 * for readable formula text, which the core renderer has no grammar for.
 *
 *   COMPILED             parsed AND proven against a real Oracle. Nothing can
 *                        claim this until the Phase 9.1 contract tests exist,
 *                        so this classifier never returns it.
 *   COMPILED_UNVERIFIED  parses against our grammar; not yet run anywhere.
 *   QUARANTINED(reason)  does not compile, and we can say why.
 *   FAILED               reserved for a path we do not handle — raised by the
 *                        verifier when this function throws, never returned.
 */

import { validateFormula } from './sql-generator.js';

/**
 * Discoverer stores a worksheet calculation as `[class,id]` element tokens
 * rather than item names. Our tokenizer reads `[...]` as an item reference, so
 * a token formula parses as a reference to the literal name "1,102" and only
 * fails later at resolution. Recognising the shape up front is what turns 714
 * indistinguishable "unknown item reference" errors into one stated reason.
 *
 * A row reaching this branch is a row whose token form was not kept, so the
 * renderer cannot help it: re-importing the workbook is what fixes it, not a
 * better renderer.
 */
const DISCOVERER_TOKEN = /\[\s*\d+\s*,\s*\d+\s*\]/;

/**
 * Accepts any identifier. Seam 2 asks whether the GRAMMAR holds, which is a
 * different question from whether the names resolve inside one map's scope —
 * that is seam 3's job, and conflating them would report every scope problem
 * as a formula problem.
 */
const acceptAnyItem = (name: string): string => `"${name.replace(/"/g, '')}"`;

/** Collapse a parser message to its shape, so reasons aggregate. */
function shape(message: string | undefined): string {
  return (message ?? 'no message')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/position \d+/g, 'position N');
}

export function bucketFormula(
  formula: string,
): { bucket: 'COMPILED_UNVERIFIED' | 'QUARANTINED'; reason?: string } {
  if (formula.trim() === '') {
    return { bucket: 'QUARANTINED', reason: 'EMPTY_FORMULA' };
  }
  if (DISCOVERER_TOKEN.test(formula)) {
    // The token form is present in `formula` but was never stored separately,
    // so there is nothing to render from. Re-import restores it (D-055).
    return { bucket: 'QUARANTINED', reason: 'TOKENS_NOT_RETAINED' };
  }
  const result = validateFormula(formula, acceptAnyItem);
  return result.valid
    ? { bucket: 'COMPILED_UNVERIFIED' }
    : { bucket: 'QUARANTINED', reason: `READABLE_PARSE_FAILED: ${shape(result.error)}` };
}
