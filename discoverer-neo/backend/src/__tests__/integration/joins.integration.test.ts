import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createAdminWithToken,
  createTestBusinessArea,
  createTestFolder,
  createTestItem,
  cleanupIntegrationUsers,
  authenticatedRequest,
} from './test-helper.js';

let app: FastifyInstance;
let adminToken: string;
let adminId: string;
let baId: string;
let leftFolderId: string;
let rightFolderId: string;

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

  const ba = await createTestBusinessArea('Join Test BA', adminId);
  baId = ba.id;

  const leftFolder = await createTestFolder(ba.id, 'Left Folder', 'TABLE', adminId);
  const rightFolder = await createTestFolder(ba.id, 'Right Folder', 'TABLE', adminId);
  leftFolderId = leftFolder.id;
  rightFolderId = rightFolder.id;
});

// ---------------------------------------------------------------------------
// POST /api/business-areas/:baId/joins
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:baId/joins', () => {
  it('creates a join between two folders', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/joins`,
      adminToken,
      {
        name: 'Employees-Departments',
        leftFolderId,
        rightFolderId,
        joinType: 'INNER',
      },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Employees-Departments');
    expect(res.json().data.joinType).toBe('INNER');
    expect(res.json().data.leftFolderId).toBe(leftFolderId);
    expect(res.json().data.rightFolderId).toBe(rightFolderId);
  });

  it('creates all join types', async () => {
    const types = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const;
    for (const joinType of types) {
      const res = await authenticatedRequest(
        app,
        'POST',
        `/api/business-areas/${baId}/joins`,
        adminToken,
        { name: `Join ${joinType}`, leftFolderId, rightFolderId, joinType },
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().data.joinType).toBe(joinType);
    }
  });

  it('returns 400 on missing required fields', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/joins`,
      adminToken,
      { name: 'Incomplete Join' },
    );
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/business-areas/:baId/joins
// ---------------------------------------------------------------------------

describe('GET /api/business-areas/:baId/joins', () => {
  it('lists joins in a business area', async () => {
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/joins`, adminToken, {
      name: 'Join 1',
      leftFolderId,
      rightFolderId,
      joinType: 'INNER',
    });

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/business-areas/${baId}/joins`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/joins/:id
// ---------------------------------------------------------------------------

describe('GET /api/joins/:id', () => {
  it('returns a single join with details', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/joins`,
      adminToken,
      { name: 'Detail Join', leftFolderId, rightFolderId, joinType: 'LEFT' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/joins/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
    expect(res.json().data.leftFolderName).toBeDefined();
    expect(res.json().data.rightFolderName).toBeDefined();
  });

  it('returns 404 for non-existent join', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/joins/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/joins/:id
// ---------------------------------------------------------------------------

describe('PUT /api/joins/:id', () => {
  it('updates a join', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/joins`,
      adminToken,
      { name: 'Update Join', leftFolderId, rightFolderId, joinType: 'INNER' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/joins/${id}`, adminToken, {
      name: 'Updated Join Name',
      joinType: 'LEFT',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Join Name');
    expect(res.json().data.joinType).toBe('LEFT');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/joins/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/joins/:id', () => {
  it('soft-deletes a join', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/joins`,
      adminToken,
      { name: 'Delete Join', leftFolderId, rightFolderId, joinType: 'INNER' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/joins/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Join deactivated');
  });
});

// ---------------------------------------------------------------------------
// GET /api/folders/:folderId/joins/suggestions
// ---------------------------------------------------------------------------

describe('GET /api/folders/:folderId/joins/suggestions', () => {
  it('returns join suggestions (may be empty)', async () => {
    // Create items with matching column names in both folders
    await createTestItem(leftFolderId, 'Dept ID', 'CI', 'DEPT_ID', adminId);
    await createTestItem(rightFolderId, 'Dept ID', 'CI', 'DEPT_ID', adminId);

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/folders/${leftFolderId}/joins/suggestions`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });
});
