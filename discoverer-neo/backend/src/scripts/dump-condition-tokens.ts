/**
 * Diagnostic: dump every workbook condition's token tree from a live EUL.
 *
 *   npx tsx src/scripts/dump-condition-tokens.ts <dataSourceId> [schemaOwner]
 *
 * Emits one JSON object per condition on stdout (JSONL), so the corpus can be
 * measured offline before the token grammar is designed against it:
 *
 *   {"doc":123,"name":"WB","element":88,"sql":"...","tokens":"[1,98](...)"}
 *
 * Read-only. Writes nothing to either database.
 */

import { parseWorkbookDocument } from '@discoverer-neo/migrate';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

const OUT_FORMAT_OBJECT = 4002;
const BODY_COLUMNS = ['DOC_DOCUMENT', 'DOC_CONTENT'];
/** LONG RAW rows are large; fetch them a few at a time. */
const BATCH = 20;

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const requestedOwner = (process.argv[3] ?? '').toUpperCase();
  if (!dataSourceId) throw new Error('usage: dump-condition-tokens.ts <dataSourceId> [owner]');

  const [ds] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);
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

    const columns = await connection.execute(
      `SELECT column_name FROM all_tab_columns WHERE owner = :o AND table_name = :t`,
      { o: owner, t: `${prefix}DOCUMENTS` },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const present = new Set(
      (columns.rows as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME),
    );
    const bodyColumn = BODY_COLUMNS.find((c) => present.has(c));
    if (!bodyColumn) throw new Error(`${prefix}DOCUMENTS has no body column`);

    const ids = await connection.execute(
      `SELECT DOC_ID, DOC_NAME FROM ${owner}.${prefix}DOCUMENTS WHERE DOC_LENGTH > 0 ORDER BY DOC_ID`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const docs = (ids.rows as Array<{ DOC_ID: number; DOC_NAME: string }>) ?? [];
    process.stderr.write(`${docs.length} workbook(s) with a body\n`);

    let decoded = 0;
    let emitted = 0;
    for (let offset = 0; offset < docs.length; offset += BATCH) {
      const batch = docs.slice(offset, offset + BATCH);
      const binds: Record<string, number> = {};
      const placeholders = batch.map((d, i) => {
        binds[`d${i}`] = d.DOC_ID;
        return `:d${i}`;
      });
      const rows = await connection.execute(
        `SELECT DOC_ID, ${bodyColumn} FROM ${owner}.${prefix}DOCUMENTS ` +
          `WHERE DOC_ID IN (${placeholders.join(', ')})`,
        binds,
        { outFormat: OUT_FORMAT_OBJECT },
      );
      const nameById = new Map(batch.map((d) => [Number(d.DOC_ID), d.DOC_NAME]));
      for (const row of (rows.rows as Array<Record<string, unknown>>) ?? []) {
        const body = row[bodyColumn];
        const buffer = Buffer.isBuffer(body)
          ? body
          : typeof body === 'string'
            ? Buffer.from(body, 'latin1')
            : null;
        if (!buffer) continue;
        const doc = parseWorkbookDocument(buffer);
        decoded += 1;
        for (const condition of doc.conditions) {
          process.stdout.write(
            `${JSON.stringify({
              doc: Number(row.DOC_ID),
              name: nameById.get(Number(row.DOC_ID)) ?? null,
              element: condition.elementId,
              worksheets: doc.worksheets.length,
              sql: condition.sql,
              cname: condition.name,
              tokens: condition.tokens,
            })}\n`,
          );
          emitted += 1;
        }
      }
      process.stderr.write(`  ${Math.min(offset + BATCH, docs.length)}/${docs.length}\r`);
    }
    process.stderr.write(`\ndecoded ${decoded} workbook(s); ${emitted} condition(s)\n`);
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
