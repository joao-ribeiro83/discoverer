/**
 * End-to-end migration-runner tests.
 *
 * These are hermetic but genuinely end-to-end: the read side runs the *real*
 * version detector, schema adapter and EUL reader over the mock Oracle
 * fixtures, and the write side runs the real transform + FK-resolution
 * pipeline into an in-memory `MigrationWriter`. Only Oracle and Postgres
 * themselves are substituted.
 */

import {
  describeWriteFailure,
  dryRun,
  runMigration,
  TARGET_TABLE_ORDER,
} from '../services/migration-runner.js';
import type { MigrationEvent } from '../services/migration-runner.js';
import { createFakeWriter } from './helpers/fake-writer.js';
import type { FakeWriterState } from './helpers/fake-writer.js';
import { eul4Db, eul5Db, mixedDb, mockExecutor } from './helpers/mock-eul.js';
import { buildWorkbookFixture } from '../testing/workbook-fixture.js';
import type { TargetTable } from '../db/schema.js';

// Deterministic UUID minting and clock, so assertions are stable.
function deterministicDeps() {
  let n = 0;
  return {
    genId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    now: () => new Date('2026-07-18T00:00:00.000Z'),
  };
}

const rowsOf = (state: FakeWriterState, table: TargetTable): Array<Record<string, unknown>> =>
  state.tables[table];

/** First row, asserting presence (keeps `noUncheckedIndexedAccess` happy). */
function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('expected at least one row');
  return row;
}

