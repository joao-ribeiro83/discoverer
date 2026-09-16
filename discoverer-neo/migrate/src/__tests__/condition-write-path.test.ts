/**
 * D-072 — the fields a transformer produces must actually reach the database.
 *
 * `buildMapConditionRows` has always assigned `groupId`, and its unit tests
 * have always asserted it. It still never reached Postgres: the migrator's own
 * copy of the schema had no `group_id` column, and drizzle silently ignores a
 * key that matches no column. So all 5 605 migrated conditions landed with
 * `group_id = NULL` and their parenthesisation discarded — with green tests.
 *
 * Nothing on the current corpus reads wrong, because SQL's AND-binds-tighter
 * precedence happens to reproduce the only depth-2 shape measured. It is a
 * latent landmine for any AND-of-ORs.
 *
 * The check below is deliberately about the *shape*, not about `group_id`:
 * any future field a transformer emits and the table cannot hold fails here
 * rather than silently vanishing on insert.
 */

import { getTableColumns } from 'drizzle-orm';

import { mapConditions } from '../db/schema.js';
import { buildMapConditionRows } from '../services/transformers/transform.js';
import type { TransformedMapCondition } from '../services/transformers/types.js';

const condition = (
  overrides: Partial<TransformedMapCondition> = {},
): TransformedMapCondition => ({
  itemSourceId: 1,
  calculationElementId: null,
  folderLabel: 'F',
  itemLabel: 'A',
  operator: '=',
  value: 'x',
  paramName: null,
  conditionType: 'STATIC',
  displayOrder: 0,
  sourceText: 'A = x',
  sourceIndex: 0,
  groupKey: null,
  logicOperator: 'AND',
  caseSensitive: true,
  negated: false,
  ...overrides,
});

describe('map_conditions write path', () => {
  let counter = 0;
  const genId = (): string => `id-${(counter += 1)}`;
  beforeEach(() => {
    counter = 0;
  });

  it('has a group_id column to write into', () => {
    expect(Object.keys(getTableColumns(mapConditions))).toContain('groupId');
  });

  it('emits no field the table cannot store', () => {
    const { rows } = buildMapConditionRows(
      [
        condition({ groupKey: 'g0', displayOrder: 0 }),
        condition({ groupKey: 'g0', displayOrder: 1, logicOperator: 'OR' }),
      ],
      'map-1',
      () => 'item-1',
      genId,
      () => undefined,
    );

    const columns = new Set(Object.keys(getTableColumns(mapConditions)));
    for (const row of rows) {
      const orphaned = Object.keys(row).filter((key) => !columns.has(key));
      expect(orphaned).toEqual([]);
    }
  });

  it('carries a non-null group id through for a grouped condition', () => {
    const { rows } = buildMapConditionRows(
      [
        condition({ groupKey: 'g0', displayOrder: 0 }),
        condition({ groupKey: 'g0', displayOrder: 1, logicOperator: 'OR' }),
      ],
      'map-1',
      () => 'item-1',
      genId,
      () => undefined,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.groupId).not.toBeNull();
    expect(rows[0]?.groupId).toBe(rows[1]?.groupId);
  });

  it('points a condition on a calculation at the calculated field, not an item', () => {
    // ARCH M4 / the `map_conditions_reference_ck` constraint: exactly one of
    // the two references is set, so the item resolver must not be consulted.
    const { rows, skipped } = buildMapConditionRows(
      [condition({ itemSourceId: null, calculationElementId: 42, sourceText: 'RAMO Pag1 LIKE x' })],
      'map-1',
      () => {
        throw new Error('the item resolver must not be called for a calculation');
      },
      genId,
      (c) => (c.calculationElementId === 42 ? 'calc-1' : undefined),
    );

    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ itemId: null, calculatedFieldId: 'calc-1' });
  });

  it('drops the condition when the calculation it filters did not migrate', () => {
    const { rows, skipped } = buildMapConditionRows(
      [condition({ itemSourceId: null, calculationElementId: 42 })],
      'map-1',
      () => 'item-1',
      genId,
      () => undefined,
    );

    expect(rows).toEqual([]);
    expect(skipped[0]?.reason).toContain('calculation');
  });
});
