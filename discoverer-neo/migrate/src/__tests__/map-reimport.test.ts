/**
 * Tests for the maps-only re-import.
 *
 * The setup is deliberately two-phase: run a full migration into the fake
 * target first, then re-import maps against it. That is the real situation the
 * feature exists for — a database that has already been migrated, whose maps
 * are wrong because an earlier version of the tool could not read the workbook
 * body — and it means the tests exercise the same name-resolution path a
 * production re-import uses rather than a hand-built target.
 */

import { describe, it, expect } from '@jest/globals';

import {
  DEFAULT_HOST_BUSINESS_AREA,
  MapReimportError,
  reimportMaps,
} from '../services/map-reimport.js';
import { runMigration } from '../services/migration-runner.js';
import { createFakeWriter, emptyTargetTables } from '../testing/fake-writer.js';
import type { FakeWriterState } from '../testing/fake-writer.js';
import { eul5Db, mockExecutor } from '../testing/mock-eul.js';
import { buildWorkbookFixture } from '../testing/workbook-fixture.js';
import type { TargetTable } from '../db/schema.js';

function rowsOf(state: FakeWriterState, table: TargetTable): Array<Record<string, unknown>> {
  return state.tables[table];
}

/** Deterministic ids/clock so assertions do not depend on randomness. */
function deterministicDeps(): { genId: () => string; now: () => Date } {
  let n = 0;
  return {
    genId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    now: () => new Date('2026-01-01T00:00:00Z'),
  };
}

/** A target that has already been migrated from the EUL5 fixture. */
async function migratedTarget() {
  const fake = createFakeWriter();
  await runMigration({
    source: mockExecutor(eul5Db()),
    writer: fake.writer,
    deps: deterministicDeps(),
  });
  return fake;
}

