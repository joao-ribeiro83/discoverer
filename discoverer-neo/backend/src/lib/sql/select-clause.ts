import {
  SqlGenerationError,
  type GeneratedColumn,
  type MapDefinition,
} from '../../types/sql.js';
import type { GenerationContext } from './context.js';
import { makeColumnAlias } from './identifiers.js';
import { parseFormula, AGGREGATE_FUNCTIONS } from './formula-parser.js';

export interface SelectClauseResult {
  /** "SELECT expr AS ALIAS, ..." */
  sql: string;
  columns: GeneratedColumn[];
  /** Expressions of non-aggregate columns (used for GROUP BY). */
  nonAggregateExprs: string[];
  hasAggregates: boolean;
  /** True when the statement was emitted as `SELECT DISTINCT`. */
  distinct: boolean;
  /**
   * `map_items.id` → 1-based SELECT-list position, for the columns this clause
   * actually drew. ORDER BY names positions and a hidden item has no position
   * at all, so the two clauses share this map rather than each re-deriving it
   * from `display_order`.
   */
  positionByMapItemId: globalThis.Map<string, number>;
  /** `map_items.id` → the column alias drawn for it. */
  aliasByMapItemId: globalThis.Map<string, string>;
  /** `map_calculated_fields.id` → the column alias drawn for it. */
  aliasByCalcFieldId: globalThis.Map<string, string>;
}

/**
 * Build the SELECT list from the map's items (in display order) followed by
 * its calculated fields. Every column gets a safe generated alias.
 *
 * `maps.select_distinct` — Discoverer's query-request `Distinct` — emits
 * `SELECT DISTINCT`. It is a property of the query rather than of the drawing,
 * so it belongs here. The one clause it constrains is ORDER BY: Oracle then
 * accepts only SELECT-list columns there (ORA-01791).
 *
 * An item flagged `is_hidden` is not a column: it records that the report's
 * query names the item without drawing it — which is what a migrated
 * Discoverer worksheet does for an item only a calculation needs. It is left
 * out of the SELECT list, and so out of the GROUP BY the list feeds. Its
 * folder is still registered with the context, so it can take part in the
 * join path without adding a column nobody asked for.
 *
 * **`map_calculated_fields.is_hidden` means the same thing, and matters more.**
 * A Discoverer workbook writes every calculation into every worksheet section
 * that offers it, so most calculations are not on the sheet that carries them:
 * 38 436 of the corpus's 47 548. Drawing them all would not merely add columns
 * nobody asked for — a migrated formula is Discoverer's token text, not SQL,
 * so `parseFormula` throws on it and the whole map fails to generate. Skipping
 * the hidden ones is what makes a migrated map with calculations run at all;
 * only the calculations the worksheet actually displayed have to be rewritten
 * as SQL. A total may still name a hidden calculation — `totals.ts` resolves
 * it from the definition, not from this list.
 */
export function buildSelectClause(
  def: MapDefinition,
  ctx: GenerationContext,
): SelectClauseResult {
  const takenAliases = new Set<string>();
  const parts: string[] = [];
  const columns: GeneratedColumn[] = [];
  const nonAggregateExprs: string[] = [];
  const positionByMapItemId = new globalThis.Map<string, number>();
  const aliasByMapItemId = new globalThis.Map<string, string>();
  const aliasByCalcFieldId = new globalThis.Map<string, string>();
  let hasAggregates = false;

  const sortedItems = [...def.items]
    .filter(({ mapItem }) => !mapItem.isHidden)
    .sort((a, b) => a.mapItem.displayOrder - b.mapItem.displayOrder);

  const sortedCalcFields = [...def.calculatedFields]
    .filter((field) => !field.isHidden)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (sortedItems.length === 0 && sortedCalcFields.length === 0) {
    throw new SqlGenerationError('The map selects no columns');
  }

  for (const { mapItem, item, folder } of sortedItems) {
    let expr = ctx.itemExpression(item, folder);
    let isAggregate = false;

    // `items.agg_function` is the EUL item's *default* aggregation, which
    // Discoverer applies when the item is used as a measure. A column the
    // worksheet placed on the axis is a grouping column, so that default does
    // not apply to it — otherwise a migrated break column would arrive as
    // `SUM(REGION)`, and the group sort ORDER BY would sort an aggregate.
    // An aggregate set on the map item itself is a deliberate choice and still
    // wins; `axis_type` is null on every map authored in Neo, which therefore
    // behaves exactly as before.
    const defaultAgg = mapItem.axisType === 'AXIS' ? null : item.aggFunction;
    const agg = (mapItem.aggFunction ?? defaultAgg ?? '').trim().toUpperCase();
    if (agg && agg !== 'NONE' && agg !== 'DETAIL') {
      if (!AGGREGATE_FUNCTIONS.has(agg)) {
        throw new SqlGenerationError(
          `Unsupported aggregate function "${agg}" on item "${item.name}"`,
        );
      }
      expr = `${agg}(${expr})`;
      isAggregate = true;
      hasAggregates = true;
    }

    const label = mapItem.displayName || item.name;
    const alias = makeColumnAlias(label, takenAliases);
    parts.push(`${expr} AS ${alias}`);
    positionByMapItemId.set(mapItem.id, parts.length);
    aliasByMapItemId.set(mapItem.id, alias);
    // Presentation metadata rides along with the column so file exports can
    // format cells without re-deriving this ordering from the map definition.
    columns.push({
      alias,
      label,
      isAggregate,
      dataType: item.dataType ?? undefined,
      formatMask: mapItem.formatMask ?? undefined,
      columnWidth: mapItem.columnWidth ?? undefined,
      alignment: mapItem.alignment ?? undefined,
      wordWrap: mapItem.wordWrap ?? undefined,
      headingFormatMask: mapItem.headingFormatMask ?? undefined,
      axisType: mapItem.axisType ?? undefined,
      axisEdge: mapItem.axisEdge ?? undefined,
    });
    if (!isAggregate) nonAggregateExprs.push(expr);
  }

  for (const field of sortedCalcFields) {
    const parsed = parseFormula(field.formula, (name) =>
      ctx.resolveFormulaReference(name),
    );
    const isAggregate = parsed.containsAggregate;
    if (isAggregate) hasAggregates = true;

    const alias = makeColumnAlias(field.name, takenAliases);
    parts.push(`${parsed.sql} AS ${alias}`);
    aliasByCalcFieldId.set(field.id, alias);
    columns.push({ alias, label: field.name, isAggregate });
    if (!isAggregate) nonAggregateExprs.push(parsed.sql);
  }

  // Formulas may hide aggregates inside item expressions too.
  if (ctx.containsAggregate) hasAggregates = true;

  const distinct = def.map.selectDistinct === true;

  return {
    sql: `SELECT ${distinct ? 'DISTINCT ' : ''}${parts.join(',\n       ')}`,
    columns,
    nonAggregateExprs,
    hasAggregates,
    distinct,
    positionByMapItemId,
    aliasByMapItemId,
    aliasByCalcFieldId,
  };
}
