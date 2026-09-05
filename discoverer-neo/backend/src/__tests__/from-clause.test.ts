/**
 * Characterisation tests for the FROM-clause layer.
 *
 * **Why this file exists (R-15 / D-02).** `backend/src/lib/sql/` had no
 * dedicated tests at all: `from-clause.ts`, `folder-set.ts`, `where-clause.ts`,
 * `select-clause.ts`, `context.ts` and `totals.ts` were exercised only
 * indirectly, through `sql-generator.test.ts`'s single hand-built `mkDef()`
 * fixture. Phase 3.3 is about to replace exactly those modules, so their
 * present behaviour is pinned here first — the rewrite can then be proven not
 * to have changed anything it did not intend to.
 *
 * These tests describe what the code DOES, not what it SHOULD do. Where Phase
 * 3.2 deliberately changes a behaviour, the test is updated in the same commit
 * that changes it, with the reason named.
 */

import { describe, it, expect } from '@jest/globals';
import type { Folder, Item, Join, Map, MapItem } from '../db/schema.js';
import type { MapDefinition } from '../types/sql.js';
import { SqlGenerationError } from '../types/sql.js';
import { GenerationContext } from '../lib/sql/context.js';
import { buildFromClause, type FromClauseOptions } from '../lib/sql/from-clause.js';
import { buildSelectClause } from '../lib/sql/select-clause.js';
import { effectiveFolderSet, spanningJoinPath } from '../lib/sql/folder-set.js';

// ---------------------------------------------------------------------------
// Fixtures — deliberately local. The generator's own suite keeps its own set;
// these are the smallest shapes the FROM clause needs, and coupling the two
// files would make a change to one break the other for no reason.
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-01T00:00:00Z');
const BA_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

