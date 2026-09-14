import { describe, expect, it } from '@jest/globals';
import { createTargetDb } from '../db/client.js';

describe('createTargetDb', () => {
  it('builds pool config from a connection string with ssl on', async () => {
    const { pool, close } = createTargetDb({
      connectionString: 'postgres://u:p@h:5432/d',
      ssl: true,
    });
    expect(pool.options.connectionString).toBe('postgres://u:p@h:5432/d');
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
    await close();
  });

  it('builds pool config from a connection string with ssl off', async () => {
    const { pool, close } = createTargetDb({
      connectionString: 'postgres://u:p@h:5432/d',
    });
    expect(pool.options.connectionString).toBe('postgres://u:p@h:5432/d');
    expect(pool.options.ssl).toBeUndefined();
    await close();
  });

  it('builds pool config from discrete fields with ssl on and an explicit port', async () => {
    const { pool, close } = createTargetDb({
      host: 'db.internal',
      port: 5433,
      database: 'neo',
      user: 'migrator',
      password: 'secret',
      ssl: true,
    });
    expect(pool.options.connectionString).toBeUndefined();
    expect(pool.options.host).toBe('db.internal');
    expect(pool.options.port).toBe(5433);
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
    await close();
  });

  it('defaults the port to 5432 and leaves ssl off when omitted', async () => {
    const { pool, close } = createTargetDb({
      host: 'db.internal',
      database: 'neo',
      user: 'migrator',
      password: 'secret',
    });
    expect(pool.options.port).toBe(5432);
    expect(pool.options.ssl).toBeUndefined();
    await close();
  });

  it('exposes a usable db handle and pool', () => {
    const { db, pool, close } = createTargetDb({ host: 'db.internal', database: 'neo' });
    expect(db).toBeDefined();
    expect(pool).toBeDefined();
    return close();
  });
});
