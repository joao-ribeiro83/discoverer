import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import {
  getApp,
  closeApp,
  createTestUser,
  loginAndGetToken,
  createTestBusinessArea,
  createTestFolder,
  cleanupIntegrationUsers,
  grantTestPermission,
  authenticatedRequest,
} from './test-helper.js';

let app: FastifyInstance;

// Email/password constants per role
const ADMIN_EMAIL = `int-rbac-admin@test.com`;
const MANAGER_EMAIL = `int-rbac-manager@test.com`;
const USER_EMAIL = `int-rbac-user@test.com`;
const VIEWER_EMAIL = `int-rbac-viewer@test.com`;
const PASSWORD = 'RbacPass123!';

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
});

// ---------------------------------------------------------------------------
// ADMIN can do everything
// ---------------------------------------------------------------------------

describe('ADMIN role', () => {
  it('can create, read, update, delete business areas', async () => {
    const _admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const token = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    // Create
    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', token, {
      name: 'Admin BA',
    });
    expect(createRes.statusCode).toBe(201);
    const baId = createRes.json().data.id;

    // Read
    const getRes = await authenticatedRequest(app, 'GET', `/api/business-areas/${baId}`, token);
    expect(getRes.statusCode).toBe(200);

    // Update
    const putRes = await authenticatedRequest(app, 'PUT', `/api/business-areas/${baId}`, token, {
      name: 'Admin Updated',
    });
    expect(putRes.statusCode).toBe(200);

    // Delete
    const delRes = await authenticatedRequest(app, 'DELETE', `/api/business-areas/${baId}`, token);
    expect(delRes.statusCode).toBe(200);
  });

  it('can create and list data sources', async () => {
    await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const token = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/data-sources', token, {
      name: 'Admin DS',
      connectionType: 'postgres',
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await authenticatedRequest(app, 'GET', '/api/data-sources', token);
    expect(listRes.statusCode).toBe(200);
  });

  it('can manage custom functions', async () => {
    await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const token = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/custom-functions', token, {
      name: 'Admin Fn',
      functionType: 'SQL',
    });
    expect(createRes.statusCode).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// VIEWER can only read
// ---------------------------------------------------------------------------

