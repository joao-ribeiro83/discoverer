/**
 * Tests for the Oracle schema-introspection service.
 *
 * Redis is injected, so a small in-memory fake stands in for it. Real
 * `data_sources` rows drive the branch logic (unknown source, non-Oracle
 * source, unreachable Oracle). No live Oracle is needed: the connection
 * attempt against an unreachable host fails and is wrapped, and every
 * cache-hit path is exercised by pre-seeding the fake Redis.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import type { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import {
  introspectSchema,
  getTableInfo,
  testTableExists,
  invalidateCache,
  type IntrospectedTable,
} from '../services/oracle-introspection.js';

/** Minimal in-memory Redis supporting the get/setex/del the service uses. */
class FakeRedis {
  store = new Map<string, string>();
  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }
  setex(key: string, _ttl: number, val: string): Promise<'OK'> {
    this.store.set(key, val);
    return Promise.resolve('OK');
  }
  del(key: string): Promise<number> {
    const had = this.store.delete(key);
    return Promise.resolve(had ? 1 : 0);
  }
}

const CACHE_PREFIX = 'oracle:introspection:';
const ORACLE_DS_NAME = 'introspect-oracle';
const PG_DS_NAME = 'introspect-postgres';

let oracleDsId: string;
let pgDsId: string;
let redis: FakeRedis;

const sampleTables: IntrospectedTable[] = [
  {
    tableName: 'SALES',
    tableOwner: 'SCOTT',
    columns: [
      { columnName: 'AMOUNT', dataType: 'NUMBER', dataLength: 22, nullable: true },
    ],
  },
];

async function cleanup() {
  for (const name of [ORACLE_DS_NAME, PG_DS_NAME]) {
    await db.delete(dataSources).where(eq(dataSources.name, name));
  }
}

beforeAll(async () => {
  await cleanup();
  const [oracleDs] = await db
    .insert(dataSources)
    .values({
      name: ORACLE_DS_NAME,
      connectionType: 'oracle',
      host: '127.0.0.1',
      port: 1,
      serviceName: 'NOPE',
      username: 'scott',
    })
    .returning();
  oracleDsId = oracleDs!.id;

  const [pgDs] = await db
    .insert(dataSources)
    .values({ name: PG_DS_NAME, connectionType: 'postgres', host: '127.0.0.1', port: 5432 })
    .returning();
  pgDsId = pgDs!.id;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(() => {
  redis = new FakeRedis();
});

describe('introspectSchema cache paths', () => {
  it('returns cached tables without hitting the DB/Oracle', async () => {
    redis.store.set(`${CACHE_PREFIX}${oracleDsId}`, JSON.stringify(sampleTables));
    const result = await introspectSchema(oracleDsId, redis as unknown as Redis);
    expect(result).toEqual(sampleTables);
  });

  it('treats a corrupt cache entry as a miss', async () => {
    // Invalid JSON → getCached returns null → falls through to a DB lookup,
    // which (for an unknown id) then throws.
    redis.store.set(
      `${CACHE_PREFIX}00000000-0000-4000-8000-000000000000`,
      '{not json',
    );
    await expect(
      introspectSchema(
        '00000000-0000-4000-8000-000000000000',
        redis as unknown as Redis,
      ),
    ).rejects.toThrow(/Data source not found/);
  });
});

describe('introspectSchema validation branches', () => {
  it('throws for an unknown data source', async () => {
    await expect(
      introspectSchema(
        '00000000-0000-4000-8000-000000000000',
        redis as unknown as Redis,
      ),
    ).rejects.toThrow(/Data source not found/);
  });

  it('throws for a non-Oracle data source', async () => {
    await expect(
      introspectSchema(pgDsId, redis as unknown as Redis),
    ).rejects.toThrow(/only supported for Oracle/);
  });

  it('wraps a failed Oracle connection', async () => {
    await expect(
      introspectSchema(oracleDsId, redis as unknown as Redis),
    ).rejects.toThrow(/Oracle introspection failed/);
  }, 30_000);
});

describe('getTableInfo / testTableExists over cached data', () => {
  beforeEach(() => {
    redis.store.set(`${CACHE_PREFIX}${oracleDsId}`, JSON.stringify(sampleTables));
  });

  it('getTableInfo finds a table case-insensitively', async () => {
    const info = await getTableInfo(
      oracleDsId,
      'sales',
      'scott',
      redis as unknown as Redis,
    );
    expect(info?.tableName).toBe('SALES');
  });

  it('getTableInfo returns null for a missing table', async () => {
    const info = await getTableInfo(
      oracleDsId,
      'MISSING',
      'SCOTT',
      redis as unknown as Redis,
    );
    expect(info).toBeNull();
  });

  it('testTableExists reflects presence', async () => {
    await expect(
      testTableExists(oracleDsId, 'SALES', 'SCOTT', redis as unknown as Redis),
    ).resolves.toBe(true);
    await expect(
      testTableExists(oracleDsId, 'NOPE', 'SCOTT', redis as unknown as Redis),
    ).resolves.toBe(false);
  });
});

describe('invalidateCache', () => {
  it('deletes the cached entry', async () => {
    const key = `${CACHE_PREFIX}${oracleDsId}`;
    redis.store.set(key, JSON.stringify(sampleTables));
    await invalidateCache(redis as unknown as Redis, oracleDsId);
    expect(redis.store.has(key)).toBe(false);
  });
});
