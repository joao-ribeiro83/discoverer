import type { MapDefinition } from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import type { SelectClauseResult } from './select-clause.js';

export interface OrderByResult {
  /** "ORDER BY ..." or empty string when the map configures no sort. */
  sql: string;
  /**
   * Sorts the statement could not carry. The query still runs; the rows just
   * are not in that order. See `buildOrderByClause` for the two cases.
   */
  warnings: string[];
  /**
   * `map_items.id` of the group/break sorts, outermost first. A renderer draws
   * a break at each change in these columns, in this order, and `map_totals`
   * subtotals hang off the same list.
   */
  groupMapItemIds: string[];
}

/** Sort keys are compared as a tuple; a null slot sorts last. */
const LAST = Number.MAX_SAFE_INTEGER;

/**
 * Build the ORDER BY clause from the map items' sort configuration.
 *
 * Three rules, all of them Discoverer's:
 *
 * 1. **Group/break sorts lead.** `map_items.sort_group` is Discoverer's
 *    `IsABreak`: the sort that suppresses repeated values and gives a subtotal
 *    its boundary. A break only groups if nothing sorts outside it, so every
 *    group sort is emitted ahead of every plain sort regardless of the sort
 *    positions the two carry.
 * 2. **Rank outranks position.** `sort_rank` is Discoverer's
 *    `DCBImportedItemSort::GetRank`, an explicit precedence; `sort_order` is
 *    the position in the list. Rank wins where it is set, and it is null on
 *    every migrated map today (the `.DIS` reader does not yet decode it), so
 *    this reorders nothing that exists — it is what a UI writes when a user
 *    ranks sorts by hand.
 * 3. **Hidden items can still sort.** A migrated worksheet marks an item its
 *    query names but no column draws as `is_hidden`. Such a sort is real, so
 *    it is emitted by *expression* rather than by SELECT-list position, which
 *    a hidden item does not have.
 *
 * Visible columns are named by position (1-based) instead of by alias, which
 * sidesteps alias quoting and works for aggregated columns.
 *
 * Two shapes cannot carry a hidden item's sort, and both drop it with a
 * warning rather than emitting SQL Oracle rejects:
 *
 * - `SELECT DISTINCT` — ORA-01791: ORDER BY may name only selected columns.
 * - a grouped query — the expression is in neither the SELECT list nor the
 *   GROUP BY, and adding it to the GROUP BY would change the result's grain,
 *   which is a different report from the one the map asks for.
 */
export function buildOrderByClause(
  def: MapDefinition,
  ctx: GenerationContext,
  select: SelectClauseResult,
): OrderByResult {
  const warnings: string[] = [];

  const sorts = def.items
    .filter(({ mapItem }) => mapItem.sortDirection)
    .sort((a, b) => {
      const ga = a.mapItem.sortGroup ? 0 : 1;
      const gb = b.mapItem.sortGroup ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const ra = a.mapItem.sortRank ?? LAST;
      const rb = b.mapItem.sortRank ?? LAST;
      if (ra !== rb) return ra - rb;
      const oa = a.mapItem.sortOrder ?? LAST;
      const ob = b.mapItem.sortOrder ?? LAST;
      if (oa !== ob) return oa - ob;
      return a.mapItem.displayOrder - b.mapItem.displayOrder;
    });

  const parts: string[] = [];
  const groupMapItemIds: string[] = [];

  for (const { mapItem, item, folder } of sorts) {
    const position = select.positionByMapItemId.get(mapItem.id);

    if (position !== undefined) {
      parts.push(`${position} ${mapItem.sortDirection}`);
      if (mapItem.sortGroup) groupMapItemIds.push(mapItem.id);
      continue;
    }

    // Hidden: no position to name, so name the expression instead.
    const label = mapItem.displayName || item.name;
    if (select.distinct) {
      warnings.push(
        `Sort on hidden item "${label}" was dropped: SELECT DISTINCT can only order by selected columns`,
      );
      continue;
    }
    if (select.hasAggregates) {
      warnings.push(
        `Sort on hidden item "${label}" was dropped: an aggregated query cannot order by a column it neither selects nor groups by`,
      );
      continue;
    }

    parts.push(`${ctx.itemExpression(item, folder)} ${mapItem.sortDirection}`);
    if (mapItem.sortGroup) groupMapItemIds.push(mapItem.id);
  }

  return {
    sql: parts.length ? `ORDER BY ${parts.join(', ')}` : '',
    warnings,
    groupMapItemIds,
  };
}
