/**
 * Unit tests for the EUL → Discoverer Neo entity transformers.
 *
 * These operate on *normalized* entities (what `eul-reader` produces), so the
 * fixtures here are built directly rather than read through a mock Oracle —
 * the read path already has its own coverage in eul-schema-adapter.test.ts.
 */

import {
  buildMapConditionRows,
  buildMapLayoutRow,
  buildMapPageSetupRow,
  buildMapTotalRow,
  defaultAggregateBySourceId,
  mapItemAggFunction,
  FOLDER_TYPE_MAP_EUL4,
  FOLDER_TYPE_MAP_EUL5,
  ITEM_TYPE_MAP,
  JOIN_TYPE_MAP,
  makeBindName,
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
import { parseWorkbookContent, summarizeWorkbookDocument } from '../services/eul-reader.js';
import { buildWorkbookFixture } from '../testing/workbook-fixture.js';
import type {
  TransformedMapCondition,
  TransformedMapItem,
  TransformedMapTotal,
} from '../services/transformers/index.js';
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
    sharedBusinessAreaIds: [100],
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
    // A join binds folders; item-level keys are optional.
    masterFolderId: 200,
    detailFolderId: 201,
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
    // A node tree with derived depths, not numbered levels.
    nodes: [
      { sourceId: 510, hierarchyId: 500, itemId: 300, name: 'Year', parentNodeId: null, depth: 1 },
      { sourceId: 511, hierarchyId: 500, itemId: 301, name: 'Month', parentNodeId: 510, depth: 2 },
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

const DEFAULT_WORKBOOK_BODY = buildWorkbookFixture({
  name: 'Monthly Sales',
  worksheets: [
    {
      name: 'Sales',
      title: 'Monthly Sales Report',
      columns: [
        { folderLabel: 'Invoice Headers', itemLabel: 'Invoice Amount', heading: 'Amount' },
      ],
    },
  ],
});

function workbook(overrides: Partial<ParsedWorkbook> = {}): ParsedWorkbook {
  const content = overrides.content ?? DEFAULT_WORKBOOK_BODY;
  const document = overrides.document ?? parseWorkbookContent(content);
  return {
    sourceId: 700,
    name: 'Monthly Sales',
    description: 'Monthly sales workbook',
    contentType: 'application/vnd.oracle-disco.wb',
    contentLength: Buffer.isBuffer(content) ? content.length : null,
    isBatch: false,
    owner: 'JSMITH',
    developerKey: 'MONTHLY_SALES',
    createdBy: 'JSMITH',
    createdAt: CREATED,
    updatedBy: null,
    updatedAt: null,
    ...overrides,
    content,
    document,
    info: summarizeWorkbookDocument(document),
  };
}

function grant(overrides: Partial<Grant> = {}): Grant {
  return {
    sourceId: 800,
    businessAreaId: 100,
    folderId: null,
    documentId: null,
    grantee: 'JSMITH',
    granteeIsRole: false,
    privCode: 1006,
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

  it('raises no developer-key warning — BAS has no such column', () => {
    const t = transformBusinessArea(ba(), 'EUL5');
    expect(codes(t.warnings)).not.toContain('BA_DEVELOPER_KEY_DROPPED');
  });

  it('EUL4 maps the same fields as EUL5', () => {
    const t = transformBusinessArea(
      ba({ sourceId: 10, name: 'Finance', description: 'Finance BA' }),
      'EUL4',
    );
    expect(t.name).toBe('Finance');
  });

  it('warns when a folder is shared across business areas', () => {
    // BA_OBJ_LINKS is many-to-many; Neo's folders.business_area_id is not.
    const t = transformFolder(
      folder({ businessAreaId: 100, sharedBusinessAreaIds: [100, 200, 300] }),
      'EUL5',
    );
    expect(codes(t.warnings)).toContain('FOLDER_SHARED_ACROSS_BUSINESS_AREAS');
  });

  it('does not warn for a folder in exactly one business area', () => {
    const t = transformFolder(folder(), 'EUL5');
    expect(codes(t.warnings)).not.toContain('FOLDER_SHARED_ACROSS_BUSINESS_AREAS');
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

  // Oracle's `/aggregate` grammar is SUM|MAX|MIN|COUNT|AVG|DETAIL. `Detail` is
  // the marker for *no* aggregation and 8 152 of the estate's items carry it,
  // so it must not reach a column the SQL generator reads as a function.
  it("treats Oracle's Detail marker as no aggregation", () => {
    expect(transformItem(item({ aggregation: 'Detail' }), 'EUL4').aggFunction).toBeNull();
  });

  it('normalizes case rather than storing whatever the EUL spells', () => {
    expect(transformItem(item({ aggregation: 'sum' }), 'EUL4').aggFunction).toBe('SUM');
  });

  // `agg_function` feeds `select-clause.ts` and the fan-trap guard's measure
  // set. A name outside Neo's five is not a label to display; it is a throw or
  // a measure that cannot be re-aggregated.
  it('drops a function Neo cannot run instead of passing it through', () => {
    expect(transformItem(item({ aggregation: 'STDDEV' }), 'EUL4').aggFunction).toBeNull();
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

  it('does NOT warn about a component-less join — folder-level is the norm', () => {
    // KEY_CONS binds folders; item-level keys are optional, and Neo's join
    // item ids are nullable. A join with no components is fully migratable.
    const t = transformJoin(join({ components: [] }), 'EUL4');
    expect(t.components).toHaveLength(0);
    expect(codes(t.warnings)).not.toContain('JOIN_NO_COMPONENTS');
    expect(codes(t.warnings)).not.toContain('JOIN_NO_FOLDERS');
  });

  it('warns when a join is missing a folder on either side', () => {
    const t = transformJoin(join({ detailFolderId: null }), 'EUL4');
    expect(codes(t.warnings)).toContain('JOIN_NO_FOLDERS');
  });

  it('carries the folder ids through to the Neo shape', () => {
    const t = transformJoin(join(), 'EUL5');
    expect(t.leftFolderSourceId).toBe(200);
    expect(t.rightFolderSourceId).toBe(201);
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
      { sourceId: 510, itemSourceId: 300, levelName: 'Year', levelNumber: 1, parentSourceId: null },
      { sourceId: 511, itemSourceId: 301, levelName: 'Month', levelNumber: 2, parentSourceId: 510 },
    ]);
  });

  it('maps an EUL4 hierarchy node tree', () => {
    const t = transformHierarchy(
      hierarchy({
        sourceId: 50,
        businessAreaId: 10,
        name: 'Account Hierarchy',
        description: null,
        nodes: [{ sourceId: 51, hierarchyId: 50, itemId: 30, name: 'Company', parentNodeId: null, depth: 1 }],
      }),
      'EUL4',
    );
    expect(t.levels).toEqual([
      { sourceId: 51, itemSourceId: 30, levelName: 'Company', levelNumber: 1, parentSourceId: null },
    ]);
  });

  it('falls back to positional level numbers and names', () => {
    const t = transformHierarchy(
      hierarchy({
        nodes: [{ sourceId: 512, hierarchyId: 500, itemId: 300, name: '', parentNodeId: null, depth: null }],
      }),
      'EUL5',
    );
    expect(t.levels[0]).toMatchObject({ levelName: 'Level 1', levelNumber: 1 });
  });

  it('warns about levels with no item (Neo requires one per level)', () => {
    const t = transformHierarchy(
      hierarchy({
        nodes: [{ sourceId: 513, hierarchyId: 500, itemId: null, name: 'Orphan', parentNodeId: null, depth: 1 }],
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
  it('maps a decoded workbook to one map per worksheet, with its columns', () => {
    const [map, ...rest] = transformWorkbook(workbook(), 'EUL5');
    expect(rest).toHaveLength(0);
    expect(map).toMatchObject({
      sourceId: 700,
      worksheetIndex: 0,
      name: 'Monthly Sales',
      mapType: 'TABLE',
      ownerUsername: 'JSMITH',
      isPublic: false,
      worksheetCount: 1,
    });
    // The worksheet's printed title is more useful than the workbook
    // description, so it wins.
    expect(map?.description).toBe('Monthly Sales Report');
    expect(map?.items).toEqual([
      expect.objectContaining({
        folderLabel: 'Invoice Headers',
        itemLabel: 'Invoice Amount',
        displayName: 'Amount',
        displayOrder: 0,
      }),
    ]);
  });

  // The printed title is a heading Discoverer drew above the data; the map's
  // name is the worksheet's name. Neither substitutes for the other, and the
  // layout row is the only place the heading can live.
  it('carries the worksheet identity and its printed title, all three forms', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      worksheets: [
        {
          name: 'Folha 1',
          title: 'Vendas por Região',
          titleRtf: '{\\rtf1 Vendas por Região}',
          titleHtml: '<b>Vendas por Região</b>',
          guid: 'A1B2-C3D4',
          columns: [{ itemLabel: 'A' }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ name: 'WB', content }), 'EUL5');
    expect(map?.layout).toMatchObject({
      worksheetIndex: 0,
      worksheetGuid: 'A1B2-C3D4',
      title: 'Vendas por Região',
      titleRtf: '{\\rtf1 Vendas por Região}',
      titleHtml: '<b>Vendas por Região</b>',
      queryCount: 1,
    });
    expect(map?.layout.sourceElementId).toEqual(expect.any(Number));
  });

  // A worksheet that names no layout has no query links to count; 0 would
  // claim it ran no query.
  it('leaves the query count null when the layout did not decode', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      worksheets: [{ name: 'Folha 1', columns: [{ itemLabel: 'A' }], undecodableLayout: true }],
    });
    const [map] = transformWorkbook(workbook({ name: 'WB', content }), 'EUL5');
    expect(map?.layout.queryCount).toBeNull();
    expect(map?.layout.worksheetIndex).toBe(0);
  });

  it('splits a multi-worksheet workbook into one map per worksheet', () => {
    const content = buildWorkbookFixture({
      name: 'Sinistros',
      worksheets: [
        { name: 'Carteira', columns: [{ folderLabel: 'F', itemLabel: 'A' }] },
        { name: 'Contencioso', columns: [{ folderLabel: 'F', itemLabel: 'B' }] },
      ],
    });
    const maps = transformWorkbook(workbook({ name: 'Sinistros', content }), 'EUL5');
    expect(maps.map((m) => m.name)).toEqual([
      'Sinistros — Carteira',
      'Sinistros — Contencioso',
    ]);
    expect(maps.map((m) => m.items.map((i) => i.itemLabel))).toEqual([['A'], ['B']]);
    expect(maps.every((m) => m.sourceId === 700)).toBe(true);
  });

  it('keeps the workbook name when it has a single worksheet', () => {
    const content = buildWorkbookFixture({
      name: 'M172',
      worksheets: [{ name: 'Folha 1', columns: [{ itemLabel: 'A' }] }],
    });
    const maps = transformWorkbook(workbook({ name: 'M172', content }), 'EUL4');
    expect(maps.map((m) => m.name)).toEqual(['M172']);
  });

  it('carries conditions, parameters and calculations onto the map', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ folderLabel: 'Fin', itemLabel: 'Amount' }],
      parameters: [{ name: 'Dt Fim', prompt: 'Indique data fim', defaultValue: '01-JAN-2024' }],
      conditions: [
        { sql: 'Amount >= :Dt Fim', operatorCode: 86, item: 'Amount', parameter: 'Dt Fim' },
      ],
      worksheets: [
        {
          name: 'S',
          columns: [{ folderLabel: 'Fin', itemLabel: 'Amount' }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.parameters).toEqual([
      expect.objectContaining({
        name: 'Dt Fim',
        bindName: 'DT_FIM',
        paramType: 'DATE',
        defaultValue: '01-JAN-2024',
      }),
    ]);
    // The condition names the parameter's bind name, not its prompt: `Dt Fim`
    // cannot be a bind variable.
    expect(map?.conditions).toEqual([
      expect.objectContaining({ operator: '>=', paramName: 'DT_FIM', conditionType: 'PARAMETER' }),
    ]);
  });

  // The defect this guards: Discoverer let an author name a prompt anything,
  // and a migrated EUL is full of names no bind variable can have. Binding the
  // prompt verbatim threw at SQL generation, so 63% of every parameter-driven
  // filter could not run at all.
  it('derives a bind-safe name for prompts that cannot be bind variables', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'Fim' }, { itemLabel: 'Apolice' }],
      parameters: [
        { name: 'Dt Fim Vigência >=', prompt: 'Data fim', defaultValue: '01-JAN-2024' },
        { name: 'Apólice nº', prompt: 'Apolice' },
      ],
      conditions: [
        { sql: 'Fim >= :p', operatorCode: 86, item: 'Fim', parameter: 'Dt Fim Vigência >=' },
        { sql: 'Apolice = :p', operatorCode: 81, item: 'Apolice', parameter: 'Apólice nº' },
      ],
      worksheets: [{ name: 'S', columns: [{ itemLabel: 'Fim' }] }],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');

    // The prompt survives untouched — it is what the user is asked at run time.
    expect(map?.parameters.map((p) => [p.name, p.bindName])).toEqual([
      ['Dt Fim Vigência >=', 'DT_FIM_VIG_NCIA'],
      ['Apólice nº', 'AP_LICE_N'],
    ]);
    expect(map?.conditions.map((c) => c.paramName)).toEqual([
      'DT_FIM_VIG_NCIA',
      'AP_LICE_N',
    ]);
    for (const parameter of map?.parameters ?? []) {
      expect(parameter.bindName).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    }
  });

  it('keeps two prompts that reduce to the same base as two distinct binds', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'Inicio' }, { itemLabel: 'Fim' }],
      parameters: [
        { name: 'Dt Anulação A', prompt: 'de' },
        { name: 'Dt Anulação-A', prompt: 'ate' },
      ],
      conditions: [
        { sql: 'Inicio >= :p', operatorCode: 86, item: 'Inicio', parameter: 'Dt Anulação A' },
        { sql: 'Fim <= :p', operatorCode: 85, item: 'Fim', parameter: 'Dt Anulação-A' },
      ],
      worksheets: [{ name: 'S', columns: [{ itemLabel: 'Inicio' }] }],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');

    const binds = map?.parameters.map((p) => p.bindName) ?? [];
    expect(binds).toEqual(['DT_ANULA_O_A', 'DT_ANULA_O_A_2']);
    // Collapsing these onto one bind would silently fold a two-sided date
    // range into a single filter.
    expect(new Set(binds).size).toBe(2);
    expect(map?.conditions.map((c) => c.paramName)).toEqual(binds);
  });

  it('splits a compound condition into one row per test, grouped for the SQL', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'Estado' }, { itemLabel: 'Ramo' }, { itemLabel: 'Valor' }],
      conditions: [
        {
          // Valor > 0 AND (Estado = 'V' OR Ramo = 'A')
          sql: "Valor > 0 AND (Estado = 'V' OR Ramo = 'A')",
          operatorCode: 98,
          args: [
            { operatorCode: 83, item: 'Valor', literals: ['0'], literalKind: 2 },
            {
              operatorCode: 99,
              args: [
                { operatorCode: 81, item: 'Estado', literals: ['V'] },
                { operatorCode: 81, item: 'Ramo', literals: ['A'] },
              ],
            },
          ],
        },
      ],
      worksheets: [{ name: 'S', columns: [{ item: 'Valor' }] }],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');

    expect(map?.conditions).toHaveLength(3);
    expect(map?.conditions.map((c) => [c.itemLabel, c.operator, c.value])).toEqual([
      ['Valor', '>', '0'],
      ['Estado', '=', 'V'],
      ['Ramo', '=', 'A'],
    ]);
    // The lone test stands on its own; the OR pair shares a key so the SQL
    // generator brackets it.
    expect(map?.conditions[0]?.groupKey).toBeNull();
    expect(map?.conditions[1]?.groupKey).not.toBeNull();
    expect(map?.conditions[1]?.groupKey).toBe(map?.conditions[2]?.groupKey);
    // First row of a group says how the group joins the previous one; the rest
    // say how they join inside it.
    expect(map?.conditions.map((c) => c.logicOperator)).toEqual(['AND', 'AND', 'OR']);
    expect(map?.conditions.map((c) => c.displayOrder)).toEqual([0, 1, 2]);
    expect(new Set(map?.conditions.map((c) => c.sourceIndex))).toEqual(new Set([0]));
    expect(codes(map?.warnings ?? [])).not.toContain('CONDITION_OPERATOR_UNMAPPED');
  });

  it('numbers rows across conditions so grouping survives the sort', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'A' }, { itemLabel: 'B' }, { itemLabel: 'C' }],
      conditions: [
        {
          operatorCode: 99,
          args: [
            { operatorCode: 81, item: 'A', literals: ['1'] },
            { operatorCode: 81, item: 'B', literals: ['2'] },
          ],
        },
        { operatorCode: 81, item: 'C', literals: ['3'] },
      ],
      worksheets: [{ name: 'S', columns: [{ item: 'A' }] }],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.conditions.map((c) => c.displayOrder)).toEqual([0, 1, 2]);
    expect(map?.conditions.map((c) => c.sourceIndex)).toEqual([0, 0, 1]);
    // Two conditions must not share a group key.
    expect(map?.conditions[2]?.groupKey).toBeNull();
  });

  it('reports a condition whose operator has no Neo equivalent instead of guessing', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'Estado' }],
      // [1,91] is NOT IN — deliberately absent from the Neo operator map,
      // because migrating it as IN would invert the filter.
      conditions: [
        {
          sql: "Estado NOT IN ('M','A')",
          operatorCode: 91,
          item: 'Estado',
          literals: ['M', 'A'],
        },
      ],
      worksheets: [{ name: 'S', columns: [{ itemLabel: 'Estado' }] }],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    // Nothing is written at all: a row with a null operator used to reach the
    // writer and be dropped there, which made "reported" and "migrated" two
    // different counts of the same condition.
    expect(map?.conditions).toEqual([]);
    expect(codes(map?.warnings ?? [])).toContain('CONDITION_OPERATOR_UNMAPPED');
    expect(map?.warnings.find((w) => w.code === 'CONDITION_OPERATOR_UNMAPPED')?.message).toContain(
      'NOT IN is a negated test',
    );
  });

  it('warns that conditions are workbook-wide when there are several worksheets', () => {
    const content = buildWorkbookFixture({
      name: 'WB',
      items: [{ itemLabel: 'A' }],
      conditions: [{ sql: 'A = 1', operatorCode: 81, item: 'A', literals: ['1'] }],
      worksheets: [
        { name: 'One', columns: [{ itemLabel: 'A' }] },
        { name: 'Two', columns: [{ itemLabel: 'A' }] },
      ],
    });
    const maps = transformWorkbook(workbook({ content }), 'EUL4');
    expect(maps).toHaveLength(2);
    for (const map of maps) {
      expect(codes(map.warnings)).toContain('CONDITIONS_WORKBOOK_WIDE');
      expect(map.conditions).toHaveLength(1);
    }
  });

  it('falls back to DOC_CREATED_BY when there is no workbook owner (EUL4)', () => {
    const [map] = transformWorkbook(
      workbook({ sourceId: 70, name: 'Trial Balance', owner: null, createdBy: 'ACLARK', developerKey: null }),
      'EUL4',
    );
    expect(map?.ownerUsername).toBe('ACLARK');
  });

  it('still produces one map, flagged, when the body cannot be decoded', () => {
    const maps = transformWorkbook(
      workbook({ content: Buffer.from('binary-blob-that-is-not-a-workbook', 'latin1') }),
      'EUL5',
    );
    expect(maps).toHaveLength(1);
    expect(maps[0]?.items).toHaveLength(0);
    expect(maps[0]?.mapType).toBe('TABLE');
    expect(maps[0]?.selectDistinct).toBe(false);
    expect(codes(maps[0]?.warnings ?? [])).toContain('WORKBOOK_LAYOUT_MANUAL');
  });

  // --- the worksheet layout (EUL_SCHEMA_GROUND_TRUTH.md §7.8) --------------

  const layoutWorkbook = (): Buffer =>
    buildWorkbookFixture({
      name: 'Vendas',
      items: [
        { folderLabel: 'Vendas', itemLabel: 'Regiao', sourceId: 101 },
        { folderLabel: 'Vendas', itemLabel: 'Ano', sourceId: 102 },
        { folderLabel: 'Vendas', itemLabel: 'Valor', sourceId: 103 },
        { folderLabel: 'Vendas', itemLabel: 'Custo', sourceId: 104 },
      ],
      calculations: [
        { name: 'Margem', formula: '[1,1]([6,3])', placement: 1, hidden: false },
        { name: 'Nao Usada', formula: '[1,1]([6,4])', placement: 0, hidden: true },
      ],
      worksheets: [
        {
          name: 'Crosstab',
          viewType: 'CROSSTAB',
          distinct: true,
          columns: [
            { item: 'Regiao', axisType: 0 },
            { item: 'Ano', axisType: 2 },
            { item: 'Valor', axisType: 1 },
          ],
          hiddenItems: ['Custo'],
        },
      ],
    });

  it('carries the view type and Distinct onto the map', () => {
    const [map] = transformWorkbook(workbook({ content: layoutWorkbook() }), 'EUL4');
    expect(map).toMatchObject({ mapType: 'CROSSTAB', selectDistinct: true });
  });

  it('gives each column its axis and its position on that axis', () => {
    const [map] = transformWorkbook(workbook({ content: layoutWorkbook() }), 'EUL4');
    expect(map?.items.slice(0, 3)).toEqual([
      expect.objectContaining({
        itemLabel: 'Regiao',
        axisType: 'AXIS',
        axisOrder: 0,
        isHidden: false,
        displayOrder: 0,
      }),
      // A page item is an axis item to the query, so it is numbered there —
      // but Neo records it as PAGE, which is what Discoverer drew.
      expect.objectContaining({ itemLabel: 'Ano', axisType: 'PAGE', axisOrder: 1 }),
      // Measures are numbered among themselves: the third column, first measure.
      expect.objectContaining({ itemLabel: 'Valor', axisType: 'MEASURE', axisOrder: 0 }),
    ]);
  });

  it('migrates an item the query names but no column displays, as hidden', () => {
    const [map] = transformWorkbook(workbook({ content: layoutWorkbook() }), 'EUL4');
    expect(map?.items).toHaveLength(4);
    expect(map?.items[3]).toEqual(
      expect.objectContaining({
        itemLabel: 'Custo',
        itemSourceId: 104,
        isHidden: true,
        axisType: 'AXIS',
        axisOrder: 2,
        // No heading and no mask: Discoverer never drew it.
        displayName: null,
        formatMask: null,
        // After the columns, so display_order stays unique within the map.
        displayOrder: 3,
      }),
    );
  });

  it("carries a calculation's Placement and Hidden onto its calculated field", () => {
    const [map] = transformWorkbook(workbook({ content: layoutWorkbook() }), 'EUL4');
    expect(map?.calculatedFields).toEqual([
      expect.objectContaining({ name: 'Margem', axisType: 'MEASURE', isHidden: false }),
      // Placement 0 is "not placed on this sheet", which `isHidden` records —
      // it is not a third axis.
      expect.objectContaining({ name: 'Nao Usada', axisType: null, isHidden: true }),
    ]);
  });

  it('migrates a worksheet whose layout did not decode exactly as it did before', () => {
    const content = buildWorkbookFixture({
      name: 'Sem Layout',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }, { folderLabel: 'Vendas', itemLabel: 'Valor' }],
      worksheets: [
        {
          name: 'S',
          undecodableLayout: true,
          viewType: 'CROSSTAB',
          distinct: true,
          columns: [{ item: 'Regiao', axisType: 0 }, { item: 'Valor', axisType: 1 }],
          hiddenItems: ['Valor'],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    // A table that selects every row — never a guessed crosstab or axis.
    expect(map).toMatchObject({ mapType: 'TABLE', selectDistinct: false });
    expect(map?.items).toEqual([
      expect.objectContaining({ itemLabel: 'Regiao', axisType: null, axisOrder: null, isHidden: false }),
      expect.objectContaining({ itemLabel: 'Valor', axisType: null, axisOrder: null, isHidden: false }),
    ]);
    expect(codes(map?.warnings ?? [])).toContain('WORKSHEET_LAYOUT_UNDECODED');
  });

  it('does not warn about the layout when it decoded', () => {
    const [map] = transformWorkbook(workbook({ content: layoutWorkbook() }), 'EUL4');
    expect(codes(map?.warnings ?? [])).not.toContain('WORKSHEET_LAYOUT_UNDECODED');
  });

  // --- sorting (§7.8.6) ---------------------------------------------------

  /**
   * A sheet sorted the way the reports this migration was built for sort:
   * a grouped (break) sort first, then an ordinary one, then a descending
   * one — which is Discoverer's own precedence, the order `Sort Item Usage`
   * prints and `EUL Sort Item Reference` is written in.
   */
  const sortedWorkbook = (): Buffer =>
    buildWorkbookFixture({
      name: 'Vendas',
      items: [
        { folderLabel: 'Vendas', itemLabel: 'Regiao', sourceId: 101 },
        { folderLabel: 'Vendas', itemLabel: 'Ano', sourceId: 102 },
        { folderLabel: 'Vendas', itemLabel: 'Valor', sourceId: 103 },
        { folderLabel: 'Vendas', itemLabel: 'Custo', sourceId: 104 },
      ],
      worksheets: [
        {
          name: 'S',
          columns: [
            { item: 'Regiao', axisType: 0 },
            { item: 'Ano', axisType: 0 },
            { item: 'Valor', axisType: 1 },
          ],
          // `Custo` is queried but drawn nowhere, and is sorted on anyway.
          hiddenItems: ['Custo'],
          sorts: [
            { item: 'Regiao', direction: 1, grouped: true },
            { item: 'Ano', direction: 1 },
            { item: 'Custo', direction: 2 },
          ],
        },
      ],
    });

  it('gives each sorted column its direction, its precedence and its break flag', () => {
    const [map] = transformWorkbook(workbook({ content: sortedWorkbook() }), 'EUL4');
    expect(map?.items).toEqual([
      expect.objectContaining({
        itemLabel: 'Regiao',
        sortDirection: 'ASC',
        sortOrder: 0,
        // A group sort — Oracle's `IsABreak`, the feature these reports lean on.
        sortGroup: true,
      }),
      expect.objectContaining({
        itemLabel: 'Ano',
        sortDirection: 'ASC',
        sortOrder: 1,
        sortGroup: false,
      }),
      // Not sorted at all: no direction, no position, no group.
      expect.objectContaining({
        itemLabel: 'Valor',
        sortDirection: null,
        sortOrder: null,
        sortGroup: false,
      }),
      // A sort can name an item nothing draws; the row records it.
      expect.objectContaining({
        itemLabel: 'Custo',
        isHidden: true,
        sortDirection: 'DESC',
        sortOrder: 2,
      }),
    ]);
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_SORT_ITEM_UNRESOLVED');
  });

  it('leaves a worksheet whose layout did not decode with no sorting at all', () => {
    const content = buildWorkbookFixture({
      name: 'Sem Layout',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }],
      worksheets: [
        {
          name: 'S',
          undecodableLayout: true,
          columns: [{ item: 'Regiao', axisType: 0 }],
          sorts: [{ item: 'Regiao', direction: 2, grouped: true }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.items).toEqual([
      expect.objectContaining({ sortDirection: null, sortOrder: null, sortGroup: false }),
    ]);
  });

  it('reports a sort on a workbook calculation, which map_items cannot hold', () => {
    const content = buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }],
      worksheets: [
        {
          name: 'S',
          columns: [
            { item: 'Regiao', axisType: 0 },
            { calculation: true, itemLabel: 'Margem', axisType: 1 },
          ],
          sorts: [{ item: 'Margem', direction: 2 }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    // The sort is carried on the transformed row, so nothing is silently
    // dropped before the runner — which then has no map_items row to write it
    // to, because a calculation column becomes a calculated field.
    expect(map?.items[1]).toEqual(
      expect.objectContaining({ isCalculation: true, sortDirection: 'DESC', sortOrder: 0 }),
    );
    expect(codes(map?.warnings ?? [])).toContain('MAP_SORT_ON_CALCULATION');
  });

  it('does not warn about sorting when every sort landed on a column', () => {
    const [map] = transformWorkbook(workbook({ content: sortedWorkbook() }), 'EUL4');
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_SORT_ON_CALCULATION');
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_SORT_DIRECTION_UNKNOWN');
  });

  it('keeps a sort position but no direction when Direction is not 1 or 2', () => {
    const content = buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }],
      worksheets: [
        {
          name: 'S',
          columns: [{ item: 'Regiao', axisType: 0 }],
          sorts: [{ item: 'Regiao', direction: 9 }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.items[0]).toEqual(
      expect.objectContaining({ sortDirection: null, sortOrder: 0 }),
    );
    expect(codes(map?.warnings ?? [])).toContain('MAP_SORT_DIRECTION_UNKNOWN');
  });

  // --- totals (§7.8.7, §7.12) ---------------------------------------------

  /**
   * A sheet totalled the way the source's `… — TOTALIZADORES` reports are: a
   * subtotal at each change in the grouped column, then a grand total over the
   * same measure.
   */
  const totalledWorkbook = (): Buffer =>
    buildWorkbookFixture({
      name: 'Vendas',
      items: [
        { folderLabel: 'Vendas', itemLabel: 'Regiao', sourceId: 101 },
        { folderLabel: 'Vendas', itemLabel: 'Valor', sourceId: 103 },
      ],
      worksheets: [
        {
          name: 'S',
          columns: [
            { item: 'Regiao', axisType: 0 },
            { item: 'Valor', axisType: 1 },
          ],
          sorts: [{ item: 'Regiao', direction: 1, grouped: true }],
          totals: [
            {
              label: 'SubTotal por &Value',
              functionCode: 1,
              placementCode: 1,
              column: 1,
              breakColumn: 0,
              dataStyleRef: 41,
              flags: [1, undefined, 3],
            },
            { label: 'Total Geral', functionCode: 1, placementCode: 3, column: 1 },
          ],
        },
      ],
    });

  it('places a subtotal on the column it aggregates and the column it breaks on', () => {
    const [map] = transformWorkbook(workbook({ content: totalledWorkbook() }), 'EUL4');
    expect(map?.totals).toEqual([
      expect.objectContaining({
        kind: 'TOTAL',
        label: 'SubTotal por &Value',
        aggFunction: 'SUM',
        placement: 'AT_CHANGE',
        // `Valor` is the second column, `Regiao` the first.
        measureItemOrder: 1,
        measureCalculationOrder: null,
        breakItemOrder: 0,
        displayOrder: 0,
      }),
      expect.objectContaining({
        label: 'Total Geral',
        placement: 'GRAND_TOTAL',
        measureItemOrder: 1,
        breakItemOrder: null,
        displayOrder: 1,
      }),
    ]);
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_TOTAL_COLUMN_UNRESOLVED');
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_TOTAL_FUNCTION_UNKNOWN');
  });

  it('keeps every raw code, because the dump confirms none of them', () => {
    const [map] = transformWorkbook(workbook({ content: totalledWorkbook() }), 'EUL4');
    expect(map?.totals[0]?.sourceAttrs).toMatchObject({
      functionCode: 1,
      placementCode: 1,
      dataStyleRef: 41,
      unconfirmedFlags: [1, null, 3, null, null],
    });
    expect(map?.totals[0]?.sourceElementId).toBeGreaterThan(0);
  });

  /** One column, one total, whatever aggregate code the caller wants to test. */
  const totalWithFunction = (functionCode: number): Buffer =>
    buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }],
      worksheets: [
        {
          name: 'S',
          columns: [{ item: 'Regiao', axisType: 0 }],
          totals: [{ label: 'T', functionCode, placementCode: 3, column: 0 }],
        },
      ],
    });

  it('names the four established aggregate codes', () => {
    // 1/2/3 are what Neo can run; §7.12 carries the evidence for each.
    const named = [1, 2, 3].map((code) => {
      const [map] = transformWorkbook(workbook({ content: totalWithFunction(code) }), 'EUL4');
      return map?.totals[0]?.aggFunction;
    });
    expect(named).toEqual(['SUM', 'AVG', 'COUNT']);
  });

  it('will not write COUNT for a COUNT DISTINCT, and says why', () => {
    // Code 4 is decoded — it is COUNT DISTINCT — but Neo's SELECT builder
    // accepts only SUM/COUNT/AVG/MIN/MAX. Emitting COUNT would not fail; it
    // would quietly count duplicates and show a different number.
    const [map] = transformWorkbook(workbook({ content: totalWithFunction(4) }), 'EUL4');
    expect(map?.totals[0]).toEqual(
      expect.objectContaining({ aggFunction: null, placement: 'GRAND_TOTAL' }),
    );
    // What Discoverer computes is still recorded, so nothing is lost.
    expect(map?.totals[0]?.sourceAttrs).toMatchObject({
      functionCode: 4,
      functionName: 'COUNT DISTINCT',
    });
    expect(codes(map?.warnings ?? [])).toContain('MAP_TOTAL_AGG_UNSUPPORTED');
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_TOTAL_FUNCTION_UNKNOWN');
  });

  it('leaves an undecoded aggregate code unnamed, and says so', () => {
    // 6 is one of the three codes §7.12 could not name: a single authoring
    // decision copied across 17 workbooks, with only Minimum and Maximum left
    // for it and nothing to separate them.
    const [map] = transformWorkbook(workbook({ content: totalWithFunction(6) }), 'EUL4');
    expect(map?.totals[0]).toEqual(
      expect.objectContaining({ aggFunction: null, placement: 'GRAND_TOTAL' }),
    );
    expect(map?.totals[0]?.sourceAttrs).toMatchObject({ functionCode: 6, functionName: null });
    expect(codes(map?.warnings ?? [])).toContain('MAP_TOTAL_FUNCTION_UNKNOWN');
    expect(codes(map?.warnings ?? [])).not.toContain('MAP_TOTAL_AGG_UNSUPPORTED');
  });

  it('totals a workbook calculation through map_calculated_fields, not map_items', () => {
    const content = buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Regiao' }],
      worksheets: [
        {
          name: 'S',
          columns: [
            { item: 'Regiao', axisType: 0 },
            { calculation: true, itemLabel: 'Margem', formula: '[2,20]([6,1])', axisType: 1 },
          ],
          totals: [{ label: 'Total Margem', functionCode: 1, placementCode: 3, column: 1 }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    // `map_totals` has its own reference for this, so a total on a calculation
    // migrates in full — unlike a sort, which `map_items` cannot hold.
    expect(map?.totals[0]).toEqual(
      expect.objectContaining({ measureItemOrder: null, measureCalculationOrder: 0 }),
    );
  });

  it('reports a subtotal that breaks on a calculation, which map_items cannot hold', () => {
    const content = buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Valor' }],
      worksheets: [
        {
          name: 'S',
          columns: [
            { calculation: true, itemLabel: 'Grupo', formula: '[2,20]([6,1])', axisType: 0 },
            { item: 'Valor', axisType: 1 },
          ],
          totals: [
            {
              label: 'SubTotal por &Value',
              functionCode: 1,
              placementCode: 1,
              column: 1,
              breakColumn: 0,
            },
          ],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    // The aggregate survives; only the break is lost, and it is reported.
    expect(map?.totals[0]).toEqual(
      expect.objectContaining({ aggFunction: 'SUM', measureItemOrder: 1, breakItemOrder: null }),
    );
    expect(codes(map?.warnings ?? [])).toContain('MAP_TOTAL_BREAK_ON_CALCULATION');
  });

  it('drops a total whose column the worksheet does not hold, and says so', () => {
    const content = buildWorkbookFixture({
      name: 'Vendas',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Valor' }],
      worksheets: [
        {
          name: 'S',
          columns: [{ item: 'Valor', axisType: 1 }],
          // No `column`, so `0x0c22` is absent: nothing to aggregate.
          totals: [{ label: 'Total', functionCode: 1, placementCode: 3 }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.totals).toEqual([]);
    expect(codes(map?.warnings ?? [])).toContain('MAP_TOTAL_COLUMN_UNRESOLVED');
  });

  it('leaves a worksheet whose layout did not decode with no totals at all', () => {
    const content = buildWorkbookFixture({
      name: 'Sem Layout',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Valor' }],
      worksheets: [
        {
          name: 'S',
          undecodableLayout: true,
          columns: [{ item: 'Valor', axisType: 1 }],
          totals: [{ label: 'Total', functionCode: 1, placementCode: 3, column: 0 }],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.totals).toEqual([]);
  });

  // --- item format (§7.8.8) -------------------------------------------------

  it('carries item format fields, and leaves alignment unnamed', () => {
    const content = buildWorkbookFixture({
      name: 'Formatado',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Valor' }],
      worksheets: [
        {
          name: 'S',
          columns: [
            {
              item: 'Valor',
              axisType: 1,
              dataType: 2,
              displayWidth: 64,
              alignment: 3,
              wordWrap: true,
              headingFormatMask: 'HEAD',
            },
          ],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.items[0]).toEqual(
      expect.objectContaining({
        dataType: 'NUMBER',
        columnWidth: 64,
        headingFormatMask: 'HEAD',
        wordWrap: true,
        // 0x0643 has no confirmed code → value mapping (§7.8.8): the raw code
        // is kept, but the named column is never guessed at.
        alignment: null,
        sourceAttrs: { alignmentCode: 3 },
      }),
    );
    expect(map?.items[0]?.sourceElementId).toBeGreaterThan(0);
    expect(codes(map?.warnings ?? [])).toContain('MAP_ITEM_ALIGNMENT_UNKNOWN');
  });

  it('gives a hidden item no format at all — it draws no column', () => {
    const content = buildWorkbookFixture({
      name: 'Oculto',
      items: [{ folderLabel: 'Vendas', itemLabel: 'Valor' }, { itemLabel: 'Margem' }],
      worksheets: [
        {
          name: 'S',
          columns: [{ item: 'Valor', axisType: 1, dataType: 2, displayWidth: 64 }],
          hiddenItems: ['Margem'],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    const hidden = map?.items.find((i) => i.isHidden);
    expect(hidden).toEqual(
      expect.objectContaining({
        columnWidth: null,
        dataType: null,
        headingFormatMask: null,
        alignment: null,
        wordWrap: null,
        sourceAttrs: null,
      }),
    );
    expect(hidden?.sourceElementId).toBeGreaterThan(0);
  });

  // --- page setup (§7.8.12) --------------------------------------------------

  it('shares one page-setup row across every worksheet of a workbook', () => {
    const content = buildWorkbookFixture({
      name: 'Multi',
      pageSetup: {
        texts: ['Left', null, null, null, null, '&Page / &Pages'],
        margins: [1, 1, 0.75, 0.75, 0.5, 0.5],
      },
      worksheets: [
        { name: 'A', columns: [{ itemLabel: 'X' }] },
        { name: 'B', columns: [{ itemLabel: 'Y' }] },
      ],
    });
    const maps = transformWorkbook(workbook({ content }), 'EUL4');
    expect(maps).toHaveLength(2);
    for (const map of maps) {
      expect(map.pageSetup?.sourceAttrs).toMatchObject({
        texts: ['Left', null, null, null, null, '&Page / &Pages'],
        margins: [1, 1, 0.75, 0.75, 0.5, 0.5],
      });
      expect(map.pageSetup?.sourceElementId).toBeGreaterThan(0);
    }
  });

  it('has no page setup when the document carries none', () => {
    const [map] = transformWorkbook(workbook(), 'EUL5');
    expect(map?.pageSetup).toBeNull();
  });

  // --- joins (§7.8.9) ---------------------------------------------------------

  it("resolves the joins a worksheet's query forces", () => {
    const content = buildWorkbookFixture({
      name: 'Comissoes',
      items: [{ folderLabel: 'Comissoes', itemLabel: 'Valor' }],
      joins: [
        {
          name: 'Comissoes to Apolices',
          sourceId: 42,
          identifier: 'JOIN1',
          owningFolderName: 'Comissoes',
          owningFolderIdentifier: 'COMISSOES',
        },
      ],
      worksheets: [
        {
          name: 'S',
          columns: [{ item: 'Valor', axisType: 1 }],
          joins: ['Comissoes to Apolices'],
        },
      ],
    });
    const [map] = transformWorkbook(workbook({ content }), 'EUL4');
    expect(map?.joins).toEqual([
      expect.objectContaining({
        eulJoinSourceId: 42,
        identifier: 'JOIN1',
        name: 'Comissoes to Apolices',
        owningFolderName: 'Comissoes',
        owningFolderIdentifier: 'COMISSOES',
      }),
    ]);
    expect(map?.joins[0]?.sourceElementId).toBeGreaterThan(0);
  });

  it('has no joins when the worksheet forces none', () => {
    const [map] = transformWorkbook(workbook(), 'EUL5');
    expect(map?.joins).toEqual([]);
  });
});

describe('mapItemAggFunction — the split meeting the aggregate', () => {
  // 300 aggregates, 301 is Oracle's `Detail` (no aggregation), 302 has no
  // default at all — the three shapes the live EUL4 actually holds.
  const defaults = defaultAggregateBySourceId([
    { sourceId: 300, aggregation: 'SUM' },
    { sourceId: 301, aggregation: 'Detail' },
    { sourceId: 302, aggregation: null },
  ]);

  const column = (
    over: Partial<Pick<TransformedMapItem, 'axisType' | 'itemSourceId'>> = {},
  ): Pick<TransformedMapItem, 'axisType' | 'itemSourceId'> => ({
    axisType: 'MEASURE',
    itemSourceId: 300,
    ...over,
  });

  it('drops Detail and no-default items from the lookup entirely', () => {
    expect([...defaults]).toEqual([[300, 'SUM']]);
  });

  // The whole point of the phase: the workbook's `0x0124` measure vector and
  // the EUL's `IT_FUN_ID` are both required, and each is useless alone.
  it('writes the aggregate on a measure column', () => {
    expect(mapItemAggFunction(column(), defaults)).toBe('SUM');
  });

  // legacy-analysis §3.4: the default aggregate applies when the item is on
  // the measure axis. An axis column projects its raw value.
  it('writes nothing on an axis or page column, even when the item aggregates', () => {
    expect(mapItemAggFunction(column({ axisType: 'AXIS' }), defaults)).toBeNull();
    expect(mapItemAggFunction(column({ axisType: 'PAGE' }), defaults)).toBeNull();
    expect(mapItemAggFunction(column({ axisType: null }), defaults)).toBeNull();
  });

  // Never SUM by default. 8 152 items say Detail and 353 say nothing; guessing
  // an aggregate for them is a wrong number that looks right.
  it('leaves a measure null when its item states no aggregate', () => {
    expect(mapItemAggFunction(column({ itemSourceId: 301 }), defaults)).toBeNull();
    expect(mapItemAggFunction(column({ itemSourceId: 302 }), defaults)).toBeNull();
    expect(mapItemAggFunction(column({ itemSourceId: null }), defaults)).toBeNull();
    expect(mapItemAggFunction(column({ itemSourceId: 999 }), defaults)).toBeNull();
  });
});

describe('buildMapTotalRow', () => {
  const total = (overrides: Partial<TransformedMapTotal> = {}): TransformedMapTotal => ({
    kind: 'TOTAL',
    measureItemOrder: 1,
    measureCalculationOrder: null,
    breakItemOrder: 0,
    aggFunction: 'SUM',
    placement: 'AT_CHANGE',
    label: 'SubTotal por &Value',
    displayOrder: 0,
    sourceElementId: 88,
    sourceAttrs: { functionCode: 1 },
    ...overrides,
  });

  const items = (): Map<number, string> =>
    new Map([
      [0, 'item-regiao'],
      [1, 'item-valor'],
    ]);

  it('resolves both references against the rows the caller just wrote', () => {
    expect(buildMapTotalRow(total(), 'map-1', 'total-1', items(), new Map())).toEqual({
      id: 'total-1',
      mapId: 'map-1',
      kind: 'TOTAL',
      mapItemId: 'item-valor',
      mapCalculatedFieldId: null,
      breakMapItemId: 'item-regiao',
      aggFunction: 'SUM',
      placement: 'AT_CHANGE',
      label: 'SubTotal por &Value',
      displayOrder: 0,
      sourceElementId: 88,
      sourceAttrs: { functionCode: 1 },
    });
  });

  it('drops the total when the column it aggregates was not written', () => {
    // The measure column's item did not migrate, so no map_items row exists
    // for it — a total of no column is not a total.
    expect(buildMapTotalRow(total(), 'map-1', 'total-1', new Map(), new Map())).toBeNull();
  });

  it('keeps the total when only the break column was not written', () => {
    // The aggregate is unchanged; only where Discoverer drew it is lost.
    const row = buildMapTotalRow(
      total(),
      'map-1',
      'total-1',
      new Map([[1, 'item-valor']]),
      new Map(),
    );
    expect(row).toMatchObject({ mapItemId: 'item-valor', breakMapItemId: null });
  });

  it('writes a total on a calculation against map_calculated_fields', () => {
    const row = buildMapTotalRow(
      total({ measureItemOrder: null, measureCalculationOrder: 0, breakItemOrder: null }),
      'map-1',
      'total-1',
      new Map(),
      new Map([[0, 'calc-margem']]),
    );
    expect(row).toMatchObject({ mapItemId: null, mapCalculatedFieldId: 'calc-margem' });
  });
});

describe('buildMapPageSetupRow', () => {
  it('writes only the element id and the raw arrays — every named slot is null', () => {
    const row = buildMapPageSetupRow(
      { sourceElementId: 55, sourceAttrs: { texts: ['A'], margins: [1] } },
      'map-1',
      'setup-1',
    );
    expect(row).toEqual({
      id: 'setup-1',
      mapId: 'map-1',
      orientation: null,
      scalePercent: null,
      headerLeft: null,
      headerCenter: null,
      headerRight: null,
      footerLeft: null,
      footerCenter: null,
      footerRight: null,
      marginTop: null,
      marginBottom: null,
      marginLeft: null,
      marginRight: null,
      marginHeader: null,
      marginFooter: null,
      printGridLines: null,
      printHeadings: null,
      sourceElementId: 55,
      sourceAttrs: { texts: ['A'], margins: [1] },
    });
  });
});

describe('buildMapLayoutRow', () => {
  const layout = {
    worksheetIndex: 2,
    worksheetGuid: 'A1B2-C3D4',
    title: 'Vendas por Região\nExercício 2026',
    titleRtf: '{\\rtf1 Vendas}',
    titleHtml: '<b>Vendas</b>',
    queryCount: 1,
    sourceElementId: 501,
  };

  it('writes the worksheet identity and its printed title', () => {
    expect(buildMapLayoutRow(layout, [], 'map-1', 'layout-1')).toEqual({
      id: 'layout-1',
      mapId: 'map-1',
      worksheetIndex: 2,
      worksheetGuid: 'A1B2-C3D4',
      title: 'Vendas por Região\nExercício 2026',
      titleRtf: '{\\rtf1 Vendas}',
      titleHtml: '<b>Vendas</b>',
      queryCount: 1,
      // Neo has no chart model, so the graph block has nowhere to go.
      graph: null,
      sourceElementId: 501,
      // Nothing to record beyond the title: no `{ joins: [] }`, which would
      // read as "examined, forced none".
      sourceAttrs: null,
    });
  });

  it('carries join usage when the worksheet forced any', () => {
    const row = buildMapLayoutRow(layout, [{ name: 'Invoices to Summary' }], 'map-1', 'layout-1');
    expect(row.sourceAttrs).toEqual({ joins: [{ name: 'Invoices to Summary' }] });
  });
});

describe('transformUser', () => {
  it('synthesizes an email and disables login', () => {
    const t = transformUser({ sourceId: 900, username: 'JSMITH', isRole: false, source: 'EUL_USERS' as const }, 'EUL5');
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
    const t = transformUser({ sourceId: 902, username: 'APPS#PROD', isRole: false, source: 'EUL_USERS' as const }, 'EUL4');
    expect(t.email).toBe('apps_prod@migrated.local');
    expect(codes(t.warnings)).toContain('USER_EMAIL_SYNTHESIZED');
  });

  it('transformUsers maps a list', () => {
    const ts = transformUsers(
      [
        { sourceId: 900, username: 'JSMITH', isRole: false, source: 'EUL_USERS' as const },
        { sourceId: 901, username: 'MJONES', isRole: false, source: 'EUL_USERS' as const },
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

// ---------------------------------------------------------------------------
// buildMapConditionRows
// ---------------------------------------------------------------------------

describe('buildMapConditionRows', () => {
  let counter = 0;
  const genId = (): string => `id-${(counter += 1)}`;
  beforeEach(() => {
    counter = 0;
  });

  const condition = (
    overrides: Partial<TransformedMapCondition> = {},
  ): TransformedMapCondition => ({
    itemSourceId: 1,
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
    ...overrides,
  });

  it('turns one group key into one group id, shared by its rows', () => {
    const { rows, skipped } = buildMapConditionRows(
      [
        condition({ groupKey: 'c0g0', displayOrder: 0 }),
        condition({ groupKey: 'c0g0', displayOrder: 1, logicOperator: 'OR' }),
        condition({ groupKey: null, displayOrder: 2, sourceIndex: 1 }),
      ],
      'map-1',
      () => 'item-1',
      genId,
    );
    expect(skipped).toEqual([]);
    expect(rows[0]?.groupId).toBe(rows[1]?.groupId);
    expect(rows[0]?.groupId).not.toBeNull();
    expect(rows[2]?.groupId).toBeNull();
    expect(rows.map((r) => r.logicOperator)).toEqual(['AND', 'OR', 'AND']);
    expect(rows.every((r) => r.mapId === 'map-1')).toBe(true);
  });

  it('mints a fresh group id per map so two maps never share brackets', () => {
    const conditions = [
      condition({ groupKey: 'c0g0' }),
      condition({ groupKey: 'c0g0', displayOrder: 1 }),
    ];
    const first = buildMapConditionRows(conditions, 'map-1', () => 'item-1', genId);
    const second = buildMapConditionRows(conditions, 'map-2', () => 'item-1', genId);
    expect(first.rows[0]?.groupId).not.toBe(second.rows[0]?.groupId);
  });

  it('drops every row of a condition when one of its items did not migrate', () => {
    // `a = 1 AND b = 2` with `b` missing must not become `a = 1`: that filter
    // returns more rows than Discoverer did.
    const { rows, skipped } = buildMapConditionRows(
      [
        condition({ itemLabel: 'A', sourceIndex: 0 }),
        condition({ itemLabel: 'B', sourceIndex: 0, displayOrder: 1 }),
        condition({ itemLabel: 'C', sourceIndex: 1, displayOrder: 2 }),
      ],
      'map-1',
      (c) => (c.itemLabel === 'B' ? undefined : 'item-1'),
      genId,
    );
    expect(rows.map((r) => r.displayOrder)).toEqual([2]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toContain('item not migrated');
  });
});

// ---------------------------------------------------------------------------
// makeBindName
// ---------------------------------------------------------------------------

/**
 * The same table as `BIND_NAME_CASES` in
 * `backend/src/__tests__/identifiers.test.ts`.
 *
 * The derivation is duplicated across the two packages (they share no code)
 * and once more in `backend/drizzle/0008_bind_safe_parameter_names.sql`. A map
 * migrated by this package is read by the backend's SQL generator, so the two
 * disagreeing means conditions pointing at binds no parameter owns. Copying the
 * table is what makes a one-sided change fail here.
 */
const BIND_NAME_CASES: Array<[label: string, expected: string]> = [
  ['p_region', 'P_REGION'],
  ['PERIOD', 'PERIOD'],
  ['Dt Fim Vigência >=', 'DT_FIM_VIG_NCIA'],
  ['Apólice nº', 'AP_LICE_N'],
  ['DATA FIM', 'DATA_FIM'],
  ['VALOR SUPERIOR A', 'VALOR_SUPERIOR_A'],
  ['DT Pedido  <=', 'DT_PEDIDO'],
  ['U.E.', 'U_E'],
  ['  spaced  out  ', 'SPACED_OUT'],
  ['>>>weird<<<', 'WEIRD'],
  ['2024 total', 'P_2024_TOTAL'],
  ['_leading', 'LEADING'],
  ['>=', 'P'],
  ['', 'P'],
  ['A very long prompt name that runs past the limit', 'A_VERY_LONG_PROMPT_NAME_TH'],
];

describe('makeBindName', () => {
  it.each(BIND_NAME_CASES)('derives %j as %j', (label, expected) => {
    expect(makeBindName(label, new Set())).toBe(expected);
  });

  it('always yields a name Oracle will accept after a colon', () => {
    for (const [label] of BIND_NAME_CASES) {
      const bind = makeBindName(label, new Set());
      expect(bind).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect(bind.length).toBeLessThanOrEqual(26);
    }
  });

  it('uniquifies prompts that reduce to the same base', () => {
    const taken = new Set<string>();
    expect(makeBindName('Dt Pedido <=', taken)).toBe('DT_PEDIDO');
    expect(makeBindName('Dt Pedido >=', taken)).toBe('DT_PEDIDO_2');
    expect(makeBindName('DT PEDIDO', taken)).toBe('DT_PEDIDO_3');
  });

  it('uniquifies a base already at the length cap by truncating the base', () => {
    const taken = new Set<string>();
    const long = 'A very long prompt name that runs past the limit';
    const first = makeBindName(long, taken);
    const second = makeBindName(long, taken);
    expect(second).not.toBe(first);
    expect(second.endsWith('_2')).toBe(true);
    expect(second.length).toBeLessThanOrEqual(26);
  });
});
