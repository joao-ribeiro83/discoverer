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
let itemId1: string;
let itemId2: string;

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

  const ba = await createTestBusinessArea('Hierarchy Test BA', adminId);
  baId = ba.id;

  // Create a folder and two items for hierarchy levels
  const folder = await createTestFolder(ba.id, 'Hierarchy Folder', 'TABLE', adminId);
  const item1 = await createTestItem(folder.id, 'Region', 'HI', 'REGION', adminId);
  const item2 = await createTestItem(folder.id, 'Country', 'HI', 'COUNTRY', adminId);
  itemId1 = item1.id;
  itemId2 = item2.id;
});

// ---------------------------------------------------------------------------
// POST /api/business-areas/:baId/hierarchies
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:baId/hierarchies', () => {
  it('creates a hierarchy with levels', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      {
        name: 'Geo Hierarchy',
        description: 'Region → Country',
        levels: [
          { levelName: 'Region', itemId: itemId1, levelNumber: 1 },
          { levelName: 'Country', itemId: itemId2, levelNumber: 2 },
        ],
      },
    );

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('Geo Hierarchy');
    expect(res.json().data.levels.length).toBe(2);
    expect(res.json().data.levels[0].levelName).toBe('Region');
    expect(res.json().data.levels[1].levelName).toBe('Country');
  });

  it('returns 400 on empty levels', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      { name: 'No Levels', levels: [] },
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      { name: 'Missing Levels' },
    );
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/business-areas/:baId/hierarchies
// ---------------------------------------------------------------------------

describe('GET /api/business-areas/:baId/hierarchies', () => {
  it('lists hierarchies in a business area', async () => {
    await authenticatedRequest(app, 'POST', `/api/business-areas/${baId}/hierarchies`, adminToken, {
      name: 'List Hierarchy',
      levels: [{ levelName: 'L1', itemId: itemId1, levelNumber: 1 }],
    });

    const res = await authenticatedRequest(
      app,
      'GET',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/hierarchies/:id
// ---------------------------------------------------------------------------

describe('GET /api/hierarchies/:id', () => {
  it('returns a hierarchy with levels ordered by levelNumber', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      {
        name: 'Get Hierarchy',
        levels: [
          { levelName: 'Region', itemId: itemId1, levelNumber: 1 },
          { levelName: 'Country', itemId: itemId2, levelNumber: 2 },
        ],
      },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'GET', `/api/hierarchies/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(id);
    expect(res.json().data.levels.length).toBe(2);
    expect(res.json().data.levels[0].levelNumber).toBeLessThan(
      res.json().data.levels[1].levelNumber,
    );
  });

  it('returns 404 for non-existent hierarchy', async () => {
    const res = await authenticatedRequest(
      app,
      'GET',
      '/api/hierarchies/00000000-0000-0000-0000-000000000000',
      adminToken,
    );
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/hierarchies/:id
// ---------------------------------------------------------------------------

describe('PUT /api/hierarchies/:id', () => {
  it('updates a hierarchy and replaces levels', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      {
        name: 'Update Hierarchy',
        levels: [{ levelName: 'Region', itemId: itemId1, levelNumber: 1 }],
      },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'PUT', `/api/hierarchies/${id}`, adminToken, {
      name: 'Updated Hierarchy',
      levels: [
        { levelName: 'Region', itemId: itemId1, levelNumber: 1 },
        { levelName: 'Country', itemId: itemId2, levelNumber: 2 },
      ],
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated Hierarchy');
    expect(res.json().data.levels.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/hierarchies/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/hierarchies/:id', () => {
  it('soft-deletes a hierarchy', async () => {
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies`,
      adminToken,
      {
        name: 'Delete Hierarchy',
        levels: [{ levelName: 'L1', itemId: itemId1, levelNumber: 1 }],
      },
    );
    const id = createRes.json().data.id;

    const res = await authenticatedRequest(app, 'DELETE', `/api/hierarchies/${id}`, adminToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe('Hierarchy deactivated');
  });
});

// ---------------------------------------------------------------------------
// POST /api/business-areas/:baId/hierarchies/validate-levels
// ---------------------------------------------------------------------------

describe('POST /api/business-areas/:baId/hierarchies/validate-levels', () => {
  it('returns valid: true for valid levels', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies/validate-levels`,
      adminToken,
      {
        levels: [
          { levelName: 'Region', itemId: itemId1, levelNumber: 1 },
          { levelName: 'Country', itemId: itemId2, levelNumber: 2 },
        ],
      },
    );

    expect(res.statusCode).toBe(200);
    expect(res.json().data.valid).toBe(true);
  });

  it('returns 400 for duplicate levelNumbers', async () => {
    const res = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${baId}/hierarchies/validate-levels`,
      adminToken,
      {
        levels: [
          { levelName: 'Region', itemId: itemId1, levelNumber: 1 },
          { levelName: 'Country', itemId: itemId2, levelNumber: 1 },
        ],
      },
    );

    expect(res.statusCode).toBe(400);
  });
});
