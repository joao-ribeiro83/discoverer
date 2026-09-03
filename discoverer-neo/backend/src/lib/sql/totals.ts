import type { MapTotal } from '../../db/schema.js';
import type { GeneratedTotal, MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { makeColumnAlias } from './identifiers.js';
import { parseFormula, AGGREGATE_FUNCTIONS } from './formula-parser.js';
import type { SelectClauseResult } from './select-clause.js';

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
): TotalsPlan {
  const warnings: string[] = [];
  const totals = def.totals ?? [];
  if (totals.length === 0) return { entries: [], warnings };

  const mapItemById = new globalThis.Map(
    def.items.map((entry) => [entry.mapItem.id, entry]),
  );
  const calcFieldById = new globalThis.Map(
    def.calculatedFields.map((field) => [field.id, field]),
  );

  /** The SQL for what a total measures, and whether it already aggregates. */
  function targetExpression(
    total: MapTotal,
  ): { sql: string; label: string; alias?: string; aggregates: boolean } | null {
    if (total.mapItemId) {
      const entry = mapItemById.get(total.mapItemId);
      if (!entry) return null;
      const info = ctx.itemExpressionInfo(entry.item, entry.folder);
      return {
        sql: info.sql,
        label: entry.mapItem.displayName || entry.item.name,
        alias: select.aliasByMapItemId.get(entry.mapItem.id),
        aggregates: info.containsAggregate,
      };
    }
    if (total.mapCalculatedFieldId) {
      const field = calcFieldById.get(total.mapCalculatedFieldId);
      if (!field) return null;
      const parsed = parseFormula(field.formula, (name) =>
        ctx.resolveFormulaReference(name),
      );
      return {
        sql: parsed.sql,
        label: field.name,
        alias: select.aliasByCalcFieldId.get(field.id),
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
      breakAlias = makeColumnAlias(breakLabel, taken);
      breakTargetAlias = select.aliasByMapItemId.get(entry.mapItem.id);
      groupByExpr = info.sql;
      selectParts.push(`${info.sql} AS ${breakAlias}`);
    }

    const planned: GeneratedTotal[] = [];
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

      if (target.aggregates) {
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
