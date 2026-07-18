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
        ['EUL5', 'EUL5_BA'],
        ['EUL4', 'EUL4_BA'],
        ['EUL3', 'EUL_BA'],
      ] as const;
      for (const [version, expected] of cases) {
        const adapter = createEulSchemaAdapter(infoFor(version));
        expect(adapter.getTableName('BA')).toBe(expected);
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
      const adapter = createEulSchemaAdapter(infoFor('EUL4', ['EUL4_BA', 'EUL4_OBJS']));
      expect(adapter.hasTable('BA')).toBe(true);
      expect(adapter.hasTable('TRANSLATIONS')).toBe(false);
    });
  });

  describe('column mappings', () => {
    it('EUL5 business-area mapping includes the EUL5-only columns as existing', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const byName = new Map(adapter.getBusinessAreaColumns().map((m) => [m.name, m]));
      expect(byName.get('BA_LANGUAGE')?.existsInSource).toBe(true);
      expect(byName.get('BA_DEVELOPER_KEY')?.existsInSource).toBe(true);
    });

    it('EUL4 business-area mapping flags EUL5-only columns with defaults', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4'));
      const byName = new Map(adapter.getBusinessAreaColumns().map((m) => [m.name, m]));
      expect(byName.get('BA_LANGUAGE')?.existsInSource).toBe(false);
      expect(byName.get('BA_LANGUAGE')?.defaultValue).toBe('US');
      expect(byName.get('BA_NAME')?.existsInSource).toBe(true);
    });

    it('EUL4 expression mapping flags all the EUL5-only columns', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4'));
      const missing = adapter
        .getExpressionColumns()
        .filter((m) => !m.existsInSource)
        .map((m) => m.name)
        .sort();
      expect(missing).toEqual([
        'EXP_DESCRIPTION',
        'EXP_NULLS_ALLOWED',
        'EXP_UPDATED_BY',
        'EXP_UPDATED_DATE',
        'IT_EXP_ID',
      ]);
    });

    it('every missing column carries a default or a fallback column (all versions, all entities)', () => {
      for (const version of ['EUL3', 'EUL4', 'EUL5'] as const) {
        const adapter = createEulSchemaAdapter(infoFor(version));
        const allMappings = [
          ...adapter.getBusinessAreaColumns(),
          ...adapter.getFolderColumns(),
          ...adapter.getExpressionColumns(),
          ...adapter.getJoinColumns(),
          ...adapter.getJoinComponentColumns(),
          ...adapter.getHierarchyColumns(),
          ...adapter.getHierarchyLevelColumns(),
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
    it('EUL5 supports everything', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      expect(adapter.supportsMultiLanguage()).toBe(true);
      expect(adapter.supportsDerivedFolders()).toBe(true);
      expect(adapter.supportsSummaryFolders()).toBe(true);
      expect(adapter.hasSeparateHierarchyLevelsTable()).toBe(true);
      expect(adapter.hasSecurityManagerInExpressions()).toBe(true);
      expect(adapter.hasRoleBasedGrants()).toBe(true);
    });

    it('EUL4 supports the legacy feature set', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4'));
      expect(adapter.supportsMultiLanguage()).toBe(false);
      expect(adapter.supportsDerivedFolders()).toBe(false);
      expect(adapter.supportsSummaryFolders()).toBe(false);
      expect(adapter.hasSeparateHierarchyLevelsTable()).toBe(true);
      expect(adapter.hasSecurityManagerInExpressions()).toBe(false);
      expect(adapter.hasRoleBasedGrants()).toBe(false);
    });

    it('EUL4 role-based grants flip on when *_BA_ROLES was actually detected', () => {
      const adapter = createEulSchemaAdapter(
        infoFor('EUL4', ['EUL4_BA', 'EUL4_BA_ROLES']),
      );
      expect(adapter.hasRoleBasedGrants()).toBe(true);
    });
  });

  describe('normalizeRow', () => {
    it('coerces Y/N to boolean and numeric strings to numbers', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL5'));
      const row = normalizeRow(
        { EXP_ID: '42', EXP_NAME: 'X', EXP_TYPE: 'CI', EXP_NULLS_ALLOWED: 'N' },
        adapter.getExpressionColumns(),
      );
      expect(row.sourceId).toBe(42);
      expect(row.nullsAllowed).toBe(false);
    });

    it('applies fallback columns for missing EUL4 audit columns', () => {
      const adapter = createEulSchemaAdapter(infoFor('EUL4'));
      const created = new Date('2001-01-01T00:00:00Z');
      const row = normalizeRow(
        { OBJ_ID: 1, OBJ_NAME: 'F', OBJ_TYPE: 'TABLE', OBJ_CREATED_BY: 'BOB', OBJ_CREATED_DATE: created },
        adapter.getFolderColumns(),
      );
      expect(row.updatedBy).toBe('BOB');
      expect(row.updatedAt).toEqual(created);
      expect(row.description).toBeNull();
    });
  });
});

