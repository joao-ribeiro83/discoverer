/**
 * Post-commit verification of a migrated target database (D-070).
 *
 * Six seam checks — the ones a suite of components-against-their-own-fixtures
 * structurally cannot make (`AUDIT_TESTING_ASSESSMENT.md` §2 and §6):
 *
 *   1. `sql-generation`      every migrated map loads and generates SQL
 *   2. `formula-compile`     every calculated field compiles or is quarantined
 *   3. `referential-closure` every map reference resolves inside the query scope
 *   4. `reconciliation`      target counts match source, minus declared losses
 *   5. `measure-set`         the estate has measures the fan-trap guard can see
 *   6. `planner-live`        the fan-trap guard actually classifies real maps
 *
 * Runs AFTER the migration transaction commits, never inside it: a rollback
 * destroys the evidence needed to debug the failure, and one transaction over
 * 923 maps and 49 819 formulas is untenable. Everything here is read-only, so
 * an already-migrated estate can be verified repeatedly without re-importing.
 *
 * Three hooks are injected rather than imported. `generateSqlForMap`,
 * `compileFormula` and `planMap` all live in the backend workspace, which
 * depends on this one and not the reverse; importing them here would be a
 * dependency cycle. `dn-migrate verify` therefore reports those seams SKIPPED,
 * and the backend's own `npm run verify` supplies all three and runs all six.
 * A SKIPPED seam never counts as a pass.
 *
 * Output discipline (G-02): the reconciliation spans the whole estate, so a
 * seam returns counts plus at most `sampleLimit` example findings — never a
 * row-by-row dump.
 */

import { sql } from 'drizzle-orm';

import { EXPECTED_LOSS_ALLOWANCES, type ExpectedLossAllowance } from '../verify/expected-loss.js';

/**
 * All five seams are raw SQL, so the verifier asks only for something that can
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
  | 'reconciliation'
  | 'measure-set'
  | 'planner-live';

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
  /**
   * One stored map's FINAL decision, and the size of the measure set the
   * planner saw. Backend's `decideMap` over `loadMapDefinition`. Omitted here,
   * seam 6 is SKIPPED.
   *
   * `decision` is one of `FLAT`, `REWRITE(n)`, `REFUSE(<RULE>)` or `ERROR`.
   * **Final, not the planner's verdict alone**: two of the outcomes a user
   * meets — DISCONNECTED and NO_PREDICATE — are raised by the emitter, and a
   * histogram counting only planner verdicts would file both under `FLAT` and
   * report a guard doing work it never did (review R-07/B-03).
   */
  planMap?: (mapId: string) => Promise<{ decision: string; measures: number }>;
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
  /**
   * Override the declared allowances. Tests pass their own fixture-scoped set;
   * everything else uses the checked-in declaration.
   */
  allowances?: readonly ExpectedLossAllowance[];
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
// Seam 5 — the measure set the fan-trap guard reads
// ---------------------------------------------------------------------------

/**
 * The fan-trap guard's step 0 is `if |M| = 0: emit the flat plan, STOP`
 * (legacy-analysis §1.11). `M` is the measures carrying an aggregate function.
 * An estate where no map column has one classifies every query as `|M| = 0`,
 * and the guard ships **present, unit-tested and structurally inert** — passing
 * its own tests while never running on real data.
 *
 * That is the failure this seam exists to make loud, and it is not
 * hypothetical: `agg_function` was null on all 25 964 map items before Phase
 * 3.1, because `readItems` never selected `EXPRESSIONS.IT_FUN_ID`.
 *
 * Both halves of the split are asserted, because either one alone can be
 * satisfied while the guard stays blind:
 *
 * - **the axis/measure split**, from the workbook's `0x0123`/`0x0124` vectors.
 *   Without it every column looks like an axis.
 * - **the aggregate**, from the EUL's Default aggregate. Without it a measure
 *   is a column the guard cannot re-aggregate, so step 8 has nothing to key on.
 *
 * `measuresWithoutAggregate` is reported, never failed on. It is the estate's
 * real shape rather than a defect: 8 152 of its items carry Oracle's `Detail`
 * marker — explicitly *no* aggregation — and 353 carry no default at all. A
 * measure column over one of those is correctly null, and defaulting it to
 * `SUM` would turn a tracked gap into a wrong number.
 */