describe('VIEWER role', () => {
  it('cannot create business areas', async () => {
    await createTestUser(VIEWER_EMAIL, PASSWORD, 'VIEWER');
    const token = await loginAndGetToken(app, VIEWER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'POST', '/api/business-areas', token, {
      name: 'Viewer BA',
    });
    expect(res.statusCode).toBe(403);
  });

  it('cannot list data sources (requires ADMIN/MANAGER)', async () => {
    await createTestUser(VIEWER_EMAIL, PASSWORD, 'VIEWER');
    const token = await loginAndGetToken(app, VIEWER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'GET', '/api/data-sources', token);
    expect(res.statusCode).toBe(403);
  });

  it('cannot create custom functions (requires ADMIN/MANAGER)', async () => {
    await createTestUser(VIEWER_EMAIL, PASSWORD, 'VIEWER');
    const token = await loginAndGetToken(app, VIEWER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', token, {
      name: 'Viewer Fn',
      functionType: 'SQL',
    });
    expect(res.statusCode).toBe(403);
  });

  it('can read business areas they have VIEW grant on', async () => {
    const admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Viewer Visible BA',
    });
    const baId = createRes.json().data.id;

    const viewer = await createTestUser(VIEWER_EMAIL, PASSWORD, 'VIEWER');
    await grantTestPermission(baId, viewer.id, 'VIEW', admin.id);

    const viewerToken = await loginAndGetToken(app, VIEWER_EMAIL, PASSWORD);
    const res = await authenticatedRequest(app, 'GET', `/api/business-areas/${baId}`, viewerToken);
    expect(res.statusCode).toBe(200);
  });

  it('cannot edit business areas with VIEW-only grant', async () => {
    const admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'View Only BA',
    });
    const baId = createRes.json().data.id;

    const viewer = await createTestUser(VIEWER_EMAIL, PASSWORD, 'VIEWER');
    await grantTestPermission(baId, viewer.id, 'VIEW', admin.id);

    const viewerToken = await loginAndGetToken(app, VIEWER_EMAIL, PASSWORD);
    const res = await authenticatedRequest(app, 'PUT', `/api/business-areas/${baId}`, viewerToken, {
      name: 'Hacked',
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// MANAGER can create/update but not delete business areas
// ---------------------------------------------------------------------------

describe('MANAGER role', () => {
  it('can list data sources', async () => {
    await createTestUser(MANAGER_EMAIL, PASSWORD, 'MANAGER');
    const token = await loginAndGetToken(app, MANAGER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'GET', '/api/data-sources', token);
    expect(res.statusCode).toBe(200);
  });

  it('cannot create business areas (admin only)', async () => {
    await createTestUser(MANAGER_EMAIL, PASSWORD, 'MANAGER');
    const token = await loginAndGetToken(app, MANAGER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'POST', '/api/business-areas', token, {
      name: 'Manager BA',
    });
    expect(res.statusCode).toBe(403);
  });

  it('cannot delete business areas (admin only)', async () => {
    const _admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'Manager No Delete BA',
    });
    const baId = createRes.json().data.id;

    await createTestUser(MANAGER_EMAIL, PASSWORD, 'MANAGER');
    const managerToken = await loginAndGetToken(app, MANAGER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'DELETE', `/api/business-areas/${baId}`, managerToken);
    expect(res.statusCode).toBe(403);
  });

  it('can create custom functions', async () => {
    await createTestUser(MANAGER_EMAIL, PASSWORD, 'MANAGER');
    const token = await loginAndGetToken(app, MANAGER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', token, {
      name: 'Manager Fn',
      functionType: 'SQL',
    });
    expect(res.statusCode).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// USER role — can read, cannot create admin-only resources
// ---------------------------------------------------------------------------

describe('USER role', () => {
  it('cannot list data sources', async () => {
    await createTestUser(USER_EMAIL, PASSWORD, 'USER');
    const token = await loginAndGetToken(app, USER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'GET', '/api/data-sources', token);
    expect(res.statusCode).toBe(403);
  });

  it('cannot create custom functions', async () => {
    await createTestUser(USER_EMAIL, PASSWORD, 'USER');
    const token = await loginAndGetToken(app, USER_EMAIL, PASSWORD);

    const res = await authenticatedRequest(app, 'POST', '/api/custom-functions', token, {
      name: 'User Fn',
      functionType: 'SQL',
    });
    expect(res.statusCode).toBe(403);
  });

  it('can view business areas with VIEW grant', async () => {
    const admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const createRes = await authenticatedRequest(app, 'POST', '/api/business-areas', adminToken, {
      name: 'User Visible BA',
    });
    const baId = createRes.json().data.id;

    const user = await createTestUser(USER_EMAIL, PASSWORD, 'USER');
    await grantTestPermission(baId, user.id, 'VIEW', admin.id);

    const userToken = await loginAndGetToken(app, USER_EMAIL, PASSWORD);
    const res = await authenticatedRequest(app, 'GET', `/api/business-areas/${baId}`, userToken);
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated access is denied
// ---------------------------------------------------------------------------

describe('Unauthenticated access', () => {
  it('returns 401 for all protected endpoints', async () => {
    const endpoints = [
      { method: 'GET' as const, url: '/api/business-areas' },
      { method: 'GET' as const, url: '/api/data-sources' },
      { method: 'GET' as const, url: '/api/custom-functions' },
      { method: 'GET' as const, url: '/api/auth/me' },
    ];

    for (const { method, url } of endpoints) {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(401);
    }
  });

  it('/health does not require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Cross-resource permission enforcement
// ---------------------------------------------------------------------------

describe('Business area permission enforcement on sub-resources', () => {
  it('VIEW grant allows reading folders but not creating', async () => {
    const admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const _adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const ba = await createTestBusinessArea('Folder Perm BA', admin.id);
    await createTestFolder(ba.id, 'Visible Folder', 'TABLE', admin.id);

    const user = await createTestUser(USER_EMAIL, PASSWORD, 'USER');
    await grantTestPermission(ba.id, user.id, 'VIEW', admin.id);

    const userToken = await loginAndGetToken(app, USER_EMAIL, PASSWORD);

    // Can list folders
    const listRes = await authenticatedRequest(
      app,
      'GET',
      `/api/business-areas/${ba.id}/folders`,
      userToken,
    );
    expect(listRes.statusCode).toBe(200);

    // Cannot create folders
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/business-areas/${ba.id}/folders`,
      userToken,
      { name: 'Should Fail', folderType: 'TABLE' },
    );
    expect(createRes.statusCode).toBe(403);
  });

  it('CREATE grant on BA is required for item operations (admin bypasses)', async () => {
    const admin = await createTestUser(ADMIN_EMAIL, PASSWORD, 'ADMIN');
    const adminToken = await loginAndGetToken(app, ADMIN_EMAIL, PASSWORD);

    const ba = await createTestBusinessArea('Item Perm BA', admin.id);
    const folder = await createTestFolder(ba.id, 'Item Perm Folder', 'TABLE', admin.id);

    // Admin can create items (bypasses all permission checks)
    const createRes = await authenticatedRequest(
      app,
      'POST',
      `/api/folders/${folder.id}/items`,
      adminToken,
      { name: 'Admin Item', itemType: 'CI', columnName: 'ADMIN_COL' },
    );
    expect(createRes.statusCode).toBe(201);

    // A regular user with no grant on the BA cannot delete items
    const _user = await createTestUser(USER_EMAIL, PASSWORD, 'USER');
    const userToken = await loginAndGetToken(app, USER_EMAIL, PASSWORD);
    const itemId = createRes.json().data.id;
    const delRes = await authenticatedRequest(app, 'DELETE', `/api/items/${itemId}`, userToken);
    expect(delRes.statusCode).toBe(403);
  });
});
