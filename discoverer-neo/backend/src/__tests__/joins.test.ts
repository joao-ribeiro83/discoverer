import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users, businessAreas, folders, items, joins } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'join-test@example.com';
const TEST_ADMIN_EMAIL = 'join-admin@example.com';
const TEST_MANAGER_EMAIL = 'join-manager@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Join Test User';

let testBusinessAreaId: string;
let testLeftFolderId: string;
let testRightFolderId: string;
let testLeftItemId: string;
let testRightItemId: string;

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
  await db.delete(joins);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(businessAreas).where(eq(businessAreas.name, 'Test BA'));
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_ADMIN_EMAIL));
  await db.delete(users).where(eq(users.email, TEST_MANAGER_EMAIL));
}

async function loginAndReturnToken(
  email: string,
  password: string,
): Promise<string> {
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
      description: 'Test business area for join tests',
    })
    .returning();
  testBusinessAreaId = ba!.id;

  const [leftFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: testBusinessAreaId,
      name: 'Left Folder',
      folderType: 'TABLE',
      displayOrder: 0,
    })
    .returning();
  testLeftFolderId = leftFolder!.id;

  const [rightFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: testBusinessAreaId,
      name: 'Right Folder',
      folderType: 'TABLE',
      displayOrder: 1,
    })
    .returning();
  testRightFolderId = rightFolder!.id;

  const [leftItem] = await db
    .insert(items)
    .values({
      folderId: testLeftFolderId,
      name: 'Employee ID',
      itemType: 'CI',
      columnName: 'EMPLOYEE_ID',
      displayOrder: 0,
    })
    .returning();
  testLeftItemId = leftItem!.id;

  const [rightItem] = await db
    .insert(items)
    .values({
      folderId: testRightFolderId,
      name: 'Employee ID',
      itemType: 'CI',
      columnName: 'EMPLOYEE_ID',
      displayOrder: 0,
    })
    .returning();
  testRightItemId = rightItem!.id;
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