describe('runMigration — EUL5 source, end to end', () => {
  it('migrates every entity type into the target', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.version.version).toBe('EUL5');
    expect(result.dryRun).toBe(false);
    expect(result.runId).toBeTruthy();

    // 3 EUL_USERS rows (JSMITH, MJONES, SALES_ROLE) + the migration service user.
    expect(rowsOf(state, 'users')).toHaveLength(4);
    // 2 real business areas + the auto-created host for workbook maps.
    expect(rowsOf(state, 'business_areas')).toHaveLength(3);
    expect(result.syntheticBusinessAreas).toBe(1);
    expect(rowsOf(state, 'folders')).toHaveLength(2);
    // EXP 300 (CO), 301 (CI) and 302 (CO) all migrate — CO is the plain
    // column-backed item the old ['CI','CU'] default silently skipped.
    expect(rowsOf(state, 'items')).toHaveLength(3);
    expect(rowsOf(state, 'hierarchies')).toHaveLength(1);
    expect(rowsOf(state, 'hierarchy_levels')).toHaveLength(3);
    expect(rowsOf(state, 'custom_functions')).toHaveLength(1);
    expect(rowsOf(state, 'maps')).toHaveLength(1);
    expect(rowsOf(state, 'user_business_area_grants')).toHaveLength(3);

    expect(result.validation?.valid).toBe(true);
    expect(state.ensureSchemaCalls).toBe(1);
    expect(state.transactionCalls).toBe(1);
  });

  it('migrates database items (CO) alongside created items (CI)', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    const names = rowsOf(state, 'items').map((r) => r.name);
    // 'Invoice Amount' and 'Region' are CO rows; before the ground-truth fix
    // the reader asked for CI/CU only and both were lost.
    expect(names).toEqual(
      expect.arrayContaining(['Invoice Amount', 'Amount With Tax', 'Region']),
    );
  });

  it('migrates a folder-to-folder join with null item ids', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    // KEY_CONS 400 binds folder 200 to folder 201. Neo's join folder ids are
    // NOT NULL and its item ids nullable, which is exactly this shape.
    const joins = rowsOf(state, 'joins');
    expect(joins).toHaveLength(1);
    expect(first(joins).leftItemId).toBeNull();
    expect(first(joins).rightItemId).toBeNull();
    expect(first(joins).leftFolderId).not.toBe(first(joins).rightFolderId);
  });

  it('preserves a folder shared across business areas (BA_OBJ_LINKS is m:n)', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    // Folder 200 is linked to BA 100 and BA 101. It owns one and is shared
    // into the other, so exactly one share row is written — and the migration
    // says so rather than dropping the second membership silently.
    const shares = rowsOf(state, 'folder_business_areas');
    expect(shares).toHaveLength(1);
    expect(result.warnings.map((w) => w.code)).toContain(
      'FOLDER_SHARED_ACROSS_BUSINESS_AREAS',
    );

    // The share must name the *other* business area — never duplicate the
    // folder's owning one, which folders.business_area_id already records.
    const share = first(shares);
    const sharedFolder = rowsOf(state, 'folders').find((f) => f.id === share.folderId);
    expect(sharedFolder).toBeDefined();
    expect(share.businessAreaId).not.toBe(sharedFolder?.businessAreaId);

    // And it points at a business area that really was migrated.
    const baIds = new Set(rowsOf(state, 'business_areas').map((b) => b.id));
    expect(baIds.has(share.businessAreaId)).toBe(true);
  });

  it('provisions a temporary password per person and never leaks it', async () => {
    const { writer, state } = createFakeWriter();
    const emitted: { username: string; email: string; temporaryPassword: string }[] = [];
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: {
        ...deterministicDeps(),
        hashPassword: (plain) => Promise.resolve(`hashed:${plain}`),
        emitCredentials: (creds) => {
          emitted.push(...creds);
          return Promise.resolve();
        },
      },
    });

    const people = rowsOf(state, 'users').filter((u) => u.isRole === false && u.name !== 'Migration Service');
    expect(people.length).toBeGreaterThan(0);

    // Every person got a real hash and is forced to rotate it.
    for (const p of people) {
      expect(p.passwordHash).toMatch(/^hashed:/);
      expect(p.mustChangePassword).toBe(true);
    }

    // Roles get NO credential and nothing to rotate.
    const role = rowsOf(state, 'users').find((u) => u.name === 'SALES_ROLE');
    expect(role?.passwordHash).toBe('!migrated-no-login');
    expect(role?.mustChangePassword).toBe(false);
    expect(emitted.map((e) => e.username)).not.toContain('SALES_ROLE');

    // The plaintext reached the sink...
    expect(emitted.length).toBe(people.length);
    for (const c of emitted) expect(c.temporaryPassword).toHaveLength(16);

    // ...and must appear NOWHERE in the serialized result, which is returned
    // over the API and written to the durable migration log.
    const serialized = JSON.stringify(result);
    for (const c of emitted) {
      expect(serialized).not.toContain(c.temporaryPassword);
    }
  });

  it('creates login-disabled accounts when no hasher is supplied', async () => {
    // The safe default: never silently fall back to a usable credential.
    const { writer, state } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });
    for (const u of rowsOf(state, 'users')) {
      expect(u.mustChangePassword).toBe(false);
    }
  });

  it('does not emit credentials on a dry run', async () => {
    const { writer } = createFakeWriter();
    let called = false;
    await dryRun({
      source: mockExecutor(eul5Db()),
      writer,
      deps: {
        ...deterministicDeps(),
        hashPassword: (p) => Promise.resolve(`hashed:${p}`),
        emitCredentials: () => {
          called = true;
          return Promise.resolve();
        },
      },
    });
    // Nothing was written, so no account exists to hold these passwords.
    expect(called).toBe(false);
  });

  it('migrates a database role as a non-login principal', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    const role = rowsOf(state, 'users').find((u) => u.name === 'SALES_ROLE');
    expect(role?.isRole).toBe(true);
    // People are not marked as roles.
    expect(rowsOf(state, 'users').find((u) => u.name === 'JSMITH')?.isRole).toBe(false);
    expect(result.warnings.map((w) => w.code)).toContain('GRANTEE_IS_DB_ROLE');
  });

  it('preserves the hierarchy tree shape via parent_level_id', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    // Fixture tree: 510 (root) → 511 → 512, so exactly one level is a root and
    // each deeper level points at the one above it.
    const levels = rowsOf(state, 'hierarchy_levels');
    expect(levels).toHaveLength(3);
    const roots = levels.filter((l) => l.parentLevelId === null);
    expect(roots).toHaveLength(1);
    expect(first(roots).levelNumber).toBe(1);

    const byId = new Map(levels.map((l) => [l.id, l]));
    for (const lvl of levels.filter((l) => l.parentLevelId !== null)) {
      const parent = byId.get(lvl.parentLevelId);
      expect(parent).toBeDefined();
      // A child sits exactly one level below its parent.
      expect(lvl.levelNumber).toBe((parent as { levelNumber: number }).levelNumber + 1);
    }
  });

  it('skips a join whose folder was not migrated', async () => {
    const db = eul5Db();
    db.tables.EUL5_KEY_CONS = [
      { KEY_ID: 400, KEY_OBJ_ID: 200, FK_OBJ_ID_REMOTE: 9999, KEY_DESCRIPTION: 'Dangling' },
    ];
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
    });

    expect(rowsOf(state, 'joins')).toHaveLength(0);
    expect(result.skipped.some((s) => s.table === 'joins')).toBe(true);
  });

  it('resolves folder-level grants to the folder’s business area and de-duplicates', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const grants = rowsOf(state, 'user_business_area_grants');
    const baId = first(rowsOf(state, 'business_areas')).id;
    // AP 800 (JSMITH/BA), 801 (MJONES on a folder → its BA) and 802
    // (SALES_ROLE/BA) all land on the same business area.
    expect(grants).toHaveLength(3);
    for (const g of grants) {
      expect(g.businessAreaId).toBe(baId);
      expect(g.permissionLevel).toBe('VIEW');
    }
  });

  it('hosts workbook maps in the auto-created business area and attributes the owner', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const hostBa = rowsOf(state, 'business_areas').find((b) => b.name === 'Migrated Workbooks');
    expect(hostBa).toBeDefined();
    const map = first(rowsOf(state, 'maps'));
    expect(map.businessAreaId).toBe(hostBa?.id);
    expect(map.mapType).toBe('TABLE');
    // DOC_EU_ID resolves to 'JSMITH', a migrated user, so the map is theirs.
    const jsmith = rowsOf(state, 'users').find((u) => u.email === 'jsmith@migrated.local');
    expect(map.createdBy).toBe(jsmith?.id);
  });

  // The whole point of decoding DOC_DOCUMENT: a map arrives with the columns,
  // conditions and parameters the worksheet actually showed, resolved against
  // the items this same run migrated.
  it('rebuilds a worksheet layout from the workbook body', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const columns = rowsOf(state, 'map_items')
      .filter((mi) => mi.mapId === map.id)
      .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number));

    expect(columns.map((c) => itemsById.get(c.itemId)?.name)).toEqual([
      'Invoice Amount',
      'Region',
    ]);
    expect(columns[0]).toMatchObject({ displayName: 'Amount', formatMask: '999,999.00' });

    const parameters = rowsOf(state, 'map_parameters').filter((p) => p.mapId === map.id);
    expect(parameters).toEqual([
      expect.objectContaining({
        name: 'Period',
        bindName: 'PERIOD',
        paramType: 'STRING',
        defaultValue: '2024-01',
      }),
    ]);

    const conditions = rowsOf(state, 'map_conditions').filter((c) => c.mapId === map.id);
    expect(conditions).toEqual([
      expect.objectContaining({
        operator: '>=',
        // The parameter's bind name — the prompt stays in map_parameters.name.
        paramName: 'PERIOD',
        conditionType: 'PARAMETER',
        itemId: columns[0]?.itemId,
      }),
    ]);
  });

  // The workbook records EXP_ID 300 for its first column and only names for
  // the second, so one run covers both resolution paths.
  it('resolves a worksheet column by EUL id, and by name when there is no id', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const byExpId = rowsOf(state, 'map_items').map((mi) => itemsById.get(mi.itemId)?.name);
    expect(byExpId).toEqual(['Invoice Amount', 'Region']);
  });

  it('drops a worksheet column whose item is no longer in the EUL, and says so', async () => {
    const db = eul5Db();
    // The workbook still references 'Region'; the EUL no longer defines it.
    db.tables.EUL5_EXPRESSIONS = db.tables.EUL5_EXPRESSIONS!.filter(
      (row) => row.EXP_NAME !== 'Region',
    );
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
    });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    expect(rowsOf(state, 'map_items').map((c) => itemsById.get(c.itemId)?.name)).toEqual([
      'Invoice Amount',
    ]);
    expect(
      result.skipped.some(
        (s) => s.table === 'map_items' && s.reason.includes('not a migrated item'),
      ),
    ).toBe(true);
  });

  // --- the worksheet layout (EUL_SCHEMA_GROUND_TRUTH.md §7.8/§7.9) ---------

  it('writes the axis, the position on it and the sheet-level Distinct', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    // The fixture worksheet is a plain table over two axis items.
    expect(map).toMatchObject({ mapType: 'TABLE', selectDistinct: false });

    const columns = rowsOf(state, 'map_items')
      .filter((mi) => mi.mapId === map.id)
      .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number));
    expect(columns.map((c) => [c.axisType, c.axisOrder, c.isHidden])).toEqual([
      ['AXIS', 0, false],
      ['AXIS', 1, false],
    ]);
  });

  it('writes a crosstab, its measures and the item its query names but never draws', async () => {
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
      worksheets: [
        {
          name: 'Sales',
          viewType: 'CROSSTAB',
          distinct: true,
          columns: [
            { item: 'Region', axisType: 0 },
            { item: 'Invoice Amount', axisType: 1 },
          ],
          // Needed by the query, drawn by no column.
          hiddenItems: ['Amount With Tax'],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    expect(map).toMatchObject({ mapType: 'CROSSTAB', selectDistinct: true });

    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const rows = rowsOf(state, 'map_items')
      .filter((mi) => mi.mapId === map.id)
      .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
      .map((mi) => ({
        name: itemsById.get(mi.itemId as string)?.name,
        axisType: mi.axisType,
        axisOrder: mi.axisOrder,
        isHidden: mi.isHidden,
      }));
    expect(rows).toEqual([
      { name: 'Region', axisType: 'AXIS', axisOrder: 0, isHidden: false },
      { name: 'Invoice Amount', axisType: 'MEASURE', axisOrder: 0, isHidden: false },
      // Second in the axis list, and not drawn.
      { name: 'Amount With Tax', axisType: 'AXIS', axisOrder: 1, isHidden: true },
    ]);
  });

  it('writes each sorted column its direction, precedence and break flag', async () => {
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
          // A group (break) sort on the axis column, an ordinary descending
          // sort on the measure — Discoverer's precedence is the list order.
          sorts: [
            { item: 'Region', direction: 1, grouped: true },
            { item: 'Invoice Amount', direction: 2 },
          ],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const rows = rowsOf(state, 'map_items')
      .filter((mi) => mi.mapId === map.id)
      .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number))
      .map((mi) => ({
        name: itemsById.get(mi.itemId as string)?.name,
        sortDirection: mi.sortDirection,
        sortOrder: mi.sortOrder,
        sortGroup: mi.sortGroup,
        // `Rank` is not recoverable from any source Oracle prints (§7.8.14).
        sortRank: mi.sortRank,
      }));
    expect(rows).toEqual([
      {
        name: 'Region',
        sortDirection: 'ASC',
        sortOrder: 0,
        sortGroup: true,
        sortRank: undefined,
      },
      {
        name: 'Invoice Amount',
        sortDirection: 'DESC',
        sortOrder: 1,
        sortGroup: false,
        sortRank: undefined,
      },
    ]);
  });

  it('writes each total against the map rows it aggregates and breaks on', async () => {
    // `mock-eul`'s Monthly Sales sheet carries a subtotal at each change in
    // Region over Invoice Amount, then a grand total over the same column —
    // the shape of the source's `… — TOTALIZADORES` sheets.
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const itemsById = new Map(rowsOf(state, 'items').map((i) => [i.id, i]));
    const mapItemsById = new Map(
      rowsOf(state, 'map_items')
        .filter((mi) => mi.mapId === map.id)
        .map((mi) => [mi.id as string, itemsById.get(mi.itemId as string)?.name]),
    );
    const totals = rowsOf(state, 'map_totals')
      .filter((t) => t.mapId === map.id)
      .sort((a, b) => (a.displayOrder as number) - (b.displayOrder as number));

    expect(
      totals.map((t) => ({
        kind: t.kind,
        label: t.label,
        aggFunction: t.aggFunction,
        placement: t.placement,
        measure: mapItemsById.get(t.mapItemId as string),
        breaksOn:
          t.breakMapItemId === null ? null : mapItemsById.get(t.breakMapItemId as string),
        calculatedField: t.mapCalculatedFieldId,
      })),
    ).toEqual([
      {
        kind: 'TOTAL',
        label: 'SubTotal por &Value',
        aggFunction: 'SUM',
        placement: 'AT_CHANGE',
        measure: 'Invoice Amount',
        breaksOn: 'Region',
        calculatedField: null,
      },
      {
        kind: 'TOTAL',
        label: 'Total Geral',
        aggFunction: 'SUM',
        placement: 'GRAND_TOTAL',
        measure: 'Invoice Amount',
        breaksOn: null,
        calculatedField: null,
      },
    ]);
    // `d4wkdmp` prints nothing about summaries, so the raw codes travel too.
    expect(first(totals).sourceAttrs).toMatchObject({ functionCode: 1, placementCode: 1 });
    expect(first(totals).sourceElementId).toEqual(expect.any(Number));
  });

  it('writes item format fields onto map_items, alignment always null', async () => {
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

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const row = first(rowsOf(state, 'map_items').filter((mi) => mi.mapId === map.id));
    expect(row).toMatchObject({
      columnWidth: 80,
      dataType: 'NUMBER',
      headingFormatMask: 'HEAD',
      wordWrap: true,
      alignment: null,
      sourceAttrs: { alignmentCode: 3 },
    });
    expect(row.sourceElementId).toEqual(expect.any(Number));
  });

  it('writes one page-setup row per map, with the raw arrays and every slot null', async () => {
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    const body = buildWorkbookFixture({
      name: 'Monthly Sales',
      eulOwner: 'EUL5_US',
      // §7.8.12: the tag order is unattributed, so the migration must not
      // guess which slot is the left header or the top margin.
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

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const setup = first(rowsOf(state, 'map_page_setup').filter((p) => p.mapId === map.id));
    expect(setup).toMatchObject({
      orientation: null,
      scalePercent: null,
      headerLeft: null,
      marginTop: null,
      printGridLines: null,
    });
    expect(setup.sourceAttrs).toMatchObject({
      texts: [null, null, null, null, null, '&Page / &Pages'],
      margins: [1, 1, 0.75, 0.75, 0.5, 0.5],
    });
  });

  it("resolves a worksheet's forced join to the migrated joins row", async () => {
    const db = eul5Db();
    const documents = db.tables.EUL5_DOCUMENTS!;
    // KEY_ID 400 (folders 200/201, "Invoices to Summary") is the one join the
    // EUL5 fixture defines — see `mock-eul.ts`.
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

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const migratedJoin = first(rowsOf(state, 'joins'));
    const layout = first(rowsOf(state, 'map_layouts').filter((l) => l.mapId === map.id));
    expect(layout.sourceAttrs).toMatchObject({
      joins: [
        expect.objectContaining({
          eulJoinSourceId: 400,
          identifier: 'JOIN_400',
          name: 'Invoices to Summary',
          joinIds: [migratedJoin.id],
        }),
      ],
    });
  });

  // The layout row used to be written only when the worksheet forced a join,
  // so the worksheet index, GUID and printed title were lost on every
  // worksheet that did not — which is most of them. `maps` holds the
  // worksheet's *name*; the heading Discoverer printed above the data lives
  // here and nowhere else.
  it('writes a layout row for a worksheet that forces no join', async () => {
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

    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const map = first(rowsOf(state, 'maps'));
    const layout = first(rowsOf(state, 'map_layouts').filter((l) => l.mapId === map.id));
    expect(layout).toMatchObject({
      worksheetIndex: 0,
      worksheetGuid: 'A1B2-C3D4',
      title: 'Vendas por Região',
      queryCount: 1,
    });
    // No joins, so no join bag — not an empty one.
    expect(layout.sourceAttrs).toBeNull();
  });

  it('records an unresolved join reference with no join id, and warns once', async () => {
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
      // No matching EUL join: 999 names nothing in KEY_CONS.
      joins: [{ name: 'Ghost Join', sourceId: 999 }],
      worksheets: [
        {
          name: 'Sales',
          columns: [{ item: 'Region', axisType: 0 }],
          joins: ['Ghost Join'],
        },
      ],
    });
    documents[0]!.DOC_DOCUMENT = body;
    documents[0]!.DOC_LENGTH = body.length;

    const events: MigrationEvent[] = [];
    const { writer, state } = createFakeWriter();
    await runMigration({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    const map = first(rowsOf(state, 'maps'));
    const layout = first(rowsOf(state, 'map_layouts').filter((l) => l.mapId === map.id));
    expect(layout.sourceAttrs).toMatchObject({
      joins: [expect.objectContaining({ eulJoinSourceId: 999, joinIds: null })],
    });
    expect(
      events.some(
        (e) => e.type === 'log' && e.level === 'WARN' && e.message.includes('join reference'),
      ),
    ).toBe(true);
  });
});

