/**
 * Classify one stored formula into the D-059 bucket vocabulary, for seam 2 of
 * the migration verifier.
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
 * The Phase 4 token renderer is what moves these out of quarantine.
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
    return { bucket: 'QUARANTINED', reason: 'empty formula' };
  }
  if (DISCOVERER_TOKEN.test(formula)) {
    return { bucket: 'QUARANTINED', reason: 'unrendered Discoverer [class,id] token — no renderer yet' };
  }
  const result = validateFormula(formula, acceptAnyItem);
  return result.valid
    ? { bucket: 'COMPILED_UNVERIFIED' }
    : { bucket: 'QUARANTINED', reason: `does not parse: ${shape(result.error)}` };
}
