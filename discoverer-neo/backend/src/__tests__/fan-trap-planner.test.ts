/**
 * The fan-trap guard — `legacy-analysis.md` §1.11, steps 0 to 10.
 *
 * **The centrepiece is `Oracle's worked example`.** It builds Oracle's own
 * ACCOUNT / SALES / BUDGET fixture in the test database with Oracle's own
 * numbers, runs the unguarded flat statement to reproduce the documented
 * inflation (400 reported as 800, 400 reported as 1200), then runs the planned
 * rewrite and asserts the right answers come back. Asserting the SQL text alone
 * would prove the emitter writes what this file expects; running it proves the
 * arithmetic.
 *
 * Everything else here is a refusal or a classification, and those are asserted
 * on the plan, because a refusal has no SQL by definition.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { sql } from 'drizzle-orm';

import type {
  Folder,
  Item,
  Join,
  JoinPredicate,
  Map,
  MapCondition,
  MapItem,
  MapParameter,
  MapTotal,
} from '../db/schema.js';
import { db } from '../db/index.js';
import type { MapDefinition } from '../types/sql.js';
import { SqlGenerationError } from '../types/sql.js';
import { GenerationContext } from '../lib/sql/context.js';
import { buildSelectClause } from '../lib/sql/select-clause.js';
import { buildFromClause } from '../lib/sql/from-clause.js';
import { buildGroupByClause } from '../lib/sql/group-by-clause.js';
import { planTotals } from '../lib/sql/totals.js';
import { planQuery } from '../lib/sql/planner.js';
import { renderRewrite } from '../lib/sql/rewrite.js';
import type { RewritePlan } from '../lib/sql/query-plan.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-01T00:00:00Z');
const BA_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

let idCounter = 0;
const uid = () => `00000000-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;

function mkFolder(name: string, overrides: Partial<Folder> = {}): Folder {
  return {
    id: uid(),
    businessAreaId: BA_ID,
    name,
    description: null,
    folderType: 'TABLE',
    tableName: name,
    tableOwner: 'FANTRAP',
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

/** A measure: an item carrying the EUL's default aggregation (Phase 3.1). */
function mkMeasure(folder: Folder, name: string, aggFunction = 'SUM'): Item {
  return mkItem(folder, name, { dataType: 'NUMBER', aggFunction });
}

function mkMap(): Map {
  return {
    id: uid(),
    name: 'Fan trap fixture',
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

function mkMapItem(item: Item, displayOrder = 0, overrides: Partial<MapItem> = {}): MapItem {
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
    ...overrides,
  };
}

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
    // The DTD default, and this estate's actual state: unknown means FANNING.
    oneToOne: false,
    allowMasterNoDetail: false,
    allowDetailNoMaster: false,
    mandatory: true,
    predicateFormula: null,
    isActive: true,
    createdAt: NOW,
    ...overrides,
  };
  const predicate: JoinPredicate = {
    id: uid(),
    joinId: join.id,
    seq: 0,
    leftItemId: masterItem.id,
    rightItemId: detailItem.id,
    operator: '=',
    createdAt: NOW,
  };
  return {
    join,
    predicates: [{ predicate, leftItem: masterItem, rightItem: detailItem }],
    leftFolder: master,
    rightFolder: detail,
  };
}

function mkCondition(
  item: Item,
  folder: Folder,
  overrides: Partial<MapCondition> = {},
): MapDefinition['conditions'][number] {
  return {
    condition: {
      id: uid(),
      mapId: 'unused',
      itemId: item.id,
      conditionType: 'STATIC',
      operator: '=',
      value: 'X',
      paramName: null,
      logicOperator: 'AND',
      groupId: null,
      displayOrder: 0,
      createdAt: NOW,
      ...overrides,
    },
    item,
    folder,
  };
}

function mkDef(partial: Partial<MapDefinition>): MapDefinition {
  return {
    map: mkMap(),
    items: [],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    totals: [],
    joins: [],
    formulaItems: [],
    ...partial,
  };
}

/**
 * The SQL Neo would emit with no guard at all: the real clause builders, with
 * the interim multi-folder refusal stepped around by telling the FROM clause
 * the statement does not aggregate. Everything else — the SELECT list, the
 * inner join, the GROUP BY — is exactly what production writes.
 */
function unguardedFlatSql(def: MapDefinition): string {
  const plan = planQuery(def);
  const ctx = new GenerationContext(def, plan.folderIds);
  const select = buildSelectClause(def, ctx);
  const from = buildFromClause(def, ctx, { plan, hasAggregates: false });
  const groupBy = buildGroupByClause(select.hasAggregates, select.nonAggregateExprs);
  return [select.sql, from, groupBy].filter(Boolean).join('\n');
}