describe('reimportMaps', () => {
  it('replaces the migrated maps and rebuilds their layout', async () => {
    const { writer, state } = await migratedTarget();
    const mapsBefore = rowsOf(state, 'maps').map((m) => m.id);
    expect(mapsBefore.length).toBeGreaterThan(0);

    const result = await reimportMaps({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.dryRun).toBe(false);
    expect(result.replacedMaps).toBe(mapsBefore.length);
    expect(result.written.maps).toBe(mapsBefore.length);

    // Every map is new — the old rows went, they were not updated in place.
    const mapsAfter = rowsOf(state, 'maps').map((m) => m.id);
    expect(mapsAfter).toHaveLength(mapsBefore.length);
    expect(mapsAfter.some((id) => mapsBefore.includes(id))).toBe(false);

    // And the columns resolved against the items already in the target.
    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    expect(
      rowsOf(state, 'map_items').map((mi) => itemsById.get(mi.itemId)?.name),
    ).toEqual(['Invoice Amount', 'Region']);
    expect(rowsOf(state, 'map_parameters')).toHaveLength(1);
    expect(rowsOf(state, 'map_conditions')).toHaveLength(1);
  });

  it('leaves the rest of the migration untouched', async () => {
    const { writer, state } = await migratedTarget();
    const before = {
      users: rowsOf(state, 'users').length,
      business_areas: rowsOf(state, 'business_areas').length,
      folders: rowsOf(state, 'folders').length,
      items: rowsOf(state, 'items').length,
      grants: rowsOf(state, 'user_business_area_grants').length,
    };

    await reimportMaps({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    expect({
      users: rowsOf(state, 'users').length,
      business_areas: rowsOf(state, 'business_areas').length,
      folders: rowsOf(state, 'folders').length,
      items: rowsOf(state, 'items').length,
      grants: rowsOf(state, 'user_business_area_grants').length,
    }).toEqual(before);
  });

  it('deletes the old maps dependants along with the maps', async () => {
    const { writer, state } = await migratedTarget();
    const staleMapId = rowsOf(state, 'maps')[0]!.id;
    // Stand in for rows a previous run left behind.
    state.tables.map_items.push({ id: 'stale', mapId: staleMapId, itemId: 'x', displayOrder: 0 });
    const staleCount = rowsOf(state, 'map_items').length;

    await reimportMaps({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    expect(rowsOf(state, 'map_items').some((mi) => mi.id === 'stale')).toBe(false);
    expect(rowsOf(state, 'map_items').length).not.toBe(staleCount);
  });

  it('does not touch maps outside the host business area', async () => {
    const { writer, state } = await migratedTarget();
    // A map a user built in Neo, in a real business area.
    const realBa = rowsOf(state, 'business_areas').find(
      (b) => b.name !== DEFAULT_HOST_BUSINESS_AREA,
    );
    state.tables.maps.push({ id: 'user-map', name: 'Hand built', businessAreaId: realBa?.id });
    state.tables.map_items.push({ id: 'user-item', mapId: 'user-map', itemId: 'x' });

    await reimportMaps({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    expect(rowsOf(state, 'maps').some((m) => m.id === 'user-map')).toBe(true);
    expect(rowsOf(state, 'map_items').some((mi) => mi.id === 'user-item')).toBe(true);
  });

  it('writes nothing on a dry run but reports what it would do', async () => {
    const { writer, state } = await migratedTarget();
    const mapsBefore = rowsOf(state, 'maps').map((m) => m.id);
    const itemsBefore = rowsOf(state, 'map_items').map((mi) => mi.id);

    const result = await reimportMaps({
      source: mockExecutor(eul5Db()),
      writer,
      dryRun: true,
      deps: deterministicDeps(),
    });

    expect(result.dryRun).toBe(true);
    expect(result.planned.maps).toBeGreaterThan(0);
    expect(result.written.maps).toBe(0);
    expect(rowsOf(state, 'maps').map((m) => m.id)).toEqual(mapsBefore);
    expect(rowsOf(state, 'map_items').map((mi) => mi.id)).toEqual(itemsBefore);
  });

  it('rolls the whole re-import back if a write fails', async () => {
    const { state } = await migratedTarget();
    const mapsBefore = rowsOf(state, 'maps').map((m) => m.id);

    // A failure partway through must not leave the target with the old maps
    // deleted and the new ones missing.
    const failing = createFakeWriter({ failOnInsert: 'map_items', tables: state.tables });

    await expect(
      reimportMaps({
        source: mockExecutor(eul5Db()),
        writer: failing.writer,
        deps: deterministicDeps(),
      }),
    ).rejects.toThrow(/map_items/);

    expect(rowsOf(failing.state, 'maps').map((m) => m.id)).toEqual(mapsBefore);
  });

  // A target whose schema is behind the code is the one failure a dry run
  // could not see: it plans every row and writes none, so it used to report a
  // clean plan and let the live run die mid-transaction instead.
  it('refuses a target missing a table it writes — on a dry run too', async () => {
    const { state } = await migratedTarget();

    for (const dryRun of [true, false]) {
      const behind = createFakeWriter({
        tables: state.tables,
        failOnCount: ['map_totals', 'map_page_setup'],
      });

      await expect(
        reimportMaps({
          source: mockExecutor(eul5Db()),
          writer: behind.writer,
          dryRun,
          deps: deterministicDeps(),
        }),
      ).rejects.toThrow(/map_totals, map_page_setup/);
    }
  });

  it('does not put bound row values in a write failure', async () => {
    const { state } = await migratedTarget();
    // What Drizzle actually produces: the statement, then every bound value.
    const secret = 'Nome Entidade CONFIDENCIAL';
    const failing = createFakeWriter({ tables: state.tables });
    failing.writer.transaction = () =>
      Promise.reject(
        new Error(`insert into "map_items" ... failed\nparams: ["${secret}","hash$2b$10$abc"]`),
      );

    const error = await reimportMaps({
      source: mockExecutor(eul5Db()),
      writer: failing.writer,
      deps: deterministicDeps(),
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(MapReimportError);
    const message = (error as Error).message;
    expect(message).toContain('insert into "map_items"');
    expect(message).not.toContain(secret);
    expect(message).not.toContain('hash$2b$10$abc');
    // And it says the old maps survived, because they did.
    expect(message).toMatch(/rolled back/i);
  });

  it('refuses a target that was never migrated', async () => {
    const fake = createFakeWriter();
    fake.state.tables = emptyTargetTables();

    await expect(
      reimportMaps({ source: mockExecutor(eul5Db()), writer: fake.writer }),
    ).rejects.toBeInstanceOf(MapReimportError);
  });

  it('drops a column whose item is gone from the target and counts it', async () => {
    const { writer, state } = await migratedTarget();
    // The EUL still has 'Region'; the target no longer does.
    state.tables.items = state.tables.items.filter((i) => i.name !== 'Region');

    const result = await reimportMaps({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.unresolvedItems).toBe(1);
    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    expect(rowsOf(state, 'map_items').map((mi) => itemsById.get(mi.itemId)?.name)).toEqual([
      'Invoice Amount',
    ]);
  });

  // --- the worksheet layout (EUL_SCHEMA_GROUND_TRUTH.md §7.8/§7.9) ---------

  it('rebuilds the axis, its position and Distinct, not just the column list', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
        {
          folderName: 'INVOICE_HEADERS',
          folderLabel: 'Invoice Headers',
          itemName: 'INVOICE_AMOUNT',
          itemLabel: 'Invoice Amount',
          sourceId: 300,
        },
        {
          folderName: 'INVOICE_HEADERS',
          folderLabel: 'Invoice Headers',
          itemName: 'AMOUNT_WITH_TAX',
          itemLabel: 'Amount With Tax',
          sourceId: 301,
        },
      ],
      calculations: [
        { name: 'Margem', formula: '[1,1]([6,2])', placement: 1, hidden: false },
      ],
      worksheets: [
        {
          name: 'Sales',
          viewType: 'CROSSTAB',
          distinct: true,
          columns: [
            { item: 'Region', axisType: 0 },
            { item: 'Invoice Amount', axisType: 1 },
          ],
          hiddenItems: ['Amount With Tax'],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = rowsOf(state, 'maps')[0]!;
    expect(map).toMatchObject({ mapType: 'CROSSTAB', selectDistinct: true });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    expect(
      rowsOf(state, 'map_items')
        .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
        .map((mi) => [itemsById.get(mi.itemId)?.name, mi.axisType, mi.axisOrder, mi.isHidden]),
    ).toEqual([
      ['Region', 'AXIS', 0, false],
      ['Invoice Amount', 'MEASURE', 0, false],
      ['Amount With Tax', 'AXIS', 1, true],
    ]);

    expect(rowsOf(state, 'map_calculated_fields')).toEqual([
      expect.objectContaining({ name: 'Margem', axisType: 'MEASURE', isHidden: false }),
    ]);
  });

  it('rebuilds sorting the same way a full run writes it', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
        {
          folderName: 'INVOICE_HEADERS',
          folderLabel: 'Invoice Headers',
          itemName: 'INVOICE_AMOUNT',
          itemLabel: 'Invoice Amount',
          sourceId: 300,
        },
      ],
      worksheets: [
        {
          name: 'Sales',
          columns: [
            { item: 'Region', axisType: 0 },
            { item: 'Invoice Amount', axisType: 1 },
          ],
          sorts: [
            { item: 'Region', direction: 1, grouped: true },
            { item: 'Invoice Amount', direction: 2 },
          ],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    expect(
      rowsOf(state, 'map_items')
        .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
        .map((mi) => [
          itemsById.get(mi.itemId)?.name,
          mi.sortDirection,
          mi.sortOrder,
          mi.sortGroup,
        ]),
    ).toEqual([
      ['Region', 'ASC', 0, true],
      ['Invoice Amount', 'DESC', 1, false],
    ]);
  });

  it('rebuilds totals the same way a full run writes them', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const mapItemsById = new Map(
      rowsOf(state, 'map_items').map((mi) => [
        mi.id as string,
        itemsById.get(mi.itemId as string)?.name,
      ]),
    );
    expect(
      rowsOf(state, 'map_totals')
        .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
        .map((t) => [
          t.label,
          t.aggFunction,
          t.placement,
          mapItemsById.get(t.mapItemId as string),
          t.breakMapItemId === null ? null : mapItemsById.get(t.breakMapItemId as string),
        ]),
    ).toEqual([
      ['SubTotal por &Value', 'SUM', 'AT_CHANGE', 'Invoice Amount', 'Region'],
      ['Total Geral', 'SUM', 'GRAND_TOTAL', 'Invoice Amount', null],
    ]);
  });

  it('replaces a map’s totals rather than leaving the old ones behind', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();
    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });
    const first = rowsOf(state, 'map_totals').map((t) => t.id);
    expect(first.length).toBeGreaterThan(0);

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });
    const second = rowsOf(state, 'map_totals');
    // Deleting the map cascades to its totals, so a second run leaves the same
    // count — never two generations of the same total on one map.
    expect(second).toHaveLength(first.length);
    const liveMaps = new Set(rowsOf(state, 'maps').map((m) => m.id as string));
    expect(second.every((t) => liveMaps.has(t.mapId as string))).toBe(true);
  });

  it('rebuilds item format fields the same way a full run writes them', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
      ],
      worksheets: [
        {
          name: 'Sales',
          columns: [
            {
              item: 'Region',
              axisType: 0,
              dataType: 2,
              displayWidth: 80,
              alignment: 3,
              wordWrap: true,
              headingFormatMask: 'HEAD',
            },
          ],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = rowsOf(state, 'maps')[0]!;
    const row = rowsOf(state, 'map_items').find((mi) => mi.mapId === map.id);
    expect(row).toMatchObject({
      columnWidth: 80,
      dataType: 'NUMBER',
      headingFormatMask: 'HEAD',
      wordWrap: true,
      alignment: null,
      sourceAttrs: { alignmentCode: 3 },
    });
  });

  it('rebuilds page setup the same way a full run writes it', async () => {
    const { writer, state } = await migratedTarget();
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      pageSetup: {
        texts: [null, null, null, null, null, '&Page / &Pages'],
        margins: [1, 1, 0.75, 0.75, 0.5, 0.5],
      },
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
      ],
      worksheets: [{ name: 'Sales', columns: [{ item: 'Region', axisType: 0 }] }],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = rowsOf(state, 'maps')[0]!;
    const setup = rowsOf(state, 'map_page_setup').find((p) => p.mapId === map.id);
    expect(setup).toMatchObject({ orientation: null, marginTop: null });
    expect(setup?.sourceAttrs).toMatchObject({
      texts: [null, null, null, null, null, '&Page / &Pages'],
      margins: [1, 1, 0.75, 0.75, 0.5, 0.5],
    });
  });

  // The same gap the full runner had: a layout row only when a join was
  // forced, so the printed title was lost on most worksheets. Both writers
  // share `buildMapLayoutRow` now, so both must show it.
  it('writes a layout row carrying the printed title, with no join forced', async () => {
    const { writer, state } = await migratedTarget();

    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
      ],
      worksheets: [
        {
          name: 'Sales',
          title: 'Vendas por Região',
          guid: 'A1B2-C3D4',
          columns: [{ item: 'Region', axisType: 0 }],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    const result = await reimportMaps({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
    });

    const map = rowsOf(state, 'maps')[0]!;
    const layout = rowsOf(state, 'map_layouts').find((l) => l.mapId === map.id);
    expect(layout).toMatchObject({
      worksheetIndex: 0,
      worksheetGuid: 'A1B2-C3D4',
      title: 'Vendas por Região',
    });
    expect(layout?.sourceAttrs).toBeNull();
    // One per map, so the operator's count is a map count, not a join count.
    expect(result.written.map_layouts).toBe(result.written.maps);
  });

  it('records a forced join with no join id — this run does not rebuild joins', async () => {
    const { writer, state } = await migratedTarget();
    // The full migration above already wrote a `joins` row for KEY_ID 400 —
    // proving the gap is resolution, not the join's existence in the target.
    expect(rowsOf(state, 'joins').length).toBeGreaterThan(0);

    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      items: [
        {
          folderName: 'SALES_SUMMARY',
          folderLabel: 'Sales Summary',
          itemName: 'REGION',
          itemLabel: 'Region',
          sourceId: 302,
        },
      ],
      joins: [{ name: 'Invoices to Summary', sourceId: 400, identifier: 'JOIN_400' }],
      worksheets: [
        {
          name: 'Sales',
          columns: [{ item: 'Region', axisType: 0 }],
          joins: ['Invoices to Summary'],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    await reimportMaps({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = rowsOf(state, 'maps')[0]!;
    const layout = rowsOf(state, 'map_layouts').find((l) => l.mapId === map.id);
    expect(layout?.sourceAttrs).toMatchObject({
      joins: [
        expect.objectContaining({
          eulJoinSourceId: 400,
          identifier: 'JOIN_400',
          name: 'Invoices to Summary',
          joinIds: null,
        }),
      ],
    });
  });
});
