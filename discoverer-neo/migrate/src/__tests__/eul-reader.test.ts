import { describe, it, expect } from '@jest/globals';

import { detectEulVersionFromExecutor } from '../services/eul-version-detector.js';
import { createEulSchemaAdapter } from '../services/eul-schema-adapter.js';
import {
  parseWorkbookContent,
  readBusinessAreas,
  readEulSchema,
  readFolders,
  readWorkbookUsage,
  readWorkbooks,
} from '../services/eul-reader.js';
import type { MockDb } from './helpers/mock-eul.js';
import { eul4Db, eul5Db, mixedDb, mockExecutor } from './helpers/mock-eul.js';

async function adapterFor(db: MockDb) {
  const execute = mockExecutor(db);
  const info = await detectEulVersionFromExecutor(execute);
  return { adapter: createEulSchemaAdapter(info), execute, info };
}

describe('parseWorkbookContent', () => {
  it('parses EUL5-style Workbook XML with worksheet names', async () => {
    const info = await parseWorkbookContent(
      '<Workbook name="WB"><Worksheet name="Sales"/><Worksheet name="Margins"/></Workbook>',
    );
    expect(info.parsed).toBe(true);
    expect(info.rootName).toBe('Workbook');
    expect(info.worksheetCount).toBe(2);
    expect(info.worksheets.map((w) => w.name)).toEqual(['Sales', 'Margins']);
    expect(info.parseError).toBeUndefined();
  });

  it('parses the lowercase EUL4 dialect case-insensitively', async () => {
    const info = await parseWorkbookContent('<workbook><worksheet name="Q1"/></workbook>');
    expect(info.parsed).toBe(true);
    expect(info.worksheetCount).toBe(1);
    expect(info.worksheets[0]?.name).toBe('Q1');
  });

  it('counts attribute-less worksheets (empty-string nodes from xml2js)', async () => {
    const info = await parseWorkbookContent('<workbook><worksheet/><worksheet/></workbook>');
    expect(info.worksheetCount).toBe(2);
    expect(info.worksheets.map((w) => w.name)).toEqual([null, null]);
  });

  it('counts nested item references', async () => {
    const info = await parseWorkbookContent(
      '<workbook><worksheet name="S"><item/><item/><column/></worksheet></workbook>',
    );
    expect(info.worksheetCount).toBe(1);
    expect(info.itemReferenceCount).toBe(3);
  });

  it('handles an empty root workbook', async () => {
    const info = await parseWorkbookContent('<workbook/>');
    expect(info.parsed).toBe(true);
    expect(info.rootName).toBe('workbook');
    expect(info.worksheetCount).toBe(0);
  });

  it('returns parsed:false for null or empty content, with no error', async () => {
    const nul = await parseWorkbookContent(null);
    expect(nul.parsed).toBe(false);
    expect(nul.parseError).toBeUndefined();
    const empty = await parseWorkbookContent('   ');
    expect(empty.parsed).toBe(false);
  });

  it('returns parsed:false with an error for non-XML content', async () => {
    const info = await parseWorkbookContent(' binary discoverer blob, not xml');
    expect(info.parsed).toBe(false);
    expect(info.parseError).toBeTruthy();
    expect(info.worksheetCount).toBe(0);
  });
});

describe('readWorkbooks', () => {
  it('EUL5: reads and parses workbook DOC_CONTENT', async () => {
    const workbooks = await readWorkbooks(mockExecutor(eul5Db()));
    expect(workbooks).toHaveLength(1);
    expect(workbooks[0]?.name).toBe('Monthly Sales');
    expect(workbooks[0]?.info.parsed).toBe(true);
    expect(workbooks[0]?.info.worksheetCount).toBe(1);
    expect(workbooks[0]?.info.worksheets[0]?.name).toBe('Sales');
  });

  it('EUL4: parses the minimal empty workbook', async () => {
    const workbooks = await readWorkbooks(mockExecutor(eul4Db()));
    expect(workbooks[0]?.info.parsed).toBe(true);
    expect(workbooks[0]?.info.worksheetCount).toBe(0);
  });
});

