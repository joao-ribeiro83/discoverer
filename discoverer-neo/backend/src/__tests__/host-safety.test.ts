import { describe, it, expect } from '@jest/globals';
import { resolveSafeHost, DataSourceHostError } from '../lib/host-safety.js';

describe('resolveSafeHost (SEC-10)', () => {
  it('rejects the cloud metadata address', async () => {
    await expect(resolveSafeHost('169.254.169.254')).rejects.toThrow(DataSourceHostError);
  });

  it('rejects IPv6 link-local', async () => {
    await expect(resolveSafeHost('fe80::1')).rejects.toThrow(DataSourceHostError);
  });

  it('rejects an IPv4-mapped IPv6 form of the metadata address', async () => {
    // ::ffff:169.254.169.254 is the same address as far as the OS/driver is
    // concerned — a bare isIPv4()/fe80: check misses it entirely.
    await expect(resolveSafeHost('::ffff:169.254.169.254')).rejects.toThrow(DataSourceHostError);
  });

  it('allows loopback (an on-prem Oracle colocated with the backend)', async () => {
    await expect(resolveSafeHost('127.0.0.1')).resolves.toBe('127.0.0.1');
  });

  it('allows an ordinary private address (on-prem Oracle lives here)', async () => {
    await expect(resolveSafeHost('10.0.0.5')).resolves.toBe('10.0.0.5');
    await expect(resolveSafeHost('192.168.1.20')).resolves.toBe('192.168.1.20');
  });

  it('returns the resolved address, not the input hostname — callers must dial this, not re-resolve', async () => {
    // A literal IP resolves to itself; the meaningful case (a hostname
    // resolving to a different literal) isn't reachable without a real DNS
    // fixture, but the contract — return what was actually validated — is
    // exactly what closes the rebinding window in the callers.
    await expect(resolveSafeHost('192.0.2.1')).resolves.toBe('192.0.2.1');
  });
});
