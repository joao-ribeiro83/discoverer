/**
 * BE-09 — the SQL function allowlist has exactly one declaration.
 *
 * Three files used to carry their own set of Oracle function names:
 * `formula-parser.ts` (what may be emitted as SQL), `query-plan.ts` (what the
 * fan-trap planner refuses to re-aggregate) and `calculated-field-evaluator.ts`
 * (what may be evaluated in-process). They had drifted — the evaluator
 * admitted `STDDEV`, `VARIANCE` and `MEDIAN` as aggregates that the SQL path
 * did not know about; the SQL path allowed `NEXT_DAY`, which the evaluator
 * could not compute; and the two unreaggregable sets differed in three names
 * including both spellings of `COUNT DISTINCT`.
 *
 * All three now import from `@discoverer-neo/core/semantics`. This test is
 * what stops a fourth copy appearing, in the same shape as
 * `schema-single-definition.test.ts` and for the same reason: an allowlist is
 * a security boundary, and a security boundary with two definitions is
 * whichever one the reader did not check.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CANONICAL = join(__dirname, '..', '..', '..', 'migrate', 'src', 'semantics', 'allowlist.ts');

const CONSUMERS = [
  join(__dirname, '..', 'lib', 'sql', 'formula-parser.ts'),
  join(__dirname, '..', 'lib', 'sql', 'query-plan.ts'),
  join(__dirname, '..', 'services', 'calculated-field-evaluator.ts'),
];

/**
 * Sets a file declares whose name ends in `_FUNCTIONS`.
 *
 * Named rather than shape-based, on purpose. A scan for "a set of all-caps
 * strings" cannot tell an allowlist copy from a legitimate subset with
 * different semantics — `NULL_TOLERANT` in the evaluator lists seven function
 * names to say which of them accept a NULL argument, which is a real and
 * different question — and a guard that fires on both would be turned off.
 * The three sets BE-09 was actually about are the `*_FUNCTIONS` ones, and
 * those are exactly what must not reappear.
 */
function declaredFunctionSets(source: string): string[] {
  return [...source.matchAll(/(?:const|let|var)\s+(\w*_FUNCTIONS)\s*(?::[^=]+)?=\s*new Set/g)].map(
    (m) => m[1]!,
  );
}

describe('the SQL function allowlist has a single definition', () => {
  const canonical = readFileSync(CANONICAL, 'utf8');

  it('declares the allowlist in core', () => {
    expect(declaredFunctionSets(canonical).sort()).toEqual([
      'AGGREGATE_FUNCTIONS',
      'SCALAR_FUNCTIONS',
      'UNREAGGREGABLE_FUNCTIONS',
    ]);
  });

  it('declares none of them anywhere in the backend', () => {
    for (const path of CONSUMERS) {
      expect({ path, sets: declaredFunctionSets(readFileSync(path, 'utf8')) }).toEqual({
        path,
        sets: [],
      });
    }
  });

  it('imports the allowlist from core in every consumer', () => {
    for (const path of CONSUMERS) {
      expect(readFileSync(path, 'utf8')).toContain("from '@discoverer-neo/core/semantics'");
    }
  });
});
