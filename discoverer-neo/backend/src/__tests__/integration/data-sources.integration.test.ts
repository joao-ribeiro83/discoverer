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
// GET /api/data-sources
// ---------------------------------------------------------------------------

describe('GET /api/data-sources', () => {
  it('returns empty list initially', async () => {
    const res = await authenticatedRequest(app, 'GET', '/api/data-sources', adminToken);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/data-sources' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for USER role', async () => {
    const email = `int-ds-user@test.com`;
    await createTestUser(email, 'Pass123!', 'USER');
    const token = await loginAndGetToken(app, email, 'Pass123!');
    const res = await authenticatedRequest(app, 'GET', '/api/data-sources', token);
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/data-sources
// ---------------------------------------------------------------------------

describe('POST /api/data-sources', () => {
  it('creates a data source (admin)', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Integration Test DS',
      connectionType: 'postgres',
      host: 'localhost',
      port: 5432,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Integration Test DS');
    expect(body.data.connectionType).toBe('postgres');
    expect(body.data.hasPassword).toBe(false);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Missing Type',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate name', async () => {
    await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Duplicate DS',
      connectionType: 'postgres',
    });

    const res = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Duplicate DS',
      connectionType: 'oracle',
    });

    expect(res.statusCode).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/data-sources/:id
// ---------------------------------------------------------------------------

describe('GET /api/data-sources/:id', () => {
  it('returns a single data source', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Get By Id DS',
      connectionType: 'postgres',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/data-sources/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/data-sources/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/data-sources/:id
// ---------------------------------------------------------------------------

describe('PUT /api/data-sources/:id', () => {
  it('updates a data source', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Update DS',
      connectionType: 'postgres',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/data-sources/${id}`, adminToken, {
      name: 'Updated DS Name',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated DS Name');
  });

  it('returns 404 for non-existent id', async () => {
    const res = await authenticatedRequest(
      app,
      'PUT',
      '/api/data-sources/00000000-0000-0000-0000-000000000000',
      adminToken,
      { name: 'Ghost' },
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/data-sources/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/data-sources/:id', () => {
  it('soft-deletes a data source', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Delete DS',
      connectionType: 'postgres',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/data-sources/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Data source deactivated');
  });
});

// ---------------------------------------------------------------------------
// POST /api/data-sources/:id/test
// ---------------------------------------------------------------------------

describe('POST /api/data-sources/:id/test', () => {
  it('tests a data source connection', async () => {
    const createRes = await authenticatedRequest(app, 'POST', '/api/data-sources', adminToken, {
      name: 'Test Conn DS',
      connectionType: 'postgres',
    });
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/data-sources/${id}/test`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveProperty('success');
    expect(res.json().data).toHaveProperty('message');
    expect(res.json().data).toHaveProperty('latencyMs');
  });
});
