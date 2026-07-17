import type { MapDefinition } from '../../types/sql.js';

/**
 * Build the ORDER BY clause from map item sort configuration. Columns are
 * referenced by SELECT-list position (1-based), which avoids alias-quoting
 * concerns and works with aggregated columns.
 *
 * Positions are computed against the SELECT list built by buildSelectClause:
 * map items ordered by displayOrder, then calculated fields.
 */
export function buildOrderByClause(def: MapDefinition): string {
  const sortedItems = [...def.items].sort(
    (a, b) => a.mapItem.displayOrder - b.mapItem.displayOrder,
  );

  const sortSpecs = sortedItems
    .map((entry, index) => ({ entry, position: index + 1 }))
    .filter(({ entry }) => entry.mapItem.sortDirection)
    .sort(
      (a, b) =>
        (a.entry.mapItem.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.entry.mapItem.sortOrder ?? Number.MAX_SAFE_INTEGER),
    );

  if (sortSpecs.length === 0) return '';

  const parts = sortSpecs.map(
    ({ entry, position }) => `${position} ${entry.mapItem.sortDirection}`,
  );
  return `ORDER BY ${parts.join(', ')}`;
}
