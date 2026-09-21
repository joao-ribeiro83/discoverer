import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Map run key + lifecycle helpers (Phase: map run queue)
//
// `stableJson` gives a deterministic string for anything that went through
// `JSON.parse`/`JSON.stringify` already (parameters, calculated fields):
// object keys sorted recursively so `{ a, b }` and `{ b, a }` hash the same,
// `undefined` dropped the way `JSON.stringify` already drops it so nested
// values behave the same way. Arrays keep their order — order is meaningful
// there (calculated field list, for instance).
// ---------------------------------------------------------------------------

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    // Date (and anything else with a toJSON, e.g. parameter-resolver.ts's
    // Date-typed parameters) has no own enumerable keys — Object.keys(date)
    // is [], so every Date collapsed to the same {} without this. Recurse on
    // the JSON-serialisable form instead, same as JSON.stringify would use.
    if (typeof (value as { toJSON?: unknown }).toJSON === 'function') {
      return sortKeys((value as { toJSON(): unknown }).toJSON());
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      sorted[key] = sortKeys(v);
    }
    return sorted;
  }
  return value;
}

export function buildRunKey(input: {
  mapId: string;
  userId: string;
  parameters: Record<string, unknown>;
  calculatedFields: unknown[];
  mapUpdatedAt: Date;
}): string {
  const material = [
    input.mapId,
    input.userId,
    stableJson(input.parameters),
    stableJson(input.calculatedFields),
    input.mapUpdatedAt.toISOString(),
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// Live results never outlive 24h regardless of config (Global Constraints).
// Non-finite ttlHours (NaN, Infinity — e.g. a bad env var) falls back to the
// 24h ceiling rather than propagating into an Invalid Date.
export function liveExpiry(completedAt: Date, ttlHours: number): Date {
  const hours = clamp(ttlHours, 1, 24, 24);
  return new Date(completedAt.getTime() + hours * 60 * 60 * 1000);
}

// Non-finite retentionDays falls back to the spec default of 30 (Lifecycles:
// SCHEDULED default) rather than propagating into an Invalid Date.
export function scheduledExpiry(completedAt: Date, retentionDays: number): Date {
  const days = clamp(retentionDays, 1, 3650, 30);
  return new Date(completedAt.getTime() + days * 24 * 60 * 60 * 1000);
}
