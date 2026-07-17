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
}

/**
 * Build the SELECT list from the map's items (in display order) followed by
 * its calculated fields. Every column gets a safe generated alias.
 */
export function buildSelectClause(
  def: MapDefinition,
  ctx: GenerationContext,
): SelectClauseResult {
  if (def.items.length === 0 && def.calculatedFields.length === 0) {
    throw new SqlGenerationError('The map selects no columns');
  }

  const takenAliases = new Set<string>();
  const parts: string[] = [];
  const columns: GeneratedColumn[] = [];
  const nonAggregateExprs: string[] = [];
  let hasAggregates = false;

  const sortedItems = [...def.items].sort(
    (a, b) => a.mapItem.displayOrder - b.mapItem.displayOrder,
  );

  for (const { mapItem, item, folder } of sortedItems) {
    let expr = ctx.itemExpression(item, folder);
    let isAggregate = false;

    const agg = (mapItem.aggFunction ?? item.aggFunction ?? '')
      .trim()
      .toUpperCase();
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
    // Presentation metadata rides along with the column so file exports can
    // format cells without re-deriving this ordering from the map definition.
    columns.push({
      alias,
      label,
      isAggregate,
      dataType: item.dataType ?? undefined,
      formatMask: mapItem.formatMask ?? undefined,
      columnWidth: mapItem.columnWidth ?? undefined,
    });
    if (!isAggregate) nonAggregateExprs.push(expr);
  }

  const sortedCalcFields = [...def.calculatedFields].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  for (const field of sortedCalcFields) {
    const parsed = parseFormula(field.formula, (name) =>
      ctx.resolveFormulaReference(name),
    );
    const isAggregate = parsed.containsAggregate;
    if (isAggregate) hasAggregates = true;

    const alias = makeColumnAlias(field.name, takenAliases);
    parts.push(`${parsed.sql} AS ${alias}`);
    columns.push({ alias, label: field.name, isAggregate });
    if (!isAggregate) nonAggregateExprs.push(parsed.sql);
  }

  // Formulas may hide aggregates inside item expressions too.
  if (ctx.containsAggregate) hasAggregates = true;

  return {
    sql: `SELECT ${parts.join(',\n       ')}`,
    columns,
    nonAggregateExprs,
    hasAggregates,
  };
}
