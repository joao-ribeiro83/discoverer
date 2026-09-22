/**
 * One-time backfill (Phase 9.3 follow-up, decided 2026-09-17 — see
 * `docs/decisions/scheduled-result-retention.md`): migrate the row contents
 * of the `EUL4_B<timestamp>Q<n>R1` historical batch-result tables into
 * `scheduled_results`, attached to the schedule
 * `schedule-import.service.ts` (Phase 7.2) already created for the same
 * report+sheet.
 *
 * How a physical result table is found for a given schedule — none of this
 * is guessed, all of it is in `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §3.8:
 *
 *  - `EUL4_BATCH_QUERIES.BQ_RESULT_SQL_1..4` (concatenated) holds the SQL
 *    Discoverer ran, with the literal placeholder text `<TABLE_NAME>` still
 *    in it — the real table name was substituted at run time and is not
 *    stored anywhere. But the table's own name tells us: it is
 *    `<prefix>B<timestamp>Q<n>R1`, where `<timestamp>` is the run's
 *    `BRR_RUN_DATE` (`YYMMDDHH24MISS`) and `<n>` is the query's 1-based
 *    position among its report's `BATCH_QUERIES` rows (ordered by `BQ_ID`,
 *    which tracks `BATCH_SHEETS.BS_ID` 1:1 on this estate). Reconstructing
 *    that name is the only way to attribute a table to a schedule.
 *  - The table's own columns are generic `BRVCn`/`BRNn`/`BRDn` — meaningless
 *    without the `<col> AS E<expr_id>` aliases in the same `BQ_RESULT_SQL`,
 *    which map back to `EXPRESSIONS.EXP_ID` for a real name and data type.
 *
 * `schedule-import.service.ts` already writes a `scheduled_results` row for
 * a single-sheet report's one run (with `rowCount`/`filePath` left null —
 * see its header comment) and explicitly skips multi-sheet reports
 * (`RUN_HISTORY_NOT_ATTRIBUTABLE`, since `BR_RUNS` is per-report, not
 * per-sheet). The table-name reconstruction here disambiguates exactly that
 * case, so this pass both fills in the real row data *and* resolves the
 * multi-sheet attribution gap Phase 7.2 left open.
 */

import path from 'node:path';
import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schedules, scheduledResults } from '../db/schema.js';
import {
  connectToEul,
  resolveTargetMap,
  classifyRunOutcome,
  OBJ_FORMAT,
} from './schedule-import.service.js';
import { writeXlsx } from './exporters/excel-exporter.js';
import { writeCsv } from './exporters/csv-exporter.js';
import type { ExportSource } from './exporters/types.js';
import type { ResultColumn } from './map-execution.service.js';
import type { ScheduleOutputFormat } from './scheduler.service.js';
import { config } from '../config.js';

export interface DiscoveredBatchResultTable {
  tableName: string;
  /** `YYMMDDHH24MISS`, as it appears in the table name. */
  timestamp: string;
  queryIndex: number;
}

/**
 * Every `<prefix>B<timestamp>Q<n>R1` table on the schema — nine on the
 * estate this was built against, but discovered rather than hardcoded so a
 * different estate's count doesn't silently go unmigrated.
 */
export async function discoverBatchResultTables(
  conn: EulConn,
  schema: string,
  prefix: string,
): Promise<DiscoveredBatchResultTable[]> {
  const res = await conn.execute(
    `SELECT table_name FROM all_tables WHERE owner = :o AND REGEXP_LIKE(table_name, '^' || :pfx || 'B[0-9]{12}Q[0-9]+R1$')`,
    { o: schema, pfx: prefix },
    OBJ_FORMAT,
  );
  const pattern = new RegExp(`^${prefix}B(\\d{12})Q(\\d+)R1$`);
  const tables: DiscoveredBatchResultTable[] = [];
  for (const row of res.rows as { TABLE_NAME: string }[]) {
    const m = pattern.exec(row.TABLE_NAME);
    if (!m) continue;
    tables.push({ tableName: row.TABLE_NAME, timestamp: m[1]!, queryIndex: Number(m[2]) });
  }
  return tables;
}

export interface ResultAliasPair {
  /** The physical `BRVCn`/`BRNn`/`BRDn` column on the result table. */
  rawColumn: string;
  /** → `EXPRESSIONS.EXP_ID`. */
  exprId: number;
}

/**
 * `BQ_RESULT_SQL_1..4` (concatenated) reads
 * `SELECT <col> AS E<expr_id>, ... FROM <TABLE_NAME> Order By ...` (ground
 * truth §3.8). Pulls the ordered (physical column, expression id) pairs
 * straight out of that template — order of appearance is display order.
 */
