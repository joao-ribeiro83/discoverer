import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'oracledb';
import { eq, inArray } from 'drizzle-orm';
import { getApp } from './test-helper.js';
import { db } from '../../db/index.js';
import {
  businessAreas,
  dataSources,
  folderBusinessAreas,
  folders,
  items,
  joins,
  joinPredicates,
  mapItems,
  maps,
  securityPolicies,
  securityPolicyAssignments,
  securityPolicyRules,
  userBusinessAreaGrants,
  users,
  type Folder,
  type Item,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import { FLAGS_FOR_JOIN_TYPE, type JoinType } from '../../services/join.service.js';
import { loadMapDefinition } from '../../services/sql-generator.js';
import {
  defaultDeps,
  executeMap,
  MapExecutionError,
  resolveSecurityPredicates,
  type MapExecutionDeps,
} from '../../services/map-execution.service.js';
import {
  defaultExportDeps,
  processExportJob,
  type ExportJobDeps,
} from '../../services/export.service.js';
import {
  effectiveFolderSet,
  securityRelevantFolderIds,
} from '../../lib/sql/folder-set.js';
import { assertDataEntitlement } from '../../services/business-area.service.js';
import { config } from '../../config.js';

// ===========================================================================
// RLS conformance suite — D-115 / D-116 (Phase 1.1), D-090 (Phase 6.3)
//
// Every test here is a GATE, not a nice-to-have. They cover the three routes a
// folder can reach the emitted SQL by, and the ways the old code could run a
// query it should have refused:
//
//   1. a user with no policy on a policy-bearing folder                  (D-116)
//   2. a BA-scoped policy on a map whose business_area_id IS NULL        (D-015)
//   3. the DATA gate refusing an owner/public/shared map                 (D-016)
//   8. a folder reached ONLY through a calculated-field reference        (D-115)
//   9. an INNER-joined bridge folder                                     (D-115)
//  10. a policy-bearing folder the user cannot resolve -> refusal        (D-116)
//  11. an export carrying the same predicates as the on-screen query
//  12. a user with no policy sees NOTHING, and removing or disabling a
//      policy never opens access                                         (D-090)
//  13. a COMPLEX folder any active policy reaches refuses, naming both   (SEC-06)
//
// Row-level security fails closed by default, so every gate that needs a query
// to RUN gives its user a rule on each folder that query reads. Gate 10 is the
// OPEN-mode rule, and switches the mode for its own block only.
//
// Oracle is faked at the driver boundary only: policy creation, definition
// loading, folder-set derivation, predicate resolution and SQL generation are
// all the real production code against the live Postgres metadata database.
// ===========================================================================

const PW = 'SecurePass123!';
const NS = 'rls-conf';
const ADMIN_EMAIL = `${NS}-admin@test.com`;
/** Granted the business area, assigned the policy. */
const USER_OK_EMAIL = `${NS}-user-ok@test.com`;
/** Granted the business area, assigned NOTHING. */
const USER_NOPOLICY_EMAIL = `${NS}-user-nopolicy@test.com`;
/** Assigned the policy, granted NO business area. */
const USER_NOGRANT_EMAIL = `${NS}-user-nogrant@test.com`;
const BA_NAME = 'RLS Conformance BA';
const OTHER_BA_NAME = 'RLS Conformance Other BA';
const DS_NAME = 'RLS Conformance DS';

let app: FastifyInstance;

let adminId: string;
let userOkId: string;
let userNoPolicyId: string;
let userNoGrantId: string;
let adminToken: string;

let baId: string;
let otherBaId: string;
let salesFolder: Folder;
let secretFolder: Folder;
let bridgeFolder: Folder;
let region: Item;
let amount: Item;
let _secretValue: Item;
let salesLink: Item;
let bridgeLink: Item;
let bridgeLabel: Item;

/** Single-folder map over SALES only. */
let plainMapId: string;
/** Single-folder SELECT list, but a calculated item reaching into SECRETS. */
let calcRefMapId: string;
/** SALES + BRIDGE_LABEL, connected by an INNER join through BRIDGE. */
let bridgeMapId: string;
/** Same as plainMapId but `business_area_id IS NULL`. */
let nullBaMapId: string;
/** Public map over SALES, owned by the admin. */
let publicMapId: string;

// ---------------------------------------------------------------------------
// Oracle driver fake
// ---------------------------------------------------------------------------

function makeCaptureConn(): { conn: Connection; execute: jest.Mock } {
  const execute = jest.fn(async () => ({
    rows: [],
    metaData: [{ name: 'REGION' }],
  })) as jest.Mock;
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute,
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, execute };
}

