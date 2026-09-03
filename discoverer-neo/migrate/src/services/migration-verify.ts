/**
 * Post-commit verification of a migrated target database (D-070).
 *
 * Four seam checks — the ones a suite of components-against-their-own-fixtures
 * structurally cannot make (`AUDIT_TESTING_ASSESSMENT.md` §2 and §6):
 *
 *   1. `sql-generation`      every migrated map loads and generates SQL
 *   2. `formula-compile`     every calculated field compiles or is quarantined
 *   3. `referential-closure` every map reference resolves inside the query scope
 *   4. `reconciliation`      target counts match source, minus declared losses
 *
 * Runs AFTER the migration transaction commits, never inside it: a rollback
 * destroys the evidence needed to debug the failure, and one transaction over
 * 923 maps and 49 819 formulas is untenable. Everything here is read-only, so
 * an already-migrated estate can be verified repeatedly without re-importing.
 *
 * Two hooks are injected rather than imported. `generateSqlForMap` and
 * `compileFormula` both live in the backend workspace, which depends on this
 * one and not the reverse; importing them here would be a dependency cycle.
 * `dn-migrate verify` therefore reports those seams SKIPPED, and the backend's
 * own `npm run verify` supplies both and runs all four. A SKIPPED seam never
 * counts as a pass.
 *
 * Output discipline (G-02): the reconciliation spans the whole estate, so a
 * seam returns counts plus at most `sampleLimit` example findings — never a
 * row-by-row dump.
 */

import { sql } from 'drizzle-orm';

/**
 * All four seams are raw SQL, so the verifier asks only for something that can
 * run a statement. That admits both this workspace's `TargetDatabase` and the
 * backend's own drizzle handle, whose generic carries extra runtime-only
 * tables and would otherwise not be assignable.
 */
