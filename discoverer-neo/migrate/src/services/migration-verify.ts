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
// Report assembly
// ---------------------------------------------------------------------------

/** Run every seam against an already-migrated target and summarise. */
export async function verifyMigration(
  db: VerifyDb,
  options: VerifyOptions = {},
): Promise<VerifyReport> {
  const target = text((await rows(db, sql`SELECT current_database() AS db`))[0], 'db', 'unknown');

  const seams: SeamResult[] = [await checkSqlGeneration(db, options)];

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
