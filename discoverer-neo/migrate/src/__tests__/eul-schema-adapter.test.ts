import { describe, it, expect } from '@jest/globals';
import { detectEulVersionFromExecutor } from '../services/eul-version-detector.js';
import {
  EulReadError,
  createEulSchemaAdapter,
  normalizeRow,
  readBusinessAreas,
  readCustomFunctions,
  readFolders,
  readGrants,
  readHierarchies,
  readItems,
  readJoins,
  readUsers,
  readWorkbooks,
} from '../services/eul-schema-adapter.js';
import type { EulVersionInfo } from '../types/eul-versions.js';
import { EUL_PREFIX } from '../types/eul-versions.js';
import type { MockDb } from './helpers/mock-eul.js';
import { eul4Db, eul5Db, mixedDb, mockExecutor } from './helpers/mock-eul.js';

/** Build an adapter by running real detection against a mock source. */
async function adapterFor(db: MockDb) {
  const execute = mockExecutor(db);
  const info = await detectEulVersionFromExecutor(execute);
  return { adapter: createEulSchemaAdapter(info), execute, info, db };
}

function infoFor(version: 'EUL3' | 'EUL4' | 'EUL5', tableNames: string[] = []): EulVersionInfo {
  return {
    version,
    prefix: EUL_PREFIX[version],
    discovererVersion: 'x',
    schemaVersion: 'x',
    tableNames,
    supported: version !== 'EUL3',
    warnings: [],
  };
}