function asRewrite(def: MapDefinition): RewritePlan {
  const plan = planQuery(def);
  if (plan.kind !== 'REWRITE') {
    throw new Error(`expected REWRITE, got ${plan.decision}`);
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Oracle's worked example — ACCOUNT (master), SALES and BUDGET (details)
// ---------------------------------------------------------------------------

/**
 * `9.0.4\B10270_01.pdf` figs. 9-19 / 9-20. For Account 1 the correct sales are
 * **400** and the correct budget is **400**; the flat statement returns **800**
 * and **1200**.
 *
 * Those two wrong numbers pin the row counts exactly: sales are inflated by the
 * budget row count (800 / 400 = 2 budget rows) and budget by the sales row
 * count (1200 / 400 = 3 sales rows).
 */
function oracleFixture() {
  const account = mkFolder('ACCOUNT');
  const salesFolder = mkFolder('SALES');
  const budgetFolder = mkFolder('BUDGET');

  const accountId = mkItem(account, 'Id', { columnName: 'ID', dataType: 'NUMBER' });
  const accountName = mkItem(account, 'Name', { columnName: 'NAME' });
  const salesAccId = mkItem(salesFolder, 'Sales Acc Id', {
    columnName: 'ACCID',
    dataType: 'NUMBER',
  });
  const salesAmount = mkMeasure(salesFolder, 'Sales');
  const budgetAccId = mkItem(budgetFolder, 'Budget Acc Id', {
    columnName: 'ACCID',
    dataType: 'NUMBER',
  });
  const budgetAmount = mkMeasure(budgetFolder, 'Budget');

  const allItems = [
    { item: accountId, folder: account },
    { item: accountName, folder: account },
    { item: salesAccId, folder: salesFolder },
    { item: salesAmount, folder: salesFolder },
    { item: budgetAccId, folder: budgetFolder },
    { item: budgetAmount, folder: budgetFolder },
  ];

  const def = mkDef({
    items: [
      { mapItem: mkMapItem(accountName, 0), item: accountName, folder: account },
      { mapItem: mkMapItem(salesAmount, 1), item: salesAmount, folder: salesFolder },
      { mapItem: mkMapItem(budgetAmount, 2), item: budgetAmount, folder: budgetFolder },
    ],
    joins: [
      mkJoin(account, accountId, salesFolder, salesAccId),
      mkJoin(account, accountId, budgetFolder, budgetAccId),
    ],
    formulaItems: allItems,
  });

  return { def, account, salesFolder, budgetFolder, accountName, salesAmount, budgetAmount };
}

const DDL = [
  'DROP SCHEMA IF EXISTS "FANTRAP" CASCADE',
  'CREATE SCHEMA "FANTRAP"',
  'CREATE TABLE "FANTRAP"."ACCOUNT" ("ID" int, "NAME" text)',
  'CREATE TABLE "FANTRAP"."SALES" ("ID" int, "ACCID" int, "SALES" numeric)',
  'CREATE TABLE "FANTRAP"."BUDGET" ("ID" int, "ACCID" int, "BUDGET" numeric)',
  `INSERT INTO "FANTRAP"."ACCOUNT" VALUES (1, 'Account 1'), (2, 'Account 2')`,
  // Account 1: three sales rows totalling 400.
  `INSERT INTO "FANTRAP"."SALES" VALUES (1, 1, 100), (2, 1, 150), (3, 1, 150), (4, 2, 50)`,
  // Account 1: two budget rows totalling 400.
  `INSERT INTO "FANTRAP"."BUDGET" VALUES (1, 1, 250), (2, 1, 150), (3, 2, 60)`,
];

async function run(statement: string): Promise<Record<string, unknown>[]> {
  const result = await db.execute(sql.raw(statement));
  return result.rows;
}

/** Postgres folds unquoted aliases to lower case; the generator emits upper. */
const account1 = (rows: Record<string, unknown>[]) =>
  rows.find((r) => r.name === 'Account 1')!;
const num = (v: unknown) => Number(v);

describe("Oracle's worked example — the inflation, and its prevention", () => {
  beforeAll(async () => {
    for (const statement of DDL) await run(statement);
  });

  afterAll(async () => {
    await run('DROP SCHEMA IF EXISTS "FANTRAP" CASCADE');
  });

  it('reproduces the documented inflation when the guard is absent', async () => {
    const { def } = oracleFixture();
    const rows = await run(unguardedFlatSql(def));

    // Oracle's figure 9-20: 400 reported as 800, and 400 reported as 1200.
    expect(num(account1(rows).sales)).toBe(800);
    expect(num(account1(rows).budget)).toBe(1200);
  });

  it('classifies the query as a two-branch rewrite', () => {
    const plan = asRewrite(oracleFixture().def);
    expect(plan.decision).toBe('REWRITE(2)');
    expect(plan.branches).toHaveLength(2);
    expect(plan.outerKeys.map((k) => k.columnName)).toEqual(['ID']);
  });

  it('aggregates each branch below its own join, one GROUP BY per branch', () => {
    const { def } = oracleFixture();
    const { sql: text } = renderRewrite(def, asRewrite(def));
    // Two inline views, each with its own GROUP BY and its own outer join.
    expect(text.match(/GROUP BY/g)).toHaveLength(3); // two branches + the outer
    expect(text.match(/LEFT OUTER JOIN/g)).toHaveLength(2);
    // The outer aggregate re-aggregates rather than projecting.
    expect(text).toMatch(/SUM\(b1\.M0\)/);
    expect(text).toMatch(/SUM\(b2\.M0\)/);
  });

  it('returns the RIGHT numbers once the rewrite is applied', async () => {
    const { def } = oracleFixture();
    const { sql: text } = renderRewrite(def, asRewrite(def));
    const rows = await run(text);

    // Oracle's figure 9-19: the correct answers.
    expect(num(account1(rows).sales)).toBe(400);
    expect(num(account1(rows).budget)).toBe(400);
  });

  it('keeps a master row whose detail is missing on one branch', async () => {
    // The detail side is outer-joined *structurally*: inner-joining a branch
    // would drop master rows absent from that one detail, and those rows still
    // have values on the other branch.
    await run(`INSERT INTO "FANTRAP"."ACCOUNT" VALUES (3, 'Account 3')`);
    await run(`INSERT INTO "FANTRAP"."SALES" VALUES (9, 3, 77)`);
    try {
      const { def } = oracleFixture();
      const rows = await run(renderRewrite(def, asRewrite(def)).sql);
      const third = rows.find((r) => r.name === 'Account 3');
      expect(third).toBeDefined();
      expect(num(third!.sales)).toBe(77);
      expect(third!.budget).toBeNull();
    } finally {
      await run(`DELETE FROM "FANTRAP"."SALES" WHERE "ID" = 9`);
      await run(`DELETE FROM "FANTRAP"."ACCOUNT" WHERE "ID" = 3`);
    }
  });
});

// ---------------------------------------------------------------------------
// Step 5a — the single-branch master-measure trap (D-034)
// ---------------------------------------------------------------------------

describe('the single-branch trap — a master measure beside one fanning branch', () => {
  /** Order headers (master, carrying the total) joined to their lines. */
  function headerLinesFixture() {
    const headers = mkFolder('M M67');
    const lines = mkFolder('M M67 1');
    const orderId = mkItem(headers, 'Order Id', { columnName: 'ORDER_ID', dataType: 'NUMBER' });
    const orderRef = mkItem(headers, 'Order Ref', { columnName: 'ORDER_REF' });
    const orderTotal = mkMeasure(headers, 'Order Total');
    const lineOrderId = mkItem(lines, 'Line Order Id', {
      columnName: 'ORDER_ID',
      dataType: 'NUMBER',
    });
    const lineQty = mkItem(lines, 'Line Qty', { columnName: 'QTY', dataType: 'NUMBER' });
    const allItems = [orderId, orderRef, orderTotal, lineOrderId, lineQty].map((item) => ({
      item,
      folder: item.folderId === headers.id ? headers : lines,
    }));
    return {
      headers,
      lines,
      orderId,
      orderRef,
      orderTotal,
      lineOrderId,
      lineQty,
      join: mkJoin(headers, orderId, lines, lineOrderId),
      allItems,
    };
  }

  it('is a REWRITE with one detail branch, not a FLAT plan', () => {
    const f = headerLinesFixture();
    // The £2.4M -> £9.6M shape: the header total selected alongside a live
    // fanning branch. One branch — a guard keyed on ">= 2" walks straight past.
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderRef, 0), item: f.orderRef, folder: f.headers },
        { mapItem: mkMapItem(f.orderTotal, 1), item: f.orderTotal, folder: f.headers },
        { mapItem: mkMapItem(f.lineQty, 2), item: f.lineQty, folder: f.lines },
      ],
      joins: [f.join],
      formulaItems: f.allItems,
    });

    const plan = planQuery(def);
    expect(plan.kind).toBe('REWRITE');
    if (plan.kind !== 'REWRITE') return;
    // b0 carries the master's own measure at master grain; b1 the detail's.
    expect(plan.branches.map((b) => b.id)).toEqual(['b0', 'b1']);
    expect(plan.branches[0]!.detailFolderId).toBeNull();
    expect(plan.branches[0]!.measures.map((m) => m.label)).toEqual(['Order Total']);
    expect(plan.branches[0]!.fanning).toBe(false);
    expect(plan.branches[1]!.detailFolderId).toBe(f.lines.id);
  });

  it('is FLAT when the detail contributes only a hidden item', () => {
    // A hidden item draws no column, and Neo's SELECT clause therefore never
    // asks for its folder's alias — so the folder is not in the query and there
    // is nothing to fan out. Recorded because it is the one place Neo's model
    // is narrower than Discoverer's, where a hidden item is still named by the
    // query request.
    const f = headerLinesFixture();
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderTotal, 0), item: f.orderTotal, folder: f.headers },
        {
          mapItem: mkMapItem(f.lineQty, 1, { isHidden: true }),
          item: f.lineQty,
          folder: f.lines,
        },
      ],
      joins: [f.join],
      formulaItems: f.allItems,
    });
    expect(planQuery(def).decision).toBe('FLAT(SINGLE_FOLDER)');
  });

  it('is FLAT when the detail branch contributes nothing at all', () => {
    // A join present but contributing no selected column is trimmed and cannot
    // fan (§1.11 step 4).
    const f = headerLinesFixture();
    const def = mkDef({
      items: [{ mapItem: mkMapItem(f.orderTotal, 0), item: f.orderTotal, folder: f.headers }],
      joins: [f.join],
      formulaItems: f.allItems,
    });
    expect(planQuery(def).decision).toBe('FLAT(SINGLE_FOLDER)');
  });

  it('is FLAT when the join is explicitly one-to-one', () => {
    const f = headerLinesFixture();
    const oneToOne = mkJoin(f.headers, f.orderId, f.lines, f.lineOrderId, {
      oneToOne: true,
    });
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(f.orderTotal, 0), item: f.orderTotal, folder: f.headers },
        { mapItem: mkMapItem(f.lineQty, 1), item: f.lineQty, folder: f.lines },
      ],
      joins: [oneToOne],
      formulaItems: f.allItems,
    });
    expect(planQuery(def).decision).toBe('FLAT(NO_FAN_CANDIDATE)');
  });
});