export function parseResultAliasMap(resultSql: string): ResultAliasPair[] {
  const pairs: ResultAliasPair[] = [];
  const re = /\b(BRVC\d+|BRN\d+|BRD\d+)\s+(?:AS\s+)?E(\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(resultSql)) !== null) {
    pairs.push({ rawColumn: m[1]!.toUpperCase(), exprId: Number(m[2]) });
  }
  return pairs;
}

// The one piece of node-oracledb's surface these functions need — spelled out
// locally so this file doesn't have to import the package just for a type.
interface EulConn {
  execute(sql: string, binds: Record<string, unknown>, options: Record<string, unknown>): Promise<{ rows?: unknown[] }>;
}

interface ReportRow {
  brId: number;
  name: string;
  workbookName: string;
}
interface SheetRow {
  bsId: number;
  brId: number;
  sheetName: string;
}
interface QueryRow {
  bsId: number;
  resultSql: string;
}
interface RunRow {
  brId: number;
  runDate: Date;
  runStamp: string;
  errCode: number | null;
  errText: string | null;
  elapsedMs: number | null;
}

async function readSource(conn: EulConn, schema: string, prefix: string) {
  const reportsRes = await conn.execute(
    `SELECT BR_ID, BR_NAME, BR_WORKBOOK_NAME FROM ${schema}.${prefix}BATCH_REPORTS WHERE BR_ELEMENT_STATE = 0`,
    {},
    OBJ_FORMAT,
  );
  const reports: ReportRow[] = (
    reportsRes.rows as Array<{ BR_ID: number; BR_NAME: string; BR_WORKBOOK_NAME: string }>
  ).map((r) => ({ brId: r.BR_ID, name: r.BR_NAME, workbookName: r.BR_WORKBOOK_NAME }));

  const sheetsRes = await conn.execute(
    `SELECT BS_ID, BS_BR_ID, BS_SHEET_NAME FROM ${schema}.${prefix}BATCH_SHEETS WHERE BS_ELEMENT_STATE = 0`,
    {},
    OBJ_FORMAT,
  );
  const sheets: SheetRow[] = (
    sheetsRes.rows as Array<{ BS_ID: number; BS_BR_ID: number; BS_SHEET_NAME: string }>
  ).map((r) => ({ bsId: r.BS_ID, brId: r.BS_BR_ID, sheetName: r.BS_SHEET_NAME }));

  const queriesRes = await conn.execute(
    `SELECT BQ_BS_ID, BQ_RESULT_SQL_1, BQ_RESULT_SQL_2, BQ_RESULT_SQL_3, BQ_RESULT_SQL_4
       FROM ${schema}.${prefix}BATCH_QUERIES WHERE BQ_ELEMENT_STATE = 0`,
    {},
    OBJ_FORMAT,
  );
  const queries: QueryRow[] = (
    queriesRes.rows as Array<{
      BQ_BS_ID: number;
      BQ_RESULT_SQL_1: string | null;
      BQ_RESULT_SQL_2: string | null;
      BQ_RESULT_SQL_3: string | null;
      BQ_RESULT_SQL_4: string | null;
    }>
  ).map((r) => ({
    bsId: r.BQ_BS_ID,
    resultSql: [r.BQ_RESULT_SQL_1, r.BQ_RESULT_SQL_2, r.BQ_RESULT_SQL_3, r.BQ_RESULT_SQL_4]
      .filter((s): s is string => s != null)
      .join(''),
  }));

  const runsRes = await conn.execute(
    `SELECT BRR_BR_ID, BRR_RUN_DATE, TO_CHAR(BRR_RUN_DATE, 'YYMMDDHH24MISS') AS RUN_STAMP,
            BRR_SVR_ERR_CODE, BRR_SVR_ERR_TEXT, BRR_ACT_ELAP_TIME
       FROM ${schema}.${prefix}BR_RUNS`,
    {},
    OBJ_FORMAT,
  );
  const runs: RunRow[] = (
    runsRes.rows as Array<{
      BRR_BR_ID: number;
      BRR_RUN_DATE: Date;
      RUN_STAMP: string;
      BRR_SVR_ERR_CODE: number | null;
      BRR_SVR_ERR_TEXT: string | null;
      BRR_ACT_ELAP_TIME: number | null;
    }>
  ).map((r) => ({
    brId: r.BRR_BR_ID,
    runDate: r.BRR_RUN_DATE,
    runStamp: r.RUN_STAMP,
    errCode: r.BRR_SVR_ERR_CODE,
    errText: r.BRR_SVR_ERR_TEXT,
    elapsedMs: r.BRR_ACT_ELAP_TIME,
  }));

  return { reports, sheets, queries, runs };
}

