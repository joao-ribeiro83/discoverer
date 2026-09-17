/**
 * Diagnostic: what does the source EUL actually say about each user's
 * privileges and type?
 *
 * Reads ACCESS_PRIVS + EUL_USERS and prints, per grantee:
 *  - EU_ROLE_FLAG (a DB role holds grants and cannot log in)
 *  - the EUL-wide privilege codes it holds (AP_TYPE='GP', GP_APP_ID)
 *  - how many business-area grants (GBA) and workbook shares (GD) it holds
 *
 *   npx tsx src/scripts/probe-eul-privileges.ts <dataSourceId>
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
  if (!dataSourceId) throw new Error('usage: probe-eul-privileges.ts <dataSourceId>');

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

  const q = async (sql: string) => {
    const r = await connection.execute(sql, {}, { outFormat: OUT_FORMAT_OBJECT });
    return (r.rows ?? []) as Array<Record<string, unknown>>;
  };

  try {
    const owner = (await q(`SELECT USER AS U FROM DUAL`))[0]!.U as string;
    const marker = await q(
      `SELECT table_name FROM all_tables WHERE owner = '${owner}' AND table_name LIKE 'EUL%BAS'`,
    );
    const prefix = ((marker[0]?.TABLE_NAME as string | undefined) ?? '').replace(/BAS$/, '');
    if (!prefix) throw new Error(`no EUL tables found under ${owner}`);
    console.log(`owner=${owner} prefix=${prefix}\n`);

    console.log('--- AP_TYPE / GP_APP_ID distribution ---');
    console.table(
      await q(
        `SELECT AP_TYPE, GP_APP_ID, COUNT(*) AS N
           FROM ${prefix}ACCESS_PRIVS GROUP BY AP_TYPE, GP_APP_ID ORDER BY AP_TYPE, GP_APP_ID`,
      ),
    );

    console.log('\n--- per grantee ---');
    console.table(
      await q(
        `SELECT u.EU_USERNAME AS USERNAME,
                u.EU_ROLE_FLAG AS ROLE_FLAG,
                SUM(CASE WHEN p.AP_TYPE = 'GBA' THEN 1 ELSE 0 END) AS BA_GRANTS,
                SUM(CASE WHEN p.AP_TYPE = 'GD'  THEN 1 ELSE 0 END) AS WB_SHARES,
                LISTAGG(CASE WHEN p.AP_TYPE = 'GP' THEN TO_CHAR(p.GP_APP_ID) END, ',')
                  WITHIN GROUP (ORDER BY p.GP_APP_ID) AS EUL_PRIVS
           FROM ${prefix}EUL_USERS u
           LEFT JOIN ${prefix}ACCESS_PRIVS p ON p.AP_EU_ID = u.EU_ID
          GROUP BY u.EU_USERNAME, u.EU_ROLE_FLAG
          ORDER BY u.EU_USERNAME`,
      ),
    );

    console.log('\n--- workbook shares (GD): who sees whose workbook ---');
    console.table(
      await q(
        `SELECT u.EU_USERNAME AS GRANTEE, p.GD_DOC_ID AS DOC_ID, d.DOC_NAME AS DOC_NAME,
                o.EU_USERNAME AS DOC_OWNER, p.AP_PRIV_LEVEL AS PRIV_LEVEL
           FROM ${prefix}ACCESS_PRIVS p
           JOIN ${prefix}EUL_USERS u ON u.EU_ID = p.AP_EU_ID
           LEFT JOIN ${prefix}DOCUMENTS d ON d.DOC_ID = p.GD_DOC_ID
           LEFT JOIN ${prefix}EUL_USERS o ON o.EU_ID = d.DOC_EU_ID
          WHERE p.AP_TYPE = 'GD'
          ORDER BY u.EU_USERNAME, p.GD_DOC_ID`,
      ),
    );

    console.log('\n--- documents by owner ---');
    console.table(
      await q(
        `SELECT o.EU_USERNAME AS DOC_OWNER, COUNT(*) AS DOCS
           FROM ${prefix}DOCUMENTS d
           LEFT JOIN ${prefix}EUL_USERS o ON o.EU_ID = d.DOC_EU_ID
          GROUP BY o.EU_USERNAME ORDER BY 2 DESC`,
      ),
    );
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
