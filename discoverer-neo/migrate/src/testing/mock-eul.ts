/**
 * Hermetic mock Oracle executor for detector/adapter tests.
 *
 * Emulates just enough of the real executor contract: rows keyed by
 * UPPERCASE column names, ALL_TABLES/ALL_TAB_COLUMNS/DUAL answers, ORA-00942
 * for unknown tables, and EXP_TYPE bind filtering for the EXPRESSIONS reads.
 *
 * IMPORTANT: every table and column name in these fixtures is the REAL one,
 * verified against Oracle's shipped scripts — see EUL_SCHEMA_GROUND_TRUTH.md.
 * The previous generation of these fixtures encoded an invented schema, which
 * made the whole suite self-consistent and simultaneously wrong. If you add a
 * name here, cite where it came from.
 */

import type { OracleExecutor } from '../services/oracle-client.js';
import { dbString } from '../services/oracle-client.js';
import { DISCOVERER_WORKBOOK_CONTENT_TYPE } from '../services/workbook-parser.js';
import { buildWorkbookFixture } from './workbook-fixture.js';

/**
 * Workbook bodies for the fixtures below.
 *
 * Built with the same encoder the parser tests use, so the fixture EUL carries
 * a real `.DIS` container rather than a placeholder: a migration-runner test
 * exercises the actual blob → worksheets → map_items path, not a stub of it.
 *
 * Their folder and item labels match the EUL5/EUL4 folder and item fixtures
 * further down, which is what lets the runner resolve map items by name.
 */
const MONTHLY_SALES_BODY = buildWorkbookFixture({
  name: 'Monthly Sales',
  eulOwner: 'EUL5_US',
  worksheets: [
    {
      name: 'Sales',
      title: 'Monthly Sales Report',
      guid: '{11111111-1111-1111-1111-111111111111}',
      columns: [
        // Resolved by EXP_ID through the shared item declared below — the way
        // a real workbook records every use of an item after the first.
        { item: 'Invoice Amount', heading: 'Amount', formatMask: '999,999.00' },
        // Resolved by name: no EXP_ID, exercising the fallback path.
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
        },
      ],
      // A subtotal at each change in Region over the Amount column, then a
      // grand total over the same column — the shape the source's
      // `… — TOTALIZADORES` sheets are built from.
      totals: [
        { label: 'SubTotal por &Value', functionCode: 1, placementCode: 1, column: 0, breakColumn: 1 },
        { label: 'Total Geral', functionCode: 1, placementCode: 3, column: 0 },
      ],
    },
  ],
  items: [
    {
      folderName: 'INVOICE_HEADERS',
      folderLabel: 'Invoice Headers',
      itemName: 'INVOICE_AMOUNT',
      itemLabel: 'Invoice Amount',
      // Matches EUL5_EXPRESSIONS.EXP_ID for 'Invoice Amount' below.
      sourceId: 300,
    },
  ],
  parameters: [{ name: 'Period', prompt: 'Which period?', defaultValue: '2024-01' }],
  conditions: [
    {
      sql: 'Invoice Amount >= :Period',
      operatorCode: 86,
      item: 'Invoice Amount',
      parameter: 'Period',
    },
  ],
});

const TRIAL_BALANCE_BODY = buildWorkbookFixture({
  name: 'Trial Balance',
  eulOwner: 'EUL4_US',
  worksheets: [
    {
      name: 'Balances',
      columns: [
        {
          folderName: 'GL_BALANCES',
          folderLabel: 'GL Balances',
          itemName: 'PERIOD_NET_DR',
          itemLabel: 'Period Balance',
        },
      ],
    },
  ],
});

export interface MockCatalogRow {
  owner: string;
  tableName: string;
}

export interface MockDb {
  catalog: MockCatalogRow[];
  currentUser?: string;
  /** Rows per UNQUALIFIED uppercase table name (e.g. 'EUL5_BAS'). */
  tables: Record<string, Array<Record<string, unknown>>>;
  /** Every SQL statement executed, for assertions. */
  executed: string[];
}

