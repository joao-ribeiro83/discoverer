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
import type {
  Folder,
  Item,
  Join,
  JoinPredicate,
  Map,
  MapItem,
} from '../db/schema.js';
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
  const join: Join = {
    id: uid(),
    name: `${master.name} -> ${detail.name}`,
    leftFolderId: master.id,
    rightFolderId: detail.id,
    oneToOne: false,
    allowMasterNoDetail: false,
    allowDetailNoMaster: false,
    mandatory: true,
    predicateFormula: null,
    isActive: true,
    createdAt: NOW,
    ...overrides,
  };
  return {
    join,
    predicates: [
      {
        predicate: mkPredicate(join, 0, masterItem, detailItem),
        leftItem: masterItem,
        rightItem: detailItem,
      },
    ],
    leftFolder: master,
    rightFolder: detail,
  };
}

/** One column pair of a join's predicate. Nulls model an item that did not migrate. */
function mkPredicate(
  join: Join,
  seq: number,
  masterItem: Item | null,
  detailItem: Item | null,
  operator = '=',
): JoinPredicate {
  return {
    id: uid(),
    joinId: join.id,
    seq,
    leftItemId: masterItem?.id ?? null,
    rightItemId: detailItem?.id ?? null,
    operator,
    createdAt: NOW,
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
      allowMasterNoDetail: true,
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

// ---------------------------------------------------------------------------
// 5. The join predicate — Phase 3.2
// ---------------------------------------------------------------------------

/** A two-folder query over SALES and LINES, with `joins` supplied by caller. */
function twoFolderQuery(
  f: ReturnType<typeof twoFolderFixture>,
  joins: MapDefinition['joins'],
): MapDefinition {
  return mkDef({
    items: [
      { mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales },
      { mapItem: mkMapItem(f.qty, 1), item: f.qty, folder: f.lines },
    ],
    joins,
    formulaItems: f.formulaItems,
  });
}

describe('buildFromClause — join predicates', () => {
  it('ANDs a multi-column predicate in seq order', () => {
    const f = twoFolderFixture();
    const salesRegion = mkItem(f.sales, 'Sales Region', { columnName: 'REGION' });
    const lineRegion = mkItem(f.lines, 'Line Region', { columnName: 'REGION' });
    const j = f.join;
    // Deliberately out of order, to prove `seq` is what orders the clause and
    // not the array. A predicate's components must always emit in the order
    // the source stated.
    j.predicates = [
      {
        predicate: mkPredicate(j.join, 1, salesRegion, lineRegion),
        leftItem: salesRegion,
        rightItem: lineRegion,
      },
      {
        predicate: mkPredicate(j.join, 0, f.orderId, f.lineOrderId),
        leftItem: f.orderId,
        rightItem: f.lineOrderId,
      },
    ];

    const { sql } = fromClauseFor(twoFolderQuery(f, [j]));
    expect(sql).toMatch(
      /ON \w+\."ORDER_ID" = \w+\."ORDER_ID" AND \w+\."REGION" = \w+\."REGION"/,
    );
  });

  it('emits each component with its own operator, from the closed set', () => {
    const f = twoFolderFixture();
    const j = f.join;
    j.predicates = [
      {
        predicate: mkPredicate(j.join, 0, f.orderId, f.lineOrderId, '>='),
        leftItem: f.orderId,
        rightItem: f.lineOrderId,
      },
    ];
    expect(fromClauseFor(twoFolderQuery(f, [j])).sql).toMatch(
      /ON \w+\."ORDER_ID" >= \w+\."ORDER_ID"/,
    );
  });

  it('refuses a join whose predicate carries an operator outside the closed set', () => {
    // The operator becomes SQL syntax, not a quoted identifier or a bind, so
    // it is looked up in a table rather than interpolated. The database has
    // the same six as a CHECK; this is the second gate, not the only one.
    const f = twoFolderFixture();
    const j = f.join;
    j.predicates = [
      {
        predicate: mkPredicate(j.join, 0, f.orderId, f.lineOrderId, "= 1 OR '1'"),
        leftItem: f.orderId,
        rightItem: f.lineOrderId,
      },
    ];
    expect(() => fromClauseFor(twoFolderQuery(f, [j]))).toThrow(
      /unsupported comparison/,
    );
  });

  it('rejects a predicate column name carrying a quote, rather than escaping it', () => {
    const f = twoFolderFixture();
    const evil = mkItem(f.lines, 'Evil', { columnName: 'ID" FROM DUAL --' });
    const j = f.join;
    j.predicates = [
      {
        predicate: mkPredicate(j.join, 0, f.orderId, evil),
        leftItem: f.orderId,
        rightItem: evil,
      },
    ];
    expect(() => fromClauseFor(twoFolderQuery(f, [j]))).toThrow(
      /Invalid SQL identifier/,
    );
  });

  it('refuses a join with NO predicate, naming the join (D-039)', () => {
    const f = twoFolderFixture();
    const j = f.join;
    j.predicates = [];
    try {
      fromClauseFor(twoFolderQuery(f, [j]));
      throw new Error('expected a refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(SqlGenerationError);
      const e = err as SqlGenerationError;
      expect(e.code).toBe('JOIN_NO_PREDICATE');
      // The join, not a folder. This is the whole point: the old behaviour
      // dropped the join and blamed a folder for being unreachable.
      expect(e.message).toContain('SALES -> LINES');
      expect(e.details).toEqual({ joins: ['SALES -> LINES'] });
    }
  });

  it('refuses a predicate whose item did not migrate, rather than shortening the clause', () => {
    // Emitting only the component that resolved would turn `a = b AND c = d`
    // into `a = b` — a WIDER join, returning more rows than the source did.
    const f = twoFolderFixture();
    const j = f.join;
    j.predicates = [
      {
        predicate: mkPredicate(j.join, 0, f.orderId, f.lineOrderId),
        leftItem: f.orderId,
        rightItem: f.lineOrderId,
      },
      {
        predicate: mkPredicate(j.join, 1, null, null),
        leftItem: null,
        rightItem: null,
      },
    ];
    try {
      fromClauseFor(twoFolderQuery(f, [j]));
      throw new Error('expected a refusal');
    } catch (err) {
      const e = err as SqlGenerationError;
      expect(e.code).toBe('JOIN_NO_PREDICATE');
      expect(e.message).toContain('did not migrate');
    }
  });

  it('a predicate-less join elsewhere in the business area does not affect a query that avoids it', () => {
    // The refusal must fire where the join is USED, not where it is loaded.
    // Refusing at load time would take down every single-folder map in a
    // business area that happens to contain one broken join.
    const f = twoFolderFixture();
    const island = mkFolder('ISLAND');
    const islandKey = mkItem(island, 'Island Key');
    const broken = mkJoin(f.lines, f.lineOrderId, island, islandKey);
    broken.predicates = [];

    const def = mkDef({
      items: [{ mapItem: mkMapItem(f.orderId), item: f.orderId, folder: f.sales }],
      joins: [f.join, broken],
      formulaItems: f.formulaItems,
    });
    expect(fromClauseFor(def).sql).toContain('FROM "APP"."SALES"');
  });
});

// ---------------------------------------------------------------------------
// 6. The derived join type reaching the emitted SQL
// ---------------------------------------------------------------------------

describe('buildFromClause — derived join type', () => {
  it.each<[Partial<Join>, string]>([
    [{ allowMasterNoDetail: false, allowDetailNoMaster: false }, 'INNER JOIN'],
    [{ allowMasterNoDetail: true, allowDetailNoMaster: false }, 'LEFT OUTER JOIN'],
    [{ allowMasterNoDetail: false, allowDetailNoMaster: true }, 'RIGHT OUTER JOIN'],
  ])('%j emits %s', (flags, expected) => {
    const f = twoFolderFixture();
    const j = mkJoin(f.sales, f.orderId, f.lines, f.lineOrderId, flags);
    expect(fromClauseFor(twoFolderQuery(f, [j])).sql).toContain(expected);
  });

  it('refuses both-outer before building any FROM clause at all (D-038)', () => {
    const f = twoFolderFixture();
    const j = mkJoin(f.sales, f.orderId, f.lines, f.lineOrderId, {
      allowMasterNoDetail: true,
      allowDetailNoMaster: true,
    });
    try {
      fromClauseFor(twoFolderQuery(f, [j]));
      throw new Error('expected a refusal');
    } catch (err) {
      const e = err as SqlGenerationError;
      expect(e.code).toBe('JOIN_BOTH_OUTER');
      expect(e.details).toEqual({ joins: ['SALES -> LINES'] });
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Orientation regression — the estate's own folders (D-040)
// ---------------------------------------------------------------------------

/**
 * Which side of a join is the master, carried by the live estate's own names.
 *
 * Measured, not inferred (Phase 0.3 Q1; raw output in
 * `docs/master-plan/research/eul-probe-results.md`). `KEY_ID` 108451
 * `M M111 -> M M111 1` is the ONLY join in that estate whose key is exactly
 * unique on one side — `M_M111`, 1 830 rows over 1 830 distinct
 * `(UE, PRODUTO, N_APOLICE)` tuples, which is what a master *is* — and that
 * side sits on `FK_OBJ_ID_REMOTE`. Its partner `M_M111_1` has 216 rows over
 * 94 keys. Three further joins (104698, 104706, 109828) put the heavier
 * duplication on `KEY_OBJ_ID`, the last by 38x.
 *
 * So: `FK_OBJ_ID_REMOTE` -> master -> `joins.left_folder_id`;
 * `KEY_OBJ_ID` -> detail -> `joins.right_folder_id`. `KEY_NAME` reads
 * `master -> detail`, with `KEY_OBJ_ID` on the right of the arrow on all ten
 * rows without exception.
 *
 * This test exists because an inversion does not error. It pushes the wrong
 * side into the fan-trap rewrite and returns correct-looking wrong numbers.
 */
describe('join orientation — M M111 -> M M111 1 (D-040)', () => {
  const masterFolder = mkFolder('M M111', { tableName: 'M_M111' });
  const detailFolder = mkFolder('M M111 1', { tableName: 'M_M111_1' });
  const masterKey = mkItem(masterFolder, 'N Apolice M', { columnName: 'N_APOLICE' });
  const detailKey = mkItem(detailFolder, 'N Apolice D', { columnName: 'N_APOLICE' });

  function estateDef(joins: MapDefinition['joins']): MapDefinition {
    return mkDef({
      items: [
        {
          mapItem: mkMapItem(masterKey),
          item: masterKey,
          folder: masterFolder,
        },
        {
          mapItem: mkMapItem(detailKey, 1),
          item: detailKey,
          folder: detailFolder,
        },
      ],
      joins,
      formulaItems: [
        { item: masterKey, folder: masterFolder },
        { item: detailKey, folder: detailFolder },
      ],
    });
  }

  it('puts the master on left_folder_id and the detail on right_folder_id', () => {
    const j = mkJoin(masterFolder, masterKey, detailFolder, detailKey);
    expect(j.join.leftFolderId).toBe(masterFolder.id);
    expect(j.join.rightFolderId).toBe(detailFolder.id);
  });

  it('a master-side outer join keeps the master rows — LEFT, detail side optional', () => {
    // "Outer join on detail" returns all master rows that have no
    // corresponding detail items. Rooted at the master, that is a LEFT join
    // TO the detail. If the sides were inverted this would silently become a
    // RIGHT join and drop the very rows the flag exists to keep.
    const j = mkJoin(masterFolder, masterKey, detailFolder, detailKey, {
      allowMasterNoDetail: true,
    });
    const sql = fromClauseFor(estateDef([j])).sql;
    expect(sql).toContain('FROM "APP"."M_M111"');
    expect(sql).toContain('LEFT OUTER JOIN "APP"."M_M111_1"');
  });

  it('flips to RIGHT when the same join is traversed from the detail side', () => {
    // Same join, but the query names the detail's column first, so the BFS
    // roots there. The emitted type must flip, or the outer side changes.
    const j = mkJoin(masterFolder, masterKey, detailFolder, detailKey, {
      allowMasterNoDetail: true,
    });
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(detailKey), item: detailKey, folder: detailFolder },
        { mapItem: mkMapItem(masterKey, 1), item: masterKey, folder: masterFolder },
      ],
      joins: [j],
      formulaItems: [
        { item: masterKey, folder: masterFolder },
        { item: detailKey, folder: detailFolder },
      ],
    });
    const sql = fromClauseFor(def).sql;
    expect(sql).toContain('FROM "APP"."M_M111_1"');
    expect(sql).toContain('RIGHT OUTER JOIN "APP"."M_M111"');
  });
});
