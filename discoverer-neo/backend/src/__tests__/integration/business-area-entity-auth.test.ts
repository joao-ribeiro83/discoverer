import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { inArray } from 'drizzle-orm';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import {
  users,
  businessAreas,
  folders,
  items,
  joins,
  hierarchies,
  hierarchyLevels,
  userBusinessAreaGrants,
} from '../../db/schema.js';
import { FLAGS_FOR_JOIN_TYPE } from '../../services/join.service.js';
import { hashPassword } from '../../lib/password.js';

// ---------------------------------------------------------------------------
// Regression tests for grant-based access on entity-scoped routes.
//
// Routes keyed by a folder/item/join/hierarchy ID must resolve the OWNING
// business area before checking the user's grant. A previous bug passed the
// entity ID directly to the business-area grant lookup, so non-admin users
// with a legitimate grant always got 400/403 (admins bypass the check, which
// is why admin-only tests never caught it).
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const PASSWORD = 'SecurePass123!';
const ADMIN_EMAIL = 'entity-auth-admin@example.com';
const VIEWER_EMAIL = 'entity-auth-viewer@example.com'; // USER role, VIEW grant
const EDITOR_EMAIL = 'entity-auth-editor@example.com'; // USER role, EDIT grant
const OWNER_EMAIL = 'entity-auth-owner@example.com'; // USER role, DELETE grant
const OUTSIDER_EMAIL = 'entity-auth-outsider@example.com'; // USER role, no grant
const ALL_EMAILS = [ADMIN_EMAIL, VIEWER_EMAIL, EDITOR_EMAIL, OWNER_EMAIL, OUTSIDER_EMAIL];

const BA_NAME = 'Entity Auth BA';
const OTHER_BA_NAME = 'Entity Auth Other BA';

const NONEXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

let adminToken: string;
let viewerToken: string;
let editorToken: string;
let ownerToken: string;
let outsiderToken: string;

let viewerId: string;
let editorId: string;
let ownerId: string;

let testBusinessAreaId: string;
let otherBusinessAreaId: string;
let testFolderId: string; // in test BA
let secondFolderId: string; // in test BA (right side of the join)
let otherFolderId: string; // in the other BA
let testItemId: string; // in testFolderId
let otherItemId: string; // in otherFolderId
let testJoinId: string;
let testHierarchyId: string;

async function loginAndReturnToken(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PASSWORD },
  });
  return res.json().data.token as string;
}

async function cleanupTestData() {
  // Folders, items, joins, hierarchies, levels, and grants all cascade from
  // the business area delete.
  await db
    .delete(businessAreas)
    .where(inArray(businessAreas.name, [BA_NAME, OTHER_BA_NAME]));
}

