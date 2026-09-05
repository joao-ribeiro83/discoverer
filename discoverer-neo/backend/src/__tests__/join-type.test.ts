/**
 * The join-type derivation truth table, one test per row (D-032).
 *
 * This is four booleans and three outcomes, so it looks too small to test.
 * It is not. Until Phase 3.2 `join_type` was a stored column fed from
 * `EUL4_KEY_CONS.KEY_TYPE`, whose live domain is `FK`/`UK` — a *constraint
 * kind*. Every one of the estate's ten joins read `INNER` from a column that
 * has never held a join type, and nothing failed, because an inner join over
 * a master/detail pair is perfectly valid SQL that returns the wrong number of
 * rows. That is the failure mode this table replaces, and a table with a
 * silent failure mode is exactly the kind that needs a test per row.
 */

import { describe, it, expect } from '@jest/globals';
import { SqlGenerationError } from '../types/sql.js';
import { deriveJoinType } from '../lib/sql/join-type.js';

const derive = (allowMasterNoDetail: boolean, allowDetailNoMaster: boolean) =>
  deriveJoinType(
    { allowMasterNoDetail, allowDetailNoMaster },
    'M M32 -> M M32 1',
  );

describe('deriveJoinType — the four-row truth table', () => {
  it('(false, false) → INNER', () => {
    // Nine of the estate's ten joins. Both sides must match.
    expect(derive(false, false)).toBe('INNER');
  });

  it('(true, false) → LEFT — master rows kept, detail side takes the (+)', () => {
    // Administrator's "Outer join on detail": *returns all master rows that
    // have no corresponding detail items, as well as all matching rows*.
    // `109828 M M32 -> M M32 1` is the estate's one real instance.
    expect(derive(true, false)).toBe('LEFT');
  });

  it('(false, true) → RIGHT — detail rows kept, "rare in real business scenarios"', () => {
    // Administrator's "Outer join on master". No live instance in this estate;
    // `FK_DTL_NO_MASTER` is 0 on all ten rows.
    expect(derive(false, true)).toBe('RIGHT');
  });

  it('(true, true) → REFUSE, naming the join (D-038)', () => {
    // Not FULL OUTER, even though the old enum had a `FULL` value. No vendor
    // text describes the combination, and it is inexpressible in the Oracle 8
    // `(+)` syntax 4.1 targeted — there is no way to put `(+)` on both sides
    // of one predicate. Emitting FULL would be Neo inventing a semantic the
    // source never had.
    try {
      derive(true, true);
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(SqlGenerationError);
      const e = err as SqlGenerationError;
      expect(e.code).toBe('JOIN_BOTH_OUTER');
      expect(e.message).toContain('M M32 -> M M32 1');
      expect(e.details).toEqual({ joins: ['M M32 -> M M32 1'] });
    }
  });
});

describe('deriveJoinType — what stays OUT of the derivation', () => {
  it('ignores one_to_one entirely — its only consumer is fan-trap detection', () => {
    // Oracle is explicit: "This setting has no effect on the SQL that
    // Discoverer generates… It only affects the fan trap detection."
    const flags = { allowMasterNoDetail: false, allowDetailNoMaster: false };
    expect(deriveJoinType({ ...flags, oneToOne: true } as never, 'j')).toBe(
      'INNER',
    );
    expect(deriveJoinType({ ...flags, oneToOne: false } as never, 'j')).toBe(
      'INNER',
    );
  });

  it('ignores mandatory — it is a referential-integrity assertion, not a type', () => {
    // It unlocks join trimming and summary-folder eligibility. Nine of the
    // estate's ten joins set it; letting it reach the derivation would change
    // the SQL for nine joins on the strength of a claim about the DATA.
    const flags = { allowMasterNoDetail: true, allowDetailNoMaster: false };
    expect(deriveJoinType({ ...flags, mandatory: true } as never, 'j')).toBe(
      'LEFT',
    );
    expect(deriveJoinType({ ...flags, mandatory: false } as never, 'j')).toBe(
      'LEFT',
    );
  });
});
