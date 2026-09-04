import type * as OracleDbNamespace from 'oracledb';

/**
 * Single entry point for loading the node-oracledb driver.
 *
 * node-oracledb ships as CommonJS. Under ESM, Node's interop layer only
 * surfaces the classes it can statically detect (Connection, AqQueue,
 * BaseDbObject, …) as named exports — the entire callable API (createPool,
 * getConnection, initOracleClient) lands on `.default` instead. A bare
 * `await import('oracledb')` therefore returns a module object that looks
 * imported but on which every method is `undefined`.
 *
 * The unwrap below is load-bearing, not cosmetic, and lives here so the two
 * call sites (connection pool, connection test) cannot drift apart.
 */
export type OracleDbModule = typeof OracleDbNamespace;

export async function importOracleDb(): Promise<OracleDbModule> {
  const ns = (await import('oracledb')) as unknown as {
    default?: OracleDbModule;
  };
  return ns.default ?? (ns as unknown as OracleDbModule);
}