describe('readWorkbookUsage', () => {
  it('aggregates QPP_STATS rows per workbook, newest run wins', async () => {
    const db = eul5Db();
    db.tables.EUL5_QPP_STATS = [
      {
        DOC_NAME: 'Monthly Sales',
        ES_ELAPSED_TIME: 100,
        ES_ROWS_RETURNED: 500,
        ES_CREATED_DATE: new Date('2012-01-01T00:00:00Z'),
      },
      {
        DOC_NAME: 'Monthly Sales',
        ES_ELAPSED_TIME: 300,
        ES_ROWS_RETURNED: 700,
        ES_CREATED_DATE: new Date('2012-02-01T00:00:00Z'),
      },
      {
        DOC_NAME: 'Trial Balance',
        ES_ELAPSED_TIME: 50,
        ES_ROWS_RETURNED: 10,
        ES_CREATED_DATE: new Date('2012-01-15T00:00:00Z'),
      },
    ];
    const { adapter, execute } = await adapterFor(db);
    const usage = await readWorkbookUsage(adapter, execute);

    expect(usage).toHaveLength(2);
    // Sorted by execution count desc.
    expect(usage[0]).toMatchObject({
      workbookName: 'Monthly Sales',
      executionCount: 2,
      totalElapsedTime: 400,
      avgElapsedTime: 200,
      totalRowsReturned: 1200,
    });
    expect(usage[0]?.lastRun).toEqual(new Date('2012-02-01T00:00:00Z'));
    expect(usage[1]?.workbookName).toBe('Trial Balance');
  });

  it('returns [] when the QPP_STATS table is absent', async () => {
    const db = eul5Db();
    delete db.tables.EUL5_QPP_STATS;
    const { adapter, execute } = await adapterFor(db);
    expect(await readWorkbookUsage(adapter, execute)).toEqual([]);
  });
});

describe('readEulSchema', () => {
  it('EUL5: reads the full normalized data set', async () => {
    const { version, data } = await readEulSchema(mockExecutor(eul5Db()));

    expect(version.version).toBe('EUL5');
    expect(data.businessAreas).toHaveLength(1);
    expect(data.folders).toHaveLength(2);
    expect(data.items.map((i) => i.expType).sort()).toEqual(['CI', 'CU']);
    expect(data.conditions).toHaveLength(0);
    // The 'SM' security-manager expression is read into securityConditions.
    expect(data.securityConditions).toHaveLength(1);
    expect(data.securityConditions[0]?.expType).toBe('SM');
    expect(data.joins).toHaveLength(1);
    expect(data.hierarchies).toHaveLength(1);
    expect(data.customFunctions).toHaveLength(1);
    expect(data.users.map((u) => u.username)).toEqual(['JSMITH', 'MJONES']);
    expect(data.grants).toHaveLength(3);
    expect(data.workbooks).toHaveLength(1);
    expect(data.workbooks[0]?.info.worksheetCount).toBe(1);
    expect(data.workbookUsage).toEqual([]);
  });

  it('EUL4: never reads securityConditions and fills version defaults', async () => {
    const { version, data } = await readEulSchema(mockExecutor(eul4Db()));

    expect(version.version).toBe('EUL4');
    expect(data.securityConditions).toEqual([]);
    expect(data.businessAreas[0]?.language).toBe('US'); // EUL4 default
    expect(data.items).toHaveLength(2);
    expect(data.workbooks[0]?.info.parsed).toBe(true);
  });

  it('reads workbook usage into the data set when a query log exists', async () => {
    const db = eul5Db();
    db.tables.EUL5_QPP_STATS = [
      {
        DOC_NAME: 'Monthly Sales',
        ES_ELAPSED_TIME: 120,
        ES_ROWS_RETURNED: 42,
        ES_CREATED_DATE: new Date('2012-03-01T00:00:00Z'),
      },
    ];
    const { data } = await readEulSchema(mockExecutor(db));
    expect(data.workbookUsage).toHaveLength(1);
    expect(data.workbookUsage[0]?.executionCount).toBe(1);
  });

  it('mixed schema: reads the EUL5 half; preferVersion:EUL4 reads the EUL4 half', async () => {
    const five = await readEulSchema(mockExecutor(mixedDb()));
    expect(five.version.version).toBe('EUL5');
    expect(five.data.businessAreas[0]?.name).toBe('Sales Analysis');

    const four = await readEulSchema(mockExecutor(mixedDb()), { preferVersion: 'EUL4' });
    expect(four.version.version).toBe('EUL4');
    expect(four.data.businessAreas[0]?.name).toBe('Finance');
  });
});

describe('per-entity convenience readers', () => {
  it('detect-and-read business areas and folders from a connection source', async () => {
    const areas = await readBusinessAreas(mockExecutor(eul5Db()));
    expect(areas[0]?.name).toBe('Sales Analysis');

    const folders = await readFolders(mockExecutor(eul4Db()));
    expect(folders).toHaveLength(1);
    expect(folders[0]?.name).toBe('GL Balances');
  });
});
