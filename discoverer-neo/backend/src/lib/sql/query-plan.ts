import type { EffectiveFolderSet } from './folder-set.js';

/**
 * The query plan — what the fan-trap planner decides before any SQL is written.
 *
 * ===========================================================================
 * Why this is a plan and not a verdict (D-017)
 * ===========================================================================
 *
 * A `{ kind, branches: number }` enum would be enough to *report* a decision
 * and nowhere near enough to *execute* one. The rewrite changes the arity of
 * three things the generator treats as singular:
 *
 *  - **WHERE goes from one clause to n+1.** `legacy-analysis.md` §1.11 step 7
 *    puts each branch's conditions and parameters INSIDE that branch's inline
 *    view. The arithmetic forces it: a filter on branch *i* placed in the outer
 *    query silently drops master rows that branch *j* still matches. So each
 *    branch carries its own condition and parameter set.
 *  - **Folder aliases stop being 1:1.** The rewrite repeats the master folder
 *    inside every branch, so one folder needs one alias per branch.
 *  - **GROUP BY goes per branch.** Each inline view groups by the master key
 *    before anything else sees it, and the axis columns ride on exactly one
 *    branch.
 *
 * Hence: branches, each branch's folders, its join predicate, its branch-local
 * conditions and parameters, its group keys, its per-measure aggregate *and*
 * re-aggregate, and the outer key set. All seven live below.
 *
 * ===========================================================================
 * INVARIANT — the summary/RLS bypass (D-021)
 * ===========================================================================
 *
 * A materialised view, rollup or cached result derived from an RLS-bearing
 * folder contains only its creator's rows. Serving it to a second user answers
 * their query with someone else's data — *"the fastest path through the system
 * is also the one that leaks."*
 *
 * **Nothing leaks today: Neo has no result cache.** This note exists so that
 * the first person to add one — a cached plan result, a summary-folder
 * redirect, a materialised rollup — finds the rule at the moment they need it:
 *
 * > A cache key for a query over an RLS-bearing folder must include the
 * > resolved security predicates and their bind values, or the cache must not
 * > exist. `securityRelevantFolderIds(plan.folderSet)` names the folders that
 * > make a query RLS-bearing.
 *
 * ===========================================================================
 * INVARIANT — the security folder set is NOT the join path (Phase 1.1, D-115)
 * ===========================================================================
 *
 * `folderSet.columnBearingFolderIds` comes from `def.items` + `def.conditions`
 * (plus wherever a formula, a sort or a total leads). **The planner adds
 * folders to FROM that carry no selected item** — branch subtrees, bridge
 * folders. Do not widen the security set to match the join path: only a folder
 * that can change the rows the user sees needs a policy, and
 * `securityRelevantFolderIds` already draws that line.
 */

// ---------------------------------------------------------------------------
// Measures and re-aggregation (D-035)
// ---------------------------------------------------------------------------

/**
 * The aggregates that survive a fan-trap rewrite, and what the outer query
 * applies to each branch's result.
 *
 * `SUM` over branch `SUM` is trivially correct. `MIN`/`MAX` re-aggregate as
 * themselves. `COUNT` counts rows per branch and those counts then add, so it
 * re-aggregates as `SUM`.
 *
 * Everything else refuses — see `UNREAGGREGATABLE`.
 */
export const RE_AGGREGATE: Readonly<Record<string, 'SUM' | 'MIN' | 'MAX'>> = {
  SUM: 'SUM',
  COUNT: 'SUM',
  MIN: 'MIN',
  MAX: 'MAX',
};

/**
 * Aggregates that cannot cross a fan and are refused rather than approximated
 * (D-035, `legacy-analysis.md` §1.9.1).
 *
 * Declared once, in `@discoverer-neo/core/semantics`, where the reasoning for
 * each name lives — the renderer refuses the same set with the same reason and
 * a second copy here is how the two drift apart (BE-09). Re-exported under the
 * name the planner has always used.
 */
export { UNREAGGREGABLE_FUNCTIONS as UNREAGGREGATABLE } from '@discoverer-neo/core/semantics';

