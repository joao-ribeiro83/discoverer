import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { db } from '../../db/index.js';
import {
  users,
  dataSources,
  businessAreas,
  userBusinessAreaGrants,
  folders,
  items,
  joins,
  hierarchies,
  hierarchyLevels,
  customFunctions,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';

// ---------------------------------------------------------------------------
// App lifecycle — singleton to avoid multiple DB pools
// ---------------------------------------------------------------------------

let appInstance: FastifyInstance | null = null;
let appReady = false;

export async function getApp(): Promise<FastifyInstance> {
  if (!appInstance || !appReady) {
    appInstance = await buildApp();
    await appInstance.ready();
    appReady = true;
  }
  return appInstance;
}

export async function closeApp(): Promise<void> {
  // Don't actually close — we reuse across test suites.
  // Jest --forceExit handles cleanup.
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

export async function createTestUser(
  email: string,
  password: string,
  role: Role = 'USER',
) {
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: `Test ${role}`, role })
    .returning();
  if (!user) {
    throw new Error(`Failed to create test user ${email}`);
  }
  return user;
}

export async function loginAndGetToken(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed for ${email}: ${res.body}`);
  }
  return res.json().data.token as string;
}

/**
 * Create a test admin user and return both the user record and a JWT.
 */
export async function createAdminWithToken(app: FastifyInstance) {
  const email = `int-admin-${Date.now()}@test.com`;
  const password = 'AdminPass123!';
  const user = await createTestUser(email, password, 'ADMIN');
  const token = await loginAndGetToken(app, email, password);
  return { user, token };
}

// ---------------------------------------------------------------------------
// Authenticated request helper
// ---------------------------------------------------------------------------

export function authenticatedRequest(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  token: string,
  data?: Record<string, unknown>,
) {
  const payload: Record<string, unknown> = {
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
  };
  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    payload.payload = data;
  }
  return app.inject(payload);
}

// ---------------------------------------------------------------------------
// Cleanup — delete test data in FK order
// ---------------------------------------------------------------------------

export async function cleanupAllTestData(): Promise<void> {
  // Delete in reverse FK dependency order
  await db.delete(hierarchyLevels);
  await db.delete(hierarchies);
  await db.delete(joins);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(userBusinessAreaGrants);
  await db.delete(businessAreas);
  await db.delete(dataSources);
  // Only delete test users (not seed users)
  await db.delete(users).where(eq(users.email, 'admin@discoverer.local'));
}

/**
 * More targeted cleanup: delete all rows created during integration tests.
 * Uses email prefix pattern (int-*) to identify test users.
 */
export async function cleanupIntegrationUsers(): Promise<void> {
  // We delete by direct DB calls — this is safe for test teardown.
  // Order matters: child tables first, users last (many tables FK to users).
  await db.delete(hierarchyLevels);
  await db.delete(hierarchies);
  await db.delete(joins);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(userBusinessAreaGrants);
  await db.delete(businessAreas);
  await db.delete(dataSources);
  // Delete all users — this is a test database and we recreate per test
  await db.delete(users);
}

// ---------------------------------------------------------------------------
// Fixture helpers — create DB records directly for test setup
// ---------------------------------------------------------------------------

export async function createTestDataSource(
  name: string = `Test DS ${Date.now()}`,
  connectionType: 'oracle' | 'postgres' = 'postgres',
) {
  const [ds] = await db
    .insert(dataSources)
    .values({
      name,
      connectionType,
      host: 'localhost',
      port: 5432,
    })
    .returning();
  if (!ds) throw new Error(`Failed to create test data source ${name}`);
  return ds;
}

export async function createTestBusinessArea(
  name: string = `Test BA ${Date.now()}`,
  createdBy: string,
) {
  const [ba] = await db
    .insert(businessAreas)
    .values({ name, createdBy })
    .returning();
  if (!ba) throw new Error(`Failed to create test business area ${name}`);
  return ba;
}

export async function grantTestPermission(
  businessAreaId: string,
  userId: string,
  permissionLevel: 'CREATE' | 'EDIT' | 'DELETE' | 'EXPORT' | 'SCHEDULE' | 'VIEW',
  grantedBy: string,
) {
  const [grant] = await db
    .insert(userBusinessAreaGrants)
    .values({ businessAreaId, userId, permissionLevel, grantedBy })
    .returning();
  if (!grant) throw new Error(`Failed to grant ${permissionLevel} on ${businessAreaId}`);
  return grant;
}

export async function createTestFolder(
  businessAreaId: string,
  name: string = `Test Folder ${Date.now()}`,
  folderType: 'TABLE' | 'VIEW' | 'DERIVED' | 'COMPLEX' | 'JOIN' | 'SUMMARY' = 'TABLE',
  createdBy?: string,
) {
  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId,
      name,
      folderType,
      createdBy: createdBy ?? null,
    })
    .returning();
  if (!folder) throw new Error(`Failed to create test folder ${name}`);
  return folder;
}

export async function createTestItem(
  folderId: string,
  name: string = `Test Item ${Date.now()}`,
  itemType: 'CI' | 'CU' | 'CO' | 'JI' | 'HI' | 'AG' | 'FU' = 'CI',
  columnName?: string,
  createdBy?: string,
) {
  const [item] = await db
    .insert(items)
    .values({
      folderId,
      name,
      itemType,
      columnName: columnName ?? (itemType === 'CI' ? 'TEST_COL' : null),
      createdBy: createdBy ?? null,
    })
    .returning();
  if (!item) throw new Error(`Failed to create test item ${name}`);
  return item;
}