export async function checkMeasureSet(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = 'the estate carries a non-empty measure set for the fan-trap guard';
  const scope = mapScope(options.mapIdPrefix);

  const [counts] = await rows(
    db,
    sql`SELECT
          count(*)::int AS columns,
          count(*) FILTER (WHERE mi.axis_type = 'AXIS')::int AS axis,
          count(*) FILTER (WHERE mi.axis_type = 'MEASURE')::int AS measure,
          count(*) FILTER (WHERE mi.axis_type = 'PAGE')::int AS page,
          count(*) FILTER (WHERE mi.axis_type IS NULL)::int AS unclassified,
          count(*) FILTER (WHERE mi.agg_function IS NOT NULL)::int AS with_aggregate,
          count(*) FILTER (WHERE mi.axis_type = 'MEASURE' AND mi.agg_function IS NULL)::int
            AS measures_without_aggregate,
          count(DISTINCT mi.map_id) FILTER (WHERE mi.agg_function IS NOT NULL)::int
            AS maps_with_a_measure
        FROM map_items mi
        JOIN maps ON maps.id = mi.map_id
        WHERE maps.is_active AND ${scope}`,
  );

  const num = (row: Row | undefined, key: string): number => Number(row?.[key] ?? 0);

  const metrics: Record<string, number> = {
    columns: num(counts, 'columns'),
    axis: num(counts, 'axis'),
    measure: num(counts, 'measure'),
    page: num(counts, 'page'),
    unclassified: num(counts, 'unclassified'),
    withAggregate: num(counts, 'with_aggregate'),
    measuresWithoutAggregate: num(counts, 'measures_without_aggregate'),
    mapsWithAMeasure: num(counts, 'maps_with_a_measure'),
  };

  const blockers: string[] = [];
  if (metrics.columns === 0) {
    blockers.push('no map columns to classify');
  } else {
    if (metrics.measure === 0) blockers.push('no column is on the measure vector');
    if (metrics.withAggregate === 0) blockers.push('no column carries an aggregate function');
  }

  return {
    id: 'measure-set',
    name,
    status: blockers.length === 0 ? 'PASS' : 'FAIL',
    metrics,
    findings: blockers,
    reason:
      blockers.length > 0
        ? `the fan-trap guard would classify every query as |M| = 0: ${blockers.join('; ')}`
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// Seam 6 — the planner-decision histogram
// ---------------------------------------------------------------------------

/**
 * Phase 0.4's measured baseline (`research/baseline-counts.md`), asserted
 * against rather than restated as a literal at the point of use.
 *
 * `DISCONNECTED_BASELINE` is the count of multi-folder maps whose folder set no
 * chain of the ten known joins connects — 271 of 341, matching
 * `legacy-analysis.md` §1.11 step 1 exactly. Phase 3.2 set out to reduce it. If
 * this run does not come in below it, Phase 3.2 did not fix what it claimed.
 */
export const DISCONNECTED_BASELINE = 271;

/** The fan-trap rules. One of these firing is what "the guard fired" means. */
const FAN_TRAP_RULES = ['R1', 'R2', 'R3', 'R4', 'REAGG'] as const;

/** `REFUSE(R3)` -> `R3`; `REWRITE(2)` -> `2`. Null when there is no `(...)`. */
function decisionArgument(decision: string): string | null {
  const match = /\(([^)]*)\)/.exec(decision);
  return match ? match[1]! : null;
}

/**
 * The planner-decision histogram over every migrated map (D-037, B-7).
 *
 * **A guard that fires zero times is indistinguishable from a guard that is not
 * wired in**, and this project's documented failure mode is three mechanisms
 * reporting success over a non-functional system. Every SQL test in this
 * repository runs against a hand-built `MapDefinition`, so a guard can pass its
 * whole suite while never having classified a migrated map. Only a real map,
 * loaded from the database, can tell you.
 *
 * ## Why the histogram is per rule
 *
 * The gate this seam was first given was `REFUSE > 0 && FLAT < 923`. It cannot
 * tell the fan-trap guard from a failure that predates it. 271 of this estate's
 * 341 multi-folder maps refuse on DISCONNECTED — a rule Neo has had since
 * before the planner existed. Those refusals alone satisfy `REFUSE > 0`, and
 * `FLAT` is comfortably below the total, so the original gate would pass with
 * the guard never having fired once (review R-07/B-03).
 *
 * So the histogram counts each rule separately, and three assertions replace
 * the one:
 *
 *  1. **`REWRITE(n) > 0`** — the rewrite path is reachable at all. This is the
 *     assertion that matters. A guard that only ever refuses has not been shown
 *     to work; it has been shown to have no input.
 *  2. **`REFUSE(DISCONNECTED)` below Phase 3.2's baseline** — otherwise 3.2 did
 *     not fix what it claimed.
 *  3. **A fan-trap rule fired, or the run says in words that none could.**
 *     "No map in this estate meets the trigger condition" is an acceptable
 *     answer. Silence is not.
 *
 * `ERROR` is reported and never gated on: an unrendered formula token is Phase
 * 4's problem and must be counted separately from a planner refusal.
 */

/**
 * Maps that would reach the planner's fan test if they loaded: more than one
 * folder, connected by the known joins, and carrying at least one measure.
 *
 * Counted straight from the tables rather than through the planner, because
 * the whole point is to include maps the planner never sees. `REWRITE = 0`
 * means two very different things depending on this number:
 *
 * - **zero candidates** — this estate contains no fan trap. An honest reading,
 *   and nothing downstream can change it.
 * - **candidates, none of them decided** — the rewrite path is blocked
 *   upstream, not absent. Today that upstream is Phase 4: every candidate here
 *   carries an unrendered Discoverer formula token and throws before the
 *   planner runs.
 *
 * Without the distinction a reader cannot tell a guard with no work to do from
 * a guard whose work never arrives.
 */
async function fanCandidates(
  db: VerifyDb,
  prefix: string | undefined,
): Promise<{ total: number; ids: Set<string> }> {
  const mapRows = await rows(
    db,
    sql`WITH mf AS (
          SELECT mi.map_id, i.folder_id FROM map_items mi JOIN items i ON i.id = mi.item_id
          UNION
          SELECT mc.map_id, i.folder_id FROM map_conditions mc JOIN items i ON i.id = mc.item_id
        )
        SELECT maps.id::text AS id,
               array_agg(DISTINCT mf.folder_id::text) AS folders,
               (SELECT count(*) FROM map_items x
                 WHERE x.map_id = maps.id AND x.agg_function IS NOT NULL)::int AS measures
        FROM maps JOIN mf ON mf.map_id = maps.id
        WHERE maps.is_active AND ${mapScope(prefix)}
        GROUP BY maps.id`,
  );

  const edgeRows = await rows(
    db,
    sql`SELECT left_folder_id::text AS l, right_folder_id::text AS r FROM joins`,
  );
  const edges = edgeRows.map((e) => [String(e.l), String(e.r)] as const);

  const ids = new Set<string>();
  for (const row of mapRows) {
    const folders = Array.isArray(row.folders) ? (row.folders as string[]) : [];
    if (folders.length <= 1 || Number(row.measures ?? 0) === 0) continue;

    // Union-find over the edges whose BOTH endpoints the map uses.
    const parent = new globalThis.Map(folders.map((f) => [f, f]));
    const find = (x: string): string => {
      let cur = x;
      while (parent.get(cur) !== cur) {
        parent.set(cur, parent.get(parent.get(cur)!)!);
        cur = parent.get(cur)!;
      }
      return cur;
    };
    const inMap = new Set(folders);
    for (const [a, b] of edges) {
      if (!inMap.has(a) || !inMap.has(b)) continue;
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }
    if (new Set(folders.map(find)).size === 1) ids.add(String(row.id));
  }

  return { total: ids.size, ids };
}

export async function checkPlannerLive(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = 'the planner-decision histogram, over every migrated map';
  const limit = options.sampleLimit ?? 10;

  if (!options.planMap) {
    return {
      id: 'planner-live',
      name,
      status: 'SKIPPED',
      metrics: {},
      findings: [],
      reason:
        'no planner injected — it lives in the backend workspace; run `npm run verify --workspace backend`',
    };
  }

  const mapRows = await rows(
    db,
    sql`SELECT id::text AS id, name FROM maps
        WHERE is_active AND ${mapScope(options.mapIdPrefix)}
        ORDER BY name
        ${options.maxMaps ? sql`LIMIT ${options.maxMaps}` : sql``}`,
  );

  /** Histogram bucket -> count. `FLAT`, `REWRITE(2)`, `REFUSE(R3)`, `ERROR`. */
  const histogram = new globalThis.Map<string, number>();
  const findings: string[] = [];
  let decided = 0;
  let withMeasures = 0;

  const candidates = await fanCandidates(db, options.mapIdPrefix);
  let candidatesDecided = 0;

  for (const row of mapRows) {
    try {
      const outcome = await options.planMap(String(row.id));
      decided += 1;
      if (candidates.ids.has(String(row.id))) candidatesDecided += 1;
      if (outcome.measures > 0) withMeasures += 1;
      histogram.set(outcome.decision, (histogram.get(outcome.decision) ?? 0) + 1);
    } catch (err) {
      // The map could not even be loaded. Not a decision, so not in the
      // histogram — it is a hole in it, and reported as one.
      if (findings.length < limit) {
        findings.push(`${String(row.name)} (${String(row.id)}): ${describe(err)}`);
      }
    }
  }

  const count = (bucket: string): number => histogram.get(bucket) ?? 0;
  /** Every `REWRITE(n)` summed — the branch count varies, the fact does not. */
  let rewrites = 0;
  const refusals = new globalThis.Map<string, number>();
  for (const [bucket, n] of histogram) {
    if (bucket.startsWith('REWRITE')) rewrites += n;
    if (bucket.startsWith('REFUSE')) {
      const rule = decisionArgument(bucket) ?? 'UNNAMED';
      refusals.set(rule, (refusals.get(rule) ?? 0) + n);
    }
  }

  const fanTrapRefusals = FAN_TRAP_RULES.reduce(
    (total, rule) => total + (refusals.get(rule) ?? 0),
    0,
  );
  const disconnected = refusals.get('DISCONNECTED') ?? 0;

  const metrics: Record<string, number> = {
    maps: mapRows.length,
    decided,
    mapsWithANonEmptyMeasureSet: withMeasures,
    flat: count('FLAT'),
    rewrite: rewrites,
    refuse: [...refusals.values()].reduce((a, b) => a + b, 0),
    fanTrapRefusals,
    error: count('ERROR'),
    notDecided: mapRows.length - decided,
    fanCandidates: candidates.total,
    fanCandidatesDecided: candidatesDecided,
  };
  for (const [rule, n] of refusals) metrics[`refuse${rule}`] = n;
  // The branch-count breakdown, so `REWRITE(2)` and `REWRITE(3)` stay visible.
  for (const [bucket, n] of histogram) {
    if (bucket.startsWith('REWRITE')) metrics[bucket.toLowerCase().replace(/[()]/g, '')] = n;
  }

  // Assertion 3 is a statement, not a gate: "no map triggers it" is an
  // acceptable answer, but the run has to say so in words.
  findings.push(
    fanTrapRefusals > 0
      ? `fan-trap rules fired ${fanTrapRefusals} time(s): ${FAN_TRAP_RULES.filter(
          (r) => refusals.get(r),
        )
          .map((r) => `${r}x${refusals.get(r)}`)
          .join(', ')}`
      : 'no fan-trap rule (R1-R4, REAGG) fired: no map in this estate reached a ' +
          'trigger condition. Recorded deliberately — silence would not be an answer.',
  );

  // Assertion 2's number is a FLOOR, not a like-for-like comparison, until
  // every map reaches a decision. A map that throws before the planner runs is
  // absent from the histogram, so it cannot be counted as DISCONNECTED either,
  // and the count falls for a reason that has nothing to do with Phase 3.2.
  // Say so next to the number rather than letting the gate imply otherwise.
  findings.push(
    `REFUSE(DISCONNECTED) = ${disconnected} against a baseline of ${DISCONNECTED_BASELINE}, ` +
      `over ${decided} of ${mapRows.length} maps that reached a decision. ` +
      (decided < mapRows.length
        ? `The ${mapRows.length - decided} that did not are absent from every bucket, so ` +
          'this count is a floor and not yet a like-for-like reading of the baseline.'
        : 'Full coverage, so this is a like-for-like reading.'),
  );

  const blockers: string[] = [];
  if (decided === 0) {
    blockers.push('no map could be decided at all');
  } else {
    // 1 — the assertion that matters.
    if (rewrites === 0) {
      blockers.push(
        'REWRITE fired zero times: the rewrite path is unreachable, so the guard has ' +
          'not been shown to work — only shown to have no input' +
          (candidates.total === 0
            ? '. No map in this estate is multi-folder, connected and carrying a ' +
              'measure, so there is nothing here that could fan'
            : `. ${candidates.total} map(s) WOULD reach the fan test, and ` +
              `${candidatesDecided} of them reached a decision — the rest throw before ` +
              'the planner runs, so the blockage is upstream of this guard, not in it'),
      );
    }
    // 2 — Phase 3.2's claim, measured.
    if (disconnected >= DISCONNECTED_BASELINE) {
      blockers.push(
        `REFUSE(DISCONNECTED) is ${disconnected}, not below Phase 0.4's baseline of ` +
          `${DISCONNECTED_BASELINE}: Phase 3.2 did not reduce what it claimed to`,
      );
    }
    if (withMeasures === 0) blockers.push('every decided map classified |M| = 0');
  }

  return {
    id: 'planner-live',
    name,
    status: blockers.length === 0 ? 'PASS' : 'FAIL',
    metrics,
    findings,
    reason: blockers.length > 0 ? blockers.join('; ') : undefined,
  };
}

// ---------------------------------------------------------------------------
// Seam 4 — source <-> target reconciliation
// ---------------------------------------------------------------------------

/** Table names are interpolated, so refuse anything that is not a bare one. */
const BARE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Compare the target against the counts a migration of the recorded source is
 * declared to produce. The losses themselves live in
 * `verify/expected-loss.ts` — this seam only asks whether reality still matches
 * what was declared, so a regression can never be mistaken for a known gap.
 *
 * Drift fails in BOTH directions. Fewer rows than declared is a regression;
 * more rows means a phase recovered something and left the declaration stale,
 * which is how an allowance quietly becomes permanent.
 */
export async function checkReconciliation(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<SeamResult> {
  const name = 'target counts match the declared source-to-target expectations';
  const limit = options.sampleLimit ?? 10;
  const allowances = options.allowances ?? EXPECTED_LOSS_ALLOWANCES;
  const prefix = options.mapIdPrefix;

  const findings: string[] = [];
  let matched = 0;
  let rowsLost = 0;
  let unexplained = 0;

  for (const allowance of allowances) {
    if (!BARE_IDENTIFIER.test(allowance.table)) {
      throw new Error(`Refusing to count "${allowance.table}": not a bare table name`);
    }
    const table = sql.raw(allowance.table);
    const where =
      prefix === undefined ? sql`TRUE` : sql`${sql.raw(allowance.table)}.id::text LIKE ${prefix + '%'}`;
    const [row] = await rows(db, sql`SELECT count(*)::int AS c FROM ${table} WHERE ${where}`);
    const actual = Number(row?.c ?? 0);

    if (allowance.sourceCount !== null) rowsLost += Math.max(0, allowance.sourceCount - actual);
    if (!allowance.explained && allowance.sourceCount !== null && allowance.sourceCount !== actual) {
      unexplained += 1;
    }

    if (actual === allowance.expectedTarget) {
      matched += 1;
    } else if (findings.length < limit) {
      const direction = actual < allowance.expectedTarget ? 'short by' : 'over by';
      findings.push(
        `${allowance.concept}: expected ${allowance.expectedTarget}, found ${actual} - ${direction} ${Math.abs(actual - allowance.expectedTarget)}`,
      );
    }
  }

  const drifted = allowances.length - matched;
  return {
    id: 'reconciliation',
    name,
    status: drifted === 0 ? 'PASS' : 'FAIL',
    metrics: {
      concepts: allowances.length,
      matched,
      drifted,
      rowsLostToAllowances: rowsLost,
      unexplainedAllowances: unexplained,
    },
    findings,
    reason:
      drifted > 0
        ? `${drifted} concept(s) drifted from the declared expectation in verify/expected-loss.ts`
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
    await checkReconciliation(db, options),
    await checkMeasureSet(db, options),
    await checkPlannerLive(db, options),
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

export { EXPECTED_LOSS_ALLOWANCES };
export type { ExpectedLossAllowance };
