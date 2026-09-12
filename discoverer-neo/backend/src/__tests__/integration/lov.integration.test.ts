import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { folders, itemClasses, items } from '../../db/schema.js';
import {
  resolveLov,
  LovError,
  type ResolveLovDeps,
} from '../../services/lov.service.js';
import { DataEntitlementError } from '../../services/business-area.service.js';
import {
  getApp,
  closeApp,
  createAdminWithToken,
  createTestUser,
  createTestBusinessArea,
  createTestDataSource,
  createTestFolder,
  createTestItem,
  grantTestPermission,
  cleanupIntegrationUsers,
} from './test-helper.js';

/**
 * The live list-of-values path, end to end against the target database.
 *
 * Oracle itself is stubbed — what is under test is everything around the
 * query: which column the LOV reads, whose entitlement gates it, what happens
 * when the source says the column is too wide for a dropdown, and what is
 * refused outright.
 */

let app: FastifyInstance;
let adminId: string;
let businessAreaId: string;
let folderId: string;

/** Records the SQL and binds the service would have sent, and replays rows. */
function stubOracle(rows: unknown[]): ResolveLovDeps & { sql: string; binds: unknown } {
  const spy = {
    sql: '',
    binds: {} as unknown,
    getConnection: async () =>
      ({
        execute: async (sql: string, binds: unknown) => {
          spy.sql = sql;
          spy.binds = binds;
          return { rows: rows.map((value) => ({ LOV_VALUE: value })) };
        },
      }) as never,
    releaseConnection: async () => {},
  };
  return spy;
}

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await cleanupIntegrationUsers();
  await closeApp();
});

beforeEach(async () => {
  await cleanupIntegrationUsers();
  const { user } = await createAdminWithToken(app);
  adminId = user.id;

  const ba = await createTestBusinessArea(`LOV BA ${Date.now()}`, adminId);
  businessAreaId = ba.id;
  const ds = await createTestDataSource(`LOV DS ${Date.now()}`, 'oracle');
  const folder = await createTestFolder(ba.id, `LOV Folder ${Date.now()}`, 'TABLE', adminId);
  folderId = folder.id;
  await db
    .update(folders)
    .set({ tableName: 'GL_BALANCES_V', tableOwner: 'GL', dataSourceId: ds.id })
    .where(eq(folders.id, folder.id));
});

const ADMIN = () => ({ id: adminId, role: 'ADMIN' });

// ---------------------------------------------------------------------------
// The fallback: an item with no class still gets a pick-list (Decision 8)
// ---------------------------------------------------------------------------

describe('an item with no item class', () => {
  it('reads its own column, live', async () => {
    const item = await createTestItem(folderId, 'Cost Centre', 'CI', 'COST_CENTRE', adminId);
    const oracle = stubOracle(['1000', '2000', '3000']);

    const result = await resolveLov(item.id, ADMIN(), {}, undefined, oracle);

    expect(result.mode).toBe('values');
    expect(result.values).toEqual(['1000', '2000', '3000']);
    // Null means it fell back: no class configured this.
    expect(result.itemClassId).toBeNull();
    expect(oracle.sql).toContain('DISTINCT "COST_CENTRE"');
    expect(oracle.sql).toContain('"GL"."GL_BALANCES_V"');
  });

  // A calculation has no base column, so there is nothing to select distinct
  // from. It stays a free-text box, which is what Discoverer showed anyway.
  it('refuses when the item is a calculation', async () => {
    const calc = await createTestItem(folderId, 'Margin', 'CU', undefined, adminId);
    await db.update(items).set({ columnName: null }).where(eq(items.id, calc.id));

    await expect(resolveLov(calc.id, ADMIN(), {}, undefined, stubOracle([]))).rejects.toThrow(
      LovError,
    );
  });

  it('refuses when the folder has no data source', async () => {
    await db.update(folders).set({ dataSourceId: null }).where(eq(folders.id, folderId));
    const item = await createTestItem(folderId, 'Orphan', 'CI', 'COST_CENTRE', adminId);

    await expect(
      resolveLov(item.id, ADMIN(), {}, undefined, stubOracle([])),
    ).rejects.toMatchObject({ kind: 'UNAVAILABLE' });
  });
});

// ---------------------------------------------------------------------------
// The configured path: an item class
// ---------------------------------------------------------------------------

