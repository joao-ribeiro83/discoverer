/**
 * Unit tests for the EUL → Discoverer Neo entity transformers.
 *
 * These operate on *normalized* entities (what `eul-reader` produces), so the
 * fixtures here are built directly rather than read through a mock Oracle —
 * the read path already has its own coverage in eul-schema-adapter.test.ts.
 */

import {
  FOLDER_TYPE_MAP_EUL4,
  FOLDER_TYPE_MAP_EUL5,
  ITEM_TYPE_MAP,
  JOIN_TYPE_MAP,
  transformBusinessArea,
  transformCustomFunction,
  transformFolder,
  transformGrant,
  transformGrants,
  transformHierarchy,
  transformItem,
  transformJoin,
  transformUser,
  transformUsers,
  transformWorkbook,
  usernameToEmailLocal,
} from '../services/transformers/index.js';
import type { ParsedWorkbook } from '../services/eul-reader.js';
import type {
  BusinessArea,
  CustomFunction,
  Folder,
  Grant,
  Hierarchy,
  Item,
  Join,
} from '../types/eul-versions.js';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const CREATED = new Date('2010-03-15T10:00:00Z');
const UPDATED = new Date('2012-06-01T09:30:00Z');

function ba(overrides: Partial<BusinessArea> = {}): BusinessArea {
  return {
    sourceId: 100,
    name: 'Sales Analysis',
    description: 'Sales BA',
    language: 'GB',
    developerKey: null,
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    updatedBy: 'DISCO_ADMIN2',
    updatedAt: UPDATED,
    ...overrides,
  };
}

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    sourceId: 200,
    businessAreaId: 100,
    name: 'Invoice Headers',
    description: 'AP invoice headers',
    folderType: 'TABLE',
    tableName: 'AP_INVOICES_ALL',
    tableOwner: 'APPS',
    sequence: 1,
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

