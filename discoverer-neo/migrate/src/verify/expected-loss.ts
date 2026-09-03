/**
 * Declared expected-loss allowances for seam 4 of the migration verifier.
 *
 * A migration does not carry everything across, and some of what it drops is
 * understood and accepted. That belongs in data, where it can be read, argued
 * with and shrunk — not in a magic number inside an assertion, where a real
 * regression looks exactly like a known gap.
 *
 * `expectedTarget` is the count this table must hold after a migration of the
 * source described below. Seam 4 fails on ANY drift from it, in either
 * direction: fewer rows is a regression, more rows means the declaration is
 * stale. When a later phase recovers a concept, its `expectedTarget` rises and
 * the test tightens with it.
 *
 * `explained: false` marks a gap that is recorded but NOT understood. Those are
 * the ones that owe somebody an answer; the verifier counts them separately so
 * they cannot quietly become permanent.
 *
 * SOURCE: the live EUL4 estate (`SIID_TESTES`, Discoverer 4.1, prefix `EUL4_`),
 * as migrated on 2026-08-24 with the maps re-imported on 2026-08-28. Source
 * counts are the ones that run recorded; target counts were measured against
 * `discoverer_neo` on 2026-09-03. Both are reproduced in
 * `MASTER_PLAN_GENERATION_CHECKPOINT.md`.
 */

export interface ExpectedLossAllowance {
  /** What is being counted, in the domain's words. */
  concept: string;
  /** Target table holding it. Must be a bare identifier — it is interpolated. */
  table: string;
  /** Rows the source held, or null where the source figure was never measured. */
  sourceCount: number | null;
  /** Rows the target must hold. Seam 4 fails on any drift from this. */
  expectedTarget: number;
  /** Why the two differ, or why they do not. */
  why: string;
  /** false = the gap is recorded but not understood. Somebody owes an answer. */
  explained: boolean;
  /** The phase expected to shrink or remove this allowance. */
  recoveredBy?: string;
}

export const EXPECTED_LOSS_ALLOWANCES: readonly ExpectedLossAllowance[] = [
  // --- carried across whole ------------------------------------------------
  {
    concept: 'business areas',
    table: 'business_areas',
    sourceCount: 7,
    expectedTarget: 7,
    why: 'Carried across whole.',
    explained: true,
  },
  {
    concept: 'folders',
    table: 'folders',
    sourceCount: 212,
    expectedTarget: 212,
    why: 'Carried across whole.',
    explained: true,
  },
  {
    concept: 'items',
    table: 'items',
    sourceCount: 9626,
    expectedTarget: 9626,
    why: 'Carried across whole.',
    explained: true,
  },
  {
    concept: 'joins',
    table: 'joins',
    sourceCount: 10,
    expectedTarget: 10,
    why: 'Carried across whole. EUL5_KEY_CONS binds folders, not items.',
    explained: true,
  },
  {
    concept: 'custom functions',
    table: 'custom_functions',
    sourceCount: 593,
    expectedTarget: 593,
    why: 'Carried across whole.',
    explained: true,
  },
  {
    concept: 'worksheets → maps',
    table: 'maps',
    sourceCount: 923,
    expectedTarget: 923,
    why: 'One map per worksheet, decoded from DOC_DOCUMENT.',
    explained: true,
  },
  {
    concept: 'worksheet page setup',
    table: 'map_page_setup',
    sourceCount: 923,
    expectedTarget: 923,
    why: 'One row per worksheet.',
    explained: true,
  },

  // --- carried across with a stated, understood loss ------------------------
  {
    concept: 'users',
    table: 'users',
    sourceCount: 18,
    expectedTarget: 19,
    why: 'The 18 EUL principals, plus the local administrator account that predates the migration. A gain, not a loss.',
    explained: true,
  },
  {
    concept: 'worksheet totals',
    table: 'map_totals',
    sourceCount: 19639,
    expectedTarget: 19632,
    why: 'A read-only pass over DOC_DOCUMENT found 19 639 summary elements; 7 could not be attributed to a column and are dropped.',
    explained: true,
  },
  {
    concept: 'hierarchies',
    table: 'hierarchies',
    sourceCount: 508,
    expectedTarget: 0,
    why: 'EUL4_HIERARCHIES has no business-area column and Neo requires one, so every hierarchy is skipped (502 IBH, 6 DBH). The business area has to be derived: hierarchy → HI_NODES → IG_EXP_LINKS → EXPRESSIONS.IT_OBJ_ID → BA_OBJ_LINKS.',
    explained: true,
    recoveredBy: 'Phase 5',
  },
  {
    concept: 'hierarchy levels',
    table: 'hierarchy_levels',
    sourceCount: null,
    expectedTarget: 0,
    why: 'Follows hierarchies — nothing to hang a level on until those migrate. The source figure was never measured.',
    explained: true,
    recoveredBy: 'Phase 5',
  },
  {
    concept: 'worksheet layouts',
    table: 'map_layouts',
    sourceCount: 923,
    expectedTarget: 24,
    why: 'F-04. 899 maps have no layout row, so a worksheet migrates without the arrangement that made it readable.',
    explained: true,
    recoveredBy: 'Phase 5',
  },

  // --- recorded, NOT understood -------------------------------------------
  {
    concept: 'business-area grants',
    table: 'user_business_area_grants',
    sourceCount: 138,
    expectedTarget: 60,
    why: 'F-11. 78 source grants produced no target row and the cause has never been established. Until it is, nobody can say whether this is correct de-duplication or 78 people silently losing access.',
    explained: false,
    recoveredBy: 'Phase 5',
  },
];
