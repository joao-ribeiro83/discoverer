/**
 * Phase 9.1 — result-set equivalence. Runs a stratified sample of migrated
 * worksheets in Neo and compares each result with the strongest reference the
 * legacy system left behind. READ ONLY against both databases.
 *
 *   docker exec discoverer-neo-backend sh -c 'cd /app/backend && \
 *     /app/node_modules/.bin/tsx src/scripts/diff-results.ts <dataSourceId> --sample 30 --timeout-s 1800 \
 *     [--report /tmp/diff-results.json] [--detail /tmp/diff-results-detail.json] [--max-rows N]'
 *
 * It lives here rather than beside `migrate/src/scripts/diff-corpus.ts` for the
 * reason `verify-migration.ts` does: only this workspace can generate Neo's SQL.
 * The pattern is the `d4wkdmp` harness's — a legacy reference, a normaliser, a
 * differ (`lib/result-diff.ts`), an aggregate report.
 *
 * References, strongest first (labels in `ORACLES`):
 *  - LEGACY_SQL. A scheduled run leaves `EUL4_B<stamp>Q<n>V1`: a view over the
 *    statement Discoverer generated for that sheet, with that run's parameter
 *    values, beside `…R1`, the rows it stored. Re-executed now the view is
 *    Discoverer's answer on today's data. It is trusted only when it was
 *    generated from the workbook as last saved — the version Neo migrated — and
 *    when re-executing it reproduces the rows it stored.
 *  - QPP_ROW_COUNT. The last row count `EUL4_QPP_STATS` recorded for the sheet.
 *    Weak: a count, from the past, usable only when that run's parameter values
 *    are known or the sheet has none.
 *
 * A reference counts only when Discoverer produced it connected as the account
 * this comparison connects as. Another account can resolve the same names to
 * other objects and hold other grants — and a comparison run with broader
 * rights than the legacy user's could show rows that user never saw.
 *
 * Neo is asked first. A worksheet Neo declines is REFUSED whatever the
 * reference says, and a legacy statement's calculations can take hours to
 * re-evaluate — Discoverer's own scheduled run of one did — so the full
 * statement only runs when there is a Neo answer to compare it with.
 *
 * Neo runs as each map's migrated owner, through the entitlement gate and the
 * generator a user's execution uses. Row-level security is forced OPEN: this
 * estate has no RLS (Phase 6.3), so OPEN over an empty policy table adds no
 * predicate — Discoverer's behaviour — where CLOSED (D-090) refuses every map
 * and would prove nothing.
 *
 * Verdicts and counts go to stdout and --report. Row values — both sides of a
 * mismatch — go only to --detail, which must be under /tmp.
 */
import { writeFileSync } from 'node:fs';

import { parseWorkbookDocument, readWorkbookElements } from '@discoverer-neo/core/migration';
import type { Connection } from 'oracledb';

import { config } from '../config.js';
import { pool } from '../db/index.js';
import { effectiveFolderSet } from '../lib/sql/folder-set.js';
import { planQuery } from '../lib/sql/planner.js';
import {
  ORACLES,
  STRATA,
  diffRowSets,
  rowSetVerdict,
  selectStratifiedSample,
  tallyVerdicts,
  type Candidate,
  type Cell,
  type DiffColumn,
  type SampleChoice,
  type VerdictRecord,
} from '../lib/result-diff.js';
import {
  openRowStream,
  prepareQueryForDefinition,
  type PreparedQuery,
} from '../services/map-execution.service.js';
import { getConnection, releaseConnection } from '../services/oracle-connection-pool.js';
import { resolveTargetMap } from '../services/schedule-import.service.js';
import { decideMap, loadMapDefinition } from '../services/sql-generator.js';
import type { MapDefinition } from '../types/sql.js';

const OUT_FORMAT_OBJECT = 4002;
/**
 * Per-call budget, `--timeout-s` (default 180). Discoverer's own scheduled run
 * of a legacy statement took six hours; 1 800 lets most of them finish.
 */
