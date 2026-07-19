import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { getApp } from './test-helper.js';
import { db } from '../../db/index.js';
import {
  businessAreas,
  folders,
  items,
  maps,
  mapItems,
  mapShares,
  users,
} from '../../db/schema.js';
import { hashPassword } from '../../lib/password.js';

// ===========================================================================
// Map sharing — end-to-end access-control integration tests (Session 5.7)
//
// Drives the real Fastify app (auth + map + map-shares + business-area-auth
// middleware) against the live Postgres. No Oracle is involved: these tests
// assert the permission model on the metadata routes, not query execution.
//
// Permission ladder (map.service.SHARE_ALLOWS): VIEW ⊂ EXPORT ⊂ EDIT.
// ===========================================================================

const PW = 'SecurePass123!';
const NS = 'int57-share';
const OWNER_EMAIL = `${NS}-owner@test.com`;
const SHAREE_EMAIL = `${NS}-sharee@test.com`;
const OTHER_EMAIL = `${NS}-other@test.com`;
const BA_NAME = 'Int57 Sharing Business Area';

let app: FastifyInstance;

let ownerId: string;
let shareeId: string;
let otherId: string;
let ownerToken: string;
let shareeToken: string;
let otherToken: string;

let baId: string;
let itemId: string;
let privateMapId: string;
let publicMapId: string;

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function createUser(email: string, role: 'ADMIN' | 'USER') {
  const passwordHash = await hashPassword(PW);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: `Share ${role}`, role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: PW },
  });
  return res.json().data.token as string;
}

/** A minimal valid update body (PUT requires the full items list). */
function updateBody(name: string) {
  return {
    name,
    items: [{ itemId, displayOrder: 0 }],
  };
}

async function cleanup(): Promise<void> {
  const baRows = await db
    .select({ id: businessAreas.id })
    .from(businessAreas)
    .where(eq(businessAreas.name, BA_NAME));
  const baIds = baRows.map((b) => b.id);
  if (baIds.length) {
    const mapRows = await db
      .select({ id: maps.id })
      .from(maps)
      .where(inArray(maps.businessAreaId, baIds));
    const mapIds = mapRows.map((m) => m.id);
    if (mapIds.length) {
      await db.delete(mapShares).where(inArray(mapShares.mapId, mapIds));
      await db.delete(mapItems).where(inArray(mapItems.mapId, mapIds));
      await db.delete(maps).where(inArray(maps.id, mapIds));
    }
    await db.delete(items).where(
      inArray(
        items.folderId,
        (
          await db
            .select({ id: folders.id })
            .from(folders)
            .where(inArray(folders.businessAreaId, baIds))
        ).map((f) => f.id),
      ),
    );
    await db.delete(folders).where(inArray(folders.businessAreaId, baIds));
    await db.delete(businessAreas).where(inArray(businessAreas.id, baIds));
  }
  await db.delete(users).where(inArray(users.email, [OWNER_EMAIL, SHAREE_EMAIL, OTHER_EMAIL]));
}

beforeAll(async () => {
  app = await getApp();
  await cleanup();

  ownerId = (await createUser(OWNER_EMAIL, 'USER')).id;
  shareeId = (await createUser(SHAREE_EMAIL, 'USER')).id;
  otherId = (await createUser(OTHER_EMAIL, 'USER')).id;
  ownerToken = await login(OWNER_EMAIL);
  shareeToken = await login(SHAREE_EMAIL);
  otherToken = await login(OTHER_EMAIL);

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: BA_NAME, createdBy: ownerId })
    .returning();
  baId = ba!.id;

  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'SHARE_FOLDER',
      folderType: 'TABLE',
      tableName: 'SHARE_TBL',
      tableOwner: 'APP',
      createdBy: ownerId,
    })
    .returning();

  const [item] = await db
    .insert(items)
    .values({
      folderId: folder!.id,
      name: 'Code',
      itemType: 'CI',
      columnName: 'CODE',
      createdBy: ownerId,
    })
    .returning();
  itemId = item!.id;

  const [privateMap] = await db
    .insert(maps)
    .values({
      name: 'Int57 Private Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
      isPublic: false,
    })
    .returning();
  privateMapId = privateMap!.id;
  await db.insert(mapItems).values({ mapId: privateMapId, itemId, displayOrder: 0 });

  const [publicMap] = await db
    .insert(maps)
    .values({
      name: 'Int57 Public Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
      isPublic: true,
    })
    .returning();
  publicMapId = publicMap!.id;
  await db.insert(mapItems).values({ mapId: publicMapId, itemId, displayOrder: 0 });
}, 60_000);