async function readExpressionInfo(
  conn: EulConn,
  schema: string,
  prefix: string,
  exprIds: number[],
): Promise<Map<number, { name: string; dataType: string | null }>> {
  const info = new Map<number, { name: string; dataType: string | null }>();
  if (exprIds.length === 0) return info;
  const res = await conn.execute(
    `SELECT EXP_ID, EXP_NAME, EXP_DATA_TYPE FROM ${schema}.${prefix}EXPRESSIONS WHERE EXP_ID IN (${exprIds.join(',')})`,
    {},
    OBJ_FORMAT,
  );
  for (const r of res.rows as Array<{ EXP_ID: number; EXP_NAME: string; EXP_DATA_TYPE: string | null }>) {
    info.set(r.EXP_ID, { name: r.EXP_NAME, dataType: r.EXP_DATA_TYPE });
  }
  return info;
}

// ponytail: one non-streaming SELECT * per table, held in memory — fine for
// a frozen legacy table capped at a few thousand rows (861 is the largest on
// this estate). Switch to a resultSet cursor (see export.service.ts) if a
// future estate's batch tables are large enough for that to matter.
// eslint-disable-next-line @typescript-eslint/require-await -- the consumer reads this with `for await`, so it must be an async generator.
async function* singleBatch(rows: Record<string, unknown>[]): AsyncIterable<Record<string, unknown>[]> {
  if (rows.length > 0) yield rows;
}

// This backfill still writes files for the legacy batch-result tables it
// migrates (Task 4.2 moved the *live* scheduler off files and onto the
// map-run queue, but this one-time import has no map run to attach to).
const SCHEDULE_RESULT_DIR =
  config.SCHEDULE_RESULT_DIR ?? path.resolve(process.cwd(), 'storage', 'scheduled-results');

function buildScheduleResultFilePath(resultId: string, format: ScheduleOutputFormat): string {
  const ext = format === 'XLSX' ? 'xlsx' : 'csv';
  return path.join(SCHEDULE_RESULT_DIR, `${resultId}.${ext}`);
}

async function writeResultFile(
  source: ExportSource,
  format: ScheduleOutputFormat,
  filePath: string,
): Promise<{ rowCount: number }> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  return format === 'XLSX' ? writeXlsx(filePath, source) : writeCsv(filePath, source);
}

export interface BatchResultImportWarning {
  brId: number;
  brName: string;
  reason:
    | 'NO_RUN'
    | 'AMBIGUOUS_RUN'
    | 'UNRESOLVED_MAP'
    | 'AMBIGUOUS_MAP'
    | 'UNRESOLVED_SCHEDULE'
    | 'NO_RESULT_COLUMNS';
  detail: string;
}

export interface BatchResultImportResult {
  dryRun: boolean;
  tablesDiscovered: number;
  tablesMatched: number;
  rowsMigrated: number;
  resultsWritten: number;
  warnings: BatchResultImportWarning[];
  durationMs: number;
}

