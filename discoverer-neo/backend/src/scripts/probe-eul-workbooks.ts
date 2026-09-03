/**
 * Diagnostic: report how a live EUL stores its workbooks, before migrating it.
 *
 *   npx tsx src/scripts/probe-eul-workbooks.ts <dataSourceId> [schemaOwner]
 *
 * The migration reads worksheets, columns, conditions and parameters out of
 * `DOCUMENTS.DOC_DOCUMENT` — a proprietary binary container, not XML (see
 * `migrate/src/services/workbook-parser.ts`). Everything about that is
 * version-specific, so this answers the questions that decide whether a new
 * source will migrate cleanly:
 *
 *  - which body column exists, and what type is it?
 *  - what `DOC_CONTENT_TYPE` do the workbooks declare?
 *  - does the container parse, and how much comes out of it?
 *  - is any of it available relationally instead (`EXPRESSIONS.IT_DOC_ID`,
 *    `ELEM_XREFS`) — on the 4.1 source this was built against, neither is.
 *
 * Read-only. Prints a report; writes nothing.
 */

import { countWorkbookColumns, parseWorkbookDocument } from '@discoverer-neo/core/migration';
import { eq } from 'drizzle-orm';

import { db } from '../db/index.js';
import { dataSources } from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from '../services/oracle-driver.js';

/** oracledb's OUT_FORMAT_OBJECT, without importing the module for a constant. */
const OUT_FORMAT_OBJECT = 4002;

/** Body-column spellings the migrator probes for, most-confirmed first. */
const BODY_COLUMNS = ['DOC_DOCUMENT', 'DOC_CONTENT'];

/** How many workbook bodies to actually decode. */
const SAMPLE_SIZE = 25;

async function main(): Promise<void> {
  const dataSourceId = process.argv[2];
  const requestedOwner = (process.argv[3] ?? '').toUpperCase();
  if (!dataSourceId) {
    throw new Error('usage: probe-eul-workbooks.ts <dataSourceId> [schemaOwner]');
  }

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

    // The prefix identifies the EUL version: EUL4_ / EUL5_ / EUL_.
    const marker = await connection.execute(
      `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
      { o: owner },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const markerTable = (marker.rows as Array<{ TABLE_NAME: string }>)[0]?.TABLE_NAME;
    if (!markerTable) throw new Error(`no EUL tables found under ${owner}`);
    const prefix = markerTable.replace(/BAS$/, '');
    console.log(`owner=${owner}  prefix=${prefix}\n`);

    // --- which body column exists, and of what type? ------------------------
    const columns = await connection.execute(
      `SELECT column_name, data_type FROM all_tab_columns
        WHERE owner = :o AND table_name = :t ORDER BY column_id`,
      { o: owner, t: `${prefix}DOCUMENTS` },
      { outFormat: OUT_FORMAT_OBJECT },
    );
    const columnRows = columns.rows as Array<{ COLUMN_NAME: string; DATA_TYPE: string }>;
    if (columnRows.length === 0) throw new Error(`${prefix}DOCUMENTS does not exist`);

    const typeByColumn = new Map(columnRows.map((r) => [r.COLUMN_NAME, r.DATA_TYPE]));
    const bodyColumn = BODY_COLUMNS.find((c) => typeByColumn.has(c));
    console.log(`DOCUMENTS columns: ${columnRows.map((r) => r.COLUMN_NAME).join(', ')}`);
    console.log(
      bodyColumn
        ? `body column: ${bodyColumn} (${typeByColumn.get(bodyColumn)})\n`
        : 'body column: NONE FOUND — only workbook metadata can migrate\n',
    );

    // --- what do the workbooks declare themselves to be? --------------------
    const types = await connection.execute(
      `SELECT DOC_CONTENT_TYPE, COUNT(*) AS N, MIN(DOC_LENGTH) AS MIN_LEN, MAX(DOC_LENGTH) AS MAX_LEN
         FROM ${owner}.${prefix}DOCUMENTS GROUP BY DOC_CONTENT_TYPE`,
      {},
      { outFormat: OUT_FORMAT_OBJECT },
    );
    console.log('content types:');
    for (const row of (types.rows as Array<Record<string, unknown>>) ?? []) {
      console.log(
        `  ${String(row.DOC_CONTENT_TYPE)}: ${String(row.N)} workbook(s), ` +
          `${String(row.MIN_LEN)}–${String(row.MAX_LEN)} bytes`,
      );
    }
    console.log('');

    // --- is any worksheet content available relationally? -------------------
    // If it were, the migration would not need to decode the binary at all.
    for (const [label, sql] of [
      [
        'EXPRESSIONS with IT_DOC_ID set (worksheet items)',
        `SELECT COUNT(*) AS N FROM ${owner}.${prefix}EXPRESSIONS WHERE IT_DOC_ID IS NOT NULL`,
      ],
      [
        'EXPRESSIONS with FIL_DOC_ID set (worksheet filters)',
        `SELECT COUNT(*) AS N FROM ${owner}.${prefix}EXPRESSIONS WHERE FIL_DOC_ID IS NOT NULL`,
      ],
      ['ELEM_XREFS rows', `SELECT COUNT(*) AS N FROM ${owner}.${prefix}ELEM_XREFS`],
    ] as const) {
      try {
        const res = await connection.execute(sql, {}, { outFormat: OUT_FORMAT_OBJECT });
        console.log(`  ${label}: ${String((res.rows as Array<{ N: number }>)[0]?.N ?? 0)}`);
      } catch (err) {
        console.log(`  ${label}: unavailable (${err instanceof Error ? err.message : String(err)})`);
      }
    }
    console.log('');

    if (!bodyColumn) return;

    // --- decode a sample and report the fidelity ----------------------------
    const sample = await connection.execute(
      `SELECT DOC_ID, DOC_NAME, DOC_LENGTH, ${bodyColumn} FROM ${owner}.${prefix}DOCUMENTS
        WHERE DOC_LENGTH > 0 AND ROWNUM <= :n`,
      { n: SAMPLE_SIZE },
      { outFormat: OUT_FORMAT_OBJECT },
    );

    let decoded = 0;
    let worksheets = 0;
    let columnCount = 0;
    let conditions = 0;
    let parameters = 0;
    const failures: string[] = [];

    for (const row of (sample.rows as Array<Record<string, unknown>>) ?? []) {
      const body = row[bodyColumn];
      const buffer = Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
          ? Buffer.from(body, 'latin1')
          : null;
      const doc = parseWorkbookDocument(buffer);
      if (doc.worksheets.length > 0) {
        decoded += 1;
        worksheets += doc.worksheets.length;
        columnCount += countWorkbookColumns(doc);
        conditions += doc.conditions.length;
        parameters += doc.parameters.length;
      } else {
        failures.push(`${String(row.DOC_NAME)} (${doc.format}: ${doc.warnings[0] ?? 'no detail'})`);
      }
    }

    const sampled = (sample.rows as unknown[])?.length ?? 0;
    console.log(`decoded ${decoded}/${sampled} sampled workbook bodies`);
    console.log(
      `  ${worksheets} worksheet(s), ${columnCount} column(s), ` +
        `${conditions} condition(s), ${parameters} parameter(s)`,
    );
    for (const failure of failures.slice(0, 10)) console.log(`  FAILED: ${failure}`);
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
