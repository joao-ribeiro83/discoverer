/**
 * Hermetic mock Oracle executor for detector/adapter tests.
 *
 * Emulates just enough of the real executor contract: rows keyed by
 * UPPERCASE column names, ALL_TABLES/DUAL answers, ORA-00942 for unknown
 * tables, and EXP_TYPE bind filtering for the EXPRESSIONS reads.
 */

import type { OracleExecutor } from '../../services/oracle-client.js';
import { dbString } from '../../services/oracle-client.js';

export interface MockCatalogRow {
  owner: string;
  tableName: string;
}

export interface MockDb {
  catalog: MockCatalogRow[];
  currentUser?: string;
  /** Rows per UNQUALIFIED uppercase table name (e.g. 'EUL5_BA'). */
  tables: Record<string, Array<Record<string, unknown>>>;
  /** Every SQL statement executed, for assertions. */
  executed: string[];
}

export function mockExecutor(db: MockDb): OracleExecutor {
  return (sql, binds) => {
    db.executed.push(sql);
    const lower = sql.toLowerCase();

    if (lower.includes('from all_tables')) {
      return Promise.resolve(
        db.catalog.map((row) => ({
          OWNER: row.owner,
          TABLE_NAME: row.tableName,
        })),
      );
    }

    if (lower.includes('from dual')) {
      return Promise.resolve(
        db.currentUser ? [{ CURRENT_USER: db.currentUser }] : [],
      );
    }

    const fromMatch = /\bFROM\s+([A-Z0-9_$#."]+)/i.exec(sql);
    const rawTable = fromMatch?.[1] ?? '';
    const tableName = (rawTable.split('.').pop() ?? '').replaceAll('"', '').toUpperCase();

    const rows = db.tables[tableName];
    if (rows === undefined) {
      return Promise.reject(
        new Error(`ORA-00942: table or view does not exist (${tableName})`),
      );
    }

    let result = rows;
    if (lower.includes('exp_type in') && binds) {
      const wanted = new Set(Object.values(binds).map((v) => dbString(v)));
      result = rows.filter((row) => wanted.has(dbString(row.EXP_TYPE)));
    }
    if (lower.includes('select distinct eu_username')) {
      const seen = new Set<string>();
      result = rows.filter((row) => {
        const name = row.EU_USERNAME;
        if (name === null || name === undefined) return false;
        const key = dbString(name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      result = result.map((row) => ({ EU_USERNAME: row.EU_USERNAME }));
    }

    // Return copies so tests can't accidentally mutate fixture rows.
    return Promise.resolve(result.map((row) => ({ ...row })));
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const EUL5_OWNER = 'EUL5_US';
export const EUL4_OWNER = 'EUL4_US';
export const EUL3_OWNER = 'DISCO3';

const EUL5_TABLE_NAMES = [
  'EUL5_BA',
  'EUL5_OBJS',
  'EUL5_EXPRESSIONS',
  'EUL5_JOINS',
  'EUL5_JOI_COMP',
  'EUL5_HIERARCHIES',
  'EUL5_HIER_LEVELS',
  'EUL5_SUMMARIES',
  'EUL5_FUNCTIONS',
  'EUL5_ELEM_ACCESS',
  'EUL5_DOCUMENTS',
  'EUL5_QPP_STATS',
  'EUL5_QPP_QUERY',
  'EUL5_EUL',
  'EUL5_OPTIONS',
  'EUL5_LOCK',
  'EUL5_TRANSLATIONS',
  'EUL5_BA_ROLES',
  'EUL5_OBJ_ROLES',
  'EUL5_APP_ROLES',
];

const EUL4_TABLE_NAMES = [
  'EUL4_BA',
  'EUL4_OBJS',
  'EUL4_EXPRESSIONS',
  'EUL4_JOINS',
  'EUL4_JOI_COMP',
  'EUL4_HIERARCHIES',
  'EUL4_HIER_LEVELS',
  'EUL4_SUMMARIES',
  'EUL4_FUNCTIONS',
  'EUL4_ELEM_ACCESS',
  'EUL4_DOCUMENTS',
  'EUL4_QPP_STATS',
  'EUL4_EUL',
  'EUL4_OPTIONS',
  'EUL4_USERS',
  'EUL4_ROLES',
];

const EUL3_TABLE_NAMES = [
  'EUL_BA',
  'EUL_OBJS',
  'EUL_EXPRESSIONS',
  'EUL_JOINS',
  'EUL_JOI_COMP',
  'EUL_HIERARCHIES',
  'EUL_HIER_LEVELS',
  'EUL_SUMMARIES',
  'EUL_FUNCTIONS',
  'EUL_ELEM_ACCESS',
  'EUL_DOCUMENTS',
  'EUL_QPP_STATS',
  'EUL_EUL',
  'EUL_OPTIONS',
  'EUL_USERS',
  'EUL_ROLES',
];

export function catalogFor(owner: string, tableNames: string[]): MockCatalogRow[] {
  return tableNames.map((tableName) => ({ owner, tableName }));
}

export function eul5Catalog(owner = EUL5_OWNER): MockCatalogRow[] {
  return catalogFor(owner, EUL5_TABLE_NAMES);
}

export function eul4Catalog(owner = EUL4_OWNER): MockCatalogRow[] {
  return catalogFor(owner, EUL4_TABLE_NAMES);
}

export function eul3Catalog(owner = EUL3_OWNER): MockCatalogRow[] {
  return catalogFor(owner, EUL3_TABLE_NAMES);
}

export function emptyTables(tableNames: string[]): Record<string, Array<Record<string, unknown>>> {
  return Object.fromEntries(tableNames.map((name) => [name, []]));
}

/** A fully-populated EUL5 source with one of everything. */
export function eul5Db(): MockDb {
  const created = new Date('2010-03-15T10:00:00Z');
  const updated = new Date('2012-06-01T09:30:00Z');
  return {
    catalog: eul5Catalog(),
    currentUser: EUL5_OWNER,
    executed: [],
    tables: {
      ...emptyTables(EUL5_TABLE_NAMES),
      EUL5_EUL: [
        {
          EU_ID: 1,
          EU_NAME: 'EUL5_US',
          EU_VERSION: '5.1.0.0.0',
          EU_DISC_VERSION: '10.1.2.48.18',
        },
      ],
      EUL5_BA: [
        {
          BA_ID: 100,
          BA_NAME: 'Sales Analysis',
          BA_DESCRIPTION: 'Sales BA',
          BA_LANGUAGE: 'GB',
          BA_DEVELOPER_KEY: 'SALES_BA',
          BA_CREATED_BY: 'DISCO_ADMIN',
          BA_CREATED_DATE: created,
          BA_UPDATED_BY: 'DISCO_ADMIN2',
          BA_UPDATED_DATE: updated,
        },
      ],
      EUL5_OBJS: [
        {
          OBJ_ID: 200,
          BA_ID: 100,
          OBJ_NAME: 'Invoice Headers',
          OBJ_DESCRIPTION: 'AP invoice headers',
          OBJ_TYPE: 'TABLE',
          OBJ_TABLE_NAME: 'AP_INVOICES_ALL',
          OBJ_TABLE_OWNER: 'APPS',
          OBJ_SEQUENCE: 1,
          OBJ_CREATED_BY: 'DISCO_ADMIN',
          OBJ_CREATED_DATE: created,
          OBJ_UPDATED_BY: 'DISCO_ADMIN2',
          OBJ_UPDATED_DATE: updated,
        },
        {
          OBJ_ID: 201,
          BA_ID: 100,
          OBJ_NAME: 'Sales Summary',
          OBJ_DESCRIPTION: null,
          OBJ_TYPE: 'SUMMARY',
          OBJ_TABLE_NAME: null,
          OBJ_TABLE_OWNER: null,
          OBJ_SEQUENCE: 2,
          OBJ_CREATED_BY: 'DISCO_ADMIN',
          OBJ_CREATED_DATE: created,
          OBJ_UPDATED_BY: 'DISCO_ADMIN',
          OBJ_UPDATED_DATE: created,
        },
      ],
      EUL5_EXPRESSIONS: [
        {
          EXP_ID: 300,
          OBJ_ID: 200,
          EXP_NAME: 'Invoice Amount',
          EXP_DESCRIPTION: 'Header amount',
          EXP_TYPE: 'CI',
          EXP_FORMULA: null,
          EXP_COL_NAME: 'INVOICE_AMOUNT',
          EXP_DATA_TYPE: 'NUMBER',
          EXP_FORMAT_MASK: '999,999.00',
          EXP_AGGR_FUNC: 'SUM',
          EXP_SEQUENCE: 1,
          EXP_NULLS_ALLOWED: 'N',
          IT_EXP_ID: null,
          EXP_CREATED_BY: 'DISCO_ADMIN',
          EXP_CREATED_DATE: created,
          EXP_UPDATED_BY: 'DISCO_ADMIN2',
          EXP_UPDATED_DATE: updated,
        },
        {
          EXP_ID: 301,
          OBJ_ID: 200,
          EXP_NAME: 'Amount With Tax',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'CU',
          EXP_FORMULA: 'INVOICE_AMOUNT * 1.2',
          EXP_COL_NAME: null,
          EXP_DATA_TYPE: 'NUMBER',
          EXP_FORMAT_MASK: null,
          EXP_AGGR_FUNC: 'NONE',
          EXP_SEQUENCE: 2,
          EXP_NULLS_ALLOWED: 'Y',
          IT_EXP_ID: null,
          EXP_CREATED_BY: 'DISCO_ADMIN',
          EXP_CREATED_DATE: created,
          EXP_UPDATED_BY: 'DISCO_ADMIN',
          EXP_UPDATED_DATE: created,
        },
        {
          EXP_ID: 302,
          OBJ_ID: 200,
          EXP_NAME: 'Region Filter',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'SM',
          EXP_FORMULA: "REGION = 'EMEA'",
          EXP_COL_NAME: null,
          EXP_DATA_TYPE: null,
          EXP_FORMAT_MASK: null,
          EXP_AGGR_FUNC: null,
          EXP_SEQUENCE: 3,
          EXP_NULLS_ALLOWED: 'Y',
          IT_EXP_ID: null,
          EXP_CREATED_BY: 'DISCO_ADMIN',
          EXP_CREATED_DATE: created,
          EXP_UPDATED_BY: 'DISCO_ADMIN',
          EXP_UPDATED_DATE: created,
        },
      ],
      EUL5_JOINS: [
        {
          JOI_ID: 400,
          JOI_NAME: 'Invoices to Suppliers',
          JOI_DESCRIPTION: 'FK join',
          JOI_TYPE: 'LEFT',
          JOI_CREATED_BY: 'DISCO_ADMIN',
          JOI_CREATED_DATE: created,
        },
      ],
      EUL5_JOI_COMP: [
        { JOI_ID: 400, EXP_ID_1: 300, EXP_ID_2: 301, JOI_OP: '=' },
        { JOI_ID: 400, EXP_ID_1: 300, EXP_ID_2: 302, JOI_OP: '=' },
      ],
      EUL5_HIERARCHIES: [
        {
          HIER_ID: 500,
          BA_ID: 100,
          HIER_NAME: 'Time Hierarchy',
          HIER_DESCRIPTION: 'Year > Quarter > Month',
          HIER_CREATED_BY: 'DISCO_ADMIN',
          HIER_CREATED_DATE: created,
          HIER_UPDATED_BY: 'DISCO_ADMIN',
          HIER_UPDATED_DATE: created,
        },
      ],
      EUL5_HIER_LEVELS: [
        { HIER_LEVEL_ID: 510, HIER_ID: 500, ITEM_ID: 300, HIER_LEVEL_NAME: 'Year', HIER_LEVEL_NUM: 1 },
        { HIER_LEVEL_ID: 511, HIER_ID: 500, ITEM_ID: 301, HIER_LEVEL_NAME: 'Month', HIER_LEVEL_NUM: 2 },
      ],
      EUL5_FUNCTIONS: [
        { FUN_ID: 600, FUN_NAME: 'GET_FISCAL_YEAR', FUN_DESCRIPTION: 'Fiscal year lookup' },
      ],
      EUL5_DOCUMENTS: [
        {
          DOC_ID: 700,
          DOC_NAME: 'Monthly Sales',
          DOC_DESCRIPTION: 'Monthly sales workbook',
          DOC_CONTENT: '<workbook><worksheet name="Sales"/></workbook>',
          DOC_WORKBOOK_OWNER: 'JSMITH',
          DOC_DEVELOPER_KEY: 'MONTHLY_SALES',
          DOC_CREATED_BY: 'JSMITH',
          DOC_CREATED_DATE: created,
          DOC_UPDATED_BY: 'JSMITH',
          DOC_UPDATED_DATE: updated,
        },
      ],
      EUL5_ELEM_ACCESS: [
        {
          EA_ID: 800,
          BA_ID: 100,
          OBJ_ID: null,
          EU_USERNAME: 'JSMITH',
          EA_PRIV_TYPE: 'BUSINESS_AREA',
          EA_CREATED_BY: 'DISCO_ADMIN',
          EA_CREATED_DATE: created,
        },
        {
          EA_ID: 801,
          BA_ID: null,
          OBJ_ID: 200,
          EU_USERNAME: 'MJONES',
          EA_PRIV_TYPE: 'OBJECT',
          EA_CREATED_BY: 'DISCO_ADMIN',
          EA_CREATED_DATE: created,
        },
        {
          EA_ID: 802,
          BA_ID: 100,
          OBJ_ID: null,
          EU_USERNAME: 'JSMITH',
          EA_PRIV_TYPE: 'BUSINESS_AREA',
          EA_CREATED_BY: 'DISCO_ADMIN',
          EA_CREATED_DATE: created,
        },
      ],
    },
  };
}

/** A fully-populated EUL4 source — note: no EUL5-only columns anywhere. */
export function eul4Db(): MockDb {
  const created = new Date('2001-11-20T08:00:00Z');
  return {
    catalog: eul4Catalog(),
    currentUser: EUL4_OWNER,
    executed: [],
    tables: {
      ...emptyTables(EUL4_TABLE_NAMES),
      EUL4_EUL: [
        { EU_ID: 1, EU_NAME: 'EUL4_US', EU_VERSION: '4.1.8.0.0' },
      ],
      EUL4_BA: [
        {
          BA_ID: 10,
          BA_NAME: 'Finance',
          BA_DESCRIPTION: 'Finance BA',
          BA_CREATED_BY: 'D4ADMIN',
          BA_CREATED_DATE: created,
          BA_UPDATED_BY: 'D4ADMIN',
          BA_UPDATED_DATE: created,
        },
      ],
      EUL4_OBJS: [
        {
          OBJ_ID: 20,
          BA_ID: 10,
          OBJ_NAME: 'GL Balances',
          OBJ_TYPE: 'VIEW',
          OBJ_TABLE_NAME: 'GL_BALANCES_V',
          OBJ_TABLE_OWNER: 'GL',
          OBJ_SEQUENCE: 1,
          OBJ_CREATED_BY: 'D4ADMIN',
          OBJ_CREATED_DATE: created,
        },
      ],
      EUL4_EXPRESSIONS: [
        {
          EXP_ID: 30,
          OBJ_ID: 20,
          EXP_NAME: 'Period Balance',
          EXP_TYPE: 'CI',
          EXP_FORMULA: null,
          EXP_COL_NAME: 'PERIOD_NET_DR',
          EXP_DATA_TYPE: 'NUMBER',
          EXP_FORMAT_MASK: '999999',
          EXP_AGGR_FUNC: 'SUM',
          EXP_SEQUENCE: 1,
          EXP_CREATED_BY: 'D4ADMIN',
          EXP_CREATED_DATE: created,
        },
        {
          EXP_ID: 31,
          OBJ_ID: 20,
          EXP_NAME: 'Net Balance',
          EXP_TYPE: 'CU',
          EXP_FORMULA: 'PERIOD_NET_DR - PERIOD_NET_CR',
          EXP_COL_NAME: null,
          EXP_DATA_TYPE: 'NUMBER',
          EXP_FORMAT_MASK: null,
          EXP_AGGR_FUNC: 'NONE',
          EXP_SEQUENCE: 2,
          EXP_CREATED_BY: 'D4ADMIN',
          EXP_CREATED_DATE: created,
        },
      ],
      EUL4_JOINS: [
        {
          JOI_ID: 40,
          JOI_NAME: 'Balances to Periods',
          JOI_TYPE: 'OUTER',
          JOI_CREATED_BY: 'D4ADMIN',
          JOI_CREATED_DATE: created,
        },
      ],
      EUL4_JOI_COMP: [
        { JOI_ID: 40, EXP_ID_1: 30, EXP_ID_2: 31, JOI_OP: '=' },
      ],
      EUL4_HIERARCHIES: [
        {
          HIER_ID: 50,
          BA_ID: 10,
          HIER_NAME: 'Account Hierarchy',
          HIER_CREATED_BY: 'D4ADMIN',
          HIER_CREATED_DATE: created,
        },
      ],
      EUL4_HIER_LEVELS: [
        { HIER_LEVEL_ID: 51, HIER_ID: 50, ITEM_ID: 30, HIER_LEVEL_NAME: 'Company', HIER_LEVEL_NUM: 1 },
      ],
      EUL4_FUNCTIONS: [
        { FUN_ID: 60, FUN_NAME: 'GL_PERIOD_NAME' },
      ],
      EUL4_DOCUMENTS: [
        {
          DOC_ID: 70,
          DOC_NAME: 'Trial Balance',
          DOC_CONTENT: '<workbook/>',
          DOC_CREATED_BY: 'ACLARK',
          DOC_CREATED_DATE: created,
          DOC_UPDATED_BY: 'ACLARK',
          DOC_UPDATED_DATE: created,
        },
      ],
      EUL4_ELEM_ACCESS: [
        {
          EA_ID: 80,
          BA_ID: 10,
          OBJ_ID: null,
          EU_USERNAME: 'ACLARK',
          EA_PRIV_TYPE: 'BUSINESS_AREA',
          EA_CREATED_BY: 'D4ADMIN',
          EA_CREATED_DATE: created,
        },
      ],
    },
  };
}

/** Minimal EUL3 source — just enough to detect it. */
export function eul3Db(): MockDb {
  return {
    catalog: eul3Catalog(),
    currentUser: EUL3_OWNER,
    executed: [],
    tables: {
      ...emptyTables(EUL3_TABLE_NAMES),
      EUL_EUL: [{ EU_ID: 1, EU_NAME: 'DISCO3', EU_VERSION: '3.1.36.0.0' }],
    },
  };
}

/** Mixed EUL4 + EUL5 in one schema — Oracle's non-destructive upgrade state. */
export function mixedDb(): MockDb {
  const five = eul5Db();
  const four = eul4Db();
  return {
    catalog: [
      ...eul5Catalog(EUL5_OWNER),
      ...catalogFor(EUL5_OWNER, EUL4_TABLE_NAMES),
    ],
    currentUser: EUL5_OWNER,
    executed: [],
    tables: { ...four.tables, ...five.tables },
  };
}