describe('runMigration — EUL4 source, end to end', () => {
  it('migrates an EUL4 source and maps OUTER joins to LEFT', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.version.version).toBe('EUL4');
    expect(rowsOf(state, 'users')).toHaveLength(2); // ACLARK + migration user
    expect(rowsOf(state, 'business_areas')).toHaveLength(2); // Finance + workbook host
    expect(rowsOf(state, 'folders')).toHaveLength(1);
    expect(rowsOf(state, 'items')).toHaveLength(2);
    expect(rowsOf(state, 'hierarchies')).toHaveLength(1);
    expect(rowsOf(state, 'hierarchy_levels')).toHaveLength(1);
    expect(rowsOf(state, 'custom_functions')).toHaveLength(1);
    expect(rowsOf(state, 'maps')).toHaveLength(1);
    expect(rowsOf(state, 'user_business_area_grants')).toHaveLength(1);
    expect(result.validation?.valid).toBe(true);

    // KEY_CONS carries no confirmed join-type column, so joins default to
    // INNER until one is identified against a live EUL.
    const joins = rowsOf(state, 'joins');
    expect(joins).toHaveLength(1);
    expect(first(joins).joinType).toBe('INNER');
  });

  it('maps the EUL4 folder type and keeps table/owner metadata', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul4Db()), writer, deps: deterministicDeps() });

    const folder = first(rowsOf(state, 'folders'));
    expect(folder).toMatchObject({
      name: 'GL Balances',
      // OBJ_TYPE 'SOBJ' normalizes to TABLE; SOBJ_EXT_TABLE/OBJ_EXT_OWNER
      // carry the physical table and its schema.
      folderType: 'TABLE',
      tableName: 'GL_BALANCES_V',
      tableOwner: 'GL',
    });
  });

  it('reports the EUL5-era columns EUL4 had to default', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      deps: deterministicDeps(),
    });
    // The EUL4 fixture has no DOC_WORKBOOK_OWNER, so the map falls back to
    // DOC_CREATED_BY — the migration still attributes an owner.
    expect(result.planned.maps).toBe(1);
    expect(result.version.version).toBe('EUL4');
  });
});

