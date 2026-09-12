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
    why: 'Phase 5.1b. Not one of the 508 is a hand-authored drill path. HI_SYS_GENERATED is 1 on all 502 IBH rows and every one of them carries a non-null IBH_DBH_ID, so all 502 are instances Discoverer stamped from a date template; the remaining 6 are the DBH templates themselves. D-074: Neo regenerates a date drill path from the date item, so none of the 508 is imported. The four-hop business-area resolver is in place and correct (it reaches exactly one business area for 491 of the 508) — it simply has nothing left to resolve for. This zero is a decision, not the old accident.',
    explained: true,
  },
  {
    concept: 'hierarchy levels',
    table: 'hierarchy_levels',
    sourceCount: null,
    expectedTarget: 0,
    why: 'Follows hierarchies — no hierarchy is imported, so there is nothing to hang a level on. The 6 templates are four levels each (Year, Quarter, Month, Day), identical across all six; the reader asserts that shape so a template that differs surfaces as a failure rather than vanishing into this line.',
    explained: true,
  },
  {
    concept: 'worksheet layouts',
    table: 'map_layouts',
    sourceCount: 923,
    expectedTarget: 923,
    why: 'F-04, recovered in Phase 5.4: the 899-row gap was stale target data, not a code defect — POST /api/migration/reimport-maps rebuilds map_layouts unconditionally and now produces one row per migrated worksheet.',
    explained: true,
  },
  {
    concept: 'items on a folder with no business area (MIG-08)',
    table: 'items',
    sourceCount: 171,
    expectedTarget: 0,
    why: 'The owning folder has no EUL4_BA_OBJ_LINKS row (FOLDER_NO_BA), so the folder itself is never migrated and every item on it is skipped as a consequence — one cause, not 171 independent losses. A folder with no business area is not reachable through Discoverer’s own UI either, so this is a source-data gap, not a migration defect. The `items` allowance above (9 626 → 9 626) is scoped to items on migrated folders and does not include these.',
    explained: true,
  },
  {
    concept: 'folder ↔ business-area shares',
    table: 'folder_business_areas',
    sourceCount: 0,
    expectedTarget: 0,
    why: 'Decision 1 (D-075): migration-runner.ts has written every non-owning EUL4_BA_OBJ_LINKS row here since 2026-09-03. Verified directly against the live source (backend/src/scripts/probe-ba-obj-links.ts): 212 BA_OBJ_LINKS rows, 0 folders linked to more than one business area. Zero is correct for this estate, not an unrun migration.',
    explained: true,
  },
  {
    concept: 'conditional formats (Exceptions)',
    table: 'map_conditional_formats',
    sourceCount: null,
    expectedTarget: 0,
    why: 'Decision 10. No element class in the .DIS format has been identified as conditional-format data — EUL_SCHEMA_GROUND_TRUTH.md §7.8.11 decoded the earlier candidate (0x0898) as saved parameter values instead, and the remaining unmodelled classes total 40 elements corpus-wide, too sparse to reverse-engineer. The schema and the application’s own write path (map.service.ts) are ready; migration-time population needs new binary evidence (a d4dumps-style corpus) this decoding pass does not have.',
    explained: true,
    recoveredBy: 'unscheduled — blocked on new evidence, not a phase',
  },

  {
    concept: 'business-area grants',
    table: 'user_business_area_grants',
    sourceCount: 138,
    expectedTarget: 60,
    why: 'Phase 5.1a settles F-11. ACCESS_PRIVS holds three kinds of row, told apart by AP_TYPE: 60 GBA (business-area grants — all 60 migrate, none lost), 50 GD (shares of a single workbook; Neo has no workbook-level grant) and 28 GP (EUL-wide privileges, GP_APP_ID 1000-1015 — not business-area grants at all). 60 + 50 + 28 = 138. The 78 are two whole concepts Neo does not model, not 78 people losing access. Every one of the 60 grantees is a real user, every business area exists, and the 60 (user, business area) pairs are already distinct — nothing is de-duplicated away.',
    explained: true,
  },
];