export async function importBatchResults(
  dataSourceId: string,
  opts: { dryRun?: boolean; schemaOwner?: string } = {},
): Promise<BatchResultImportResult> {
  const start = Date.now();
  const dryRun = opts.dryRun ?? true;
  const { conn, schema, prefix } = await connectToEul(dataSourceId, opts.schemaOwner);

  const warnings: BatchResultImportWarning[] = [];
  let tablesMatched = 0;
  let rowsMigrated = 0;
  let resultsWritten = 0;

  try {
    const [source, tables] = await Promise.all([
      readSource(conn, schema, prefix),
      discoverBatchResultTables(conn, schema, prefix),
    ]);
    const tableByName = new Map(tables.map((t) => [t.tableName, t] as const));

    const sheetsByReport = new Map<number, SheetRow[]>();
    for (const s of source.sheets) {
      const list = sheetsByReport.get(s.brId) ?? [];
      list.push(s);
      sheetsByReport.set(s.brId, list);
    }
    const queryByBsId = new Map(source.queries.map((q) => [q.bsId, q] as const));
    const runsByReport = new Map<number, RunRow[]>();
    for (const r of source.runs) {
      const list = runsByReport.get(r.brId) ?? [];
      list.push(r);
      runsByReport.set(r.brId, list);
    }

    for (const report of source.reports) {
      const sheets = [...(sheetsByReport.get(report.brId) ?? [])].sort((a, b) => a.bsId - b.bsId);
      const multiSheet = sheets.length > 1;
      const runs = runsByReport.get(report.brId) ?? [];

      if (runs.length === 0) {
        warnings.push({
          brId: report.brId,
          brName: report.name,
          reason: 'NO_RUN',
          detail: 'no BR_RUNS row for this report — nothing to migrate',
        });
        continue;
      }
      if (runs.length > 1) {
        warnings.push({
          brId: report.brId,
          brName: report.name,
          reason: 'AMBIGUOUS_RUN',
          detail: `${runs.length} runs recorded for this report; ground truth assumes exactly one — not migrated`,
        });
        continue;
      }
      const run = runs[0]!;

      for (const [i, sheet] of sheets.entries()) {
        const queryIndex = i + 1;
        const candidateName = `${prefix}B${run.runStamp}Q${queryIndex}R1`;
        const table = tableByName.get(candidateName);
        if (!table) continue; // this query never produced a persisted result table

        const resolved = await resolveTargetMap(report.workbookName, sheet.sheetName);
        if (!resolved) {
          warnings.push({
            brId: report.brId,
            brName: report.name,
            reason: 'UNRESOLVED_MAP',
            detail: `workbook "${report.workbookName}" / sheet "${sheet.sheetName}" not found on the target`,
          });
          continue;
        }
        if (resolved.ambiguous) {
          warnings.push({
            brId: report.brId,
            brName: report.name,
            reason: 'AMBIGUOUS_MAP',
            detail: `workbook "${report.workbookName}" sheet "${sheet.sheetName}" matches more than one map`,
          });
          continue;
        }

        const scheduleName = multiSheet ? `${report.name} — ${sheet.sheetName}` : report.name;
        const [scheduleRow] = await db
          .select()
          .from(schedules)
          .where(and(eq(schedules.mapId, resolved.mapId), eq(schedules.name, scheduleName)))
          .limit(1);
        if (!scheduleRow) {
          warnings.push({
            brId: report.brId,
            brName: report.name,
            reason: 'UNRESOLVED_SCHEDULE',
            detail: `no migrated schedule named "${scheduleName}" on map ${resolved.mapId} — run the Phase 7.2 backfill first`,
          });
          continue;
        }

        tablesMatched += 1;
        const countRes = await conn.execute(
          `SELECT COUNT(*) AS CNT FROM ${schema}.${table.tableName}`,
          {},
          OBJ_FORMAT,
        );
        const rowCount = Number((countRes.rows as Array<{ CNT: number }>)[0]!.CNT);
        const outcome = classifyRunOutcome(run.errCode, run.errText);

        // Looked up before writing a file so a rerun reuses the prior file
        // instead of writing a new one and orphaning the old one on disk.
        const [existing] = await db
          .select({ id: scheduledResults.id, filePath: scheduledResults.filePath })
          .from(scheduledResults)
          .where(and(eq(scheduledResults.scheduleId, scheduleRow.id), eq(scheduledResults.executedAt, run.runDate)))
          .limit(1);

        let filePath: string | null = existing?.filePath ?? null;
        if (rowCount > 0 && !filePath) {
          const query = queryByBsId.get(sheet.bsId);
          const aliasPairs = query ? parseResultAliasMap(query.resultSql) : [];
          if (aliasPairs.length === 0) {
            warnings.push({
              brId: report.brId,
              brName: report.name,
              reason: 'NO_RESULT_COLUMNS',
              detail: `table ${table.tableName} has ${rowCount} row(s) but its BQ_RESULT_SQL has no recognizable result columns — skipped rather than recording a row count with no data`,
            });
            continue;
          }
          const exprInfo = await readExpressionInfo(
            conn,
            schema,
            prefix,
            aliasPairs.map((p) => p.exprId),
          );
          const columns: ResultColumn[] = aliasPairs.map((p) => {
            const info = exprInfo.get(p.exprId);
            return {
              name: p.rawColumn,
              label: info?.name ?? `E${p.exprId}`,
              dataType: info?.dataType ?? undefined,
              isAggregate: false,
            };
          });

          if (!dryRun) {
            const rowsRes = await conn.execute(`SELECT * FROM ${schema}.${table.tableName}`, {}, OBJ_FORMAT);
            const rows = rowsRes.rows as Record<string, unknown>[];
            const resultId = randomUUID();
            filePath = buildScheduleResultFilePath(resultId, scheduleRow.outputFormat as ScheduleOutputFormat);
            await writeResultFile(
              { columns, batches: singleBatch(rows) },
              scheduleRow.outputFormat as ScheduleOutputFormat,
              filePath,
            );
          }
        }
        rowsMigrated += rowCount;

        if (!dryRun) {
          if (existing) {
            await db
              .update(scheduledResults)
              .set({ rowCount, filePath })
              .where(eq(scheduledResults.id, existing.id));
          } else {
            await db.insert(scheduledResults).values({
              scheduleId: scheduleRow.id,
              executedAt: run.runDate,
              rowCount,
              filePath,
              executionTimeMs: run.elapsedMs,
              status: outcome.status,
              errorMessage: outcome.errorMessage,
            });
          }
          resultsWritten += 1;
        }
      }
    }

    return {
      dryRun,
      tablesDiscovered: tables.length,
      tablesMatched,
      rowsMigrated,
      resultsWritten,
      warnings,
      durationMs: Date.now() - start,
    };
  } finally {
    await conn.close();
  }
}
