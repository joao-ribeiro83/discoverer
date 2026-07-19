import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import type { Connection } from 'oracledb';
import { eq, inArray } from 'drizzle-orm';
import { getApp } from './test-helper.js';
import { db } from '../../db/index.js';
import {
  businessAreas,
  dataSources,
  folders,
  items,
  maps,
  mapItems,
  securityPolicies,
  securityPolicyAssignments,
  securityPolicyRules,
  users,
  type Folder,
  type Item,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import { loadMapDefinition } from '../../services/sql-generator.js';
import {
  defaultDeps,
  executeMap,
  resolveSecurityPredicates,
  type MapExecutionDeps,
} from '../../services/map-execution.service.js';

// ===========================================================================
// Row-level security — end-to-end enforcement integration tests (Session 5.7)
//
// Exercises the real security pipeline against the live Postgres metadata DB:
//   policy created + assigned via the admin API
//     -> real resolveSecurityPredicates + generateSql (defaultDeps.prepareQuery)
//     -> executeMap, with ONLY the Oracle driver layer mocked (fake Connection).
//
// This complements the hermetic security.test.ts by asserting the scenarios the
// task brief calls out explicitly: AND-combination of multiple policies,
// business-area vs folder rule scoping across different maps, the (absence of an)
// admin bypass, per-user predicate divergence, and route-level rejection of an
// injection attempt.
// ===========================================================================

const PW = 'SecurePass123!';
const NS = 'int57-rls';
const ADMIN_EMAIL = `${NS}-admin@test.com`;
const USER_A_EMAIL = `${NS}-user-a@test.com`;
const USER_B_EMAIL = `${NS}-user-b@test.com`;
const POLICY_ADMIN_EMAIL = `${NS}-policy-admin@test.com`;
const BA_NAME = 'Int57 RLS Business Area';
const DS_NAME = 'Int57 RLS Data Source';

let app: FastifyInstance;

let adminId: string;
let userAId: string;
let userBId: string;
let policyAdminId: string;
let adminToken: string;

let baId: string;
let salesFolder: Folder;
let productsFolder: Folder;
let region: Item;
let amount: Item;
let pcode: Item;

// map using the SALES folder; map using the PRODUCTS folder
let salesMapId: string;
let productsMapId: string;

// ---------------------------------------------------------------------------
// Oracle driver fake — captures the SQL/binds the driver actually receives.
// ---------------------------------------------------------------------------

function makeCaptureConn(
  rows: Record<string, unknown>[],
  metaData: Array<{ name: string }>,
): { conn: Connection; execute: jest.Mock } {
  const execute = jest.fn(async () => ({ rows, metaData })) as jest.Mock;
  const raw: Record<string, unknown> = {
    callTimeout: undefined,
    execute,
    break: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
  return { conn: raw as unknown as Connection, execute };
}

/** Production prepareQuery (real RLS resolution) with only the driver stubbed. */
function realPipelineDeps(conn: Connection): MapExecutionDeps {
  return {
    prepareQuery: defaultDeps().prepareQuery,
    getConnection: async () => conn,
    releaseConnection: async () => {},
    recordExecution: async () => {},
  };
}

async function runAndCaptureSql(
  mapId: string,
  userId: string,
  rows: Record<string, unknown>[],
  metaData: Array<{ name: string }>,
): Promise<{ sql: string; binds: Record<string, unknown> }> {
  const { conn, execute } = makeCaptureConn(rows, metaData);
  await executeMap(mapId, {}, userId, {}, realPipelineDeps(conn));
  const call = (execute.mock.calls[0] ?? []) as [string, Record<string, unknown>];
  return { sql: call[0] ?? '', binds: call[1] ?? {} };
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

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

async function createPolicy(payload: {
  name: string;
  rules: Array<{
    targetId: string;
    targetType: 'BUSINESS_AREA' | 'FOLDER';
    sqlPredicate: string;
  }>;
}): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/security/policies',
    headers: authHeaders(adminToken),
    payload,
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
    headers: authHeaders(adminToken),
    payload: { userId },
  });
  if (res.statusCode !== 201) {
    throw new Error(`assignment failed (${res.statusCode}): ${res.body}`);
  }
}

