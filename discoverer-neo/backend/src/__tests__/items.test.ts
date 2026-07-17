import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import { users, businessAreas, folders, items } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const TEST_EMAIL = 'item-test@example.com';
const TEST_ADMIN_EMAIL = 'item-admin@example.com';
const TEST_MANAGER_EMAIL = 'item-manager@example.com';
const TEST_PASSWORD = 'SecurePass123!';
const TEST_NAME = 'Item Test User';

let testBusinessAreaId: string;
let testFolderId: string;

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
      description: 'Test business area for item tests',
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

describe('Item CRUD', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('creates a CI item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Employee ID',
        itemType: 'CI',
        columnName: 'EMPLOYEE_ID',
        dataType: 'NUMBER',
        displayOrder: 1,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe('Employee ID');
    expect(body.data.itemType).toBe('CI');
    expect(body.data.columnName).toBe('EMPLOYEE_ID');
  });

  it('rejects CI item without columnName', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad CI',
        itemType: 'CI',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('columnName is required');
  });

  it('creates a CU item with formula', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Annual Salary',
        itemType: 'CU',
        formula: 'SALARY * 12',
        dataType: 'NUMBER',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.itemType).toBe('CU');
    expect(body.data.formula).toBe('SALARY * 12');
  });

  it('rejects CU item without formula', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad CU',
        itemType: 'CU',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('formula is required');
  });

  it('creates a CO (calculated) item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bonus Amount',
        itemType: 'CO',
        formula: 'SALARY * 0.1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.itemType).toBe('CO');
  });

  it('creates a JI (join item)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Department Name',
        itemType: 'JI',
        columnName: 'DEPARTMENT_NAME',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.itemType).toBe('JI');
  });

  it('creates a HI (hierarchy item)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Org Hierarchy',
        itemType: 'HI',
        columnName: 'ORG_LEVEL',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.itemType).toBe('HI');
  });

  it('creates an AG (aggregate) item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Total Salary',
        itemType: 'AG',
        columnName: 'SALARY',
        aggFunction: 'SUM',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.itemType).toBe('AG');
    expect(response.json().data.aggFunction).toBe('SUM');
  });

  it('creates a FU (function) item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Formatted Date',
        itemType: 'FU',
        formula: 'TO_CHAR(HIRE_DATE, "YYYY-MM-DD")',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.itemType).toBe('FU');
  });

  it('returns 400 on invalid request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: '',
        itemType: 'INVALID',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 on invalid folder ID format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/folders/not-a-uuid/items',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Test',
        itemType: 'CI',
        columnName: 'TEST_COL',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Item listing', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    await db.insert(items).values([
      {
        folderId: testFolderId,
        name: 'Item A',
        itemType: 'CI',
        columnName: 'COL_A',
        displayOrder: 2,
      },
      {
        folderId: testFolderId,
        name: 'Item B',
        itemType: 'CI',
        columnName: 'COL_B',
        displayOrder: 1,
      },
    ]);
  });

  it('lists items in a folder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    // Should be ordered by displayOrder
    expect(body.data[0].displayOrder).toBeLessThanOrEqual(body.data[1].displayOrder);
  });

  it('does not include soft-deleted items in listing', async () => {
    await db
      .update(items)
      .set({ isActive: false })
      .where(eq(items.name, 'Item A'));

    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('Item B');
  });
});

