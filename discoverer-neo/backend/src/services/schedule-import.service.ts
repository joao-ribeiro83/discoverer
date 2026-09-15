/**
 * One-time backfill: migrate the EUL's scheduled batch reports into
 * `schedules` / `schedule_parameters` / `scheduled_results`.
 *
 * `EUL4_BATCH_REPORTS` + `_SHEETS` + `_PARAMS` + `EUL4_BR_RUNS` — see
 * `migrate/EUL_SCHEMA_GROUND_TRUTH.md` §3.8 for every column and how each
 * value here was derived from the live estate, not guessed.
 *
 * Unlike `map-reimport.ts`, this does not go through `MigrationWriter` —
 * `schedules` and its children are declared in `backend/src/db/schema.ts`
 * precisely because they are runtime-only tables the core migrator never
 * writes (see that file's header comment). This service reads the EUL
 * directly, the same way the diagnostic scripts in `src/scripts/` do, and
 * writes through Drizzle against tables the migrator has never touched.
 *
 * Every schedule this writes is `isActive: false`. That is not a default —
 * nothing in this file ever sets it to `true`. Silently starting batch jobs
 * against a customer's Oracle on first boot would be a genuine incident.
 */

import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  dataSources,
  users,
  workbooks,
  maps,
  schedules,
  scheduleParameters,
  scheduledResults,
} from '../db/schema.js';
import { decrypt } from '../lib/encryption.js';
import { importOracleDb } from './oracle-driver.js';
import { usernameToEmailLocal, MIGRATED_EMAIL_DOMAIN } from './migration.service.js';
import { loadMapDefinition } from './sql-generator.js';
import { planQuery } from '../lib/sql/planner.js';

const OBJ_FORMAT = { outFormat: 4002 };

export type FrequencyUnit = 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

/** Read from `RFU_SQL_EXPRESSION` — see ground truth §3.8's table. Not a guess: every unit's expression shape is distinct and was checked against all 6 live rows. */
export function classifyFrequencyUnit(sqlExpression: string): FrequencyUnit {
  const expr = sqlExpression.toLowerCase();
  if (expr.includes('1440')) return 'MINUTES';
  if (expr.includes('1/24')) return 'HOURS';
  if (expr.includes('add_months') && expr.includes('12')) return 'YEARS';
  if (expr.includes('add_months')) return 'MONTHS';
  if (expr.includes('* 7') || expr.includes('*7')) return 'WEEKS';
  return 'DAYS';
}

interface CronPlan {
  cronExpression: string;
  validFrom: Date | null;
  validUntil: Date | null;
}

/**
 * `BR_AUTO_REFRESH = 0` (every live row) means the batch job never
 * resubmits itself — it is a one-shot, not a cron. That is expressed here as
 * a cron matching the exact anchor minute, bounded by a `validFrom`/
 * `validUntil` window one minute wide so it can only ever fire once, rather
 * than adding a schema concept BullMQ's Job Scheduler API (pattern-only)
 * does not have.
 *
 * A recurring job (`BR_AUTO_REFRESH = 1`, not present in this estate but
 * structurally possible) gets a real repeating cron. `DAYS`/`MONTHS` with
 * `numUnits > 1` step the day-of-month/month field, which is an
 * approximation of "every N days from the anchor" — cron has no interval
 * primitive for that. `WEEKS` with `numUnits > 1` collapses to weekly; cron
 * cannot express multi-week steps at all. Both are documented here rather
 * than silently wrong, and neither path is exercised by any live schedule.
 */
