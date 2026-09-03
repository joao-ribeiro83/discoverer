/**
 * Diagnostic: dump a live EUL's `FUNCTIONS` table.
 *
 *   npx tsx src/scripts/dump-eul-functions.ts <dataSourceId> [schemaOwner]
 *
 * `FUN_ID` is the opcode inside a condition's or calculation's token tree —
 * `[1,92]` is `FUN_ID` 92, BETWEEN. `FUN_FUNCTION_TYPE` says what kind of node
 * it is (1 = comparison predicate, 3 = AND/OR/NOT, everything else a value
 * function). Read-only; prints TSV.
 */

import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

const OUT_FORMAT_OBJECT = 4002;

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const requestedOwner = (process.argv[3] ?? '').toUpperCase();
  if (!dataSourceId) throw new Error('usage: dump-eul-functions.ts <dataSourceId> [owner]');

  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('data source not found');

  const oracledb = await importOracleDb();
  if (process.env.ORACLE_THICK_MODE === 'true') {
    try {
      oracledb.initOracleClient({
        libDir: process.env.ORACLE_CLIENT_PATH || '/opt/oracle/instantclient',
      });
    } catch {
      /* already initialised */
    }
  }

  const connection = await oracledb.getConnection({
    user: ds.username ?? undefined,
    password: ds.passwordEnc ? decrypt(ds.passwordEnc) : '',
    connectString:
      ds.connectionString ||
      `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))` +
        `(CONNECT_DATA=(SERVICE_NAME=${ds.serviceName || ds.sid})))`,
  });

  try {
    const who = await connection.execute(`SELECT USER AS U FROM DUAL`, {}, {
      outFormat: OUT_FORMAT_OBJECT,
    });
    const owner = requestedOwner || (who.rows as Array<{ U: string }>)[0]!.U;
    const marker = await connection.execute(
      `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
      { o: owner },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const markerTable = (marker.rows as Array<{ TABLE_NAME: string }>)[0]?.TABLE_NAME;
    if (!markerTable) throw new Error(`no EUL tables found under ${owner}`);
    const prefix = markerTable.replace(/BAS$/, '');

    const res = await connection.execute(
      `SELECT FUN_ID, FUN_NAME, FUN_FUNCTION_TYPE, FUN_DATA_TYPE, FUN_MINIMUM_ARGS,
              FUN_MAXIMUM_ARGS, FUN_BUILT_IN, FUN_EXT_NAME
         FROM ${owner}.${prefix}FUNCTIONS ORDER BY FUN_ID`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    console.log('id\tname\tftype\tdtype\tminargs\tmaxargs\tbuiltin\text');
    for (const r of (res.rows as Array<Record<string, string | number | null>>) ?? []) {
      console.log(
        [
          r.FUN_ID,
          r.FUN_NAME,
          r.FUN_FUNCTION_TYPE,
          r.FUN_DATA_TYPE,
          r.FUN_MINIMUM_ARGS,
          r.FUN_MAXIMUM_ARGS,
          r.FUN_BUILT_IN,
          r.FUN_EXT_NAME,
        ]
          .map((v) => (v === null || v === undefined ? '' : String(v)))
          .join('\t'),
      );
    }
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
