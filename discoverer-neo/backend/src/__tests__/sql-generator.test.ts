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
              aggFunction: 'SUM',
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
        calculatedFields: [
          mkCalcField({
            name: 'Avg Amount',
            formula: 'AVG([Amount])',
          }),
        ],
        joins: [f.join],
        formulaItems: f.formulaItems,
      });

      const result = generateSql(def, {
        parameterValues: { p_regions: 'EMEA,APAC', p_from: '2026-01-01' },
        rowLimit: 50,
      });

      const sql = norm(result.sql);
      expect(sql).toContain('SUM(f2."AMOUNT") AS TOTAL_AMOUNT');
      expect(sql).toContain('AVG(f2."AMOUNT") AS AVG_AMOUNT');
      expect(sql).toContain('INNER JOIN');
      expect(sql).toContain('IN (:p_regions_0, :p_regions_1)');
      expect(sql).toContain("TO_DATE(:p_from, 'YYYY-MM-DD')");
      expect(sql).toContain('GROUP BY f1."CUSTOMER_NAME"');
      expect(sql).toContain('ORDER BY 2 DESC');
      expect(sql).toContain('FETCH NEXT :row_limit ROWS ONLY');
      expect(result.bindParams).toEqual({
        p_regions_0: 'EMEA',
        p_regions_1: 'APAC',
        p_from: '2026-01-01',
        row_limit: 50,
      });
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

    it('complex query (joins + aggregation + conditions + params + calc fields + sort + pagination) parses', () => {
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
              aggFunction: 'SUM',
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
        calculatedFields: [
          mkCalcField({ name: 'Avg Amount', formula: 'AVG([Amount])' }),
        ],
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
});