export function buildCronPlan(
  anchor: Date,
  autoRefresh: boolean,
  numUnits: number,
  unit: FrequencyUnit,
): CronPlan {
  const min = anchor.getUTCMinutes();
  const hour = anchor.getUTCHours();
  const dom = anchor.getUTCDate();
  const month = anchor.getUTCMonth() + 1;
  const dow = anchor.getUTCDay();

  if (!autoRefresh) {
    return {
      cronExpression: `${min} ${hour} ${dom} ${month} *`,
      validFrom: anchor,
      validUntil: new Date(anchor.getTime() + 60_000),
    };
  }

  const n = Math.max(1, numUnits);
  switch (unit) {
    case 'MINUTES':
      return { cronExpression: `*/${Math.min(n, 59)} * * * *`, validFrom: null, validUntil: null };
    case 'HOURS':
      return { cronExpression: `${min} */${Math.min(n, 23)} * * *`, validFrom: null, validUntil: null };
    case 'WEEKS':
      return { cronExpression: `${min} ${hour} * * ${dow}`, validFrom: null, validUntil: null };
    case 'MONTHS':
      return { cronExpression: `${min} ${hour} ${dom} */${Math.min(n, 11)} *`, validFrom: null, validUntil: null };
    case 'YEARS':
      return { cronExpression: `${min} ${hour} ${dom} ${month} *`, validFrom: null, validUntil: null };
    case 'DAYS':
    default:
      return { cronExpression: `${min} ${hour} */${Math.min(n, 27)} * *`, validFrom: null, validUntil: null };
  }
}

interface EulBatchReportRow {
  brId: number;
  name: string;
  workbookName: string;
  nextRunDate: Date | null;
  numFreqUnits: number;
  euId: number;
  rfuId: number;
  autoRefresh: boolean;
}

interface EulBatchSheetRow {
  bsId: number;
  brId: number;
  sheetName: string;
}

interface EulBatchParamRow {
  bsId: number;
  name: string;
  values: string[];
}

interface EulBrRunRow {
  brId: number;
  runNumber: number;
  runDate: Date;
  errCode: number | null;
  errText: string | null;
  elapsedMs: number | null;
}

interface EulSource {
  reports: EulBatchReportRow[];
  sheets: EulBatchSheetRow[];
  params: EulBatchParamRow[];
  runs: EulBrRunRow[];
  freqUnitById: Map<number, FrequencyUnit>;
  ownerUsernameByEuId: Map<number, string>;
}

