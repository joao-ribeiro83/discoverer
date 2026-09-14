/**
 * Conditional format HTTP route tests (`src/routes/conditional-formats.ts`).
 *
 * Kept off `PUT /api/maps/:id` on purpose (see `map.service.ts`'s
 * `AnchoredChildren`), so this exercises its own CRUD lifecycle against real
 * Postgres: creation, listing, update, delete, and the ownership/validation
 * gates.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { db } from '../../db/index.js';
import { maps, mapItems } from '../../db/schema.js';
import {
  getApp,
  closeApp,
  cleanupIntegrationUsers,
  createTestUser,
  loginAndGetToken,
  createTestBusinessArea,
  createTestFolder,
  createTestItem,
} from './test-helper.js';

let app: FastifyInstance;
let ownerToken: string;
let otherToken: string;
let mapId: string;
let mapItemId: string;

beforeAll(async () => {
  app = await getApp();
  await cleanupIntegrationUsers();

  const owner = await createTestUser(`cf-owner-${Date.now()}@test.com`, 'Pw123456!', 'USER');
  const other = await createTestUser(`cf-other-${Date.now()}@test.com`, 'Pw123456!', 'USER');
  ownerToken = await loginAndGetToken(app, owner.email, 'Pw123456!');
  otherToken = await loginAndGetToken(app, other.email, 'Pw123456!');

  const ba = await createTestBusinessArea(`CF BA ${Date.now()}`, owner.id);
  const folder = await createTestFolder(ba.id, `CF Folder ${Date.now()}`, 'TABLE', owner.id);
  const item = await createTestItem(folder.id, 'Amount', 'CI', 'AMOUNT', owner.id);

  const [map] = await db
    .insert(maps)
    .values({ name: 'CF Map', mapType: 'TABLE', businessAreaId: ba.id, createdBy: owner.id })
    .returning();
  mapId = map!.id;

  const [mi] = await db
    .insert(mapItems)
    .values({ mapId, itemId: item.id, displayOrder: 0 })
    .returning();
  mapItemId = mi!.id;
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

describe('conditional formats CRUD', () => {
  it('401s without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/conditional-formats`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('403s a caller with no access to the map', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('starts empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it('refuses a rule pointing at a column from another map', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        mapItemId: '00000000-0000-4000-8000-000000000000',
        target: 'CELL',
        operator: '>',
        value: '1000',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('not part of this map');
  });

  let formatId: string;

  it('creates a rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        mapItemId,
        target: 'CELL',
        operator: '>',
        value: '1000',
        backgroundColor: '#ffcc00',
        isBold: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.mapItemId).toBe(mapItemId);
    expect(body.operator).toBe('>');
    expect(body.value).toBe('1000');
    expect(body.backgroundColor).toBe('#ffcc00');
    expect(body.isBold).toBe(true);
    formatId = body.id;
  });

  it('lists the created rule', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].id).toBe(formatId);
  });

  it('updates a rule', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${mapId}/conditional-formats/${formatId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { value: '2000', target: 'ROW' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.value).toBe('2000');
    expect(res.json().data.target).toBe('ROW');
    // Untouched fields survive a partial update.
    expect(res.json().data.backgroundColor).toBe('#ffcc00');
  });

  it('404s updating a rule that does not exist', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/maps/${mapId}/conditional-formats/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { value: '3000' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('a caller with no access cannot delete it', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${mapId}/conditional-formats/${formatId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('deletes a rule', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${mapId}/conditional-formats/${formatId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(204);

    const list = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/conditional-formats`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(list.json().data).toEqual([]);
  });
});