describe('dryRun', () => {
  it('computes planned counts without writing anything', async () => {
    const { writer, state } = createFakeWriter();
    const result = await dryRun({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    expect(result.dryRun).toBe(true);
    expect(result.runId).toBeNull();
    expect(result.planned.users).toBe(4);
    expect(result.planned.business_areas).toBe(3);
    expect(result.planned.items).toBe(3);

    // Nothing at all touched the target.
    for (const table of TARGET_TABLE_ORDER) {
      expect(rowsOf(state, table)).toHaveLength(0);
      expect(result.inserted[table]).toBe(0);
    }
    expect(state.ensureSchemaCalls).toBe(0);
    expect(state.transactionCalls).toBe(0);
    expect(state.logs).toHaveLength(0);
    expect(result.validation).toBeUndefined();
  });

  it('planned counts match what a real run then inserts', async () => {
    const planned = await dryRun({
      source: mockExecutor(eul5Db()),
      writer: createFakeWriter().writer,
      deps: deterministicDeps(),
    });
    const live = createFakeWriter();
    const actual = await runMigration({
      source: mockExecutor(eul5Db()),
      writer: live.writer,
      deps: deterministicDeps(),
    });
    expect(actual.inserted).toEqual(planned.planned);
  });
});

describe('version override', () => {
  it('detects EUL5 on a mixed EUL4+EUL5 schema by default', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(mixedDb()),
      writer,
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL5');
  });

  it('--version eul4 forces EUL4 on a mixed schema', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(mixedDb()),
      writer,
      version: 'EUL4',
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL4');
  });

  it('warns when the requested version does not match what was detected', async () => {
    const events: MigrationEvent[] = [];
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()), // pure EUL5, cannot become EUL4
      writer,
      version: 'EUL4',
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    expect(result.version.version).toBe('EUL5');
    expect(
      events.some((e) => e.level === 'WARN' && e.message.includes('Requested version EUL4')),
    ).toBe(true);
  });

  it("'auto' behaves the same as no override", async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      version: 'auto',
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL4');
  });
});

