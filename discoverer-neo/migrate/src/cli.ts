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
import { isEulVersion } from './types/eul-versions.js';

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
  writeFile?: (path: string, content: string) => Promise<void>;
  readFile?: (path: string) => Promise<string>;
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

  lines.push(`Migration readiness: ${readiness.score}/100 (${readiness.rating})`);
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

// ---------------------------------------------------------------------------
// Argument parsing + dispatch
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  return yargs(argv)
    .scriptName('dn-migrate')
    .usage('$0 <command> [options]')
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
    .command('analyze', 'Detect the EUL version, read it, and print an assessment report')
    .command('export', 'Export the EUL metadata as normalized JSON')
    .command('validate', 'Validate EUL referential integrity')
    .demandCommand(1, 'Specify a command: analyze, export, or validate')
    .strict()
    .exitProcess(false)
    // Throw parse/validation failures instead of printing to the real console,
    // so runCli owns all output through the injected IO.
    .fail(false)
    .help()
    .version(false);
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
        return await commandValidate(source, options, io);
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