const STATEMENT_TIMEOUT_MS = Number(flag('--timeout-s') ?? 180) * 1000;
/** Oracle's and the driver's ways of saying a call outlived `callTimeout`. */
const TIMED_OUT = /ORA-03156|DPI-1067|DPI-1080|NJS-500/;
/** Discoverer's query governor stops at 60 000 rows and records 60 001. */
const FETCH_LIMIT = 60_000;
/** `0x00dd` — where a calculation element carries its negative synthetic id. */
const TAG_ITEM_SOURCE_ID = 0x00dd;
const MONTHS: Record<string, string> = {
  JAN: '01', FEV: '02', FEB: '02', MAR: '03', ABR: '04', APR: '04', MAI: '05', MAY: '05',
  JUN: '06', JUL: '07', AGO: '08', AUG: '08', SET: '09', SEP: '09', OUT: '10', OCT: '10',
  NOV: '11', DEZ: '12', DEC: '12',
};

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const dataSourceId = process.argv[2];
const owner = (flag('--owner') ?? 'SIID_TESTES').toUpperCase();
const sampleSize = Number(flag('--sample') ?? 12);
const maxRows = Number(flag('--max-rows') ?? 100_000);
const reportPath = flag('--report');
const detailPath = flag('--detail');
if (!dataSourceId || dataSourceId.startsWith('--')) {
  throw new Error(
    'usage: diff-results.ts <dataSourceId> [--sample N] [--timeout-s N] [--report path] [--detail /tmp/path] [--max-rows N]',
  );
}
if (detailPath && !detailPath.startsWith('/tmp/')) {
  throw new Error('--detail holds customer row values and must be under /tmp/, outside the repository');
}

config.ROW_LEVEL_FAIL_MODE = 'OPEN';
const t = (name: string) => `${owner}.EUL4_${name}`;

let conn: Connection = await getConnection(dataSourceId);
conn.callTimeout = STATEMENT_TIMEOUT_MS;
/**
 * A call that outlives `callTimeout` leaves its connection unusable, so each
 * worksheet starts on a fresh one. After a long statement the server can be
 * slow to open a session — the pool's 10 s wait ended a run once — so this
 * waits and retries before it gives up.
 */
async function freshConnection(): Promise<void> {
  await releaseConnection(dataSourceId!, conn).catch(() => undefined);
  for (let attempt = 1; ; attempt += 1) {
    try {
      conn = await getConnection(dataSourceId!);
      break;
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((resolve) => setTimeout(resolve, 30_000));
    }
  }
  conn.callTimeout = STATEMENT_TIMEOUT_MS;
}

async function q(sql: string, binds: Record<string, unknown> = {}): Promise<Array<Record<string, unknown>>> {
  const result = await conn.execute(sql, binds as never, { outFormat: OUT_FORMAT_OBJECT });
  return (result.rows ?? []) as Array<Record<string, unknown>>;
}

/** All rows of a statement, as arrays in select order, up to `maxRows`. */
async function fetchRows(statement: Pick<PreparedQuery, 'sql' | 'bindParams'>): Promise<{ rows: Cell[][]; capped: boolean }> {
  const stream = await openRowStream(conn, statement as PreparedQuery);
  const names = (stream.metaData ?? []).map((m) => m.name);
  const rows: Cell[][] = [];
  try {
    for await (const batch of stream.batches) {
      for (const row of batch) {
        if (rows.length >= maxRows) return { rows, capped: true };
        rows.push(names.map((n) => row[n] as Cell));
      }
    }
  } finally {
    await stream.close();
  }
  return { rows, capped: false };
}

const kindOf = (oracleType: string): DiffColumn['kind'] =>
  oracleType === 'NUMBER' ? 'number' : oracleType === 'DATE' ? 'date' : 'text';

/** A scheduled run's DATE value as its session printed it — `31-DEZ-2025`, or Portugal's `RR.MM.DD` — as ISO. */
function isoDate(value: string): string {
  const v = value.trim();
  const named = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(v);
  const month = named ? MONTHS[named[2]!.toUpperCase()] : undefined;
  if (named && month) return `${named[3]}-${month}-${named[1]!.padStart(2, '0')}`;
  const rr = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(v);
  if (rr) return `${Number(rr[1]) < 50 ? '20' : '19'}${rr[1]}-${rr[2]}-${rr[3]}`;
  return v;
}

/** Bind placeholders outside string literals — enough to name the one Oracle could not find. */
function placeholders(sql: string): string[] {
  const bare = sql.replace(/'(?:[^']|'')*'/g, "''");
  return [...new Set([...bare.matchAll(/:([A-Za-z][A-Za-z0-9_]*)/g)].map((m) => m[1]!))];
}

const [me] = await q('SELECT USER U FROM DUAL');
/** The database account this comparison connects as. */
const account = (me?.U as string).toUpperCase();

// ---------------------------------------------------------------------------
// What Neo holds
// ---------------------------------------------------------------------------

