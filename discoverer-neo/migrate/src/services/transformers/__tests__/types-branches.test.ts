import { describe, expect, it } from '@jest/globals';
import { clamp, emptyToNull } from '../types.js';

describe('emptyToNull', () => {
  it('returns null for null and undefined', () => {
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
  });

  it('returns null for an empty or whitespace-only string', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('   ')).toBeNull();
  });

  it('passes real content through unchanged', () => {
    expect(emptyToNull('Sales')).toBe('Sales');
  });
});

describe('clamp', () => {
  it('leaves a short string unchanged', () => {
    expect(clamp('short', 10)).toBe('short');
  });

  it('truncates a string longer than max', () => {
    expect(clamp('this is far too long', 4)).toBe('this');
  });
});