describe('createEulSchemaAdapter', () => {
  describe('table name resolution', () => {
    it('prefixes base names per version', () => {
      const cases = [
        ['EUL5', 'EUL5_BAS'],
        ['EUL4', 'EUL4_BAS'],
        ['EUL3', 'EUL_BAS'],
      ] as const;
      for (const [version, expected] of cases) {
        const adapter = createEulSchemaAdapter(infoFor(version));
        expect(adapter.getTableName('BAS')).toBe(expected);
      }
    });

    it('qualifies table names with the owner when known', () => {
      const info = { ...infoFor('EUL5'), owner: 'EUL5_US' };
      const adapter = createEulSchemaAdapter(info);
      expect(adapter.getQualifiedTableName('OBJS')).toBe('EUL5_US.EUL5_OBJS');
    });

    it('rejects unsafe base names', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      expect(() => adapter.getTableName('BA; DROP')).toThrow(/Unsafe Oracle identifier/);
    });

    it('reports table presence from the detected table list', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4', ['EUL4_BAS', 'EUL4_OBJS']));
      expect(adapter.hasTable('BAS')).toBe(true);
      expect(adapter.hasTable('TRANSLATIONS')).toBe(false);
    });
  });

  describe('column mappings', () => {
    it.each(['EUL4', 'EUL5'] as const)(
      '%s business-area mapping uses the real BAS columns',
      (version) => {
        const adapter = createEulSchemaAdapter(infoFor(version));
        const names = adapter.getBusinessAreaColumns().map((m) => m.name);
        expect(names).toEqual([
          'BA_ID',
          'BA_NAME',
          'BA_DESCRIPTION',
          'BA_CREATED_BY',
          'BA_CREATED_DATE',
          'BA_UPDATED_BY',
          'BA_UPDATED_DATE',
        ]);
      },
    );

    it('folder mapping reads SOBJ_EXT_TABLE / OBJ_EXT_OWNER, not OBJ_TABLE_*', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const byMapsTo = new Map(adapter.getFolderColumns().map((m) => [m.mapsTo, m.name]));
      expect(byMapsTo.get('tableName')).toBe('SOBJ_EXT_TABLE');
      expect(byMapsTo.get('tableOwner')).toBe('OBJ_EXT_OWNER');
      const names = adapter.getFolderColumns().map((m) => m.name);
      expect(names).not.toContain('OBJ_TABLE_NAME');
      expect(names).not.toContain('OBJ_TABLE_OWNER');
    });

    it('expression mapping reads the IT_-prefixed item columns', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const byMapsTo = new Map(adapter.getExpressionColumns().map((m) => [m.mapsTo, m.name]));
      // The folder link and the physical column both live under IT_.
      expect(byMapsTo.get('folderId')).toBe('IT_OBJ_ID');
      expect(byMapsTo.get('columnName')).toBe('IT_EXT_COLUMN');
      expect(byMapsTo.get('formatMask')).toBe('IT_FORMAT_MASK');
      const names = adapter.getExpressionColumns().map((m) => m.name);
      expect(names).not.toContain('EXP_COL_NAME');
      expect(names).not.toContain('OBJ_ID');
    });

    it('EUL4 and EUL5 map identical columns for every entity', () => {
      const four = createEulSchemaAdapter(infoFor('EUL4'));
      const five = createEulSchemaAdapter(infoFor('EUL5'));
      const shape = (a: ReturnType<typeof createEulSchemaAdapter>) =>
        [
          a.getBusinessAreaColumns(),
          a.getFolderColumns(),
          a.getExpressionColumns(),
          a.getJoinColumns(),
          a.getHierarchyColumns(),
          a.getGrantColumns(),
          a.getUserColumns(),
        ].map((g) => g.map((m) => m.name));
      expect(shape(four)).toEqual(shape(five));
    });

    it('every missing column carries a default or a fallback column (all versions, all entities)', () => {
      for (const version of ['EUL3', 'EUL4', 'EUL5'] as const) {
        const adapter = createEulSchemaAdapter(infoFor(version));
        const allMappings = [
          ...adapter.getBusinessAreaColumns(),
          ...adapter.getFolderColumns(),
          ...adapter.getExpressionColumns(),
          ...adapter.getJoinColumns(),
          ...adapter.getBusinessAreaLinkColumns(),
          ...adapter.getHierarchyColumns(),
          ...adapter.getHierarchyNodeColumns(),
          ...adapter.getHierarchySegmentColumns(),
          ...adapter.getDocumentColumns(),
          ...adapter.getFunctionColumns(),
          ...adapter.getUserColumns(),
          ...adapter.getGrantColumns(),
        ];
        for (const mapping of allMappings) {
          expect(mapping.mapsTo).toBeTruthy();
          if (!mapping.existsInSource) {
            const hasStrategy =
              mapping.defaultValue !== undefined || mapping.fallbackColumn !== undefined;
            expect(hasStrategy).toBe(true);
          }
        }
      }
    });
  });

  describe('feature detection', () => {
    // EUL4 and EUL5 expose the same capabilities — the version difference is
    // the table prefix, not the feature set (EUL_SCHEMA_GROUND_TRUTH.md §1).
    it.each(['EUL4', 'EUL5'] as const)('%s exposes the full feature set', (version) => {
      const adapter = createEulSchemaAdapter(infoFor(version));
      expect(adapter.supportsSummaryFolders()).toBe(true);
      expect(adapter.hasHierarchyNodeTree()).toBe(true);
      expect(adapter.hasRoleAwareGrantees()).toBe(true);
    });

    it('EUL3 has no summary folders', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL3'));
      expect(adapter.supportsSummaryFolders()).toBe(false);
    });

    it('summary-folder support goes off when SUMMARY_OBJS was not detected', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5', ['EUL5_BAS', 'EUL5_OBJS']));
      expect(adapter.supportsSummaryFolders()).toBe(false);
    });
  });

  describe('normalizeRow', () => {
    it('coerces numeric strings to numbers', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const row = normalizeRow(
        { EXP_ID: '42', EXP_NAME: 'X', EXP_TYPE: 'CO', IT_OBJ_ID: '7' },
        adapter.getExpressionColumns(),
      );
      expect(row.sourceId).toBe(42);
      expect(row.folderId).toBe(7);
    });

    it('coerces Y/N to boolean', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const row = normalizeRow(
        { EU_ID: 1, EU_USERNAME: 'SALES_ROLE', EU_ROLE_FLAG: 'Y' },
        adapter.getUserColumns(),
      );
      expect(row.isRole).toBe(true);
    });

    it('fills absent columns with their default', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4'));
      const row = normalizeRow(
        { OBJ_ID: 1, OBJ_NAME: 'F', OBJ_TYPE: 'SOBJ' },
        adapter.getFolderColumns(),
      );
      expect(row.description).toBeNull();
      expect(row.tableName).toBeNull();
      expect(row.tableOwner).toBeNull();
    });
  });
});

