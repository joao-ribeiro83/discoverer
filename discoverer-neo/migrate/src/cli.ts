#!/usr/bin/env node
/**
 * `dn-migrate` — the Discoverer Neo migration CLI.
 *
 * Commands:
 *   dn-migrate analyze  --connection <config> [--json]
 *   dn-migrate export   --connection <config> --output <file>
 *   dn-migrate validate --connection <config>
 *
 * `--connection` is a path to a JSON connection-config file, or an inline JSON
 * object; individual `--user/--password/--host/...` flags override fields of
 * it (or stand alone). The whole command surface is factored so `runCli` takes
 * injectable IO / filesystem / source dependencies, which is what lets the CLI
 * be tested against a mock Oracle executor with no real database.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import type { AssessmentReport, ValidationResult } from './services/assessment.js';
import { generateAssessmentReport, validateEulData } from './services/assessment.js';
import type { EulReadResult, ReadEulOptions } from './services/eul-reader.js';
import { readEulSchema } from './services/eul-reader.js';
import type { EulConnectionConfig, EulSource } from './services/oracle-client.js';
import { closeAllPools, createExecutor } from './services/oracle-client.js';
import { EulDetectionError } from './services/eul-version-detector.js';
import type { EulVersion } from './types/eul-versions.js';
import { isEulVersion } from './types/eul-versions.js';
import type { TargetConnectionConfig } from './db/client.js';
import { createTargetDb } from './db/client.js';
import type { MigrationWriter } from './services/migration-writer.js';
import { createMigrationWriter } from './services/migration-writer.js';
import type {
  MigrationEvent,
  MigrationResult,
  MigrationValidationResult,
} from './services/migration-runner.js';
import { runMigration, TARGET_TABLE_ORDER, validateMigration } from './services/migration-runner.js';
import type { VerifyDb } from './services/migration-verify.js';
import { formatVerifyReport, verifyMigration } from './services/migration-verify.js';

// ---------------------------------------------------------------------------
// Injectable dependencies
// ---------------------------------------------------------------------------

export interface CliIO {
  out: (line: string) => void;
  err: (line: string) => void;
}

export interface CliDeps {
  io?: CliIO;
  /** Inject a source (e.g. a mock executor) to bypass connection building. */
  source?: EulSource;
  /** Build a source from a resolved config. Defaults to a pooled executor. */
  makeSource?: (config: EulConnectionConfig) => EulSource;
  /** Inject a target writer (e.g. an in-memory fake) to bypass Postgres. */
  writer?: MigrationWriter;
  /** Build a writer from a resolved target config. Defaults to Drizzle/pg. */
  makeWriter?: (config: TargetConnectionConfig) => {
    writer: MigrationWriter;
    close: () => Promise<void>;
  };
  writeFile?: (path: string, content: string) => Promise<void>;
  readFile?: (path: string) => Promise<string>;
  /** Injectable runner hooks (UUID minting / clock) for deterministic tests. */
  migrationDeps?: { genId?: () => string; now?: () => Date };
}

const consoleIO: CliIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

// Exit codes: 0 ok · 1 usage/runtime error · 2 validate found integrity errors.
export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_INVALID = 2;

// ---------------------------------------------------------------------------
// Connection config resolution
// ---------------------------------------------------------------------------

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

interface ConnectionArgs {
  connection?: string;
  user?: string;
  password?: string;
  connectString?: string;
  host?: string;
  port?: number;
  serviceName?: string;
  sid?: string;
  schemaOwner?: string;
}

function looksLikeJson(value: string): boolean {
  return value.trim().startsWith('{');
}

/**
 * Build an EulConnectionConfig from `--connection` (a JSON file path or an
 * inline JSON object) plus any individual override flags.
 */