describe('unified read functions', () => {
  describe('readBusinessAreas', () => {
    it('EUL5: returns the full normalized shape', async () => {
      const { adapter, execute, db } = await adapterFor(eul5Db());
      const areas = await readBusinessAreas(adapter, execute);

      expect(areas).toHaveLength(1);
      expect(areas[0]).toMatchObject({
        sourceId: 100,
        name: 'Sales Analysis',
        language: 'GB',
        developerKey: 'SALES_BA',
        createdBy: 'DISCO_ADMIN',
        updatedBy: 'DISCO_ADMIN2',
      });
      const baSql = db.executed.find((sql) => sql.includes('EUL5_BA') && sql.includes('BA_NAME'));
      expect(baSql).toContain('BA_LANGUAGE');
      expect(baSql).toContain('EUL5_US.EUL5_BA');
    });

    it('EUL4: never selects EUL5-only columns and fills defaults', async () => {
      const { adapter, execute, db } = await adapterFor(eul4Db());
      const areas = await readBusinessAreas(adapter, execute);

      expect(areas).toHaveLength(1);
      expect(areas[0]).toMatchObject({
        sourceId: 10,
        name: 'Finance',
        language: 'US', // default — column doesn't exist in EUL4
        developerKey: null,
      });
      const baSql = db.executed.find((sql) => sql.includes('EUL4_BA') && sql.includes('BA_NAME'));
      expect(baSql).toBeDefined();
      expect(baSql).not.toContain('BA_LANGUAGE');
      expect(baSql).not.toContain('BA_DEVELOPER_KEY');
    });
  });

  describe('readFolders', () => {
    it('EUL5: maps folder metadata including SUMMARY folders', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const folders = await readFolders(adapter, execute);

      expect(folders.map((f) => f.folderType).sort()).toEqual(['SUMMARY', 'TABLE']);
      const table = folders.find((f) => f.folderType === 'TABLE');
      expect(table).toMatchObject({
        sourceId: 200,
        businessAreaId: 100,
        tableName: 'AP_INVOICES_ALL',
        tableOwner: 'APPS',
      });
    });

    it('EUL4: audit columns fall back to created values', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const folders = await readFolders(adapter, execute);

      expect(folders).toHaveLength(1);
      expect(folders[0]?.updatedBy).toBe('D4ADMIN');
      expect(folders[0]?.updatedAt).toEqual(folders[0]?.createdAt);
      expect(folders[0]?.description).toBeNull();
    });
  });

  describe('readItems', () => {
    it('EUL5: reads CI/CU by default, excluding SM rows, and coerces booleans', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const items = await readItems(adapter, execute);

      expect(items.map((i) => i.expType).sort()).toEqual(['CI', 'CU']);
      const ci = items.find((i) => i.expType === 'CI');
      expect(ci).toMatchObject({
        sourceId: 300,
        folderId: 200,
        columnName: 'INVOICE_AMOUNT',
        aggregation: 'SUM',
        nullsAllowed: false, // 'N' coerced
      });
      const cu = items.find((i) => i.expType === 'CU');
      expect(cu?.formula).toBe('INVOICE_AMOUNT * 1.2');
      expect(cu?.nullsAllowed).toBe(true);
    });

    it('EUL5: expTypes option reaches SM security-manager rows', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const sm = await readItems(adapter, execute, { expTypes: ['SM'] });
      expect(sm).toHaveLength(1);
      expect(sm[0]?.formula).toBe("REGION = 'EMEA'");
    });

    it('EUL4: missing columns come back as defaults', async () => {
      const { adapter, execute, db } = await adapterFor(eul4Db());
      const items = await readItems(adapter, execute);

      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item.nullsAllowed).toBe(true); // default
        expect(item.parentItemId).toBeNull();
        expect(item.description).toBeNull();
        expect(item.updatedBy).toBe(item.createdBy); // fallback column
      }
      const itemSql = db.executed.find((sql) => sql.includes('EUL4_EXPRESSIONS'));
      expect(itemSql).not.toContain('IT_EXP_ID');
      expect(itemSql).not.toContain('EXP_NULLS_ALLOWED');
    });
  });

  describe('readJoins', () => {
    it('EUL5: groups components under their join', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const joins = await readJoins(adapter, execute);

      expect(joins).toHaveLength(1);
      expect(joins[0]?.joinType).toBe('LEFT');
      expect(joins[0]?.components).toEqual([
        { masterItemId: 300, detailItemId: 301, operator: '=' },
        { masterItemId: 300, detailItemId: 302, operator: '=' },
      ]);
    });

    it("EUL4: normalizes the legacy OUTER join type to LEFT", async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const joins = await readJoins(adapter, execute);

      expect(joins).toHaveLength(1);
      expect(joins[0]?.joinType).toBe('LEFT');
      expect(joins[0]?.description).toBeNull();
      expect(joins[0]?.components).toHaveLength(1);
    });
  });

  describe('readHierarchies', () => {
    it('EUL4: attaches levels from the separate HIER_LEVELS table', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const hierarchies = await readHierarchies(adapter, execute);

      expect(hierarchies).toHaveLength(1);
      expect(hierarchies[0]?.levels).toEqual([
        {
          sourceId: 51,
          hierarchyId: 50,
          itemId: 30,
          name: 'Company',
          levelNumber: 1,
        },
      ]);
    });

    it('EUL5: uses HIER_LEVELS when populated', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const hierarchies = await readHierarchies(adapter, execute);
      expect(hierarchies[0]?.levels.map((l) => l.name)).toEqual(['Year', 'Month']);
    });

    it('EUL5: falls back to IT_EXP_ID expressions when HIER_LEVELS is empty', async () => {
      const db = eul5Db();
      db.tables.EUL5_HIER_LEVELS = [];
      db.tables.EUL5_EXPRESSIONS = [
        ...(db.tables.EUL5_EXPRESSIONS ?? []),
        {
          EXP_ID: 900,
          OBJ_ID: 200,
          EXP_NAME: 'Quarter Level',
          EXP_TYPE: 'HI',
          EXP_SEQUENCE: 2,
          IT_EXP_ID: 301,
          EXP_CREATED_BY: 'DISCO_ADMIN',
          EXP_CREATED_DATE: new Date('2010-03-15T10:00:00Z'),
        },
      ];
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);

      // Single hierarchy → fallback levels can be attributed to it.
      expect(hierarchies[0]?.levels).toEqual([
        {
          sourceId: 900,
          hierarchyId: 500,
          itemId: 301,
          name: 'Quarter Level',
          levelNumber: 2,
        },
      ]);
    });

    it('EUL5: fallback levels stay unattributed with several hierarchies', async () => {
      const db = eul5Db();
      db.tables.EUL5_HIER_LEVELS = [];
      db.tables.EUL5_HIERARCHIES = [
        ...(db.tables.EUL5_HIERARCHIES ?? []),
        {
          HIER_ID: 501,
          BA_ID: 100,
          HIER_NAME: 'Geo Hierarchy',
          HIER_DESCRIPTION: null,
          HIER_CREATED_BY: 'DISCO_ADMIN',
          HIER_CREATED_DATE: new Date('2010-03-15T10:00:00Z'),
          HIER_UPDATED_BY: 'DISCO_ADMIN',
          HIER_UPDATED_DATE: new Date('2010-03-15T10:00:00Z'),
        },
      ];
      db.tables.EUL5_EXPRESSIONS = [
        ...(db.tables.EUL5_EXPRESSIONS ?? []),
        {
          EXP_ID: 901,
          OBJ_ID: 200,
          EXP_NAME: 'Orphan Level',
          EXP_TYPE: 'HI',
          EXP_SEQUENCE: 1,
          IT_EXP_ID: 300,
          EXP_CREATED_BY: 'DISCO_ADMIN',
          EXP_CREATED_DATE: new Date('2010-03-15T10:00:00Z'),
        },
      ];
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);

      expect(hierarchies).toHaveLength(2);
      for (const h of hierarchies) {
        expect(h.levels).toEqual([]);
      }
    });

    it('survives a missing HIER_LEVELS table entirely', async () => {
      const db = eul4Db();
      delete db.tables.EUL4_HIER_LEVELS;
      const { adapter, execute } = await adapterFor(db);
      const hierarchies = await readHierarchies(adapter, execute);
      expect(hierarchies).toHaveLength(1);
      expect(hierarchies[0]?.levels).toEqual([]);
    });
  });

  describe('readWorkbooks', () => {
    it('EUL5: returns owner and developer key', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const workbooks = await readWorkbooks(adapter, execute);

      expect(workbooks).toHaveLength(1);
      expect(workbooks[0]).toMatchObject({
        sourceId: 700,
        name: 'Monthly Sales',
        owner: 'JSMITH',
        developerKey: 'MONTHLY_SALES',
      });
      expect(workbooks[0]?.content).toContain('<workbook>');
    });

    it('EUL4: workbook owner falls back to the creator', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const workbooks = await readWorkbooks(adapter, execute);

      expect(workbooks[0]?.owner).toBe('ACLARK'); // DOC_CREATED_BY fallback
      expect(workbooks[0]?.developerKey).toBeNull();
      expect(workbooks[0]?.content).toBe('<workbook/>');
    });
  });

  describe('readUsers / readGrants', () => {
    it('derives distinct users from ELEM_ACCESS grantees', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const users = await readUsers(adapter, execute);

      expect(users).toEqual([
        { username: 'JSMITH', source: 'ELEM_ACCESS' },
        { username: 'MJONES', source: 'ELEM_ACCESS' },
      ]);
    });

    it('maps grants with a derived BUSINESS_AREA/FOLDER level', async () => {
      const { adapter, execute } = await adapterFor(eul5Db());
      const grants = await readGrants(adapter, execute);

      expect(grants).toHaveLength(3);
      const baGrant = grants.find((g) => g.sourceId === 800);
      expect(baGrant).toMatchObject({
        grantee: 'JSMITH',
        businessAreaId: 100,
        folderId: null,
        level: 'BUSINESS_AREA',
      });
      const folderGrant = grants.find((g) => g.sourceId === 801);
      expect(folderGrant).toMatchObject({
        grantee: 'MJONES',
        businessAreaId: null,
        folderId: 200,
        level: 'FOLDER',
      });
    });

    it('reads EUL4 grants with the same shape', async () => {
      const { adapter, execute } = await adapterFor(eul4Db());
      const grants = await readGrants(adapter, execute);
      expect(grants).toHaveLength(1);
      expect(grants[0]?.level).toBe('BUSINESS_AREA');
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
      delete db.tables.EUL5_BA; // now ORA-00942s on read
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
      expect(items.map((i) => i.sourceId).sort()).toEqual([300, 301]);
    });

    it('preferVersion: EUL4 reads the EUL4 half of the same schema', async () => {
      const db = mixedDb();
      const execute = mockExecutor(db);
      const info = await detectEulVersionFromExecutor(execute, { preferVersion: 'EUL4' });
      const adapter = createEulSchemaAdapter(info);

      const areas = await readBusinessAreas(adapter, execute);
      expect(areas[0]?.name).toBe('Finance');
      expect(areas[0]?.language).toBe('US'); // EUL4 default, not the EUL5 'GB'
    });
  });
});
