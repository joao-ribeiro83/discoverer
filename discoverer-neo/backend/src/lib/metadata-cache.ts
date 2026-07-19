import type { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Read-through Redis cache for EUL metadata (business areas, folders, items).
 *
 * Metadata is read on nearly every request and written rarely — the map
 * builder's tree alone issues one request per expanded folder — so it is the
 * one part of the request path where caching pays. Benchmarks at 25 concurrent
 * users showed almost all latency was time queued for a Postgres connection
 * rather than query execution, so the win here is removing round-trips from the
 * pool's critical path, not making any individual query faster.
 *
 * Two rules keep this safe:
 *
 * 1. **Only permission-independent data is cached.** Every cached value is
 *    keyed by entity (folder, business area), never by user, and holds exactly
 *    what the database returns for that entity. Authorization runs in route
 *    preHandlers *before* the handler consults the cache, so a cache hit never
 *    bypasses a grant check. Anything whose shape depends on the caller —
 *    the per-user filtered business-area list, a response with a `permissions`
 *    array — must not be cached with these helpers.
 *
 * 2. **A cache failure is never a request failure.** Redis is a performance
 *    dependency, not a correctness one: every operation falls back to the
 *    loader (or silently no-ops on write) if Redis is down or returns garbage.
 */

/** Namespace for every key written here, so invalidation can be reasoned about. */
const PREFIX = 'meta:';

/**
 * Default TTL.
 *
 * Mutations invalidate explicitly, so this is a backstop for the paths that
 * write metadata without going through the HTTP routes — direct database edits
 * — rather than the primary freshness mechanism. Defaults to five minutes,
 * matching the existing Oracle introspection cache.
 */
const DEFAULT_TTL_SECONDS = config.METADATA_CACHE_TTL_SECONDS;

export const metadataKeys = {
  /** All active business areas. Only valid for the admin listing path. */
  businessAreaList: () => `${PREFIX}ba:list`,
  /** One business area, without grants (grants vary per request). */
  businessArea: (id: string) => `${PREFIX}ba:${id}`,
  /** Folders belonging to a business area. */
  foldersByBusinessArea: (baId: string) => `${PREFIX}folders:ba:${baId}`,
  /** Active items in a folder. */
  itemsByFolder: (folderId: string) => `${PREFIX}items:folder:${folderId}`,
} as const;

/**
 * Fetch `key` from Redis, falling back to `load()` on a miss and caching the
 * result. Returns the loader's value unchanged on any Redis failure.
 *
 * Values round-trip through JSON, which turns `Date` into an ISO string. That
 * is invariant for these routes: their Fastify response schemas type timestamp
 * fields as `string`, and fast-json-stringify serialises a `Date` to the same
 * ISO form, so cached and uncached responses are byte-identical. A caller that
 * needs real `Date` objects back (rather than serialising straight to JSON)
 * must revive them itself.
 */
export async function cached<T>(
  redis: Redis | undefined,
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  if (!redis || !config.METADATA_CACHE_ENABLED) return load();

  try {
    const raw = await redis.get(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Unreachable Redis or malformed payload — fall through to the database.
  }

  const value = await load();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Caching is best-effort; a failed write must not fail the request.
  }

  return value;
}

/** Drop specific keys. Safe to call with keys that do not exist. */
export async function invalidate(
  redis: Redis | undefined,
  ...keys: string[]
): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // Stale entries expire via TTL; a failed delete must not fail the mutation.
  }
}

/**
 * Drop every metadata key.
 *
 * For bulk writers that bypass the route layer (the migration runner imports
 * an entire EUL in one pass), where enumerating the affected entities is more
 * error-prone than simply starting cold. Uses SCAN rather than KEYS so it does
 * not block Redis on a large keyspace.
 */
export async function invalidateAll(redis: Redis | undefined): Promise<void> {
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // Best-effort, as above.
  }
}