afterAll(async () => {
  await cleanup();
});

// ---------------------------------------------------------------------------
// 1. Before any share exists: a non-owner cannot see a private map at all.
// ---------------------------------------------------------------------------

describe('private map with no share', () => {
  it('lets the owner view it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(ownerToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('403s a stranger who has no share and no BA grant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 2. Share at VIEW: sharee can view but not edit; not exportable at VIEW.
// ---------------------------------------------------------------------------

describe('share at VIEW', () => {
  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${privateMapId}/shares`,
      headers: authHeaders(ownerToken),
      payload: { userId: shareeId, permissionLevel: 'VIEW' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('lets the sharee VIEW the map', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('surfaces the map in the sharee\'s shared-with-me list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/maps/shared-with-me',
      headers: authHeaders(shareeToken),
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().data as Array<{ id: string; sharePermission: string }>;
    const entry = list.find((m) => m.id === privateMapId);
    expect(entry).toBeDefined();
    expect(entry?.sharePermission).toBe('VIEW');
  });

  it('403s the sharee attempting to EDIT (write) the map', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
      payload: updateBody('Int57 Private Map (hacked)'),
    });
    expect(res.statusCode).toBe(403);
  });

  it('403s the sharee attempting to EXPORT at VIEW level', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${privateMapId}/export`,
      headers: authHeaders(shareeToken),
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('403s the sharee attempting to DELETE the map', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 3. Upgrade to EDIT: the same sharee can now edit (and export).
// ---------------------------------------------------------------------------

describe('upgrade share to EDIT', () => {
  beforeAll(async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${privateMapId}/shares/${shareeId}`,
      headers: authHeaders(ownerToken),
      payload: { permissionLevel: 'EDIT' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('now lets the sharee EDIT the map', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
      payload: updateBody('Int57 Private Map (edited by sharee)'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Int57 Private Map (edited by sharee)');
  });

  it('EDIT implies EXPORT (queues an export job)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${privateMapId}/export`,
      headers: authHeaders(shareeToken),
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(202);
  });

  it('does NOT let the EDIT-sharee re-share the map (owner/admin only)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${privateMapId}/shares`,
      headers: authHeaders(shareeToken),
      payload: { userId: otherId, permissionLevel: 'VIEW' },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 4. Revoke: the sharee loses access entirely.
// ---------------------------------------------------------------------------

describe('revoke share', () => {
  beforeAll(async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${privateMapId}/shares/${shareeId}`,
      headers: authHeaders(ownerToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('403s the former sharee on a subsequent view', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${privateMapId}`,
      headers: authHeaders(shareeToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('drops the map from the former sharee\'s shared-with-me list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/maps/shared-with-me',
      headers: authHeaders(shareeToken),
    });
    const list = res.json().data as Array<{ id: string }>;
    expect(list.find((m) => m.id === privateMapId)).toBeUndefined();
  });

  it('404s revoking a share that no longer exists', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${privateMapId}/shares/${shareeId}`,
      headers: authHeaders(ownerToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 5. Public map: any authenticated user can view/export without a share.
// ---------------------------------------------------------------------------

describe('public map', () => {
  it('lets an arbitrary authenticated user (no share) VIEW it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${publicMapId}`,
      headers: authHeaders(otherToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it('lets that user EXPORT it (public implies VIEW+EXPORT)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${publicMapId}/export`,
      headers: authHeaders(otherToken),
      payload: { format: 'CSV' },
    });
    expect(res.statusCode).toBe(202);
  });

  it('still does NOT let a non-owner EDIT a public map', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${publicMapId}`,
      headers: authHeaders(otherToken),
      payload: updateBody('Int57 Public Map (hacked)'),
    });
    expect(res.statusCode).toBe(403);
  });

  it('401s an unauthenticated request even for a public map', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/maps/${publicMapId}` });
    expect(res.statusCode).toBe(401);
  });
});
