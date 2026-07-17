import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createAdminWithToken,
  createTestUser,
  loginAndGetToken,
  cleanupIntegrationUsers,
  authenticatedRequest,
} from './test-helper.js';

let app: FastifyInstance;
let adminToken: string;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
  const { token } = await createAdminWithToken(app);
  adminToken = token;
});

// ---------------------------------------------------------------------------
// POST /api/custom-functions
// ---------------------------------------------------------------------------

describe('POST /api/custom-functions', () => {
  it('creates a SQL custom function', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'GET_SALARY',
      functionType: 'SQL',
      returnType: 'NUMBER',
      parameters: [
        { name: 'emp_id', type: 'NUMBER', required: true },
      ],
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('GET_SALARY');
    expect(res.json().data.functionType).toBe('SQL');
  });

  it('creates a PLSQL custom function', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'CALC_BONUS',
      functionType: 'PLSQL',
      returnType: 'NUMBER',
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.functionType).toBe('PLSQL');
  });

  it('creates a PACKAGE custom function', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'HR_PKG',
      functionType: 'PACKAGE',
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.functionType).toBe('PACKAGE');
  });

  it('returns 400 on missing required fields', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'No Type',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 for USER role', async () => {
    const email = `int-cf-user@test.com`;
    await createTestUser(email, 'Pass123!', 'USER');
    const token = await loginAndGetToken(app, email, 'Pass123!');

    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', token, {
      name: 'Forbidden',
      functionType: 'SQL',
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/custom-functions
// ---------------------------------------------------------------------------

describe('GET /api/custom-functions', () => {
  it('lists all custom functions', async () => {
    await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'FN_A',
      functionType: 'SQL',
    });
    await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'FN_B',
      functionType: 'PLSQL',
    });

    const res = await authenticatedRequest(app, 'GET', '/api/custom-functions', adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/custom-functions/:id
// ---------------------------------------------------------------------------

describe('GET /api/custom-functions/:id', () => {
  it('returns a single custom function', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'GET_ONE_FN',
      functionType: 'SQL',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/custom-functions/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/custom-functions/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/custom-functions/:id
// ---------------------------------------------------------------------------

describe('PUT /api/custom-functions/:id', () => {
  it('updates a custom function', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'UPDATE_ME',
      functionType: 'SQL',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/custom-functions/${id}`, adminToken, {
      name: 'UPDATED_FN',
      returnType: 'VARCHAR2',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('UPDATED_FN');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/custom-functions/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/custom-functions/:id', () => {
  it('soft-deletes a custom function', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/custom-functions', adminToken, {
      name: 'DELETE_ME',
      functionType: 'SQL',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(
      app,
      'DELETE',
      `/api/custom-functions/${id}`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Custom function deactivated');
  });
});
