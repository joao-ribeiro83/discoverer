import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createAdminWithToken,
  createTestBusinessArea,
  createTestFolder,
  cleanupIntegrationUsers,
  authenticatedRequest,
} from './test-helper.js';

let app: FastifyInstance;
let adminToken: string;
let adminId: string;
let folderId: string;

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

  const ba = await createTestBusinessArea('Item Test BA', adminId);
  const folder = await createTestFolder(ba.id, 'Item Test Folder', 'TABLE', adminId);
  folderId = folder.id;
});

// ---------------------------------------------------------------------------
// POST /api/folders/:folderId/items
// ---------------------------------------------------------------------------

describe('POST /api/folders/:folderId/items', () => {
  it('creates a CI item (data item)', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Employee Name', itemType: 'CI', columnName: 'EMP_NAME', dataType: 'VARCHAR2' },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Employee Name');
    expect(res.json().data.itemType).toBe('CI');
    expect(res.json().data.columnName).toBe('EMP_NAME');
  });

  it('creates a CU item (calculated)', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Full Name', itemType: 'CU', formula: 'FIRST_NAME || LAST_NAME' },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.itemType).toBe('CU');
    expect(res.json().data.formula).toBe('FIRST_NAME || LAST_NAME');
  });

  it('returns 400 when CI item missing columnName', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Missing Column', itemType: 'CI' },
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when CU item missing formula', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Missing Formula', itemType: 'CU' },
    );

    expect(res.statusCode).toBe(400);
  });

  it('creates all item types', async () => {
    const types = ['CI', 'CU', 'CO', 'JI', 'HI', 'AG', 'FU'] as const;
    for (const itemType of types) {
      const body: Record<string, unknown> = { name: `Item ${itemType}`, itemType };
      if (itemType === 'CI') body.columnName = 'COL';
      if (itemType === 'CU') body.formula = '1+1';

      const res = await authenticatedRequest(
        app,
        'POST',
        `/api/folders/${folderId}/items`,
        adminToken,
        body,
      );
      expect(res.statusCode).toBe(201);
      expect(res.json().data.itemType).toBe(itemType);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/folders/:folderId/items
// ---------------------------------------------------------------------------

describe('GET /api/folders/:folderId/items', () => {
  it('lists items in a folder', async () => {
    await authenticatedRequest(app, 'POST', `/api/folders/${folderId}/items`, adminToken, {
      name: 'Item A',
      itemType: 'CI',
      columnName: 'A',
    });
    await authenticatedRequest(app, 'POST', `/api/folders/${folderId}/items`, adminToken, {
      name: 'Item B',
      itemType: 'CI',
      columnName: 'B',
    });

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/folders/${folderId}/items`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/items/:id
// ---------------------------------------------------------------------------

describe('GET /api/items/:id', () => {
  it('returns a single item', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Single Item', itemType: 'CI', columnName: 'S' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/items/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/items/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/items/:id
// ---------------------------------------------------------------------------

describe('PUT /api/items/:id', () => {
  it('updates an item', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Update Me', itemType: 'CI', columnName: 'U' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/items/${id}`, adminToken, {
      name: 'Updated Item',
      description: 'Now described',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Item');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/items/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/items/:id', () => {
  it('soft-deletes an item', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Delete Me', itemType: 'CI', columnName: 'D' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/items/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Item deactivated');
  });
});

// ---------------------------------------------------------------------------
// POST /api/folders/:folderId/items/import
// ---------------------------------------------------------------------------

describe('POST /api/folders/:folderId/items/import', () => {
  it('imports columns as CI items', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items/import`,
      adminToken,
      {
        columns: [
          { columnName: 'EMP_ID', dataType: 'NUMBER', nullable: false },
          { columnName: 'EMP_NAME', dataType: 'VARCHAR2', dataLength: 100, nullable: true },
        ],
      },
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.created.length).toBe(2);
    expect(res.json().data.skipped.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/items/:id/descendants
// ---------------------------------------------------------------------------

describe('GET /api/items/:id/descendants', () => {
  it('returns empty array for item with no children', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folderId}/items`,
      adminToken,
      { name: 'Parent', itemType: 'HI', columnName: 'P' },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/items/${id}/descendants`,
      adminToken,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});