const { rows: mapRows } = await pool.query<{
  id: string; name: string; owner: string; select_distinct: boolean;
  calcs: number; totals: number; folders: number; params: number;
}>(`SELECT m.id, m.name, m.created_by AS owner, m.select_distinct,
      (SELECT COUNT(*)::int FROM map_calculated_fields c WHERE c.map_id = m.id) AS calcs,
      (SELECT COUNT(*)::int FROM map_totals x WHERE x.map_id = m.id) AS totals,
      (SELECT COUNT(DISTINCT i.folder_id)::int FROM map_items mi JOIN items i ON i.id = mi.item_id
        WHERE mi.map_id = m.id) AS folders,
      (SELECT COUNT(*)::int FROM map_parameters p WHERE p.map_id = m.id) AS params
    FROM maps m WHERE m.is_active`);
const mapById = new Map(mapRows.map((m) => [m.id, m]));

// ---------------------------------------------------------------------------
// What the legacy system left behind
// ---------------------------------------------------------------------------

const batchSheets = await q(`SELECT r.BR_NAME, r.BR_WORKBOOK_NAME, r.BR_REPORT_SCHEMA, s.BS_ID, s.BS_SHEET_NAME
  FROM ${t('BATCH_REPORTS')} r JOIN ${t('BATCH_SHEETS')} s ON s.BS_BR_ID = r.BR_ID`);
const sheetOfRun = new Map(batchSheets.map((b) => [JSON.stringify([b.BR_NAME, b.BS_SHEET_NAME]), b]));

const paramsBySheet = new Map<number, Array<{ name: string; values: string[] }>>();
for (const p of await q(`SELECT BP_BS_ID, BP_NAME, BP_VALUE1, BP_VALUE2, BP_VALUE3, BP_VALUE4, BP_VALUE5, BP_VALUE6
    FROM ${t('BATCH_PARAMS')}`)) {
  const values = [1, 2, 3, 4, 5, 6]
    .map((i) => p[`BP_VALUE${i}`] as string | null)
    .filter((v): v is string => v !== null && v !== undefined);
  const list = paramsBySheet.get(Number(p.BP_BS_ID)) ?? [];
  list.push({ name: p.BP_NAME as string, values });
  paramsBySheet.set(Number(p.BP_BS_ID), list);
}

/** Usage per map: every recorded execution, and the most recent one. */
interface Recording { rows: number; at: Date; sheetId: number | null; account: string | null }
const usage = new Map<string, { runs: number; latest: Recording }>();
for (const u of await q(`SELECT QS_DOC_NAME DOC, QS_DOC_DETAILS SHEET, COUNT(*) RUNS,
    MAX(QS_NUM_ROWS) KEEP (DENSE_RANK LAST ORDER BY QS_CREATED_DATE) LAST_ROWS,
    MAX(QS_CREATED_BY) KEEP (DENSE_RANK LAST ORDER BY QS_CREATED_DATE) LAST_BY,
    MAX(QS_CREATED_DATE) LAST_AT
  FROM ${t('QPP_STATS')} WHERE QS_DOC_NAME IS NOT NULL GROUP BY QS_DOC_NAME, QS_DOC_DETAILS`)) {
  const doc = u.DOC as string;
  const sheet = (u.SHEET as string | null) ?? '';
  // A scheduled run records the batch job's name, not the workbook's.
  const run = sheetOfRun.get(JSON.stringify([doc, sheet]));
  const target = await resolveTargetMap(run ? (run.BR_WORKBOOK_NAME as string) : doc, sheet);
  if (!target || target.ambiguous) continue;
  const entry = usage.get(target.mapId) ?? { runs: 0, latest: { rows: -1, at: new Date(0), sheetId: null, account: null } };
  entry.runs += Number(u.RUNS);
  const at = u.LAST_AT as Date;
  if (at > entry.latest.at) {
    entry.latest = {
      rows: Number(u.LAST_ROWS),
      at,
      sheetId: run ? Number(run.BS_ID) : null,
      account: ((run ? run.BR_REPORT_SCHEMA : u.LAST_BY) as string | null)?.toUpperCase() ?? null,
    };
  }
  usage.set(target.mapId, entry);
}