export async function loadConnectionConfig(
  args: ConnectionArgs,
  readFile: (path: string) => Promise<string>,
): Promise<EulConnectionConfig> {
  let base: Partial<EulConnectionConfig> = {};

  if (args.connection) {
    let raw: string;
    if (looksLikeJson(args.connection)) {
      raw = args.connection;
    } else {
      try {
        raw = await readFile(args.connection);
      } catch (err) {
        throw new CliUsageError(
          `Could not read connection config file "${args.connection}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    try {
      base = JSON.parse(raw) as Partial<EulConnectionConfig>;
    } catch (err) {
      throw new CliUsageError(
        `Connection config is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const config: Partial<EulConnectionConfig> = {
    ...base,
    ...(args.user !== undefined ? { user: args.user } : {}),
    ...(args.password !== undefined ? { password: args.password } : {}),
    ...(args.connectString !== undefined ? { connectString: args.connectString } : {}),
    ...(args.host !== undefined ? { host: args.host } : {}),
    ...(args.port !== undefined ? { port: args.port } : {}),
    ...(args.serviceName !== undefined ? { serviceName: args.serviceName } : {}),
    ...(args.sid !== undefined ? { sid: args.sid } : {}),
    ...(args.schemaOwner !== undefined ? { schemaOwner: args.schemaOwner } : {}),
  };

  if (!config.user || !config.password) {
    throw new CliUsageError(
      'Connection requires at least "user" and "password" (via --connection config or ' +
        '--user/--password).',
    );
  }
  if (!config.connectString && !config.host) {
    throw new CliUsageError(
      'Connection requires either "connectString" or "host" (plus serviceName/sid).',
    );
  }

  return config as EulConnectionConfig;
}

/**
 * Resolve `--target` into a Postgres connection config. Accepts a connection
 * URL (`postgres://…`), an inline JSON object, or a path to a JSON file.
 */
export async function loadTargetConfig(
  target: string | undefined,
  readFile: (path: string) => Promise<string>,
): Promise<TargetConnectionConfig> {
  if (!target) {
    throw new CliUsageError('This command requires --target <postgres connection URL, JSON file, or inline JSON>.');
  }
  if (target.startsWith('postgres://') || target.startsWith('postgresql://')) {
    return { connectionString: target };
  }

  let raw: string;
  if (looksLikeJson(target)) {
    raw = target;
  } else {
    try {
      raw = await readFile(target);
    } catch (err) {
      throw new CliUsageError(
        `Could not read target config file "${target}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  let parsed: TargetConnectionConfig;
  try {
    parsed = JSON.parse(raw) as TargetConnectionConfig;
  } catch (err) {
    throw new CliUsageError(
      `Target config is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed.connectionString && !parsed.host) {
    throw new CliUsageError('Target config requires either "connectionString" or "host".');
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function pad(label: string, width = 20): string {
  return `${label}:`.padEnd(width);
}

export function formatAssessmentReport(report: AssessmentReport): string {
  const { version, counts, complexity, orphans, workbookUsage, estimate, readiness } = report;
  const lines: string[] = [];

  lines.push('EUL Migration Assessment');
  lines.push('========================');
  lines.push(`${pad('Source version')}${version.version} (Discoverer ${version.discovererVersion})`);
  lines.push(`${pad('Schema version')}${version.schemaVersion}`);
  lines.push(`${pad('Schema owner')}${version.owner ?? '(unknown)'}`);
  lines.push(`${pad('Supported')}${version.supported ? 'yes' : 'no'}`);
  lines.push('');

  lines.push('Object counts');
  lines.push('-------------');
  lines.push(`  ${pad('Business areas', 21)}${counts.businessAreas}`);
  lines.push(`  ${pad('Folders', 21)}${counts.folders}`);
  lines.push(`  ${pad('Items', 21)}${counts.items} (calculated: ${counts.calculatedItems})`);
  lines.push(`  ${pad('Conditions', 21)}${counts.conditions}`);
  if (counts.securityConditions > 0) {
    lines.push(`  ${pad('Security conditions', 21)}${counts.securityConditions}`);
  }
  lines.push(`  ${pad('Joins', 21)}${counts.joins}`);
  lines.push(`  ${pad('Hierarchies', 21)}${counts.hierarchies}`);
  lines.push(`  ${pad('Custom functions', 21)}${counts.customFunctions}`);
  lines.push(`  ${pad('Workbooks', 21)}${counts.workbooks}`);
  lines.push(`  ${pad('Users', 21)}${counts.users}`);
  lines.push(`  ${pad('Grants', 21)}${counts.grants}`);

  const folderTypes = Object.entries(report.folderTypeBreakdown)
    .map(([type, n]) => `${type} ×${n}`)
    .join(', ');
  lines.push(`  ${pad('Folder types', 21)}${folderTypes || '(none)'}`);
  lines.push('');

  lines.push(`Complexity: ${complexity.score.toUpperCase()} (${complexity.points} points)`);
  for (const factor of complexity.factors) {
    lines.push(`  ${factor.label} ×${factor.count} → ${Math.round(factor.points * 10) / 10} pts`);
  }
  lines.push('');

  lines.push(`Orphaned objects: ${orphans.total}`);
  if (orphans.total > 0) {
    for (const o of orphans.itemsWithoutFolder) lines.push(`  item "${o.name}" — ${o.reason}`);
    for (const o of orphans.joinsWithoutComponents) lines.push(`  join "${o.name}" — ${o.reason}`);
    for (const o of orphans.hierarchiesWithoutBusinessArea) {
      lines.push(`  hierarchy "${o.name}" — ${o.reason}`);
    }
    for (const o of orphans.foldersWithoutBusinessArea) {
      lines.push(`  folder "${o.name}" — ${o.reason}`);
    }
  }
  lines.push('');

  if (workbookUsage.hasQueryLog) {
    lines.push(
      `Workbook usage: ${workbookUsage.totalExecutions} execution(s) across ` +
        `${workbookUsage.workbooksWithUsage} workbook(s)`,
    );
    for (const wb of workbookUsage.topWorkbooks) {
      lines.push(
        `  ${wb.workbookName ?? '(unnamed)'}: ${wb.executionCount} run(s), ` +
          `avg ${Math.round(wb.avgElapsedTime)} ms`,
      );
    }
  } else {
    lines.push('Workbook usage: no query-log data available');
  }
  lines.push('');

  lines.push(`Warnings (${report.warnings.length})`);
  lines.push('------------');
  if (report.warnings.length === 0) {
    lines.push('  (none)');
  } else {
    for (const w of report.warnings) lines.push(`  [${w.severity}] ${w.code}: ${w.message}`);
  }
  lines.push('');

  lines.push(
    `Estimated migration effort: ${estimate.humanReadable} (${estimate.totalObjects} objects)`,
  );
  lines.push('');

  lines.push(`Source readiness: ${readiness.score}/100 (${readiness.rating})`);
  for (const blocker of readiness.blockers) lines.push(`  ! ${blocker}`);
  for (const note of readiness.notes) lines.push(`  - ${note}`);

  return lines.join('\n');
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push('EUL Integrity Validation');
  lines.push('========================');
  lines.push(
    result.valid
      ? 'Result: VALID (no referential-integrity errors)'
      : 'Result: INVALID (referential-integrity errors found)',
  );
  lines.push(`Errors: ${result.errorCount}   Warnings: ${result.warningCount}`);
  lines.push('');
  if (result.issues.length === 0) {
    lines.push('No issues found.');
  } else {
    for (const issue of result.issues) {
      const ids =
        issue.objectIds && issue.objectIds.length > 0
          ? ` [ids: ${issue.objectIds.slice(0, 20).join(', ')}${
              issue.objectIds.length > 20 ? ', …' : ''
            }]`
          : '';
      lines.push(`  [${issue.severity}] ${issue.code}: ${issue.message}${ids}`);
    }
  }
  return lines.join('\n');
}

export function formatMigrationResult(result: MigrationResult): string {
  const lines: string[] = [];
  lines.push(result.dryRun ? 'EUL Migration — DRY RUN' : 'EUL Migration — RUN');
  lines.push('='.repeat(result.dryRun ? 22 : 18));
  lines.push(
    `${pad('Source version')}${result.version.version} (Discoverer ${result.version.discovererVersion})`,
  );
  lines.push(`${pad('Schema owner')}${result.version.owner ?? '(unknown)'}`);
  if (result.runId) lines.push(`${pad('Run id')}${result.runId}`);
  lines.push(`${pad('Duration')}${(result.durationMs / 1000).toFixed(2)}s`);
  lines.push('');

  // A dry run reaches here with a blocked target (a real run throws instead),
  // so lead with it: the counts below would never be written.
  if (result.preflight.alreadyMigrated) {
    lines.push('TARGET BLOCKED');
    lines.push('--------------');
    lines.push(`  ${result.preflight.message}`);
    lines.push('');
  }

  const counts = result.dryRun ? result.planned : result.inserted;
  lines.push(result.dryRun ? 'Rows that would be inserted' : 'Rows inserted');
  lines.push('---------------------------');
  let total = 0;
  for (const table of TARGET_TABLE_ORDER) {
    const n = counts[table];
    total += n;
    lines.push(`  ${pad(table, 28)}${n}`);
  }
  lines.push(`  ${pad('TOTAL', 28)}${total}`);
  if (result.syntheticBusinessAreas > 0) {
    lines.push(
      `  (includes ${result.syntheticBusinessAreas} auto-created business area hosting workbook maps)`,
    );
  }
  lines.push('');

  lines.push(`Skipped objects: ${result.skipped.length}`);
  for (const skip of result.skipped.slice(0, 25)) {
    lines.push(`  ${skip.table} ${skip.sourceId}: ${skip.reason}`);
  }
  if (result.skipped.length > 25) lines.push(`  … and ${result.skipped.length - 25} more`);
  lines.push('');

  // Warnings repeat per object; group by code so the summary stays readable.
  const byCode = new Map<string, number>();
  for (const w of result.warnings) byCode.set(w.code, (byCode.get(w.code) ?? 0) + 1);
  lines.push(`Warnings: ${result.warnings.length}`);
  for (const [code, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    const sample = result.warnings.find((w) => w.code === code);
    lines.push(`  [${code}] ×${n} — ${sample?.message ?? ''}`);
  }
  lines.push('');

  lines.push(
    `Source integrity: ${result.sourceValidation.valid ? 'VALID' : 'INVALID'} ` +
      `(${result.sourceValidation.errorCount} error(s), ${result.sourceValidation.warningCount} warning(s))`,
  );

  if (result.validation) {
    lines.push(
      `Post-migration reconciliation: ${result.validation.valid ? 'OK' : 'FAILED'}`,
    );
    for (const issue of result.validation.issues) lines.push(`  ! ${issue}`);
  }

  lines.push('');
  lines.push(`Migrated users sign in with: ${result.migrationUserEmail} (password reset required for all migrated accounts).`);
  return lines.join('\n');
}

export function formatMigrationValidation(
  version: string,
  validation: MigrationValidationResult,
): string {
  const lines: string[] = [];
  lines.push('Migration Validation (source vs target)');
  lines.push('======================================');
  lines.push(`${pad('Source version')}${version}`);
  lines.push(
    validation.valid
      ? 'Result: OK — target row counts match the source metadata.'
      : 'Result: MISMATCH — target row counts differ from the source metadata.',
  );
  lines.push('');
  lines.push(`  ${'table'.padEnd(28)}${'expected'.padStart(9)}${'actual'.padStart(9)}`);
  for (const r of validation.reconciliations) {
    lines.push(
      `  ${r.table.padEnd(28)}${String(r.expected).padStart(9)}${String(r.actual).padStart(9)}` +
        (r.ok ? '' : '   <-- mismatch'),
    );
  }
  return lines.join('\n');
}

/** JSON.stringify replacer preserving Dates as ISO strings (default behavior). */
function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function commandAnalyze(
  source: EulSource,
  options: ReadEulOptions & { json?: boolean },
  io: CliIO,
): Promise<number> {
  const eul: EulReadResult = await readEulSchema(source, options);
  const report = generateAssessmentReport(eul);
  io.out(options.json ? toJson(report) : formatAssessmentReport(report));
  return EXIT_OK;
}

export async function commandExport(
  source: EulSource,
  options: ReadEulOptions & { output: string },
  io: CliIO,
  writeFile: (path: string, content: string) => Promise<void>,
): Promise<number> {
  const eul: EulReadResult = await readEulSchema(source, options);
  const payload = { version: eul.version, data: eul.data };
  await writeFile(options.output, toJson(payload));
  const counts = eul.data;
  io.out(
    `Exported EUL ${eul.version.version} metadata to ${options.output} ` +
      `(${counts.businessAreas.length} business areas, ${counts.folders.length} folders, ` +
      `${counts.items.length} items, ${counts.workbooks.length} workbooks).`,
  );
  return EXIT_OK;
}

export async function commandValidate(
  source: EulSource,
  options: ReadEulOptions,
  io: CliIO,
): Promise<number> {
  const eul: EulReadResult = await readEulSchema(source, options);
  const result = validateEulData(eul);
  io.out(formatValidationResult(result));
  return result.valid ? EXIT_OK : EXIT_INVALID;
}

export interface RunCommandOptions {
  readOptions: ReadEulOptions;
  /** 'auto' detects; EUL4/EUL5 override auto-detection. */
  version?: 'auto' | EulVersion;
  dryRun?: boolean;
  json?: boolean;
  migrationDeps?: { genId?: () => string; now?: () => Date };
  /** Target data_sources row every migrated folder points at. */
  dataSourceId?: string;
}

export async function commandRun(
  source: EulSource,
  writer: MigrationWriter,
  options: RunCommandOptions,
  io: CliIO,
): Promise<number> {
  // Live progress goes to stderr so stdout carries only the final report
  // (which may be JSON).
  const onEvent = (event: MigrationEvent): void => {
    if (event.type === 'progress') {
      io.err(`  → ${event.phase}: ${event.current ?? 0}/${event.total ?? 0} row(s)`);
    } else {
      io.err(`[${event.level}] ${event.phase}: ${event.message}`);
    }
  };

  const result = await runMigration({
    source,
    writer,
    readOptions: options.readOptions,
    version: options.version,
    dryRun: options.dryRun,
    dataSourceId: options.dataSourceId,
    deps: options.migrationDeps,
    onEvent,
  });

  io.out(options.json ? toJson(result) : formatMigrationResult(result));

  if (result.dryRun) return result.sourceValidation.valid ? EXIT_OK : EXIT_INVALID;
  return result.validation && !result.validation.valid ? EXIT_INVALID : EXIT_OK;
}

/**
 * Post-migration validation: re-read the source, compute what a migration
 * *would* produce (a dry run), and reconcile those counts against the rows
 * actually present in the target database.
 */
export async function commandValidateMigration(
  source: EulSource,
  writer: MigrationWriter,
  options: RunCommandOptions,
  io: CliIO,
): Promise<number> {
  const result = await runMigration({
    source,
    writer,
    readOptions: options.readOptions,
    version: options.version,
    dryRun: true,
    deps: options.migrationDeps,
  });

  const validation = await validateMigration(
    writer,
    TARGET_TABLE_ORDER.map((table) => ({ table, baseline: 0, inserted: result.planned[table] })),
  );

  io.out(
    options.json
      ? toJson({ version: result.version, validation })
      : formatMigrationValidation(result.version.version, validation),
  );
  return validation.valid ? EXIT_OK : EXIT_INVALID;
}

// ---------------------------------------------------------------------------
// Argument parsing + dispatch
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// `verify` — post-commit verification of an already-migrated target (D-070)
// ---------------------------------------------------------------------------

/**
 * Read-only, post-commit, and re-runnable. It never re-imports and never opens
 * a transaction: a rollback over 923 maps would destroy the evidence needed to
 * debug the failure, and the estate is already migrated in any case.
 *
 * Two of the four seams need the SQL generator and the formula parser, which
 * live in the backend workspace. That workspace depends on this one and not the
 * reverse, so those seams report SKIPPED here — never PASS — and name the
 * command that runs them. `npm run verify --workspace @discoverer-neo/backend`
 * runs all four against the same database.
 *
 * Exit code 1 on COMPLETED_WITH_BLOCKERS, so a cutover runbook can gate on it.
 */
export async function commandVerify(
  db: VerifyDb,
  options: { json: boolean; sampleLimit?: number },
  io: CliIO,
): Promise<number> {
  const report = await verifyMigration(db, { sampleLimit: options.sampleLimit });

  // The report carries the database NAME only. `data_sources` holds
  // `password_enc`, and nothing here reads a column from it.
  io.out(options.json ? JSON.stringify(report, null, 2) : formatVerifyReport(report));

  return report.status === 'VERIFIED' ? EXIT_OK : EXIT_ERROR;
}

function parseArgs(argv: string[]) {
  return yargs(argv)
    .scriptName('dn-migrate')
    .usage('$0 <command> [options]')
    // Must precede the `--version` option below: yargs treats "version" as a
    // reserved word and rejects it as an option key unless disabled first.
    .version(false)
    .option('connection', {
      type: 'string',
      describe: 'Path to a JSON connection-config file, or an inline JSON config object',
    })
    .option('user', { type: 'string', describe: 'Oracle username' })
    .option('password', { type: 'string', describe: 'Oracle password' })
    .option('connect-string', { type: 'string', describe: 'Full Oracle connect string' })
    .option('host', { type: 'string', describe: 'Oracle host' })
    .option('port', { type: 'number', describe: 'Oracle port (default 1521)' })
    .option('service-name', { type: 'string', describe: 'Oracle service name' })
    .option('sid', { type: 'string', describe: 'Oracle SID' })
    .option('schema-owner', { type: 'string', describe: 'Schema owning the EUL tables' })
    .option('prefer-version', {
      type: 'string',
      choices: ['EUL4', 'EUL5'],
      describe: 'On a mixed EUL4/EUL5 schema, force this version',
    })
    .option('output', { type: 'string', alias: 'o', describe: 'Output file (export command)' })
    .option('json', { type: 'boolean', default: false, describe: 'Emit JSON (analyze command)' })
    .option('target', {
      type: 'string',
      describe:
        'Target Discoverer Neo Postgres: connection URL, JSON config file, or inline JSON (run/validate)',
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      describe: 'Run the full pipeline and report, without writing to the target (run command)',
    })
    .option('version', {
      type: 'string',
      // Accept either case; normalized before the choices check.
      coerce: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value),
      choices: ['auto', 'eul4', 'eul5'],
      default: 'auto',
      describe: 'Override EUL auto-detection (run/validate)',
    })
    .option('data-source-id', {
      type: 'string',
      describe:
        'Target data_sources UUID to stamp on every migrated folder (run). Without it, no map can execute.',
    })
    .option('samples', {
      type: 'number',
      describe: 'Example findings to show per verify seam (default 10)',
    })
    .command('analyze', 'Detect the EUL version, read it, and print an assessment report')
    .command('export', 'Export the EUL metadata as normalized JSON')
    .command('validate', 'Validate EUL referential integrity (add --target to reconcile a migration)')
    .command('run', 'Migrate the EUL into a Discoverer Neo Postgres database')
    .command('verify', 'Run the four seam checks against an already-migrated --target (D-070)')
    .demandCommand(1, 'Specify a command: analyze, export, validate, run, or verify')
    .strict()
    .exitProcess(false)
    // Throw parse/validation failures instead of printing to the real console,
    // so runCli owns all output through the injected IO.
    .fail(false)
    .help();
}

function readOptions(parsed: Record<string, unknown>): ReadEulOptions {
  const options: ReadEulOptions = {};
  const owner = parsed.schemaOwner;
  if (typeof owner === 'string' && owner) options.schemaOwner = owner;
  const prefer = parsed.preferVersion;
  if (typeof prefer === 'string' && isEulVersion(prefer)) {
    options.preferVersion = prefer;
  }
  return options;
}

function connectionArgs(parsed: Record<string, unknown>): ConnectionArgs {
  const str = (key: string): string | undefined => {
    const value = parsed[key];
    return typeof value === 'string' ? value : undefined;
  };
  const num = (key: string): number | undefined => {
    const value = parsed[key];
    return typeof value === 'number' ? value : undefined;
  };
  return {
    connection: str('connection'),
    user: str('user'),
    password: str('password'),
    connectString: str('connectString'),
    host: str('host'),
    port: num('port'),
    serviceName: str('serviceName'),
    sid: str('sid'),
    schemaOwner: str('schemaOwner'),
  };
}

/** `--target` as a string, or undefined. Read before the main option block. */
function targetArgOf(parsed: { target?: unknown }): string | undefined {
  return typeof parsed.target === 'string' && parsed.target !== '' ? parsed.target : undefined;
}

function describeError(err: unknown): string {
  if (err instanceof EulDetectionError) return `No EUL detected: ${err.message}`;
  if (err instanceof CliUsageError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Parse argv and run the requested command. Returns a process exit code and
 * never throws; all dependencies are injectable for testing.
 */
export async function runCli(argv: string[], deps: CliDeps = {}): Promise<number> {
  const io = deps.io ?? consoleIO;

  let parsed: Awaited<ReturnType<ReturnType<typeof parseArgs>['parseAsync']>>;
  try {
    parsed = await parseArgs(argv).parseAsync();
  } catch (err) {
    io.err(describeError(err));
    return EXIT_ERROR;
  }

  // `--help` is handled by yargs (it prints usage); with exitProcess(false)
  // parsing still resolves, so short-circuit here instead of falling through
  // to connection building.
  if (parsed.help === true) return EXIT_OK;

  const command = String(parsed._[0] ?? '');
  const readFile =
    deps.readFile ?? (async (path: string) => (await import('node:fs/promises')).readFile(path, 'utf8'));
  const writeFile =
    deps.writeFile ??
    (async (path: string, content: string) =>
      (await import('node:fs/promises')).writeFile(path, content, 'utf8'));

  // `verify` inspects an already-migrated TARGET. It needs no source at all,
  // so it must be handled before the source connection is built — asking an
  // operator for Oracle credentials to read a Postgres database they already
  // have would be nonsense, and on a decommissioned source, impossible.
  if (command === 'verify') {
    let target: ReturnType<typeof createTargetDb>;
    try {
      target = createTargetDb(await loadTargetConfig(targetArgOf(parsed), readFile));
    } catch (err) {
      io.err(describeError(err));
      return EXIT_ERROR;
    }
    try {
      return await commandVerify(
        target.db,
        {
          json: parsed.json === true,
          sampleLimit: typeof parsed.samples === 'number' ? parsed.samples : undefined,
        },
        io,
      );
    } catch (err) {
      io.err(describeError(err));
      return EXIT_ERROR;
    } finally {
      await target.close();
    }
  }

  // Resolve the source: injected (tests) or built from connection details.
  let source: EulSource;
  let builtFromConfig = false;
  if (deps.source !== undefined) {
    source = deps.source;
  } else {
    let config: EulConnectionConfig;
    try {
      config = await loadConnectionConfig(connectionArgs(parsed), readFile);
    } catch (err) {
      io.err(describeError(err));
      return EXIT_ERROR;
    }
    source = deps.makeSource ? deps.makeSource(config) : createExecutor(config);
    builtFromConfig = deps.makeSource === undefined;
  }

  const options = readOptions(parsed);

  // `--version eul4|eul5|auto` overrides EUL auto-detection.
  const versionArg = typeof parsed.version === 'string' ? parsed.version : 'auto';
  const versionOverride: 'auto' | EulVersion =
    versionArg === 'eul4' ? 'EUL4' : versionArg === 'eul5' ? 'EUL5' : 'auto';
  const targetArg = typeof parsed.target === 'string' && parsed.target !== '' ? parsed.target : undefined;

  // The target connection is only opened by the commands that need it.
  // (A cleanup array rather than a nullable local: a `let` assigned only
  // inside the closure below narrows to `never` at the finally block.)
  const writerCleanup: Array<() => Promise<void>> = [];
  const resolveWriter = async (): Promise<MigrationWriter> => {
    if (deps.writer !== undefined) return deps.writer;
    const targetConfig = await loadTargetConfig(targetArg, readFile);
    if (deps.makeWriter) {
      const handle = deps.makeWriter(targetConfig);
      writerCleanup.push(handle.close);
      return handle.writer;
    }
    const target = createTargetDb(targetConfig);
    writerCleanup.push(target.close);
    return createMigrationWriter(target.db);
  };

  const runOptions: RunCommandOptions = {
    readOptions: options,
    version: versionOverride,
    json: parsed.json === true,
    migrationDeps: deps.migrationDeps,
    dataSourceId: typeof parsed['data-source-id'] === 'string' ? parsed['data-source-id'] : undefined,
  };

  try {
    switch (command) {
      case 'analyze':
        return await commandAnalyze(source, { ...options, json: parsed.json === true }, io);
      case 'export': {
        const output = typeof parsed.output === 'string' ? parsed.output : '';
        if (!output) {
          io.err('The export command requires --output <file>.');
          return EXIT_ERROR;
        }
        return await commandExport(source, { ...options, output }, io, writeFile);
      }
      case 'validate':
        // With --target this reconciles a completed migration; without it, the
        // original source-only referential-integrity check.
        if (targetArg !== undefined || deps.writer !== undefined) {
          return await commandValidateMigration(source, await resolveWriter(), runOptions, io);
        }
        return await commandValidate(source, options, io);
      case 'run':
        return await commandRun(
          source,
          await resolveWriter(),
          { ...runOptions, dryRun: parsed.dryRun === true },
          io,
        );
      default:
        io.err(`Unknown command: ${command}`);
        return EXIT_ERROR;
    }
  } catch (err) {
    io.err(describeError(err));
    return EXIT_ERROR;
  } finally {
    // Only the pools this invocation created need draining; an injected source
    // (a mock executor, or a caller-managed one) is the caller's to close.
    if (builtFromConfig) await closeAllPools();
    for (const close of writerCleanup) await close();
  }
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

/**
 * Real entrypoint. Invoked by `src/bin.ts` (the executable); kept out of that
 * file so this module stays import-safe and free of `import.meta` (which the
 * ts-jest transform rejects).
 */
export async function main(): Promise<void> {
  const code = await runCli(hideBin(process.argv));
  process.exitCode = code;
}
