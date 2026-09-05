import { SqlGenerationError } from '../../types/sql.js';

/**
 * The join type a join's flags produce — derived, never stored (D-032).
 *
 * There is no `FULL`. The flag combination that would mean it is a refusal
 * (D-038), so it can never be a value here.
 */
export type DerivedJoinType = 'INNER' | 'LEFT' | 'RIGHT';

/** The two flags the derivation reads. Nothing else may enter it. */
export interface JoinOuterFlags {
  /** `FK_MSTR_NO_DETAIL` — Administrator's "Outer join on detail". */
  allowMasterNoDetail: boolean;
  /** `FK_DTL_NO_MASTER` — Administrator's "Outer join on master". */
  allowDetailNoMaster: boolean;
}

/**
 * Derive a join's SQL join type from its two outer-join flags.
 *
 * Discoverer's Join Wizard Step 2 offers four settings and the EUL DTD carries
 * four matching attributes, but only two of them reach the emitted SQL:
 *
 * | `allowMasterNoDetail` | `allowDetailNoMaster` | emitted |
 * | --- | --- | --- |
 * | false | false | `INNER JOIN` |
 * | true  | false | `LEFT JOIN` from master — detail side takes the `(+)` |
 * | false | true  | `RIGHT JOIN` from master — *"rare in real business scenarios"* |
 * | true  | true  | **refusal** |
 *
 * The other two settings are stored and deliberately excluded here:
 *
 * - `oneToOne` — Oracle is explicit that *"this setting has no effect on the
 *   SQL that Discoverer generates… it only affects the fan trap detection"*.
 *   It is the fan-trap guard's input (Phase 3.3), not this function's.
 * - `mandatory` — a referential-integrity *assertion*. It unlocks join
 *   trimming and summary-folder eligibility; it changes no join type.
 *
 * **Why (true, true) refuses rather than emitting `FULL OUTER` (D-038).** No
 * vendor text describes the combination, and it is inexpressible in the
 * Oracle 8 `(+)` syntax Discoverer 4.1 targeted — there is no way to put `(+)`
 * on both sides of a predicate. Emitting `FULL OUTER JOIN` would be Neo
 * inventing a semantic the source never had, on a system whose failure mode is
 * silently wrong numbers. Refusing names the join and asks a human.
 *
 * @param joinName used only to name the join in the refusal message.
 */
export function deriveJoinType(
  flags: JoinOuterFlags,
  joinName: string,
): DerivedJoinType {
  const { allowMasterNoDetail, allowDetailNoMaster } = flags;
  if (allowMasterNoDetail && allowDetailNoMaster) {
    throw new SqlGenerationError(
      `Join "${joinName}" allows both master rows without detail and detail rows without master. ` +
        'Discoverer 4.1 could not express that combination and Neo will not guess at it.',
      { joins: [joinName] },
      'JOIN_BOTH_OUTER',
    );
  }
  if (allowMasterNoDetail) return 'LEFT';
  if (allowDetailNoMaster) return 'RIGHT';
  return 'INNER';
}