// ---------------------------------------------------------------------------
// Step 3 — assume fanning (D-033)
// ---------------------------------------------------------------------------

describe('assume-fanning is the default', () => {
  it('treats a join with oneToOne false as FANNING', () => {
    const plan = asRewrite(oracleFixture().def);
    expect(plan.branches.filter((b) => b.detailFolderId).every((b) => b.fanning)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Step 6 — the four refusal rules, each naming its folders
// ---------------------------------------------------------------------------

describe('refusal rules R1-R4', () => {
  it('R1 — the detail folders join the master on different columns', () => {
    const account = mkFolder('ACCOUNT');
    const salesF = mkFolder('SALES');
    const budgetF = mkFolder('BUDGET');
    const id = mkItem(account, 'Id', { columnName: 'ID', dataType: 'NUMBER' });
    const region = mkItem(account, 'Region', { columnName: 'REGION' });
    const name = mkItem(account, 'Name', { columnName: 'NAME' });
    const sAcc = mkItem(salesF, 'S Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const sAmt = mkMeasure(salesF, 'Sales');
    const bRegion = mkItem(budgetF, 'B Region', { columnName: 'REGION' });
    const bAmt = mkMeasure(budgetF, 'Budget');

    const def = mkDef({
      items: [
        { mapItem: mkMapItem(name, 0), item: name, folder: account },
        { mapItem: mkMapItem(sAmt, 1), item: sAmt, folder: salesF },
        { mapItem: mkMapItem(bAmt, 2), item: bAmt, folder: budgetF },
      ],
      // One branch keys on ID, the other on REGION.
      joins: [mkJoin(account, id, salesF, sAcc), mkJoin(account, region, budgetF, bRegion)],
      formulaItems: [
        { item: id, folder: account },
        { item: region, folder: account },
        { item: name, folder: account },
        { item: sAcc, folder: salesF },
        { item: sAmt, folder: salesF },
        { item: bRegion, folder: budgetF },
        { item: bAmt, folder: budgetF },
      ],
    });

    const plan = planQuery(def);
    expect(plan.kind).toBe('REFUSE');
    if (plan.kind !== 'REFUSE') return;
    expect(plan.rule).toBe('R1');
    expect(plan.decision).toBe('REFUSE(R1)');
    expect(plan.folders).toEqual(expect.arrayContaining(['ACCOUNT', 'SALES', 'BUDGET']));
  });

  it('R2 — the two detail folders are joined to each other as well', () => {
    const f = oracleFixture();
    const salesLink = mkItem(f.salesFolder, 'Sales Link', {
      columnName: 'LINK',
      dataType: 'NUMBER',
    });
    const budgetLink = mkItem(f.budgetFolder, 'Budget Link', {
      columnName: 'LINK',
      dataType: 'NUMBER',
    });
    const def = {
      ...f.def,
      joins: [
        ...f.def.joins,
        mkJoin(f.salesFolder, salesLink, f.budgetFolder, budgetLink),
      ],
      formulaItems: [
        ...f.def.formulaItems,
        { item: salesLink, folder: f.salesFolder },
        { item: budgetLink, folder: f.budgetFolder },
      ],
    };

    const plan = planQuery(def);
    expect(plan.kind).toBe('REFUSE');
    if (plan.kind !== 'REFUSE') return;
    expect(plan.rule).toBe('R2');
    expect(plan.folders).toEqual(expect.arrayContaining(['SALES', 'BUDGET']));
    expect(plan.message).toContain('circular');
  });

  it('R3 — non-aggregated values are chosen from more than one detail', () => {
    const account = mkFolder('ACCOUNT');
    const salesF = mkFolder('SALES');
    const budgetF = mkFolder('BUDGET');
    const id = mkItem(account, 'Id', { columnName: 'ID', dataType: 'NUMBER' });
    const name = mkItem(account, 'Name', { columnName: 'NAME' });
    const sAcc = mkItem(salesF, 'S Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const sAmt = mkMeasure(salesF, 'Sales');
    const sRep = mkItem(salesF, 'Sales Rep', { columnName: 'REP' });
    const bAcc = mkItem(budgetF, 'B Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const bAmt = mkMeasure(budgetF, 'Budget');
    const bOwner = mkItem(budgetF, 'Budget Owner', { columnName: 'OWNER' });

    const def = mkDef({
      items: [
        { mapItem: mkMapItem(name, 0), item: name, folder: account },
        // An axis column from EACH detail: the correct answer IS a
        // cross-product, and no rewrite restores it.
        { mapItem: mkMapItem(sRep, 1), item: sRep, folder: salesF },
        { mapItem: mkMapItem(bOwner, 2), item: bOwner, folder: budgetF },
        { mapItem: mkMapItem(sAmt, 3), item: sAmt, folder: salesF },
        { mapItem: mkMapItem(bAmt, 4), item: bAmt, folder: budgetF },
      ],
      joins: [mkJoin(account, id, salesF, sAcc), mkJoin(account, id, budgetF, bAcc)],
      formulaItems: [id, name, sAcc, sAmt, sRep, bAcc, bAmt, bOwner].map((item) => ({
        item,
        folder:
          item.folderId === account.id ? account : item.folderId === salesF.id ? salesF : budgetF,
      })),
    });

    const plan = planQuery(def);
    expect(plan.kind).toBe('REFUSE');
    if (plan.kind !== 'REFUSE') return;
    expect(plan.rule).toBe('R3');
    expect(plan.folders).toEqual(expect.arrayContaining(['SALES', 'BUDGET']));
  });

  it('R4 — two folders each satisfy the branch test, so there is no single fan', () => {
    // Two independent fans in one query: A carries its own measure and fans
    // into B; C carries its own measure and fans into D. A one-to-one bridge
    // joins them, so the folder set is connected and the query is buildable —
    // but "which master do the branches hang off" has two answers.
    const a = mkFolder('A_MASTER');
    const b = mkFolder('B_DETAIL');
    const c = mkFolder('C_MASTER');
    const d = mkFolder('D_DETAIL');
    const aId = mkItem(a, 'A Id', { columnName: 'ID', dataType: 'NUMBER' });
    const aAmt = mkMeasure(a, 'A Amount');
    const bRef = mkItem(b, 'B Ref', { columnName: 'AID', dataType: 'NUMBER' });
    const bLabel = mkItem(b, 'B Label', { columnName: 'LABEL' });
    const cId = mkItem(c, 'C Id', { columnName: 'ID', dataType: 'NUMBER' });
    const cAmt = mkMeasure(c, 'C Amount');
    const dRef = mkItem(d, 'D Ref', { columnName: 'CID', dataType: 'NUMBER' });
    const dLabel = mkItem(d, 'D Label', { columnName: 'LABEL' });
    const items = [
      { item: aId, folder: a },
      { item: aAmt, folder: a },
      { item: bRef, folder: b },
      { item: bLabel, folder: b },
      { item: cId, folder: c },
      { item: cAmt, folder: c },
      { item: dRef, folder: d },
      { item: dLabel, folder: d },
    ];

    const def = mkDef({
      items: [
        { mapItem: mkMapItem(bLabel, 0), item: bLabel, folder: b },
        { mapItem: mkMapItem(aAmt, 1), item: aAmt, folder: a },
        { mapItem: mkMapItem(cAmt, 2), item: cAmt, folder: c },
        { mapItem: mkMapItem(dLabel, 3), item: dLabel, folder: d },
      ],
      joins: [
        mkJoin(a, aId, b, bRef),
        mkJoin(c, cId, d, dRef),
        // The bridge that connects the two fans into one query.
        mkJoin(a, aId, c, cId, { oneToOne: true }),
      ],
      formulaItems: items,
    });

    const plan = planQuery(def);
    expect(plan.kind).toBe('REFUSE');
    if (plan.kind !== 'REFUSE') return;
    expect(plan.rule).toBe('R4');
    expect(plan.decision).toBe('REFUSE(R4)');
    expect(plan.folders).toEqual(expect.arrayContaining(['A_MASTER', 'C_MASTER']));
  });
});

// ---------------------------------------------------------------------------
// Step 8 — re-aggregation (D-035)
// ---------------------------------------------------------------------------

describe('re-aggregation across the fan', () => {
  /** Oracle's fixture with the two measures' aggregate functions swapped in. */
  function withAggregates(salesAgg: string, budgetAgg = 'SUM') {
    const account = mkFolder('ACCOUNT');
    const salesF = mkFolder('SALES');
    const budgetF = mkFolder('BUDGET');
    const id = mkItem(account, 'Id', { columnName: 'ID', dataType: 'NUMBER' });
    const name = mkItem(account, 'Name', { columnName: 'NAME' });
    const sAcc = mkItem(salesF, 'S Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const sAmt = mkMeasure(salesF, 'Sales', salesAgg);
    const bAcc = mkItem(budgetF, 'B Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const bAmt = mkMeasure(budgetF, 'Budget', budgetAgg);
    return mkDef({
      items: [
        { mapItem: mkMapItem(name, 0), item: name, folder: account },
        { mapItem: mkMapItem(sAmt, 1), item: sAmt, folder: salesF },
        { mapItem: mkMapItem(bAmt, 2), item: bAmt, folder: budgetF },
      ],
      joins: [mkJoin(account, id, salesF, sAcc), mkJoin(account, id, budgetF, bAcc)],
      formulaItems: [id, name, sAcc, sAmt, bAcc, bAmt].map((item) => ({
        item,
        folder:
          item.folderId === account.id ? account : item.folderId === salesF.id ? salesF : budgetF,
      })),
    });
  }

  it.each([
    ['SUM', 'SUM'],
    ['COUNT', 'SUM'],
    ['MIN', 'MIN'],
    ['MAX', 'MAX'],
  ])('%s re-aggregates as %s', (aggregate, expected) => {
    const plan = asRewrite(withAggregates(aggregate));
    const measure = plan.measures.find((m) => m.label === 'Sales')!;
    expect(measure.aggregate).toBe(aggregate);
    expect(measure.reAggregate).toBe(expected);
  });

  it.each(['AVG', 'COUNT DISTINCT', 'STDDEV', 'VARIANCE'])(
    '%s refuses rather than approximating',
    (aggregate) => {
      const plan = planQuery(withAggregates(aggregate));
      expect(plan.kind).toBe('REFUSE');
      if (plan.kind !== 'REFUSE') return;
      expect(plan.rule).toBe('REAGG');
      expect(plan.decision).toBe('REFUSE(REAGG)');
      expect(plan.message).toContain(aggregate);
    },
  );

  it('emits the re-aggregate in the outer query and the aggregate in the branch', () => {
    const def = withAggregates('COUNT');
    const { sql: text } = renderRewrite(def, asRewrite(def));
    expect(text).toMatch(/COUNT\(f2\."SALES"\) AS M0/);
    // COUNT counts rows per branch; those counts then add.
    expect(text).toMatch(/SUM\(b1\.M0\)/);
  });
});

// ---------------------------------------------------------------------------
// §1.9.2 / §1.9.3 — branch-local conditions and parameters
// ---------------------------------------------------------------------------

describe('conditions and parameters are branch-local', () => {
  it('puts a detail filter inside that branch, not in the outer query', () => {
    const f = oracleFixture();
    const salesRep = mkItem(f.salesFolder, 'Sales Rep', { columnName: 'REP' });
    const def: MapDefinition = {
      ...f.def,
      conditions: [mkCondition(salesRep, f.salesFolder, { value: 'ACME' })],
      formulaItems: [...f.def.formulaItems, { item: salesRep, folder: f.salesFolder }],
    };

    const plan = asRewrite(def);
    const sales = plan.branches.find((b) => b.detailFolderId === f.salesFolder.id)!;
    const budget = plan.branches.find((b) => b.detailFolderId === f.budgetFolder.id)!;
    expect(sales.conditionIds).toHaveLength(1);
    expect(budget.conditionIds).toHaveLength(0);

    const { sql: text, bindParams } = renderRewrite(def, plan);
    // Every line of an inline view is indented; the outer query's are not.
    const outerLines = text.split('\n').filter((line) => !line.startsWith(' '));
    expect(text).toMatch(/"REP" = :b1_c0/);
    expect(outerLines.join('\n')).not.toMatch(/WHERE/);
    expect(bindParams).toEqual({ b1_c0: 'ACME' });
  });

  it('repeats a master filter in every branch so the branch keys stay aligned', () => {
    const f = oracleFixture();
    const accountName = f.def.formulaItems.find((e) => e.item.name === 'Name')!;
    const def: MapDefinition = {
      ...f.def,
      conditions: [mkCondition(accountName.item, f.account, { value: 'Account 1' })],
    };

    const plan = asRewrite(def);
    expect(plan.branches.every((b) => b.conditionIds.length === 1)).toBe(true);

    const { bindParams } = renderRewrite(def, plan);
    // One bind per branch, prefixed, so two branches never claim the same name.
    expect(Object.keys(bindParams).sort()).toEqual(['b1_c0', 'b2_c0']);
  });

  it('carries a parameter into the branch that needs it', () => {
    const f = oracleFixture();
    const salesRep = mkItem(f.salesFolder, 'Sales Rep', { columnName: 'REP' });
    const parameter: MapParameter = {
      id: uid(),
      mapId: 'unused',
      name: 'Rep',
      bindName: 'rep',
      paramType: 'TEXT',
      defaultValue: null,
      isRequired: false,
      createdAt: NOW,
    };
    const def: MapDefinition = {
      ...f.def,
      conditions: [
        mkCondition(salesRep, f.salesFolder, {
          conditionType: 'PARAMETER',
          paramName: 'rep',
          value: null,
        }),
      ],
      parameters: [parameter],
      formulaItems: [...f.def.formulaItems, { item: salesRep, folder: f.salesFolder }],
    };

    const plan = asRewrite(def);
    const sales = plan.branches.find((b) => b.detailFolderId === f.salesFolder.id)!;
    expect(sales.parameterBindNames).toEqual(['rep']);

    const { sql: text } = renderRewrite(def, plan, { parameterValues: { rep: 'ACME' } });
    expect(text).toMatch(/"REP" = :rep/);
  });

  it('applies a row-security predicate inside every branch that holds its folder', () => {
    const f = oracleFixture();
    const { sql: text } = renderRewrite(f.def, asRewrite(f.def), {
      securityPredicates: [{ sql: '{alias}."REGION" = :region', folderId: f.account.id }],
      securityBindParams: { region: 'EU' },
    });
    // Once per branch — a predicate left to the outer query would be applied
    // after the inline view had already aggregated the rows it should remove.
    expect(text.match(/"REGION" = :region/g)).toHaveLength(2);
    expect(text).toMatch(/WHERE \("f1"?\.?.?"REGION" = :region\)|WHERE \(f1\."REGION" = :region\)/);
  });
});

// ---------------------------------------------------------------------------
// Step 0 / step 5 — FLAT is a decision
// ---------------------------------------------------------------------------

describe('FLAT is chosen explicitly', () => {
  it('a query with no aggregate takes the flat path, and says so', () => {
    const f = oracleFixture();
    const def = {
      ...f.def,
      items: f.def.items.map((entry) => ({
        ...entry,
        // Drop the default aggregation: a pure detail listing.
        item: { ...entry.item, aggFunction: null },
      })),
    };
    expect(planQuery(def).decision).toBe('FLAT(NO_MEASURES)');
  });

  it('a one-folder query takes the flat path', () => {
    const f = oracleFixture();
    const def = mkDef({
      items: [f.def.items[1]!],
      joins: f.def.joins,
      formulaItems: f.def.formulaItems,
    });
    expect(planQuery(def).decision).toBe('FLAT(SINGLE_FOLDER)');
  });

  it('a disconnected folder set plans FLAT and leaves the refusal to the FROM clause', () => {
    const f = oracleFixture();
    const def = { ...f.def, joins: [] };
    expect(planQuery(def).decision).toBe('FLAT(DISCONNECTED)');
  });
});

// ---------------------------------------------------------------------------
// Step 9 — totals across branches render NULL (§1.6)
// ---------------------------------------------------------------------------

describe('totals spanning branches', () => {
  function mkTotal(mapItem: MapItem, displayOrder: number): MapTotal {
    return {
      id: uid(),
      mapId: 'unused',
      mapItemId: mapItem.id,
      mapCalculatedFieldId: null,
      kind: 'TOTAL',
      aggFunction: 'SUM',
      placement: 'GRAND_TOTAL',
      breakMapItemId: null,
      label: null,
      displayOrder,
      sourceElementId: null,
      sourceAttrs: null,
      createdAt: NOW,
    };
  }

  it('renders NULL rather than a number, and says why', () => {
    const f = oracleFixture();
    const salesItem = f.def.items[1]!.mapItem;
    const budgetItem = f.def.items[2]!.mapItem;
    const def = { ...f.def, totals: [mkTotal(salesItem, 0), mkTotal(budgetItem, 1)] };

    const plan = asRewrite(def);
    const ctx = new GenerationContext(def, plan.folderIds);
    const select = buildSelectClause(def, ctx);
    const totals = planTotals(def, ctx, select, plan);

    expect(totals.entries[0]!.selectParts.every((p) => p.startsWith('NULL AS'))).toBe(true);
    expect(totals.entries[0]!.totals.every((t) => t.aggFunction === 'SUPPRESSED')).toBe(true);
    expect(totals.warnings.join(' ')).toMatch(/different sets of rows/);
  });

  it('still computes a total whose columns all come from one branch', () => {
    const f = oracleFixture();
    const def = { ...f.def, totals: [mkTotal(f.def.items[1]!.mapItem, 0)] };

    const plan = asRewrite(def);
    const ctx = new GenerationContext(def, plan.folderIds);
    const select = buildSelectClause(def, ctx);
    const totals = planTotals(def, ctx, select, plan);

    expect(totals.entries[0]!.selectParts[0]).toMatch(/^SUM\(/);
    expect(totals.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Safety — the rewrite adds SQL surface, not new ways to inject
// ---------------------------------------------------------------------------

describe('the rewrite keeps the generator safety contract', () => {
  it('rejects a predicate column carrying a quote rather than escaping it', () => {
    const account = mkFolder('ACCOUNT');
    const salesF = mkFolder('SALES');
    const budgetF = mkFolder('BUDGET');
    const id = mkItem(account, 'Id', { columnName: 'ID"; DROP TABLE X --', dataType: 'NUMBER' });
    const name = mkItem(account, 'Name', { columnName: 'NAME' });
    const sAcc = mkItem(salesF, 'S Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const sAmt = mkMeasure(salesF, 'Sales');
    const bAcc = mkItem(budgetF, 'B Acc', { columnName: 'ACCID', dataType: 'NUMBER' });
    const bAmt = mkMeasure(budgetF, 'Budget');
    const def = mkDef({
      items: [
        { mapItem: mkMapItem(name, 0), item: name, folder: account },
        { mapItem: mkMapItem(sAmt, 1), item: sAmt, folder: salesF },
        { mapItem: mkMapItem(bAmt, 2), item: bAmt, folder: budgetF },
      ],
      joins: [mkJoin(account, id, salesF, sAcc), mkJoin(account, id, budgetF, bAcc)],
      formulaItems: [id, name, sAcc, sAmt, bAcc, bAmt].map((item) => ({
        item,
        folder:
          item.folderId === account.id ? account : item.folderId === salesF.id ? salesF : budgetF,
      })),
    });
    expect(() => renderRewrite(def, asRewrite(def))).toThrow(SqlGenerationError);
  });

  it('binds every condition value — nothing from a condition reaches the SQL text', () => {
    const f = oracleFixture();
    const salesRep = mkItem(f.salesFolder, 'Sales Rep', { columnName: 'REP' });
    const def = {
      ...f.def,
      conditions: [mkCondition(salesRep, f.salesFolder, { value: "O'Brien' OR 1=1 --" })],
      formulaItems: [...f.def.formulaItems, { item: salesRep, folder: f.salesFolder }],
    };
    const { sql: text, bindParams } = renderRewrite(def, asRewrite(def));
    expect(text).not.toContain('OR 1=1');
    expect(Object.values(bindParams)).toContain("O'Brien' OR 1=1 --");
  });
});