let idCounter = 0;
const uid = () =>
  `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;

function mkFolder(name: string, overrides: Partial<Folder> = {}): Folder {
  return {
    id: uid(),
    businessAreaId: BA_ID,
    name,
    description: null,
    folderType: 'TABLE',
    tableName: name,
    tableOwner: 'APP',
    customSql: null,
    dataSourceId: null,
    displayOrder: 0,
    isActive: true,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkItem(folder: Folder, name: string, overrides: Partial<Item> = {}): Item {
  return {
    id: uid(),
    folderId: folder.id,
    name,
    description: null,
    itemType: 'CI',
    columnName: name.toUpperCase().replace(/\s+/g, '_'),
    formula: null,
    dataType: 'VARCHAR2',
    formatMask: null,
    aggFunction: null,
    displayOrder: 0,
    isHidden: false,
    isActive: true,
    parentItemId: null,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkMap(): Map {
  return {
    id: uid(),
    name: 'Characterisation Map',
    description: null,
    mapType: 'TABLE',
    businessAreaId: BA_ID,
    createdBy: USER_ID,
    isPublic: false,
    isActive: true,
    selectDistinct: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function mkMapItem(item: Item, displayOrder = 0): MapItem {
  return {
    id: uid(),
    mapId: 'unused',
    itemId: item.id,
    displayOrder,
    displayName: null,
    formatMask: null,
    aggFunction: null,
    sortDirection: null,
    sortOrder: null,
    columnWidth: null,
    axisType: null,
    axisEdge: null,
    axisOrder: null,
    isHidden: false,
    dataType: null,
    headingFormatMask: null,
    alignment: null,
    wordWrap: null,
    sortRank: null,
    sortGroup: false,
    sourceElementId: null,
    sourceAttrs: null,
    createdAt: NOW,
  };
}

/**
 * A folder-to-folder join with one equality predicate.
 *
 * `left` is the MASTER side and `right` the DETAIL side, matching the
 * migrator's own convention (`transform.ts`: `leftFolderSourceId` is fed from
 * `masterFolderId`, which reads `KEY_CONS.FK_OBJ_ID_REMOTE` — D-040).
 */
function mkJoin(
  master: Folder,
  masterItem: Item,
  detail: Folder,
  detailItem: Item,
  overrides: Partial<Join> = {},
): MapDefinition['joins'][number] {
  return {
    join: {
      id: uid(),
      name: `${master.name} -> ${detail.name}`,
      leftFolderId: master.id,
      rightFolderId: detail.id,
      leftItemId: masterItem.id,
      rightItemId: detailItem.id,
      joinType: 'INNER',
      isActive: true,
      createdAt: NOW,
      ...overrides,
    },
    leftItem: masterItem,
    rightItem: detailItem,
    leftFolder: master,
    rightFolder: detail,
  };
}

function mkDef(partial: Partial<MapDefinition>): MapDefinition {
  return {
    map: mkMap(),
    items: [],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    joins: [],
    formulaItems: [],
    ...partial,
  };
}

const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

/**
 * Build the FROM clause the way `generateSql` does — SELECT first.
 *
 * A folder only becomes "used" when something asks for its alias, and it is
 * the SELECT clause that does the asking. Calling `buildFromClause` on a fresh
 * context alone would always see an empty folder set.
 */
function fromClauseFor(
  def: MapDefinition,
  options: FromClauseOptions = {},
): { sql: string; ctx: GenerationContext } {
  const ctx = new GenerationContext(def);
  buildSelectClause(def, ctx);
  return { sql: norm(buildFromClause(def, ctx, options)), ctx };
}

/**
 * Two folders, one join: `SALES` (master) -> `LINES` (detail).
 * The shape Discoverer's own fan-trap example uses.
 */
function twoFolderFixture() {
  const sales = mkFolder('SALES');
  const lines = mkFolder('LINES');
  const orderId = mkItem(sales, 'Order Id', { columnName: 'ORDER_ID' });
  const total = mkItem(sales, 'Total', { columnName: 'TOTAL', dataType: 'NUMBER' });
  const lineOrderId = mkItem(lines, 'Line Order Id', { columnName: 'ORDER_ID' });
  const qty = mkItem(lines, 'Qty', { columnName: 'QTY', dataType: 'NUMBER' });
  const folderOf = (i: Item) => (i.folderId === sales.id ? sales : lines);
  const allItems = [orderId, total, lineOrderId, qty];
  return {
    sales,
    lines,
    orderId,
    total,
    lineOrderId,
    qty,
    join: mkJoin(sales, orderId, lines, lineOrderId),
    formulaItems: allItems.map((item) => ({ item, folder: folderOf(item) })),
  };
}

// ---------------------------------------------------------------------------
// 1. The single-folder short-circuit (from-clause.ts)
// ---------------------------------------------------------------------------

describe('buildFromClause — single-folder short-circuit', () => {
  it('emits one table reference and consults no join metadata', () => {
    const f = twoFolderFixture();
    const def = mkDef({
      items: [{ mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales }],
      // Joins are present but must not be walked: only one folder is required.
      joins: [f.join],
      formulaItems: f.formulaItems,
    });
    const { sql, ctx } = fromClauseFor(def);
    expect(sql).toBe(`FROM "APP"."SALES" ${ctx.aliasFor(f.sales.id)}`);
  });

  it('short-circuits even for an aggregate query — the refusal needs 2+ folders', () => {
    const f = twoFolderFixture();
    const def = mkDef({
      items: [{ mapItem: mkMapItem(f.total), item: f.total, folder: f.sales }],
      joins: [f.join],
      formulaItems: f.formulaItems,
    });
    expect(fromClauseFor(def, { hasAggregates: true }).sql).toContain(
      'FROM "APP"."SALES"',
    );
  });

  it('refuses when the query references no folder at all', () => {
    const def = mkDef({});
    expect(() => buildFromClause(def, new GenerationContext(def))).toThrow(
      /references no folders/,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. The BFS spanning tree over def.joins (folder-set.ts)
// ---------------------------------------------------------------------------

describe('spanningJoinPath — BFS spanning tree', () => {
  it('returns no edges for a single required folder', () => {
    const f = twoFolderFixture();
    const { edges, unreachable } = spanningJoinPath([f.sales.id], [f.join]);
    expect(edges).toEqual([]);
    expect(unreachable).toEqual([]);
  });

  it('connects two folders through one join, rooted at the first required folder', () => {
    const f = twoFolderFixture();
    const { rootId, edges } = spanningJoinPath(
      [f.sales.id, f.lines.id],
      [f.join],
    );
    expect(rootId).toBe(f.sales.id);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      joinIdx: 0,
      from: f.sales.id,
      to: f.lines.id,
    });
  });

  it('drags in a bridge folder that no selected item names', () => {
    // A -> B -> C, with only A and C required. B is a pure bridge.
    const a = mkFolder('A');
    const b = mkFolder('B');
    const c = mkFolder('C');
    const ak = mkItem(a, 'AK');
    const bk1 = mkItem(b, 'BK1');
    const bk2 = mkItem(b, 'BK2');
    const ck = mkItem(c, 'CK');
    const joins = [mkJoin(a, ak, b, bk1), mkJoin(b, bk2, c, ck)];

    const { edges, unreachable } = spanningJoinPath([a.id, c.id], joins);
    expect(unreachable).toEqual([]);
    expect(edges.map((e) => e.to)).toEqual([b.id, c.id]);
  });

  it('flips a LEFT join traversed from its right side, and reports the flip', () => {
    const f = twoFolderFixture();
    const left = mkJoin(f.sales, f.orderId, f.lines, f.lineOrderId, {
      joinType: 'LEFT',
    });
    // Root at the DETAIL folder, so the edge is walked right-to-left.
    const { edges } = spanningJoinPath([f.lines.id, f.sales.id], [left]);
    expect(edges[0]!.joinType).toBe('RIGHT');
  });

  it('reports unreachable folders and emits no edges at all', () => {
    const f = twoFolderFixture();
    const island = mkFolder('ISLAND');
    const { edges, unreachable } = spanningJoinPath(
      [f.sales.id, island.id],
      [f.join],
    );
    expect(edges).toEqual([]);
    expect(unreachable).toEqual([island.id]);
  });
});

// ---------------------------------------------------------------------------
// 3. The disconnection refusal (from-clause.ts)
// ---------------------------------------------------------------------------

describe('buildFromClause — disconnection refusal', () => {
  /**
   * The fourth behaviour this file pins — the null-item-endpoint join drop —
   * lives in `sql-generator.ts`'s `loadMapDefinition`, which reads the
   * database and so has no unit-testable seam. Its *consequence* is pinned
   * here instead: a dropped join leaves its folders unlinked, and the query
   * fails with `NO_JOIN_PATH` naming a folder rather than the join that went
   * missing. That unattributable failure is precisely what D-039 replaces.
   */
  it('refuses with NO_JOIN_PATH and names the unreachable folder', () => {
    const f = twoFolderFixture();
    const island = mkFolder('ISLAND');
    const islandItem = mkItem(island, 'Island Key');
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales },
        { mapItem: mkMapItem(islandItem, 1), item: islandItem, folder: island },
      ],
      joins: [f.join],
      formulaItems: [
        ...f.formulaItems,
        { item: islandItem, folder: island },
      ],
    });
    try {
      fromClauseFor(def);
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(SqlGenerationError);
      const e = err as SqlGenerationError;
      expect(e.code).toBe('NO_JOIN_PATH');
      expect(e.message).toContain('ISLAND');
      expect(e.details).toEqual({ folders: ['ISLAND'] });
    }
  });

  it('effectiveFolderSet returns no bridges for a disconnected set rather than throwing', () => {
    const f = twoFolderFixture();
    const island = mkFolder('ISLAND');
    const islandItem = mkItem(island, 'Island Key');
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales },
        { mapItem: mkMapItem(islandItem, 1), item: islandItem, folder: island },
      ],
      joins: [f.join],
      formulaItems: [...f.formulaItems, { item: islandItem, folder: island }],
    });
    const set = effectiveFolderSet(def);
    expect(set.columnBearingFolderIds).toEqual([f.sales.id, island.id]);
    expect(set.joinPathFolderIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. The interim multi-folder aggregate refusal (D-014, deleted in Phase 3.4)
// ---------------------------------------------------------------------------

describe('buildFromClause — interim multi-folder aggregate refusal', () => {
  it('refuses a multi-folder aggregate and names every folder', () => {
    const f = twoFolderFixture();
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales },
        { mapItem: mkMapItem(f.qty, 1), item: f.qty, folder: f.lines },
      ],
      joins: [f.join],
      formulaItems: f.formulaItems,
    });
    try {
      fromClauseFor(def, { hasAggregates: true });
      throw new Error('expected a refusal');
    } catch (err) {
      const e = err as SqlGenerationError;
      expect(e.code).toBe('MULTI_FOLDER_AGGREGATE');
      expect(e.details).toEqual({ folders: ['SALES', 'LINES'] });
    }
  });

  it('a non-aggregate multi-folder query still generates a flat join', () => {
    const f = twoFolderFixture();
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales },
        { mapItem: mkMapItem(f.qty, 1), item: f.qty, folder: f.lines },
      ],
      joins: [f.join],
      formulaItems: f.formulaItems,
    });
    const { sql } = fromClauseFor(def);
    expect(sql).toContain('FROM "APP"."SALES"');
    expect(sql).toContain('INNER JOIN "APP"."LINES"');
    expect(sql).toMatch(/ON \w+\."ORDER_ID" = \w+\."ORDER_ID"/);
  });
});