async function setupTestData() {
  const [ba] = await db
    .insert(businessAreas)
    .values({ name: BA_NAME, description: 'Entity auth test BA' })
    .returning();
  testBusinessAreaId = ba!.id;

  const [otherBa] = await db
    .insert(businessAreas)
    .values({ name: OTHER_BA_NAME, description: 'BA the users have no grant on' })
    .returning();
  otherBusinessAreaId = otherBa!.id;

  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId: testBusinessAreaId,
      name: 'Entity Auth Folder',
      folderType: 'TABLE',
      displayOrder: 0,
    })
    .returning();
  testFolderId = folder!.id;

  const [secondFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: testBusinessAreaId,
      name: 'Entity Auth Second Folder',
      folderType: 'TABLE',
      displayOrder: 1,
    })
    .returning();
  secondFolderId = secondFolder!.id;

  const [otherFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: otherBusinessAreaId,
      name: 'Entity Auth Other Folder',
      folderType: 'TABLE',
      displayOrder: 0,
    })
    .returning();
  otherFolderId = otherFolder!.id;

  const [item] = await db
    .insert(items)
    .values({
      folderId: testFolderId,
      name: 'Entity Auth Item',
      itemType: 'CI',
      columnName: 'AUTH_COL',
      displayOrder: 0,
    })
    .returning();
  testItemId = item!.id;

  const [otherItem] = await db
    .insert(items)
    .values({
      folderId: otherFolderId,
      name: 'Entity Auth Other Item',
      itemType: 'CI',
      columnName: 'OTHER_COL',
      displayOrder: 0,
    })
    .returning();
  otherItemId = otherItem!.id;

  const [join] = await db
    .insert(joins)
    .values({
      name: 'Entity Auth Join',
      leftFolderId: testFolderId,
      rightFolderId: secondFolderId,
      ...FLAGS_FOR_JOIN_TYPE.INNER,
    })
    .returning();
  testJoinId = join!.id;

  const [hierarchy] = await db
    .insert(hierarchies)
    .values({
      name: 'Entity Auth Hierarchy',
      businessAreaId: testBusinessAreaId,
    })
    .returning();
  testHierarchyId = hierarchy!.id;

  await db.insert(hierarchyLevels).values({
    hierarchyId: testHierarchyId,
    levelName: 'L1',
    itemId: testItemId,
    levelNumber: 1,
  });

  await db.insert(userBusinessAreaGrants).values([
    { userId: viewerId, businessAreaId: testBusinessAreaId, permissionLevel: 'VIEW' },
    { userId: editorId, businessAreaId: testBusinessAreaId, permissionLevel: 'EDIT' },
    { userId: ownerId, businessAreaId: testBusinessAreaId, permissionLevel: 'DELETE' },
  ]);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Users are never mutated by these tests, so create them (and log in) once.
  await db.delete(users).where(inArray(users.email, ALL_EMAILS));
  const passwordHash = await hashPassword(PASSWORD);
  const rows = await db
    .insert(users)
    .values([
      { email: ADMIN_EMAIL, passwordHash, name: 'Entity Auth Admin', role: 'ADMIN' },
      { email: VIEWER_EMAIL, passwordHash, name: 'Entity Auth Viewer', role: 'USER' },
      { email: EDITOR_EMAIL, passwordHash, name: 'Entity Auth Editor', role: 'USER' },
      { email: OWNER_EMAIL, passwordHash, name: 'Entity Auth Owner', role: 'USER' },
      { email: OUTSIDER_EMAIL, passwordHash, name: 'Entity Auth Outsider', role: 'USER' },
    ])
    .returning();

  viewerId = rows.find((u) => u.email === VIEWER_EMAIL)!.id;
  editorId = rows.find((u) => u.email === EDITOR_EMAIL)!.id;
  ownerId = rows.find((u) => u.email === OWNER_EMAIL)!.id;

  adminToken = await loginAndReturnToken(ADMIN_EMAIL);
  viewerToken = await loginAndReturnToken(VIEWER_EMAIL);
  editorToken = await loginAndReturnToken(EDITOR_EMAIL);
  ownerToken = await loginAndReturnToken(OWNER_EMAIL);
  outsiderToken = await loginAndReturnToken(OUTSIDER_EMAIL);
});

afterAll(async () => {
  await cleanupTestData();
  await db.delete(users).where(inArray(users.email, ALL_EMAILS));
  await app.close();
});

beforeEach(async () => {
  await cleanupTestData();
  await setupTestData();
});

// ---------------------------------------------------------------------------
// Folder-scoped item routes (/api/folders/:folderId/...)
// ---------------------------------------------------------------------------

