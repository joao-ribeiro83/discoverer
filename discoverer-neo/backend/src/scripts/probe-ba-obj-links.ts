/**
 * Diagnostic: does this source actually have any folder shared across more
 * than one business area?
 *
 * Phase 5.4 (D-075): the migrator has written `folder_business_areas` for
 * BA_OBJ_LINKS since 2026-09-03, but this estate's one full migration ran on
 * 2026-08-24 — before that code existed — so `folder_business_areas` reads 0
 * regardless of what the source actually contains. This answers which it is,
 * without re-running a migration.
 *
 *   npx tsx src/scripts/probe-ba-obj-links.ts <dataSourceId>
 *
 * Read-only. Prints a report; writes nothing.
 */

import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

const OUT_FORMAT_OBJECT = 4002;

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  if (!dataSourceId) throw new Error('usage: probe-ba-obj-links.ts <dataSourceId>');

  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error('data source not found');

  const oracledb = await importOracleDb();
  if (process.env.ORACLE_THICK_MODE === 'true') {
    try {
      oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH || '/opt/oracle/instantclient' });
    } catch {
      /* already initialised */
    }
  }

  const connection = await oracledb.getConnection({
    user: ds.username ?? undefined,
    password: ds.passwordEnc ? decrypt(ds.passwordEnc) : '',
    connectString:
      ds.connectionString ||
      `(DESCRIPTION=(ADDRESS=(HOST=${ds.host})(PORT=${ds.port})(PROTOCOL=TCP))(CONNECT_DATA=(SERVICE_NAME=${ds.serviceName || ds.sid})))`,
  });

  try {
    const who = await connection.execute(`SELECT USER AS U FROM DUAL`, {}, { outFormat: OUT_FORMAT_OBJECT });
    const owner = (who.rows as Array<{ U: string }>)[0]!.U;

    const marker = await connection.execute(
      `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
      { o: owner },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const markerTable = (marker.rows as Array<{ TABLE_NAME: string }>)[0]?.TABLE_NAME;
    if (!markerTable) throw new Error(`no EUL tables found under ${owner}`);
    const prefix = markerTable.replace(/BAS$/, '');
    console.log(`owner=${owner}  prefix=${prefix}`);

    const linkTable = `${prefix}BA_OBJ_LINKS`;
    const exists = await connection.execute(
      `SELECT column_name FROM all_tab_columns WHERE owner = :o AND table_name = :t ORDER BY column_id`,
      { o: owner, t: linkTable },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const cols = (exists.rows as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME);
    console.log(`${linkTable} columns: ${cols.join(', ') || '(table not found)'}`);
    if (cols.length === 0) return;

    // BOL_OBJ_ID -> folder (an OBJS row), BOL_BA_ID -> the business area.
    const total = await connection.execute(
      `SELECT COUNT(*) AS N FROM ${linkTable}`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    console.log(`total rows: ${(total.rows as Array<{ N: number }>)[0]!.N}`);

    const multi = await connection.execute(
      `SELECT bol_obj_id, COUNT(DISTINCT bol_ba_id) AS n_bas
         FROM ${linkTable}
        GROUP BY bol_obj_id
       HAVING COUNT(DISTINCT bol_ba_id) > 1
        ORDER BY n_bas DESC`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const multiRows = multi.rows as Array<{ BOL_OBJ_ID: number; N_BAS: number }>;
    console.log(`folders (OBJ_ID) linked to more than one business area: ${multiRows.length}`);
    for (const row of multiRows.slice(0, 20)) {
      console.log(`  OBJ_ID ${row.BOL_OBJ_ID}: ${row.N_BAS} business areas`);
    }
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
