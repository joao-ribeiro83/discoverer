import { buildRunKey, liveExpiry, scheduledExpiry, stableJson } from '../lib/map-run-key.js';

describe('map-run-key', () => {
  const base = { mapId: 'm', userId: 'u', parameters: { b: 1, a: 'x' }, calculatedFields: [], mapUpdatedAt: new Date('2026-09-21T00:00:00Z') };
  it('ignores parameter key order', () => {
    expect(buildRunKey(base)).toBe(buildRunKey({ ...base, parameters: { a: 'x', b: 1 } }));
  });
  it('changes when the map changes, the user changes, or a calc field is added', () => {
    expect(buildRunKey({ ...base, mapUpdatedAt: new Date('2026-09-22T00:00:00Z') })).not.toBe(buildRunKey(base));
    expect(buildRunKey({ ...base, userId: 'v' })).not.toBe(buildRunKey(base));
    expect(buildRunKey({ ...base, calculatedFields: [{ name: 'c', formula: '1' }] })).not.toBe(buildRunKey(base));
  });
  it('is 64 hex chars', () => expect(buildRunKey(base)).toMatch(/^[0-9a-f]{64}$/));
  it('clamps live TTL to 24 h', () => {
    const t = new Date('2026-09-21T10:00:00Z');
    expect(liveExpiry(t, 72).toISOString()).toBe('2026-09-22T10:00:00.000Z');
    expect(liveExpiry(t, 0).toISOString()).toBe('2026-09-21T11:00:00.000Z');
  });
  it('scheduled expiry uses days', () => {
    expect(scheduledExpiry(new Date('2026-09-21T10:00:00Z'), 30).toISOString()).toBe('2026-10-21T10:00:00.000Z');
  });
  it('stableJson drops undefined', () => expect(stableJson({ a: undefined, b: null })).toBe('{"b":null}'));

  it('changes when a Date-valued parameter changes', () => {
    const withDate = (d: string) => ({ ...base, parameters: { d: new Date(d) } });
    expect(buildRunKey(withDate('2026-01-01'))).not.toBe(buildRunKey(withDate('2026-01-02')));
  });

  it('non-finite ttl falls back to the 24h ceiling', () => {
    const t = new Date('2026-09-21T10:00:00Z');
    expect(liveExpiry(t, NaN).toISOString()).toBe(liveExpiry(t, 24).toISOString());
  });

  it('non-finite retention falls back to the 30-day default', () => {
    const t = new Date('2026-09-21T10:00:00Z');
    expect(scheduledExpiry(t, NaN).toISOString()).toBe(scheduledExpiry(t, 30).toISOString());
  });
});
