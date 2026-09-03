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
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import {
  businessAreas,
  dataSources,
  folders,
  items,
  mapConditions,
  mapItems,
  maps,
  queryExecutionLog,
  securityPolicies,
  securityPolicyAssignments,
  securityPolicyRules,
  users,
  type Folder,
  type Item,
  type Map,
  type MapCondition,
  type MapItem,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import {
  previewSecuredSql,
  stripStringLiterals,
  validatePredicate,
} from '../lib/sql/security-predicates.js';
import { generateSql, loadMapDefinition } from '../services/sql-generator.js';
import {
  defaultDeps,
  executeMap,
  resolveSecurityPredicates,
  MapExecutionError,
  type MapExecutionDeps,
} from '../services/map-execution.service.js';
import { getUserPolicies } from '../services/security.service.js';
import { SqlGenerationError, type MapDefinition } from '../types/sql.js';

// ---------------------------------------------------------------------------
// Pure fixture factories (same pattern as sql-generator.test.ts)
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-01T00:00:00Z');
let idCounter = 0;
const uid = () =>
  `00000000-0000-4000-9000-${String(++idCounter).padStart(12, '0')}`;

const BA_ID = '33333333-3333-4333-8333-333333333333';
const FIXTURE_USER_ID = '44444444-4444-4444-8444-444444444444';

function mkFolder(overrides: Partial<Folder> & { name: string }): Folder {
  return {
    id: uid(),
    businessAreaId: BA_ID,
    description: null,
    folderType: 'TABLE',
    tableName: overrides.name,
    tableOwner: 'APP',
    customSql: null,
    dataSourceId: null,
    displayOrder: 0,
    isActive: true,
    createdBy: FIXTURE_USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkItem(
  folder: Folder,
  overrides: Partial<Item> & { name: string },
): Item {
  return {
    id: uid(),
    folderId: folder.id,
    description: null,
    itemType: 'CI',
    columnName: overrides.name.toUpperCase().replace(/\s+/g, '_'),
    formula: null,
    dataType: 'VARCHAR2',
    formatMask: null,
    aggFunction: null,
    displayOrder: 0,
    isHidden: false,
    isActive: true,
    parentItemId: null,
    createdBy: FIXTURE_USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkMap(overrides: Partial<Map> = {}): Map {
  return {
    id: uid(),
    name: 'Security Test Map',
    description: null,
    mapType: 'TABLE',
    businessAreaId: BA_ID,
    createdBy: FIXTURE_USER_ID,
    isPublic: false,
    isActive: true,
    selectDistinct: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function mkMapItem(item: Item, overrides: Partial<MapItem> = {}): MapItem {
  return {
    id: uid(),
    mapId: 'unused',
    itemId: item.id,
    displayOrder: 0,
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

function mkCondition(
  item: Item,
  overrides: Partial<MapCondition> = {},
): MapCondition {
  return {
    id: uid(),
    mapId: 'unused',
    itemId: item.id,
    operator: '=',
    value: null,
    paramName: null,
    conditionType: 'STATIC',
    groupId: null,
    logicOperator: 'AND',
    displayOrder: 0,
    createdAt: NOW,
    ...overrides,
  };
}

/** SALES folder with REGION + AMOUNT, no conditions unless supplied. */
function salesDef(overrides: Partial<MapDefinition> = {}): {
  def: MapDefinition;
  sales: Folder;
  region: Item;
  amount: Item;
} {
  const sales = mkFolder({ name: 'SALES' });
  const region = mkItem(sales, { name: 'Region', columnName: 'REGION' });
  const amount = mkItem(sales, {
    name: 'Amount',
    columnName: 'AMOUNT',
    dataType: 'NUMBER',
  });
  const def: MapDefinition = {
    map: mkMap(),
    items: [
      { mapItem: mkMapItem(region, { displayOrder: 0 }), item: region, folder: sales },
      { mapItem: mkMapItem(amount, { displayOrder: 1 }), item: amount, folder: sales },
    ],
    conditions: [],
    parameters: [],
    calculatedFields: [],
    joins: [],
    formulaItems: [
      { item: region, folder: sales },
      { item: amount, folder: sales },
    ],
    ...overrides,
  };
  return { def, sales, region, amount };
}

// ---------------------------------------------------------------------------
// 1. validatePredicate
// ---------------------------------------------------------------------------

describe('validatePredicate', () => {
  const valid = [
    "REGION = 'EMEA'",
    'AMOUNT > 1000',
    "STATUS IN ('OPEN', 'PENDING')",
    'SALES_REP_ID = :current_user_id',
    "UPPER(OWNER_EMAIL) = UPPER(:current_user_email)",
    "DEPT_ID IN (SELECT DEPT_ID FROM USER_DEPTS WHERE USER_NAME = :current_user_email)",
    "EXISTS (SELECT 1 FROM REGION_ACCESS RA WHERE RA.REGION = REGION AND RA.USER_ID = :current_user_id)",
    "NAME = 'O''Brien'",
  ];
  for (const predicate of valid) {
    it(`accepts: ${predicate}`, () => {
      expect(validatePredicate(predicate)).toEqual({ valid: true });
    });
  }

  it('accepts {alias} only when allowed (FOLDER-targeted rules)', () => {
    const predicate = '{alias}."REGION" = \'EMEA\'';
    expect(validatePredicate(predicate, { allowAliasToken: true })).toEqual({
      valid: true,
    });
    expect(validatePredicate(predicate).valid).toBe(false);
  });

  const invalid: Array<[string, string | RegExp]> = [
    ['', /empty/i],
    ['   ', /empty/i],
    ["1=1; DROP TABLE users", /not allowed|separator/i],
    ["REGION = 'EMEA' -- comment", /comment/i],
    ["REGION = 'EMEA' /* hidden */", /comment/i],
    ["REGION = 'EMEA", /unterminated/i],
    ['DELETE FROM SALES', /DELETE/i],
    ["1=1 UNION SELECT * INTO X FROM Y", /INTO/i],
    ['ID IN (SELECT ID FROM T FOR UPDATE)', /UPDATE/i],
    ['DBMS_LOCK.SLEEP(10) = 1', /DBMS/i],
    ['UTL_HTTP.REQUEST(URL) IS NOT NULL', /UTL/i],
    ["REGION = q'[EMEA]'", /alternative quoting/i],
    ['SALES_REP = :my_custom_bind', /unknown bind/i],
    ['AND AND AND', /not a valid/i],
    ['x '.repeat(2500), /exceeds/i],
  ];
  for (const [predicate, errorPattern] of invalid) {
    it(`rejects: ${predicate.slice(0, 50) || '(empty)'}`, () => {
      const result = validatePredicate(predicate);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(errorPattern);
    });
  }

  it('is not fooled by forbidden keywords inside string literals', () => {
    expect(validatePredicate("ACTION = 'DELETE'").valid).toBe(true);
    expect(validatePredicate("NOTE = 'a; b'").valid).toBe(true);
  });

  it('does not flag column names that merely contain a keyword', () => {
    expect(validatePredicate('CREATED_BY = :current_user_id').valid).toBe(true);
    expect(validatePredicate('UPDATED_AT IS NOT NULL').valid).toBe(true);
  });
});

describe('stripStringLiterals', () => {
  it('blanks literal contents and preserves positions', () => {
    expect(stripStringLiterals("A = 'xy'")).toBe("A = '  '");
  });
  it('handles doubled-quote escapes', () => {
    expect(stripStringLiterals("A = 'x''y'")).toBe("A = '    '");
  });
  it('returns null on an unterminated literal', () => {
    expect(stripStringLiterals("A = 'x")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. previewSecuredSql (admin test-endpoint preview)
// ---------------------------------------------------------------------------

describe('previewSecuredSql', () => {
  it('adds a WHERE clause to a query without one', () => {
    const out = previewSecuredSql('SELECT * FROM SALES', ["REGION = 'EMEA'"]);
    expect(out).toBe("SELECT * FROM SALES\nWHERE (REGION = 'EMEA')");
  });

  it('ANDs into an existing WHERE, parenthesizing the original condition', () => {
    const out = previewSecuredSql(
      "SELECT * FROM SALES WHERE STATUS = 'OPEN' OR STATUS = 'HELD'",
      ["REGION = 'EMEA'"],
    );
    expect(out).toBe(
      "SELECT * FROM SALES WHERE (STATUS = 'OPEN' OR STATUS = 'HELD') AND (REGION = 'EMEA')",
    );
  });

  it('puts the predicate in WHERE, not HAVING, for GROUP BY queries', () => {
    const out = previewSecuredSql(
      'SELECT REGION, SUM(AMOUNT) FROM SALES GROUP BY REGION HAVING SUM(AMOUNT) > 10',
      ["REGION = 'EMEA'"],
    );
    expect(out).toBe(
      "SELECT REGION, SUM(AMOUNT) FROM SALES\nWHERE (REGION = 'EMEA')\nGROUP BY REGION HAVING SUM(AMOUNT) > 10",
    );
  });

  it('ANDs multiple predicates together', () => {
    const out = previewSecuredSql('SELECT * FROM SALES', [
      "REGION = 'EMEA'",
      'AMOUNT > 0',
    ]);
    expect(out).toBe(
      "SELECT * FROM SALES\nWHERE (REGION = 'EMEA') AND (AMOUNT > 0)",
    );
  });

  it('ignores a WHERE inside a subquery when placing the clause', () => {
    const out = previewSecuredSql(
      'SELECT * FROM (SELECT * FROM SALES WHERE X = 1) S ORDER BY 1',
      ['Y = 2'],
    );
    expect(out).toBe(
      'SELECT * FROM (SELECT * FROM SALES WHERE X = 1) S\nWHERE (Y = 2)\nORDER BY 1',
    );
  });

  it("is not fooled by the word WHERE inside a string literal", () => {
    const out = previewSecuredSql(
      "SELECT 'WHERE' AS W FROM SALES",
      ['Y = 2'],
    );
    expect(out).toBe("SELECT 'WHERE' AS W FROM SALES\nWHERE (Y = 2)");
  });

  it('rejects top-level set operations', () => {
    expect(() =>
      previewSecuredSql('SELECT A FROM T UNION SELECT B FROM U', ['X = 1']),
    ).toThrow(SqlGenerationError);
  });

  it('returns the query unchanged when there are no predicates', () => {
    expect(previewSecuredSql('SELECT * FROM SALES;', [])).toBe(
      'SELECT * FROM SALES',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Generator-level predicate injection (the real enforcement path)
// ---------------------------------------------------------------------------

describe('generateSql securityPredicates injection', () => {
  it('creates a WHERE clause when the map has no conditions', () => {
    const { def } = salesDef();
    const { sql } = generateSql(def, {
      securityPredicates: [{ sql: "f1.\"REGION\" = 'EMEA'" }],
    });
    expect(sql).toContain('WHERE (f1."REGION" = \'EMEA\')');
  });

  it('ANDs the predicate with existing conditions', () => {
    const { def, sales, region } = salesDef();
    def.conditions = [
      {
        condition: mkCondition(region, { value: 'WEST' }),
        item: region,
        folder: sales,
      },
    ];
    const { sql, bindParams } = generateSql(def, {
      securityPredicates: [{ sql: "f1.\"REGION\" != 'RESTRICTED'" }],
    });
    expect(sql).toContain('f1."REGION" = :c0');
    expect(sql).toContain('AND (f1."REGION" != \'RESTRICTED\')');
    expect(bindParams.c0).toBe('WEST');
  });

  it('keeps predicates in WHERE (not HAVING) when the query has GROUP BY', () => {
    const { def, sales, region, amount } = salesDef();
    def.items = [
      { mapItem: mkMapItem(region, { displayOrder: 0 }), item: region, folder: sales },
      {
        mapItem: mkMapItem(amount, { displayOrder: 1, aggFunction: 'SUM' }),
        item: amount,
        folder: sales,
      },
    ];
    const { sql } = generateSql(def, {
      securityPredicates: [{ sql: "f1.\"REGION\" = 'EMEA'" }],
    });
    expect(sql).toMatch(/GROUP BY/);
    expect(sql).not.toMatch(/HAVING/);
    expect(sql.indexOf("WHERE (f1.\"REGION\" = 'EMEA')")).toBeGreaterThan(-1);
    expect(sql.indexOf('WHERE')).toBeLessThan(sql.indexOf('GROUP BY'));
  });

  it('ANDs multiple predicates, each in its own parens', () => {
    const { def } = salesDef();
    const { sql } = generateSql(def, {
      securityPredicates: [
        { sql: "f1.\"REGION\" = 'EMEA'" },
        { sql: 'f1."AMOUNT" > 0' },
      ],
    });
    expect(sql).toContain(
      'WHERE (f1."REGION" = \'EMEA\')\n  AND (f1."AMOUNT" > 0)',
    );
  });

  it('substitutes {alias} with the target folder alias', () => {
    const { def, sales } = salesDef();
    const { sql } = generateSql(def, {
      securityPredicates: [
        { sql: '{alias}."REGION" = \'EMEA\'', folderId: sales.id },
      ],
    });
    expect(sql).toContain('(f1."REGION" = \'EMEA\')');
    expect(sql).not.toContain('{alias}');
  });

  it('throws when {alias} is used without a folder target', () => {
    const { def } = salesDef();
    expect(() =>
      generateSql(def, {
        securityPredicates: [{ sql: '{alias}."REGION" = \'EMEA\'' }],
      }),
    ).toThrow(SqlGenerationError);
  });

  it('adds referenced context binds and omits unreferenced ones', () => {
    const { def } = salesDef();
    const { sql, bindParams } = generateSql(def, {
      securityPredicates: [{ sql: 'f1."REP_ID" = :current_user_id' }],
      securityBindParams: {
        current_user_id: 'user-123',
        current_user_email: 'a@b.c',
        current_user_role: 'USER',
      },
    });
    expect(sql).toContain('(f1."REP_ID" = :current_user_id)');
    expect(bindParams.current_user_id).toBe('user-123');
    expect(bindParams).not.toHaveProperty('current_user_email');
    expect(bindParams).not.toHaveProperty('current_user_role');
  });

  it('fails closed when a referenced bind has no supplied value', () => {
    const { def } = salesDef();
    expect(() =>
      generateSql(def, {
        securityPredicates: [{ sql: 'f1."REP_ID" = :current_user_id' }],
      }),
    ).toThrow(/no value was supplied/);
  });

  it('still accepts plain-string predicates (legacy shorthand)', () => {
    const { def } = salesDef();
    const { sql } = generateSql(def, {
      securityPredicates: ["f1.\"REGION\" = 'EMEA'"],
    });
    expect(sql).toContain('WHERE (f1."REGION" = \'EMEA\')');
  });

  it('still rejects predicates containing statement separators', () => {
    const { def } = salesDef();
    expect(() =>
      generateSql(def, {
        securityPredicates: ['1=1; DROP TABLE x'],
      }),
    ).toThrow(SqlGenerationError);
  });
});

// ---------------------------------------------------------------------------
// Shared route/DB test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const ADMIN_EMAIL = 'security-admin@example.com';
const USER_A_EMAIL = 'security-user-a@example.com';
const USER_B_EMAIL = 'security-user-b@example.com';
const MANAGER_EMAIL = 'security-manager@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken: string;
let userAToken: string;

let adminId: string;
let userAId: string;
let userBId: string;
let managerId: string;

let baId: string;
let salesFolderId: string;
let regionItemId: string;
let amountItemId: string;
let mapId: string;

async function createTestUser(
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Security Test User', role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  return res.json().data.token as string;
}

async function cleanupTestData() {
  await db.delete(securityPolicyAssignments);
  await db.delete(securityPolicyRules);
  await db.delete(securityPolicies);
  await db.delete(queryExecutionLog);
  await db.delete(mapConditions);
  await db.delete(mapItems);
  await db.delete(maps);
  await db.delete(items);
  await db.delete(folders);
  await db
    .delete(businessAreas)
    .where(eq(businessAreas.name, 'Security Test BA'));
  await db.delete(dataSources).where(eq(dataSources.name, 'Security Test DS'));
  for (const email of [
    ADMIN_EMAIL,
    USER_A_EMAIL,
    USER_B_EMAIL,
    MANAGER_EMAIL,
  ]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanupTestData();

  const admin = await createTestUser(ADMIN_EMAIL, 'ADMIN');
  const userA = await createTestUser(USER_A_EMAIL, 'USER');
  const userB = await createTestUser(USER_B_EMAIL, 'USER');
  const manager = await createTestUser(MANAGER_EMAIL, 'MANAGER');
  adminId = admin.id;
  userAId = userA.id;
  userBId = userB.id;
  managerId = manager.id;

  adminToken = await login(ADMIN_EMAIL);
  userAToken = await login(USER_A_EMAIL);

  const [ds] = await db
    .insert(dataSources)
    .values({ name: 'Security Test DS', connectionType: 'oracle' })
    .returning();

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: 'Security Test BA', description: 'BA for security tests' })
    .returning();
  baId = ba!.id;

  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'SALES',
      folderType: 'TABLE',
      tableName: 'SALES',
      dataSourceId: ds!.id,
      displayOrder: 0,
    })
    .returning();
  salesFolderId = folder!.id;

  const [regionItem] = await db
    .insert(items)
    .values({
      folderId: salesFolderId,
      name: 'Region',
      itemType: 'CI',
      columnName: 'REGION',
      displayOrder: 0,
    })
    .returning();
  regionItemId = regionItem!.id;

  const [amountItem] = await db
    .insert(items)
    .values({
      folderId: salesFolderId,
      name: 'Amount',
      itemType: 'CI',
      columnName: 'AMOUNT',
      dataType: 'NUMBER',
      displayOrder: 1,
    })
    .returning();
  amountItemId = amountItem!.id;

  const [map] = await db
    .insert(maps)
    .values({
      name: 'Security Test Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: adminId,
    })
    .returning();
  mapId = map!.id;

  await db.insert(mapItems).values([
    { mapId, itemId: regionItemId, displayOrder: 0 },
    { mapId, itemId: amountItemId, displayOrder: 1 },
  ]);
}, 60_000);

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// 4. Policy CRUD routes
// ---------------------------------------------------------------------------

describe('security policy routes', () => {
  let policyId: string;

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/security/policies',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/security/policies',
      headers: authHeaders(userAToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('creates a policy with rules', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'EMEA only',
        description: 'Restrict to EMEA rows',
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: "REGION = 'EMEA'",
          },
          {
            targetId: salesFolderId,
            targetType: 'FOLDER',
            sqlPredicate: '{alias}."AMOUNT" >= 0',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.name).toBe('EMEA only');
    expect(body.policyType).toBe('ROW_LEVEL');
    expect(body.isActive).toBe(true);
    expect(body.rules).toHaveLength(2);
    policyId = body.id;
  });

  it('rejects a policy whose rule predicate is malicious', async () => {
    const cases = [
      '1=1; DROP TABLE users',
      "REGION = 'EMEA' -- sneak",
      'DELETE FROM SALES',
      'SALES_REP = :evil_bind',
      "REGION = 'unterminated",
    ];
    for (const sqlPredicate of cases) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/security/policies',
        headers: authHeaders(adminToken),
        payload: {
          name: 'Bad policy',
          rules: [
            { targetId: baId, targetType: 'BUSINESS_AREA', sqlPredicate },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('rejects {alias} in a business-area rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Bad alias policy',
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: '{alias}."REGION" = \'EMEA\'',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/alias/i);
  });

  it('rejects a policy without rules', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: { name: 'No rules', rules: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('lists policies with counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    const policy = list.find((p: { id: string }) => p.id === policyId);
    expect(policy).toBeDefined();
    expect(policy.ruleCount).toBe(2);
    expect(policy.assignmentCount).toBe(0);
  });

  it('gets one policy with its rules', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/security/policies/${policyId}`,
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.rules).toHaveLength(2);
  });

  it('updates a policy and replaces its rules', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/security/policies/${policyId}`,
      headers: authHeaders(adminToken),
      payload: {
        name: 'EMEA only (updated)',
        isActive: false,
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: "REGION = 'APAC'",
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.name).toBe('EMEA only (updated)');
    expect(body.isActive).toBe(false);
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].sqlPredicate).toBe("REGION = 'APAC'");
  });

  it('rejects an update introducing an invalid predicate', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/security/policies/${policyId}`,
      headers: authHeaders(adminToken),
      payload: {
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: 'TRUNCATE TABLE SALES',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s on a missing policy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/security/policies/00000000-0000-4000-8000-000000000099',
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a policy (rules cascade)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/security/policies/${policyId}`,
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const rules = await db
      .select()
      .from(securityPolicyRules)
      .where(eq(securityPolicyRules.policyId, policyId));
    expect(rules).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Assignment routes
// ---------------------------------------------------------------------------

describe('assignment routes', () => {
  let policyId: string;
  let userAssignmentId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Assignment test policy',
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: "REGION = 'EMEA'",
          },
        ],
      },
    });
    policyId = res.json().data.id;
  });

  it('assigns a policy to a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { userId: userAId },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.userId).toBe(userAId);
    expect(body.roleName).toBeNull();
    userAssignmentId = body.id;
  });

  it('assigns a policy to a role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { roleName: 'MANAGER' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.roleName).toBe('MANAGER');
  });

  it('rejects duplicate assignments', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { userId: userAId },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects both-or-neither of userId/roleName', async () => {
    for (const payload of [{}, { userId: userAId, roleName: 'USER' }]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/security/policies/${policyId}/assignments`,
        headers: authHeaders(adminToken),
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('404s when assigning to a missing user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { userId: '00000000-0000-4000-8000-000000000098' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists assignments with resolved user info', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data;
    expect(list).toHaveLength(2);
    const userAssignment = list.find(
      (a: { userId: string | null }) => a.userId === userAId,
    );
    expect(userAssignment.userEmail).toBe(USER_A_EMAIL);
  });

  it('applies user- and role-assigned policies via getUserPolicies', async () => {
    const forUserA = await getUserPolicies(userAId, 'USER');
    expect(forUserA.map((p) => p.id)).toContain(policyId);

    const forManager = await getUserPolicies(managerId, 'MANAGER');
    expect(forManager.map((p) => p.id)).toContain(policyId);

    const forUserB = await getUserPolicies(userBId, 'USER');
    expect(forUserB.map((p) => p.id)).not.toContain(policyId);
  });

  it('excludes inactive policies from getUserPolicies', async () => {
    await db
      .update(securityPolicies)
      .set({ isActive: false })
      .where(eq(securityPolicies.id, policyId));
    const forUserA = await getUserPolicies(userAId, 'USER');
    expect(forUserA.map((p) => p.id)).not.toContain(policyId);
    await db
      .update(securityPolicies)
      .set({ isActive: true })
      .where(eq(securityPolicies.id, policyId));
  });

  it('removes an assignment', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/security/policies/${policyId}/assignments/${userAssignmentId}`,
      headers: authHeaders(adminToken),
    });
    expect(res.statusCode).toBe(200);

    const forUserA = await getUserPolicies(userAId, 'USER');
    expect(forUserA.map((p) => p.id)).not.toContain(policyId);
  });

  afterAll(async () => {
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });
});

// ---------------------------------------------------------------------------
// 6. Test endpoint
// ---------------------------------------------------------------------------

describe('POST /api/security/policies/test', () => {
  it('previews ad-hoc predicates against a sample query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies/test',
      headers: authHeaders(adminToken),
      payload: {
        sql: "SELECT * FROM SALES WHERE STATUS = 'OPEN'",
        predicates: ["REGION = 'EMEA'"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.securedSql).toBe(
      "SELECT * FROM SALES WHERE (STATUS = 'OPEN') AND (REGION = 'EMEA')",
    );
  });

  it("previews a stored policy's rules", async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Preview policy',
        rules: [
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: "REGION = 'APAC'",
          },
        ],
      },
    });
    const previewPolicyId = createRes.json().data.id;

    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies/test',
      headers: authHeaders(adminToken),
      payload: { sql: 'SELECT * FROM SALES', policyId: previewPolicyId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.securedSql).toContain("WHERE (REGION = 'APAC')");

    await db
      .delete(securityPolicies)
      .where(eq(securityPolicies.id, previewPolicyId));
  });

  it('rejects a non-SELECT sample query', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies/test',
      headers: authHeaders(adminToken),
      payload: { sql: 'DROP TABLE SALES', predicates: ['X = 1'] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects an invalid ad-hoc predicate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies/test',
      headers: authHeaders(adminToken),
      payload: {
        sql: 'SELECT * FROM SALES',
        predicates: ['1=1; DROP TABLE X'],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s for an unknown policyId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies/test',
      headers: authHeaders(adminToken),
      payload: {
        sql: 'SELECT * FROM SALES',
        policyId: '00000000-0000-4000-8000-000000000097',
      },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 7. End-to-end enforcement through the real prepareQuery pipeline
// ---------------------------------------------------------------------------

describe('row-level security enforcement', () => {
  /** Fake Oracle connection capturing the SQL + binds actually sent. */
  function makeCaptureConn(rows: Record<string, unknown>[] = []) {
    const execute = jest.fn(async () => ({
      rows,
      metaData: [{ name: 'REGION' }, { name: 'AMOUNT' }],
    }));
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
      // The REAL prepareQuery — loadMapDefinition + resolveSecurityPredicates
      // + generateSql against the live test database.
      prepareQuery: defaultDeps().prepareQuery,
      getConnection: async () => conn,
      releaseConnection: async () => {},
      recordExecution: async () => {},
    };
  }

  let policyId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/security/policies',
      headers: authHeaders(adminToken),
      payload: {
        name: 'Enforcement policy',
        rules: [
          {
            targetId: salesFolderId,
            targetType: 'FOLDER',
            sqlPredicate: "{alias}.\"REGION\" = 'EMEA'",
          },
          {
            targetId: baId,
            targetType: 'BUSINESS_AREA',
            sqlPredicate: 'CREATED_BY = :current_user_id',
          },
        ],
      },
    });
    policyId = res.json().data.id;
    await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { userId: userAId },
    });
  });

  afterAll(async () => {
    await db.delete(securityPolicies).where(eq(securityPolicies.id, policyId));
  });

  it('resolves predicates for an assigned user and none for others', async () => {
    // Through the real resolver against the live DB.
    const def = await loadMapDefinition(mapId);

    const forA = await resolveSecurityPredicates(def, userAId);
    expect(forA.predicates).toHaveLength(2);
    expect(forA.bindParams.current_user_id).toBe(userAId);

    const forB = await resolveSecurityPredicates(def, userBId);
    expect(forB.predicates).toHaveLength(0);
  });

  it('fails closed for an unknown executing user', async () => {
    const def = await loadMapDefinition(mapId);
    await expect(
      resolveSecurityPredicates(def, '00000000-0000-4000-8000-000000000096'),
    ).rejects.toThrow(MapExecutionError);
  });

  it('user A and user B produce different SQL for the same map', async () => {
    const capA = makeCaptureConn([{ REGION: 'EMEA', AMOUNT: 1 }]);
    await executeMap(mapId, {}, userAId, {}, realPipelineDeps(capA.conn));
    const [sqlA, bindsA] = capA.execute.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];

    const capB = makeCaptureConn([
      { REGION: 'EMEA', AMOUNT: 1 },
      { REGION: 'AMER', AMOUNT: 2 },
    ]);
    await executeMap(mapId, {}, userBId, {}, realPipelineDeps(capB.conn));
    const [sqlB, bindsB] = capB.execute.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];

    // A's SQL carries both predicates: the folder rule with its alias
    // resolved, and the BA rule with A's own id bound.
    expect(sqlA).toContain('(f1."REGION" = \'EMEA\')');
    expect(sqlA).toContain('(CREATED_BY = :current_user_id)');
    expect((bindsA as Record<string, { val?: unknown } | unknown>)).toBeDefined();
    const bindValA = extractBindValue(bindsA, 'current_user_id');
    expect(bindValA).toBe(userAId);

    // B has no policy: no security predicates, no context binds.
    expect(sqlB).not.toContain('current_user_id');
    expect(sqlB).not.toContain("(f1.\"REGION\" = 'EMEA')");
    expect(extractBindValue(bindsB, 'current_user_id')).toBeUndefined();
  });

  it('stops enforcing after the policy is unassigned', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
    });
    const assignmentId = listRes.json().data[0].id as string;
    await app.inject({
      method: 'DELETE',
      url: `/api/security/policies/${policyId}/assignments/${assignmentId}`,
      headers: authHeaders(adminToken),
    });

    const cap = makeCaptureConn([]);
    await executeMap(mapId, {}, userAId, {}, realPipelineDeps(cap.conn));
    const [sql] = cap.execute.mock.calls[0] as unknown as [string];
    expect(sql).not.toContain('current_user_id');

    // Re-assign for any later assertions.
    await app.inject({
      method: 'POST',
      url: `/api/security/policies/${policyId}/assignments`,
      headers: authHeaders(adminToken),
      payload: { userId: userAId },
    });
  });
});

/**
 * The execution service passes binds either as plain values or wrapped
 * objects depending on driver conventions; accept both shapes.
 */
function extractBindValue(
  binds: unknown,
  name: string,
): unknown {
  if (!binds || typeof binds !== 'object') return undefined;
  const entry = (binds as Record<string, unknown>)[name];
  if (entry && typeof entry === 'object' && 'val' in entry) {
    return (entry as { val: unknown }).val;
  }
  return entry;
}