async function readEulSource(dataSourceId: string, schemaOwner?: string): Promise<EulSource> {
  const [ds] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId)).limit(1);
  if (!ds) throw new Error(`data source ${dataSourceId} not found`);

  const oracledb = await importOracleDb();
  if (process.env.ORACLE_THICK_MODE === 'true') {
    try {
      oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH || '/opt/oracle/instantclient' });
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

  try {
    const who = await conn.execute(`SELECT USER AS U FROM DUAL`, {}, OBJ_FORMAT);
    const schema = (schemaOwner || '').toUpperCase() || (who.rows as { U: string }[])[0]!.U;

    const pfx = await conn.execute(
      `SELECT table_name FROM all_tables WHERE owner = :o AND table_name LIKE 'EUL%BAS'`,
      { o: schema },
      OBJ_FORMAT,
    );
    const prefix =
      ((pfx.rows as { TABLE_NAME: string }[])[0]?.TABLE_NAME ?? 'EUL4_BAS').replace(/BAS$/, '');

    const reportsRes = await conn.execute(
      `SELECT BR_ID, BR_NAME, BR_WORKBOOK_NAME, BR_NEXT_RUN_DATE, BR_NUM_FREQ_UNITS,
              BR_EU_ID, BR_RFU_ID, BR_AUTO_REFRESH
         FROM ${schema}.${prefix}BATCH_REPORTS WHERE BR_ELEMENT_STATE = 0`,
      {},
      OBJ_FORMAT,
    );
    const reports: EulBatchReportRow[] = (
      reportsRes.rows as Array<{
        BR_ID: number;
        BR_NAME: string;
        BR_WORKBOOK_NAME: string;
        BR_NEXT_RUN_DATE: Date | null;
        BR_NUM_FREQ_UNITS: number;
        BR_EU_ID: number;
        BR_RFU_ID: number;
        BR_AUTO_REFRESH: number;
      }>
    ).map((r) => ({
      brId: r.BR_ID,
      name: r.BR_NAME,
      workbookName: r.BR_WORKBOOK_NAME,
      nextRunDate: r.BR_NEXT_RUN_DATE,
      numFreqUnits: r.BR_NUM_FREQ_UNITS,
      euId: r.BR_EU_ID,
      rfuId: r.BR_RFU_ID,
      autoRefresh: r.BR_AUTO_REFRESH === 1,
    }));

    const sheetsRes = await conn.execute(
      `SELECT BS_ID, BS_BR_ID, BS_SHEET_NAME FROM ${schema}.${prefix}BATCH_SHEETS WHERE BS_ELEMENT_STATE = 0`,
      {},
      OBJ_FORMAT,
    );
    const sheets: EulBatchSheetRow[] = (
      sheetsRes.rows as Array<{ BS_ID: number; BS_BR_ID: number; BS_SHEET_NAME: string }>
    ).map((r) => ({ bsId: r.BS_ID, brId: r.BS_BR_ID, sheetName: r.BS_SHEET_NAME }));

    const paramsRes = await conn.execute(
      `SELECT BP_BS_ID, BP_NAME, BP_VALUE1, BP_VALUE2, BP_VALUE3, BP_VALUE4, BP_VALUE5, BP_VALUE6
         FROM ${schema}.${prefix}BATCH_PARAMS WHERE BP_ELEMENT_STATE = 0`,
      {},
      OBJ_FORMAT,
    );
    const params: EulBatchParamRow[] = (
      paramsRes.rows as Array<{
        BP_BS_ID: number;
        BP_NAME: string;
        BP_VALUE1: string | null;
        BP_VALUE2: string | null;
        BP_VALUE3: string | null;
        BP_VALUE4: string | null;
        BP_VALUE5: string | null;
        BP_VALUE6: string | null;
      }>
    ).map((r) => ({
      bsId: r.BP_BS_ID,
      name: r.BP_NAME,
      values: [r.BP_VALUE1, r.BP_VALUE2, r.BP_VALUE3, r.BP_VALUE4, r.BP_VALUE5, r.BP_VALUE6].filter(
        (v): v is string => v != null,
      ),
    }));

    const runsRes = await conn.execute(
      `SELECT BRR_BR_ID, BRR_RUN_NUMBER, BRR_RUN_DATE, BRR_SVR_ERR_CODE, BRR_SVR_ERR_TEXT, BRR_ACT_ELAP_TIME
         FROM ${schema}.${prefix}BR_RUNS`,
      {},
      OBJ_FORMAT,
    );
    const runs: EulBrRunRow[] = (
      runsRes.rows as Array<{
        BRR_BR_ID: number;
        BRR_RUN_NUMBER: number;
        BRR_RUN_DATE: Date;
        BRR_SVR_ERR_CODE: number | null;
        BRR_SVR_ERR_TEXT: string | null;
        BRR_ACT_ELAP_TIME: number | null;
      }>
    ).map((r) => ({
      brId: r.BRR_BR_ID,
      runNumber: r.BRR_RUN_NUMBER,
      runDate: r.BRR_RUN_DATE,
      errCode: r.BRR_SVR_ERR_CODE,
      errText: r.BRR_SVR_ERR_TEXT,
      elapsedMs: r.BRR_ACT_ELAP_TIME,
    }));

    const freqRes = await conn.execute(
      `SELECT RFU_ID, RFU_SQL_EXPRESSION FROM ${schema}.${prefix}FREQ_UNITS`,
      {},
      OBJ_FORMAT,
    );
    const freqUnitById = new Map<number, FrequencyUnit>(
      (freqRes.rows as Array<{ RFU_ID: number; RFU_SQL_EXPRESSION: string }>).map((r) => [
        r.RFU_ID,
        classifyFrequencyUnit(r.RFU_SQL_EXPRESSION),
      ]),
    );

    const euIds = [...new Set(reports.map((r) => r.euId))];
    const ownerUsernameByEuId = new Map<number, string>();
    if (euIds.length > 0) {
      const usersRes = await conn.execute(
        `SELECT EU_ID, EU_USERNAME FROM ${schema}.${prefix}EUL_USERS WHERE EU_ID IN (${euIds.join(',')})`,
        {},
        OBJ_FORMAT,
      );
      for (const r of usersRes.rows as Array<{ EU_ID: number; EU_USERNAME: string }>) {
        ownerUsernameByEuId.set(r.EU_ID, r.EU_USERNAME);
      }
    }

    return { reports, sheets, params, runs, freqUnitById, ownerUsernameByEuId };
  } finally {
    await conn.close();
  }
}

export interface ResolvedMap {
  mapId: string;
  ambiguous: boolean;
}