export function mockExecutor(db: MockDb): OracleExecutor {
  return (sql, binds) => {
    db.executed.push(sql);
    const lower = sql.toLowerCase();

    // probeColumns() asks the dictionary which optional columns exist. Answer
    // from the fixture rows themselves so a fixture that omits a column
    // behaves exactly like a source that doesn't have it.
    if (lower.includes('from all_tab_columns')) {
      const wantedTable = dbString(binds?.tbl ?? '').toUpperCase();
      const rows = db.tables[wantedTable] ?? [];
      const available = new Set<string>();
      for (const row of rows) {
        for (const key of Object.keys(row)) available.add(key.toUpperCase());
      }
      const asked = Object.entries(binds ?? {})
        .filter(([k]) => /^c\d+$/.test(k))
        .map(([, v]) => dbString(v).toUpperCase());
      return Promise.resolve(
        asked.filter((c) => available.has(c)).map((c) => ({ COLUMN_NAME: c })),
      );
    }

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
      const wanted = new Set(
        Object.entries(binds)
          .filter(([k]) => /^t\d+$/.test(k))
          .map(([, v]) => dbString(v)),
      );
      result = rows.filter((row) => wanted.has(dbString(row.EXP_TYPE)));
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

/** Real EUL5 inventory (subset of euldrop.sql — the tables we actually read). */
const EUL5_TABLE_NAMES = [
  'EUL5_BAS',
  'EUL5_BA_OBJ_LINKS',
  'EUL5_OBJS',
  'EUL5_OBJ_DEPS',
  'EUL5_OBJ_JOIN_USGS',
  'EUL5_EXPRESSIONS',
  'EUL5_EXP_DEPS',
  'EUL5_KEY_CONS',
  'EUL5_HIERARCHIES',
  'EUL5_HI_NODES',
  'EUL5_HI_SEGMENTS',
  'EUL5_SUMMARY_OBJS',
  'EUL5_FUNCTIONS',
  'EUL5_ACCESS_PRIVS',
  'EUL5_EUL_USERS',
  'EUL5_DOCUMENTS',
  'EUL5_ELEM_XREFS',
  'EUL5_QPP_STATS',
  'EUL5_VERSIONS',
];

/** Real EUL4 inventory — identical to EUL5's plus the tables EUL5 retired. */
const EUL4_TABLE_NAMES = [
  ...EUL5_TABLE_NAMES.map((t) => t.replace('EUL5_', 'EUL4_')),
  'EUL4_NAMED_ELEMS',
  'EUL4_ODBC_CATALOGS',
  'EUL4_ODBC_SCHEMAS',
];

const EUL3_TABLE_NAMES = EUL5_TABLE_NAMES.map((t) => t.replace('EUL5_', 'EUL_'));

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

/**
 * A fully-populated EUL5 source with one of everything.
 *
 * Shape notes that matter: folders link to business areas through
 * BA_OBJ_LINKS; items carry IT_OBJ_ID/IT_EXT_COLUMN; the join is folder to
 * folder in KEY_CONS; the hierarchy is a node tree in HI_NODES + HI_SEGMENTS.
 */
export function eul5Db(): MockDb {
  const created = new Date('2010-03-15T10:00:00Z');
  const updated = new Date('2012-06-01T09:30:00Z');
  return {
    catalog: eul5Catalog(),
    currentUser: EUL5_OWNER,
    executed: [],
    tables: {
      ...emptyTables(EUL5_TABLE_NAMES),
      EUL5_VERSIONS: [
        {
          VER_RELEASE: '5.1.0.0.0',
          VER_MIN_CODE_VER: '5.0.0.0.0.0',
          VER_EUL_TIMESTAMP: '20100315100000',
        },
      ],
      EUL5_BAS: [
        {
          BA_ID: 100,
          BA_NAME: 'Sales Analysis',
          BA_DESCRIPTION: 'Sales BA',
          BA_CREATED_BY: 'DISCO_ADMIN',
          BA_CREATED_DATE: created,
          BA_UPDATED_BY: 'DISCO_ADMIN2',
          BA_UPDATED_DATE: updated,
        },
        {
          BA_ID: 101,
          BA_NAME: 'Zebra Analysis',
          BA_DESCRIPTION: 'Second BA — shares the Invoice Headers folder',
          BA_CREATED_BY: 'DISCO_ADMIN',
          BA_CREATED_DATE: created,
          BA_UPDATED_BY: null,
          BA_UPDATED_DATE: null,
        },
      ],
      // Folder 200 is shared across two business areas — the many-to-many
      // shape BA_OBJ_LINKS actually has.
      EUL5_BA_OBJ_LINKS: [
        { BOL_BA_ID: 100, BOL_OBJ_ID: 200 },
        { BOL_BA_ID: 101, BOL_OBJ_ID: 200 },
        { BOL_BA_ID: 100, BOL_OBJ_ID: 201 },
      ],
      EUL5_OBJS: [
        {
          OBJ_ID: 200,
          OBJ_NAME: 'Invoice Headers',
          OBJ_DESCRIPTION: 'AP invoice headers',
          OBJ_TYPE: 'SOBJ',
          SOBJ_EXT_TABLE: 'AP_INVOICES_ALL',
          OBJ_EXT_OWNER: 'APPS',
        },
        {
          OBJ_ID: 201,
          OBJ_NAME: 'Sales Summary',
          OBJ_DESCRIPTION: null,
          OBJ_TYPE: 'COBJ',
          SOBJ_EXT_TABLE: null,
          OBJ_EXT_OWNER: null,
        },
      ],
      EUL5_EXPRESSIONS: [
        {
          EXP_ID: 300,
          IT_OBJ_ID: 200,
          EXP_NAME: 'Invoice Amount',
          EXP_DESCRIPTION: 'Header amount',
          EXP_TYPE: 'CO', // database (base) item
          IT_EXT_COLUMN: 'INVOICE_AMOUNT',
          EXP_DATA_TYPE: 'NUMBER',
          IT_FORMAT_MASK: '999,999.00',
          IT_HEADING: 'Amount',
        },
        {
          EXP_ID: 301,
          IT_OBJ_ID: 200,
          EXP_NAME: 'Amount With Tax',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'CI', // created item (calculation)
          IT_EXT_COLUMN: null,
          EXP_DATA_TYPE: 'NUMBER',
          IT_FORMAT_MASK: null,
          IT_HEADING: null,
        },
        {
          EXP_ID: 302,
          IT_OBJ_ID: 201,
          EXP_NAME: 'Region',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'CO',
          IT_EXT_COLUMN: 'REGION',
          EXP_DATA_TYPE: 'VARCHAR2',
          IT_FORMAT_MASK: null,
          IT_HEADING: null,
        },
      ],
      // Folder-to-folder join. KEY_ID is included here so the probe finds it;
      // drop it from a fixture to exercise the "no KEY_ID" fallback.
      EUL5_KEY_CONS: [
        {
          KEY_ID: 400,
          KEY_OBJ_ID: 200,
          FK_OBJ_ID_REMOTE: 201,
          KEY_DESCRIPTION: 'Invoices to Summary',
        },
      ],
      EUL5_HIERARCHIES: [
        { HI_ID: 500, BA_ID: 100, HI_NAME: 'Time Hierarchy', HI_DESCRIPTION: 'Year > Quarter > Month' },
      ],
      EUL5_HI_NODES: [
        { HN_ID: 510, HN_HI_ID: 500, HN_EXP_ID: 300, HN_NAME: 'Year' },
        { HN_ID: 511, HN_HI_ID: 500, HN_EXP_ID: 301, HN_NAME: 'Quarter' },
        { HN_ID: 512, HN_HI_ID: 500, HN_EXP_ID: 302, HN_NAME: 'Month' },
      ],
      // 510 is the root (never a child); 511 under it; 512 under 511.
      EUL5_HI_SEGMENTS: [
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 510, IHS_HN_ID_CHILD: 511 },
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 511, IHS_HN_ID_CHILD: 512 },
      ],
      EUL5_FUNCTIONS: [
        { FUN_ID: 600, FUN_NAME: 'GET_FISCAL_YEAR', FUN_DESCRIPTION: 'Fiscal year lookup' },
      ],
      EUL5_DOCUMENTS: [
        {
          DOC_ID: 700,
          DOC_NAME: 'Monthly Sales',
          DOC_DESCRIPTION: 'Monthly sales workbook',
          DOC_CONTENT_TYPE: DISCOVERER_WORKBOOK_CONTENT_TYPE,
          DOC_DEVELOPER_KEY: 'MONTHLY_SALES',
          DOC_EU_ID: 900,
          DOC_DOCUMENT: MONTHLY_SALES_BODY,
          DOC_LENGTH: MONTHLY_SALES_BODY.length,
          DOC_BATCH: 0,
          DOC_CREATED_BY: 'JSMITH',
          DOC_CREATED_DATE: created,
          DOC_UPDATED_BY: 'JSMITH',
          DOC_UPDATED_DATE: updated,
        },
      ],
      EUL5_EUL_USERS: [
        { EU_ID: 900, EU_USERNAME: 'JSMITH', EU_ROLE_FLAG: 'N' },
        { EU_ID: 901, EU_USERNAME: 'MJONES', EU_ROLE_FLAG: 'N' },
        { EU_ID: 902, EU_USERNAME: 'SALES_ROLE', EU_ROLE_FLAG: 'Y' },
      ],
      // GBA_BA_ID / GO_OBJ_ID are present here so the probe finds them; a
      // fixture without them exercises the degrade-to-EUL-wide path.
      EUL5_ACCESS_PRIVS: [
        {
          AP_ID: 800,
          AP_EU_ID: 900,
          GP_APP_ID: 1006,
          GBA_BA_ID: 100,
          GO_OBJ_ID: null,
          GD_DOC_ID: null,
          AP_CREATED_DATE: created,
        },
        {
          AP_ID: 801,
          AP_EU_ID: 901,
          GP_APP_ID: 1015,
          GBA_BA_ID: null,
          GO_OBJ_ID: 200,
          GD_DOC_ID: null,
          AP_CREATED_DATE: created,
        },
        {
          AP_ID: 802,
          AP_EU_ID: 902,
          GP_APP_ID: 1006,
          GBA_BA_ID: 100,
          GO_OBJ_ID: null,
          GD_DOC_ID: null,
          AP_CREATED_DATE: created,
        },
      ],
    },
  };
}

