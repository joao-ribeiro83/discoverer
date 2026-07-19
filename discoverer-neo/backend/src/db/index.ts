import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';
import { recordDbQuery } from '../plugins/metrics.js';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: config.DATABASE_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: config.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
});

// Times every query issued through the pool for the `db_query_duration_seconds`
// metric. Wraps `pool.query` (not per-client) because drizzle-orm/node-postgres
// checks a client out of the pool per statement rather than holding one across
// a request — instrumenting here catches both drizzle's own calls and the raw
// `pool.query(sql...)` escape hatch used a few places in the codebase.
// Retyped through `unknown` (never `any`): pg's Pool#query has a large
// promise/callback overload set a generic timing wrapper cannot restate, and
// this file is the sole call site, so nothing outside it observes the looser
// signature. Only the promise form is timed — this codebase never uses pg's
// callback style — and an `instanceof Promise` check keeps `.finally` itself
// fully typed rather than reaching for an unsafe member access.
const rawQuery = pool.query.bind(pool) as (...args: unknown[]) => unknown;
(pool as unknown as { query: (...args: unknown[]) => unknown }).query = (
  ...args: unknown[]
) => {
  const start = process.hrtime.bigint();
  const result = rawQuery(...args);
  if (result instanceof Promise) {
    return result.finally(() => {
      recordDbQuery(Number(process.hrtime.bigint() - start) / 1e9);
    });
  }
  return result;
};

export const db = drizzle(pool, { schema });

export type Database = typeof db;
export { schema };