export async function resolveTargetMap(workbookName: string, sheetName: string): Promise<ResolvedMap | null> {
  const [wb] = await db.select({ id: workbooks.id }).from(workbooks).where(eq(workbooks.name, workbookName)).limit(1);
  if (!wb) return null;

  const wbMaps = await db.select({ id: maps.id, name: maps.name }).from(maps).where(eq(maps.workbookId, wb.id));
  if (wbMaps.length === 0) return null;
  if (wbMaps.length === 1) return { mapId: wbMaps[0]!.id, ambiguous: false };

  const suffix = `— ${sheetName}`;
  const candidates = wbMaps.filter((m) => m.name.endsWith(suffix));
  if (candidates.length === 1) return { mapId: candidates[0]!.id, ambiguous: false };
  return { mapId: '', ambiguous: true };
}

export async function resolveOwnerUserId(euUsername: string): Promise<string | null> {
  const email = `${usernameToEmailLocal(euUsername)}@${MIGRATED_EMAIL_DOMAIN}`;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return user?.id ?? null;
}

/**
 * `BRR_SVR_ERR_CODE` present ⇒ `FAILED` (a real Oracle error, e.g. `-1854`
 * "invalid julian date"), absent ⇒ `SUCCESS`. `BRR_STATE`'s own values (2, 4,
 * 7, 9 on the live estate) are not migrated — only `STATE = 4` rows carry an
 * error code, so the error code is the confirmed signal and the state
 * numbers are not (ground truth §3.8).
 */
export function classifyRunOutcome(errCode: number | null, errText: string | null): {
  status: 'SUCCESS' | 'FAILED';
  errorMessage: string | null;
} {
  if (errCode == null) return { status: 'SUCCESS', errorMessage: null };
  return { status: 'FAILED', errorMessage: `ORA-${Math.abs(errCode)}: ${errText ?? ''}`.trim() };
}

export interface ScheduleImportWarning {
  brId: number;
  brName: string;
  reason: 'UNRESOLVED_OWNER' | 'UNRESOLVED_MAP' | 'AMBIGUOUS_MAP' | 'RUN_HISTORY_NOT_ATTRIBUTABLE';
  detail: string;
}

export interface ScheduleImportResult {
  dryRun: boolean;
  reportsSeen: number;
  sheetsSeen: number;
  scheduled: number;
  parametersWritten: number;
  historicalRunsWritten: number;
  plannerRefusals: number;
  warnings: ScheduleImportWarning[];
  durationMs: number;
}

