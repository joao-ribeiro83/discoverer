/**
 * Read-only probe of the source EUL's usage history and scheduled-run output,
 * for Phase 9.1's sample selection.
 *
 *   docker exec discoverer-neo-backend sh -c \
 *     'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/probe-qpp-stats.ts <dataSourceId> [owner] [prefix]'
 *
 * Prints counts, dates and workbook names only — never a row of result data.
 */
import { parseWorkbookDocument, readWorkbookElements } from '@discoverer-neo/core/migration';

import { pool } from '../db/index.js';
import { getConnection, releaseConnection } from '../services/oracle-connection-pool.js';
import { decideMap, generateSql, loadMapDefinition } from '../services/sql-generator.js';

const dataSourceId = process.argv[2];
const owner = (process.argv[3] ?? 'SIID_TESTES').toUpperCase();
const prefix = (process.argv[4] ?? 'EUL4_').toUpperCase();
if (!dataSourceId) throw new Error('usage: probe-qpp-stats.ts <dataSourceId> [owner] [prefix]');

const t = (name: string) => `${owner}.${prefix}${name}`;
const conn = await getConnection(dataSourceId);
const q = async (sql: string, binds: Record<string, unknown> = {}) =>
  ((await conn.execute(sql, binds as never, { outFormat: 4002 })) as {
    rows?: Array<Record<string, unknown>>;
  }).rows ?? [];
const show = (label: string, rows: Array<Record<string, unknown>>) => {
  console.log(`\n== ${label}`);
  for (const r of rows) console.log(JSON.stringify(r));
};

