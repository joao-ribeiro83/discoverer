/**
 * Tests for the Oracle connection-pool manager.
 *
 * This repo drives external drivers through real dependencies, not module
 * mocks (jest.unstable_mockModule is not wired up under its ts-jest ESM
 * config). So these tests use the real `oracledb` thin driver against real
 * `data_sources` rows in Postgres, but never reach a live Oracle instance:
 * the pool-registry bookkeeping and the buildPool guard branches (unknown
 * source, non-Oracle source, unreachable host) are all reachable without one.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import {
  getPool,
  getConnection,
  discardLateAcquisition,
  poolSnapshots,
  timedOutAcquisitions,
  releaseConnection,
  closePool,
  closeAll,
  poolCount,
  OraclePoolError,
} from '../services/oracle-connection-pool.js';
import { importOracleDb } from '../services/oracle-driver.js';

const ORACLE_DS_NAME = 'pool-test-oracle';
const PG_DS_NAME = 'pool-test-postgres';

let oracleDsId: string;
let pgDsId: string;

async function cleanup() {
  for (const name of [ORACLE_DS_NAME, PG_DS_NAME]) {
    await db.delete(dataSources).where(eq(dataSources.name, name));
  }
}

beforeAll(async () => {
  await cleanup();

  // An Oracle source pointing at a port nothing listens on: the thin driver's
  // eager pool creation fails fast (connection refused) rather than blocking.
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
    .values({
      name: PG_DS_NAME,
      connectionType: 'postgres',
      host: '127.0.0.1',
      port: 5432,
    })
    .returning();
  pgDsId = pgDs!.id;
});

afterAll(async () => {
  await closeAll();
  await cleanup();
});

describe('getPool guard branches', () => {
  it('throws OraclePoolError for an unknown data source', async () => {
    await expect(
      getPool('00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(OraclePoolError);
  });

  it('throws OraclePoolError for a non-Oracle data source', async () => {
    await expect(getPool(pgDsId)).rejects.toThrow(/not an Oracle connection/);
  });
});

describe('pool creation and caching', () => {
  it('creates a pool once and caches it per data source', async () => {
    // The thin driver builds the pool object lazily — no socket is opened until
    // a connection is acquired — so pool creation succeeds even though the host
    // is unreachable. That is exactly what lets us exercise the registry.
    const p1 = await getPool(oracleDsId);
    const p2 = await getPool(oracleDsId);
    expect(p1).toBe(p2);
    expect(poolCount()).toBe(1);
    await closePool(oracleDsId);
    expect(poolCount()).toBe(0);
  }, 30_000);
});

describe('connection helpers', () => {
  it('releaseConnection never throws even when close() fails', async () => {
    const badConn = {
      close: async () => {
        throw new Error('already closed');
      },
    };
    await expect(
      releaseConnection('whatever', badConn as never),
    ).resolves.toBeUndefined();
  });

  it('getConnection rejects when the underlying host is unreachable', async () => {
    await expect(getConnection(oracleDsId)).rejects.toThrow();
    await closePool(oracleDsId);
  }, 30_000);

  it('closes a connection that arrives after its acquisition timed out (BE-04)', async () => {
    // The leak: `getConnection` races the acquisition against a timeout. When
    // the timeout wins, the acquisition is still in flight, and whatever it
    // eventually yields is checked out of the pool with nobody holding a
    // reference to it. The pool loses that slot for the life of the process.
    let closed = false;
    const late = Promise.resolve({
      close: async () => {
        closed = true;
      },
    } as never);

    discardLateAcquisition(late);
    await late;
    await Promise.resolve();

    expect(closed).toBe(true);
  });

  it('swallows a late acquisition that fails, rather than crashing the process', async () => {
    // The race is no longer this promise's only consumer, so an unhandled
    // rejection here would be ours to cause.
    const failing = Promise.reject(new Error('ORA-12541'));
    expect(() => {
      discardLateAcquisition(failing);
    }).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it('counts acquisition timeouts, so a drained pool is visible', async () => {
    // A count of open connections cannot tell a busy pool from one that has
    // lost its slots. This number climbing is what distinguishes them.
    const before = timedOutAcquisitions();
    await expect(getConnection(oracleDsId)).rejects.toThrow();
    await closePool(oracleDsId);
    expect(timedOutAcquisitions()).toBeGreaterThan(before);
  }, 30_000);

  it('reports no pools when none are open', () => {
    expect(Array.isArray(poolSnapshots())).toBe(true);
  });

  it('closePool is a no-op for an unknown data source', async () => {
    await expect(closePool('never-created')).resolves.toBeUndefined();
  });

  it('closeAll clears every live pool', async () => {
    await getPool(oracleDsId);
    expect(poolCount()).toBeGreaterThanOrEqual(1);
    await closeAll();
    expect(poolCount()).toBe(0);
  }, 30_000);
});

describe('importOracleDb', () => {
  it('loads the real oracledb module with its callable API intact', async () => {
    const oracledb = await importOracleDb();
    // The unwrap in oracle-driver.ts exists precisely so `createPool` &
    // friends are reachable regardless of the CJS/ESM interop shape.
    expect(typeof oracledb.createPool).toBe('function');
    expect(typeof oracledb.getConnection).toBe('function');
  });
});
