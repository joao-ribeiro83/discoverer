/**
 * Target-side (Discoverer Neo PostgreSQL) connectivity for the migrator.
 *
 * Mirrors the backend's `db/index.ts` pattern (node-postgres Pool + drizzle),
 * but takes its connection details from the CLI rather than the backend config
 * so the migrate workspace stays standalone. The `pg` Pool and `drizzle-orm`
 * packages hoist to the workspace-root `node_modules` (shared with the backend).
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

import * as schema from './schema.js';

export type TargetDatabase = NodePgDatabase<typeof schema>;

/**
 * Target Postgres connection: either a full connection string
 * (`postgres://user:pass@host:5432/db`) or discrete fields.
 */
export interface TargetConnectionConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface TargetDb {
  db: TargetDatabase;
  pool: Pool;
  close: () => Promise<void>;
}

function toPoolConfig(config: TargetConnectionConfig): PoolConfig {
  if (config.connectionString) {
    return { connectionString: config.connectionString, ssl: config.ssl ? { rejectUnauthorized: false } : undefined };
  }
  return {
    host: config.host,
    port: config.port ?? 5432,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

/**
 * Open a pooled drizzle connection to the target Discoverer Neo database.
 * The caller owns the returned handle and must `close()` it.
 */
export function createTargetDb(config: TargetConnectionConfig): TargetDb {
  const pool = new Pool(toPoolConfig(config));
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}