describe('Item get by ID', () => {
  let adminToken: string;
  let itemId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [item] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'Test Item',
        itemType: 'CI',
        columnName: 'TEST_COL',
      })
      .returning();
    itemId = item!.id;
  });

  it('returns an item by ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/items/${itemId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.id).toBe(itemId);
    expect(body.data.name).toBe('Test Item');
  });

  it('returns 404 for non-existent item', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/items/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('Item not found');
  });

  it('returns 400 for invalid ID format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/items/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Item update', () => {
  let adminToken: string;
  let itemId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [item] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'Original Name',
        itemType: 'CI',
        columnName: 'ORIG_COL',
        displayOrder: 0,
      })
      .returning();
    itemId = item!.id;
  });

  it('updates an item', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${itemId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Updated Name',
        displayOrder: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.name).toBe('Updated Name');
    expect(body.data.displayOrder).toBe(5);
  });

  it('returns 404 when updating non-existent item', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/items/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'New Name' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Item soft delete', () => {
  let adminToken: string;
  let itemId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    const [item] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'To Delete',
        itemType: 'CI',
        columnName: 'DEL_COL',
      })
      .returning();
    itemId = item!.id;
  });

  it('soft-deactivates an item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/items/${itemId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.message).toBe('Item deactivated');

    // Verify the row still exists but is_active is false
    const [row] = await db
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    expect(row).toBeDefined();
    expect(row!.isActive).toBe(false);
  });

  it('returns 404 when deleting non-existent item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/items/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Formula validation', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('rejects formula with DROP statement', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Drop Formula',
        itemType: 'CU',
        formula: 'DROP TABLE EMPLOYEES',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('DROP');
  });

  it('rejects formula with CREATE statement', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Create Formula',
        itemType: 'CU',
        formula: 'CREATE TABLE TEST (ID NUMBER)',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('CREATE');
  });

  it('rejects formula with INSERT statement', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Insert Formula',
        itemType: 'CU',
        formula: 'INSERT INTO EMPLOYEES VALUES (1)',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('INSERT');
  });

  it('rejects formula with mismatched parentheses', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Bad Parens',
        itemType: 'CU',
        formula: 'SUM((SALARY * 12',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('parentheses');
  });

  it('accepts valid formula', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Valid Formula',
        itemType: 'CU',
        formula: 'SALARY * 12 + NVL(BONUS, 0)',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('accepts formula with function calls', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Function Formula',
        itemType: 'CU',
        formula: 'TO_CHAR(HIRE_DATE, "YYYY-MM-DD")',
      },
    });

    expect(response.statusCode).toBe(201);
  });
});

describe('Oracle import', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);
  });

  it('imports columns as CI items', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items/import`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        columns: [
          { columnName: 'EMPLOYEE_ID', dataType: 'NUMBER', dataLength: 6, nullable: false },
          { columnName: 'FIRST_NAME', dataType: 'VARCHAR2', dataLength: 50, nullable: true },
          { columnName: 'LAST_NAME', dataType: 'VARCHAR2', dataLength: 50, nullable: false },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.created.length).toBe(3);
    expect(body.data.skipped.length).toBe(0);
    expect(body.data.created[0].columnName).toBe('EMPLOYEE_ID');
  });

  it('skips duplicate columns', async () => {
    // First import
    await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items/import`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        columns: [
          { columnName: 'EMPLOYEE_ID', dataType: 'NUMBER', dataLength: 6 },
        ],
      },
    });

    // Second import with same column
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items/import`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        columns: [
          { columnName: 'EMPLOYEE_ID', dataType: 'NUMBER', dataLength: 6 },
          { columnName: 'NEW_COLUMN', dataType: 'VARCHAR2', dataLength: 100 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.created.length).toBe(1);
    expect(body.data.skipped.length).toBe(1);
    expect(body.data.skipped[0].reason).toContain('already exists');
  });

  it('returns 400 for empty columns array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items/import`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        columns: [],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Hierarchical items', () => {
  let adminToken: string;
  let parentId: string;
  let childId: string;
  let grandchildId: string;

  beforeEach(async () => {
    await createTestUser(TEST_ADMIN_EMAIL, TEST_PASSWORD, 'ADMIN');
    adminToken = await loginAndReturnToken(TEST_ADMIN_EMAIL, TEST_PASSWORD);

    // Create parent item
    const [parent] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'Parent',
        itemType: 'HI',
        columnName: 'PARENT_COL',
      })
      .returning();
    parentId = parent!.id;

    // Create child item
    const [child] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'Child',
        itemType: 'HI',
        columnName: 'CHILD_COL',
        parentItemId: parentId,
      })
      .returning();
    childId = child!.id;

    // Create grandchild item
    const [grandchild] = await db
      .insert(items)
      .values({
        folderId: testFolderId,
        name: 'Grandchild',
        itemType: 'HI',
        columnName: 'GRANDCHILD_COL',
        parentItemId: childId,
      })
      .returning();
    grandchildId = grandchild!.id;
  });

  it('gets all descendants of a hierarchical item', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/items/${parentId}/descendants`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    const names = body.data.map((i: any) => i.name);
    expect(names).toContain('Child');
    expect(names).toContain('Grandchild');
  });

  it('returns empty array for item with no descendants', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/items/${grandchildId}/descendants`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBe(0);
  });

  it('returns 404 for non-existent item', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/items/00000000-0000-0000-0000-000000000000/descendants',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('Permission enforcement', () => {
  it('requires authentication to list items', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/items`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('requires authentication to create item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      payload: {
        name: 'Test',
        itemType: 'CI',
        columnName: 'TEST',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('requires authentication to delete item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/items/00000000-0000-0000-0000-000000000000',
    });

    expect(response.statusCode).toBe(401);
  });
});