/** One measure, with the aggregate it applies and the one that re-applies. */
export interface PlanMeasure {
  /** `map_items.id`. */
  mapItemId: string;
  itemId: string;
  /** The folder the measure's column lives in — which branch it belongs to. */
  folderId: string;
  /** Display label, for refusal messages. */
  label: string;
  /** The aggregate inside the branch's inline view. */
  aggregate: string;
  /**
   * The aggregate the outer query applies to the branch's column, or null when
   * the plan is FLAT and nothing re-aggregates.
   */
  reAggregate: 'SUM' | 'MIN' | 'MAX' | null;
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

/** A column, named by metadata — never by string. */
export interface PlanColumn {
  folderId: string;
  itemId: string;
  columnName: string;
}

/** One component of a join predicate: `master.col <op> detail.col`. */
export interface PlanPredicateComponent {
  master: PlanColumn;
  detail: PlanColumn;
  /** Looked up against a closed operator table when emitted, never spliced. */
  operator: string;
}

/**
 * A branch's GROUP BY entry: either one of the outer join keys, or an axis
 * column this branch alone carries into the outer query (§1.4 property 5 — the
 * axis columns ride on exactly one branch).
 */
export type PlanGroupKey =
  | { kind: 'KEY'; column: PlanColumn }
  | { kind: 'AXIS'; mapItemId: string };

/**
 * One master–detail aggregation branch: everything needed to write its inline
 * view, and nothing about how it is written.
 */
export interface PlanBranch {
  /** `b0`, `b1`, … — stable within one plan, used for aliasing and messages. */
  id: string;
  /** Folders inside this inline view: the master first, then the branch subtree. */
  folderIds: string[];
  /**
   * The detail folder this branch hangs off, or null for the master-only branch
   * that step 5a creates for the master's own measures.
   */
  detailFolderId: string | null;
  /** Index into `def.joins`; null for the master-only branch. */
  joinIdx: number | null;
  /** The join predicate, in `seq` order. Empty for the master-only branch. */
  predicate: PlanPredicateComponent[];
  /**
   * Conditions scoped to this branch (`map_conditions.id`). Branch-local, not
   * outer — see the arity note at the top of this file.
   */
  conditionIds: string[];
  /** Bind names of the parameters those conditions reference. */
  parameterBindNames: string[];
  /** The inline view's GROUP BY, in order. */
  groupKeys: PlanGroupKey[];
  /** Measures aggregated inside this branch. */
  measures: PlanMeasure[];
  /** False only for a join explicitly flagged one-to-one (D-033). */
  fanning: boolean;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/** Why a plan came out FLAT. Recorded, so an inert guard is visible (D-031). */
export type FlatReason =
  /** `|M| = 0` — nothing aggregates, so nothing can be inflated (step 0). */
  | 'NO_MEASURES'
  /** One folder: no join, no fan (step 5, degenerate). */
  | 'SINGLE_FOLDER'
  /** Joins exist but no folder has a fanning branch carrying a measure. */
  | 'NO_FAN_CANDIDATE'
  /** The folders are not connected; the FROM clause refuses by name. */
  | 'DISCONNECTED';

/** The refusal rules of `legacy-analysis.md` §1.5, plus re-aggregation. */
export type RefusalRule = 'R1' | 'R2' | 'R3' | 'R4' | 'REAGG';

interface PlanBase {
  /** The folder set, as a value — the planner's and the emitter's only source. */
  folderSet: EffectiveFolderSet;
  /** Every folder the plan admits: column-bearing plus join-path bridges. */
  folderIds: string[];
  /** Column-bearing folders, root first — what the FROM clause spans. */
  fromFolderIds: string[];
  /** `M`. Empty means step 0 fired; a guard that is always empty is inert. */
  measures: PlanMeasure[];
  /**
   * The one-line decision recorded against every execution (§1.11 step 10):
   * `FLAT(NO_MEASURES)`, `REWRITE(2)`, `REFUSE(R3)`.
   */
  decision: string;
}

/** The fast path — chosen deliberately, never fallen into (D-018). */
export interface FlatPlan extends PlanBase {
  kind: 'FLAT';
  reason: FlatReason;
}

/** The inline-view rewrite of `legacy-analysis.md` §1.4. */
export interface RewritePlan extends PlanBase {
  kind: 'REWRITE';
  /** The folder every branch hangs off and repeats inside itself. */
  masterFolderId: string;
  /** The columns the branches are joined back together on. */
  outerKeys: PlanColumn[];
  branches: PlanBranch[];
}

/** A query that can be written but whose answer cannot be vouched for. */
export interface RefusalPlan extends PlanBase {
  kind: 'REFUSE';
  rule: RefusalRule;
  /** Folder NAMES — every refusal names its folders. */
  folders: string[];
  /** Plain-language explanation; the UI translates from `rule` (D-036). */
  message: string;
}

export type QueryPlan = FlatPlan | RewritePlan | RefusalPlan;