/**
 * A fully-populated EUL4 source. The column shape is identical to EUL5's —
 * that is the finding, not an oversight: EUL4 and EUL5 differ by prefix.
 */
export function eul4Db(): MockDb {
  const created = new Date('2001-11-20T08:00:00Z');
  return {
    catalog: eul4Catalog(),
    currentUser: EUL4_OWNER,
    executed: [],
    tables: {
      ...emptyTables(EUL4_TABLE_NAMES),
      EUL4_VERSIONS: [
        {
          VER_RELEASE: '4.1.8.0.0',
          VER_MIN_CODE_VER: '4.1.0.0.0',
          VER_EUL_TIMESTAMP: '20011120080000',
        },
      ],
      EUL4_BAS: [
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
      EUL4_BA_OBJ_LINKS: [{ BOL_BA_ID: 10, BOL_OBJ_ID: 20 }],
      EUL4_OBJS: [
        {
          OBJ_ID: 20,
          OBJ_NAME: 'GL Balances',
          OBJ_DESCRIPTION: null,
          OBJ_TYPE: 'SOBJ',
          SOBJ_EXT_TABLE: 'GL_BALANCES_V',
          OBJ_EXT_OWNER: 'GL',
        },
      ],
      EUL4_EXPRESSIONS: [
        {
          EXP_ID: 30,
          IT_OBJ_ID: 20,
          EXP_NAME: 'Period Balance',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'CO',
          IT_EXT_COLUMN: 'PERIOD_NET_DR',
          EXP_DATA_TYPE: 'NUMBER',
          IT_FORMAT_MASK: '999999',
          IT_HEADING: null,
        },
        {
          EXP_ID: 31,
          IT_OBJ_ID: 20,
          EXP_NAME: 'Net Balance',
          EXP_DESCRIPTION: null,
          EXP_TYPE: 'CI',
          IT_EXT_COLUMN: null,
          EXP_DATA_TYPE: 'NUMBER',
          IT_FORMAT_MASK: null,
          IT_HEADING: null,
        },
      ],
      EUL4_KEY_CONS: [
        { KEY_ID: 40, KEY_OBJ_ID: 20, FK_OBJ_ID_REMOTE: 20, KEY_DESCRIPTION: 'Self join' },
      ],
      EUL4_HIERARCHIES: [
        { HI_ID: 50, BA_ID: 10, HI_NAME: 'Account Hierarchy', HI_DESCRIPTION: null },
      ],
      EUL4_HI_NODES: [{ HN_ID: 51, HN_HI_ID: 50, HN_EXP_ID: 30, HN_NAME: 'Company' }],
      EUL4_FUNCTIONS: [{ FUN_ID: 60, FUN_NAME: 'GL_PERIOD_NAME', FUN_DESCRIPTION: null }],
      EUL4_DOCUMENTS: [
        {
          DOC_ID: 70,
          DOC_NAME: 'Trial Balance',
          DOC_DESCRIPTION: null,
          DOC_CONTENT_TYPE: DISCOVERER_WORKBOOK_CONTENT_TYPE,
          DOC_DEVELOPER_KEY: null,
          DOC_DOCUMENT: TRIAL_BALANCE_BODY,
          DOC_LENGTH: TRIAL_BALANCE_BODY.length,
          DOC_BATCH: 0,
          DOC_CREATED_BY: 'ACLARK',
          DOC_CREATED_DATE: created,
          DOC_UPDATED_BY: 'ACLARK',
          DOC_UPDATED_DATE: created,
        },
      ],
      EUL4_EUL_USERS: [{ EU_ID: 80, EU_USERNAME: 'ACLARK', EU_ROLE_FLAG: 'N' }],
      EUL4_ACCESS_PRIVS: [
        {
          AP_ID: 90,
          AP_EU_ID: 80,
          GP_APP_ID: 1006,
          GBA_BA_ID: 10,
          GO_OBJ_ID: null,
          GD_DOC_ID: null,
          AP_CREATED_DATE: created,
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
      EUL_VERSIONS: [
        {
          VER_RELEASE: '3.1.36.0.0',
          VER_MIN_CODE_VER: '3.1.0.0.0',
          VER_EUL_TIMESTAMP: '19990101000000',
        },
      ],
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
