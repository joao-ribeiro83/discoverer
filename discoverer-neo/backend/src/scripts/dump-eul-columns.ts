/**
 * One-off diagnostic: dump the real column list for the EUL tables the
 * migrator reads, straight from ALL_TAB_COLUMNS on a live source.
 *
 *   npx tsx src/scripts/dump-eul-columns.ts <dataSourceId> [schemaOwner]
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

const TABLES = [
  'BAS',
  'BA_OBJ_LINKS',
  'OBJS',
  'EXPRESSIONS',
  'KEY_CONS',
  'HIERARCHIES',
  'HI_NODES',
  'HI_SEGMENTS',
  'FUNCTIONS',
  'ACCESS_PRIVS',
  'EUL_USERS',
  'DOCUMENTS',
  'ELEM_XREFS',
  'VERSIONS',
  'SUMMARY_OBJS',
  'OBJ_JOIN_USGS',
  'QPP_STATS',
  'IG_EXP_LINKS',
  'DBH_NODES',
  'EXP_DEPS',
  'OBJ_DEPS',
];

async function main() {
  const dsId = process.argv[2];
  const owner = (process.argv[3] ?? '').toUpperCase();
  if (!dsId) throw new Error('usage: dump-eul-columns.ts <dataSourceId> [schemaOwner]');

  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dsId)).limit(1);
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

  const conn = await oracledb.getConnection({
    user: ds.username ?? undefined,
    password: ds.passwordEnc ? decrypt(ds.passwordEnc) : '',
    connectString:
      ds.connectionString ||
      `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${ds.serviceName || ds.sid})))`,
  });

  const OBJ = { outFormat: 4002 };
  const who = await conn.execute(`SELECT USER AS U FROM DUAL`, {}, OBJ);
  const schema = owner || (who.rows as { U: string }[])[0]!.U;

  // Detect the prefix actually present.
  const pfx = await conn.execute(
    `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
    { o: schema },
    OBJ,
  );
  const prefix =
    ((pfx.rows as { TABLE_NAME: string }[])[0]?.TABLE_NAME ?? 'EUL4_BAS').replace(/BAS$/, '');
  console.log(`owner=${schema} prefix=${prefix}\n`);

  for (const base of TABLES) {
    const table = `${prefix}${base}`;
    const res = await conn.execute(
      `SELECT column_name, data_type, nullable FROM all_tab_columns
        WHERE owner = :o AND table_name = :t ORDER BY column_id`,
      { o: schema, t: table },
      OBJ,
    );
    const rows = res.rows as { COLUMN_NAME: string; DATA_TYPE: string }[];
    if (rows.length === 0) {
      console.log(`${table}: (table not present)`);
    } else {
      console.log(`${table} (${rows.length}):`);
      console.log('  ' + rows.map((r) => `${r.COLUMN_NAME}:${r.DATA_TYPE}`).join(', '));
    }
    console.log('');
  }

  await conn.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
