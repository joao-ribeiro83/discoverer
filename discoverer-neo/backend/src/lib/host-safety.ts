import { lookup } from 'node:dns/promises';
import { isIPv4 } from 'node:net';

// ---------------------------------------------------------------------------
// SSRF guard (SEC-10)
//
// A data source's host/port go straight into a connect descriptor or
// connection string, on two separate paths: opening a real Oracle pool
// (services/oracle-connection-pool.ts) and the "test connection" probe
// (services/data-source.service.ts), which is the more dangerous of the two —
// it is *designed* to report success/failure/latency for an arbitrary
// host:port, i.e. a ready-made internal port scanner. Creating a data source
// is admin-gated, which bounds the risk, but an admin session (or one holding
// a stolen admin token) could still point either path at a cloud metadata
// endpoint. Resolve the host and refuse that one range — link-local has no
// legitimate reason to host a database. Loopback and ordinary private ranges
// (10/8, 172.16/12, 192.168/16) are left open: an on-prem Oracle instance
// colocated with this backend, reached over loopback, is a real deployment
// this product supports, not just a test fixture.
// ---------------------------------------------------------------------------

export class DataSourceHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataSourceHostError';
  }
}

function isDisallowedAddress(address: string): boolean {
  if (isIPv4(address)) {
    const octets = address.split('.').map(Number);
    return octets[0] === 169 && octets[1] === 254; // link-local, incl. 169.254.169.254 cloud metadata
  }
  return address.toLowerCase().startsWith('fe80:');
}

/** Resolve `host` and throw {@link DataSourceHostError} if it lands on a disallowed address. */
export async function assertHostIsSafe(host: string): Promise<void> {
  let address: string;
  try {
    ({ address } = await lookup(host));
  } catch {
    throw new DataSourceHostError(`Could not resolve data source host "${host}"`);
  }
  if (isDisallowedAddress(address)) {
    throw new DataSourceHostError(`Data source host "${host}" resolves to a disallowed address`);
  }
}
