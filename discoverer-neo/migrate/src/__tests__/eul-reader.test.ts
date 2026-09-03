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
  summarizeWorkbookDocument,
} from '../services/eul-reader.js';
import type { MockDb } from './helpers/mock-eul.js';
import { eul4Db, eul5Db, mixedDb, mockExecutor } from './helpers/mock-eul.js';
import { buildWorkbookFixture } from '../testing/workbook-fixture.js';

async function adapterFor(db: MockDb) {
  const execute = mockExecutor(db);
  const info = await detectEulVersionFromExecutor(execute);
  return { adapter: createEulSchemaAdapter(info), execute, info };
}

describe('parseWorkbookContent', () => {
  it('decodes a Discoverer binary workbook into worksheets and columns', () => {
    const doc = parseWorkbookContent(
      buildWorkbookFixture({
        name: 'WB',
        worksheets: [
          {
            name: 'Sales',
            columns: [
              { folderLabel: 'F', itemLabel: 'Amount', heading: 'Total', formatMask: '9999' },
            ],
          },
        ],
      }),
    );
    expect(doc.format).toBe('DIS');
    expect(doc.name).toBe('WB');
    expect(doc.worksheets.map((w) => w.name)).toEqual(['Sales']);
    expect(doc.worksheets[0]?.columns).toEqual([
      expect.objectContaining({ itemLabel: 'Amount', heading: 'Total', formatMask: '9999' }),
    ]);
  });

  it('summarizes a decoded workbook for the assessment report', () => {
    const info = summarizeWorkbookDocument(
      parseWorkbookContent(
        buildWorkbookFixture({
          worksheets: [
            { name: 'A', columns: [{ itemLabel: 'X' }, { itemLabel: 'Y' }] },
            { name: 'B', columns: [{ itemLabel: 'Z' }] },
          ],
          parameters: [{ name: 'P' }],
        }),
      ),
    );
    expect(info).toMatchObject({
      parsed: true,
      format: 'DIS',
      worksheetCount: 2,
      itemReferenceCount: 3,
      parameterCount: 1,
    });
    expect(info.worksheets.map((w) => w.name)).toEqual(['A', 'B']);
  });

  it('falls back to an XML summary when the body is text (later releases)', () => {
    const doc = parseWorkbookContent(
      '<Workbook name="WB"><Worksheet name="Sales"/><Worksheet name="Margins"/></Workbook>',
    );
    expect(doc.format).toBe('XML');
    expect(doc.name).toBe('WB');
    expect(doc.worksheets.map((w) => w.name)).toEqual(['Sales', 'Margins']);
  });

  it('reports an empty body rather than failing', () => {
    expect(parseWorkbookContent(null).format).toBe('EMPTY');
    expect(parseWorkbookContent('   ').format).toBe('EMPTY');
    expect(parseWorkbookContent(Buffer.alloc(0)).format).toBe('EMPTY');
  });

  it('reports a body that carries no Discoverer records', () => {
    const doc = parseWorkbookContent(Buffer.from('not a workbook at all', 'latin1'));
    expect(doc.format).toBe('UNKNOWN');
    expect(doc.worksheets).toHaveLength(0);
    expect(doc.warnings.length).toBeGreaterThan(0);
  });
});

