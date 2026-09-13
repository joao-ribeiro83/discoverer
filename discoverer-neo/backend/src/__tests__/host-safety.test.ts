import { describe, it, expect } from '@jest/globals';
import { assertHostIsSafe, DataSourceHostError } from '../lib/host-safety.js';

describe('assertHostIsSafe (SEC-10)', () => {
  it('rejects the cloud metadata address', async () => {
    await expect(assertHostIsSafe('169.254.169.254')).rejects.toThrow(DataSourceHostError);
  });

  it('rejects IPv6 link-local', async () => {
    await expect(assertHostIsSafe('fe80::1')).rejects.toThrow(DataSourceHostError);
  });

  it('allows loopback (an on-prem Oracle colocated with the backend)', async () => {
    await expect(assertHostIsSafe('127.0.0.1')).resolves.toBeUndefined();
  });

  it('allows an ordinary private address (on-prem Oracle lives here)', async () => {
    await expect(assertHostIsSafe('10.0.0.5')).resolves.toBeUndefined();
    await expect(assertHostIsSafe('192.168.1.20')).resolves.toBeUndefined();
  });
});