async function cleanup(): Promise<void> {
  const emails = [ADMIN_EMAIL, USER_A_EMAIL, USER_B_EMAIL, POLICY_ADMIN_EMAIL];
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));
  const userIds = existing.map((u) => u.id);

  // Policies (rules + assignments cascade off the policy delete in the service,
  // but delete children explicitly here since we go straight to the table).
  const baRows = await db
    .select({ id: businessAreas.id })
    .from(businessAreas)
    .where(eq(businessAreas.name, BA_NAME));
  const baIds = baRows.map((b) => b.id);
  if (baIds.length) {
    const policyRows = await db
      .select({ id: securityPolicyRules.policyId })
      .from(securityPolicyRules)
      .where(inArray(securityPolicyRules.targetId, baIds));
    const folderRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(inArray(folders.businessAreaId, baIds));
    const folderIds = folderRows.map((f) => f.id);
    const targetIds = [...baIds, ...folderIds];
    const ruleMatch = targetIds.length
      ? await db
          .select({ policyId: securityPolicyRules.policyId })
          .from(securityPolicyRules)
          .where(inArray(securityPolicyRules.targetId, targetIds))
      : [];
    const policyIds = [
      ...new Set([...policyRows.map((p) => p.id), ...ruleMatch.map((r) => r.policyId)]),
    ];
    if (policyIds.length) {
      await db
        .delete(securityPolicyAssignments)
        .where(inArray(securityPolicyAssignments.policyId, policyIds));
      await db
        .delete(securityPolicyRules)
        .where(inArray(securityPolicyRules.policyId, policyIds));
      await db.delete(securityPolicies).where(inArray(securityPolicies.id, policyIds));
    }
    if (folderIds.length) {
      await db.delete(mapItems).where(
        inArray(
          mapItems.itemId,
          (
            await db
              .select({ id: items.id })
              .from(items)
              .where(inArray(items.folderId, folderIds))
          ).map((i) => i.id),
        ),
      );
      await db.delete(items).where(inArray(items.folderId, folderIds));
    }
    await db.delete(maps).where(inArray(maps.businessAreaId, baIds));
    await db.delete(folders).where(inArray(folders.businessAreaId, baIds));
    await db.delete(businessAreas).where(inArray(businessAreas.id, baIds));
  }
  if (userIds.length) {
    await db
      .delete(securityPolicyAssignments)
      .where(inArray(securityPolicyAssignments.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await db.delete(dataSources).where(eq(dataSources.name, DS_NAME));
}

beforeAll(async () => {
  app = await getApp();
  await cleanup();

  adminId = (await createUser(ADMIN_EMAIL, 'ADMIN')).id;
  userAId = (await createUser(USER_A_EMAIL, 'USER')).id;
  userBId = (await createUser(USER_B_EMAIL, 'USER')).id;
  policyAdminId = (await createUser(POLICY_ADMIN_EMAIL, 'ADMIN')).id;
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

  [salesFolder] = (await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'SALES',
      folderType: 'TABLE',
      tableName: 'SALES',
      tableOwner: 'APP',
      dataSourceId: ds!.id,
      createdBy: adminId,
    })
    .returning()) as [Folder];

  [productsFolder] = (await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'PRODUCTS',
      folderType: 'TABLE',
      tableName: 'PRODUCTS',
      tableOwner: 'APP',
      dataSourceId: ds!.id,
      createdBy: adminId,
    })
    .returning()) as [Folder];

  [region] = (await db
    .insert(items)
    .values({
      folderId: salesFolder.id,
      name: 'Region',
      itemType: 'CI',
      columnName: 'REGION',
      createdBy: adminId,
    })
    .returning()) as [Item];
  [amount] = (await db
    .insert(items)
    .values({
      folderId: salesFolder.id,
      name: 'Amount',
      itemType: 'CI',
      columnName: 'AMOUNT',
      dataType: 'NUMBER',
      createdBy: adminId,
    })
    .returning()) as [Item];
  [pcode] = (await db
    .insert(items)
    .values({
      folderId: productsFolder.id,
      name: 'Product Code',
      itemType: 'CI',
      columnName: 'PCODE',
      createdBy: adminId,
    })
    .returning()) as [Item];

  const [salesMap] = await db
    .insert(maps)
    .values({ name: 'Int57 Sales Map', mapType: 'TABLE', businessAreaId: baId, createdBy: adminId })
    .returning();
  salesMapId = salesMap!.id;
  await db.insert(mapItems).values([
    { mapId: salesMapId, itemId: region.id, displayOrder: 0 },
    { mapId: salesMapId, itemId: amount.id, displayOrder: 1 },
  ]);

  const [productsMap] = await db
    .insert(maps)
    .values({ name: 'Int57 Products Map', mapType: 'TABLE', businessAreaId: baId, createdBy: adminId })
    .returning();
  productsMapId = productsMap!.id;
  await db.insert(mapItems).values([{ mapId: productsMapId, itemId: pcode.id, displayOrder: 0 }]);
}, 60_000);