describe('unified read functions', () => {
  describe('readBusinessAreas', () => {
    it('EUL5: returns the normalized shape from the real BAS columns', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const areas = await readBusinessAreas(adapter, execute);

      // Two business areas: one shares a folder with the other.
      expect(areas).toHaveLength(2);
      expect(areas[0]).toMatchObject({
        sourceId: 100,
        name: 'Sales Analysis',
        description: 'Sales BA',
        createdBy: 'DISCO_ADMIN',
        updatedBy: 'DISCO_ADMIN2',
      });
      const baSql = db.executed.find((sql) => sql.includes('EUL5_BAS') && sql.includes('BA_NAME'));
      expect(baSql).toContain('EUL5_US.EUL5_BAS');
      // Columns that do not exist on BAS must never reach the SQL.
      expect(baSql).not.toContain('BA_LANGUAGE');
      expect(baSql).not.toContain('BA_DEVELOPER_KEY');
    });

    it('EUL4: identical shape under the EUL4_ prefix', async () => {
      const { adapter, execute, db } = await adapterFor(eul4Db());
      const areas = await readBusinessAreas(adapter, execute);

      expect(areas).toHaveLength(1);
      expect(areas[0]).toMatchObject({ sourceId: 10, name: 'Finance' });
      expect(
        db.executed.find((sql) => sql.includes('EUL4_BAS') && sql.includes('BA_NAME')),
      ).toBeDefined();
    });
  });

  describe('readFolders', () => {
    it('EUL5: normalizes SOBJ/COBJ and resolves the BA through BA_OBJ_LINKS', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const folders = await readFolders(adapter, execute);

      expect(folders.map((f) => f.folderType).sort()).toEqual(['COMPLEX', 'TABLE']);
      const table = folders.find((f) => f.folderType === 'TABLE');
      expect(table).toMatchObject({
        sourceId: 200,
        businessAreaId: 100, // via BA_OBJ_LINKS, not a BA_ID column on OBJS
        tableName: 'AP_INVOICES_ALL',
        tableOwner: 'APPS',
      });

      const objSql = db.executed.find((sql) => sql.includes('EUL5_OBJS'));
      expect(objSql).toContain('SOBJ_EXT_TABLE');
      expect(objSql).toContain('OBJ_EXT_OWNER');
      expect(objSql).not.toContain('OBJ_TABLE_NAME');
      expect(db.executed.some((sql) => sql.includes('EUL5_BA_OBJ_LINKS'))).toBe(true);
    });

    it('leaves businessAreaId null when the folder has no BA link', async () => {
      const db = eul5Db();
      db.tables.EUL5_BA_OBJ_LINKS = [];
      const { adapter, execute } = await adapterFor(db);
      const folders = await readFolders(adapter, execute);
      expect(folders.every((f) => f.businessAreaId === null)).toBe(true);
    });

    it('EUL4: same normalization under the EUL4_ prefix', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const folders = await readFolders(adapter, execute);

      expect(folders).toHaveLength(1);
      expect(folders[0]).toMatchObject({
        folderType: 'TABLE',
        businessAreaId: 10,
        tableName: 'GL_BALANCES_V',
      });
    });
  });

  describe('readItems', () => {
    it('EUL5: reads CO (database items) as well as CI — not CI alone', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const items = await readItems(adapter, execute);

      // The pre-rewrite default was ['CI','CU'], which skipped every CO row —
      // i.e. every real column-backed item in the EUL.
      expect(items.map((i) => i.expType).sort()).toEqual(['CI', 'CO', 'CO']);
      const dbItem = items.find((i) => i.sourceId === 300);
      expect(dbItem).toMatchObject({
        folderId: 200, // from IT_OBJ_ID
        columnName: 'INVOICE_AMOUNT', // from IT_EXT_COLUMN
        dataType: 'NUMBER',
        formatMask: '999,999.00', // from IT_FORMAT_MASK
        expType: 'CO',
      });
    });

    it('EUL5: expTypes option narrows the read', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const created = await readItems(adapter, execute, { expTypes: ['CI'] });
      expect(created).toHaveLength(1);
      expect(created[0]?.name).toBe('Amount With Tax');
    });

    it('never selects columns that do not exist on EXPRESSIONS', async () => {
      const { adapter, execute, db } = await adapterFor(eul4Db());
      const items = await readItems(adapter, execute);

      expect(items).toHaveLength(2);
      const itemSql = db.executed.find((sql) => sql.includes('EUL4_EXPRESSIONS'));
      for (const fabricated of [
        'EXP_COL_NAME',
        'EXP_FORMAT_MASK',
        'EXP_AGGR_FUNC',
        'EXP_SEQUENCE',
        'EXP_NULLS_ALLOWED',
        'EXP_FORMULA',
      ]) {
        expect(itemSql).not.toContain(fabricated);
      }
    });
  });

  describe('readJoins', () => {
    it('EUL5: reads KEY_CONS as a folder-to-folder join', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const joins = await readJoins(adapter, execute);

      expect(joins).toHaveLength(1);
      expect(joins[0]).toMatchObject({
        sourceId: 400,
        // KEY_OBJ_ID (200) is the DETAIL; FK_OBJ_ID_REMOTE (201) is the MASTER.
        detailFolderId: 200,
        masterFolderId: 201,
        description: 'Invoices to Summary',
      });
      // Joins bind folders; item-level keys are unconfirmed and stay empty.
      expect(joins[0]?.components).toEqual([]);
      // And it must actually query KEY_CONS, not a fabricated JOINS table.
      expect(db.executed.some((sql) => sql.includes('EUL5_KEY_CONS'))).toBe(true);
      expect(db.executed.some((sql) => /EUL5_JOINS|EUL5_JOI_COMP/.test(sql))).toBe(false);
    });

    it('falls back to a row-index source id when KEY_ID is absent', async () => {
      const db = eul5Db();
      // Drop KEY_ID so probeColumns reports it missing, as a real EUL might.
      db.tables.EUL5_KEY_CONS = (db.tables.EUL5_KEY_CONS ?? []).map((row) => {
        const { KEY_ID: _drop, ...rest } = row;
        return rest;
      });
      const { adapter, execute } = await adapterFor(db);
      const joins = await readJoins(adapter, execute);

      expect(joins).toHaveLength(1);
      expect(joins[0]?.sourceId).toBe(0);
      expect(joins[0]?.detailFolderId).toBe(200);
    });

    it('EUL4: reads the same shape under the EUL4_ prefix', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const joins = await readJoins(adapter, execute);

      expect(joins).toHaveLength(1);
      expect(joins[0]?.detailFolderId).toBe(20);
      expect(joins[0]?.joinType).toBe('INNER');
    });

    /**
     * Orientation regression — the evidence, not just the conclusion.
     *
     * Measured on the live EUL4 (`SIID_TESTES`) by the Phase 0.3 probe;
     * raw output in `docs/master-plan/research/eul-probe-results.md` Q1.
     * `KEY_ID` 108451 `M M111 -> M M111 1` is the only join in that estate
     * where one side's join key is *exactly* unique — the textbook master —
     * and that side is `FK_OBJ_ID_REMOTE`:
     *
     *   FK_OBJ_ID_REMOTE -> M M111   (M_M111)    1830 rows / 1830 keys  => MASTER
     *   KEY_OBJ_ID       -> M M111 1 (M_M111_1)   216 rows /   94 keys  => DETAIL
     *
     * An inversion here does not throw. It pushes the wrong side into the
     * fan-trap inline view and returns correct-looking wrong numbers.
     */
    it('EUL4 live shape: KEY_OBJ_ID is the detail, FK_OBJ_ID_REMOTE the master', async () => {
      const MASTER_M_M111 = { folderId: 107430, rows: 1830, distinctKeys: 1830 };
      const DETAIL_M_M111_1 = { folderId: 107431, rows: 216, distinctKeys: 94 };

      // The master's join key is unique; the detail's is not. That is the
      // arithmetic the orientation rests on.
      expect(MASTER_M_M111.distinctKeys).toBe(MASTER_M_M111.rows);
      expect(DETAIL_M_M111_1.distinctKeys).toBeLessThan(DETAIL_M_M111_1.rows);

      const db = eul4Db();
      db.tables.EUL4_KEY_CONS = [
        {
          KEY_ID: 108451,
          KEY_NAME: 'M M111 -> M M111 1',
          KEY_TYPE: 'FK',
          KEY_OBJ_ID: DETAIL_M_M111_1.folderId,
          FK_OBJ_ID_REMOTE: MASTER_M_M111.folderId,
          KEY_DESCRIPTION: null,
        },
      ];

      const { adapter, execute } = await adapterFor(db);
      const [join] = await readJoins(adapter, execute);

      expect(join?.detailFolderId).toBe(DETAIL_M_M111_1.folderId);
      expect(join?.masterFolderId).toBe(MASTER_M_M111.folderId);
    });
  });

  describe('readHierarchies', () => {
    it('EUL5: derives depth by walking the HI_SEGMENTS tree', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const hierarchies = await readHierarchies(adapter, execute);

      expect(hierarchies).toHaveLength(1);
      // Fixture tree: 510 (root) → 511 → 512.
      expect(hierarchies[0]?.nodes.map((n) => [n.sourceId, n.depth])).toEqual([
        [510, 1],
        [511, 2],
        [512, 3],
      ]);
      expect(hierarchies[0]?.nodes.map((n) => n.parentNodeId)).toEqual([null, 510, 511]);
    });

    it('marks nodes unreachable from a root with a null depth instead of dropping them', async () => {
      const db = eul5Db();
      // 512's edge now points at a node that is not in this hierarchy, so the
      // walk from the root can never reach it.
      db.tables.EUL5_HI_SEGMENTS = [
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 510, IHS_HN_ID_CHILD: 511 },
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 999, IHS_HN_ID_CHILD: 512 },
      ];
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);

      const nodes = hierarchies[0]?.nodes ?? [];
      expect(nodes).toHaveLength(3); // nothing silently lost
      expect(nodes.find((n) => n.sourceId === 512)?.depth).toBeNull();
    });

    it('does not hang on a cyclic segment tree', async () => {
      const db = eul5Db();
      db.tables.EUL5_HI_SEGMENTS = [
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 510, IHS_HN_ID_CHILD: 511 },
        { IHS_HI_ID: 500, IHS_HN_ID_PARENT: 511, IHS_HN_ID_CHILD: 510 },
      ];
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);
      expect(hierarchies[0]?.nodes).toHaveLength(3);
    });

    it('EUL4: every node is a root when HI_SEGMENTS is empty', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const hierarchies = await readHierarchies(adapter, execute);

      expect(hierarchies).toHaveLength(1);
      expect(hierarchies[0]?.nodes).toEqual([
        expect.objectContaining({ sourceId: 51, hierarchyId: 50, depth: 1, parentNodeId: null }),
      ]);
    });

    it('survives a missing HI_SEGMENTS table entirely', async () => {
      const db = eul5Db();
      delete db.tables.EUL5_HI_SEGMENTS;
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);
      expect(hierarchies).toHaveLength(1);
      expect(hierarchies[0]?.nodes.every((n) => n.depth === 1)).toBe(true);
    });
  });

  describe('readWorkbooks', () => {
    it('EUL5: resolves the owner through DOC_EU_ID → EUL_USERS', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const workbooks = await readWorkbooks(adapter, execute);

      expect(workbooks).toHaveLength(1);
      expect(workbooks[0]).toMatchObject({
        sourceId: 700,
        name: 'Monthly Sales',
        owner: 'JSMITH',
        developerKey: 'MONTHLY_SALES',
        contentType: 'application/vnd.oracle-disco.wb',
      });
      // The body comes from DOC_DOCUMENT, fetched separately from the metadata.
      expect(Buffer.isBuffer(workbooks[0]?.content)).toBe(true);
      expect(workbooks[0]?.contentLength).toBe((workbooks[0]?.content as Buffer).length);
    });

    it('EUL4: falls back to DOC_CREATED_BY when DOC_EU_ID is absent', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const workbooks = await readWorkbooks(adapter, execute);

      expect(workbooks[0]?.owner).toBe('ACLARK');
      expect(workbooks[0]?.developerKey).toBeNull();
      expect(Buffer.isBuffer(workbooks[0]?.content)).toBe(true);
    });

    it('skips the body read entirely when includeContent is false', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const workbooks = await readWorkbooks(adapter, execute, { includeContent: false });
      expect(workbooks[0]?.content).toBeNull();
      expect(db.executed.some((sql) => sql.includes('DOC_DOCUMENT'))).toBe(false);
    });

    it('never selects a body column that does not exist', async () => {
      const db = eul5Db();
      db.tables.EUL5_DOCUMENTS = db.tables.EUL5_DOCUMENTS!.map((row) => {
        const { DOC_DOCUMENT: _omitted, ...rest } = row;
        return rest;
      });
      const execute = mockExecutor(db);
      const info = await detectEulVersionFromExecutor(execute);
      await readWorkbooks(createEulSchemaAdapter(info), execute);
      expect(db.executed.some((sql) => sql.includes('DOC_DOCUMENT'))).toBe(false);
      expect(db.executed.some((sql) => sql.includes('DOC_WORKBOOK_OWNER'))).toBe(false);
    });
  });

  describe('readUsers / readGrants', () => {
    it('reads the EUL_USERS directory, flagging roles', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const users = await readUsers(adapter, execute);

      expect(users).toEqual([
        { sourceId: 900, username: 'JSMITH', isRole: false, source: 'EUL_USERS' },
        { sourceId: 901, username: 'MJONES', isRole: false, source: 'EUL_USERS' },
        { sourceId: 902, username: 'SALES_ROLE', isRole: true, source: 'EUL_USERS' },
      ]);
    });

    it('resolves the grantee through AP_EU_ID → EUL_USERS.EU_ID', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const grants = await readGrants(adapter, execute);

      expect(grants).toHaveLength(3);
      expect(grants.find((g) => g.sourceId === 800)).toMatchObject({
        grantee: 'JSMITH', // resolved via the join, not a column on ACCESS_PRIVS
        businessAreaId: 100,
        folderId: null,
        level: 'BUSINESS_AREA',
        privCode: 1006,
      });
      expect(grants.find((g) => g.sourceId === 801)).toMatchObject({
        grantee: 'MJONES',
        folderId: 200,
        level: 'FOLDER',
      });
      // A role grantee is carried through as such.
      expect(grants.find((g) => g.sourceId === 802)).toMatchObject({
        grantee: 'SALES_ROLE',
        granteeIsRole: true,
      });
      expect(db.executed.some((sql) => sql.includes('EUL5_ACCESS_PRIVS'))).toBe(true);
      expect(db.executed.some((sql) => sql.includes('ELEM_ACCESS'))).toBe(false);
    });

    it('degrades to an EUL-wide grant when no target column exists', async () => {
      const db = eul5Db();
      // A source whose ACCESS_PRIVS carries no BA/folder/doc target columns.
      db.tables.EUL5_ACCESS_PRIVS = [
        { AP_EU_ID: 900, GP_APP_ID: 1006, AP_CREATED_DATE: new Date('2010-03-15T10:00:00Z') },
      ];
      const { adapter, execute } = await adapterFor(db);
      const grants = await readGrants(adapter, execute);

      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({ grantee: 'JSMITH', level: 'EUL' });
    });

    it('reads EUL4 grants with the same shape', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const grants = await readGrants(adapter, execute);
      expect(grants).toHaveLength(1);
      expect(grants[0]).toMatchObject({ grantee: 'ACLARK', level: 'BUSINESS_AREA' });
    });
  });

  describe('readCustomFunctions', () => {
    it('reads the minimal documented shape for both versions', async () => {
      const eul5 = await adapterFor(eul5Db());
      const eul5Functions = await readCustomFunctions(eul5.adapter, eul5.execute);
      expect(eul5Functions).toEqual([
        { sourceId: 600, name: 'GET_FISCAL_YEAR', description: 'Fiscal year lookup' },
      ]);

      const eul4 = await adapterFor(eul4Db());
      const eul4Functions = await readCustomFunctions(eul4.adapter, eul4.execute);
      expect(eul4Functions).toEqual([
        { sourceId: 60, name: 'GL_PERIOD_NAME', description: null },
      ]);
    });
  });

  describe('error handling', () => {
    it('wraps unexpected Oracle failures in EulReadError', async () => {
      const db = eul5Db();
      const { adapter } = await adapterFor(db);
      delete db.tables.EUL5_BAS; // now ORA-00942s on read
      await expect(readBusinessAreas(adapter, mockExecutor(db))).rejects.toThrow(EulReadError);
    });
  });

  describe('mixed schema (upgrade in progress)', () => {
    it('detect → adapt → read works end-to-end against the EUL5 half', async () => {
      const { adapter, execute, info } = await adapterFor(mixedDb());

      expect(info.version).toBe('EUL5');
      const areas = await readBusinessAreas(adapter, execute);
      expect(areas[0]?.name).toBe('Sales Analysis');
      const items = await readItems(adapter, execute);
      expect(items.map((i) => i.sourceId).sort()).toEqual([300, 301, 302]);
    });

    it('preferVersion: EUL4 reads the EUL4 half of the same schema', async () => {
      const db = mixedDb();
      const execute = mockExecutor(db);
      const info = await detectEulVersionFromExecutor(execute, { preferVersion: 'EUL4' });
      const adapter = createEulSchemaAdapter(info);

      const areas = await readBusinessAreas(adapter, execute);
      expect(areas[0]?.name).toBe('Finance'); // the EUL4 half, not EUL5's
    });
  });
});