try {
  show(
    'QPP_STATS overview',
    await q(`SELECT COUNT(*) N, MIN(QS_CREATED_DATE) FIRST_RUN, MAX(QS_CREATED_DATE) LAST_RUN,
       COUNT(DISTINCT QS_DOC_NAME) DOCS, COUNT(DISTINCT QS_DOC_OWNER || '/' || QS_DOC_NAME) OWNER_DOCS,
       COUNT(DISTINCT QS_DOC_DETAILS) DETAILS,
       SUM(CASE WHEN QS_DOC_NAME IS NULL THEN 1 ELSE 0 END) NO_DOC,
       SUM(CASE WHEN QS_NUM_ROWS IS NULL THEN 1 ELSE 0 END) NO_ROWS
     FROM ${t('QPP_STATS')}`),
  );
  show(
    'runs per year',
    await q(`SELECT TO_CHAR(QS_CREATED_DATE, 'YYYY') Y, COUNT(*) N FROM ${t('QPP_STATS')}
     GROUP BY TO_CHAR(QS_CREATED_DATE, 'YYYY') ORDER BY 1`),
  );
  show(
    'top 20 workbooks by recorded executions',
    await q(`SELECT QS_DOC_OWNER, QS_DOC_NAME, COUNT(*) RUNS, COUNT(DISTINCT QS_DOC_DETAILS) DETAILS,
       COUNT(DISTINCT QS_NUM_ROWS) ROW_COUNTS, MIN(QS_NUM_ROWS) MIN_ROWS, MAX(QS_NUM_ROWS) MAX_ROWS,
       MAX(QS_CREATED_DATE) LAST_RUN
     FROM ${t('QPP_STATS')} GROUP BY QS_DOC_OWNER, QS_DOC_NAME ORDER BY RUNS DESC
     FETCH FIRST 20 ROWS ONLY`),
  );
  show(
    'QS_DOC_DETAILS shape (first 60 chars)',
    await q(`SELECT DISTINCT SUBSTR(QS_DOC_DETAILS, 1, 60) D, LENGTH(QS_DOC_DETAILS) L
     FROM ${t('QPP_STATS')} WHERE QS_DOC_DETAILS IS NOT NULL FETCH FIRST 6 ROWS ONLY`),
  );
  show(
    'QS_OBJECT_USE_KEY shape (first 80 chars)',
    await q(`SELECT SUBSTR(QS_OBJECT_USE_KEY, 1, 80) K FROM ${t('QPP_STATS')} FETCH FIRST 3 ROWS ONLY`),
  );
  show(
    'scheduled runs, newest first',
    await q(`SELECT r.BR_ID, r.BR_WORKBOOK_NAME, r.BR_REPORT_SCHEMA, u.BRR_STATE,
       TO_CHAR(u.BRR_RUN_DATE, 'YYYY-MM-DD HH24:MI:SS') RUN, u.BRR_SVR_ERR_CODE,
       (SELECT LISTAGG(s.BS_SHEET_NAME, ' | ') WITHIN GROUP (ORDER BY s.BS_ID)
          FROM ${t('BATCH_SHEETS')} s WHERE s.BS_BR_ID = r.BR_ID) SHEETS,
       (SELECT COUNT(*) FROM ${t('BATCH_SHEETS')} s JOIN ${t('BATCH_PARAMS')} p ON p.BP_BS_ID = s.BS_ID
          WHERE s.BS_BR_ID = r.BR_ID) PARAMS
     FROM ${t('BATCH_REPORTS')} r LEFT JOIN ${t('BR_RUNS')} u ON u.BRR_BR_ID = r.BR_ID
     ORDER BY u.BRR_RUN_DATE DESC NULLS LAST FETCH FIRST 12 ROWS ONLY`),
  );
  // Any owner this account can see: a batch result lands in the scheduling
  // user's repository schema, which need not be the EUL owner's.
  const tables = await q(
    `SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE REGEXP_LIKE(TABLE_NAME, '^EUL[0-9]_B[0-9]{12}Q[0-9]+R[0-9]+$')
     ORDER BY TABLE_NAME`,
  );
  const counted: Array<Record<string, unknown>> = [];
  for (const row of tables) {
    const [c] = await q(`SELECT COUNT(*) N FROM "${String(row.OWNER)}"."${String(row.TABLE_NAME)}"`);
    counted.push({ owner: row.OWNER, name: row.TABLE_NAME, rows: c?.N });
  }
  show('materialised batch result tables visible to this account (live row counts)', counted);
  show(
    'recorded executions since 2026-08-01 (doc, sheet, rows)',
    await q(`SELECT QS_DOC_NAME, QS_DOC_DETAILS, QS_NUM_ROWS, TO_CHAR(QS_CREATED_DATE, 'YYYY-MM-DD HH24:MI:SS') AT
     FROM ${t('QPP_STATS')} WHERE QS_CREATED_DATE >= DATE '2026-08-01' ORDER BY QS_CREATED_DATE`),
  );

  // The one run whose materialised output this account can read: how its
  // tables, queries, sheets and parameters line up.
  const batchQueries = await q(`SELECT r.BR_ID, r.BR_NAME, s.BS_ID, s.BS_SHEET_NAME, q.BQ_ID,
       TO_CHAR(q.BQ_CREATED_DATE, 'YYMMDDHH24MISS') TS,
       q.BQ_RESULT_SQL_1 || q.BQ_RESULT_SQL_2 || q.BQ_RESULT_SQL_3 || q.BQ_RESULT_SQL_4 RESULT_SQL
     FROM ${t('BATCH_REPORTS')} r JOIN ${t('BATCH_SHEETS')} s ON s.BS_BR_ID = r.BR_ID
     JOIN ${t('BATCH_QUERIES')} q ON q.BQ_BS_ID = s.BS_ID
     WHERE r.BR_ID = 268581 ORDER BY q.BQ_ID`);
  for (const row of batchQueries) {
    const sql = (row.RESULT_SQL as string | null) ?? '';
    const aliases = [...sql.matchAll(/\bas\s+(E-?\d+)/gi)].map((m) => m[1]);
    console.log(
      JSON.stringify({ BS_ID: row.BS_ID, sheet: row.BS_SHEET_NAME, BQ_ID: row.BQ_ID, ts: row.TS, aliases: aliases.length }),
    );
    console.log(`   ${sql.slice(0, 260)}${sql.length > 260 ? ' …' : ''}`);
    console.log(`   … ${sql.slice(-120)}`);
  }
  show(
    'column signature of that run\'s tables (which query wrote which table)',
    await q(`SELECT TABLE_NAME, COUNT(*) COLS,
       SUM(CASE WHEN COLUMN_NAME LIKE 'BRN%' THEN 1 ELSE 0 END) BRN,
       SUM(CASE WHEN COLUMN_NAME LIKE 'BRVC%' THEN 1 ELSE 0 END) BRVC,
       SUM(CASE WHEN COLUMN_NAME LIKE 'BRD%' THEN 1 ELSE 0 END) BRD
     FROM ALL_TAB_COLUMNS WHERE OWNER = :o AND TABLE_NAME LIKE 'EUL4\\_B260506220828%' ESCAPE '\\'
     GROUP BY TABLE_NAME ORDER BY TABLE_NAME`, { o: owner }),
  );
  for (const row of batchQueries) {
    const sql = (row.RESULT_SQL as string | null) ?? '';
    const refs = [...sql.matchAll(/\b(BR(?:N|VC|D))(\d+) as E(-?_?\d+)/gi)];
    const kinds = { BRN: 0, BRVC: 0, BRD: 0 } as Record<string, number>;
    for (const m of refs) kinds[m[1]!.toUpperCase()] = Math.max(kinds[m[1]!.toUpperCase()] ?? 0, Number(m[2]));
    console.log(`   BQ ${String(row.BQ_ID)} reads up to ${JSON.stringify(kinds)}`);
  }
  const viewCols = await q(`SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS
     WHERE OWNER = :o AND TABLE_NAME = 'EUL4_B260506220828Q1V1' ORDER BY COLUMN_ID`, { o: owner });
  console.log(`\n== Q1V1 columns: ${viewCols.map((c) => `${String(c.COLUMN_NAME)}:${String(c.DATA_TYPE).slice(0, 4)}`).join(' ')}`);
  // A V1 view wraps the statement Discoverer itself generated for the sheet.
  // Printed with the select list collapsed: its structure, not its aliases.
  for (const n of [1, 2, 3, 4]) {
    const [view] = await q(`SELECT TEXT_LENGTH, TEXT_VC FROM ALL_VIEWS WHERE OWNER = :o AND VIEW_NAME = :v`, {
      o: owner,
      v: `EUL4_B260506220828Q${n}V1`,
    });
    const text = ((view?.TEXT_VC as string | undefined) ?? '').replace(/\s+/g, ' ');
    const body = text.replace(/^SELECT\s+.*?\bFROM\b/i, 'SELECT <list> FROM');
    const innerSelects = (text.match(/\bSELECT\b/gi) ?? []).length;
    console.log(`\n== Q${n}V1 (${String(view?.TEXT_LENGTH)} chars, ${innerSelects} SELECTs): ${body.slice(0, 1500)}`);
  }
  for (const n of [1, 2, 3, 4]) {
    const name = `EUL4_B260506220828Q${n}V1`;
    const [status] = await q(`SELECT STATUS FROM ALL_OBJECTS WHERE OWNER = :o AND OBJECT_NAME = :v`, { o: owner, v: name });
    let now: unknown;
    try {
      [now] = await q(`SELECT COUNT(*) N FROM ${owner}."${name}"`);
    } catch (err) {
      now = { error: err instanceof Error ? err.message.slice(0, 120) : String(err) };
    }
    const [stored] = await q(`SELECT COUNT(*) N FROM ${owner}."EUL4_B260506220828Q${n}R1"`);
    console.log(`== Q${n}: view ${String(status?.STATUS)}, rows now ${JSON.stringify(now)}, rows stored ${String(stored?.N)}`);
  }
  const { rows: m58d } = await pool.query<{ id: string; name: string }>(
    `SELECT m.id, m.name FROM maps m JOIN workbooks w ON w.id = m.workbook_id WHERE w.name = 'GD_M.M58D_V09.DIS' ORDER BY m.name`,
  );
  for (const m of m58d) {
    try {
      const def = await loadMapDefinition(m.id);
      const decision = decideMap(def);
      let columns = '';
      try {
        columns = generateSql(def).columns.map((c) => c.label).join(' | ');
      } catch (err) {
        columns = `generation failed: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`;
      }
      console.log(`== Neo ${m.name}: ${decision.decision}; ${columns.slice(0, 400)}`);
    } catch (err) {
      console.log(`== Neo ${m.name}: load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Which calculations does each sheet's statement actually compute, and how do
  // the statement's `E_<n>` aliases name them? Compared across the batch copy
  // (the document the scheduler ran) and the user's workbook (what Neo migrated).
  const statementCalcIds = new Map<number, number[]>();
  for (const n of [1, 2, 3, 4]) {
    const cols = await q(`SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = :o AND TABLE_NAME = :v ORDER BY COLUMN_ID`, {
      o: owner,
      v: `EUL4_B260506220828Q${n}V1`,
    });
    const names = cols.map((c) => String(c.COLUMN_NAME));
    statementCalcIds.set(n, names.filter((c) => c.startsWith('E_')).map((c) => Number(c.slice(2))));
    console.log(`== Q${n}V1: ${names.length} columns, ${names.filter((c) => /^E\d/.test(c)).length} EUL items, calcs ${JSON.stringify(statementCalcIds.get(n))}`);
  }
  for (const docId of [268781, 267837]) {
    const [row] = await q(`SELECT DOC_DOCUMENT FROM ${t('DOCUMENTS')} WHERE DOC_ID = :id`, { id: docId });
    const body = row?.DOC_DOCUMENT;
    const buffer = Buffer.isBuffer(body) ? body : typeof body === 'string' ? Buffer.from(body, 'latin1') : null;
    if (!buffer) {
      console.log(`== doc ${docId}: no body`);
      continue;
    }
    const doc = parseWorkbookDocument(buffer);
    const byId = new Map(readWorkbookElements(buffer).map((e) => [e.id, e]));
    for (const sheet of doc.worksheets) {
      const shown = new Set(sheet.columns.filter((c) => c.isCalculation).map((c) => c.elementRef));
      const calcs = sheet.calculations.map((c) => ({
        el: c.elementId,
        ident: c.identifier,
        // 0x00dd: the synthetic id a calculation carries where an item carries its EXP_ID.
        raw: byId.get(c.elementId)?.numbers.find((x) => x.tag === 0x00dd)?.value ?? null,
        shown: shown.has(c.elementId),
      }));
      console.log(
        `== doc ${docId} sheet "${String(sheet.name)}": ${sheet.columns.length} columns ` +
          `(${sheet.columns.filter((c) => c.isCalculation).length} calc columns), ${calcs.length} calculations offered; ` +
          `shown raw ids ${JSON.stringify(calcs.filter((c) => c.shown).map((c) => c.raw))}; ` +
          `shown identifiers ${JSON.stringify(calcs.filter((c) => c.shown).map((c) => c.ident))}`,
      );
    }
  }
  show(
    'documents named like that workbook (a batch job keeps its own copy)',
    await q(`SELECT DOC_ID, DOC_NAME, DOC_BATCH, DOC_EU_ID, DOC_LENGTH,
       TO_CHAR(DOC_CREATED_DATE, 'YYYY-MM-DD HH24:MI:SS') CREATED
     FROM ${t('DOCUMENTS')} WHERE DOC_NAME LIKE 'GD_M.M58D_V09%' ORDER BY DOC_ID`),
  );
  show(
    'recorded executions around that run',
    await q(`SELECT QS_DOC_NAME, QS_DOC_DETAILS, QS_NUM_ROWS, TO_CHAR(QS_CREATED_DATE, 'YYYY-MM-DD HH24:MI:SS') AT
     FROM ${t('QPP_STATS')} WHERE QS_CREATED_DATE BETWEEN DATE '2026-05-06' AND DATE '2026-05-08'
     ORDER BY QS_CREATED_DATE`),
  );
  show(
    'parameters of that run',
    await q(`SELECT p.BP_BS_ID, p.BP_NAME, SUBSTR(p.BP_VALUE1, 1, 24) V1, SUBSTR(p.BP_VALUE2, 1, 24) V2
     FROM ${t('BATCH_PARAMS')} p JOIN ${t('BATCH_SHEETS')} s ON s.BS_ID = p.BP_BS_ID
     WHERE s.BS_BR_ID = 268581 ORDER BY p.BP_BS_ID, p.BP_ID`),
  );

  const docNames = (await q(`SELECT DISTINCT QS_DOC_NAME N FROM ${t('QPP_STATS')} WHERE QS_DOC_NAME IS NOT NULL`))
    .map((r) => String(r.N));
  const { rows: wb } = await pool.query<{ name: string }>('SELECT name FROM workbooks');
  const known = new Set(wb.map((w) => w.name));
  const unmatched = docNames.filter((n) => !known.has(n));
  console.log(
    `\n== QS_DOC_NAME vs migrated workbooks: ${docNames.length - unmatched.length}/${docNames.length} match; ` +
      `${wb.length} workbooks on target; first unmatched: ${JSON.stringify(unmatched.slice(0, 5))}`,
  );
} finally {
  await releaseConnection(dataSourceId, conn);
  await pool.end();
  process.exit(0);
}