afterAll(async () => {
  await cleanup();
});

const SALES_META = [{ name: 'REGION' }, { name: 'AMOUNT' }];
const PRODUCTS_META = [{ name: 'PCODE' }];

// ---------------------------------------------------------------------------
// 1. A single business-area policy reaches the executed SQL for the assigned
//    user, and no predicate reaches an unassigned user's SQL.
// ---------------------------------------------------------------------------

describe('business-area policy — assigned vs unassigned user', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy({
      name: 'Int57 EMEA only',
      rules: [
        { targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: "REGION = 'EMEA'" },
      ],
    });
    await assignPolicy(policyId, userAId);
  });

  afterAll(async () => {
    await db.delete(securityPolicyAssignments).where(eq(securityPolicyAssignments.policyId, policyId));
    await db.delete(securityPolicyRules).where(eq(securityPolicyRules.policyId, policyId));
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });

  it('injects the predicate for the assigned user (user A)', async () => {
    const forA = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), userAId);
    expect(forA.predicates).toHaveLength(1);

    const { sql } = await runAndCaptureSql(
      salesMapId,
      userAId,
      [{ REGION: 'EMEA', AMOUNT: 1 }],
      SALES_META,
    );
    expect(sql).toContain("(REGION = 'EMEA')");
  });

  it('injects nothing for the unassigned user (user B)', async () => {
    const forB = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), userBId);
    expect(forB.predicates).toHaveLength(0);

    const { sql } = await runAndCaptureSql(
      salesMapId,
      userBId,
      [{ REGION: 'AMER', AMOUNT: 2 }],
      SALES_META,
    );
    expect(sql).not.toContain("REGION = 'EMEA'");
  });

  it('applies the BA policy to EVERY map in that business area (products map too)', async () => {
    // The products map does not read the SALES folder at all, yet the
    // business-area-scoped rule still applies because it matches the map's BA.
    const { sql } = await runAndCaptureSql(
      productsMapId,
      userAId,
      [{ PCODE: 'X' }],
      PRODUCTS_META,
    );
    expect(sql).toContain("(REGION = 'EMEA')");
    expect(sql).toContain('"PRODUCTS"');
  });
});

// ---------------------------------------------------------------------------
// 2. Folder-scoped policy only reaches queries that read that folder.
// ---------------------------------------------------------------------------

describe('folder-scoped policy — only maps that use the folder', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy({
      name: 'Int57 sales-folder guard',
      rules: [
        {
          targetId: salesFolder.id,
          targetType: 'FOLDER',
          sqlPredicate: '{alias}."AMOUNT" >= 0',
        },
      ],
    });
    await assignPolicy(policyId, userAId);
  });

  afterAll(async () => {
    await db.delete(securityPolicyAssignments).where(eq(securityPolicyAssignments.policyId, policyId));
    await db.delete(securityPolicyRules).where(eq(securityPolicyRules.policyId, policyId));
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });

  it('applies to the sales map (which reads the SALES folder)', async () => {
    const { sql } = await runAndCaptureSql(
      salesMapId,
      userAId,
      [{ REGION: 'EMEA', AMOUNT: 1 }],
      SALES_META,
    );
    // {alias} is resolved to the folder's query alias (f1) by the generator.
    expect(sql).toContain('."AMOUNT" >= 0');
    expect(sql).not.toContain('{alias}');
  });

  it('does NOT apply to the products map (which never reads the SALES folder)', async () => {
    const forProducts = await resolveSecurityPredicates(
      await loadMapDefinition(productsMapId),
      userAId,
    );
    expect(forProducts.predicates).toHaveLength(0);

    const { sql } = await runAndCaptureSql(
      productsMapId,
      userAId,
      [{ PCODE: 'X' }],
      PRODUCTS_META,
    );
    expect(sql).not.toContain('AMOUNT');
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple policies assigned to one user are AND-combined in the WHERE.
// ---------------------------------------------------------------------------

describe('multiple policies for one user — AND-combined', () => {
  let policy1: string;
  let policy2: string;

  beforeAll(async () => {
    policy1 = await createPolicy({
      name: 'Int57 combo region',
      rules: [{ targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: "REGION = 'EMEA'" }],
    });
    policy2 = await createPolicy({
      name: 'Int57 combo amount',
      rules: [{ targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: 'AMOUNT > 100' }],
    });
    await assignPolicy(policy1, userAId);
    await assignPolicy(policy2, userAId);
  });

  afterAll(async () => {
    for (const p of [policy1, policy2]) {
      await db.delete(securityPolicyAssignments).where(eq(securityPolicyAssignments.policyId, p));
      await db.delete(securityPolicyRules).where(eq(securityPolicyRules.policyId, p));
      await db.delete(securityPolicies).where(eq(securityPolicies.id, p));
    }
  });

  it('emits both predicates, each parenthesised and ANDed together', async () => {
    const resolved = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), userAId);
    expect(resolved.predicates).toHaveLength(2);

    const { sql } = await runAndCaptureSql(
      salesMapId,
      userAId,
      [{ REGION: 'EMEA', AMOUNT: 200 }],
      SALES_META,
    );
    expect(sql).toContain("(REGION = 'EMEA')");
    expect(sql).toContain('(AMOUNT > 100)');
    // Both live in the same WHERE clause, joined by AND.
    const whereIdx = sql.indexOf('WHERE');
    expect(whereIdx).toBeGreaterThan(-1);
    const where = sql.slice(whereIdx);
    expect(where).toMatch(/AND/);
  });
});

