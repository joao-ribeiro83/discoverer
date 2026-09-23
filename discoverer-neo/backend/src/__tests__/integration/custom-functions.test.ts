import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import { users, customFunctions, dataSources } from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import {
  validateParameters,
  validateFunctionType,
  refreshFromDatabase,
} from '../../services/custom-function.service.js';

// ---------------------------------------------------------------------------
// Pure validation helpers (unit-level; no app/DB)
// ---------------------------------------------------------------------------

describe('validateParameters', () => {
  it('accepts null/undefined (no parameters)', () => {
    expect(validateParameters(null).valid).toBe(true);
    expect(validateParameters(undefined).valid).toBe(true);
  });

  it('accepts a well-formed parameter list', () => {
    expect(
      validateParameters([
        { name: 'p1', type: 'VARCHAR2', required: true },
        { name: 'p2', type: 'NUMBER' },
      ]).valid,
    ).toBe(true);
  });

  it('rejects a non-array', () => {
    const r = validateParameters({ name: 'x' });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/must be an array/);
  });

  it('rejects a non-object element', () => {
    expect(validateParameters(['nope']).error).toMatch(/must be an object/);
    expect(validateParameters([null]).error).toMatch(/must be an object/);
  });

  it('rejects a parameter missing a name', () => {
    expect(validateParameters([{ type: 'NUMBER' }]).error).toMatch(/"name"/);
    expect(validateParameters([{ name: '  ', type: 'NUMBER' }]).error).toMatch(/"name"/);
  });

  it('rejects a parameter missing a type', () => {
    expect(validateParameters([{ name: 'p' }]).error).toMatch(/"type"/);
  });

  it('rejects a non-boolean required flag', () => {
    expect(
      validateParameters([{ name: 'p', type: 'NUMBER', required: 'yes' }]).error,
    ).toMatch(/required must be a boolean/);
  });

  it('rejects duplicate parameter names', () => {
    expect(
      validateParameters([
        { name: 'dup', type: 'NUMBER' },
        { name: 'dup', type: 'VARCHAR2' },
      ]).error,
    ).toMatch(/Duplicate parameter/);
  });
});

describe('validateFunctionType', () => {
  it('accepts allowlisted types and rejects others', () => {
    expect(validateFunctionType('SQL')).toBe(true);
    expect(validateFunctionType('PLSQL')).toBe(true);
    expect(validateFunctionType('PACKAGE')).toBe(true);
    expect(validateFunctionType('SHELL')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'cf-test@example.com';
const TEST_ADMIN_EMAIL = 'cf-admin@example.com';
const TEST_MANAGER_EMAIL = 'cf-manager@example.com';
const TEST_USER_EMAIL = 'cf-user@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Custom Function Test User';

async function createTestUser(
  email: string,
  password: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: TEST_NAME, role })
    .returning();
  return user;
}

async function cleanupTestData() {
  await db.delete(customFunctions);
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_ADMIN_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_MANAGER_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_USER_EMAIL));
}

async function loginAndReturnToken(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return res.json().data.token as string;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

beforeEach(async () => {
  await cleanupTestData();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Custom function CRUD', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('creates a SQL custom function', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Calculate Bonus',
        description: 'Computes annual bonus',
        functionType: 'SQL',
        parameters: [
          { name: 'salary', type: 'NUMBER', required: true },
          { name: 'pct', type: 'NUMBER', required: false, defaultValue: 0.1 },
        ],
        returnType: 'NUMBER',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.name).toBe('Calculate Bonus');
    expect(body.data.functionType).toBe('SQL');
    expect(body.data.parameters).toHaveLength(2);
    expect(body.data.parameters[0].name).toBe('salary');
  });

  it('creates a PLSQL function', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'PLSQL Fn',
        functionType: 'PLSQL',
        returnType: 'VARCHAR2',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.functionType).toBe('PLSQL');
  });

  it('creates a PACKAGE function without parameters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Pkg Fn',
        functionType: 'PACKAGE',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects invalid function type', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Type',
        functionType: 'INVALID',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects parameters that are not an array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Params',
        functionType: 'SQL',
        parameters: 'not-an-array',
      },
    });

    expect(response.statusCode).toBe(400);
    // Fastify's AJV coerces the scalar into a one-element array, so the
    // validation error reports the element type rather than the array type.
    expect(response.json().error).toContain('parameters');
  });

  it('rejects parameter without name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Param',
        functionType: 'SQL',
        parameters: [{ type: 'NUMBER' }],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects parameter with non-boolean required', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Required',
        functionType: 'SQL',
        parameters: [{ name: 'x', type: 'NUMBER', required: 'yes' }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('boolean');
  });

  it('rejects duplicate parameter names', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Dup Params',
        functionType: 'SQL',
        parameters: [
          { name: 'x', type: 'NUMBER' },
          { name: 'x', type: 'VARCHAR2' },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Duplicate');
  });

  it('gets a custom function by id', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Fetch Me',
        functionType: 'SQL',
      },
    });
    const id = createRes.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.id).toBe(id);
  });

  it('returns 404 for missing custom function', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/custom-functions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('lists all custom functions', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Fn One', functionType: 'SQL' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Fn Two', functionType: 'PLSQL' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('updates a custom function', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Old Name',
        functionType: 'SQL',
      },
    });
    const id = createRes.json().data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'New Name',
        functionType: 'PLSQL',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('New Name');
    expect(response.json().data.functionType).toBe('PLSQL');
  });

  it('returns 404 when updating missing function', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/custom-functions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Nope' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('soft-deletes a custom function', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'To Delete', functionType: 'SQL' },
    });
    const id = createRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('Custom function permission enforcement', () => {
  let userToken: string;
  let managerToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_USER_EMAIL, TEST_PASSWORD, 'USER');
    userToken = await loginAndReturnToken(TEST_USER_EMAIL, TEST_PASSWORD);
    await createTestUser(TEST_MANAGER_EMAIL, TEST_PASSWORD, 'MANAGER');
    managerToken = await loginAndReturnToken(TEST_MANAGER_EMAIL, TEST_PASSWORD);
  });

  it('forbids USER role from creating', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: 'Nope', functionType: 'SQL' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows MANAGER to create', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { name: 'Manager Fn', functionType: 'SQL' },
    });
    expect(response.statusCode).toBe(201);
  });

  it('allows ADMIN to delete', async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Admin Delete', functionType: 'SQL' },
    });
    const id = createRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);
  });

  it('forbids USER role from deleting', async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/custom-functions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Protected', functionType: 'SQL' },
    });
    const id = createRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/custom-functions/${id}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(delRes.statusCode).toBe(403);
  });
});