function item(overrides: Partial<Item> = {}): Item {
  return {
    sourceId: 300,
    folderId: 200,
    name: 'Invoice Amount',
    description: 'Header amount',
    expType: 'CI',
    formula: null,
    columnName: 'INVOICE_AMOUNT',
    dataType: 'NUMBER',
    formatMask: '999,999.00',
    aggregation: 'SUM',
    sequence: 1,
    nullsAllowed: false,
    parentItemId: null,
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

function join(overrides: Partial<Join> = {}): Join {
  return {
    sourceId: 400,
    name: 'Invoices to Suppliers',
    description: 'FK join',
    joinType: 'INNER',
    components: [{ masterItemId: 300, detailItemId: 301, operator: '=' }],
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    ...overrides,
  };
}

function hierarchy(overrides: Partial<Hierarchy> = {}): Hierarchy {
  return {
    sourceId: 500,
    businessAreaId: 100,
    name: 'Time Hierarchy',
    description: 'Year > Quarter > Month',
    levels: [
      { sourceId: 510, hierarchyId: 500, itemId: 300, name: 'Year', levelNumber: 1 },
      { sourceId: 511, hierarchyId: 500, itemId: 301, name: 'Month', levelNumber: 2 },
    ],
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

function customFunction(overrides: Partial<CustomFunction> = {}): CustomFunction {
  return { sourceId: 600, name: 'GET_FISCAL_YEAR', description: 'Fiscal year lookup', ...overrides };
}

function workbook(overrides: Partial<ParsedWorkbook> = {}): ParsedWorkbook {
  return {
    sourceId: 700,
    name: 'Monthly Sales',
    description: 'Monthly sales workbook',
    content: '<workbook><worksheet name="Sales"/></workbook>',
    owner: 'JSMITH',
    developerKey: 'MONTHLY_SALES',
    createdBy: 'JSMITH',
    createdAt: CREATED,
    updatedBy: null,
    updatedAt: null,
    info: {
      parsed: true,
      rootName: 'workbook',
      worksheetCount: 1,
      worksheets: [{ name: 'Sales' }],
      itemReferenceCount: 0,
    },
    ...overrides,
  };
}

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    sourceId: 800,
    businessAreaId: 100,
    folderId: null,
    grantee: 'JSMITH',
    privType: 'BUSINESS_AREA',
    level: 'BUSINESS_AREA',
    createdBy: 'DISCO_ADMIN',
    createdAt: CREATED,
    ...overrides,
  };
}

const codes = (ws: { code: string }[]): string[] => ws.map((w) => w.code);

// ---------------------------------------------------------------------------
// Type map constants
// ---------------------------------------------------------------------------

describe('version-aware type maps', () => {
  it('EUL4 folder map has no DERIVED/SUMMARY; EUL5 adds them', () => {
    expect(Object.keys(FOLDER_TYPE_MAP_EUL4).sort()).toEqual(['COMPLEX', 'JOIN', 'TABLE', 'VIEW']);
    expect(FOLDER_TYPE_MAP_EUL4).not.toHaveProperty('DERIVED');
    expect(FOLDER_TYPE_MAP_EUL4).not.toHaveProperty('SUMMARY');
    expect(FOLDER_TYPE_MAP_EUL5.DERIVED).toBe('DERIVED');
    expect(FOLDER_TYPE_MAP_EUL5.SUMMARY).toBe('SUMMARY');
    // EUL5 is a superset of EUL4.
    for (const [k, v] of Object.entries(FOLDER_TYPE_MAP_EUL4)) {
      expect(FOLDER_TYPE_MAP_EUL5[k]).toBe(v);
    }
  });

  it('item type map covers every Neo item_type and deliberately excludes SM', () => {
    expect(Object.keys(ITEM_TYPE_MAP).sort()).toEqual(['AG', 'CI', 'CO', 'CU', 'FU', 'HI', 'JI']);
    // SM (Security Manager) has no Neo item_type — it becomes an RLS policy.
    expect(ITEM_TYPE_MAP).not.toHaveProperty('SM');
  });

  it('join type map sends EUL4 OUTER to LEFT', () => {
    expect(JOIN_TYPE_MAP.OUTER).toBe('LEFT');
    expect(JOIN_TYPE_MAP.INNER).toBe('INNER');
    expect(JOIN_TYPE_MAP.LEFT).toBe('LEFT');
    expect(JOIN_TYPE_MAP.RIGHT).toBe('RIGHT');
    expect(JOIN_TYPE_MAP.FULL).toBe('FULL');
  });
});

// ---------------------------------------------------------------------------
// Business area
// ---------------------------------------------------------------------------

describe('transformBusinessArea', () => {
  it('maps core fields for EUL5', () => {
    const t = transformBusinessArea(ba(), 'EUL5');
    expect(t).toMatchObject({
      sourceId: 100,
      name: 'Sales Analysis',
      description: 'Sales BA',
      isActive: true,
      createdByUsername: 'DISCO_ADMIN',
      updatedByUsername: 'DISCO_ADMIN2',
      createdAt: CREATED,
      updatedAt: UPDATED,
    });
  });

  it('flags a dropped EUL5 developer key (no Neo column)', () => {
    const t = transformBusinessArea(ba({ developerKey: 'SALES_BA' }), 'EUL5');
    expect(codes(t.warnings)).toContain('BA_DEVELOPER_KEY_DROPPED');
  });

  it('EUL4 has no language/developer key and produces no drop warning', () => {
    const t = transformBusinessArea(
      ba({ sourceId: 10, name: 'Finance', description: 'Finance BA', language: '', developerKey: null }),
      'EUL4',
    );
    expect(codes(t.warnings)).not.toContain('BA_DEVELOPER_KEY_DROPPED');
    expect(t.name).toBe('Finance');
  });

  it('substitutes a name when the source has none', () => {
    const t = transformBusinessArea(ba({ name: '  ' }), 'EUL5');
    expect(t.name).toBe('Business Area 100');
    expect(codes(t.warnings)).toContain('BA_MISSING_NAME');
  });
});

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

describe('transformFolder', () => {
  it.each(['TABLE', 'VIEW', 'COMPLEX', 'JOIN'])('maps %s identically in EUL4 and EUL5', (type) => {
    expect(transformFolder(folder({ folderType: type }), 'EUL4').folderType).toBe(type);
    expect(transformFolder(folder({ folderType: type }), 'EUL5').folderType).toBe(type);
  });

  it.each(['DERIVED', 'SUMMARY'])('maps EUL5-only type %s cleanly in EUL5', (type) => {
    const t = transformFolder(folder({ folderType: type }), 'EUL5');
    expect(t.folderType).toBe(type);
    expect(codes(t.warnings)).not.toContain('FOLDER_TYPE_UNEXPECTED');
  });

  it.each(['DERIVED', 'SUMMARY'])(
    'keeps %s in an EUL4 source but flags it as unexpected for the version',
    (type) => {
      const t = transformFolder(folder({ folderType: type }), 'EUL4');
      expect(t.folderType).toBe(type);
      expect(codes(t.warnings)).toContain('FOLDER_TYPE_UNEXPECTED');
    },
  );

  it('maps an unknown folder type to COMPLEX with a warning', () => {
    const t = transformFolder(folder({ folderType: 'WIDGET' }), 'EUL5');
    expect(t.folderType).toBe('COMPLEX');
    expect(codes(t.warnings)).toContain('FOLDER_TYPE_UNKNOWN');
  });

  it('is case-insensitive about the source type', () => {
    expect(transformFolder(folder({ folderType: 'table' }), 'EUL5').folderType).toBe('TABLE');
  });

  it('handles a missing EUL4 description as null', () => {
    const t = transformFolder(folder({ description: null }), 'EUL4');
    expect(t.description).toBeNull();
  });

  it('maps sequence to displayOrder and defaults it to 0', () => {
    expect(transformFolder(folder({ sequence: 7 }), 'EUL5').displayOrder).toBe(7);
    expect(transformFolder(folder({ sequence: null }), 'EUL5').displayOrder).toBe(0);
  });

  it('flags non-table folders that carry no source table', () => {
    const t = transformFolder(folder({ folderType: 'COMPLEX', tableName: null }), 'EUL5');
    expect(codes(t.warnings)).toContain('FOLDER_DEFINITION_INCOMPLETE');
  });
});

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

describe('transformItem', () => {
  it.each(['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU'])('maps EXP_TYPE %s to the same Neo item type', (type) => {
    const t = transformItem(item({ expType: type }), 'EUL5');
    expect(t.itemType).toBe(type);
    expect(t.skip).toBe(false);
  });

  it('skips SM (Security Manager) — no Neo item type exists for it', () => {
    const t = transformItem(item({ expType: 'SM', formula: "REGION = 'EMEA'" }), 'EUL5');
    expect(t.skip).toBe(true);
    expect(codes(t.warnings)).toContain('ITEM_SECURITY_MANAGER');
  });

  it('skips an unrecognized EXP_TYPE', () => {
    const t = transformItem(item({ expType: 'ZZ' }), 'EUL4');
    expect(t.skip).toBe(true);
    expect(codes(t.warnings)).toContain('ITEM_TYPE_UNKNOWN');
  });

  it('maps column/formula/format fields', () => {
    const t = transformItem(
      item({ expType: 'CU', formula: 'INVOICE_AMOUNT * 1.2', columnName: null, aggregation: 'NONE' }),
      'EUL5',
    );
    expect(t).toMatchObject({
      itemType: 'CU',
      formula: 'INVOICE_AMOUNT * 1.2',
      columnName: null,
      dataType: 'NUMBER',
      // 'NONE' means "no aggregation" in EUL and becomes NULL in Neo.
      aggFunction: null,
    });
  });

  it('keeps a real aggregation function', () => {
    expect(transformItem(item({ aggregation: 'SUM' }), 'EUL5').aggFunction).toBe('SUM');
  });

  it('transforms an EUL4 item that has no nulls-allowed / parent metadata', () => {
    const t = transformItem(
      item({ sourceId: 30, folderId: 20, name: 'Period Balance', nullsAllowed: true, parentItemId: null }),
      'EUL4',
    );
    expect(t.skip).toBe(false);
    expect(t.parentItemSourceId).toBeNull();
    expect(t.name).toBe('Period Balance');
  });

  it('carries EUL5 IT_EXP_ID through as the parent item reference', () => {
    const t = transformItem(item({ parentItemId: 299 }), 'EUL5');
    expect(t.parentItemSourceId).toBe(299);
  });
});

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

describe('transformJoin', () => {
  it('maps master/detail components to left/right', () => {
    const t = transformJoin(join(), 'EUL5');
    expect(t.components).toEqual([{ leftItemSourceId: 300, rightItemSourceId: 301, operator: '=' }]);
    expect(t.joinType).toBe('INNER');
  });

  it('maps a raw OUTER join type to LEFT (EUL4 semantics)', () => {
    const t = transformJoin(join({ joinType: 'OUTER' }), 'EUL4');
    expect(t.joinType).toBe('LEFT');
  });

  it.each(['INNER', 'LEFT', 'RIGHT', 'FULL'])('passes through normalized type %s', (type) => {
    expect(transformJoin(join({ joinType: type }), 'EUL5').joinType).toBe(type);
  });

  it('defaults an unknown join type to INNER with a warning', () => {
    const t = transformJoin(join({ joinType: 'SIDEWAYS' }), 'EUL5');
    expect(t.joinType).toBe('INNER');
    expect(codes(t.warnings)).toContain('JOIN_TYPE_UNKNOWN');
  });

  it('warns when a join has no components', () => {
    const t = transformJoin(join({ components: [] }), 'EUL4');
    expect(t.components).toHaveLength(0);
    expect(codes(t.warnings)).toContain('JOIN_NO_COMPONENTS');
  });

  it('keeps every component of a multi-component join', () => {
    const t = transformJoin(
      join({
        components: [
          { masterItemId: 300, detailItemId: 301, operator: '=' },
          { masterItemId: 300, detailItemId: 302, operator: '=' },
        ],
      }),
      'EUL5',
    );
    expect(t.components).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Hierarchy
// ---------------------------------------------------------------------------

describe('transformHierarchy', () => {
  it('maps a hierarchy and its levels (EUL5)', () => {
    const t = transformHierarchy(hierarchy(), 'EUL5');
    expect(t.name).toBe('Time Hierarchy');
    expect(t.businessAreaSourceId).toBe(100);
    expect(t.levels).toEqual([
      { sourceId: 510, itemSourceId: 300, levelName: 'Year', levelNumber: 1 },
      { sourceId: 511, itemSourceId: 301, levelName: 'Month', levelNumber: 2 },
    ]);
  });

  it('maps an EUL4 hierarchy whose levels came from the separate levels table', () => {
    const t = transformHierarchy(
      hierarchy({
        sourceId: 50,
        businessAreaId: 10,
        name: 'Account Hierarchy',
        description: null,
        levels: [{ sourceId: 51, hierarchyId: 50, itemId: 30, name: 'Company', levelNumber: 1 }],
      }),
      'EUL4',
    );
    expect(t.levels).toEqual([
      { sourceId: 51, itemSourceId: 30, levelName: 'Company', levelNumber: 1 },
    ]);
  });

  it('falls back to positional level numbers and names', () => {
    const t = transformHierarchy(
      hierarchy({
        levels: [{ sourceId: 512, hierarchyId: 500, itemId: 300, name: '', levelNumber: null }],
      }),
      'EUL5',
    );
    expect(t.levels[0]).toMatchObject({ levelName: 'Level 1', levelNumber: 1 });
  });

  it('warns about levels with no item (Neo requires one per level)', () => {
    const t = transformHierarchy(
      hierarchy({
        levels: [{ sourceId: 513, hierarchyId: 500, itemId: null, name: 'Orphan', levelNumber: 1 }],
      }),
      'EUL5',
    );
    expect(codes(t.warnings)).toContain('HIER_LEVEL_NO_ITEM');
  });
});

// ---------------------------------------------------------------------------
// Custom function / workbook / user / grant
// ---------------------------------------------------------------------------

describe('transformCustomFunction', () => {
  it('defaults to PL/SQL and flags the incomplete signature', () => {
    const t = transformCustomFunction(customFunction(), 'EUL5');
    expect(t).toMatchObject({
      name: 'GET_FISCAL_YEAR',
      functionType: 'PLSQL',
      returnType: null,
      parameters: null,
      isActive: true,
    });
    expect(codes(t.warnings)).toContain('FUNCTION_SIGNATURE_DEFAULTED');
  });

  it('handles an EUL4 function with no description', () => {
    const t = transformCustomFunction(customFunction({ sourceId: 60, name: 'GL_PERIOD_NAME', description: null }), 'EUL4');
    expect(t.description).toBeNull();
    expect(t.name).toBe('GL_PERIOD_NAME');
  });
});

describe('transformWorkbook', () => {
  it('maps a parsed EUL5 workbook to a TABLE map owned by DOC_WORKBOOK_OWNER', () => {
    const t = transformWorkbook(workbook(), 'EUL5');
    expect(t).toMatchObject({
      sourceId: 700,
      name: 'Monthly Sales',
      mapType: 'TABLE',
      ownerUsername: 'JSMITH',
      isPublic: false,
      worksheetCount: 1,
    });
    // Worksheet layout can't be reconstructed from the proprietary blob.
    expect(t.items).toHaveLength(0);
    expect(codes(t.warnings)).toContain('WORKBOOK_LAYOUT_MANUAL');
  });

  it('falls back to DOC_CREATED_BY when there is no workbook owner (EUL4)', () => {
    const t = transformWorkbook(
      workbook({ sourceId: 70, name: 'Trial Balance', owner: null, createdBy: 'ACLARK', developerKey: null }),
      'EUL4',
    );
    expect(t.ownerUsername).toBe('ACLARK');
  });

  it('flags content that could not be parsed', () => {
    const t = transformWorkbook(
      workbook({
        content: 'binary-blob',
        info: { parsed: false, rootName: null, worksheetCount: 0, worksheets: [], itemReferenceCount: 0, parseError: 'bad xml' },
      }),
      'EUL5',
    );
    expect(codes(t.warnings)).toContain('WORKBOOK_UNPARSED');
  });
});

describe('transformUser', () => {
  it('synthesizes an email and disables login', () => {
    const t = transformUser({ username: 'JSMITH', source: 'ELEM_ACCESS' }, 'EUL5');
    expect(t).toMatchObject({
      username: 'JSMITH',
      email: 'jsmith@migrated.local',
      name: 'JSMITH',
      role: 'USER',
    });
    // Not a valid bcrypt hash — no password can ever match it.
    expect(t.passwordHash).not.toMatch(/^\$2[aby]\$/);
  });

  it('sanitizes usernames that are not email-safe', () => {
    expect(usernameToEmailLocal('APPS#PROD')).toBe('apps_prod');
    expect(usernameToEmailLocal('!!!')).toBe('user');
    const t = transformUser({ username: 'APPS#PROD', source: 'ELEM_ACCESS' }, 'EUL4');
    expect(t.email).toBe('apps_prod@migrated.local');
    expect(codes(t.warnings)).toContain('USER_EMAIL_SYNTHESIZED');
  });

  it('transformUsers maps a list', () => {
    const ts = transformUsers(
      [
        { username: 'JSMITH', source: 'ELEM_ACCESS' },
        { username: 'MJONES', source: 'ELEM_ACCESS' },
      ],
      'EUL5',
    );
    expect(ts.map((t) => t.email)).toEqual(['jsmith@migrated.local', 'mjones@migrated.local']);
  });
});

describe('transformGrant', () => {
  it('maps a business-area grant to a VIEW permission', () => {
    const t = transformGrant(grant(), 'EUL5');
    expect(t).toMatchObject({
      granteeUsername: 'JSMITH',
      businessAreaSourceId: 100,
      level: 'BUSINESS_AREA',
      permissionLevel: 'VIEW',
      skip: false,
    });
  });

  it('keeps a folder-level grant for the runner to resolve to the folder’s BA', () => {
    const t = transformGrant(
      grant({ sourceId: 801, businessAreaId: null, folderId: 200, privType: 'OBJECT', level: 'FOLDER' }),
      'EUL5',
    );
    expect(t).toMatchObject({ level: 'FOLDER', folderSourceId: 200, skip: false });
  });

  it('skips a grant with neither a business area nor a folder', () => {
    const t = transformGrant(grant({ businessAreaId: null, folderId: null }), 'EUL4');
    expect(t.skip).toBe(true);
    expect(codes(t.warnings)).toContain('GRANT_NO_BA');
  });

  it('defaults an unknown privilege type to VIEW', () => {
    expect(transformGrant(grant({ privType: 'MYSTERY' }), 'EUL5').permissionLevel).toBe('VIEW');
  });

  it('transformGrants maps a list', () => {
    expect(transformGrants([grant(), grant({ sourceId: 802 })], 'EUL5')).toHaveLength(2);
  });
});