// ---------------------------------------------------------------------------
// 4. Context binds: :current_user_id resolves from the EXECUTING user's row.
// ---------------------------------------------------------------------------

describe('context binds resolve from the executing user, not the request', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy({
      name: 'Int57 owner rows',
      rules: [
        { targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: 'CREATED_BY = :current_user_id' },
      ],
    });
    await assignPolicy(policyId, userAId);
    await assignPolicy(policyId, userBId);
  });

  afterAll(async () => {
    await db.delete(securityPolicyAssignments).where(eq(securityPolicyAssignments.policyId, policyId));
    await db.delete(securityPolicyRules).where(eq(securityPolicyRules.policyId, policyId));
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });

  it('binds each executing user their own id', async () => {
    const forA = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), userAId);
    expect(forA.bindParams.current_user_id).toBe(userAId);

    const forB = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), userBId);
    expect(forB.bindParams.current_user_id).toBe(userBId);
    expect(forA.bindParams.current_user_id).not.toBe(forB.bindParams.current_user_id);
  });
});

// ---------------------------------------------------------------------------
// 5. Admin bypass — the current code has NONE. An admin with an assigned policy
//    is subject to it exactly like any other user. This test pins that
//    behaviour so a future intentional "admin exemption" change is a conscious
//    decision, not a silent regression.
// ---------------------------------------------------------------------------

describe('admin users are NOT exempt from assigned row-level policies', () => {
  let policyId: string;

  beforeAll(async () => {
    policyId = await createPolicy({
      name: 'Int57 admin-scoped',
      rules: [{ targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: "REGION = 'APAC'" }],
    });
    await assignPolicy(policyId, policyAdminId);
  });

  afterAll(async () => {
    await db.delete(securityPolicyAssignments).where(eq(securityPolicyAssignments.policyId, policyId));
    await db.delete(securityPolicyRules).where(eq(securityPolicyRules.policyId, policyId));
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });

  it('still resolves and injects the predicate for an ADMIN executing user', async () => {
    const resolved = await resolveSecurityPredicates(
      await loadMapDefinition(salesMapId),
      policyAdminId,
    );
    expect(resolved.predicates).toHaveLength(1);

    const { sql } = await runAndCaptureSql(
      salesMapId,
      policyAdminId,
      [{ REGION: 'APAC', AMOUNT: 1 }],
      SALES_META,
    );
    expect(sql).toContain("(REGION = 'APAC')");
  });

  it('an admin WITHOUT an assigned policy gets no predicate', async () => {
    const resolved = await resolveSecurityPredicates(await loadMapDefinition(salesMapId), adminId);
    expect(resolved.predicates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Injection attempts are rejected by validatePredicate at the route (400).
// ---------------------------------------------------------------------------

describe('route rejects malicious predicates with 400 (not 500 / silent accept)', () => {
  const attacks = [
    '1=1; DROP TABLE users',
    "REGION = 'EMEA' -- comment",
    'DELETE FROM SALES',
    'REGION = :evil_bind',
    "REGION = 'unterminated",
    'DBMS_LOCK.SLEEP(10) = 1',
  ];

  for (const sqlPredicate of attacks) {
    it(`rejects: ${sqlPredicate.slice(0, 32)}`, async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/policies',
        headers: authHeaders(adminToken),
        payload: {
          name: 'Int57 malicious',
          rules: [{ targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate }],
        },
      });
      expect(res.statusCode).toBe(400);
    });
  }

  it('rejects {alias} in a business-area rule (alias only legal for FOLDER rules)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Int57 bad alias',
        rules: [
          { targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate: '{alias}."REGION" = \'EMEA\'' },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
