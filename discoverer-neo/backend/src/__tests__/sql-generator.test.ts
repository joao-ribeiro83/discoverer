import { describe, it, expect } from '@jest/globals';
import type {
  Folder,
  Item,
  Join,
  Map,
  MapCalculatedField,
  MapCondition,
  MapItem,
  MapParameter,
  MapTotal,
} from '../db/schema.js';
import type { MapDefinition } from '../types/sql.js';
import { Parser } from 'node-sql-parser';
import {
  explainSql,
  generateSql,
  validateSql,
  SqlGenerationError,
} from '../services/sql-generator.js';
import { validateFormula } from '../lib/sql/formula-parser.js';

// ---------------------------------------------------------------------------
// Fixture factories (pure — no database)
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-01T00:00:00Z');
let idCounter = 0;
const uid = () =>
  `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;

const BA_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function mkFolder(overrides: Partial<Folder> & { name: string }): Folder {
  return {
    id: uid(),
    businessAreaId: BA_ID,
    description: null,
    folderType: 'TABLE',
    tableName: overrides.name,
    tableOwner: 'APP',
    customSql: null,
    dataSourceId: null,
    displayOrder: 0,
    isActive: true,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkItem(
  folder: Folder,
  overrides: Partial<Item> & { name: string },
): Item {
  return {
    id: uid(),
    folderId: folder.id,
    description: null,
    itemType: 'CI',
    columnName: overrides.name.toUpperCase().replace(/\s+/g, '_'),
    formula: null,
    dataType: 'VARCHAR2',
    formatMask: null,
    aggFunction: null,
    displayOrder: 0,
    isHidden: false,
    isActive: true,
    parentItemId: null,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkMap(overrides: Partial<Map> = {}): Map {
  return {
    id: uid(),
    name: 'Test Map',
    description: null,
    mapType: 'TABLE',
    businessAreaId: BA_ID,
    createdBy: USER_ID,
    isPublic: false,
    isActive: true,
    selectDistinct: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkMapItem(
  item: Item,
  overrides: Partial<MapItem> = {},
): MapItem {
  return {
    id: uid(),
    mapId: 'unused',
    itemId: item.id,
    displayOrder: 0,
    displayName: null,
    formatMask: null,
    aggFunction: null,
    sortDirection: null,
    sortOrder: null,
    columnWidth: null,
    axisType: null,
    axisEdge: null,
    axisOrder: null,
    isHidden: false,
    dataType: null,
    headingFormatMask: null,
    alignment: null,
    wordWrap: null,
    sortRank: null,
    sortGroup: false,
    sourceElementId: null,
    sourceAttrs: null,
    createdAt: NOW,
    ...overrides,
  };
}

function mkCondition(
  item: Item,
  overrides: Partial<MapCondition> = {},
): MapCondition {
  return {
    id: uid(),
    mapId: 'unused',
    itemId: item.id,
    operator: '=',
    value: null,
    paramName: null,
    conditionType: 'STATIC',
    groupId: null,
    logicOperator: 'AND',
    displayOrder: 0,
    createdAt: NOW,
    ...overrides,
  };
}

function mkParameter(
  overrides: Partial<MapParameter> & { name: string },
): MapParameter {
  return {
    id: uid(),
    mapId: 'unused',
    // Most fixtures here use names that are already bind-safe, so the prompt
    // and the bind name coincide. A test about the difference sets both.
    bindName: overrides.name,
    paramType: 'STRING',
    defaultValue: null,
    isRequired: false,
    createdAt: NOW,
    ...overrides,
  };
}

function mkCalcField(
  overrides: Partial<MapCalculatedField> & { name: string; formula: string },
): MapCalculatedField {
  return {
    id: uid(),
    mapId: 'unused',
    displayOrder: 0,
    description: null,
    dataType: null,
    axisType: null,
    formatMask: null,
    isHidden: false,
    sourceIdentifier: null,
    sourceElementId: null,
    sourceAttrs: null,
    createdAt: NOW,
    ...overrides,
  };
}

function mkTotal(overrides: Partial<MapTotal> = {}): MapTotal {
  return {
    id: uid(),
    mapId: 'unused',
    kind: 'TOTAL',
    mapItemId: null,
    mapCalculatedFieldId: null,
    breakMapItemId: null,
    aggFunction: 'SUM',
    placement: 'GRAND_TOTAL',
    label: null,
    displayOrder: 0,
    sourceElementId: null,
    sourceAttrs: null,
    createdAt: NOW,
    ...overrides,
  };
}

function mkJoin(
  leftFolder: Folder,
  leftItem: Item,
  rightFolder: Folder,
  rightItem: Item,
  joinType: Join['joinType'] = 'INNER',
): MapDefinition['joins'][number] {
  return {
    join: {
      id: uid(),
      name: `${leftFolder.name}_${rightFolder.name}`,
      leftFolderId: leftFolder.id,
      rightFolderId: rightFolder.id,
      leftItemId: leftItem.id,
      rightItemId: rightItem.id,
      joinType,
      isActive: true,
      createdAt: NOW,
    },
    leftItem,
    rightItem,
    leftFolder,
    rightFolder,
  };
}

// Shared fixture: SALES and CUSTOMERS folders with a join.
function salesFixture() {
  const sales = mkFolder({ name: 'SALES' });
  const customers = mkFolder({ name: 'CUSTOMERS' });

  const region = mkItem(sales, { name: 'Region', columnName: 'REGION' });
  const amount = mkItem(sales, {
    name: 'Amount',
    columnName: 'AMOUNT',
    dataType: 'NUMBER',
  });
  const orderDate = mkItem(sales, {
    name: 'Order Date',
    columnName: 'ORDER_DATE',
    dataType: 'DATE',
  });
  const custIdSales = mkItem(sales, {
    name: 'Customer Id',
    columnName: 'CUSTOMER_ID',
    dataType: 'NUMBER',
  });
  const custIdCustomers = mkItem(customers, {
    name: 'Customer Key',
    columnName: 'CUSTOMER_ID',
    dataType: 'NUMBER',
  });
  const custName = mkItem(customers, {
    name: 'Customer Name',
    columnName: 'CUSTOMER_NAME',
  });

  const allItems = [
    region,
    amount,
    orderDate,
    custIdSales,
    custIdCustomers,
    custName,
  ];
  const folderOf = (i: Item) => (i.folderId === sales.id ? sales : customers);

  return {
    sales,
    customers,
    region,
    amount,
    orderDate,
    custIdSales,
    custIdCustomers,
    custName,
    join: mkJoin(sales, custIdSales, customers, custIdCustomers),
    formulaItems: allItems.map((item) => ({ item, folder: folderOf(item) })),
  };
}

function mkDef(partial: Partial<MapDefinition>): MapDefinition {
  return {
    map: mkMap(),
    items: [],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    joins: [],
    formulaItems: [],
    ...partial,
  };
}

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SQL generator', () => {
  describe('simple selects', () => {
    it('generates a single-folder SELECT', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, { displayOrder: 1 }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toBe(
        'SELECT f1."REGION" AS REGION, f1."AMOUNT" AS AMOUNT FROM "APP"."SALES" f1',
      );
      expect(result.bindParams).toEqual({});
      expect(result.hasAggregates).toBe(false);
      expect(result.columns.map((c) => c.alias)).toEqual(['REGION', 'AMOUNT']);
    });

    it('uses display names for aliases and dedupes collisions', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, { displayName: 'The Value!' }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              displayName: 'The Value!',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.columns[0]!.alias).toBe('THE_VALUE');
      expect(result.columns[1]!.alias).toBe('THE_VALUE_2');
    });
  });

  describe('hidden map items', () => {
    // `map_items.is_hidden` records an item the report's query names without
    // drawing — what a migrated Discoverer worksheet does for an item only a
    // calculation needs. It is not a column, so it is not in the SELECT list.
    it('leaves a hidden item out of the SELECT list', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, { displayOrder: 1, isHidden: true }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.columns.map((c) => c.label)).toEqual(['Region']);
      expect(norm(result.sql)).not.toContain('AMOUNT');
    });

    it('does not put a hidden item into the GROUP BY either', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, { displayOrder: 1, aggFunction: 'SUM' }),
            item: f.amount,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.orderDate, { displayOrder: 2, isHidden: true }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('GROUP BY');
      expect(norm(result.sql)).not.toContain('ORDER_DATE');
    });

    // A Discoverer workbook writes every calculation into every worksheet
    // section that offers it, so most arrive hidden. Their formula is
    // Discoverer token text, not SQL, so drawing them does not just add
    // columns — it makes the map fail to generate at all.
    it('leaves a hidden calculated field out of the SELECT list', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({ name: 'Shown', formula: 'AMOUNT * 2' }),
          mkCalcField({
            name: 'Offered Elsewhere',
            formula: 'AMOUNT * 3',
            displayOrder: 1,
            isHidden: true,
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.columns.map((c) => c.label)).toEqual(['Region', 'Shown']);
      expect(norm(result.sql)).not.toContain('* 3');
    });

    it('does not parse a hidden calculated field at all', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          // Discoverer's own token text, which is not SQL and would throw.
          mkCalcField({
            name: 'Discoverer Tokens',
            formula: '@AGG(0x1f) &item ??',
            isHidden: true,
          }),
        ],
        formulaItems: f.formulaItems,
      });

      expect(() => generateSql(def)).not.toThrow();
      expect(generateSql(def).columns.map((c) => c.label)).toEqual(['Region']);
    });

    it('refuses a map whose only calculated field is hidden', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [],
        calculatedFields: [
          mkCalcField({ name: 'Hidden', formula: '1', isHidden: true }),
        ],
        formulaItems: f.formulaItems,
      });

      expect(() => generateSql(def)).toThrow('The map selects no columns');
    });

    it('refuses a map whose only items are hidden', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, { isHidden: true }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      expect(() => generateSql(def)).toThrow('The map selects no columns');
    });
  });

  describe('joins', () => {
    it('joins two folders through join metadata', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 1 }),
            item: f.custName,
            folder: f.customers,
          },
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain(
        'FROM "APP"."SALES" f1 INNER JOIN "APP"."CUSTOMERS" f2 ON f1."CUSTOMER_ID" = f2."CUSTOMER_ID"',
      );
    });

    it('flips LEFT joins when traversed from the right side', () => {
      const f = salesFixture();
      // Join defined CUSTOMERS (left) → SALES (right) as LEFT, but the query
      // starts from SALES, so it must emit RIGHT OUTER JOIN.
      const reversed = mkJoin(
        f.customers,
        f.custIdCustomers,
        f.sales,
        f.custIdSales,
        'LEFT',
      );
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 1 }),
            item: f.custName,
            folder: f.customers,
          },
        ],
        joins: [reversed],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.sql).toContain('RIGHT OUTER JOIN');
    });

    it('fails when folders are not connected by any join', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 1 }),
            item: f.custName,
            folder: f.customers,
          },
        ],
        joins: [],
        formulaItems: f.formulaItems,
      });

      expect(() => generateSql(def)).toThrow(SqlGenerationError);
      expect(() => generateSql(def)).toThrow(/join path/i);
    });
  });

  describe('aggregation', () => {
    it('wraps aggregated items and groups by the rest', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              aggFunction: 'SUM',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.hasAggregates).toBe(true);
      expect(norm(result.sql)).toContain('SUM(f1."AMOUNT") AS AMOUNT');
      expect(norm(result.sql)).toContain('GROUP BY f1."REGION"');
    });

    it('rejects unknown aggregate functions', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.amount, { aggFunction: 'EXPLODE' }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(/unsupported aggregate/i);
    });
  });

  describe('conditions', () => {
    it('binds static values for comparison operators', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'EMEA',
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.amount, {
              operator: '>=',
              value: '100',
              displayOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain(
        'WHERE f1."REGION" = :c0 AND f1."AMOUNT" >= :c1',
      );
      expect(result.bindParams).toEqual({ c0: 'EMEA', c1: 100 });
    });

    it('expands static IN lists into one bind per value', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'IN',
              value: 'EMEA, APAC ,AMER',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('IN (:c0_0, :c0_1, :c0_2)');
      expect(result.bindParams).toEqual({
        c0_0: 'EMEA',
        c0_1: 'APAC',
        c0_2: 'AMER',
      });
    });

    it('renders BETWEEN with two binds and IS_NULL with none', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.amount, {
              operator: 'BETWEEN',
              value: '10,20',
            }),
            item: f.amount,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.region, {
              operator: 'IS_NULL',
              displayOrder: 1,
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('BETWEEN :c0_lo AND :c0_hi');
      expect(norm(result.sql)).toContain('f1."REGION" IS NULL');
      expect(result.bindParams).toEqual({ c0_lo: 10, c0_hi: 20 });
    });

    it('groups conditions and honors OR logic', () => {
      const f = salesFixture();
      const groupId = '33333333-3333-4333-8333-333333333333';
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'EMEA',
              groupId,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'APAC',
              groupId,
              logicOperator: 'OR',
              displayOrder: 1,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.amount, {
              operator: '>',
              value: '0',
              displayOrder: 2,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain(
        'WHERE (f1."REGION" = :c0 OR f1."REGION" = :c1) AND f1."AMOUNT" > :c2',
      );
    });

    it('keeps injection attempts inside bind values, never in SQL text', () => {
      const f = salesFixture();
      const hostile = "x'; DROP TABLE users; --";
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: hostile,
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.sql).not.toContain('DROP TABLE');
      expect(result.bindParams.c0).toBe(hostile);
      expect(validateSql(result.sql).valid).toBe(true);
    });
  });

  describe('parameters', () => {
    it('binds parameter conditions by parameter name', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              conditionType: 'PARAMETER',
              paramName: 'p_region',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_region' })],
        formulaItems: f.formulaItems,
      });

      const withValue = generateSql(def, {
        parameterValues: { p_region: 'EMEA' },
      });
      expect(norm(withValue.sql)).toContain('f1."REGION" = :p_region');
      expect(withValue.bindParams.p_region).toBe('EMEA');

      const withoutValue = generateSql(def);
      expect(norm(withoutValue.sql)).toContain('f1."REGION" = :p_region');
      expect('p_region' in withoutValue.bindParams).toBe(false);
    });

    // Discoverer let an author call a prompt anything, and a migrated EUL is
    // full of names Oracle will not accept after a colon. Binding the prompt
    // verbatim threw, so the map could not run at all; what binds is the
    // parameter's derived bind name, and the prompt survives only as the label
    // an error message uses.
    it('binds a prompt whose name could never be a bind variable', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              conditionType: 'PARAMETER',
              paramName: 'DT_FIM_VIG_NCIA',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        parameters: [
          mkParameter({ name: 'Dt Fim Vigência >=', bindName: 'DT_FIM_VIG_NCIA' }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        parameterValues: { DT_FIM_VIG_NCIA: '2024-01-01' },
      });
      expect(norm(result.sql)).toContain('f1."REGION" = :DT_FIM_VIG_NCIA');
      expect(result.bindParams.DT_FIM_VIG_NCIA).toBe('2024-01-01');
      // The prompt itself never reaches the SQL text.
      expect(result.sql).not.toContain('Vigência');
    });

    it('names the prompt, not the bind name, when a BETWEEN is under-supplied', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'BETWEEN',
              conditionType: 'PARAMETER',
              paramName: 'DT_FIM_VIG_NCIA',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        parameters: [
          mkParameter({ name: 'Dt Fim Vigência >=', bindName: 'DT_FIM_VIG_NCIA' }),
        ],
        formulaItems: f.formulaItems,
      });

      expect(() =>
        generateSql(def, { parameterValues: { DT_FIM_VIG_NCIA: 'only-one' } }),
      ).toThrow(/"Dt Fim Vigência >=" must supply two values/);
    });

    it('expands LIST parameters into IN binds', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'IN',
              conditionType: 'PARAMETER',
              paramName: 'p_regions',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_regions', paramType: 'LIST' })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        parameterValues: { p_regions: ['EMEA', 'APAC'] },
      });
      expect(norm(result.sql)).toContain('IN (:p_regions_0, :p_regions_1)');
      expect(result.bindParams).toEqual({
        p_regions_0: 'EMEA',
        p_regions_1: 'APAC',
      });
    });

    it('wraps DATE operands in TO_DATE', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.orderDate),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        conditions: [
          {
            condition: mkCondition(f.orderDate, {
              operator: '>=',
              conditionType: 'PARAMETER',
              paramName: 'p_from',
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_from', paramType: 'DATE' })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        parameterValues: { p_from: '2026-01-01' },
      });
      expect(result.sql).toContain("TO_DATE(:p_from, 'YYYY-MM-DD')");
    });
  });

  describe('calculated fields', () => {
    it('compiles arithmetic formulas into the SELECT list', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({ name: 'Doubled', formula: 'AMOUNT * 2' }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('f1."AMOUNT" * 2 AS DOUBLED');
      expect(result.columns.map((c) => c.alias)).toEqual([
        'AMOUNT',
        'DOUBLED',
      ]);
    });

    it('resolves bracketed item references and functions', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({
            name: 'Label',
            formula: "UPPER([Region]) || '-' || TO_CHAR(SYSDATE, 'YYYY')",
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.sql).toContain('UPPER(f1."REGION")');
      expect(result.sql).toContain("TO_CHAR(SYSDATE, 'YYYY')");
    });

    it('aggregate formulas participate in GROUP BY handling', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({ name: 'Total', formula: 'SUM([Amount])' }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.hasAggregates).toBe(true);
      expect(norm(result.sql)).toContain('GROUP BY f1."REGION"');
    });

    it('rejects disallowed functions', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({
            name: 'Evil',
            formula: "DBMS_LOB.SUBSTR(REGION, 1, 1)",
          }),
        ],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(/not allowed|Unexpected/i);
    });

    it('rejects unknown item references', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({ name: 'Bad', formula: '[No Such Item] + 1' }),
        ],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(/unknown item/i);
    });

    it('escapes string literals inside formulas', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({
            name: 'Quoted',
            formula: "REGION || 'it''s'",
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.sql).toContain("'it''s'");
    });

    it('supports CASE expressions', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({
            name: 'Band',
            formula:
              "CASE WHEN AMOUNT > 100 THEN 'BIG' WHEN AMOUNT > 10 THEN 'MID' ELSE 'SMALL' END",
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.sql).toContain(
        "CASE WHEN f1.\"AMOUNT\" > 100 THEN 'BIG' WHEN f1.\"AMOUNT\" > 10 THEN 'MID' ELSE 'SMALL' END",
      );
    });
  });

  describe('sorting and pagination', () => {
    it('orders by SELECT positions with configured direction', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, {
              sortDirection: 'ASC',
              sortOrder: 2,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY 2 DESC, 1 ASC');
    });

    // A migrated Discoverer worksheet writes an item its query named but no
    // column drew as `is_hidden`. ORDER BY names SELECT-list positions, so a
    // hidden item ahead of a sorted one must not shift them.
    it('numbers ORDER BY positions over the visible columns only', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.orderDate, { displayOrder: 0, isHidden: true }),
            item: f.orderDate,
            folder: f.sales,
          },
          { mapItem: mkMapItem(f.region, { displayOrder: 1 }), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 2,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      // Amount is the second visible column, not the third item.
      expect(norm(result.sql)).toContain('ORDER BY 2 DESC');
    });

    it('adds OFFSET/FETCH with bind variables', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, { rowLimit: 100, offset: 200 });
      expect(norm(result.sql)).toContain(
        'OFFSET :row_offset ROWS FETCH NEXT :row_limit ROWS ONLY',
      );
      expect(result.bindParams.row_offset).toBe(200);
      expect(result.bindParams.row_limit).toBe(100);
    });
  });

  describe('security predicates', () => {
    it('ANDs row-level security predicates into WHERE', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, { operator: '=', value: 'EMEA' }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        securityPredicates: ["f1.\"REGION\" = 'EMEA'"],
      });
      expect(norm(result.sql)).toContain("AND (f1.\"REGION\" = 'EMEA')");
    });

    it('renders an OR of two ANDs — the shape a migrated compound produces', () => {
      // `(region = EMEA AND amount > 0) OR (region = APAC AND amount > 100)`.
      // The migration writes exactly this: one group per conjunction, the
      // second group's *first* row carrying the OR that joins the groups and
      // its later rows carrying the AND that joins inside.
      const f = salesFixture();
      const groupA = '11111111-1111-4111-8111-111111111111';
      const groupB = '22222222-2222-4222-8222-222222222222';
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'EMEA',
              groupId: groupA,
              logicOperator: 'AND',
              displayOrder: 0,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.amount, {
              operator: '>',
              value: '0',
              groupId: groupA,
              logicOperator: 'AND',
              displayOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'APAC',
              groupId: groupB,
              logicOperator: 'OR',
              displayOrder: 2,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.amount, {
              operator: '>',
              value: '100',
              groupId: groupB,
              logicOperator: 'AND',
              displayOrder: 3,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      // The outer brackets are unconditional once anything is ORed on, rather
      // than appearing only when a security predicate follows: the shape of
      // the WHERE clause should not depend on who is running the query.
      const result = generateSql(def);
      expect(norm(result.sql)).toContain(
        'WHERE ((f1."REGION" = :c0 AND f1."AMOUNT" > :c1) ' +
          'OR (f1."REGION" = :c2 AND f1."AMOUNT" > :c3))',
      );
    });

    it('brackets ORed conditions so a security predicate constrains all of them', () => {
      // `a OR b AND <security>` is `a OR (b AND <security>)` in SQL: every row
      // matching `a` would come back regardless of the security rule. Migrated
      // Discoverer conditions can be ORs, so this has to hold.
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, { operator: '=', value: 'EMEA' }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.region, {
              operator: '=',
              value: 'APAC',
              logicOperator: 'OR',
              displayOrder: 1,
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        securityPredicates: ['f1."AMOUNT" > 0'],
      });
      expect(norm(result.sql)).toContain(
        'WHERE (f1."REGION" = :c0 OR f1."REGION" = :c1) AND (f1."AMOUNT" > 0)',
      );
    });

    it('leaves an all-AND condition block unbracketed', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, { operator: '=', value: 'EMEA' }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.amount, {
              operator: '>',
              value: '0',
              displayOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, { securityPredicates: ['1 = 1'] });
      expect(norm(result.sql)).toContain(
        'WHERE f1."REGION" = :c0 AND f1."AMOUNT" > :c1 AND (1 = 1)',
      );
    });

    it('rejects predicates containing statement separators', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        formulaItems: f.formulaItems,
      });
      expect(() =>
        generateSql(def, { securityPredicates: ['1=1; DROP TABLE x'] }),
      ).toThrow(/statement separators/i);
    });
  });

  describe('COMPLEX folders', () => {
    it('inlines custom SQL as a derived table', () => {
      const complex = mkFolder({
        name: 'SALES_SUMMARY',
        folderType: 'COMPLEX',
        tableName: null,
        customSql: 'SELECT region r, SUM(amount) total FROM sales GROUP BY region',
      });
      const r = mkItem(complex, { name: 'R', columnName: 'R' });
      const def = mkDef({
        items: [{ mapItem: mkMapItem(r), item: r, folder: complex }],
        formulaItems: [{ item: r, folder: complex }],
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain(
        'FROM (SELECT region r, SUM(amount) total FROM sales GROUP BY region) f1',
      );
    });

    it('rejects COMPLEX folders whose SQL is not a single SELECT', () => {
      const complex = mkFolder({
        name: 'EVIL',
        folderType: 'COMPLEX',
        tableName: null,
        customSql: 'DELETE FROM users',
      });
      const r = mkItem(complex, { name: 'R', columnName: 'R' });
      const def = mkDef({
        items: [{ mapItem: mkMapItem(r), item: r, folder: complex }],
        formulaItems: [{ item: r, folder: complex }],
      });
      expect(() => generateSql(def)).toThrow(/must be a SELECT/i);
    });
  });

  describe('complex end-to-end query', () => {
    it('combines joins, aggregation, conditions, parameters, calc fields, sort, and pagination', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 0 }),
            item: f.custName,
            folder: f.customers,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              displayName: 'Total Amount',
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'IN',
              conditionType: 'PARAMETER',
              paramName: 'p_regions',
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.orderDate, {
              operator: '>=',
              conditionType: 'PARAMETER',
              paramName: 'p_from',
              displayOrder: 1,
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        parameters: [
          mkParameter({ name: 'p_regions', paramType: 'LIST' }),
          mkParameter({ name: 'p_from', paramType: 'DATE' }),
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        parameterValues: { p_regions: 'EMEA,APAC', p_from: '2026-01-01' },
        rowLimit: 50,
      });

      const sql = norm(result.sql);
      expect(sql).toContain('f2."AMOUNT" AS TOTAL_AMOUNT');
      expect(sql).toContain('INNER JOIN');
      expect(sql).toContain('IN (:p_regions_0, :p_regions_1)');
      expect(sql).toContain("TO_DATE(:p_from, 'YYYY-MM-DD')");
      expect(sql).toContain('ORDER BY 2 DESC');
      expect(sql).toContain('FETCH NEXT :row_limit ROWS ONLY');
      expect(result.bindParams).toEqual({
        p_regions_0: 'EMEA',
        p_regions_1: 'APAC',
        p_from: '2026-01-01',
        row_limit: 50,
      });
      expect(result.hasAggregates).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Interim multi-folder aggregate refusal (D-014)
  //
  // Deleted in Phase 3.4, when the fan-trap planner lands. Until then a flat
  // inner join across a master/detail pair would multiply every master measure
  // by its detail count, so the generator refuses rather than return a wrong
  // number that looks right.
  // -------------------------------------------------------------------------
  describe('multi-folder aggregate refusal', () => {
    function multiFolderDef(aggregating: boolean) {
      const f = salesFixture();
      return mkDef({
        items: [
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 0 }),
            item: f.custName,
            folder: f.customers,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              aggFunction: aggregating ? 'SUM' : null,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });
    }

    it('refuses a multi-folder aggregate map, naming the folders', () => {
      expect(() => generateSql(multiFolderDef(true))).toThrow(
        SqlGenerationError,
      );
      expect(() => generateSql(multiFolderDef(true))).toThrow(
        /Multi-folder aggregate queries are refused[\s\S]*Folders:[\s\S]*CUSTOMERS[\s\S]*SALES/,
      );
    });

    it('refuses when the aggregate is hidden inside a calculated field', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.custName),
            item: f.custName,
            folder: f.customers,
          },
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({ name: 'Avg Amount', formula: 'AVG([Amount])' }),
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(
        /Multi-folder aggregate queries are refused/,
      );
    });

    it('leaves a multi-folder NON-aggregate map alone', () => {
      const result = generateSql(multiFolderDef(false));
      expect(norm(result.sql)).toContain('INNER JOIN');
      expect(result.hasAggregates).toBe(false);
    });

    it('leaves a single-folder aggregate map alone', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, { displayOrder: 0 }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              aggFunction: 'SUM',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });
      const result = generateSql(def);
      expect(norm(result.sql)).toContain('SUM(f1."AMOUNT")');
      expect(result.hasAggregates).toBe(true);
    });
  });

  describe('validateSql / validateFormula', () => {
    it('accepts generated SELECTs and rejects other statements', () => {
      expect(validateSql('SELECT 1 FROM DUAL').valid).toBe(true);
      expect(validateSql('DROP TABLE users').valid).toBe(false);
      expect(validateSql('SELECT 1; DELETE FROM t').valid).toBe(false);
    });

    it('validateFormula reports syntax errors without throwing', () => {
      const resolver = (name: string) =>
        name.toUpperCase() === 'AMOUNT' ? 'f1."AMOUNT"' : null;
      expect(validateFormula('AMOUNT * 2', resolver).valid).toBe(true);
      expect(validateFormula('AMOUNT +', resolver).valid).toBe(false);
      expect(validateFormula('SELECT * FROM users', resolver).valid).toBe(
        false,
      );
    });
  });

  describe('circular formulas', () => {
    it('detects circular item formula references', () => {
      const folder = mkFolder({ name: 'T' });
      const a = mkItem(folder, {
        name: 'A',
        columnName: null,
        formula: 'B + 1',
        itemType: 'CU',
      });
      const b = mkItem(folder, {
        name: 'B',
        columnName: null,
        formula: 'A + 1',
        itemType: 'CU',
      });
      const def = mkDef({
        items: [{ mapItem: mkMapItem(a), item: a, folder }],
        formulaItems: [
          { item: a, folder },
          { item: b, folder },
        ],
      });
      expect(() => generateSql(def)).toThrow(/circular/i);
    });
  });

  describe('explainSql', () => {
    it('wraps a query in EXPLAIN PLAN plus a DBMS_XPLAN read', () => {
      const plan = explainSql('SELECT 1 FROM DUAL', 'MY_STMT_1');
      expect(plan.statementId).toBe('MY_STMT_1');
      expect(plan.explainStatement).toBe(
        "EXPLAIN PLAN SET STATEMENT_ID = 'MY_STMT_1' FOR\nSELECT 1 FROM DUAL",
      );
      expect(plan.planQuery).toContain("DBMS_XPLAN.DISPLAY(NULL, 'MY_STMT_1'");
    });

    it('refuses non-SELECT statements and unsafe statement ids', () => {
      expect(() => explainSql('DROP TABLE users')).toThrow(SqlGenerationError);
      expect(() => explainSql('SELECT 1 FROM DUAL', "x'; DROP--")).toThrow(
        SqlGenerationError,
      );
      expect(() =>
        explainSql('SELECT 1 FROM DUAL', 'A'.repeat(31)),
      ).toThrow(SqlGenerationError);
    });
  });

  describe('syntactic validation with node-sql-parser', () => {
    // node-sql-parser has no Oracle dialect; DB2 is the closest match
    // (double-quoted identifiers, || concatenation, OFFSET/FETCH pagination).
    // Bind placeholders are replaced with literals before parsing — safe here
    // because the generator never emits ':' inside string literals (the only
    // literal it produces is the TO_DATE format 'YYYY-MM-DD').
    const parser = new Parser();
    const expectParsable = (sql: string) => {
      const substituted = sql.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '1');
      expect(() => parser.astify(substituted, { database: 'db2' })).not.toThrow();
    };

    it('simple single-folder SELECT parses', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
      });
      expectParsable(generateSql(def).sql);
    });

    it.each(['INNER', 'LEFT', 'RIGHT', 'FULL'] as const)(
      '%s join query parses',
      (joinType) => {
        const f = salesFixture();
        const def = mkDef({
          items: [
            {
              mapItem: mkMapItem(f.custName),
              item: f.custName,
              folder: f.customers,
            },
            { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
          ],
          joins: [
            mkJoin(f.sales, f.custIdSales, f.customers, f.custIdCustomers, joinType),
          ],
        });
        expectParsable(generateSql(def).sql);
      },
    );

    it('complex query (joins + conditions + params + sort + pagination) parses', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.custName, { displayOrder: 0 }),
            item: f.custName,
            folder: f.customers,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              displayName: 'Total Amount',
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'IN',
              conditionType: 'PARAMETER',
              paramName: 'p_regions',
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            condition: mkCondition(f.orderDate, {
              operator: 'BETWEEN',
              value: '2026-01-01,2026-12-31',
              displayOrder: 1,
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_regions', paramType: 'LIST' })],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });
      const result = generateSql(def, {
        parameterValues: { p_regions: 'EMEA,APAC' },
        rowLimit: 50,
        offset: 100,
      });
      expectParsable(result.sql);
    });

    it('CASE-expression calculated field parses', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        calculatedFields: [
          mkCalcField({
            name: 'Size',
            formula: "CASE WHEN [Amount] > 1000 THEN 'BIG' ELSE 'SMALL' END",
          }),
        ],
        formulaItems: f.formulaItems,
      });
      expectParsable(generateSql(def).sql);
    });
  });

  // -------------------------------------------------------------------------
  // Condition edge cases (WHERE-clause error/parameter branches)
  // -------------------------------------------------------------------------
  describe('condition edge cases', () => {
    function withCondition(overrides: Partial<MapCondition>, extra: Partial<MapDefinition> = {}) {
      const f = salesFixture();
      const item = overrides.itemId ? f.amount : f.region;
      return mkDef({
        items: [{ mapItem: mkMapItem(f.region), item: f.region, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(item, overrides),
            item,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
        ...extra,
      });
    }

    it('throws when a STATIC condition has no value', () => {
      const def = withCondition({ operator: '=', value: null });
      expect(() => generateSql(def)).toThrow(/has no value/);
    });

    it('throws when STATIC BETWEEN does not supply two values', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.amount, { operator: 'BETWEEN', value: '10' }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(/two comma-separated values/);
    });

    it('throws when a numeric column gets a non-numeric static value', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.amount, { operator: '=', value: 'not-a-number' }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });
      expect(() => generateSql(def)).toThrow(/not a valid number/);
    });

    it('throws when a PARAMETER condition has no paramName', () => {
      const def = withCondition({
        operator: '=',
        conditionType: 'PARAMETER',
        paramName: null,
      });
      expect(() => generateSql(def)).toThrow(/has no paramName/);
    });

    it('renders a PARAMETER BETWEEN with lo/hi binds', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.amount, {
              operator: 'BETWEEN',
              conditionType: 'PARAMETER',
              paramName: 'p_range',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_range' })],
        formulaItems: f.formulaItems,
      });
      const result = generateSql(def, { parameterValues: { p_range: '10,20' } });
      expect(norm(result.sql)).toContain('BETWEEN :p_range_lo AND :p_range_hi');
      expect(result.bindParams.p_range_lo).toBe('10');
      expect(result.bindParams.p_range_hi).toBe('20');
    });

    it('throws when a PARAMETER BETWEEN supplies the wrong number of values', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.amount, {
              operator: 'BETWEEN',
              conditionType: 'PARAMETER',
              paramName: 'p_range',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_range' })],
        formulaItems: f.formulaItems,
      });
      expect(() =>
        generateSql(def, { parameterValues: { p_range: '10,20,30' } }),
      ).toThrow(/two values for BETWEEN/);
    });

    it('emits a single IN placeholder for a non-LIST parameter', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.region), item: f.region, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.region, {
              operator: 'IN',
              conditionType: 'PARAMETER',
              paramName: 'p_region',
            }),
            item: f.region,
            folder: f.sales,
          },
        ],
        parameters: [mkParameter({ name: 'p_region' })],
        formulaItems: f.formulaItems,
      });
      const result = generateSql(def, { parameterValues: { p_region: 'EMEA' } });
      expect(norm(result.sql)).toContain('IN (:p_region)');
    });
  });

  // -------------------------------------------------------------------------
  // Row-level security predicates (WHERE-clause security branches)
  // -------------------------------------------------------------------------
  describe('security predicates', () => {
    function baseDef() {
      const f = salesFixture();
      return {
        f,
        def: mkDef({
          items: [{ mapItem: mkMapItem(f.region), item: f.region, folder: f.sales }],
          formulaItems: f.formulaItems,
        }),
      };
    }

    it('appends a bare predicate string', () => {
      const { def } = baseDef();
      const result = generateSql(def, {
        securityPredicates: ['1 = 1'],
      });
      expect(norm(result.sql)).toContain('WHERE (1 = 1)');
    });

    it('ANDs a security predicate after an existing condition', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [{ mapItem: mkMapItem(f.region), item: f.region, folder: f.sales }],
        conditions: [
          {
            condition: mkCondition(f.region, { operator: '=', value: 'EMEA' }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });
      const result = generateSql(def, { securityPredicates: ['1 = 1'] });
      expect(norm(result.sql)).toContain('AND (1 = 1)');
    });

    it('binds a referenced security bind that is supplied', () => {
      const { def } = baseDef();
      const result = generateSql(def, {
        securityPredicates: ['f1."REGION" = :ctx_region'],
        securityBindParams: { ctx_region: 'EMEA' },
      });
      expect(result.bindParams.ctx_region).toBe('EMEA');
    });

    it('throws when a predicate references an unsupplied bind', () => {
      const { def } = baseDef();
      expect(() =>
        generateSql(def, { securityPredicates: ['f1."REGION" = :ctx_missing'] }),
      ).toThrow(/no value was supplied/);
    });

    it('rejects a predicate containing a statement separator', () => {
      const { def } = baseDef();
      expect(() =>
        generateSql(def, { securityPredicates: ['1 = 1; DROP TABLE X'] }),
      ).toThrow(/statement separators/);
    });

    it('rejects an {alias} predicate with no folder target', () => {
      const { def } = baseDef();
      expect(() =>
        generateSql(def, {
          securityPredicates: [{ sql: '{alias}."REGION" = 1' }],
        }),
      ).toThrow(/no folder target/);
    });
  });

  // -------------------------------------------------------------------------
  // Formula-parser operator/predicate coverage (compiled calc fields)
  // -------------------------------------------------------------------------
  describe('formula operators in calculated fields', () => {
    function compile(formula: string): string {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: mkMapItem(f.amount), item: f.amount, folder: f.sales },
        ],
        calculatedFields: [mkCalcField({ name: 'X', formula })],
        formulaItems: f.formulaItems,
      });
      return norm(generateSql(def).sql);
    }

    it('compiles comparison operators', () => {
      expect(compile('AMOUNT >= 100')).toContain('>= 100');
      expect(compile('AMOUNT <> 0')).toContain('<> 0');
      expect(compile('AMOUNT < 5')).toContain('< 5');
    });

    it('compiles LIKE', () => {
      expect(compile("REGION LIKE 'E%'")).toContain("LIKE 'E%'");
    });

    it('compiles IS NULL and IS NOT NULL', () => {
      expect(compile('REGION IS NULL')).toContain('IS NULL');
      expect(compile('REGION IS NOT NULL')).toContain('IS NOT NULL');
    });

    it('compiles AND / OR / NOT', () => {
      expect(compile('AMOUNT > 0 AND REGION IS NOT NULL')).toContain('AND');
      expect(compile('AMOUNT > 0 OR AMOUNT < 5')).toContain('OR');
      expect(compile('NOT (AMOUNT > 0)')).toContain('NOT');
    });

    it('compiles string concatenation', () => {
      expect(compile("REGION || '-' || REGION")).toContain('||');
    });

    it('compiles allowlisted functions', () => {
      expect(compile('NVL(REGION, 0)')).toContain('NVL(');
      expect(compile('ROUND(AMOUNT, 2)')).toContain('ROUND(');
      expect(compile('LENGTH(REGION)')).toContain('LENGTH(');
      expect(compile('GREATEST(AMOUNT, 1)')).toContain('GREATEST(');
    });

    it('compiles unary minus and parenthesised arithmetic', () => {
      expect(compile('-AMOUNT + 1')).toContain('-f1."AMOUNT"');
      expect(compile('(AMOUNT + 1) * 2')).toContain('* 2');
    });

    it('rejects a trailing garbage token', () => {
      expect(() => compile('AMOUNT +')).toThrow(SqlGenerationError);
    });
  });

  // -------------------------------------------------------------------------
  // Migrated worksheet semantics
  //
  // Everything below is a fact a Discoverer worksheet carries that used to be
  // stored and ignored: SELECT DISTINCT, group/break sorts, sort rank, sorts
  // on hidden items, and summaries.
  // -------------------------------------------------------------------------

  describe('SELECT DISTINCT', () => {
    it('emits DISTINCT when the map asks for it', () => {
      const f = salesFixture();
      const def = mkDef({
        map: mkMap({ selectDistinct: true }),
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toBe(
        'SELECT DISTINCT f1."REGION" AS REGION FROM "APP"."SALES" f1',
      );
      expect(result.distinct).toBe(true);
    });

    it('leaves DISTINCT off by default', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).not.toContain('DISTINCT');
      expect(result.distinct).toBe(false);
    });

    // ORA-01791: under DISTINCT, ORDER BY may only name selected columns.
    // Positions are selected columns, so a visible sort survives.
    it('keeps a visible sort under DISTINCT', () => {
      const f = salesFixture();
      const def = mkDef({
        map: mkMap({ selectDistinct: true }),
        items: [
          {
            mapItem: mkMapItem(f.region, { sortDirection: 'ASC', sortOrder: 1 }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY 1 ASC');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('axis placement and default aggregation', () => {
    // `items.agg_function` is the EUL item's default aggregation. Discoverer
    // applies it to measures, not to the columns a worksheet groups by.
    it('does not aggregate a column the worksheet placed on the axis', () => {
      const f = salesFixture();
      const grouping = mkItem(f.sales, {
        name: 'Region Code',
        columnName: 'REGION_CODE',
        aggFunction: 'SUM',
      });
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(grouping, { axisType: 'AXIS' }),
            item: grouping,
            folder: f.sales,
          },
        ],
        formulaItems: [...f.formulaItems, { item: grouping, folder: f.sales }],
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toBe(
        'SELECT f1."REGION_CODE" AS REGION_CODE FROM "APP"."SALES" f1',
      );
      expect(result.hasAggregates).toBe(false);
    });

    it('still aggregates a measure column by the item default', () => {
      const f = salesFixture();
      const measure = mkItem(f.sales, {
        name: 'Net',
        columnName: 'NET',
        aggFunction: 'SUM',
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(measure, {
              displayOrder: 1,
              axisType: 'MEASURE',
            }),
            item: measure,
            folder: f.sales,
          },
        ],
        formulaItems: [...f.formulaItems, { item: measure, folder: f.sales }],
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('SUM(f1."NET") AS NET');
      expect(norm(result.sql)).toContain('GROUP BY f1."REGION"');
    });

    // An aggregate chosen on the map item is deliberate and outranks placement.
    it('honours an explicit aggregate on an axis column', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.amount, {
              axisType: 'AXIS',
              aggFunction: 'COUNT',
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      expect(norm(generateSql(def).sql)).toContain('COUNT(f1."AMOUNT")');
    });

    // Neo-authored maps leave axis_type null and are untouched by the rule.
    it('applies the item default when no axis is recorded', () => {
      const f = salesFixture();
      const measure = mkItem(f.sales, {
        name: 'Net',
        columnName: 'NET',
        aggFunction: 'SUM',
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(measure), item: measure, folder: f.sales },
        ],
        formulaItems: [...f.formulaItems, { item: measure, folder: f.sales }],
      });

      expect(norm(generateSql(def).sql)).toContain('SUM(f1."NET")');
    });
  });

  describe('group/break sorts and sort rank', () => {
    // `sort_group` is Discoverer's IsABreak. A break only groups if nothing
    // sorts outside it, so it leads the ORDER BY whatever its position says.
    it('puts a group sort ahead of a plain sort with a lower position', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, {
              displayOrder: 0,
              sortDirection: 'ASC',
              sortOrder: 5,
              sortGroup: true,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY 1 ASC, 2 DESC');
    });

    it('orders group sorts among themselves by position', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, {
              displayOrder: 0,
              sortDirection: 'ASC',
              sortOrder: 2,
              sortGroup: true,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.custName, {
              displayOrder: 1,
              sortDirection: 'ASC',
              sortOrder: 1,
              sortGroup: true,
            }),
            item: f.custName,
            folder: f.customers,
          },
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY 2 ASC, 1 ASC');
    });

    // `sort_rank` is an explicit precedence and outranks the list position.
    it('lets sort rank override sort order', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, {
              displayOrder: 0,
              sortDirection: 'ASC',
              sortOrder: 1,
              sortRank: 9,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 1,
              sortDirection: 'DESC',
              sortOrder: 2,
              sortRank: 1,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY 2 DESC, 1 ASC');
    });

    // The break columns are not visible in the SQL text — a renderer needs
    // them named, so they come back alongside it.
    it('reports the break columns it grouped on, outermost first', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, {
              displayOrder: 0,
              sortDirection: 'ASC',
              sortOrder: 2,
              sortGroup: true,
            }),
            item: f.region,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.custName, {
              displayOrder: 1,
              sortDirection: 'ASC',
              sortOrder: 1,
              sortGroup: true,
            }),
            item: f.custName,
            folder: f.customers,
          },
          {
            mapItem: mkMapItem(f.amount, {
              displayOrder: 2,
              sortDirection: 'DESC',
              sortOrder: 3,
            }),
            item: f.amount,
            folder: f.sales,
          },
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.groupBreakAliases).toEqual(['CUSTOMER_NAME', 'REGION']);
    });

    it('reports no break columns when nothing is a group sort', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          {
            mapItem: mkMapItem(f.region, { sortDirection: 'ASC', sortOrder: 1 }),
            item: f.region,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      expect(generateSql(def).groupBreakAliases).toEqual([]);
    });
  });

  describe('sorts on hidden items', () => {
    // A hidden item has no SELECT-list position, so its sort is emitted as an
    // expression instead of being silently dropped.
    it('orders by a hidden item expression', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.orderDate, {
              displayOrder: 1,
              isHidden: true,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('ORDER BY f1."ORDER_DATE" DESC');
      expect(result.warnings).toEqual([]);
    });

    it('joins the folder a hidden sort reaches into', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.custName, {
              displayOrder: 1,
              isHidden: true,
              sortDirection: 'ASC',
              sortOrder: 1,
            }),
            item: f.custName,
            folder: f.customers,
          },
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).toContain('INNER JOIN "APP"."CUSTOMERS" f2');
      expect(norm(result.sql)).toContain('ORDER BY f2."CUSTOMER_NAME" ASC');
    });

    it('drops a hidden sort under SELECT DISTINCT and says so', () => {
      const f = salesFixture();
      const def = mkDef({
        map: mkMap({ selectDistinct: true }),
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.orderDate, {
              displayOrder: 1,
              isHidden: true,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).not.toContain('ORDER BY');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Order Date');
      expect(result.warnings[0]).toContain('SELECT DISTINCT');
    });

    it('drops a hidden sort in an aggregated query and says so', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          {
            mapItem: mkMapItem(f.amount, { displayOrder: 1, aggFunction: 'SUM' }),
            item: f.amount,
            folder: f.sales,
          },
          {
            mapItem: mkMapItem(f.orderDate, {
              displayOrder: 2,
              isHidden: true,
              sortDirection: 'DESC',
              sortOrder: 1,
            }),
            item: f.orderDate,
            folder: f.sales,
          },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(norm(result.sql)).not.toContain('ORDER BY');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Order Date');
    });
  });

  describe('totals', () => {
    const parser = new Parser();
    const expectParsable = (sql: string) => {
      const substituted = sql.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '1');
      expect(() => parser.astify(substituted, { database: 'db2' })).not.toThrow();
    };

    it('generates no totals query when the map defines none', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('builds a grand total over the base expression, not the drawn column', () => {
      const f = salesFixture();
      const amountItem = mkMapItem(f.amount, {
        displayOrder: 1,
        aggFunction: 'SUM',
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [mkTotal({ mapItemId: amountItem.id, aggFunction: 'SUM' })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toHaveLength(1);
      const [group] = result.totals;
      // SUM(f1."AMOUNT"), never SUM(SUM(...)).
      expect(norm(group!.sql)).toBe(
        'SELECT SUM(f1."AMOUNT") AS SUM_AMOUNT FROM "APP"."SALES" f1',
      );
      expect(group!.breakAlias).toBeNull();
      expect(group!.totals[0]!.aggFunction).toBe('SUM');
      expect(group!.totals[0]!.targetAlias).toBe('AMOUNT');
      expectParsable(group!.sql);
    });

    it('builds one grouped query per break column', () => {
      const f = salesFixture();
      const regionItem = mkMapItem(f.region, { displayOrder: 0 });
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: regionItem, item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [
          mkTotal({
            mapItemId: amountItem.id,
            breakMapItemId: regionItem.id,
            placement: 'AT_CHANGE',
            aggFunction: 'SUM',
            label: 'Total for &value',
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toHaveLength(1);
      const [group] = result.totals;
      expect(norm(group!.sql)).toBe(
        'SELECT f1."REGION" AS REGION, SUM(f1."AMOUNT") AS SUM_AMOUNT ' +
          'FROM "APP"."SALES" f1 GROUP BY f1."REGION" ORDER BY 1',
      );
      expect(group!.breakAlias).toBe('REGION');
      expect(group!.breakTargetAlias).toBe('REGION');
      // The label template keeps Discoverer's own interpolation.
      expect(group!.totals[0]!.label).toBe('Total for &value');
      expectParsable(group!.sql);
    });

    it('separates a grand total from a subtotal, grand total first', () => {
      const f = salesFixture();
      const regionItem = mkMapItem(f.region, { displayOrder: 0 });
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: regionItem, item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [
          mkTotal({
            mapItemId: amountItem.id,
            breakMapItemId: regionItem.id,
            placement: 'AT_CHANGE',
            displayOrder: 1,
          }),
          mkTotal({ mapItemId: amountItem.id, placement: 'GRAND_TOTAL' }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals.map((g) => g.breakAlias)).toEqual([null, 'REGION']);
    });

    it('carries the WHERE binds but not the pagination binds', () => {
      const f = salesFixture();
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        conditions: [
          {
            condition: mkCondition(f.region, { operator: '=', value: 'EAST' }),
            item: f.region,
            folder: f.sales,
          },
        ],
        totals: [mkTotal({ mapItemId: amountItem.id })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, { rowLimit: 50 });
      expect(result.bindParams).toHaveProperty('row_limit', 50);
      const [group] = result.totals;
      expect(norm(group!.sql)).toContain('WHERE');
      expect(norm(group!.sql)).not.toContain('FETCH NEXT');
      expect(group!.bindParams).not.toHaveProperty('row_limit');
      expect(Object.keys(group!.bindParams)).toHaveLength(1);
    });

    it('skips a total whose Discoverer aggregate did not migrate', () => {
      const f = salesFixture();
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [mkTotal({ mapItemId: amountItem.id, aggFunction: null })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('did not migrate');
    });

    it('skips a total pointing at a column the map does not use', () => {
      const f = salesFixture();
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        totals: [
          mkTotal({ mapItemId: '00000000-0000-4000-8000-999999999999' }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toEqual([]);
      expect(result.warnings[0]).toContain('does not use');
    });

    // The migration writes AT_CHANGE with a null break only when Discoverer
    // broke on a workbook calculation, which has no `map_items` row. Folding
    // it into the grand total would print the all-rows figure where a reader
    // expects a per-group one.
    it('skips a subtotal whose break column did not migrate', () => {
      const f = salesFixture();
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [
          mkTotal({
            mapItemId: amountItem.id,
            placement: 'AT_CHANGE',
            breakMapItemId: null,
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('subtotal was skipped');
    });

    it('still totals a hidden calculated field a total names', () => {
      const f = salesFixture();
      const calc = mkCalcField({
        name: 'Net',
        formula: 'AMOUNT * 2',
        isHidden: true,
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [calc],
        totals: [mkTotal({ mapCalculatedFieldId: calc.id, aggFunction: 'SUM' })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      // Not drawn as a column...
      expect(result.columns.map((c) => c.label)).toEqual(['Region']);
      // ...but still totalled, with no main-query column to sit under.
      expect(norm(result.totals[0]!.sql)).toContain('SUM(f1."AMOUNT" * 2)');
      expect(result.totals[0]!.totals[0]!.targetAlias).toBeUndefined();
    });

    it('emits a calculation that already aggregates unwrapped', () => {
      const f = salesFixture();
      const calc = mkCalcField({
        name: 'Total Amount',
        formula: 'SUM(AMOUNT)',
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
        ],
        calculatedFields: [calc],
        totals: [mkTotal({ mapCalculatedFieldId: calc.id, aggFunction: 'SUM' })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      const [group] = result.totals;
      expect(norm(group!.sql)).toContain('SUM(f1."AMOUNT") AS TOTAL_TOTAL_AMOUNT');
      expect(norm(group!.sql)).not.toContain('SUM(SUM(');
      expect(group!.totals[0]!.aggFunction).toBe('INLINE');
    });

    it('carries the percentage kind through', () => {
      const f = salesFixture();
      const amountItem = mkMapItem(f.amount, { displayOrder: 1 });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: amountItem, item: f.amount, folder: f.sales },
        ],
        totals: [
          mkTotal({
            mapItemId: amountItem.id,
            kind: 'PERCENTAGE',
            aggFunction: 'SUM',
          }),
        ],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      expect(result.totals[0]!.totals[0]!.kind).toBe('PERCENTAGE');
    });

    it('totals a hidden item the map queries but does not draw', () => {
      const f = salesFixture();
      const hiddenAmount = mkMapItem(f.amount, {
        displayOrder: 1,
        isHidden: true,
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: hiddenAmount, item: f.amount, folder: f.sales },
        ],
        totals: [mkTotal({ mapItemId: hiddenAmount.id })],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def);
      const [group] = result.totals;
      expect(norm(group!.sql)).toContain('SUM(f1."AMOUNT")');
      // No drawn column to sit under.
      expect(group!.totals[0]!.targetAlias).toBeUndefined();
      expect(group!.totals[0]!.targetLabel).toBe('Amount');
    });

    it('refuses a total that reaches into another folder (D-014)', () => {
      const f = salesFixture();
      const custItem = mkMapItem(f.custName, {
        displayOrder: 1,
        isHidden: true,
      });
      const def = mkDef({
        items: [
          { mapItem: mkMapItem(f.region), item: f.region, folder: f.sales },
          { mapItem: custItem, item: f.custName, folder: f.customers },
        ],
        joins: [f.join],
        totals: [mkTotal({ mapItemId: custItem.id, aggFunction: 'COUNT' })],
        formulaItems: f.formulaItems,
      });

      // A total is an aggregate over the SAME multi-folder FROM clause, so it
      // is exactly the fan trap D-014 refuses. Phase 3.4 restores the INNER
      // JOIN + COUNT assertions this test made before the guard existed.
      expect(() => generateSql(def)).toThrow(
        /Multi-folder aggregate queries are refused/,
      );

      // The refusal is machine-readable: the client renders its own
      // translated explanation from `code`, never the English message
      // above, and names the folders from `details` (D-036).
      try {
        generateSql(def);
        throw new Error('expected a refusal');
      } catch (err) {
        expect(err).toBeInstanceOf(SqlGenerationError);
        const refusal = err as SqlGenerationError;
        expect(refusal.code).toBe('MULTI_FOLDER_AGGREGATE');
        expect(refusal.details).toEqual({
          folders: expect.arrayContaining([f.sales.name, f.customers.name]),
        });
      }
    });
  });
});