describe('Join CRUD', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('creates a join with folder IDs only', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Emp Dept Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Emp Dept Join');
    expect(body.data.joinType).toBe('INNER');
    expect(body.data.leftFolderId).toBe(testLeftFolderId);
    expect(body.data.rightFolderId).toBe(testRightFolderId);
  });

  it('creates a join with item IDs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Emp ID Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        leftItemId: testLeftItemId,
        rightItemId: testRightItemId,
        joinType: 'LEFT',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.joinType).toBe('LEFT');
    expect(body.data.leftItemId).toBe(testLeftItemId);
    expect(body.data.rightItemId).toBe(testRightItemId);
  });

  it('creates a join with all join types', async () => {
    const joinTypes = ['INNER', 'LEFT', 'RIGHT', 'FULL'] as const;

    for (const joinType of joinTypes) {
      // Clean up previous
      await db.delete(joins);

      const response = await app.inject({
        method: 'POST',
        url: `/api/business-areas/${testBusinessAreaId}/joins`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Join ${joinType}`,
          leftFolderId: testLeftFolderId,
          rightFolderId: testRightFolderId,
          joinType,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.joinType).toBe(joinType);
    }
  });

  it('returns 400 on invalid request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: '',
        leftFolderId: 'not-a-uuid',
        joinType: 'INVALID',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 on invalid business area ID format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/business-areas/not-a-uuid/joins',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Test',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Join validation', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('rejects join when item does not belong to folder', async () => {
    // Create an item in a different folder
    const [otherFolder] = await db
      .insert(folders)
      .values({
        businessAreaId: testBusinessAreaId,
        name: 'Other Folder',
        folderType: 'TABLE',
      })
      .returning();

    const [otherItem] = await db
      .insert(items)
      .values({
        folderId: otherFolder!.id,
        name: 'Other Item',
        itemType: 'CI',
        columnName: 'OTHER_COL',
      })
      .returning();

    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        leftItemId: otherItem!.id, // Item belongs to otherFolder, not testLeftFolderId
        rightItemId: testRightItemId,
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('does not belong');
  });

  it('rejects join when item does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Item Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        leftItemId: '00000000-0000-0000-0000-000000000000',
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('does not exist');
  });

  it('rejects join when folder does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Folder Join',
        leftFolderId: '00000000-0000-0000-0000-000000000000',
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('does not exist');
  });
});

describe('Join listing', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    await db.insert(joins).values([
      {
        name: 'Join 1',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      },
      {
        name: 'Join 2',
        leftFolderId: testRightFolderId,
        rightFolderId: testLeftFolderId,
        joinType: 'LEFT',
      },
    ]);
  });

  it('lists joins in a business area', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
  });

  it('does not include soft-deleted joins in listing', async () => {
    await db
      .update(joins)
      .set({ isActive: false })
      .where(eq(joins.name, 'Join 1'));

    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('Join 2');
  });
});

describe('Join get by ID', () => {
  let adminToken: string;
  let joinId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [join] = await db
      .insert(joins)
      .values({
        name: 'Test Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        leftItemId: testLeftItemId,
        rightItemId: testRightItemId,
        joinType: 'INNER',
      })
      .returning();
    joinId = join!.id;
  });

  it('returns a join by ID with details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/joins/${joinId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(joinId);
    expect(body.data.name).toBe('Test Join');
    expect(body.data.leftFolderName).toBe('Left Folder');
    expect(body.data.rightFolderName).toBe('Right Folder');
    expect(body.data.leftItemName).toBe('Employee ID');
    expect(body.data.rightItemName).toBe('Employee ID');
  });

  it('returns 404 for non-existent join', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/joins/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('Join not found');
  });

  it('returns 400 for invalid ID format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/joins/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Join update', () => {
  let adminToken: string;
  let joinId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [join] = await db
      .insert(joins)
      .values({
        name: 'Original Join',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      })
      .returning();
    joinId = join!.id;
  });

  it('updates a join', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/joins/${joinId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Updated Join',
        joinType: 'LEFT',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.name).toBe('Updated Join');
    expect(body.data.joinType).toBe('LEFT');
  });

  it('returns 404 when updating non-existent join', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/joins/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'New Name' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Join soft delete', () => {
  let adminToken: string;
  let joinId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [join] = await db
      .insert(joins)
      .values({
        name: 'To Delete',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      })
      .returning();
    joinId = join!.id;
  });

  it('soft-deactivates a join', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/joins/${joinId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.message).toBe('Join deactivated');

    // Verify the row still exists but is_active is false
    const [row] = await db
      .select()
      .from(joins)
      .where(eq(joins.id, joinId))
      .limit(1);

    expect(row).toBeDefined();
    expect(row!.isActive).toBe(false);
  });

  it('returns 404 when deleting non-existent join', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/joins/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Auto-suggest joins', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('suggests joins based on matching column names', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testLeftFolderId}/joins/suggestions`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    // Both folders have an item named 'Employee ID' so there should be a suggestion
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    if (body.data.length > 0) {
      expect(body.data[0].leftColumnName).toBe('EMPLOYEE_ID');
      expect(body.data[0].rightColumnName).toBe('EMPLOYEE_ID');
      expect(body.data[0].suggestedJoinType).toBe('INNER');
    }
  });

  it('returns empty array when no matching columns', async () => {
    // Create a folder with a unique item
    const [uniqueFolder] = await db
      .insert(folders)
      .values({
        businessAreaId: testBusinessAreaId,
        name: 'Unique Folder',
        folderType: 'TABLE',
      })
      .returning();

    await db.insert(items).values({
      folderId: uniqueFolder!.id,
      name: 'Unique Column',
      itemType: 'CI',
      columnName: 'UNIQUE_COL_XYZ',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${uniqueFolder!.id}/joins/suggestions`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(0);
  });

  it('returns 404 for non-existent folder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/folders/00000000-0000-0000-0000-000000000000/joins/suggestions',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Permission enforcement', () => {
  it('requires authentication to list joins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('requires authentication to create join', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${testBusinessAreaId}/joins`,
      payload: {
        name: 'Test',
        leftFolderId: testLeftFolderId,
        rightFolderId: testRightFolderId,
        joinType: 'INNER',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('requires authentication to delete join', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/joins/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(401);
  });
});