describe('Folder-scoped routes resolve grants via the owning business area', () => {
  it('allows a USER with a VIEW grant to list items in a folder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
  });

  it('forbids a USER with no grant from listing items in a folder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a USER with an EDIT grant to create an item in a folder', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Created By Editor', itemType: 'CI', columnName: 'EDITOR_COL' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.name).toBe('Created By Editor');
  });

  it('forbids a USER with only a VIEW grant from creating an item', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Created By Viewer', itemType: 'CI', columnName: 'VIEWER_COL' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a USER with an EDIT grant to import items from Oracle columns', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/folders/${testFolderId}/items/import`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        columns: [{ columnName: 'IMPORTED_COL', dataType: 'VARCHAR2' }],
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows a USER with a VIEW grant to get join suggestions for a folder', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}/joins/suggestions`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Item routes keyed by item ID
// ---------------------------------------------------------------------------

describe('Item :id routes resolve grants via folder -> business area', () => {
  it('allows a USER with an EDIT grant to update an item', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${testItemId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Renamed Item' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('Renamed Item');
  });

  it('forbids a USER with only a VIEW grant from updating an item', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${testItemId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Viewer Rename' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a USER with a DELETE grant to delete an item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/items/${testItemId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('forbids a USER with an EDIT grant from deleting an item', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/items/${testItemId}`,
      headers: { authorization: `Bearer ${editorToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('forbids updating an item in a business area the user has no grant on', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${otherItemId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Cross-BA Rename' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for a granted USER updating a non-existent item', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${NONEXISTENT_UUID}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Ghost' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('still allows ADMIN to update an item (bypass unchanged)', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/items/${testItemId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Admin Rename' },
    });

    expect(response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Join routes keyed by join ID
// ---------------------------------------------------------------------------

describe('Join :id routes resolve grants via folder -> business area', () => {
  it('allows a USER with an EDIT grant to update a join', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/joins/${testJoinId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Renamed Join' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('Renamed Join');
  });

  it('allows a USER with a DELETE grant to delete a join', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/joins/${testJoinId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('forbids a USER with no grant from updating a join', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/joins/${testJoinId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
      payload: { name: 'Outsider Rename' },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Hierarchy routes keyed by hierarchy ID
// ---------------------------------------------------------------------------

describe('Hierarchy :id routes resolve grants via the owning business area', () => {
  it('allows a USER with an EDIT grant to update a hierarchy', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/hierarchies/${testHierarchyId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Renamed Hierarchy' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('Renamed Hierarchy');
  });

  it('allows a USER with a DELETE grant to delete a hierarchy', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/hierarchies/${testHierarchyId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('forbids a USER with only a VIEW grant from updating a hierarchy', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/hierarchies/${testHierarchyId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Viewer Rename' },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Folder routes keyed by folder ID
// ---------------------------------------------------------------------------

describe('Folder :id routes resolve grants via the owning business area', () => {
  it('allows a USER with an EDIT grant to update a folder', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/folders/${testFolderId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Renamed Folder' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.name).toBe('Renamed Folder');
  });

  it('allows a USER with a DELETE grant to delete a folder', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/folders/${testFolderId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('forbids a USER with no grant from updating a folder', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/folders/${testFolderId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
      payload: { name: 'Outsider Rename' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('forbids a USER with only a VIEW grant from deleting a folder', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/folders/${testFolderId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(response.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Read-side scoping.
//
// Five GET-by-id routes carried `preHandler: [fastify.authenticate]` and
// nothing else, so any signed-in user could read folder table names, item
// column names and data types, and join column pairs for business areas they
// hold no grant on — the schema of the warehouse, one id at a time.
//
// The guards already existed and were already used for EDIT and DELETE on the
// same entities. These are the five read routes that were missing them.
// ---------------------------------------------------------------------------

describe('Entity GET-by-id routes are grant-scoped', () => {
  const cases: Array<{ what: string; url: () => string }> = [
    { what: 'a folder', url: () => `/api/folders/${otherFolderId}` },
    { what: 'an item', url: () => `/api/items/${otherItemId}` },
    { what: 'item descendants', url: () => `/api/items/${otherItemId}/descendants` },
  ];

  for (const { what, url } of cases) {
    it(`forbids a granted USER from reading ${what} in another business area`, async () => {
      const response = await app.inject({
        method: 'GET',
        url: url(),
        headers: { authorization: `Bearer ${viewerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it(`forbids an ungranted USER from reading ${what}`, async () => {
      const response = await app.inject({
        method: 'GET',
        url: url(),
        headers: { authorization: `Bearer ${outsiderToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  }

  it('forbids an ungranted USER from reading a join', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/joins/${testJoinId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('forbids an ungranted USER from reading a hierarchy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/hierarchies/${testHierarchyId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('still lets a granted USER read a folder in their own business area', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${testFolderId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('still lets a granted USER read an item, its descendants, a join and a hierarchy', async () => {
    for (const url of [
      `/api/items/${testItemId}`,
      `/api/items/${testItemId}/descendants`,
      `/api/joins/${testJoinId}`,
      `/api/hierarchies/${testHierarchyId}`,
    ]) {
      const response = await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${viewerToken}` },
      });

      expect([url, response.statusCode]).toEqual([url, 200]);
    }
  });

  it('still lets ADMIN read across business areas (bypass unchanged)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/folders/${otherFolderId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
  });
});