describe('post-migration validation', () => {
  it('reconciles counts against a non-empty target database', async () => {
    // The target already holds unrelated rows; reconciliation must account for
    // the baseline rather than assuming a fresh database.
    const { writer } = createFakeWriter({ baseline: { users: 5, business_areas: 2 } });
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.validation?.valid).toBe(true);
    const users = result.validation?.reconciliations.find((r) => r.table === 'users');
    expect(users).toMatchObject({ baseline: 5, inserted: 4, expected: 9, actual: 9, ok: true });
  });

  it('fails reconciliation when the target does not hold what was inserted', async () => {
    // Force `count` to under-report items, as a lost/rolled-back write would.
    const { writer } = createFakeWriter({ countOverride: { items: 0 } });
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.issues.join(' ')).toContain('items');
  });
});

describe('failure handling', () => {
  it('rolls back the data transaction but keeps the migration log', async () => {
    const { writer, state } = createFakeWriter({ failOnInsert: 'items' });

    await expect(
      runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() }),
    ).rejects.toThrow(/fake insert failure on items/);

    // Everything inserted before the failure is rolled back…
    expect(rowsOf(state, 'users')).toHaveLength(0);
    expect(rowsOf(state, 'business_areas')).toHaveLength(0);
    expect(rowsOf(state, 'folders')).toHaveLength(0);
    // …but the log survives, which is the whole point of logging outside the tx.
    expect(state.logs.length).toBeGreaterThan(0);
    expect(state.logs.some((l) => l.phase === 'read')).toBe(true);
  });

  it('strips bound parameters out of a failure before it reaches the log', () => {
    // Drizzle's message carries every bound value; migrated emails/hashes must
    // not be copied into the durable migration_log.
    const drizzleStyle = new Error(
      'Failed query: insert into "users" ("id", "email") values ($1, $2)\n' +
        'params: 0000,secret.person@migrated.local,!migrated-no-login',
    );
    const described = describeWriteFailure(drizzleStyle);
    expect(described).toContain('Failed query: insert into "users"');
    expect(described).not.toContain('secret.person@migrated.local');
    expect(described).not.toContain('!migrated-no-login');
    expect(described).toContain('rolled back');
  });

  it('finds the Postgres diagnostic through Drizzle’s cause chain', () => {
    // Real shape: Drizzle Error wrapping the pg error, which carries the code.
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'users_email_unique',
      detail: 'Key (email)=(migration@migrated.local) already exists.',
    });
    const wrapped = Object.assign(new Error('Failed query: insert into "users" ...'), {
      cause: pgError,
    });

    const described = describeWriteFailure(wrapped);
    expect(described).toContain('already contains a migration');
    expect(described).toContain('users_email_unique');
    expect(described).toContain('Key (email)=(migration@migrated.local) already exists.');
  });

  it('explains a unique-violation as an already-migrated target and logs it', async () => {
    const { writer, state } = createFakeWriter();
    // Emulate Postgres rejecting the duplicate migration service user.
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint "users_email_unique"'),
      { code: '23505', constraint: 'users_email_unique' },
    );
    const failing = {
      ...writer,
      transaction: <T,>(fn: (w: typeof writer) => Promise<T>) => {
        void fn;
        return Promise.reject(uniqueViolation);
      },
    };

    await expect(
      runMigration({ source: mockExecutor(eul5Db()), writer: failing, deps: deterministicDeps() }),
    ).rejects.toThrow(/already contains a migration/);

    // The rollback is recorded in the durable log, not just thrown away.
    expect(
      state.logs.some((l) => l.level === 'ERROR' && l.message.includes('rolled back')),
    ).toBe(true);
  });

  it('skips objects whose required parent could not be migrated', async () => {
    // A folder pointing at a business area that does not exist cannot satisfy
    // Neo's NOT NULL business_area_id, so it (and its items) are skipped.
    const db = eul5Db();
    db.tables.EUL5_OBJS = [
      { ...first(db.tables.EUL5_OBJS ?? []), OBJ_ID: 299, BA_ID: 9999, OBJ_NAME: 'Orphan Folder' },
    ];
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
    });

    expect(rowsOf(state, 'folders')).toHaveLength(0);
    expect(result.skipped.some((s) => s.table === 'folders' && s.sourceId === 299)).toBe(true);
    // Items belonging to the skipped folder are skipped too, not orphaned.
    expect(rowsOf(state, 'items')).toHaveLength(0);
    expect(result.skipped.some((s) => s.table === 'items')).toBe(true);
  });
});