describe('readWorkbooks', () => {
  it('EUL5: reads the workbook body from DOC_DOCUMENT and decodes it', async () => {
    const workbooks = await readWorkbooks(mockExecutor(eul5Db()));
    expect(workbooks).toHaveLength(1);
    expect(workbooks[0]?.name).toBe('Monthly Sales');
    expect(workbooks[0]?.contentType).toBe('application/vnd.oracle-disco.wb');
    expect(Buffer.isBuffer(workbooks[0]?.content)).toBe(true);
    expect(workbooks[0]?.info.parsed).toBe(true);
    expect(workbooks[0]?.document.worksheets.map((w) => w.name)).toEqual(['Sales']);
    expect(workbooks[0]?.document.worksheets[0]?.columns.map((c) => c.itemLabel)).toEqual([
      'Invoice Amount',
      'Region',
    ]);
  });

  it('EUL4: same read under the EUL4_ prefix', async () => {
    const workbooks = await readWorkbooks(mockExecutor(eul4Db()));
    expect(workbooks[0]?.name).toBe('Trial Balance');
    expect(workbooks[0]?.info.worksheetCount).toBe(1);
    expect(workbooks[0]?.contentLength).toBeGreaterThan(0);
    expect(workbooks[0]?.isBatch).toBe(false);
  });

  // The body column is probed, not assumed: a source without it must still
  // yield workbook metadata rather than failing the whole read.
  it('degrades to metadata-only when no body column exists', async () => {
    const db = eul5Db();
    db.tables.EUL5_DOCUMENTS = db.tables.EUL5_DOCUMENTS!.map((row) => {
      const { DOC_DOCUMENT: _omitted, ...rest } = row;
      return rest;
    });
    const workbooks = await readWorkbooks(mockExecutor(db));
    expect(workbooks[0]?.name).toBe('Monthly Sales');
    expect(workbooks[0]?.content).toBeNull();
    expect(workbooks[0]?.info.parsed).toBe(false);
  });
});

describe('readWorkbookUsage', () => {
  it('aggregates QPP_STATS rows per workbook, newest run wins', async () => {
    const db = eul5Db();
    db.tables.EUL5_QPP_STATS = [
      {
        QS_DOC_NAME: 'Monthly Sales',
        QS_ACT_ELAP_TIME: 100,
        QS_NUM_ROWS: 500,
        QS_CREATED_DATE: new Date('2012-01-01T00:00:00Z'),
      },
      {
        QS_DOC_NAME: 'Monthly Sales',
        QS_ACT_ELAP_TIME: 300,
        QS_NUM_ROWS: 700,
        QS_CREATED_DATE: new Date('2012-02-01T00:00:00Z'),
      },
      {
        QS_DOC_NAME: 'Trial Balance',
        QS_ACT_ELAP_TIME: 50,
        QS_NUM_ROWS: 10,
        QS_CREATED_DATE: new Date('2012-01-15T00:00:00Z'),
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
    expect(data.businessAreas).toHaveLength(2);
    expect(data.folders).toHaveLength(2);
    // CO (database items) plus CI (created items) — CO is the one the old
    // ['CI','CU'] default silently skipped.
    expect(data.items.map((i) => i.expType).sort()).toEqual(['CI', 'CO', 'CO']);
    // No confirmed EXP_TYPE discriminates a condition row, so these stay
    // empty rather than re-reading items under a wrong label.
    expect(data.conditions).toHaveLength(0);
    expect(data.securityConditions).toHaveLength(0);
    expect(data.joins).toHaveLength(1);
    expect(data.hierarchies).toHaveLength(1);
    expect(data.customFunctions).toHaveLength(1);
    expect(data.users.map((u) => u.username)).toEqual(['JSMITH', 'MJONES', 'SALES_ROLE']);
    expect(data.grants).toHaveLength(3);
    expect(data.workbooks).toHaveLength(1);
    expect(data.workbookUsage).toEqual([]);
  });

  it('EUL4: reads the same normalized shape as EUL5', async () => {
    const { version, data } = await readEulSchema(mockExecutor(eul4Db()));

    expect(version.version).toBe('EUL4');
    expect(data.securityConditions).toEqual([]);
    expect(data.businessAreas[0]?.name).toBe('Finance');
    expect(data.items).toHaveLength(2);
    expect(data.workbooks).toHaveLength(1);
  });

  it('reads workbook usage into the data set when a query log exists', async () => {
    const db = eul5Db();
    db.tables.EUL5_QPP_STATS = [
      {
        QS_DOC_NAME: 'Monthly Sales',
        QS_ACT_ELAP_TIME: 120,
        QS_NUM_ROWS: 42,
        QS_CREATED_DATE: new Date('2012-03-01T00:00:00Z'),
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
