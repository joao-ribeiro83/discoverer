import type { Redis } from 'ioredis';
import { cached, invalidate, invalidateAll, metadataKeys } from '../lib/metadata-cache.js';

// ---------------------------------------------------------------------------
// A minimal in-memory stand-in for ioredis. Only the four commands the cache
// uses are implemented; each can be told to throw so the degradation paths are
// exercised against real control flow rather than a mock assertion.
// ---------------------------------------------------------------------------

interface FakeRedisOptions {
  failOn?: Array<'get' | 'setex' | 'del' | 'scan'>;
}

function makeRedis(opts: FakeRedisOptions = {}) {
  const store = new Map<string, string>();
  const fail = new Set(opts.failOn ?? []);
  const boom = (cmd: string) => {
    throw new Error(`redis ${cmd} unavailable`);
  };

  const redis = {
    store,
    // eslint-disable-next-line @typescript-eslint/require-await
    async get(key: string) {
      if (fail.has('get')) boom('get');
      return store.get(key) ?? null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async setex(key: string, _ttl: number, value: string) {
      if (fail.has('setex')) boom('setex');
      store.set(key, value);
      return 'OK';
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async del(...keys: string[]) {
      if (fail.has('del')) boom('del');
      let n = 0;
      for (const k of keys) if (store.delete(k)) n += 1;
      return n;
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async scan(_cursor: string, _m: string, pattern: string, _c: string, _count: number) {
      if (fail.has('scan')) boom('scan');
      const re = new RegExp(`^${pattern.replace('*', '.*')}$`);
      return ['0', [...store.keys()].filter((k) => re.test(k))] as [string, string[]];
    },
  };

  return redis as unknown as Redis & { store: Map<string, string> };
}

describe('metadata cache', () => {
  describe('cached()', () => {
    it('calls the loader on a miss and serves the cached value afterwards', async () => {
      const redis = makeRedis();
      const load = jest.fn().mockResolvedValue([{ id: 'f1', name: 'Orders' }]);

      const first = await cached(redis, 'meta:test', load);
      const second = await cached(redis, 'meta:test', load);

      expect(first).toEqual([{ id: 'f1', name: 'Orders' }]);
      expect(second).toEqual(first);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('falls back to the loader when redis is absent', async () => {
      const load = jest.fn().mockResolvedValue('value');

      expect(await cached(undefined, 'meta:test', load)).toBe('value');
      expect(await cached(undefined, 'meta:test', load)).toBe('value');
      // Nothing is cached, so every call loads.
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('serves from the loader when a read fails, without surfacing the error', async () => {
      const redis = makeRedis({ failOn: ['get'] });
      const load = jest.fn().mockResolvedValue('fresh');

      await expect(cached(redis, 'meta:test', load)).resolves.toBe('fresh');
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('still returns a value when the write-back fails', async () => {
      const redis = makeRedis({ failOn: ['setex'] });
      const load = jest.fn().mockResolvedValue('fresh');

      await expect(cached(redis, 'meta:test', load)).resolves.toBe('fresh');
    });

    it('treats a corrupt cache entry as a miss rather than throwing', async () => {
      const redis = makeRedis();
      redis.store.set('meta:test', '{not valid json');
      const load = jest.fn().mockResolvedValue('recovered');

      await expect(cached(redis, 'meta:test', load)).resolves.toBe('recovered');
    });

    it('honours the ttl argument', async () => {
      const redis = makeRedis();
      const spy = jest.spyOn(redis, 'setex');

      await cached(redis, 'meta:test', () => Promise.resolve(1), 42);

      expect(spy).toHaveBeenCalledWith('meta:test', 42, '1');
    });

    // Timestamps survive the round-trip as ISO strings, which is exactly what
    // the routes' response schemas (`type: 'string'`) emit for a Date. If this
    // ever stopped holding, cached and uncached responses would differ.
    it('round-trips dates to the same ISO string fastify would serialise', async () => {
      const redis = makeRedis();
      const createdAt = new Date('2026-07-19T17:50:41.853Z');

      const miss = await cached(redis, 'meta:test', () => Promise.resolve({ createdAt }));
      const hit = await cached(redis, 'meta:test', () => Promise.resolve({ createdAt }));

      expect(JSON.stringify(miss)).toBe(JSON.stringify(hit));
      // The double assertion is the point, not a workaround: `cached()` is typed
      // as returning the loader's type, but a hit returns whatever survived JSON
      // — a string here, not the Date the signature promises. Callers that use
      // the value as anything other than a response body must revive it.
      expect((hit as unknown as { createdAt: string }).createdAt).toBe(
        '2026-07-19T17:50:41.853Z',
      );
    });
  });

  describe('invalidate()', () => {
    it('drops the named keys and leaves others alone', async () => {
      const redis = makeRedis();
      await cached(redis, 'meta:a', () => Promise.resolve(1));
      await cached(redis, 'meta:b', () => Promise.resolve(2));

      await invalidate(redis, 'meta:a');

      expect(redis.store.has('meta:a')).toBe(false);
      expect(redis.store.has('meta:b')).toBe(true);
    });

    it('forces the next read to hit the loader again', async () => {
      const redis = makeRedis();
      const load = jest.fn().mockResolvedValueOnce('before').mockResolvedValueOnce('after');

      await cached(redis, 'meta:test', load);
      await invalidate(redis, 'meta:test');
      const second = await cached(redis, 'meta:test', load);

      expect(second).toBe('after');
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('does not throw when redis is absent or the delete fails', async () => {
      await expect(invalidate(undefined, 'meta:test')).resolves.toBeUndefined();
      await expect(
        invalidate(makeRedis({ failOn: ['del'] }), 'meta:test'),
      ).resolves.toBeUndefined();
    });

    it('is a no-op when given no keys', async () => {
      const redis = makeRedis();
      const spy = jest.spyOn(redis, 'del');

      await invalidate(redis);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('invalidateAll()', () => {
    it('removes every namespaced key but nothing outside the namespace', async () => {
      const redis = makeRedis();
      await cached(redis, metadataKeys.businessAreaList(), () => Promise.resolve(1));
      await cached(redis, metadataKeys.itemsByFolder('f1'), () => Promise.resolve(2));
      redis.store.set('bull:export:1', 'a queue job, not ours');

      await invalidateAll(redis);

      expect([...redis.store.keys()]).toEqual(['bull:export:1']);
    });

    it('does not throw when redis is absent or the scan fails', async () => {
      await expect(invalidateAll(undefined)).resolves.toBeUndefined();
      await expect(invalidateAll(makeRedis({ failOn: ['scan'] }))).resolves.toBeUndefined();
    });
  });

  describe('metadataKeys', () => {
    // Keys are entity-scoped and carry no user identity: authorization runs in
    // route preHandlers before the cache is consulted, so a per-user key would
    // be both redundant and a source of near-duplicate entries.
    it('namespaces every key and scopes it by entity, never by user', () => {
      const keys = [
        metadataKeys.businessAreaList(),
        metadataKeys.businessArea('ba1'),
        metadataKeys.foldersByBusinessArea('ba1'),
        metadataKeys.itemsByFolder('f1'),
      ];

      for (const key of keys) expect(key.startsWith('meta:')).toBe(true);
      expect(new Set(keys).size).toBe(keys.length);
      expect(metadataKeys.itemsByFolder('f1')).not.toBe(metadataKeys.itemsByFolder('f2'));
    });
  });
});
