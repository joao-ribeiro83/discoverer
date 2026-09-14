import type { MapTotal } from '../../db/schema.js';
import type { GeneratedTotal, MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { makeColumnAlias, quoteIdentifier } from './identifiers.js';
import { calculatedFieldSql, AGGREGATE_FUNCTIONS } from './formula-parser.js';
import type { SelectClauseResult } from './select-clause.js';
import type { QueryPlan } from './query-plan.js';

/**
 * Alias `sql-generator.ts` gives the main query when it wraps it as the
 * FROM for a `SELECT DISTINCT` map's totals (BE-07) — see `planTotals` and
 * `targetExpression` below for why totals need that wrapper at all.
 */
export const DISTINCT_TOTALS_ALIAS = 'dt';

/**
 * `map_items.id` -> the plan branch its rows come from, or null when the plan
 * is not a rewrite and every column is at one grain.
 */
function branchLookup(plan?: QueryPlan): (mapItemId: string) => string | null {
  if (plan?.kind !== 'REWRITE') return () => null;
  const byMapItem = new globalThis.Map<string, string>();
  for (const branch of plan.branches) {
    for (const measure of branch.measures) byMapItem.set(measure.mapItemId, branch.id);
    for (const key of branch.groupKeys) {
      if (key.kind === 'AXIS') byMapItem.set(key.mapItemId, branch.id);
    }
  }
  return (mapItemId) => byMapItem.get(mapItemId) ?? null;
}

/**
 * One totals statement, minus the FROM and WHERE it shares with the main
 * query. The generator supplies those, because they are only complete once
 * every clause has registered the folders it touches.
 */
export interface TotalsPlanEntry {
  breakAlias: string | null;
  breakLabel?: string;
  breakTargetAlias?: string;
  /** SELECT-list fragments, the break column first when there is one. */
  selectParts: string[];
  /** GROUP BY expression for an `AT_CHANGE` set; absent on the grand total. */
  groupByExpr?: string;
  totals: GeneratedTotal[];
}

export interface TotalsPlan {
  entries: TotalsPlanEntry[];
  warnings: string[];
}

/**
 * Plan the totals queries for a map — Discoverer's `DCBImportedSummary`.
 *
 * **Why a second query and not `ROLLUP`.** A Discoverer worksheet shows the
 * detail rows *and* the totals. One grouped statement returns one grain, so it
 * cannot do both. Splitting them also keeps the detail query untouched — still
 * paginated, still ordered — while the totals stay computed over the whole
 * filtered set instead of over whichever page was fetched.
 *
 * **What is totalled.** The total's aggregate wraps the item's *base*
 * expression, not the column the main query draws. A map that already shows
 * `SUM(Amount)` per region has a grand total of `SUM(Amount)` over every row,
 * not `SUM(SUM(Amount))`, which Oracle would reject anyway. Where the target
 * is a calculation that already aggregates, its expression is emitted
 * unwrapped and `aggFunction` reports `INLINE`.
 *
 * **Percentages** (`kind = 'PERCENTAGE'`) are planned exactly like totals: the
 * numerator is all a query can supply, and the ratio needs a denominator the
 * renderer picks. The kind rides along so the renderer knows to divide. No
 * *migrated* total is ever one — Discoverer keeps a percentage in the same
 * element as a value of the same aggregate enum, and no code in the corpus is
 * that value, so the migration writes `TOTAL` on all 19 639. This path exists
 * for percentages authored in Neo.
 *
 * Totals that cannot be expressed are skipped with a warning rather than
 * failing the whole map. The largest such group is real and known: 304 of the
 * corpus's 19 639 summaries carry an `EDCBAggregateType` the migration does
 * not write — `COUNT DISTINCT` and 22 undecoded codes — and arrive here with a
 * null `agg_function`.
 */
export function planTotals(
  def: MapDefinition,
  ctx: GenerationContext,
  select: SelectClauseResult,
  plan?: QueryPlan,
): TotalsPlan {
  const warnings: string[] = [];
  const totals = def.totals ?? [];
  if (totals.length === 0) return { entries: [], warnings };

  const branchOf = branchLookup(plan);

  const mapItemById = new globalThis.Map(
    def.items.map((entry) => [entry.mapItem.id, entry]),
  );
  const calcFieldById = new globalThis.Map(
    def.calculatedFields.map((field) => [field.id, field]),
  );

  /**
   * The SQL for what a total measures, and whether it already aggregates.
   *
   * **BE-07.** Under `SELECT DISTINCT` the main query's row set is not its
   * raw joined rows — duplicates are folded away first. A total built from
   * the raw expression (`SUM(f1."AMOUNT")` straight off the FROM/WHERE)
   * sums the *pre-dedup* rows, which is a different, larger number than
   * what the distinct rows on screen add up to. `sql-generator.ts` wraps
   * the main SELECT DISTINCT statement itself as the totals' FROM (aliased
   * `DISTINCT_TOTALS_ALIAS`) precisely so the total can aggregate the same
   * deduplicated set the user sees — so here the target must reference that
   * wrapper's column alias, not recompute the raw expression. A target with
   * no alias (hidden under DISTINCT, so not part of what was deduplicated
   * on) has no deduplicated column to point at and is skipped.
   *
   * This applies even when the target's own expression already aggregates
   * (the `aggregates` / `INLINE` case below): under DISTINCT that value is
   * only the per-*group* figure inside the wrapper (Oracle needs a GROUP BY
   * to run `SELECT DISTINCT` alongside an aggregate item, and that GROUP BY
   * is what makes the wrapper's rows one per group instead of one per raw
   * row). Re-summing those per-group figures — `SUM` is associative over a
   * GROUP BY's disjoint partition — is exactly the grand total, so the
   * caller wraps this target in `total.aggFunction` same as any other
   * target once DISTINCT is in play; it does not stay unwrapped.
   */
  function targetExpression(
    total: MapTotal,
  ): { sql: string; label: string; alias?: string; aggregates: boolean } | null {
    if (total.mapItemId) {
      const entry = mapItemById.get(total.mapItemId);
      if (!entry) return null;
      const alias = select.aliasByMapItemId.get(entry.mapItem.id);
      if (select.distinct && !alias) return null;
      const info = ctx.itemExpressionInfo(entry.item, entry.folder);
      return {
        sql: select.distinct ? `${DISTINCT_TOTALS_ALIAS}.${quoteIdentifier(alias!)}` : info.sql,
        label: entry.mapItem.displayName || entry.item.name,
        alias,
        aggregates: info.containsAggregate,
      };
    }
    if (total.mapCalculatedFieldId) {
      const field = calcFieldById.get(total.mapCalculatedFieldId);
      if (!field) return null;
      const alias = select.aliasByCalcFieldId.get(field.id);
      if (select.distinct && !alias) return null;
      const parsed = calculatedFieldSql(field, (name) =>
        ctx.resolveFormulaReference(name),
      );
      return {
        sql: select.distinct ? `${DISTINCT_TOTALS_ALIAS}.${quoteIdentifier(alias!)}` : parsed.sql,
        label: field.name,
        alias,
        aggregates: parsed.containsAggregate,
      };
    }
    return null;
  }

  // Group by break column: one statement per break, plus one for the grand
  // totals.
  //
  // An `AT_CHANGE` total with no break column is a subtotal whose boundary did
  // not survive the migration — Discoverer's `0x0c23` is non-zero on every one
  // of them, and Neo loses it only when the break was a workbook calculation
  // (`map_totals.break_map_item_id` references `map_items`, which a calculation
  // has no row in). Rolling it into the grand total would answer a different
  // question with the same-looking number: a subtotal drawn where a reader
  // expects "per region" would show the figure for every region at once. It is
  // skipped and said out loud instead.
  const byBreak = new globalThis.Map<string | null, MapTotal[]>();
  for (const total of totals) {
    if (total.placement === 'AT_CHANGE' && !total.breakMapItemId) {
      warnings.push(
        'A subtotal was skipped: it breaks at each change in a column this map does not have (in Discoverer it broke on a workbook calculation). Re-apply the break in Discoverer Neo.',
      );
      continue;
    }
    const key = total.placement === 'AT_CHANGE' ? total.breakMapItemId : null;
    const bucket = byBreak.get(key);
    if (bucket) bucket.push(total);
    else byBreak.set(key, [total]);
  }

  // Grand totals first, then breaks in the order their columns are displayed.
  const breakKeys = [...byBreak.keys()].sort((a, b) => {
    if (a === b) return 0;
    if (a === null) return -1;
    if (b === null) return 1;
    const oa = mapItemById.get(a)?.mapItem.displayOrder ?? 0;
    const ob = mapItemById.get(b)?.mapItem.displayOrder ?? 0;
    return oa - ob;
  });

  const entries: TotalsPlanEntry[] = [];

  for (const breakKey of breakKeys) {
    const taken = new Set<string>();
    const selectParts: string[] = [];
    let breakAlias: string | null = null;
    let breakLabel: string | undefined;
    let breakTargetAlias: string | undefined;
    let groupByExpr: string | undefined;

    if (breakKey !== null) {
      const entry = mapItemById.get(breakKey);
      if (!entry) {
        warnings.push(
          `Subtotals breaking on an unknown column were skipped (map item ${breakKey})`,
        );
        continue;
      }
      const info = ctx.itemExpressionInfo(entry.item, entry.folder);
      breakLabel = entry.mapItem.displayName || entry.item.name;
      if (info.containsAggregate) {
        warnings.push(
          `Subtotals breaking on "${breakLabel}" were skipped: the column is itself an aggregate and cannot group rows`,
        );
        continue;
      }
      breakTargetAlias = select.aliasByMapItemId.get(entry.mapItem.id);
      // BE-07: same reasoning as targetExpression — under DISTINCT the break
      // has to group the deduplicated rows, so it groups by the wrapper's
      // column, not a fresh evaluation of the raw expression.
      if (select.distinct && !breakTargetAlias) {
        warnings.push(
          `Subtotals breaking on "${breakLabel}" were skipped: the column is hidden under SELECT DISTINCT and has no deduplicated value to break on`,
        );
        continue;
      }
      const breakExpr = select.distinct
        ? `${DISTINCT_TOTALS_ALIAS}.${quoteIdentifier(breakTargetAlias!)}`
        : info.sql;
      breakAlias = makeColumnAlias(breakLabel, taken);
      groupByExpr = breakExpr;
      selectParts.push(`${breakExpr} AS ${breakAlias}`);
    }

    const planned: GeneratedTotal[] = [];
    /** SELECT-list index and branch of each total, for the §1.6 suppression. */
    const placed: Array<{ index: number; branchId: string | null }> = [];
    const bucket = [...(byBreak.get(breakKey) ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );

    for (const total of bucket) {
      const target = targetExpression(total);
      if (!target) {
        warnings.push(
          `A ${total.kind === 'PERCENTAGE' ? 'percentage' : 'total'} was skipped: it points at a column this map does not use`,
        );
        continue;
      }

      let expr: string;
      let aggFunction: string;

      // Under DISTINCT, `target.sql` is already the wrapper's per-group
      // column (see targetExpression) — including for an aggregating item,
      // whose "group" there is only one row of what used to be the whole
      // table. It has to be wrapped in total.aggFunction like any other
      // target, or a value meant to be one grand-total row stays one row
      // per group instead.
      if (target.aggregates && !select.distinct) {
        expr = target.sql;
        aggFunction = 'INLINE';
      } else {
        const agg = (total.aggFunction ?? '').trim().toUpperCase();
        if (!agg) {
          warnings.push(
            `A ${total.kind === 'PERCENTAGE' ? 'percentage' : 'total'} on "${target.label}" was skipped: its Discoverer aggregate did not migrate`,
          );
          continue;
        }
        if (!AGGREGATE_FUNCTIONS.has(agg)) {
          warnings.push(
            `A total on "${target.label}" was skipped: unsupported aggregate "${agg}"`,
          );
          continue;
        }
        expr = `${agg}(${target.sql})`;
        aggFunction = agg;
      }

      const alias = makeColumnAlias(
        `${aggFunction === 'INLINE' ? 'TOTAL' : aggFunction}_${target.label}`,
        taken,
      );
      placed.push({
        index: selectParts.length,
        branchId: total.mapItemId ? branchOf(total.mapItemId) : null,
      });
      selectParts.push(`${expr} AS ${alias}`);
      planned.push({
        id: total.id,
        kind: total.kind,
        alias,
        targetAlias: target.alias,
        targetLabel: target.label,
        aggFunction,
        label: total.label ?? undefined,
        displayOrder: total.displayOrder,
      });
    }

    // A break whose every total was skipped would select nothing but the
    // break column — a list of values, not a total. Drop it.
    if (planned.length === 0) continue;

    // -- §1.6 / §1.11 step 9 --------------------------------------------
    // The second guard, at the presentation layer:
    //
    //   "If a worksheet displays values of items from both the master folder
    //    and the detail folder, Discoverer will not total the values
    //    together. Instead, Discoverer will display a null to prevent
    //    incorrect or unexpected results."
    //
    // Once a query is rewritten into branches, the rows behind two columns
    // can be at different grains. A number totalled across them would be
    // arithmetically meaningless, and the wrong number is the whole failure
    // mode this stage exists to prevent. So it renders NULL.
    const spanned = new Set(placed.map((p) => p.branchId).filter((b) => b !== null));
    if (spanned.size > 1) {
      // `placed` and `planned` are pushed in lockstep, so they index together.
      placed.forEach(({ index }, k) => {
        selectParts[index] = `NULL AS ${planned[k]!.alias}`;
        planned[k]!.aggFunction = 'SUPPRESSED';
      });
      warnings.push(
        breakLabel
          ? `Subtotals by "${breakLabel}" are shown blank: this worksheet totals columns that ` +
            'come from different sets of rows, and adding them together would give a wrong number.'
          : 'Totals are shown blank: this worksheet totals columns that come from different ' +
            'sets of rows, and adding them together would give a wrong number.',
      );
    }

    entries.push({
      breakAlias,
      breakLabel,
      breakTargetAlias,
      selectParts,
      groupByExpr,
      totals: planned,
    });
  }

  return { entries, warnings };
}
