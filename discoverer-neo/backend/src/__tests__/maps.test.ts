import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../db/index.js';
import {
  users,
  businessAreas,
  userBusinessAreaGrants,
  folders,
  items,
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  mapCalculatedFields,
  mapShares,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let app: FastifyInstance;

const ADMIN_EMAIL = 'maps-admin@example.com';
const OWNER_EMAIL = 'maps-owner@example.com';
const VIEWER_EMAIL = 'maps-viewer@example.com';
const OUTSIDER_EMAIL = 'maps-outsider@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let adminToken: string;
let ownerToken: string;
let viewerToken: string;
let outsiderToken: string;

let ownerId: string;
let viewerId: string;

let baId: string;
let otherBaId: string;
let itemId1: string;
let itemId2: string;
let foreignItemId: string;

async function createTestUser(
  email: string,
  role: 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER' = 'USER',
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'Maps Test User', role })
    .returning();
  return user!;
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: TEST_PASSWORD },
  });
  return res.json().data.token as string;
}

async function cleanupTestData() {
  await db.delete(mapShares);
  await db.delete(mapCalculatedFields);
  await db.delete(mapParameters);
  await db.delete(mapConditions);
  await db.delete(mapItems);
  await db.delete(maps);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(userBusinessAreaGrants);
  await db.delete(businessAreas).where(eq(businessAreas.name, 'Maps Test BA'));
  await db
    .delete(businessAreas)
    .where(eq(businessAreas.name, 'Maps Other BA'));
  for (const email of [
    ADMIN_EMAIL,
    OWNER_EMAIL,
    VIEWER_EMAIL,
    OUTSIDER_EMAIL,
  ]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

function validMapPayload() {
  return {
    name: 'Sales by Region',
    description: 'Test map',
    mapType: 'TABLE',
    items: [
      { itemId: itemId1, displayName: 'Region' },
      { itemId: itemId2, aggFunction: 'SUM' },
    ],
    conditions: [
      {
        itemId: itemId1,
        operator: '=',
        conditionType: 'PARAMETER',
        paramName: 'p_region',
      },
    ],
    parameters: [
      {
        name: 'p_region',
        paramType: 'STRING',
        isRequired: true,
      },
    ],
    calculatedFields: [
      { name: 'Doubled', formula: 'AMOUNT * 2' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanupTestData();

  await createTestUser(ADMIN_EMAIL, 'ADMIN');
  const owner = await createTestUser(OWNER_EMAIL, 'USER');
  const viewer = await createTestUser(VIEWER_EMAIL, 'USER');
  await createTestUser(OUTSIDER_EMAIL, 'USER');
  ownerId = owner.id;
  viewerId = viewer.id;

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: 'Maps Test BA', description: 'BA for map tests' })
    .returning();
  baId = ba!.id;

  const [otherBa] = await db
    .insert(businessAreas)
    .values({ name: 'Maps Other BA', description: 'Unrelated BA' })
    .returning();
  otherBaId = otherBa!.id;

  // owner: CREATE grant (implies VIEW/EXPORT per hierarchy); viewer: VIEW only
  await db.insert(userBusinessAreaGrants).values([
    { userId: ownerId, businessAreaId: baId, permissionLevel: 'CREATE' },
    { userId: viewerId, businessAreaId: baId, permissionLevel: 'VIEW' },
  ]);

  const [folder] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'SALES',
      folderType: 'TABLE',
      tableName: 'SALES',
      displayOrder: 0,
    })
    .returning();

  const [foreignFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: otherBaId,
      name: 'OTHER',
      folderType: 'TABLE',
      tableName: 'OTHER',
      displayOrder: 0,
    })
    .returning();

  const [i1] = await db
    .insert(items)
    .values({
      folderId: folder!.id,
      name: 'Region',
      itemType: 'CI',
      columnName: 'REGION',
      displayOrder: 0,
    })
    .returning();
  itemId1 = i1!.id;

  const [i2] = await db
    .insert(items)
    .values({
      folderId: folder!.id,
      name: 'Amount',
      itemType: 'CI',
      columnName: 'AMOUNT',
      displayOrder: 1,
    })
    .returning();
  itemId2 = i2!.id;

  const [fi] = await db
    .insert(items)
    .values({
      folderId: foreignFolder!.id,
      name: 'Foreign',
      itemType: 'CI',
      columnName: 'FOREIGN_COL',
      displayOrder: 0,
    })
    .returning();
  foreignItemId = fi!.id;

  adminToken = await login(ADMIN_EMAIL);
  ownerToken = await login(OWNER_EMAIL);
  viewerToken = await login(VIEWER_EMAIL);
  outsiderToken = await login(OUTSIDER_EMAIL);
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Map management', () => {
  let mapId: string;

  it('creates a map with items, conditions, parameters, and calculated fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: validMapPayload(),
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    expect(data.name).toBe('Sales by Region');
    expect(data.items).toHaveLength(2);
    expect(data.conditions).toHaveLength(1);
    expect(data.parameters).toHaveLength(1);
    expect(data.calculatedFields).toHaveLength(1);
    mapId = data.id;
  });

  // The worksheet placement fields used to be accepted by the service but not
  // by the route's zod schema, which drops unknown keys silently — so opening a
  // migrated map in the builder and pressing Save wrote back a column list with
  // no axis, no hidden items and no group sorts. One edit undid the migration.
  it('keeps worksheet placement through a create and an update', async () => {
    const items = [
      {
        itemId: itemId1,
        displayName: 'Region',
        axisType: 'AXIS',
        axisEdge: 'COLUMN',
        axisOrder: 1,
        sortGroup: true,
      },
      { itemId: itemId2, aggFunction: 'SUM', axisType: 'MEASURE', isHidden: true },
    ];
    const payload = { ...validMapPayload(), items };

    const created = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });
    expect(created.statusCode).toBe(201);

    const byOrder = (data: { items: Record<string, unknown>[] }) =>
      [...data.items].sort(
        (a, b) => (a.displayOrder as number) - (b.displayOrder as number),
      );

    const createdItems = byOrder(created.json().data);
    expect(createdItems[0]).toMatchObject({
      axisType: 'AXIS',
      axisEdge: 'COLUMN',
      axisOrder: 1,
      sortGroup: true,
      isHidden: false,
    });
    expect(createdItems[1]).toMatchObject({ axisType: 'MEASURE', isHidden: true });

    // Re-sending what the builder loaded must not quietly strip any of it.
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/maps/${created.json().data.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { items },
    });
    expect(updated.statusCode).toBe(200);
    const updatedItems = byOrder(updated.json().data);
    expect(updatedItems[0]).toMatchObject({
      axisType: 'AXIS',
      axisEdge: 'COLUMN',
      sortGroup: true,
    });
    expect(updatedItems[1]).toMatchObject({ isHidden: true });
  });

  // A prompt named the way Discoverer's authors named them has to survive the
  // round trip as a prompt, while what the condition stores — and what will end
  // up after a colon in the generated SQL — is the derived bind name.
  it('derives a bind name for a prompt that could never be one', async () => {
    const payload = validMapPayload();
    payload.parameters = [
      { name: 'Dt Fim Vigência >=', paramType: 'STRING', isRequired: true },
    ];
    payload.conditions = [
      {
        itemId: itemId1,
        operator: '=',
        conditionType: 'PARAMETER',
        // Authored by prompt: a UI holding an unsaved parameter has no bind
        // name to offer yet.
        paramName: 'Dt Fim Vigência >=',
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    expect(data.parameters[0].name).toBe('Dt Fim Vigência >=');
    expect(data.parameters[0].bindName).toBe('DT_FIM_VIG_NCIA');
    expect(data.conditions[0].paramName).toBe('DT_FIM_VIG_NCIA');
  });

  it('accepts a condition that names its parameter by bind name', async () => {
    const payload = validMapPayload();
    payload.parameters = [
      { name: 'Apólice nº', paramType: 'STRING', isRequired: false },
    ];
    payload.conditions = [
      {
        itemId: itemId1,
        operator: '=',
        conditionType: 'PARAMETER',
        paramName: 'AP_LICE_N',
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.conditions[0].paramName).toBe('AP_LICE_N');
  });

  it('keeps two prompts that reduce to the same base apart', async () => {
    const payload = validMapPayload();
    payload.parameters = [
      { name: 'Dt Pedido <=', paramType: 'STRING', isRequired: false },
      { name: 'Dt Pedido >=', paramType: 'STRING', isRequired: false },
    ];
    payload.conditions = [
      {
        itemId: itemId1,
        operator: '=',
        conditionType: 'PARAMETER',
        paramName: 'Dt Pedido >=',
      },
    ];

    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    const binds = data.parameters.map((p: { bindName: string }) => p.bindName);
    expect(binds).toEqual(['DT_PEDIDO', 'DT_PEDIDO_2']);
    // The condition follows the prompt it was authored against, not the base
    // both prompts share.
    expect(data.conditions[0].paramName).toBe('DT_PEDIDO_2');
  });

  it('rejects a map with no items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { ...validMapPayload(), items: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects items from another business area', async () => {
    const payload = validMapPayload();
    payload.items.push({ itemId: foreignItemId, displayName: 'Nope' });
    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/business area/i);
  });

  it('rejects conditions referencing undefined parameters', async () => {
    const payload = validMapPayload();
    payload.conditions[0]!.paramName = 'p_missing';
    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/undefined parameter/i);
  });

  it('denies creation to users without a CREATE grant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: validMapPayload(),
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns the full map to a user with a VIEW grant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.id).toBe(mapId);
    expect(data.items).toHaveLength(2);
  });

  it('denies access to users with no grant, share, or ownership', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}`,
      headers: { authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for a nonexistent map', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/maps/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists maps in a business area', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.some((m: { id: string }) => m.id === mapId)).toBe(
      true,
    );
  });

  it('updates map metadata and replaces child collections', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${mapId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: 'Sales by Region v2',
        items: [{ itemId: itemId1 }],
        conditions: [],
        parameters: [],
        calculatedFields: [],
      },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.name).toBe('Sales by Region v2');
    expect(data.items).toHaveLength(1);
    expect(data.conditions).toHaveLength(0);
    expect(data.parameters).toHaveLength(0);
  });

  it('denies updates to a user with only a VIEW grant', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${mapId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Hijacked' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('duplicates a map with all child entities', async () => {
    // Restore children first so the copy is interesting
    await app.inject({
      method: 'PUT',
      url: `/api/maps/${mapId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        items: validMapPayload().items,
        conditions: validMapPayload().conditions,
        parameters: validMapPayload().parameters,
        calculatedFields: validMapPayload().calculatedFields,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/duplicate`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    expect(data.id).not.toBe(mapId);
    expect(data.name).toMatch(/copy/i);
    expect(data.isPublic).toBe(false);
    expect(data.items).toHaveLength(2);
    expect(data.conditions).toHaveLength(1);
    expect(data.parameters).toHaveLength(1);
    expect(data.calculatedFields).toHaveLength(1);
  });

  // A migrated Discoverer worksheet writes an axis, a position on it, an
  // item its query names but draws nowhere, and SELECT DISTINCT. A duplicate
  // that dropped them would turn a hidden item into a visible column.
  it('duplicates the worksheet layout: axis, position, hidden items and DISTINCT', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: `Layout Original ${Date.now()}`,
        mapType: 'CROSSTAB',
        items: [{ itemId: itemId1, displayOrder: 0 }, { itemId: itemId2, displayOrder: 1 }],
      },
    });
    expect(create.statusCode).toBe(201);
    const originalId = create.json().data.id as string;

    // The API has no surface for these yet — the migration writes them — so
    // the fixture sets them the way a migrated map arrives.
    await db.update(maps).set({ selectDistinct: true }).where(eq(maps.id, originalId));
    await db
      .update(mapItems)
      .set({ axisType: 'AXIS', axisOrder: 0 })
      .where(eq(mapItems.itemId, itemId1));
    await db
      .update(mapItems)
      .set({ axisType: 'MEASURE', axisOrder: 0, isHidden: true })
      .where(eq(mapItems.itemId, itemId2));

    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${originalId}/duplicate`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const copyId = res.json().data.id as string;

    const [copy] = await db.select().from(maps).where(eq(maps.id, copyId));
    expect(copy?.mapType).toBe('CROSSTAB');
    expect(copy?.selectDistinct).toBe(true);

    const copiedItems = await db.select().from(mapItems).where(eq(mapItems.mapId, copyId));
    expect(
      copiedItems
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((i) => [i.axisType, i.axisOrder, i.isHidden]),
    ).toEqual([
      ['AXIS', 0, false],
      ['MEASURE', 0, true],
    ]);
  });

  // The copy derives its own bind names, and in a different order than the
  // original was authored in (`getById` sorts parameters by name). Where two
  // prompts share a base that is a different assignment, so a condition
  // carried across by bind name would land on the wrong parameter.
  it('duplicates a map whose prompts share a bind base without swapping them', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/business-areas/${baId}/maps`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        ...validMapPayload(),
        name: 'Colliding prompts',
        // Authored in an order that is NOT alphabetical, so the copy's own
        // derivation runs over them the other way round.
        parameters: [
          { name: 'Dt Pedido >=', paramType: 'STRING', isRequired: false },
          { name: 'Dt Pedido <=', paramType: 'STRING', isRequired: false },
        ],
        conditions: [
          {
            itemId: itemId1,
            operator: '=',
            conditionType: 'PARAMETER',
            paramName: 'Dt Pedido <=',
          },
        ],
      },
    });
    expect(create.statusCode).toBe(201);
    const original = create.json().data;
    const originalBind = original.parameters.find(
      (p: { name: string }) => p.name === 'Dt Pedido <=',
    ).bindName;
    expect(original.conditions[0].paramName).toBe(originalBind);

    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${original.id}/duplicate`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const copy = res.json().data;

    const copyBind = copy.parameters.find(
      (p: { name: string }) => p.name === 'Dt Pedido <=',
    ).bindName;
    // The condition still filters on "Dt Pedido <=", whatever bind name the
    // copy gave it.
    expect(copy.conditions[0].paramName).toBe(copyBind);
  });

  it('exports the map definition as XML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/export`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.body).toContain('<?xml version="1.0"');
    expect(res.body).toContain('<map ');
    expect(res.body).toContain('<item ');
    expect(res.body).toContain('<parameter ');
  });

  it('lists own and shared maps under /api/maps', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/maps',
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(Array.isArray(data.mine)).toBe(true);
    expect(data.mine.some((m: { id: string }) => m.id === mapId)).toBe(true);
  });

  describe('sharing', () => {
    it('lets the owner share the map with another user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/maps/${mapId}/shares`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { userId: viewerId, permissionLevel: 'VIEW' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.permissionLevel).toBe('VIEW');
    });

    it('prevents a non-owner from managing shares', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/maps/${mapId}/shares`,
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { userId: viewerId, permissionLevel: 'EDIT' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('upgrades a share via PUT (upsert)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}/shares/${viewerId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { permissionLevel: 'EDIT' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.permissionLevel).toBe('EDIT');
    });

    it('shows the map under shared maps for the recipient', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/maps',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(
        data.shared.some((m: { id: string }) => m.id === mapId),
      ).toBe(true);
    });

    it('lists the map under GET /api/maps/shared-with-me for the recipient', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/maps/shared-with-me',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.some((m: { id: string }) => m.id === mapId)).toBe(true);
    });

    it('does not list the map under shared-with-me for its owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/maps/shared-with-me',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.some((m: { id: string }) => m.id === mapId)).toBe(false);
    });

    it('an EDIT share allows the recipient to update the map', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { description: 'updated by shared editor' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('lists the shares of a map for the owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/maps/${mapId}/shares`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json().data)).toBe(true);
    });

    it('rejects a share with an invalid permission level (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/maps/${mapId}/shares`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { userId: viewerId, permissionLevel: 'OWNER' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects sharing with a non-existent user (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/maps/${mapId}/shares`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          userId: '00000000-0000-4000-8000-000000000000',
          permissionLevel: 'VIEW',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/does not exist/i);
    });

    it('prevents a non-owner from updating a share (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}/shares/${viewerId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
        payload: { permissionLevel: 'VIEW' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects a share update with an invalid body (400)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}/shares/${viewerId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { permissionLevel: 'SUPER' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('prevents a non-owner from revoking a share (403)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/maps/${mapId}/shares/${viewerId}`,
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('404s revoking a share that does not exist', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/maps/${mapId}/shares/00000000-0000-4000-8000-000000000000`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('revokes a share', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/maps/${mapId}/shares/${viewerId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.revoked).toBe(true);
    });
  });

  describe('public maps', () => {
    it('a public map is viewable by any authenticated user', async () => {
      await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { isPublic: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('a public map is still not editable by outsiders', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${outsiderToken}` },
        payload: { name: 'Defaced' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('deletion', () => {
    it('soft-deletes the map', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);

      const after = await app.inject({
        method: 'GET',
        url: `/api/maps/${mapId}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(after.statusCode).toBe(404);
    });

    it('requires authentication for all map routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/maps' });
      expect(res.statusCode).toBe(401);
    });
  });
});
