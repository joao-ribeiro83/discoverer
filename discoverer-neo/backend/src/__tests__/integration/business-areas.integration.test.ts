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
// POST /api/business-areas
// ---------------------------------------------------------------------------

describe('POST /api/business-areas', () => {
  it('creates a business area (admin)', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Integration BA',
      description: 'Test business area',
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Integration BA');
    expect(res.json().data.description).toBe('Test business area');
    expect(res.json().data.isActive).toBe(true);
  });

  it('returns 400 on invalid body', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: '',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 for non-admin', async () => {
    const email = `int-ba-mgr@test.com`;
    await createTestUser(email, 'Pass123!', 'MANAGER');
    const token = await loginAndGetToken(app, email, 'Pass123!');

    const res = await authenticatedRequest(app, 'POST', '/api/business-areas', token, {
      name: 'Should Fail',
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/business-areas
// ---------------------------------------------------------------------------

describe('GET /api/business-areas', () => {
  it('admin sees all business areas', async () => {
    await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, { name: 'BA A' });
    await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, { name: 'BA B' });

    const res = await authenticatedRequest(app, 'GET', '/api/business-areas', adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(2);
  });

  it('non-admin sees only granted areas', async () => {
    // Create two BAs
    const ba1Res = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, { name: 'Granted BA' });
    await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, { name: 'Private BA' });
    const baId = ba1Res.json().data.id;

    // Create user and grant VIEW on one
    const email = `int-ba-user@test.com`;
    const user = await createTestUser(email, 'Pass123!', 'USER');
    const token = await loginAndGetToken(app, email, 'Pass123!');

    await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/grants`,
      adminToken,
      { userId: user.id, permissionLevel: 'VIEW' },
    );

    const res = await authenticatedRequest(app, 'GET', '/api/business-areas', token);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(1);
    expect(res.json().data[0].name).toBe('Granted BA');
  });
});

// ---------------------------------------------------------------------------
// GET /api/business-areas/:id
// ---------------------------------------------------------------------------

describe('GET /api/business-areas/:id', () => {
  it('returns a single business area with grants', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Single BA',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/business-areas/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
    expect(res.json().data.grants).toBeDefined();
    expect(res.json().data.permissions).toBeDefined();
  });

  it('returns 404 for non-existent id', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/business-areas/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/business-areas/:id
// ---------------------------------------------------------------------------

describe('PUT /api/business-areas/:id', () => {
  it('updates a business area', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Original BA',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/business-areas/${id}`, adminToken, {
      name: 'Updated BA',
      description: 'Now has a description',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated BA');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/business-areas/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/business-areas/:id', () => {
  it('soft-deletes a business area (admin only)', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Delete BA',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/business-areas/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Business area deactivated');
  });

  it('returns 403 for non-admin', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Protected BA',
    });
    const id = createRes.json().data.id;

    const email = `int-ba-del@test.com`;
    await createTestUser(email, 'Pass123!', 'MANAGER');
    const token = await loginAndGetToken(app, email, 'Pass123!');

    const res = await authenticatedRequest(app, 'DELETE', `/api/business-areas/${id}`, token);
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/business-areas/:id/grants
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:id/grants', () => {
  it('grants access to a user (admin)', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Grant BA',
    });
    const baId = createRes.json().data.id;

    const email = `int-ba-grant@test.com`;
    const user = await createTestUser(email, 'Pass123!', 'USER');

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/grants`,
      adminToken,
      { userId: user.id, permissionLevel: 'EDIT' },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.userId).toBe(user.id);
    expect(res.json().data.permissionLevel).toBe('EDIT');
    expect(res.json().data.userEmail).toBe(email);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/business-areas/:id/grants/:userId
// ---------------------------------------------------------------------------

describe('DELETE /api/business-areas/:id/grants/:userId', () => {
  it('revokes all grants for a user (admin)', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Revoke BA',
    });
    const baId = createRes.json().data.id;

    const email = `int-ba-revoke@test.com`;
    const user = await createTestUser(email, 'Pass123!', 'USER');

    // Grant VIEW and EDIT
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/grants`, adminToken, {
      userId: user.id,
      permissionLevel: 'VIEW',
    });
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/grants`, adminToken, {
      userId: user.id,
      permissionLevel: 'EDIT',
    });

    // Revoke all
    const res = await authenticatedRequest(
      app,
      'DELETE',
      `/api/business-areas/${baId}/grants/${user.id}`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toContain('Revoked 2 permission(s)');
  });
});