describe('refreshFromDatabase', () => {
  const fnDef = (params: Array<[string, string, boolean]>, returnType = 'NUMBER', overload: string | null = null) => ({
    owner: 'SIID',
    packageName: 'PKG',
    name: 'X',
    overload,
    returnType,
    parameters: params.map(([name, type, required], i) => ({ name, type, required, position: i + 1 })),
    callableFromSql: true,
    reason: null,
  });

  it('writes changed signatures, reports gone and ambiguous functions, never deletes', async () => {
    const [ds] = await db
      .insert(dataSources)
      .values({ name: 'Fn Refresh DS', connectionType: 'oracle', host: 'h', port: 1521, serviceName: 'S', username: 'u' })
      .returning();
    try {
      const base = { functionType: 'PACKAGE' as const, extOwner: 'SIID', extPackage: 'PKG', dataSourceId: ds!.id };
      const [same, changed, gone, ambiguous, noDs, linked] = await db
        .insert(customFunctions)
        .values([
          { ...base, name: 'SAME', extName: 'SAME', returnType: 'NUMBER', parameters: [{ name: 'A', type: 'NUMBER', required: true, position: 2 }] },
          { ...base, name: 'CHANGED', extName: 'CHANGED', returnType: 'NUMBER', parameters: [{ name: 'A', type: 'NUMBER', required: true, defaultValue: 7 }] },
          { ...base, name: 'GONE', extName: 'GONE', returnType: 'NUMBER', parameters: [] },
          { ...base, name: 'AMBIG', extName: 'AMBIG', returnType: 'NUMBER', parameters: [] },
          { ...base, name: 'NODS', extName: 'NODS', dataSourceId: null },
          { ...base, name: 'LINKED', extName: 'LINKED', extDbLink: 'REMOTE' },
        ])
        .returning();

      const results = await refreshFromDatabase(null, async (_ds, refs) =>
        refs.map((r) => {
          if (r.name === 'SAME') return [fnDef([['A', 'NUMBER', true]])];
          if (r.name === 'CHANGED') return [fnDef([['A', 'NUMBER', true], ['B', 'DATE', false]], 'TEXT')];
          if (r.name === 'AMBIG') return [fnDef([['A', 'NUMBER', true]], 'NUMBER', '1'), fnDef([['A', 'TEXT', true]], 'NUMBER', '2')];
          return [];
        }),
      );
      const by = new Map(results.map((r) => [r.functionId, r]));

      expect(by.get(same!.id)).toMatchObject({ changed: [], missing: false, error: null });
      expect(by.get(changed!.id)!.changed).toEqual(['parameters', 'return type']);
      expect(by.get(gone!.id)).toMatchObject({ missing: true, error: null });
      expect(by.get(ambiguous!.id)!.error).toMatch(/2 versions/);
      expect(by.get(noDs!.id)!.error).toMatch(/No data source/);
      expect(by.get(linked!.id)!.error).toMatch(/database link REMOTE/);

      const [after] = await db.select().from(customFunctions).where(eq(customFunctions.id, changed!.id));
      expect(after!.returnType).toBe('TEXT');
      expect(after!.parameters).toEqual([
        { name: 'A', type: 'NUMBER', required: true, position: 1, defaultValue: 7 },
        { name: 'B', type: 'DATE', required: false, position: 2 },
      ]);
      // An unchanged function keeps its stored positions: nothing was written.
      const [kept] = await db.select().from(customFunctions).where(eq(customFunctions.id, same!.id));
      expect(kept!.parameters).toEqual([{ name: 'A', type: 'NUMBER', required: true, position: 2 }]);
      const [stillThere] = await db.select().from(customFunctions).where(eq(customFunctions.id, gone!.id));
      expect(stillThere!.isActive).toBe(true);
    } finally {
      await db.delete(customFunctions);
      await db.delete(dataSources).where(eq(dataSources.id, ds!.id));
    }
  });
});