export async function importSchedules(
  dataSourceId: string,
  opts: { dryRun?: boolean; schemaOwner?: string } = {},
): Promise<ScheduleImportResult> {
  const start = Date.now();
  const dryRun = opts.dryRun ?? true;
  const source = await readEulSource(dataSourceId, opts.schemaOwner);

  const warnings: ScheduleImportWarning[] = [];
  const sheetsByReport = new Map<number, EulBatchSheetRow[]>();
  for (const s of source.sheets) {
    const list = sheetsByReport.get(s.brId) ?? [];
    list.push(s);
    sheetsByReport.set(s.brId, list);
  }
  const paramsBySheet = new Map<number, EulBatchParamRow[]>();
  for (const p of source.params) {
    const list = paramsBySheet.get(p.bsId) ?? [];
    list.push(p);
    paramsBySheet.set(p.bsId, list);
  }
  const runsByReport = new Map<number, EulBrRunRow[]>();
  for (const r of source.runs) {
    const list = runsByReport.get(r.brId) ?? [];
    list.push(r);
    runsByReport.set(r.brId, list);
  }

  let scheduled = 0;
  let parametersWritten = 0;
  let historicalRunsWritten = 0;
  let plannerRefusals = 0;
  const insertedScheduleIds: string[] = [];

  for (const report of source.reports) {
    const sheets = sheetsByReport.get(report.brId) ?? [];
    const multiSheet = sheets.length > 1;

    // BR_RUNS is keyed by BR_ID, one row per report, not per sheet — a
    // multi-sheet report's single run cannot be attributed to any one of the
    // N schedules it becomes without inventing which sheet it was for. Rather
    // than guess, drop it and say so (explicitly declared lost, not silently).
    if (multiSheet && (runsByReport.get(report.brId)?.length ?? 0) > 0) {
      warnings.push({
        brId: report.brId,
        brName: report.name,
        reason: 'RUN_HISTORY_NOT_ATTRIBUTABLE',
        detail: `${runsByReport.get(report.brId)!.length} historical run(s) span ${sheets.length} sheets and cannot be attributed to one schedule; not migrated`,
      });
    }

    const ownerUsername = source.ownerUsernameByEuId.get(report.euId);
    const ownerUserId = ownerUsername ? await resolveOwnerUserId(ownerUsername) : null;
    if (!ownerUserId) {
      warnings.push({
        brId: report.brId,
        brName: report.name,
        reason: 'UNRESOLVED_OWNER',
        detail: `EU_ID ${report.euId} (${ownerUsername ?? 'unknown'}) has no matching migrated user`,
      });
      continue;
    }

    for (const sheet of sheets) {
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

      const unit = source.freqUnitById.get(report.rfuId) ?? 'DAYS';
      const anchor = report.nextRunDate ?? new Date();
      const cronPlan = buildCronPlan(anchor, report.autoRefresh, report.numFreqUnits, unit);

      const name = multiSheet ? `${report.name} — ${sheet.sheetName}` : report.name;
      const scheduleId = randomUUID();
      const outputFormat = 'XLSX' as const;

      if (!dryRun) {
        await db.insert(schedules).values({
          id: scheduleId,
          mapId: resolved.mapId,
          name,
          cronExpression: cronPlan.cronExpression,
          timezone: 'UTC',
          validFrom: cronPlan.validFrom,
          validUntil: cronPlan.validUntil,
          outputFormat,
          isActive: false,
          createdBy: ownerUserId,
        });

        const sheetParams = paramsBySheet.get(sheet.bsId) ?? [];
        if (sheetParams.length > 0) {
          await db.insert(scheduleParameters).values(
            sheetParams.map((p) => ({
              scheduleId,
              paramName: p.name,
              paramValue: p.values.length > 0 ? p.values.join(',') : null,
            })),
          );
          parametersWritten += sheetParams.length;
        }

        const runs = multiSheet ? [] : (runsByReport.get(report.brId) ?? []);
        if (runs.length > 0) {
          await db.insert(scheduledResults).values(
            runs.map((r) => {
              const outcome = classifyRunOutcome(r.errCode, r.errText);
              return {
                scheduleId,
                executedAt: r.runDate,
                rowCount: null,
                filePath: null,
                executionTimeMs: r.elapsedMs,
                status: outcome.status,
                errorMessage: outcome.errorMessage,
              };
            }),
          );
          historicalRunsWritten += runs.length;
        }

        insertedScheduleIds.push(scheduleId);
      }
      scheduled += 1;
    }
  }

  // Pre-flight: run the fan-trap planner in validate-only mode against every
  // schedule just written, and record what it decided. No migrated schedule
  // is ever activated here regardless of the outcome (isActive is always
  // false above) — this is purely so an operator sees which ones will
  // refuse before trying to enable them (D-117 / the Phase 7.2 correction).
  if (!dryRun) {
    const rows = await db
      .select({ id: schedules.id, mapId: schedules.mapId })
      .from(schedules)
      .where(inArray(schedules.id, insertedScheduleIds));
    for (const row of rows) {
      try {
        const def = await loadMapDefinition(row.mapId);
        const plan = planQuery(def);
        const isRefusal = plan.kind === 'REFUSE';
        if (isRefusal) plannerRefusals += 1;
        await db
          .update(schedules)
          .set({
            plannerDecision: plan.decision,
            plannerRefusalDetail: isRefusal ? plan.message : null,
          })
          .where(eq(schedules.id, row.id));
      } catch (err) {
        await db
          .update(schedules)
          .set({
            plannerDecision: 'UNPLANNABLE',
            plannerRefusalDetail: err instanceof Error ? err.message : String(err),
          })
          .where(eq(schedules.id, row.id));
      }
    }
  }

  return {
    dryRun,
    reportsSeen: source.reports.length,
    sheetsSeen: source.sheets.length,
    scheduled,
    parametersWritten,
    historicalRunsWritten,
    plannerRefusals,
    warnings,
    durationMs: Date.now() - start,
  };
}