describe('an item bound to an item class', () => {
  it('reads the class\'s LOV item and orders by its sort item', async () => {
    const prompted = await createTestItem(folderId, 'CC Prompt', 'CI', 'CC', adminId);
    const lovItem = await createTestItem(folderId, 'Cost Centre', 'CI', 'COST_CENTRE', adminId);
    const sortItem = await createTestItem(folderId, 'CC Seq', 'CI', 'COST_CENTRE_SEQ', adminId);
    const [cls] = await db
      .insert(itemClasses)
      .values({
        name: 'Cost Centre',
        sourceItemId: lovItem.id,
        sortItemId: sortItem.id,
        cached: true,
        cardinality: 42,
      })
      .returning();
    await db.update(items).set({ itemClassId: cls!.id }).where(eq(items.id, prompted.id));

    const oracle = stubOracle(['A']);
    const result = await resolveLov(prompted.id, ADMIN(), {}, undefined, oracle);

    expect(result.itemClassId).toBe(cls!.id);
    expect(result.cardinality).toBe(42);
    // The prompted item's own column is NOT what the LOV reads.
    expect(oracle.sql).toContain('DISTINCT "COST_CENTRE" AS LOV_VALUE');
    expect(oracle.sql).toContain('"COST_CENTRE_SEQ" AS LOV_SORT');
  });

  // Oracle's "long LOV": past a point the dropdown has to become a search box.
  it('degrades to search when the source says the column is too wide', async () => {
    const item = await createTestItem(folderId, 'Policy No', 'CI', 'POLICY_NO', adminId);
    const [cls] = await db
      .insert(itemClasses)
      .values({ name: 'Policy numbers', sourceItemId: item.id, cardinality: 900_000 })
      .returning();
    await db.update(items).set({ itemClassId: cls!.id }).where(eq(items.id, item.id));

    const oracle = stubOracle(['never asked']);
    const result = await resolveLov(item.id, ADMIN(), {}, undefined, oracle);

    expect(result.mode).toBe('search');
    expect(result.values).toEqual([]);
    // And it did not dump a million rows into a dropdown to find that out.
    expect(oracle.sql).toBe('');
  });

  it('runs the query once a search term narrows a wide column', async () => {
    const item = await createTestItem(folderId, 'Policy No', 'CI', 'POLICY_NO', adminId);
    const [cls] = await db
      .insert(itemClasses)
      .values({ name: 'Policy numbers', sourceItemId: item.id, cardinality: 900_000 })
      .returning();
    await db.update(items).set({ itemClassId: cls!.id }).where(eq(items.id, item.id));

    const oracle = stubOracle(['AB-1', 'AB-2']);
    const result = await resolveLov(item.id, ADMIN(), { search: 'ab' }, undefined, oracle);

    expect(result.mode).toBe('values');
    expect(result.values).toEqual(['AB-1', 'AB-2']);
    expect((oracle.binds as Record<string, unknown>).lov_search).toBe('AB');
  });
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

describe('a DATE column', () => {
  // Oracle's SELECT DISTINCT is distinct in Oracle's terms, and a DATE carries
  // a time. Two rows a second apart are two values to the database and one
  // string here, so the same day came back six times on the live estate.
  it('collapses timestamps that render as the same day', async () => {
    const item = await createTestItem(folderId, 'Data Estado', 'CI', 'DATA_ESTADO', adminId);
    const oracle = stubOracle([
      new Date('2018-03-27T09:00:00Z'),
      new Date('2018-03-27T17:30:00Z'),
      new Date('2018-03-28T08:00:00Z'),
    ]);

    const result = await resolveLov(item.id, ADMIN(), {}, undefined, oracle);

    expect(result.values).toEqual(['2018-03-27', '2018-03-28']);
  });
});

// ---------------------------------------------------------------------------
// Caps
// ---------------------------------------------------------------------------

describe('capping', () => {
  it('never returns more than the requested limit, and says it was cut', async () => {
    const item = await createTestItem(folderId, 'Cost Centre', 'CI', 'COST_CENTRE', adminId);
    // One more than the limit: the service fetches limit + 1 precisely so it
    // can tell a full page from a truncated one.
    const oracle = stubOracle(['a', 'b', 'c', 'd']);

    const result = await resolveLov(item.id, ADMIN(), { limit: 3 }, undefined, oracle);

    expect(result.values).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

describe('entitlement', () => {
  it('refuses a user with no grant on the folder\'s business area', async () => {
    const item = await createTestItem(folderId, 'Cost Centre', 'CI', 'COST_CENTRE', adminId);
    const outsider = await createTestUser(
      `lov-outsider-${Date.now()}@integration.test`,
      'Password123!',
      'USER',
    );

    await expect(
      resolveLov(item.id, { id: outsider.id, role: 'USER' }, {}, undefined, stubOracle(['x'])),
    ).rejects.toThrow(DataEntitlementError);
  });

  it('allows a granted user', async () => {
    const item = await createTestItem(folderId, 'Cost Centre', 'CI', 'COST_CENTRE', adminId);
    const member = await createTestUser(
      `lov-member-${Date.now()}@integration.test`,
      'Password123!',
      'USER',
    );
    await grantTestPermission(businessAreaId, member.id, 'VIEW', adminId);

    const result = await resolveLov(
      item.id,
      { id: member.id, role: 'USER' },
      {},
      undefined,
      stubOracle(['1000']),
    );

    expect(result.values).toEqual(['1000']);
  });
});
