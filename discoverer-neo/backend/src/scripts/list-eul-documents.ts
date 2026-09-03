/**
 * Diagnostic: list every workbook in a live EUL's `DOCUMENTS` table.
 *
 *   npx tsx src/scripts/list-eul-documents.ts <dataSourceId> [schemaOwner]
 *
 * Prints ONE line of JSON to stdout (everything else goes to stderr, so stdout
 * stays parseable): `{owner, prefix, connect: {username, ...}, documents:
 * [{docId, docName, docLength}], duplicateNames: string[]}`. `connect` never
 * includes the password — see `export-datasource-password.ts` for that.
 *
 * This is the manifest the corpus dump (`migrate/src/scripts/dump-corpus.mjs`,
 * driving `DISCVR4/d4wkdmp.exe` on the host) reads to know what to dump and
 * what to name each output file. `docId` is the primary key — used as the
 * output filename — precisely because `docName` is not unique (see
 * `duplicateNames`).
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
  if (!dataSourceId) {
    throw new Error('usage: list-eul-documents.ts <dataSourceId> [schemaOwner]');
  }

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
      `SELECT DOC_ID, DOC_NAME, DOC_LENGTH FROM ${owner}.${prefix}DOCUMENTS
        WHERE DOC_LENGTH > 0 ORDER BY DOC_ID`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const rows = (res.rows as Array<{ DOC_ID: number; DOC_NAME: string; DOC_LENGTH: number }>) ?? [];

    const nameCounts = new Map<string, number>();
    for (const r of rows) nameCounts.set(r.DOC_NAME, (nameCounts.get(r.DOC_NAME) ?? 0) + 1);
    const duplicateNames = [...nameCounts.entries()].filter(([, n]) => n > 1).map(([name]) => name);

    console.error(`owner=${owner} prefix=${prefix}`);
    console.error(`${rows.length} workbook(s), ${duplicateNames.length} duplicate DOC_NAME(s)`);

    process.stdout.write(
      JSON.stringify({
        owner,
        prefix,
        connect: {
          username: ds.username,
          host: ds.host,
          port: ds.port,
          serviceName: ds.serviceName,
          sid: ds.sid,
          connectionString: ds.connectionString,
        },
        documents: rows.map((r) => ({ docId: r.DOC_ID, docName: r.DOC_NAME, docLength: r.DOC_LENGTH })),
        duplicateNames,
      }),
    );
    process.stdout.write('\n');
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