interface LegacyStatement {
  view: string;
  stored: string;
  sheetId: number;
  batchDoc: string;
  sheet: string;
  /** The account the scheduled run connected as. */
  account: string;
  /** The scheduler's own read of `stored`, naming which `BR…` column holds which alias. Null on some runs. */
  resultSql: string | null;
}
const legacy = new Map<string, LegacyStatement>();
const notes: string[] = [];
const stamps = new Map<string, number[]>();
for (const v of await q(`SELECT VIEW_NAME FROM ALL_VIEWS WHERE OWNER = :o
    AND REGEXP_LIKE(VIEW_NAME, '^EUL4_B[0-9]{12}Q[0-9]+V1$')`, { o: owner })) {
  const m = /_B(\d{12})Q(\d+)V1$/.exec(v.VIEW_NAME as string);
  if (m) stamps.set(m[1]!, [...(stamps.get(m[1]!) ?? []), Number(m[2])]);
}
for (const [stamp, indexes] of stamps) {
  // `Q<n>` is the n-th query of the run that owns the stamp — attributable
  // only when exactly one run's queries were written in that window.
  const queries = await q(`SELECT r.BR_ID, r.BR_NAME, r.BR_WORKBOOK_NAME, r.BR_REPORT_SCHEMA, s.BS_ID, s.BS_SHEET_NAME,
      bq.BQ_RESULT_SQL_1 || bq.BQ_RESULT_SQL_2 || bq.BQ_RESULT_SQL_3 || bq.BQ_RESULT_SQL_4 RESULT_SQL,
      (SELECT MAX(NVL(d.DOC_UPDATED_DATE, d.DOC_CREATED_DATE)) FROM ${t('DOCUMENTS')} d
        WHERE d.DOC_NAME = r.BR_WORKBOOK_NAME AND d.DOC_BATCH = 0) SAVED,
      TO_DATE(:s, 'YYMMDDHH24MISS') STAMPED
    FROM ${t('BATCH_QUERIES')} bq JOIN ${t('BATCH_SHEETS')} s ON s.BS_ID = bq.BQ_BS_ID
    JOIN ${t('BATCH_REPORTS')} r ON r.BR_ID = s.BS_BR_ID
    WHERE bq.BQ_CREATED_DATE BETWEEN TO_DATE(:s, 'YYMMDDHH24MISS') AND TO_DATE(:s, 'YYMMDDHH24MISS') + 120 / 86400
    ORDER BY bq.BQ_ID`, { s: stamp });
  if (new Set(queries.map((x) => x.BR_ID)).size !== 1 || queries.length < Math.max(...indexes)) {
    notes.push(`statements stamped ${stamp}: no single scheduled run owns them, so none is attributed`);
    continue;
  }
  const first = queries[0]!;
  // A statement generated before the workbook was last saved describes an
  // older worksheet than the one Neo migrated.
  if (first.SAVED instanceof Date && first.STAMPED instanceof Date && first.SAVED > first.STAMPED) {
    notes.push(
      `statements stamped ${stamp} (${first.BR_WORKBOOK_NAME as string}) predate the workbook's last save ` +
        `(${first.SAVED.toISOString().slice(0, 10)}), so none is attributed`,
    );
    continue;
  }
  for (const n of indexes) {
    const bq = queries[n - 1]!;
    const target = await resolveTargetMap(bq.BR_WORKBOOK_NAME as string, bq.BS_SHEET_NAME as string);
    if (!target || target.ambiguous) {
      notes.push(`statement ${stamp}Q${n} (${bq.BR_WORKBOOK_NAME as string} / ${bq.BS_SHEET_NAME as string}): no migrated map`);
      continue;
    }
    legacy.set(target.mapId, {
      view: `EUL4_B${stamp}Q${n}V1`,
      stored: `EUL4_B${stamp}Q${n}R1`,
      sheetId: Number(bq.BS_ID),
      batchDoc: bq.BR_NAME as string,
      sheet: bq.BS_SHEET_NAME as string,
      account: ((bq.BR_REPORT_SCHEMA as string | null) ?? owner).toUpperCase(),
      resultSql: (bq.RESULT_SQL as string | null) || null,
    });
  }
}

async function columnsOf(view: string): Promise<Array<{ name: string; type: string }>> {
  return (await q(`SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = :o AND TABLE_NAME = :v
      ORDER BY COLUMN_ID`, { o: owner, v: view })).map((c) => ({ name: c.COLUMN_NAME as string, type: c.DATA_TYPE as string }));
}

/**
 * The stored table's column for each view column. Stored columns are
 * `BRN`/`BRVC`/`BRD`, numbered per type; the scheduler's result SQL names the
 * pairing when it kept one, and select order stands in when it did not.
 */
function storedColumnNames(viewColumns: Array<{ name: string; type: string }>, resultSql: string | null): string[] {
  const named = new Map(
    [...(resultSql ?? '').matchAll(/\b(BR(?:N|VC|D)\d+) as (E_?\d+)/gi)].map((m) => [m[2]!.toUpperCase(), m[1]!]),
  );
  const seen = { n: 0, d: 0, c: 0 };
  return viewColumns.map(
    (c) => named.get(c.name) ?? (c.type === 'NUMBER' ? `BRN${++seen.n}` : c.type === 'DATE' ? `BRD${++seen.d}` : `BRVC${++seen.c}`),
  );
}

