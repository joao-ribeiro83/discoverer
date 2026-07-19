import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users, businessAreas, folders, items, hierarchies, hierarchyLevels } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'hierarchy-test@example.com';
const TEST_ADMIN_EMAIL = 'hierarchy-admin@example.com';
const TEST_MANAGER_EMAIL = 'hierarchy-manager@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Hierarchy Test User';

let testBusinessAreaId: string;
let testFolderId: string;
let testItemId1: string;
let testItemId2: string;

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
  return user!;
}

async function cleanupTestData() {
  await db.delete(hierarchyLevels);
  await db.delete(hierarchies);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(businessAreas).where(eq(businessAreas.name, 'Test BA'));
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_ADMIN_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_MANAGER_EMAIL));
}

async function loginAndReturnToken(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  return res.json().data.token as string;
}

async function setupTestData() {
  const [ba] = await db
    .insert(businessAreas)
    .values({
      name: 'Test BA',
      description: 'Test business area for hierarchy tests',
    })
    .returning();
  testBusinessAreaId = ba!.id;

  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId: testBusinessAreaId,
      name: 'Test Folder',
      folderType: 'TABLE',
      displayOrder: 0,
    })
    .returning();
  testFolderId = folder!.id;

  const [item1] = await db
    .insert(items)
    .values({
      folderId: testFolderId,
      name: 'Item One',
      itemType: 'CI',
      columnName: 'COL_ONE',
      displayOrder: 0,
    })
    .returning();
  testItemId1 = item1!.id;

  const [item2] = await db
    .insert(items)
    .values({
      folderId: testFolderId,
      name: 'Item Two',
      itemType: 'CI',
      columnName: 'COL_TWO',
      displayOrder: 1,
    })
    .returning();
  testItemId2 = item2!.id;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await setupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

beforeEach(async () => {
  await cleanupTestData();
  await setupTestData();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Hierarchy CRUD with levels', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('creates a hierarchy with levels', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Org Hierarchy',
        description: 'Test hierarchy',
        levels: [
          { levelName: 'Top', itemId: testItemId1, levelNumber: 1 },
          { levelName: 'Bottom', itemId: testItemId2, levelNumber: 2 },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.name).toBe('Org Hierarchy');
    expect(body.data.levels).toHaveLength(2);
    // Levels should be ordered by levelNumber
    expect(body.data.levels[0].levelNumber).toBe(1);
    expect(body.data.levels[0].levelName).toBe('Top');
    expect(body.data.levels[1].levelNumber).toBe(2);
  });

  it('rejects hierarchy creation with empty levels', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Empty Hierarchy',
        levels: [],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects hierarchy creation with duplicate level numbers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Dup Hierarchy',
        levels: [
          { levelName: 'A', itemId: testItemId1, levelNumber: 1 },
          { levelName: 'B', itemId: testItemId2, levelNumber: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('unique');
  });

  it('rejects hierarchy creation when item does not belong to business area', async () => {
    // Create another business area + folder + item
    const [otherBa] = await db
      .insert(businessAreas)
      .values({ name: 'Other BA' })
      .returning();
    const [otherFolder] = await db
      .insert(folders)
      .values({
        businessAreaId: otherBa!.id,
        name: 'Other Folder',
        folderType: 'TABLE',
        displayOrder: 0,
      })
      .returning();
    const [otherItem] = await db
      .insert(items)
      .values({
        folderId: otherFolder!.id,
        name: 'Other Item',
        itemType: 'CI',
        columnName: 'OTHER_COL',
        displayOrder: 0,
      })
      .returning();

    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Cross-BA Hierarchy',
        levels: [
          { levelName: 'Bad', itemId: otherItem!.id, levelNumber: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('does not belong');

    // Cleanup
    await db.delete(items).where(eq(items.id, otherItem!.id));
    await db.delete(folders).where(eq(folders.id, otherFolder!.id));
    await db.delete(businessAreas).where(eq(businessAreas.id, otherBa!.id));
  });

  it('gets a hierarchy with levels', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Fetch Me',
        levels: [
          { levelName: 'L1', itemId: testItemId1, levelNumber: 1 },
          { levelName: 'L2', itemId: testItemId2, levelNumber: 2 },
        ],
      },
    });
    const id = createRes.json().data.id;

    const response = await app.inject({
      method: 'GET',
      url: `/api/hierarchies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(id);
    expect(body.data.levels).toHaveLength(2);
  });

  it('returns 404 for non-existent hierarchy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/hierarchies/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('lists hierarchies in a business area', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Listed Hierarchy',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('updates a hierarchy and replaces levels', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Old Name',
        levels: [{ levelName: 'Old', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    const id = createRes.json().data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/hierarchies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'New Name',
        levels: [
          { levelName: 'New1', itemId: testItemId1, levelNumber: 1 },
          { levelName: 'New2', itemId: testItemId2, levelNumber: 2 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.name).toBe('New Name');
    expect(body.data.levels).toHaveLength(2);
  });

  it('soft-deletes a hierarchy', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'To Delete',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    const id = createRes.json().data.id;

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/hierarchies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/hierarchies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('returns 404 updating a non-existent hierarchy', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/hierarchies/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Ghost' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('returns 400 updating with an invalid item reference', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Valid Base',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    const id = createRes.json().data.id;

    const response = await app.inject({
      method: 'PUT',
      url: `/api/hierarchies/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        levels: [
          {
            levelName: 'Bad',
            itemId: '00000000-0000-4000-8000-000000000000',
            levelNumber: 1,
          },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 deleting a non-existent hierarchy', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/hierarchies/00000000-0000-4000-8000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('Hierarchy validation endpoint', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('validates valid levels', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies/validate-levels`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        levels: [
          { levelName: 'L1', itemId: testItemId1, levelNumber: 1 },
          { levelName: 'L2', itemId: testItemId2, levelNumber: 2 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.valid).toBe(true);
  });

  it('rejects invalid item reference', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies/validate-levels`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        levels: [
          { levelName: 'Bad', itemId: '00000000-0000-0000-0000-000000000000', levelNumber: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Hierarchy permission enforcement', () => {
  let managerToken: string;
  let userToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_MANAGER_EMAIL, TEST_PASSWORD, 'MANAGER');
    managerToken = await loginAndReturnToken(TEST_MANAGER_EMAIL, TEST_PASSWORD);
    await createTestUser(TEST_EMAIL, TEST_PASSWORD, 'USER');
    userToken = await loginAndReturnToken(TEST_EMAIL, TEST_PASSWORD);
  });

  it('allows ADMIN to create', async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    const adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Admin Hierarchy',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    expect(response.statusCode).toBe(201);
  });

  it('forbids USER role from creating (no grant on BA)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        name: 'User Hierarchy',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    // Without a grant on the business area, the permission middleware rejects.
    expect([400, 403]).toContain(response.statusCode);
  });

  it('allows MANAGER with CREATE grant to create', async () => {
    const { userBusinessAreaGrants } = await import('../db/schema.js');
    await db.insert(userBusinessAreaGrants).values({
      userId: (await db.select().from(users).where(eq(users.email, TEST_MANAGER_EMAIL)))[0]!.id,
      businessAreaId: testBusinessAreaId,
      permissionLevel: 'CREATE',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/hierarchies`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        name: 'Manager Hierarchy',
        levels: [{ levelName: 'L1', itemId: testItemId1, levelNumber: 1 }],
      },
    });
    expect(response.statusCode).toBe(201);
  });
});
