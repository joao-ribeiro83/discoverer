/**
 * Read-only probe for Phase 9.2: can the source EUL say what changed since a
 * recorded point, or must a delta be a content diff?
 *
 *   docker exec discoverer-neo-backend sh -c \
 *     'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/probe-eul-change-detection.ts <dataSourceId> [owner] [prefix]'
 *
 * Prints column names, counts and dates only — never a row of report data.
 */
import { getConnection, releaseConnection } from '../services/oracle-connection-pool.js';

const dataSourceId = process.argv[2];
const owner = (process.argv[3] ?? 'SIID_TESTES').toUpperCase();
const prefix = (process.argv[4] ?? 'EUL4_').toUpperCase();
if (!dataSourceId) throw new Error('usage: probe-eul-change-detection.ts <dataSourceId> [owner] [prefix]');

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
  const cols = await q(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS
     WHERE OWNER = :owner AND TABLE_NAME LIKE :pfx
       AND (COLUMN_NAME LIKE '%UPDATED_DATE' OR COLUMN_NAME LIKE '%CREATED_DATE'
         OR COLUMN_NAME LIKE '%ELEMENT_STATE' OR COLUMN_NAME LIKE '%UPDATED_BY'
         OR COLUMN_NAME IN ('NOTM') OR COLUMN_NAME LIKE '%VERSION%' OR COLUMN_NAME LIKE '%DELETED%')
     ORDER BY TABLE_NAME, COLUMN_NAME`,
    { owner, pfx: `${prefix}%` },
  );
  const byTable = new Map<string, string[]>();
  for (const c of cols) {
    const t = String(c.TABLE_NAME);
    byTable.set(t, [...(byTable.get(t) ?? []), String(c.COLUMN_NAME)]);
  }
  const allTables = await q(
    `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :owner AND TABLE_NAME LIKE :pfx ORDER BY 1`,
    { owner, pfx: `${prefix}%` },
  );
  show('tables with NO audit/state column', allTables.filter((t) => !byTable.has(String(t.TABLE_NAME))));
  show('audit/state columns per table', [...byTable].map(([t, c]) => ({ t, c })));

  show('VERSIONS', await q(`SELECT * FROM ${owner}.${prefix}VERSIONS`));

  // Per table: row count, date ranges, rows ever updated, element-state values, NOTM range.
  const stats: Array<Record<string, unknown>> = [];
  for (const [table, c] of byTable) {
    const upd = c.find((x) => x.endsWith('_UPDATED_DATE'));
    const cre = c.find((x) => x.endsWith('_CREATED_DATE'));
    const st = c.find((x) => x.endsWith('_ELEMENT_STATE'));
    const notm = c.includes('NOTM');
    const parts = ['COUNT(*) N'];
    if (cre) parts.push(`MIN(${cre}) MIN_CRE`, `MAX(${cre}) MAX_CRE`, `SUM(CASE WHEN ${cre} IS NULL THEN 1 ELSE 0 END) CRE_NULL`);
    if (upd) {
      parts.push(`MAX(${upd}) MAX_UPD`, `SUM(CASE WHEN ${upd} IS NULL THEN 1 ELSE 0 END) UPD_NULL`);
      if (cre) parts.push(`SUM(CASE WHEN ${upd} > ${cre} THEN 1 ELSE 0 END) UPD_AFTER_CRE`);
    }
    if (st) parts.push(`COUNT(DISTINCT ${st}) STATES`, `MIN(${st}) ST_MIN`, `MAX(${st}) ST_MAX`);
    if (notm) parts.push('MIN(NOTM) NOTM_MIN', 'MAX(NOTM) NOTM_MAX', 'COUNT(DISTINCT NOTM) NOTM_DISTINCT');
    try {
      const [r] = await q(`SELECT ${parts.join(', ')} FROM ${owner}.${table}`);
      stats.push({ table, ...r });
    } catch (err) {
      stats.push({ table, error: (err as Error).message.slice(0, 120) });
    }
  }
  show('per-table stats', stats);

  // Does editing a child bump its parent? Items/joins newer than their folder.
  show(
    'items updated after their folder',
    await q(`SELECT COUNT(*) N FROM ${owner}.${prefix}EXPRESSIONS e JOIN ${owner}.${prefix}OBJS o
             ON o.OBJ_ID = e.IT_OBJ_ID WHERE e.EXP_UPDATED_DATE > o.OBJ_UPDATED_DATE`),
  );
  // ORA_ROWSCN is Oracle's own change stamp; see whether it is readable here.
  show(
    'ORA_ROWSCN readable on OBJS',
    await q(`SELECT MIN(ORA_ROWSCN) MIN_SCN, MAX(ORA_ROWSCN) MAX_SCN, COUNT(DISTINCT ORA_ROWSCN) DISTINCT_SCN
             FROM ${owner}.${prefix}OBJS`),
  );
  show('last DDL/DML on the EUL tables', await q(
    `SELECT OBJECT_NAME, LAST_DDL_TIME FROM ALL_OBJECTS WHERE OWNER = :owner AND OBJECT_NAME LIKE :pfx
     AND OBJECT_TYPE = 'TABLE' ORDER BY LAST_DDL_TIME DESC FETCH FIRST 5 ROWS ONLY`,
    { owner, pfx: `${prefix}%` },
  ));
} finally {
  await releaseConnection(dataSourceId, conn);
  process.exit(0);
}