function realPipelineDeps(conn: Connection): MapExecutionDeps {
  return {
    prepareQuery: defaultDeps().prepareQuery,
    getConnection: async () => conn,
    releaseConnection: async () => {},
    recordExecution: async () => {},
  };
}

async function captureSql(mapId: string, userId: string): Promise<string> {
  const { conn, execute } = makeCaptureConn();
  await executeMap(mapId, {}, userId, {}, realPipelineDeps(conn));
  const call = (execute.mock.calls[0] ?? []) as [string];
  return call[0] ?? '';
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

async function createUser(email: string, role: 'ADMIN' | 'USER') {
  const passwordHash = await hashPassword(PW);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: `RLS ${role}`, role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PW },
  });
  return res.json().data.token as string;
}

async function createPolicy(
  name: string,
  rules: Array<{
    targetId: string;
    targetType: 'BUSINESS_AREA' | 'FOLDER';
    sqlPredicate: string;
  }>,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/security/policies',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, rules },
  });
  if (res.statusCode !== 201) {
    throw new Error(`policy create failed (${res.statusCode}): ${res.body}`);
  }
  return res.json().data.id as string;
}

async function assignPolicy(policyId: string, userId: string): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/security/policies/${policyId}/assignments`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { userId },
  });
  if (res.statusCode !== 201) {
    throw new Error(`assignment failed (${res.statusCode}): ${res.body}`);
  }
}

async function dropPolicy(policyId: string): Promise<void> {
  await db
    .delete(securityPolicyAssignments)
    .where(eq(securityPolicyAssignments.policyId, policyId));
  await db
    .delete(securityPolicyRules)
    .where(eq(securityPolicyRules.policyId, policyId));
  await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
}

async function cleanup(): Promise<void> {
  const emails = [
    ADMIN_EMAIL,
    USER_OK_EMAIL,
    USER_NOPOLICY_EMAIL,
    USER_NOGRANT_EMAIL,
  ];
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));
  const userIds = existing.map((u) => u.id);

  const baRows = await db
    .select({ id: businessAreas.id })
    .from(businessAreas)
    .where(inArray(businessAreas.name, [BA_NAME, OTHER_BA_NAME]));
  const baIds = baRows.map((b) => b.id);

  if (baIds.length) {
    const folderRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(inArray(folders.businessAreaId, baIds));
    const folderIds = folderRows.map((f) => f.id);
    const targetIds = [...baIds, ...folderIds];
    const ruleRows = targetIds.length
      ? await db
          .select({ policyId: securityPolicyRules.policyId })
          .from(securityPolicyRules)
          .where(inArray(securityPolicyRules.targetId, targetIds))
      : [];
    const policyIds = [...new Set(ruleRows.map((r) => r.policyId))];
    for (const policyId of policyIds) await dropPolicy(policyId);

    if (folderIds.length) {
      const itemRows = await db
        .select({ id: items.id })
        .from(items)
        .where(inArray(items.folderId, folderIds));
      const itemIds = itemRows.map((i) => i.id);
      if (itemIds.length) {
        await db.delete(mapItems).where(inArray(mapItems.itemId, itemIds));
      }
      await db.delete(joins).where(inArray(joins.leftFolderId, folderIds));
      await db.delete(joins).where(inArray(joins.rightFolderId, folderIds));
      await db.delete(items).where(inArray(items.folderId, folderIds));
    }
    await db.delete(maps).where(inArray(maps.businessAreaId, baIds));
    await db.delete(folders).where(inArray(folders.businessAreaId, baIds));
    await db
      .delete(userBusinessAreaGrants)
      .where(inArray(userBusinessAreaGrants.businessAreaId, baIds));
    await db.delete(businessAreas).where(inArray(businessAreas.id, baIds));
  }

  if (userIds.length) {
    await db
      .delete(userBusinessAreaGrants)
      .where(inArray(userBusinessAreaGrants.userId, userIds));
    await db
      .delete(securityPolicyAssignments)
      .where(inArray(securityPolicyAssignments.userId, userIds));
    // Maps whose business area was already dropped above still hold a
    // created_by FK to these users.
    await db.delete(maps).where(inArray(maps.createdBy, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await db.delete(dataSources).where(eq(dataSources.name, DS_NAME));
}

async function mkFolder(
  businessAreaId: string,
  name: string,
  dataSourceId: string,
): Promise<Folder> {
  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId,
      name,
      folderType: 'TABLE',
      tableName: name,
      tableOwner: 'APP',
      dataSourceId,
      createdBy: adminId,
    })
    .returning();
  return folder!;
}

async function mkItem(
  folder: Folder,
  name: string,
  overrides: Partial<Item> = {},
): Promise<Item> {
  const [item] = await db
    .insert(items)
    .values({
      folderId: folder.id,
      name,
      itemType: 'CI',
      columnName: name.toUpperCase().replace(/\s+/g, '_'),
      createdBy: adminId,
      ...overrides,
    })
    .returning();
  return item!;
}

/**
 * A folder-to-folder join with one equality predicate.
 *
 * `join_type` is derived from the two outer-join flags (D-032) and the
 * columns matched on live in `join_predicates`, so a join is two inserts.
 */
async function mkJoin(
  name: string,
  master: Folder,
  masterItem: Item,
  detail: Folder,
  detailItem: Item,
  joinType: JoinType,
): Promise<void> {
  const [row] = await db
    .insert(joins)
    .values({
      name,
      leftFolderId: master.id,
      rightFolderId: detail.id,
      ...FLAGS_FOR_JOIN_TYPE[joinType],
    })
    .returning();
  await db.insert(joinPredicates).values({
    joinId: row!.id,
    seq: 0,
    leftItemId: masterItem.id,
    rightItemId: detailItem.id,
    operator: '=',
  });
}

async function mkMap(
  name: string,
  businessAreaId: string | null,
  itemIds: string[],
  overrides: { isPublic?: boolean; createdBy?: string } = {},
): Promise<string> {
  const [map] = await db
    .insert(maps)
    .values({
      name,
      mapType: 'TABLE',
      businessAreaId,
      createdBy: overrides.createdBy ?? adminId,
      isPublic: overrides.isPublic ?? false,
    })
    .returning();
  await db
    .insert(mapItems)
    .values(
      itemIds.map((itemId, i) => ({ mapId: map!.id, itemId, displayOrder: i })),
    );
  return map!.id;
}

beforeAll(async () => {
  app = await getApp();
  await cleanup();

  adminId = (await createUser(ADMIN_EMAIL, 'ADMIN')).id;
  userOkId = (await createUser(USER_OK_EMAIL, 'USER')).id;
  userNoPolicyId = (await createUser(USER_NOPOLICY_EMAIL, 'USER')).id;
  userNoGrantId = (await createUser(USER_NOGRANT_EMAIL, 'USER')).id;
  adminToken = await login(ADMIN_EMAIL);

  const [ds] = await db
    .insert(dataSources)
    .values({ name: DS_NAME, connectionType: 'oracle' })
    .returning();

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: BA_NAME, createdBy: adminId })
    .returning();
  baId = ba!.id;
  const [otherBa] = await db
    .insert(businessAreas)
    .values({ name: OTHER_BA_NAME, createdBy: adminId })
    .returning();
  otherBaId = otherBa!.id;

  salesFolder = await mkFolder(baId, 'SALES', ds!.id);
  secretFolder = await mkFolder(baId, 'SECRETS', ds!.id);
  bridgeFolder = await mkFolder(baId, 'BRIDGE', ds!.id);

  region = await mkItem(salesFolder, 'Region', { columnName: 'REGION' });
  amount = await mkItem(salesFolder, 'Amount', {
    columnName: 'AMOUNT',
    dataType: 'NUMBER',
  });
  salesLink = await mkItem(salesFolder, 'Link Id', { columnName: 'LINK_ID' });
  _secretValue = await mkItem(secretFolder, 'Secret Value', {
    columnName: 'SECRET_VALUE',
    dataType: 'NUMBER',
  });
  const secretLink = await mkItem(secretFolder, 'Secret Link Id', {
    columnName: 'LINK_ID',
  });
  bridgeLink = await mkItem(bridgeFolder, 'Bridge Link Id', {
    columnName: 'LINK_ID',
  });
  bridgeLabel = await mkItem(bridgeFolder, 'Bridge Label', {
    columnName: 'LABEL',
  });

  // SALES -> BRIDGE, INNER. The bridge FILTERS the result set, which is why
  // its policy has to apply even when the map draws no column from it.
  await mkJoin('SALES to BRIDGE', salesFolder, salesLink, bridgeFolder, bridgeLink, 'INNER');

  // SALES -> SECRETS, LEFT OUTER. Deliberately NOT row-changing: SECRETS
  // enters the security set because a formula puts its COLUMN in the SELECT
  // list, not because the join filters anything.
  await mkJoin('SALES to SECRETS', salesFolder, salesLink, secretFolder, secretLink, 'LEFT');

  // A calculated ITEM in SALES whose formula names an item in SECRETS. The map
  // selects only this item, so SECRETS appears in neither map_items nor
  // map_conditions — the exact shape of the D-115 bypass.
  const bonus = await mkItem(salesFolder, 'Bonus', {
    columnName: null,
    formula: '[Amount] + [Secret Value]',
    dataType: 'NUMBER',
  });

  plainMapId = await mkMap('RLS Conf Plain', baId, [region.id, amount.id]);
  calcRefMapId = await mkMap('RLS Conf CalcRef', baId, [bonus.id]);
  bridgeMapId = await mkMap('RLS Conf Bridge', baId, [
    region.id,
    bridgeLabel.id,
  ]);
  nullBaMapId = await mkMap('RLS Conf Null BA', null, [region.id, amount.id]);
  publicMapId = await mkMap('RLS Conf Public', baId, [region.id], {
    isPublic: true,
  });

  // userOk and userNoPolicy are entitled to the data; userNoGrant is not.
  await db.insert(userBusinessAreaGrants).values([
    { userId: userOkId, businessAreaId: baId, permissionLevel: 'EXPORT' },
    { userId: userNoPolicyId, businessAreaId: baId, permissionLevel: 'EXPORT' },
    // A grant on a DIFFERENT business area must not entitle these folders.
    {
      userId: userNoGrantId,
      businessAreaId: otherBaId,
      permissionLevel: 'EXPORT',
    },
  ]);
}, 60_000);

afterAll(async () => {
  await cleanup();
});

// ---------------------------------------------------------------------------
// effectiveFolderSet — the single derivation both gates consume (D-115)
// ---------------------------------------------------------------------------

describe('effectiveFolderSet', () => {
  it('includes a folder reached ONLY through a calculated-field reference', async () => {
    const def = await loadMapDefinition(calcRefMapId);
    // The map's only item lives in SALES...
    expect(def.items).toHaveLength(1);
    expect(def.items[0]!.folder.id).toBe(salesFolder.id);
    // ...but SECRETS' column value lands in the SELECT list all the same.
    const set = effectiveFolderSet(def);
    expect(set.columnBearingFolderIds).toContain(secretFolder.id);
  });

  it('reports an INNER join bridge as row-changing', async () => {
    const def = await loadMapDefinition(bridgeMapId);
    const set = effectiveFolderSet(def);
    // BRIDGE bears a column here (Bridge Label), so it is column-bearing
    // rather than a pure bridge — either way it must be in the security set.
    expect(securityRelevantFolderIds(set)).toContain(bridgeFolder.id);
    for (const bridge of set.joinPathFolderIds) {
      if (bridge.joinType === 'INNER') expect(bridge.rowChanging).toBe(true);
    }
  });

  it('is the set the security resolver uses — SALES alone for a plain map', async () => {
    const def = await loadMapDefinition(plainMapId);
    expect(securityRelevantFolderIds(effectiveFolderSet(def))).toEqual([
      salesFolder.id,
    ]);
  });

  // BE-12. The original complaint was that `loadMapDefinition` filtered its
  // folders by `maps.business_area_id` and so could not see a folder shared
  // into a second business area (`folder_business_areas` — the EUL's
  // many-to-many `BA_OBJ_LINKS`). Phase 1.1 replaced that filter with a scope
  // derived from the map's own items plus the join closure, which has no
  // business-area filter left to be wrong. These pin that: a folder shared
  // across areas must stay loadable, and must stay entitled through the
  // sharing area's grant.
  it('BE-12: loads a folder shared into a second business area', async () => {
    await db
      .insert(folderBusinessAreas)
      .values({ folderId: salesFolder.id, businessAreaId: otherBaId })
      .onConflictDoNothing();

    try {
      const def = await loadMapDefinition(plainMapId);
      expect(def.items.map((i) => i.folder.id)).toContain(salesFolder.id);
      expect(securityRelevantFolderIds(effectiveFolderSet(def))).toContain(
        salesFolder.id,
      );
    } finally {
      await db
        .delete(folderBusinessAreas)
        .where(eq(folderBusinessAreas.folderId, salesFolder.id));
    }
  });

  it('BE-12: a grant on the sharing area entitles the shared folder', async () => {
    // No grant on BA_NAME for this user, only on OTHER_BA_NAME — the folder is
    // reachable solely because it was shared there.
    await db.insert(userBusinessAreaGrants).values({
      userId: userNoGrantId,
      businessAreaId: otherBaId,
      permissionLevel: 'VIEW',
    });
    await db
      .insert(folderBusinessAreas)
      .values({ folderId: salesFolder.id, businessAreaId: otherBaId })
      .onConflictDoNothing();

    try {
      await expect(
        assertDataEntitlement(userNoGrantId, [salesFolder.id]),
      ).resolves.toBeUndefined();
    } finally {
      await db
        .delete(folderBusinessAreas)
        .where(eq(folderBusinessAreas.folderId, salesFolder.id));
      await db
        .delete(userBusinessAreaGrants)
        .where(eq(userBusinessAreaGrants.userId, userNoGrantId));
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 2 — a BA-scoped policy fires on a map with business_area_id IS NULL
//
// Without this test the column stays NOT NULL and Phase 1.1 is not done.
// ---------------------------------------------------------------------------

describe('BA-scoped policy on a map with business_area_id IS NULL (D-015)', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy('RLS Conf BA rule', [
      {
        targetId: baId,
        targetType: 'BUSINESS_AREA',
        sqlPredicate: "REGION = 'EMEA'",
      },
    ]);
    await assignPolicy(policyId, userOkId);
  });

  afterAll(async () => {
    await dropPolicy(policyId);
  });

  it('the map really does have a NULL business area', async () => {
    const [row] = await db
      .select({ businessAreaId: maps.businessAreaId })
      .from(maps)
      .where(eq(maps.id, nullBaMapId))
      .limit(1);
    expect(row!.businessAreaId).toBeNull();
  });

  it('still injects the predicate, resolved through the folder', async () => {
    const def = await loadMapDefinition(nullBaMapId);
    const resolved = await resolveSecurityPredicates(def, userOkId);
    expect(resolved.predicates).toHaveLength(1);

    const sql = await captureSql(nullBaMapId, userOkId);
    expect(sql).toContain("(REGION = 'EMEA')");
  });

  it('refuses the user with no policy, on the NULL-BA map too (D-116)', async () => {
    await expect(
      executeMap(
        nullBaMapId,
        {},
        userNoPolicyId,
        {},
        realPipelineDeps(makeCaptureConn().conn),
      ),
    ).rejects.toThrow(/no row-level security policy resolves for you/);
  });
});

// ---------------------------------------------------------------------------
// Gate 8 — a folder reached only through a calculated-field reference has its
// policy applied. This is the live bypass D-115 closes.
// ---------------------------------------------------------------------------

describe('policy on a folder reached only by a calculated field (D-115)', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy('RLS Conf secrets guard', [
      {
        targetId: secretFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."SECRET_VALUE" > 0',
      },
      // The map's own folder needs a rule too, or it refuses before SECRETS
      // gets a say: row-level security fails closed (D-090).
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" IS NOT NULL',
      },
    ]);
    await assignPolicy(policyId, userOkId);
  });

  afterAll(async () => {
    await dropPolicy(policyId);
  });

  it('applies the SECRETS predicate even though no map item names SECRETS', async () => {
    const def = await loadMapDefinition(calcRefMapId);
    const resolved = await resolveSecurityPredicates(def, userOkId);
    expect(resolved.predicates.map((p) => p.folderId)).toContain(
      secretFolder.id,
    );

    const sql = await captureSql(calcRefMapId, userOkId);
    expect(sql).toContain('."SECRET_VALUE" > 0');
    expect(sql).not.toContain('{alias}');
  });

  it('refuses a user with no predicate for that same hidden folder', async () => {
    await expect(
      resolveSecurityPredicates(
        await loadMapDefinition(calcRefMapId),
        userNoPolicyId,
      ),
    ).rejects.toThrow(/on folder\(s\) .*"SECRETS"/);
  });
});

// ---------------------------------------------------------------------------
// Gate 9 — an INNER-joined folder's policy is applied.
// ---------------------------------------------------------------------------

describe('policy on an INNER-joined folder (D-115)', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy('RLS Conf bridge guard', [
      {
        targetId: bridgeFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."LABEL" IS NOT NULL',
      },
      // SALES needs its own rule, or both maps below refuse before BRIDGE's
      // rule is even considered: row-level security fails closed (D-090).
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" IS NOT NULL',
      },
    ]);
    await assignPolicy(policyId, userOkId);
  });

  afterAll(async () => {
    await dropPolicy(policyId);
  });

  it('injects the joined folder predicate into the query', async () => {
    const sql = await captureSql(bridgeMapId, userOkId);
    expect(sql).toContain('INNER JOIN');
    expect(sql).toContain('."LABEL" IS NOT NULL');
  });

  it('leaves a map that never touches the joined folder alone', async () => {
    // The plain map reads SALES only. BRIDGE's rule must not reach it.
    const resolved = await resolveSecurityPredicates(
      await loadMapDefinition(plainMapId),
      userOkId,
    );
    expect(resolved.predicates.map((p) => p.folderId)).toEqual([salesFolder.id]);
  });
});

// ---------------------------------------------------------------------------
// Gate 10 — under ROW_LEVEL_FAIL_MODE=OPEN, a policy-bearing folder the user
// cannot resolve still refuses, and the rule is a NO-OP when no policy exists.
// OPEN is the escape hatch for a deployment still writing its policies; it
// must never drop below D-116.
// ---------------------------------------------------------------------------

describe('OPEN mode keeps the per-policy-bearing-folder refusal (D-116)', () => {
  beforeAll(() => {
    config.ROW_LEVEL_FAIL_MODE = 'OPEN';
  });

  afterAll(() => {
    config.ROW_LEVEL_FAIL_MODE = 'CLOSED';
  });

  it('is a no-op against an empty policy table — every map still runs', async () => {
    const rules = await db.select().from(securityPolicyRules);
    expect(rules).toHaveLength(0);

    for (const userId of [userOkId, userNoPolicyId]) {
      const sql = await captureSql(plainMapId, userId);
      expect(sql).toContain('SELECT');
      expect(sql).not.toContain('WHERE');
    }
  });

  it('refuses once a policy exists that the user cannot resolve', async () => {
    const policyId = await createPolicy('RLS Conf sales guard', [
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" = \'EMEA\'',
      },
    ]);
    try {
      await assignPolicy(policyId, userOkId);

      // Covered -> runs, filtered.
      const sql = await captureSql(plainMapId, userOkId);
      expect(sql).toContain('"REGION" = \'EMEA\'');

      // Not covered -> refused BY NAME, and nothing reaches Oracle.
      const { conn, execute } = makeCaptureConn();
      await expect(
        executeMap(plainMapId, {}, userNoPolicyId, {}, realPipelineDeps(conn)),
      ).rejects.toThrow(/on folder\(s\) "SALES"/);
      expect(execute).not.toHaveBeenCalled();
    } finally {
      await dropPolicy(policyId);
    }
  });

  it('ignores rules belonging to an INACTIVE policy', async () => {
    const policyId = await createPolicy('RLS Conf inactive guard', [
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" = \'EMEA\'',
      },
    ]);
    try {
      await db
        .update(securityPolicies)
        .set({ isActive: false })
        .where(eq(securityPolicies.id, policyId));

      // An inactive policy applies to nobody, so treating its folder as
      // policy-bearing would lock everyone out with no way to satisfy it.
      const sql = await captureSql(plainMapId, userNoPolicyId);
      expect(sql).toContain('SELECT');
    } finally {
      await dropPolicy(policyId);
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 12 — row-level security fails CLOSED by default (D-090). A user with no
// policy sees nothing, and no change to a policy can ever widen access.
// ---------------------------------------------------------------------------

describe('row-level security fails closed by default (D-090)', () => {
  it('runs CLOSED unless a deployment says otherwise', () => {
    expect(config.ROW_LEVEL_FAIL_MODE).toBe('CLOSED');
  });

  it('a user with no policy sees NOTHING — even when no policy exists at all', async () => {
    expect(await db.select().from(securityPolicyRules)).toHaveLength(0);

    // Granted the data, assigned nothing. Admins are not exempt.
    for (const userId of [userOkId, userNoPolicyId, adminId]) {
      const { conn, execute } = makeCaptureConn();
      await expect(
        executeMap(plainMapId, {}, userId, {}, realPipelineDeps(conn)),
      ).rejects.toThrow(/no row-level security policy resolves for you on folder\(s\) "SALES"/);
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('removing a policy does not open access', async () => {
    const policyId = await createPolicy('RLS Conf removable', [
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" = \'EMEA\'',
      },
    ]);
    await assignPolicy(policyId, userOkId);
    expect(await captureSql(plainMapId, userOkId)).toContain('"REGION" = \'EMEA\'');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/security/policies/${policyId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);

    // The user it covered and the user it never covered: both still get nothing.
    for (const userId of [userOkId, userNoPolicyId]) {
      const { conn, execute } = makeCaptureConn();
      await expect(
        executeMap(plainMapId, {}, userId, {}, realPipelineDeps(conn)),
      ).rejects.toThrow(/no row-level security policy resolves for you/);
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('disabling a policy does not open access either', async () => {
    const policyId = await createPolicy('RLS Conf disabled', [
      {
        targetId: salesFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" = \'EMEA\'',
      },
    ]);
    try {
      await assignPolicy(policyId, userOkId);
      const res = await app.inject({
        method: 'PUT',
        url: `/api/security/policies/${policyId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(200);

      const { conn, execute } = makeCaptureConn();
      await expect(
        executeMap(plainMapId, {}, userOkId, {}, realPipelineDeps(conn)),
      ).rejects.toThrow(/no row-level security policy resolves for you/);
      expect(execute).not.toHaveBeenCalled();
    } finally {
      await dropPolicy(policyId);
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 13 — a COMPLEX folder carrying a policy refuses, naming both (SEC-06).
// Its SQL is inlined as a derived table, and predicates are ANDed onto the
// query around it, never into the tables that SQL reads.
// ---------------------------------------------------------------------------

describe('a COMPLEX folder carrying a policy refuses (SEC-06)', () => {
  let complexFolder: Folder;
  let complexMapId: string;

  beforeAll(async () => {
    [complexFolder] = (await db
      .insert(folders)
      .values({
        businessAreaId: baId,
        name: 'SALES_SQL',
        folderType: 'COMPLEX',
        customSql: 'SELECT REGION, AMOUNT FROM APP.SALES',
        dataSourceId: salesFolder.dataSourceId,
        createdBy: adminId,
      })
      .returning()) as [Folder];
    const complexRegion = await mkItem(complexFolder, 'Region', {
      columnName: 'REGION',
    });
    complexMapId = await mkMap('RLS Conf Complex', baId, [complexRegion.id]);
  });

  it('refuses, naming the folder and the policy — even for the user it covers', async () => {
    const policyId = await createPolicy('RLS Conf complex guard', [
      {
        targetId: complexFolder.id,
        targetType: 'FOLDER',
        sqlPredicate: '{alias}."REGION" = \'EMEA\'',
      },
    ]);
    try {
      await assignPolicy(policyId, userOkId);
      for (const userId of [userOkId, userNoPolicyId]) {
        const { conn, execute } = makeCaptureConn();
        await expect(
          executeMap(complexMapId, {}, userId, {}, realPipelineDeps(conn)),
        ).rejects.toThrow(
          /COMPLEX folder "SALES_SQL" is covered by row-level security policy "RLS Conf complex guard"/,
        );
        expect(execute).not.toHaveBeenCalled();
      }
    } finally {
      await dropPolicy(policyId);
    }
  });

  it('refuses when a business-area policy reaches it, too', async () => {
    const policyId = await createPolicy('RLS Conf area-wide', [
      { targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: '1 = 1' },
    ]);
    try {
      await assignPolicy(policyId, userOkId);
      await expect(captureSql(complexMapId, userOkId)).rejects.toThrow(
        /COMPLEX folder "SALES_SQL" is covered by row-level security policy "RLS Conf area-wide"/,
      );
    } finally {
      await dropPolicy(policyId);
    }
  });

  it('with no policy it is refused as uncovered, and runs only in OPEN mode', async () => {
    await expect(captureSql(complexMapId, userOkId)).rejects.toThrow(
      /no row-level security policy resolves for you on folder\(s\) "SALES_SQL"/,
    );

    config.ROW_LEVEL_FAIL_MODE = 'OPEN';
    try {
      const sql = await captureSql(complexMapId, userOkId);
      expect(sql).toContain('(SELECT REGION, AMOUNT FROM APP.SALES)');
    } finally {
      config.ROW_LEVEL_FAIL_MODE = 'CLOSED';
    }
  });
});

// ---------------------------------------------------------------------------
// Gate 3 — the DATA gate refuses an owner / public / shared map when the user
// holds no grant on any business area the folders belong to (D-016).
// ---------------------------------------------------------------------------

describe('data entitlement gate (D-016)', () => {
  it('refuses a PUBLIC map to a user with no grant on the folders', async () => {
    const { conn, execute } = makeCaptureConn();
    await expect(
      executeMap(publicMapId, {}, userNoGrantId, {}, realPipelineDeps(conn)),
    ).rejects.toThrow(/do not have access to the data in folder "SALES"/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('refuses a map the user OWNS when the folders are not theirs to read', async () => {
    // The escalation path: owning (or being shared) a map must not confer
    // access to a business area the user was never granted.
    const ownedMapId = await mkMap('RLS Conf Owned', baId, [region.id], {
      createdBy: userNoGrantId,
    });
    const { conn, execute } = makeCaptureConn();
    await expect(
      executeMap(ownedMapId, {}, userNoGrantId, {}, realPipelineDeps(conn)),
    ).rejects.toThrow(/do not have access to the data in folder "SALES"/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('lets a granted user through the same public map, on to row-level security', async () => {
    // Past the data gate, a user with no policy meets row-level security, which
    // fails closed (D-090). A refusal that names policies, not grants, is the
    // proof this user got through.
    await expect(captureSql(publicMapId, userOkId)).rejects.toThrow(
      /no row-level security policy resolves for you/,
    );
  });
});

// ---------------------------------------------------------------------------
// Gate 11 — an export carries the SAME predicates as the on-screen query.
//
// Asserting the predicates, not the rows: an unfiltered export returning the
// same rows as a filtered screen query would pass a row comparison.
// ---------------------------------------------------------------------------

describe('exports carry the same predicates as the screen query (D-016)', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy('RLS Conf export guard', [
      {
        targetId: baId,
        targetType: 'BUSINESS_AREA',
        sqlPredicate: "REGION = 'EMEA'",
      },
    ]);
    await assignPolicy(policyId, userOkId);
  });

  afterAll(async () => {
    await dropPolicy(policyId);
  });

  it('the export path prepares the same WHERE clause', async () => {
    // The export service takes prepareQuery from the execution service; this
    // asserts the wiring AND the resulting predicate, not just that rows match.
    const exportPrepared = await defaultExportDeps().prepareQuery(
      plainMapId,
      {},
      userOkId,
    );
    expect(exportPrepared.sql).toContain("(REGION = 'EMEA')");

    const screenSql = await captureSql(plainMapId, userOkId);
    // Cut at ORDER BY, not just FETCH: this map configures no sort, so the
    // screen path's OFFSET/FETCH pagination picks up BE-06's deterministic
    // `ORDER BY 1` tiebreaker while the export path (unpaginated — it streams
    // every row) does not. That is a real, correct difference in sort
    // clauses, not in the predicates this test is about.
    const whereOf = (sql: string) =>
      sql.slice(sql.indexOf('WHERE')).split(/\bORDER BY\b/)[0]!.trim();
    expect(whereOf(exportPrepared.sql)).toBe(whereOf(screenSql));
  });

  it('the export path refuses the user the screen query refuses', async () => {
    await expect(
      defaultExportDeps().prepareQuery(plainMapId, {}, userNoPolicyId),
    ).rejects.toThrow(MapExecutionError);
    await expect(
      defaultExportDeps().prepareQuery(plainMapId, {}, userNoGrantId),
    ).rejects.toThrow(/do not have access to the data/);
  });

  // Phase 7.3 addition (E-08/D-09): the two tests above assert the WHERE
  // clause `prepareQuery` builds in isolation. These run the SAME assertion
  // through `processExportJob` itself — the code path a real export actually
  // takes — so the proof is about the export, not just the function it
  // happens to reuse.
  function noopExportDeps(over: Partial<ExportJobDeps>): ExportJobDeps {
    return {
      prepareQuery: defaultDeps().prepareQuery,
      getConnection: async () => {
        throw new Error('not stubbed');
      },
      releaseConnection: async () => {},
      createJob: async () => {
        throw new Error('processExportJob does not call createJob');
      },
      updateJob: async () => {},
      getJob: async () => null,
      listJobs: async () => [],
      writeExportFile: async () => ({ rowCount: 0 }),
      enqueue: async () => {},
      ...over,
    };
  }

  it('an entitled user export sends Oracle the same predicate-bearing SQL as the screen query', async () => {
    const { conn, execute } = makeCaptureConn();
    const drained: Record<string, unknown>[] = [];

    await processExportJob(
      { exportJobId: 'rls-export-ok', mapId: plainMapId, format: 'CSV', requestedBy: userOkId },
      noopExportDeps({
        getConnection: async () => conn,
        writeExportFile: async (source) => {
          for await (const batch of source.batches) drained.push(...batch);
          return { rowCount: drained.length };
        },
      }),
    );

    const sentSql = (execute.mock.calls[0] ?? [])[0] as string;
    expect(sentSql).toContain("(REGION = 'EMEA')");
  });

  it('an unentitled user export refuses before any row is streamed to a file', async () => {
    const { conn } = makeCaptureConn();
    const writeExportFile = jest.fn(async () => ({ rowCount: 0 }));

    await expect(
      processExportJob(
        {
          exportJobId: 'rls-export-refused',
          mapId: plainMapId,
          format: 'CSV',
          requestedBy: userNoPolicyId,
        },
        noopExportDeps({ getConnection: async () => conn, writeExportFile }),
      ),
    ).rejects.toThrow(/no row-level security policy resolves for you/);

    expect(writeExportFile).not.toHaveBeenCalled();
  });
});
