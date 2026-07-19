/**
 * Map-execution HTTP route tests (`src/routes/map-execution.ts`).
 *
 * These focus on the parts of the handlers that do NOT need a live Oracle: the
 * auth/permission gates, param/body validation, the async job status/cancel
 * bookkeeping, execution history, and the CONFIG error branch (a map with no
 * data source fails in SQL generation, before any connection is attempted).
 * The query-executing happy path is covered against a fake Oracle connection
 * at the service level in map-execution.test.ts.
 */
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
  dataSources,
  folders,
  items,
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  queryExecutionLog,
} from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { closeAll as closeOraclePools } from '../services/oracle-connection-pool.js';

let app: FastifyInstance;

const OWNER_EMAIL = 'mx-owner@example.com';
const OTHER_EMAIL = 'mx-other@example.com';
const TEST_PASSWORD = 'SecurePass123!';

let ownerToken: string;
let otherToken: string;
let ownerId: string;
let baId: string;
let mapId: string;
let otherMapId: string;
let execMapId: string;
const DS_NAME = 'mx-exec-ds';

async function createTestUser(email: string) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: 'MX Test', role: 'USER' })
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

async function cleanup() {
  await db.delete(queryExecutionLog);
  await db.delete(mapConditions);
  await db.delete(mapParameters);
  await db.delete(mapItems);
  await db.delete(maps);
  await db.delete(items);
  await db.delete(folders);
  await db.delete(dataSources).where(eq(dataSources.name, DS_NAME));
  await db.delete(businessAreas).where(eq(businessAreas.name, 'MX Test BA'));
  for (const email of [OWNER_EMAIL, OTHER_EMAIL]) {
    await db.delete(users).where(eq(users.email, email));
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanup();

  const owner = await createTestUser(OWNER_EMAIL);
  await createTestUser(OTHER_EMAIL);
  ownerId = owner.id;

  const [ba] = await db
    .insert(businessAreas)
    .values({ name: 'MX Test BA' })
    .returning();
  baId = ba!.id;

  // A folder with NO dataSourceId — a map over it has no data source, so
  // execution fails in SQL generation (CONFIG) before touching Oracle.
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

  const [item] = await db
    .insert(items)
    .values({
      folderId: folder!.id,
      name: 'Amount',
      itemType: 'CI',
      columnName: 'AMOUNT',
      displayOrder: 0,
    })
    .returning();

  const [map] = await db
    .insert(maps)
    .values({
      name: 'MX Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  mapId = map!.id;
  await db.insert(mapItems).values({ mapId, itemId: item!.id, displayOrder: 0 });

  const [otherMap] = await db
    .insert(maps)
    .values({
      name: 'MX Other Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  otherMapId = otherMap!.id;

  // A fully-executable map: its folder has a (deliberately unreachable) Oracle
  // data source, so prepareQuery runs end-to-end — loadMapDefinition,
  // parameter resolution, security predicates, SQL generation — and only the
  // connection attempt fails. This exercises the whole query-preparation path.
  const [ds] = await db
    .insert(dataSources)
    .values({
      name: DS_NAME,
      connectionType: 'oracle',
      host: '127.0.0.1',
      port: 1,
      serviceName: 'NOPE',
      username: 'scott',
    })
    .returning();

  const [execFolder] = await db
    .insert(folders)
    .values({
      businessAreaId: baId,
      name: 'ORDERS',
      folderType: 'TABLE',
      tableName: 'ORDERS',
      tableOwner: 'APP',
      dataSourceId: ds!.id,
      displayOrder: 0,
    })
    .returning();

  const [execItem] = await db
    .insert(items)
    .values({
      folderId: execFolder!.id,
      name: 'Region',
      itemType: 'CI',
      columnName: 'REGION',
      dataType: 'VARCHAR2',
      displayOrder: 0,
    })
    .returning();

  const [execMap] = await db
    .insert(maps)
    .values({
      name: 'MX Exec Map',
      mapType: 'TABLE',
      businessAreaId: baId,
      createdBy: ownerId,
    })
    .returning();
  execMapId = execMap!.id;
  await db.insert(mapItems).values({ mapId: execMapId, itemId: execItem!.id, displayOrder: 0 });
  await db.insert(mapParameters).values({
    mapId: execMapId,
    name: 'p_region',
    paramType: 'STRING',
    isRequired: true,
  });
  await db.insert(mapConditions).values({
    mapId: execMapId,
    itemId: execItem!.id,
    operator: '=',
    conditionType: 'PARAMETER',
    paramName: 'p_region',
    logicOperator: 'AND',
    displayOrder: 0,
  });

  ownerToken = await login(OWNER_EMAIL);
  otherToken = await login(OTHER_EMAIL);
});

afterAll(async () => {
  await closeOraclePools();
  await cleanup();
  await app.close();
});

describe('POST /api/maps/:id/execute', () => {
  it('401s without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute`,
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('404s executing an unknown map', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/maps/00000000-0000-4000-8000-000000000000/execute',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('403s executing a map the caller cannot access', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('400s on an invalid body (bad offset)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { offset: -5 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Invalid request body');
  });

  it('maps a CONFIG execution error to 400 (no data source on the map)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { parameters: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().kind).toBe('CONFIG');
  });

  it('400s when a required parameter is missing (full prepareQuery path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${execMapId}/execute`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { parameters: {} },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().kind).toBe('CONFIG');
  });

  it('prepares the query fully then 502s on the unreachable connection', async () => {
    // With the required parameter supplied, loadMapDefinition + parameter
    // resolution + security predicates + SQL generation all succeed; only the
    // Oracle connect fails (CONNECT -> 502).
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${execMapId}/execute`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { parameters: { p_region: 'EMEA' } },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().kind).toBe('CONNECT');
  }, 30_000);
});

describe('POST /api/maps/:id/execute-async and status/cancel', () => {
  it('queues an async execution and returns a job id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().data.jobId).toBeTruthy();
  });

  it('400s on an invalid async body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { timeoutMs: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns status for a known job', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/executions/${jobId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.jobId).toBe(jobId);
  });

  it('404s for an unknown execution job', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/executions/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('404s when the job belongs to another map', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${otherMapId}/executions/${jobId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('cancels a known execution job', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/maps/${mapId}/execute-async`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {},
    });
    const jobId = create.json().data.jobId as string;
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${mapId}/executions/${jobId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveProperty('cancelled');
  });

  it('404s cancelling an unknown execution job', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/maps/${mapId}/executions/00000000-0000-4000-8000-000000000000`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/maps/:id/history', () => {
  it('returns execution history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/history?limit=10`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('403s reading history for a map the caller cannot access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/maps/${mapId}/history`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
