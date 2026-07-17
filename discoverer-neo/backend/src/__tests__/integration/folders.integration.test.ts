import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createAdminWithToken,
  createTestBusinessArea,
  cleanupIntegrationUsers,
  authenticatedRequest,
} from './test-helper.js';

let app: FastifyInstance;
let adminToken: string;
let adminId: string;
let baId: string;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
  const { user, token } = await createAdminWithToken(app);
  adminToken = token;
  adminId = user.id;

  // Create a business area for folder tests
  const ba = await createTestBusinessArea('Folder Test BA', adminId);
  baId = ba.id;
});

// ---------------------------------------------------------------------------
// POST /api/business-areas/:baId/folders
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:baId/folders', () => {
  it('creates a TABLE folder', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      { name: 'Employees', folderType: 'TABLE' },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Employees');
    expect(res.json().data.folderType).toBe('TABLE');
    expect(res.json().data.businessAreaId).toBe(baId);
  });

  it('creates a COMPLEX folder with customSql', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      {
        name: 'Custom Query',
        folderType: 'COMPLEX',
        customSql: 'SELECT * FROM employees WHERE active = 1',
      },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.folderType).toBe('COMPLEX');
  });

  it('returns 400 for invalid folder type', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      { name: 'Bad', folderType: 'INVALID' },
    );

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/business-areas/:baId/folders
// ---------------------------------------------------------------------------

describe('GET /api/business-areas/:baId/folders', () => {
  it('lists folders in a business area', async () => {
    // Create two folders
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/folders`, adminToken, {
      name: 'Folder A',
      folderType: 'TABLE',
    });
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/folders`, adminToken, {
      name: 'Folder B',
      folderType: 'VIEW',
    });

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/business-areas/${baId}/folders`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2);
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${baId}/folders`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/folders/:id
// ---------------------------------------------------------------------------

describe('GET /api/folders/:id', () => {
  it('returns a single folder', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      { name: 'Get Folder', folderType: 'TABLE' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/folders/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('returns 404 for non-existent folder', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/folders/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/folders/:id
// ---------------------------------------------------------------------------

describe('PUT /api/folders/:id', () => {
  it('updates a folder', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      { name: 'Original Folder', folderType: 'TABLE' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/folders/${id}`, adminToken, {
      name: 'Updated Folder',
      description: 'Now described',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Folder');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/folders/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/folders/:id', () => {
  it('soft-deletes a folder', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/folders`,
      adminToken,
      { name: 'Delete Folder', folderType: 'TABLE' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/folders/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Folder deactivated');
  });
});