describe('target preflight — a database holds one migration', () => {
  const MIGRATION_ACCOUNT = 'migration@migrated.local';

  it('refuses a real run against an already-migrated target before reading the EUL', async () => {
    const { writer, state } = createFakeWriter({ existingUserEmails: [MIGRATION_ACCOUNT] });

    await expect(
      runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() }),
    ).rejects.toThrow(/already contains a migration/);

    // Nothing written, and no transaction was even opened.
    expect(rowsOf(state, 'users')).toHaveLength(0);
    expect(state.transactionCalls).toBe(0);
    // The source is never touched: the check runs before the EUL read, so a
    // doomed run costs one query instead of a full read + password hashing.
    expect(state.logs.some((l) => l.phase === 'read')).toBe(false);
    // …but the refusal itself is in the durable log.
    const blocked = state.logs.find((l) => l.phase === 'preflight');
    expect(blocked?.level).toBe('ERROR');
    expect(blocked?.message).toContain(MIGRATION_ACCOUNT);
  });

  it('lets a dry run finish but reports the target as blocked', async () => {
    const { writer, state } = createFakeWriter({ existingUserEmails: [MIGRATION_ACCOUNT] });
    const events: MigrationEvent[] = [];

    const result = await dryRun({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    // A dry run that says nothing here would be telling an operator the real
    // run will work when it cannot.
    expect(result.preflight.alreadyMigrated).toBe(true);
    expect(result.preflight.message).toContain(MIGRATION_ACCOUNT);
    expect(events.some((e) => e.level === 'ERROR' && e.phase === 'preflight')).toBe(true);
    // The plan is still computed — the operator gets both facts.
    expect(result.planned.users).toBeGreaterThan(0);
    expect(rowsOf(state, 'users')).toHaveLength(0);
  });

  it('reports a clean target as not blocked', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.preflight).toEqual({ alreadyMigrated: false, message: null });
  });

  it('disambiguates a synthesized email that an existing account already owns', async () => {
    // Not a previous migration — just an unrelated account that happens to hold
    // the address JSMITH would synthesize. Colliding here would abort the whole
    // run on the very first INSERT.
    const { writer, state } = createFakeWriter({ existingUserEmails: ['jsmith@migrated.local'] });

    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.preflight.alreadyMigrated).toBe(false);
    const emails = rowsOf(state, 'users').map((u) => u.email);
    expect(emails).not.toContain('jsmith@migrated.local');
    expect(emails.some((e) => typeof e === 'string' && /^jsmith\.\d+@migrated\.local$/.test(e))).toBe(
      true,
    );
  });
});

describe('progress reporting', () => {
  it('emits the detected version and a progress event per populated table', async () => {
    const events: MigrationEvent[] = [];
    const { writer } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    expect(events.some((e) => e.type === 'log' && e.message.includes('Source is EUL5'))).toBe(true);

    const progressed = events.filter((e) => e.type === 'progress').map((e) => e.phase);
    expect(progressed).toEqual(
      expect.arrayContaining(['users', 'business_areas', 'folders', 'items', 'joins', 'maps']),
    );
    for (const e of events.filter((ev) => ev.type === 'progress')) {
      expect(e.current).toBe(e.total);
    }
  });
});