// Before a statement may speak for Discoverer: re-execute its EUL item columns
// and diff them against the rows the scheduler stored. Items only — naming a
// calculation column makes Oracle evaluate the worksheet's calculations, which
// took Discoverer's own run six hours; this projection does not.
const reproduces = new Map<string, string>();
let storedSample: { columns: DiffColumn[]; reference: Cell[][]; neo: Cell[][] } | null = null;
for (const [mapId, ref] of legacy) {
  try {
    const viewColumns = await columnsOf(ref.view);
    const physical = storedColumnNames(viewColumns, ref.resultSql);
    const items = viewColumns.flatMap((c, i) => (/^E\d+$/.test(c.name) ? [i] : []));
    const columns = items.map((i) => ({ name: viewColumns[i]!.name, kind: kindOf(viewColumns[i]!.type), key: viewColumns[i]!.type !== 'NUMBER' }));
    const now = await fetchRows({ sql: `SELECT ${items.map((i) => `"${viewColumns[i]!.name}"`).join(', ')} FROM ${owner}."${ref.view}"`, bindParams: {} });
    const stored = await fetchRows({ sql: `SELECT ${items.map((i) => physical[i]).join(', ')} FROM ${owner}."${ref.stored}"`, bindParams: {} });
    const drift = diffRowSets(columns, stored.rows, now.rows);
    reproduces.set(
      mapId,
      `${rowSetVerdict(drift)} (${drift.referenceRows} stored, ${drift.neoRows} now, ${items.length} item columns` +
        `${rowSetVerdict(drift) === 'MATCH' ? '' : `; ${drift.onlyInReference} stored rows no longer returned`})`,
    );
    if (!storedSample && rowSetVerdict(drift) === 'MATCH' && stored.rows.length > 0) {
      storedSample = { columns, reference: stored.rows, neo: now.rows };
    }
  } catch (err) {
    reproduces.set(mapId, `not checked: ${errText(err)}`);
    await freshConnection().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// The sample
// ---------------------------------------------------------------------------

/** The account Discoverer connected as when it produced the reference, when known. */
function ranAs(mapId: string): string | null {
  return legacy.get(mapId)?.account ?? usage.get(mapId)?.latest.account ?? null;
}

/** Whether any reference can speak for this map at all. */
function hasOracle(mapId: string): boolean {
  const by = ranAs(mapId);
  if (by !== null && by !== account) return false;
  if (legacy.has(mapId)) return true;
  const latest = usage.get(mapId)?.latest;
  if (!latest || latest.rows >= FETCH_LIMIT) return false;
  return latest.sheetId !== null || mapById.get(mapId)?.params === 0;
}

const candidates: Candidate[] = [];
const decisions = new Map<string, number>();
for (const [mapId, u] of usage) {
  const m = mapById.get(mapId);
  if (!m) continue;
  let multiFolder = m.folders > 1;
  let masterDetail = false;
  let decision = 'UNLOADABLE';
  try {
    const def = await loadMapDefinition(mapId);
    // Folders whose values reach the statement — conditions and calculations included, not just the columns.
    multiFolder = new Set(effectiveFolderSet(def).columnBearingFolderIds).size > 1;
    decision = decideMap(def).decision;
    masterDetail =
      decision.startsWith('REWRITE') || (decision.startsWith('FLAT') && planQuery(def).fromFolderIds.length > 1);
  } catch {
    // Not loadable: evaluation refuses it and records why.
  }
  const kind = decision.replace(/\(.*$/, '');
  decisions.set(kind, (decisions.get(kind) ?? 0) + 1);
  candidates.push({
    mapId,
    name: m.name,
    runs: u.runs,
    strata: { multiFolder, calculated: m.calcs > 0, totals: m.totals > 0, distinct: m.select_distinct, masterDetail },
  });
}
const comparable = candidates.filter((c) => hasOracle(c.mapId));
const otherAccount = candidates.filter((c) => {
  const by = ranAs(c.mapId);
  return by !== null && by !== account;
});
const { sample, uncovered } = selectStratifiedSample(comparable, sampleSize);
// Every worksheet a strong reference or a known-parameter run speaks for is
// compared, whatever its usage rank: they are the evidence this estate has.
for (const c of comparable) {
  if (sample.some((s) => s.mapId === c.mapId)) continue;
  if (legacy.has(c.mapId)) sample.push({ ...c, reason: 'legacy statement' });
  else if (usage.get(c.mapId)?.latest.sheetId !== null) sample.push({ ...c, reason: 'scheduled run, parameters known' });
}
const unreachable = candidates
  .filter((c) => !hasOracle(c.mapId))
  .sort((a, b) => b.runs - a.runs)
  .slice(0, 5)
  .map((c) => `${c.name} (${c.runs} runs)`);

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function neoParameters(def: MapDefinition, sheetId: number | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { name, values } of sheetId === null ? [] : (paramsBySheet.get(sheetId) ?? [])) {
    const param = def.parameters.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!param || values.length === 0) continue;
    const cast = values.map((v) => (param.paramType === 'DATE' ? isoDate(v) : v));
    out[param.name] = cast.length === 1 ? cast[0] : cast;
  }
  return out;
}

/**
 * Pair the legacy statement's columns with Neo's. `E<id>` is an EUL item's
 * `EXP_ID`; `E_<id>` a calculation's synthetic id, which only the scheduler's
 * own copy of the workbook translates to a name.
 */
async function alignColumns(
  def: MapDefinition,
  prepared: PreparedQuery,
  viewColumns: Array<{ name: string; type: string }>,
  ref: LegacyStatement,
): Promise<{ pairs: Array<{ ref: number; neo: number; column: DiffColumn }>; referenceOnly: string[]; neoOnly: string[] }> {
  const labelOf = new Map<string, string>();
  const itemIds = viewColumns.filter((c) => /^E\d+$/.test(c.name)).map((c) => c.name.slice(1));
  if (itemIds.length > 0) {
    for (const e of await q(`SELECT e.EXP_ID, e.EXP_NAME, o.OBJ_NAME FROM ${t('EXPRESSIONS')} e
        JOIN ${t('OBJS')} o ON o.OBJ_ID = e.IT_OBJ_ID WHERE e.EXP_ID IN (${itemIds.join(',')})`)) {
      const hit = def.items.find(
        ({ mapItem, item, folder }) => !mapItem.isHidden && item.name === e.EXP_NAME && folder.name === e.OBJ_NAME,
      );
      if (hit) labelOf.set(`E${Number(e.EXP_ID)}`, hit.mapItem.displayName || hit.item.name);
    }
  }
  if (viewColumns.some((c) => c.name.startsWith('E_'))) {
    const [row] = await q(`SELECT DOC_DOCUMENT FROM ${t('DOCUMENTS')} WHERE DOC_NAME = :n AND DOC_BATCH = 1`, { n: ref.batchDoc });
    const body = row?.DOC_DOCUMENT;
    if (Buffer.isBuffer(body)) {
      const byId = new Map(readWorkbookElements(body).map((e) => [e.id, e]));
      const sheet = parseWorkbookDocument(body).worksheets.find((w) => w.name === ref.sheet);
      for (const calc of sheet?.calculations ?? []) {
        const raw = byId.get(calc.elementId)?.numbers.find((x) => x.tag === TAG_ITEM_SOURCE_ID)?.value;
        if (raw !== undefined && raw < 0) labelOf.set(`E_${-raw}`, calc.name);
      }
    }
  }
  const labels = prepared.columns.map((c) => c.label);
  const pairs: Array<{ ref: number; neo: number; column: DiffColumn }> = [];
  const referenceOnly: string[] = [];
  viewColumns.forEach((c, i) => {
    const label = labelOf.get(c.name);
    const neo = label !== undefined && labels.filter((l) => l === label).length === 1 ? labels.indexOf(label) : -1;
    if (neo < 0) referenceOnly.push(label ?? c.name);
    else pairs.push({ ref: i, neo, column: { name: label!, kind: kindOf(c.type), key: c.type !== 'NUMBER' } });
  });
  const neoOnly = labels.filter((_, j) => !pairs.some((p) => p.neo === j));
  return { pairs, referenceOnly, neoOnly };
}

interface Evaluation extends VerdictRecord {
  recordedAt?: string;
  storedVsNow?: string;
  columnsCompared?: number;
  referenceOnly?: string[];
  neoOnly?: string[];
}
const details: Array<{ name: string; detail: unknown }> = [];
let selfCheckInput: { columns: DiffColumn[]; reference: Cell[][]; neo: Cell[][] } | null = null;

async function evaluate(choice: SampleChoice): Promise<Evaluation> {
  const ref = legacy.get(choice.mapId);
  const recording = usage.get(choice.mapId)?.latest;
  const storedVsNow = reproduces.get(choice.mapId);
  const base = {
    mapId: choice.mapId,
    name: choice.name,
    strata: STRATA.filter((s) => choice.strata[s]),
    oracle: ref ? ('LEGACY_SQL' as const) : ('QPP_ROW_COUNT' as const),
    storedVsNow,
  };
  const notComparable = (reason: string): Evaluation => ({ ...base, verdict: 'NOT_COMPARABLE', reason });
  const by = ranAs(choice.mapId);
  if (by !== null && by !== account) {
    return notComparable(`Discoverer produced the reference as ${by}; this comparison connects as ${account}`);
  }
  if (!ref && !recording) return notComparable('no recorded execution');
  if (!ref && recording!.rows >= FETCH_LIMIT) return notComparable("the recorded count sits at Discoverer's fetch limit");

  const sheetId = ref ? ref.sheetId : recording!.sheetId;
  const supplied = sheetId === null ? [] : (paramsBySheet.get(sheetId) ?? []).map((p) => p.name);

  // Neo first. Everything before its statement reaches Oracle is Neo declining.
  let def: MapDefinition;
  let prepared: PreparedQuery;
  try {
    def = await loadMapDefinition(choice.mapId);
    if (!ref && sheetId === null && def.parameters.length > 0) {
      return notComparable("parameterised, and the recorded run's values were not kept");
    }
    prepared = await prepareQueryForDefinition(def, neoParameters(def, sheetId), mapById.get(choice.mapId)!.owner);
  } catch (err) {
    const reason = errText(err);
    return /^Missing required parameter/.test(reason)
      ? notComparable(`${reason}; the scheduled run supplied ${JSON.stringify(supplied)}`)
      : { ...base, verdict: 'REFUSED', reason };
  }
  const neoFailed = (err: unknown): Evaluation => {
    const reason = errText(err);
    if (TIMED_OUT.test(reason)) return notComparable(`Neo's statement outlived this harness's ${STATEMENT_TIMEOUT_MS / 1000} s budget`);
    const unbound = /ORA-01008/.test(reason) ? placeholders(prepared.sql).filter((p) => !(p in prepared.bindParams)) : [];
    return {
      ...base,
      verdict: 'MISMATCH',
      // Neo wrote a statement and Oracle rejected it: the old system answered, the new one did not.
      reason: `Neo's statement failed: ${reason}${unbound.length > 0 ? `; unbound: ${unbound.join(', ')}` : ''}`,
    };
  };

  if (!ref) {
    try {
      const [row] = await q(`SELECT COUNT(*) N FROM (${prepared.sql})`, prepared.bindParams);
      const neoRows = Number(row?.N);
      return {
        ...base,
        verdict: neoRows === recording!.rows ? 'MATCH' : 'MISMATCH',
        referenceRows: recording!.rows,
        neoRows,
        recordedAt: recording!.at.toISOString().slice(0, 10),
        reason: sheetId === null ? 'no parameters' : 'parameters from the scheduled run',
      };
    } catch (err) {
      return neoFailed(err);
    }
  }

  if (!storedVsNow?.startsWith('MATCH')) {
    return notComparable(`re-executing the legacy statement does not reproduce what it stored: ${storedVsNow ?? 'not checked'}`);
  }
  const viewColumns = await columnsOf(ref.view);
  let reference: Cell[][];
  try {
    const got = await fetchRows({ sql: `SELECT * FROM ${owner}."${ref.view}"`, bindParams: {} });
    if (got.capped) return notComparable(`the legacy statement returns more than ${maxRows} rows`);
    reference = got.rows;
  } catch (err) {
    return notComparable(`the legacy statement could not be re-executed in full: ${errText(err)}`);
  }

  try {
    const neo = await fetchRows(prepared);
    if (neo.capped) return notComparable(`Neo returns more than ${maxRows} rows`);
    const { pairs, referenceOnly, neoOnly } = await alignColumns(def, prepared, viewColumns, ref);
    const columns = pairs.map((p) => p.column);
    const refRows = reference.map((r) => pairs.map((p) => r[p.ref]));
    const neoRows = neo.rows.map((r) => pairs.map((p) => r[p.neo]));
    const diff = diffRowSets(columns, refRows, neoRows);
    const verdict = rowSetVerdict(diff) === 'MATCH' && neoOnly.length === 0 ? 'MATCH' : 'MISMATCH';
    if (verdict === 'MISMATCH') {
      details.push({ name: choice.name, detail: { neoOnly, referenceOnly, ...diff, cellDiffs: diff.cellDiffs.slice(0, 20) } });
    } else if (!selfCheckInput && refRows.length > 0) {
      selfCheckInput = { columns, reference: refRows, neo: neoRows };
    }
    return {
      ...base,
      verdict,
      referenceRows: diff.referenceRows,
      neoRows: diff.neoRows,
      columnsCompared: pairs.length,
      referenceOnly,
      neoOnly,
      reason:
        verdict === 'MATCH'
          ? undefined
          : neoOnly.length > 0
            ? `Neo shows ${neoOnly.length} column(s) the legacy statement does not select`
            : `rows differ: ${diff.onlyInReference} only in legacy, ${diff.onlyInNeo} only in Neo; ` +
              `columns ${JSON.stringify(diff.columnMismatches)}`,
    };
  } catch (err) {
    return neoFailed(err);
  }
}

const records: Evaluation[] = [];
try {
  for (const choice of sample) {
    // A connection that cannot be had costs this worksheet its verdict, not the run.
    const record = await freshConnection()
      .then(() => evaluate(choice))
      .catch(
      (err: unknown): Evaluation => ({
        mapId: choice.mapId,
        name: choice.name,
        strata: STRATA.filter((s) => choice.strata[s]),
        oracle: legacy.has(choice.mapId) ? 'LEGACY_SQL' : 'QPP_ROW_COUNT',
        verdict: 'NOT_COMPARABLE',
        reason: `evaluation failed: ${errText(err)}`,
      }),
    );
    records.push(record);
    console.log(
      `${record.verdict.padEnd(14)} ${record.oracle.padEnd(13)} ` +
        `${`${record.referenceRows ?? '-'}/${record.neoRows ?? '-'}`.padEnd(13)} ${choice.name}` +
        ` [${choice.reason}]${record.reason ? ` — ${record.reason.slice(0, 240)}` : ''}`,
    );
  }
} finally {
  await releaseConnection(dataSourceId, conn).catch(() => undefined);
}

// Normalisation must not mask a real difference — shown on real data: take a
// matched pair of result sets, alter one value, and demand a mismatch. A Neo
// match is used when there is one; otherwise a legacy statement's stored rows
// against their re-execution, which are the same answer twice.
let selfCheck = 'not run: no row-level match with rows';
const probe = selfCheckInput ?? storedSample;
if (probe) {
  const { columns, reference, neo } = probe;
  const at = Math.max(0, columns.findIndex((c) => c.kind === 'number'));
  const altered = neo.map((row, i) =>
    i !== 0 ? row : row.map((cell, j) => (j !== at ? cell : typeof cell === 'number' ? cell + 1 : `${String(cell ?? '')}x`)),
  );
  const source = selfCheckInput ? 'a Neo match' : "a legacy statement's stored and re-executed rows";
  selfCheck =
    rowSetVerdict(diffRowSets(columns, reference, altered)) === 'MISMATCH'
      ? `PASS on ${source} (${reference.length} rows): one altered ${columns[at]?.kind ?? ''} value turned MATCH into MISMATCH`
      : `FAIL on ${source}: an altered value still matched`;
}

const tally = tallyVerdicts(records);
console.log(`\nconnected as: ${account}`);
console.log(
  `worksheets with recorded usage: ${candidates.length}; with a usable reference: ${comparable.length}; ` +
    `whose latest reference another account produced: ${otherAccount.length}`,
);
console.log(`planner decisions over those worksheets: ${JSON.stringify(Object.fromEntries(decisions))}`);
console.log(`most-used worksheets no reference speaks for: ${JSON.stringify(unreachable)}`);
console.log(`legacy statements reproducing their stored rows: ${JSON.stringify([...reproduces.values()])}`);
console.log(`verdicts: ${JSON.stringify(tally.byVerdict)}`);
console.log(`by oracle: ${JSON.stringify(tally.byOracle)}`);
console.log(`by stratum: ${JSON.stringify(tally.byStratum)}`);
console.log(`strata no comparable worksheet covers: ${JSON.stringify(uncovered)}`);
console.log(`self-check: ${selfCheck}`);
for (const note of notes) console.log(`note: ${note}`);

if (reportPath) {
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        connectedAs: account,
        oracles: ORACLES,
        usedWorksheets: candidates.length,
        comparableWorksheets: comparable.length,
        otherAccountWorksheets: otherAccount.length,
        decisions: Object.fromEntries(decisions),
        unreachable,
        reproduces: Object.fromEntries(reproduces),
        sample: sample.map(({ mapId, name, runs, strata, reason }) => ({ mapId, name, runs, strata, reason })),
        uncovered,
        records,
        tally,
        selfCheck,
        notes,
      },
      null,
      2,
    ),
  );
}
if (detailPath) writeFileSync(detailPath, JSON.stringify(details, null, 2));
await pool.end();
process.exit(0);
