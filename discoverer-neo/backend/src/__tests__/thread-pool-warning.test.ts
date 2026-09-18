import { warnIfThreadPoolTooSmall } from '../services/oracle-connection-pool.js';
import { config } from '../config.js';

/**
 * The guard behind a 500 that named Postgres for a problem caused by Oracle:
 * thick mode holds a libuv thread per in-flight call, Node ships four, and
 * `getaddrinfo` shares them — so a burst of slow Oracle queries stops a new
 * Postgres connection resolving its host at all.
 */
describe('warnIfThreadPoolTooSmall', () => {
  const original = process.env.UV_THREADPOOL_SIZE;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    if (original === undefined) delete process.env.UV_THREADPOOL_SIZE;
    else process.env.UV_THREADPOOL_SIZE = original;
  });

  it('warns when the pool cannot cover ORACLE_POOL_MAX plus headroom', () => {
    process.env.UV_THREADPOOL_SIZE = String(config.ORACLE_POOL_MAX);
    warnIfThreadPoolTooSmall();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('UV_THREADPOOL_SIZE');
  });

  it('warns on the Node default, which is the shape that actually shipped', () => {
    delete process.env.UV_THREADPOOL_SIZE;
    warnIfThreadPoolTooSmall();
    expect(String(warn.mock.calls[0]?.[0])).toContain('Node default');
  });

  it('stays quiet once the pool is big enough', () => {
    process.env.UV_THREADPOOL_SIZE = String(config.ORACLE_POOL_MAX + 4);
    warnIfThreadPoolTooSmall();
    expect(warn).not.toHaveBeenCalled();
  });
});
