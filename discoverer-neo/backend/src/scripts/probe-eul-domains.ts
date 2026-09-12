/**
 * One-off diagnostic for Phase 5.2: what is really in EUL4_DOMAINS?
 *
 *   npx tsx src/scripts/probe-eul-domains.ts <dataSourceId> [schemaOwner]
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

async function main() {
  const dsId = process.argv[2];
  const owner = (process.argv[3] ?? '').toUpperCase();
  if (!dsId) throw new Error('usage: probe-eul-domains.ts <dataSourceId> [schemaOwner]');

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
  const pfx = await conn.execute(
    `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
    { o: schema },
    OBJ,
  );
  const prefix =
    ((pfx.rows as { TABLE_NAME: string }[])[0]?.TABLE_NAME ?? 'EUL4_BAS').replace(/BAS$/, '');
  console.log(`owner=${schema} prefix=${prefix}\n`);

  const q = async (sql: string, binds: Record<string, unknown> = {}) => {
    const r = await conn.execute(sql, binds as never, OBJ);
    return (r.rows ?? []) as Record<string, unknown>[];
  };

  // 1. Every DOM* table present.
  const tabs = await q(
    `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE :p ORDER BY 1`,
    { o: schema, p: `${prefix}%DOM%` },
  );
  console.log('== DOM-ish tables ==');
  console.log(tabs.map((t) => t.TABLE_NAME).join(', ') || '(none)');
  console.log('');

  // 2. Columns of DOMAINS.
  const cols = await q(
    `SELECT column_name, data_type, data_length, nullable FROM all_tab_columns
      WHERE owner = :o AND table_name = :t ORDER BY column_id`,
    { o: schema, t: `${prefix}DOMAINS` },
  );
  console.log(`== ${prefix}DOMAINS columns (${cols.length}) ==`);
  for (const c of cols) {
    console.log(
      `  ${String(c.COLUMN_NAME)} ${String(c.DATA_TYPE)}(${String(c.DATA_LENGTH)}) null=${String(c.NULLABLE)}`,
    );
  }
  console.log('');

  if (cols.length === 0) {
    await conn.close();
    return;
  }

  // 3. Row count and sample.
  const countRows = (await q(`SELECT COUNT(*) AS N FROM ${prefix}DOMAINS`)) as { N: number }[];
  console.log(`== row count: ${countRows[0]?.N ?? 0} ==
`);

  const sample = await q(`SELECT * FROM ${prefix}DOMAINS WHERE ROWNUM <= 8`);
  console.log('== sample rows ==');
  for (const r of sample) console.log(JSON.stringify(r));
  console.log('');

  // 4. Distinct-value profile for every non-ID column (which are flags?).
  console.log('== per-column distinct profile ==');
  for (const c of cols) {
    const name = String(c.COLUMN_NAME);
    const d = await q(
      `SELECT COUNT(DISTINCT ${name}) AS D, COUNT(${name}) AS NN FROM ${prefix}DOMAINS`,
    );
    const distinct = Number(d[0]!.D);
    let vals = '';
    if (distinct > 0 && distinct <= 12) {
      const v = await q(
        `SELECT ${name} AS V, COUNT(*) AS C FROM ${prefix}DOMAINS GROUP BY ${name} ORDER BY 2 DESC`,
      );
      vals = ' -> ' + v.map((x) => `${JSON.stringify(x.V)}x${String(x.C)}`).join(' ');
    }
    console.log(`  ${name}: distinct=${distinct} nonnull=${String(d[0]!.NN)}${vals}`);
  }
  console.log('');

  // 5. How items bind.
  const expCols = await q(
    `SELECT column_name FROM all_tab_columns
      WHERE owner = :o AND table_name = :t AND column_name LIKE '%DOM%'`,
    { o: schema, t: `${prefix}EXPRESSIONS` },
  );
  console.log('== EXPRESSIONS DOM columns ==');
  console.log(expCols.map((c) => c.COLUMN_NAME).join(', ') || '(none)');
  for (const c of expCols) {
    const n = String(c.COLUMN_NAME);
    const r = await q(
      `SELECT COUNT(*) AS C, COUNT(DISTINCT ${n}) AS D FROM ${prefix}EXPRESSIONS WHERE ${n} IS NOT NULL`,
    );
    console.log(`  ${n}: rows=${String(r[0]!.C)} distinct=${String(r[0]!.D)}`);
  }
  console.log('');

  // 6. Any other table in the EUL referencing DOM_ID.
  const refs = await q(
    `SELECT table_name, column_name FROM all_tab_columns
      WHERE owner = :o AND table_name LIKE :p AND column_name LIKE '%DOM%' ORDER BY 1,2`,
    { o: schema, p: `${prefix}%` },
  );
  console.log('== all DOM-named columns in the EUL ==');
  for (const r of refs) console.log(`  ${String(r.TABLE_NAME)}.${String(r.COLUMN_NAME)}`);
  console.log('');

  await conn.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