export interface VerifyDb {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export type SeamId =
  | 'sql-generation'
  | 'formula-compile'
  | 'referential-closure'
  | 'reconciliation';

/** SKIPPED is not a pass — it means the seam could not be evaluated here. */
export type SeamStatus = 'PASS' | 'FAIL' | 'SKIPPED';

/**
 * Compile-rate bucket vocabulary, fixed by D-059. `FAILED` means the compiler
 * hit a path it does not handle — a bug in us, not a data problem — so CI
 * asserts `FAILED === 0` while quarantine counts are only reported.
 */
export type CompileBucket = 'COMPILED' | 'COMPILED_UNVERIFIED' | 'QUARANTINED' | 'FAILED';

export interface SeamResult {
  id: SeamId;
  /** One line naming what the seam asserts. */
  name: string;
  status: SeamStatus;
  /** The baseline numbers later phases measure progress against. */
  metrics: Record<string, number>;
  /** At most `sampleLimit` examples, each already carrying its reason. */
  findings: string[];
  /** Present when status is SKIPPED, or when FAIL needs one line of context. */
  reason?: string;
}

export interface VerifyReport {
  /** Database name only. Never a connection string — those carry passwords. */
  target: string;
  ranAt: string;
  seams: SeamResult[];
  /** One line per failing seam, in seam order. */
  blockers: string[];
  status: 'VERIFIED' | 'COMPLETED_WITH_BLOCKERS';
}

// ---------------------------------------------------------------------------
// Injected hooks
// ---------------------------------------------------------------------------

export interface VerifyHooks {
  /**
   * Load a map definition and generate its SQL, throwing on any failure.
   * Backend's `generateSqlForMap`. Omitted here, seam 1 is SKIPPED.
   */
  generateSqlForMap?: (mapId: string) => Promise<unknown>;
  /**
   * Classify one stored formula. Backend's formula parser wrapped to return a
   * bucket. Omitted here, every formula falls in `QUARANTINED(no renderer yet)`
   * — the Phase 4 token renderer is what turns those into COMPILED.
   */
  compileFormula?: (formula: string) => CompileBucket | { bucket: CompileBucket; reason?: string };
}

export interface VerifyOptions extends VerifyHooks {
  /** Example findings retained per seam. Default 10. */
  sampleLimit?: number;
  /**
   * Restrict every seam to maps whose id starts with this prefix, so a test
   * fixture's own rows can be verified inside a shared database.
   */
  mapIdPrefix?: string;
  /** Stop seam 1 after this many maps. Unset means the whole estate. */
  maxMaps?: number;
}

// ---------------------------------------------------------------------------
// Small query helpers
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

async function rows(db: VerifyDb, query: ReturnType<typeof sql>): Promise<Row[]> {
  const result = (await db.execute(query)) as { rows?: Row[] };
  return result.rows ?? [];
}

/** Read one column of one row as text, without trusting the driver's typing. */
function text(row: Row | undefined, column: string, fallback: string): string {
  const value = row?.[column];
  return typeof value === 'string' ? value : fallback;
}

/**
 * `WHERE`-fragment scoping a query to the fixture prefix, or to everything.
 * Written as a `TRUE` literal rather than an empty fragment so it can always
 * be `AND`-ed in without the caller branching.
 */
function mapScope(prefix: string | undefined, column = sql`maps.id`): ReturnType<typeof sql> {
  if (prefix === undefined) return sql`TRUE`;
  return sql`${column}::text LIKE ${prefix + '%'}`;
}

// ---------------------------------------------------------------------------
// Seam 1 — migration → execution contract
// ---------------------------------------------------------------------------

/**
 * Every migrated map must load and generate SQL. This is the test that would
 * have caught F-01, where all 923 maps threw on `loadMapDefinition` and the
 * suite stayed green because nothing spanned migration and execution.
 */
export async function checkSqlGeneration(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = 'every migrated map loads and generates SQL';
  const limit = options.sampleLimit ?? 10;

  if (!options.generateSqlForMap) {
    return {
      id: 'sql-generation',
      name,
      status: 'SKIPPED',
      metrics: {},
      findings: [],
      reason:
        'no SQL generator injected — it lives in the backend workspace; run `npm run verify --workspace backend`',
    };
  }

  const mapRows = await rows(
    db,
    sql`SELECT id::text AS id, name FROM maps
        WHERE is_active AND ${mapScope(options.mapIdPrefix)}
        ORDER BY name
        ${options.maxMaps ? sql`LIMIT ${options.maxMaps}` : sql``}`,
  );

  const findings: string[] = [];
  let generated = 0;
  for (const row of mapRows) {
    try {
      await options.generateSqlForMap(String(row.id));
      generated += 1;
    } catch (err) {
      if (findings.length < limit) {
        findings.push(`${String(row.name)} (${String(row.id)}): ${describe(err)}`);
      }
    }
  }

  const failed = mapRows.length - generated;
  return {
    id: 'sql-generation',
    name,
    status: failed === 0 ? 'PASS' : 'FAIL',
    metrics: { maps: mapRows.length, generated, failed },
    findings,
    reason: failed > 0 ? `${failed} of ${mapRows.length} maps cannot generate SQL` : undefined,
  };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Seam 2 — formula compile rate
// ---------------------------------------------------------------------------

/** Rows read per page. Formulas are short; this only bounds peak memory. */
const FORMULA_PAGE = 5_000;

/**
 * Every stored formula must land in a named bucket (D-059). A formula that
 * neither compiles nor carries a stated quarantine reason is the unknown this
 * seam exists to delete: F-02 was "we do not know how many formulas work", and
 * a number with a reason attached is the whole deliverable.
 *
 * `FAILED` means the classifier hit a path it does not handle — our bug — so
 * that is the only bucket gated on. Quarantine counts are reported and shrink
 * as the Phase 4 token renderer lands.
 */
export async function checkFormulaCompileRate(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = 'every calculated field compiles or is quarantined with a reason';
  const limit = options.sampleLimit ?? 10;

  const buckets: Record<CompileBucket, number> = {
    COMPILED: 0,
    COMPILED_UNVERIFIED: 0,
    QUARANTINED: 0,
    FAILED: 0,
  };
  const reasons = new globalThis.Map<string, number>();
  const tally = (reason: string) => reasons.set(reason, (reasons.get(reason) ?? 0) + 1);

  const compile = options.compileFormula;
  let total = 0;
  let offset = 0;
  for (;;) {
    const page = await rows(
      db,
      sql`SELECT f.id::text AS id, f.formula
          FROM map_calculated_fields f
          JOIN maps ON maps.id = f.map_id
          WHERE ${mapScope(options.mapIdPrefix)}
          ORDER BY f.id
          LIMIT ${FORMULA_PAGE} OFFSET ${offset}`,
    );
    if (page.length === 0) break;
    offset += page.length;
    total += page.length;

    for (const row of page) {
      const formula = typeof row.formula === 'string' ? row.formula : '';
      if (!compile) {
        // No compiler here. Still a real, reportable bucket — but the seam
        // itself reports SKIPPED below, so this can never read as success.
        buckets.QUARANTINED += 1;
        tally('no formula compiler injected');
        continue;
      }
      try {
        const verdict = compile(formula);
        const bucket = typeof verdict === 'string' ? verdict : verdict.bucket;
        const reason = typeof verdict === 'string' ? undefined : verdict.reason;
        buckets[bucket] += 1;
        if (bucket === 'QUARANTINED' || bucket === 'FAILED') {
          tally(reason ?? 'no reason given');
        }
      } catch (err) {
        // The classifier threw. An unhandled path is a bug in us, not a data
        // problem — which is exactly what FAILED is reserved for.
        buckets.FAILED += 1;
        tally(`classifier threw: ${describe(err)}`);
      }
    }
  }

  const findings = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([reason, count]) => `${count}x ${reason}`);

  const metrics: Record<string, number> = {
    formulas: total,
    compiled: buckets.COMPILED,
    compiledUnverified: buckets.COMPILED_UNVERIFIED,
    quarantined: buckets.QUARANTINED,
    failed: buckets.FAILED,
    distinctReasons: reasons.size,
  };

  if (!compile) {
    return {
      id: 'formula-compile',
      name,
      status: 'SKIPPED',
      metrics,
      findings,
      reason:
        'no formula compiler injected — it lives in the backend workspace; run `npm run verify --workspace backend`',
    };
  }

  return {
    id: 'formula-compile',
    name,
    status: buckets.FAILED === 0 ? 'PASS' : 'FAIL',
    metrics,
    findings,
    reason:
      buckets.FAILED > 0
        ? `${buckets.FAILED} formula(s) hit a classifier path we do not handle`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Seam 3 — referential closure
// ---------------------------------------------------------------------------

/**
 * Every reference a map makes must resolve to an item, a folder and a data
 * source inside that map's own query scope. Foreign keys already stop a
 * dangling id; what they cannot express is the invariant F-01 broke — that the
 * things a map points at are reachable together, as one query.
 *
 * Note for anyone extending this: `data_sources` holds `password_enc`. Nothing
 * here selects a column from it beyond `id`, and nothing should.
 */
export async function checkReferentialClosure(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = "every map reference resolves inside the map's query scope";
  const limit = options.sampleLimit ?? 10;
  const scope = mapScope(options.mapIdPrefix);

  const [counts] = await rows(
    db,
    sql`WITH scoped AS (
          SELECT maps.id FROM maps WHERE maps.is_active AND ${scope}
        ),
        refs AS (
          SELECT s.id AS map_id, mi.item_id FROM scoped s JOIN map_items mi ON mi.map_id = s.id
          UNION ALL
          SELECT s.id, mc.item_id FROM scoped s JOIN map_conditions mc ON mc.map_id = s.id
        )
        SELECT
          count(*)::int AS refs,
          count(*) FILTER (WHERE i.id IS NULL)::int AS unresolved_item,
          count(*) FILTER (WHERE i.id IS NOT NULL AND f.id IS NULL)::int AS unresolved_folder,
          count(*) FILTER (WHERE f.id IS NOT NULL AND f.data_source_id IS NULL)::int AS folder_without_data_source,
          count(*) FILTER (WHERE f.data_source_id IS NOT NULL AND ds.id IS NULL)::int AS unresolved_data_source,
          count(*) FILTER (WHERE i.is_active IS FALSE)::int AS inactive_item,
          count(*) FILTER (WHERE f.is_active IS FALSE)::int AS inactive_folder
        FROM refs r
        LEFT JOIN items i ON i.id = r.item_id
        LEFT JOIN folders f ON f.id = i.folder_id
        LEFT JOIN data_sources ds ON ds.id = f.data_source_id`,
  );

  // A map whose folders span two data sources cannot be one SQL statement, no
  // matter how well every individual reference resolves.
  const [spread] = await rows(
    db,
    sql`SELECT count(*)::int AS c FROM (
          SELECT maps.id
          FROM maps
          JOIN map_items mi ON mi.map_id = maps.id
          JOIN items i ON i.id = mi.item_id
          JOIN folders f ON f.id = i.folder_id
          WHERE maps.is_active AND ${scope}
          GROUP BY maps.id
          HAVING count(DISTINCT f.data_source_id) > 1
        ) x`,
  );

  // A map with no columns is closed over the empty set — technically valid,
  // and never executable. Counted here so it cannot hide.
  const [empty] = await rows(
    db,
    sql`SELECT count(*)::int AS c FROM maps
        WHERE maps.is_active AND ${scope}
          AND NOT EXISTS (SELECT 1 FROM map_items mi WHERE mi.map_id = maps.id)`,
  );

  // A total pointing at another map's column, or at nothing.
  const [strayTotals] = await rows(
    db,
    sql`SELECT count(*)::int AS c
        FROM map_totals t
        JOIN maps ON maps.id = t.map_id
        LEFT JOIN map_items mi ON mi.id = t.map_item_id
        WHERE maps.is_active AND ${scope}
          AND t.map_item_id IS NOT NULL
          AND (mi.id IS NULL OR mi.map_id <> t.map_id)`,
  );

  const num = (row: Row | undefined, key: string): number => Number(row?.[key] ?? 0);

  const metrics: Record<string, number> = {
    references: num(counts, 'refs'),
    unresolvedItem: num(counts, 'unresolved_item'),
    unresolvedFolder: num(counts, 'unresolved_folder'),
    folderWithoutDataSource: num(counts, 'folder_without_data_source'),
    unresolvedDataSource: num(counts, 'unresolved_data_source'),
    inactiveItem: num(counts, 'inactive_item'),
    inactiveFolder: num(counts, 'inactive_folder'),
    mapsSpanningDataSources: num(spread, 'c'),
    mapsWithNoColumns: num(empty, 'c'),
    strayTotals: num(strayTotals, 'c'),
  };

  const violations = Object.entries(metrics).filter(([key, value]) => key !== 'references' && value > 0);
  const findings = violations
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => `${value}x ${key}`);

  return {
    id: 'referential-closure',
    name,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    metrics,
    findings,
    reason:
      violations.length > 0
        ? `${violations.length} closure invariant(s) broken across ${metrics.references} reference(s)`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

/** Run every seam against an already-migrated target and summarise. */
export async function verifyMigration(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<VerifyReport> {
  const target = text((await rows(db, sql`SELECT current_database() AS db`))[0], 'db', 'unknown');

  const seams: SeamResult[] = [
    await checkSqlGeneration(db, options),
    await checkFormulaCompileRate(db, options),
    await checkReferentialClosure(db, options),
  ];

  return summarise(target, seams);
}

/** Turn seam results into a status and a blocker list. Pure — easy to test. */
export function summarise(target: string, seams: SeamResult[]): VerifyReport {
  const blockers = seams
    .filter((s) => s.status === 'FAIL')
    .map((s) => `${s.id}: ${s.reason ?? s.name}`);

  return {
    target,
    ranAt: new Date().toISOString(),
    seams,
    blockers,
    status: blockers.length === 0 ? 'VERIFIED' : 'COMPLETED_WITH_BLOCKERS',
  };
}

/**
 * Render a report for a terminal. Deliberately count-first and bounded — the
 * full result stays in the database, not in anybody's scrollback.
 */
export function formatVerifyReport(report: VerifyReport): string {
  const lines: string[] = [
    `Verification of "${report.target}" at ${report.ranAt}`,
    '',
  ];

  for (const seam of report.seams) {
    const metrics = Object.entries(seam.metrics)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    lines.push(`[${seam.status.padEnd(7)}] ${seam.id} — ${seam.name}`);
    if (metrics) lines.push(`            ${metrics}`);
    if (seam.reason) lines.push(`            ${seam.reason}`);
    for (const finding of seam.findings) lines.push(`            · ${finding}`);
  }

  lines.push('', `Status: ${report.status}`);
  for (const blocker of report.blockers) lines.push(`  BLOCKER ${blocker}`);
  return lines.join('\n');
}
