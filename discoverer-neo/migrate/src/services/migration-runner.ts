/**
 * Migration runner — the full EUL → Discoverer Neo pipeline.
 *
 *   detect version → read EUL → transform → resolve FKs & mint UUIDs →
 *   validate → insert (users → business_areas → folders → items → joins →
 *   hierarchies → hierarchy_levels → custom_functions → maps → map_items →
 *   grants) → post-migration validation.
 *
 * The runner is pure orchestration over two injectable seams — the read side
 * (`EulSource`, a real Oracle executor or a mock) and the write side
 * (`MigrationWriter`, Drizzle over Postgres or an in-memory fake) — plus
 * injectable `genId`/`now`, so a whole migration can run end-to-end in a test
 * with no Oracle and no Postgres.
 *
 * FK resolution: EUL uses integer ids; Neo uses UUIDs. Every source entity is
 * assigned a UUID up front, so a row can reference a parent's UUID regardless
 * of insert order. Objects whose required parent can't be resolved (a NOT NULL
 * FK) are skipped and logged rather than aborting the whole run.
 */

import { randomUUID } from 'node:crypto';

import { validateEulData } from './assessment.js';
import type { ValidationResult } from './assessment.js';
import type { EulReadResult, ReadEulOptions } from './eul-reader.js';
import { readEulSchema } from './eul-reader.js';
import type { EulSource } from './oracle-client.js';
import type { MigrationWriter } from './migration-writer.js';
import {
  buildMapConditionRows,
  buildMapLayoutRow,
  buildMapPageSetupRow,
  buildMapTotalRow,
  defaultAggregateBySourceId,
  mapItemAggFunction,
  transformBusinessArea,
  transformCustomFunction,
  transformFolder,
  transformGrant,
  transformHierarchy,
  transformItem,
  transformJoin,
  transformUser,
  transformWorkbook,
  MIGRATED_USER_PASSWORD_HASH,
  usernameToEmailLocal,
  MIGRATED_EMAIL_DOMAIN,
  type NeoMapType,
  type TransformWarning,
} from './transformers/index.js';
import type { EulVersion, EulVersionInfo } from '../types/eul-versions.js';
import type { CredentialSink, ProvisionedCredential } from './temporary-password.js';
import { generateTemporaryPassword } from './temporary-password.js';
import type { TargetTable } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Options / result types
// ---------------------------------------------------------------------------

export interface MigrationRunnerDeps {
  /** UUID minter (injectable for deterministic tests). */
  genId: () => string;
  /** Clock (injectable for deterministic tests). */
  now: () => Date;
  /**
   * Hashes a temporary password for a provisioned account.
   *
   * Injected rather than imported so this package keeps no crypto dependency
   * and tests stay fast. When absent, migrated accounts are created
   * login-disabled — the safe default, since silently falling back to a
   * guessable or empty credential on a real account would be worse than
   * requiring an admin reset.
   */
  hashPassword?: (plaintext: string) => Promise<string>;
  /**
   * Receives the plaintext temporary passwords so they can be handed to the
   * people who need them.
   *
   * Called ONCE, and only when rows are actually written (never on a dry run).
   * Plaintext deliberately does not travel on `MigrationResult`, which is
   * serialized into API responses and the durable migration log.
   */
  emitCredentials?: CredentialSink;
}

export interface MigrationEvent {
  type: 'log' | 'progress';
  level: 'INFO' | 'WARN' | 'ERROR';
  phase: string;
  message: string;
  /** For progress events over a table. */
  current?: number;
  total?: number;
}

export interface RunMigrationOptions {
  source: EulSource;
  writer: MigrationWriter;
  /** Detector options (schema owner). `version` below drives preferVersion. */
  readOptions?: ReadEulOptions;
  /** Override auto-detection. 'auto' detects; EUL4/EUL5 force that version. */
  version?: 'auto' | EulVersion;
  /** Validate & report without writing anything to the target DB. */
  dryRun?: boolean;
  /** Owner of migrated maps and created_by attribution. */
  migrationUser?: { email?: string; name?: string };
  /**
   * The target `data_sources` row this EUL is being read from, stamped onto
   * every migrated folder.
   *
   * Without it a folder has no database behind it, and
   * `resolveDataSourceId` refuses to execute any map that touches it — so a
   * migration that omits this produces an estate where nothing runs, however
   * good its SQL. The migrator does not create the row: you migrate FROM a
   * data source that already exists in the target.
   */
  dataSourceId?: string;
  onEvent?: (event: MigrationEvent) => void;
  deps?: Partial<MigrationRunnerDeps>;
}

export interface SkipRecord {
  table: TargetTable | 'security_conditions';
  sourceId: number;
  reason: string;
}

export type TableCounts = Record<TargetTable, number>;

export interface TableReconciliation {
  table: TargetTable;
  baseline: number;
  inserted: number;
  expected: number;
  actual: number;
  ok: boolean;
}

export interface MigrationValidationResult {
  valid: boolean;
  reconciliations: TableReconciliation[];
  issues: string[];
}

/**
 * Outcome of the target-side check that runs before anything is read or
 * written. A Discoverer Neo database can hold exactly one migration: the
 * migrator mints a service account with a fixed address, and every migrated
 * user gets a synthesized `@migrated.local` email, so a second run collides on
 * `users_email_unique` the moment it writes its first row.
 */
export interface TargetPreflight {
  /** True when the target already holds a migration (blocks a real run). */
  alreadyMigrated: boolean;
  /** Operator-facing explanation, set only when `alreadyMigrated`. */
  message: string | null;
}

export interface MigrationResult {
  runId: string | null;
  dryRun: boolean;
  version: EulVersionInfo;
  /** Rows the runner intended to insert per table. */
  planned: TableCounts;
  /** Rows actually inserted per table (all zero for a dry run). */
  inserted: TableCounts;
  skipped: SkipRecord[];
  warnings: TransformWarning[];
  /** Referential-integrity check of the *source* EUL data. */
  sourceValidation: ValidationResult;
  /** Post-insert count reconciliation (absent on a dry run). */
  validation?: MigrationValidationResult;
  /** Synthetic objects the runner created (e.g. the workbook-host BA, users). */
  syntheticBusinessAreas: number;
  migrationUserEmail: string;
  /**
   * Target-side check. A real run throws when this is blocked; a dry run
   * completes and reports it, so "the dry run passed" can never mean "the real
   * run will succeed" when the target is already migrated.
   */
  preflight: TargetPreflight;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Target tables in insert (dependency) order. */
export const TARGET_TABLE_ORDER: readonly TargetTable[] = [
  'users',
  'business_areas',
  'folders',
  'folder_business_areas',
  'items',
  'joins',
  'join_predicates',
  'hierarchies',
  'hierarchy_levels',
  'custom_functions',
  'maps',
  'map_items',
  'map_conditions',
  'map_parameters',
  'map_calculated_fields',
  'map_layouts',
  'map_totals',
  'map_page_setup',
  'map_conditional_formats',
  'user_business_area_grants',
];

const EMPTY_COUNTS = (): TableCounts => ({
  users: 0,
  business_areas: 0,
  folders: 0,
  folder_business_areas: 0,
  items: 0,
  joins: 0,
  join_predicates: 0,
  hierarchies: 0,
  hierarchy_levels: 0,
  custom_functions: 0,
  maps: 0,
  map_items: 0,
  map_conditions: 0,
  map_parameters: 0,
  map_calculated_fields: 0,
  map_layouts: 0,
  map_totals: 0,
  map_page_setup: 0,
  map_conditional_formats: 0,
  user_business_area_grants: 0,
});

/** Raised when the insert transaction fails; the run has been rolled back. */
export class MigrationRunError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MigrationRunError';
    this.cause = cause;
  }
}

interface PgErrorFields {
  code?: string;
  constraint?: string;
  detail?: string;
}

/**
 * Postgres puts `code`/`constraint`/`detail` on the driver error, but Drizzle
 * wraps that in its own Error and hangs the original off `cause` — so the
 * fields have to be found by walking the cause chain, not read off the top.
 */
function findPgErrorFields(err: unknown): PgErrorFields {
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth += 1) {
    if (current === null || typeof current !== 'object') break;
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      detail?: unknown;
      cause?: unknown;
    };
    if (typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
        detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
      };
    }
    current = candidate.cause;
  }
  return {};
}

const MAX_FAILURE_MESSAGE = 400;

/**
 * Strip a driver-level write failure down to something safe to log.
 *
 * Drizzle's message embeds the failing statement *and every bound parameter*
 * ("params: …"), which would put migrated row values — user names, emails,
 * password hashes, whole report titles — into the durable `migration_log` and
 * onto the operator's terminal. Those are cut here; callers get the statement
 * shape and nothing else.
 *
 * Exported on its own because the maps-only re-import needs exactly this half
 * and none of `describeWriteFailure`'s advice below, which is specific to a
 * full run.
 */
export function sanitizeWriteFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const withoutParams = raw.split(/\r?\nparams:/)[0] ?? raw;
  return withoutParams.length > MAX_FAILURE_MESSAGE
    ? `${withoutParams.slice(0, MAX_FAILURE_MESSAGE)}…`
    : withoutParams;
}

/**
 * Turn a driver-level write failure into something an operator can act on: the
 * sanitized message plus what a *full migration* should do about it.
 */
export function describeWriteFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const message = sanitizeWriteFailure(err);

  const pg = findPgErrorFields(err);
  const isUniqueViolation = pg.code === '23505' || /duplicate key value/i.test(raw);
  const rolledBack = 'Nothing was written: the transaction was rolled back.';

  if (isUniqueViolation) {
    const target = pg.constraint ? ` (constraint ${pg.constraint})` : '';
    const detail = pg.detail ? ` ${pg.detail}` : '';
    return (
      `${message}${target}.${detail} This usually means the target database already contains ` +
      'a migration — the migrator expects a fresh Discoverer Neo database. Migrate into an ' +
      `empty database, or remove the previous migration, then run again. ${rolledBack}`
    );
  }
  return `${message}. ${rolledBack}`;
}

/**
 * Explain a blocked target. Says what was found and what to do about it —
 * re-running over an existing migration would duplicate every business area,
 * folder and item even if the unique constraint let it through.
 */
export function describeAlreadyMigrated(email: string): string {
  return (
    `The target database already contains a migration: its service account ` +
    `"${email}" is present. Discoverer Neo holds one migration per database — ` +
    `running a second one over it would duplicate every business area, folder ` +
    `and item, so it is refused. Migrate into a fresh database, or clear the ` +
    `previous migration first.`
  );
}

/** Case-insensitive username key. */
function ukey(username: string): string {
  return username.trim().toUpperCase();
}

/** Make `name` unique within `used`, suffixing " (2)", " (3)", … as needed. */
/**
 * Key for the (folder, item) name index the workbook bodies resolve against.
 *
 * Case-insensitive and whitespace-normalized: the workbook stores the label as
 * it was when the report was saved, and an EUL edit since then may differ only
 * in casing or spacing. Matching on that would drop a column for a cosmetic
 * difference.
 */
function itemLabelKey(folderName: string, itemName: string): string {
  const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
  return `${norm(folderName)}\u0000${norm(itemName)}`;
}

function uniquify(name: string, used: Set<string>): string {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }
  let n = 2;
  let candidate = `${name} (${n})`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${name} (${n})`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Order items so a parent always precedes its children (self-FK safety). */
function orderItemsByParent<T extends { sourceId: number; parentItemSourceId: number | null }>(
  items: T[],
): T[] {
  const bySource = new Map<number, T>(items.map((i) => [i.sourceId, i]));
  const depthCache = new Map<number, number>();
  const depthOf = (item: T, seen: Set<number>): number => {
    const cached = depthCache.get(item.sourceId);
    if (cached !== undefined) return cached;
    const parentId = item.parentItemSourceId;
    let depth = 0;
    if (parentId !== null && bySource.has(parentId) && !seen.has(parentId)) {
      seen.add(item.sourceId);
      depth = depthOf(bySource.get(parentId)!, seen) + 1;
    }
    depthCache.set(item.sourceId, depth);
    return depth;
  };
  return [...items].sort((a, b) => depthOf(a, new Set()) - depthOf(b, new Set()));
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runMigration(options: RunMigrationOptions): Promise<MigrationResult> {
  const startedAt = Date.now();
  const deps: MigrationRunnerDeps = {
    genId: options.deps?.genId ?? (() => randomUUID()),
    now: options.deps?.now ?? (() => new Date()),
    // Optional: absent hashPassword means accounts stay login-disabled, which
    // is the safe default rather than a silently weak credential.
    hashPassword: options.deps?.hashPassword,
    emitCredentials: options.deps?.emitCredentials,
  };
  const dryRun = options.dryRun === true;
  const runId = dryRun ? null : deps.genId();
  const writer = options.writer;

  const warnings: TransformWarning[] = [];
  const skipped: SkipRecord[] = [];
  const planned = EMPTY_COUNTS();
  const inserted = EMPTY_COUNTS();

  const emit = async (
    level: MigrationEvent['level'],
    phase: string,
    message: string,
    sourceId?: number,
  ): Promise<void> => {
    options.onEvent?.({ type: 'log', level, phase, message });
    if (!dryRun && runId) {
      await writer.log({ runId, level, phase, message, sourceId: sourceId ?? null });
    }
  };
  const progress = (phase: string, current: number, total: number): void => {
    options.onEvent?.({ type: 'progress', level: 'INFO', phase, message: `${current}/${total}`, current, total });
  };
  const collect = (ws: TransformWarning[]): void => {
    for (const w of ws) warnings.push(w);
  };

  // --- 0. schema + target preflight -----------------------------------------
  if (!dryRun) await writer.ensureSchema();

  // Identify the service account before anything else: it is both the owner of
  // every migrated map and the marker of a target that has already been
  // migrated.
  const migrationEmail = options.migrationUser?.email ?? `migration@${MIGRATED_EMAIL_DOMAIN}`;
  const migrationName = options.migrationUser?.name ?? 'Migration Service';

  // Read the target's addresses up front. Two jobs: detect a target that has
  // already been migrated, and seed the collision set so a synthesized email
  // can never land on an address the database already holds.
  const usedEmails = new Set<string>(await writer.existingUserEmails());
  const alreadyMigrated = usedEmails.has(migrationEmail.toLowerCase());
  const preflight: TargetPreflight = {
    alreadyMigrated,
    message: alreadyMigrated ? describeAlreadyMigrated(migrationEmail) : null,
  };

  if (preflight.message !== null) {
    await emit('ERROR', 'preflight', preflight.message);
    // A real run stops here rather than reading the whole EUL, transforming it
    // and hashing a password per account, only to be rejected by the first
    // INSERT. A dry run carries on and reports it: its whole job is to tell an
    // operator whether the real run would work.
    if (!dryRun) throw new MigrationRunError(preflight.message);
  }

  // --- 0b. read -------------------------------------------------------------
  const readOptions: ReadEulOptions = { ...options.readOptions };
  if (options.version && options.version !== 'auto') {
    readOptions.preferVersion = options.version;
  }

  await emit('INFO', 'read', 'Detecting EUL version and reading source metadata…');
  const eul: EulReadResult = await readEulSchema(options.source, readOptions);
  const version = eul.version;

  if (options.version && options.version !== 'auto' && options.version !== version.version) {
    await emit(
      'WARN',
      'read',
      `Requested version ${options.version} but detected ${version.version}; proceeding with the detected version.`,
    );
  }
  await emit('INFO', 'read', `Source is ${version.version} (Discoverer ${version.discovererVersion}).`);

  const sourceValidation = validateEulData(eul);
  for (const issue of sourceValidation.issues) {
    await emit(issue.severity === 'error' ? 'ERROR' : 'WARN', 'validate', `${issue.code}: ${issue.message}`);
  }

  // --- ID maps --------------------------------------------------------------
  const userIdByUsername = new Map<string, string>();
  const baIdBySource = new Map<number, string>();
  const folderIdBySource = new Map<number, string>();
  const folderBaSource = new Map<number, number>(); // folder sourceId → BA sourceId
  const itemIdBySource = new Map<number, string>();
  const itemFolderUuid = new Map<number, string>(); // item sourceId → its folder UUID
  const hierarchyIdBySource = new Map<number, string>();

  const usedBaNames = new Set<string>();

  // --- 1. users -------------------------------------------------------------
  const migrationUserId = deps.genId();
  usedEmails.add(migrationEmail.toLowerCase());

  const userRows: Record<string, unknown>[] = [
    {
      id: migrationUserId,
      email: migrationEmail,
      // The service account exists only for created_by attribution and map
      // ownership. Nobody signs in as it, so it gets no credential and has
      // nothing to rotate.
      passwordHash: MIGRATED_USER_PASSWORD_HASH,
      isRole: false,
      mustChangePassword: false,
      name: migrationName,
      role: 'USER',
      createdAt: deps.now(),
      updatedAt: deps.now(),
    },
  ];

  /** Plaintext temp passwords. Handed to the sink; never returned or logged. */
  const provisioned: ProvisionedCredential[] = [];

  for (const eulUser of eul.data.users) {
    const t = transformUser(eulUser, version.version);
    collect(t.warnings);
    const key = ukey(t.username);
    if (userIdByUsername.has(key)) continue; // reader already dedups, belt-and-braces
    let email = t.email;
    if (usedEmails.has(email.toLowerCase())) {
      // Two usernames collided to the same synthesized email: disambiguate.
      email = `${usernameToEmailLocal(t.username)}.${userIdByUsername.size}@${MIGRATED_EMAIL_DOMAIN}`;
    }
    usedEmails.add(email.toLowerCase());
    const id = deps.genId();
    userIdByUsername.set(key, id);

    // Provision a temporary credential for real people. Roles never get one —
    // they exist to hold grants, not to be signed into.
    let passwordHash = t.passwordHash;
    let mustChangePassword = false;
    if (!t.isRole && deps.hashPassword) {
      const temporaryPassword = generateTemporaryPassword();
      passwordHash = await deps.hashPassword(temporaryPassword);
      mustChangePassword = true;
      provisioned.push({ username: t.username, email, temporaryPassword });
    }

    userRows.push({
      id,
      email,
      passwordHash,
      isRole: t.isRole,
      mustChangePassword,
      name: t.name,
      role: t.role,
      createdAt: deps.now(),
      updatedAt: deps.now(),
    });
  }
  planned.users = userRows.length;
  await emit(
    'INFO',
    'users',
    provisioned.length > 0
      ? `${provisioned.length} account(s) provisioned with a temporary password, each forced to change it at first login.`
      : 'Migrated users are login-disabled until an admin resets their password.',
  );

  const resolveUser = (username: string | null): string | null =>
    username ? (userIdByUsername.get(ukey(username)) ?? null) : null;

  // --- 2. business areas ----------------------------------------------------
  const baRows: Record<string, unknown>[] = [];
  for (const eulBa of eul.data.businessAreas) {
    const t = transformBusinessArea(eulBa, version.version);
    collect(t.warnings);
    const id = deps.genId();
    baIdBySource.set(t.sourceId, id);
    baRows.push({
      id,
      name: uniquify(t.name, usedBaNames),
      description: t.description,
      createdBy: resolveUser(t.createdByUsername),
      updatedBy: resolveUser(t.updatedByUsername),
      createdAt: t.createdAt ?? deps.now(),
      updatedAt: t.updatedAt ?? deps.now(),
      isActive: t.isActive,
    });
  }

  // Synthetic host BA for workbook-maps (workbooks have no BA of their own).
  let workbookBaId: string | null = null;
  let syntheticBusinessAreas = 0;
  if (eul.data.workbooks.length > 0) {
    workbookBaId = deps.genId();
    syntheticBusinessAreas = 1;
    baRows.push({
      id: workbookBaId,
      name: uniquify('Migrated Workbooks', usedBaNames),
      description:
        'Auto-created to host the maps migrated from Discoverer workbooks. ' +
        'Discoverer workbooks belong to no business area, so their worksheets land here.',
      createdBy: migrationUserId,
      updatedBy: migrationUserId,
      createdAt: deps.now(),
      updatedAt: deps.now(),
      isActive: true,
    });
  }
  planned.business_areas = baRows.length;

  // --- 3. folders -----------------------------------------------------------
  const folderRows: Record<string, unknown>[] = [];
  for (const eulFolder of eul.data.folders) {
    const t = transformFolder(eulFolder, version.version);
    collect(t.warnings);
    const baId = t.businessAreaSourceId !== null ? baIdBySource.get(t.businessAreaSourceId) : undefined;
    if (!baId) {
      skipped.push({ table: 'folders', sourceId: t.sourceId, reason: 'no resolvable business area (Neo requires one)' });
      await emit('ERROR', 'folders', `Folder "${t.name}" (${t.sourceId}) skipped: no business area.`, t.sourceId);
      continue;
    }
    const id = deps.genId();
    folderIdBySource.set(t.sourceId, id);
    if (t.businessAreaSourceId !== null) folderBaSource.set(t.sourceId, t.businessAreaSourceId);
    folderRows.push({
      id,
      businessAreaId: baId,
      dataSourceId: options.dataSourceId ?? null,
      name: t.name,
      description: t.description,
      folderType: t.folderType,
      tableName: t.tableName,
      tableOwner: t.tableOwner,
      customSql: t.customSql,
      displayOrder: t.displayOrder,
      isActive: t.isActive,
      createdBy: resolveUser(t.createdByUsername),
      createdAt: t.createdAt ?? deps.now(),
      updatedAt: t.updatedAt ?? deps.now(),
    });
  }
  planned.folders = folderRows.length;

  // Loud, because the consequence is invisible until someone opens a map: no
  // data source means no database to send the query to, and every map that
  // touches these folders fails at execution with "no data source configured".
  if (options.dataSourceId === undefined && folderRows.length > 0) {
    warnings.push({
      code: 'FOLDERS_WITHOUT_DATA_SOURCE',
      message:
        `No dataSourceId was supplied, so all ${folderRows.length} folder(s) migrate with ` +
        `no data source. Every map built on them will refuse to execute until ` +
        `folders.data_source_id is set.`,
    });
    await emit(
      'WARN',
      'folders',
      `${folderRows.length} folder(s) have no data source; maps on them cannot execute.`,
    );
  }

  // A folder shared across business areas (EUL BA_OBJ_LINKS is many-to-many)
  // keeps its owning area on folders.business_area_id; the rest are recorded
  // here so the folder is reachable from every area it belonged to.
  const folderShareRows: Record<string, unknown>[] = [];
  for (const eulFolder of eul.data.folders) {
    const folderId = folderIdBySource.get(eulFolder.sourceId);
    const owning = folderBaSource.get(eulFolder.sourceId);
    if (!folderId) continue;
    for (const baSourceId of eulFolder.sharedBusinessAreaIds) {
      if (baSourceId === owning) continue;
      const baId = baIdBySource.get(baSourceId);
      if (!baId) {
        skipped.push({
          table: 'folder_business_areas',
          sourceId: eulFolder.sourceId,
          reason: `shared business area ${baSourceId} was not migrated`,
        });
        continue;
      }
      folderShareRows.push({ folderId, businessAreaId: baId, createdAt: deps.now() });
    }
  }
  planned.folder_business_areas = folderShareRows.length;
  if (folderShareRows.length > 0) {
    await emit(
      'INFO',
      'folders',
      `${folderShareRows.length} folder/business-area share(s) preserved from BA_OBJ_LINKS.`,
    );
  }

  // --- 4. items (plain/calculated CI-CU + conditions CO) --------------------
  // `EXP_ID` → Default aggregate, for §8's map columns. Built from the EUL
  // rather than from `itemRows` because a map column names its item by
  // `EXP_ID`, which is the key the EUL read still has.
  const defaultAggregates = defaultAggregateBySourceId(eul.data.items);
  const transformedItems = [...eul.data.items, ...eul.data.conditions].map((it) =>
    transformItem(it, version.version),
  );
  const itemRowsBySource = new Map<number, Record<string, unknown>>();
  const orderedItems = orderItemsByParent(transformedItems);
  const itemRows: Record<string, unknown>[] = [];
  for (const t of orderedItems) {
    collect(t.warnings);
    if (t.skip) {
      skipped.push({ table: 'items', sourceId: t.sourceId, reason: `unmapped EXP_TYPE` });
      continue;
    }
    const folderId = t.folderSourceId !== null ? folderIdBySource.get(t.folderSourceId) : undefined;
    if (!folderId) {
      skipped.push({ table: 'items', sourceId: t.sourceId, reason: 'folder not migrated' });
      await emit('WARN', 'items', `Item "${t.name}" (${t.sourceId}) skipped: folder not migrated.`, t.sourceId);
      continue;
    }
    const id = deps.genId();
    itemIdBySource.set(t.sourceId, id);
    itemFolderUuid.set(t.sourceId, folderId);
    const row: Record<string, unknown> = {
      id,
      folderId,
      name: t.name,
      description: t.description,
      itemType: t.itemType,
      columnName: t.columnName,
      formula: t.formula,
      dataType: t.dataType,
      formatMask: t.formatMask,
      aggFunction: t.aggFunction,
      displayOrder: t.displayOrder,
      isHidden: t.isHidden,
      isActive: t.isActive,
      parentItemId: null, // filled in a second pass once all item UUIDs exist
      createdBy: resolveUser(t.createdByUsername),
      createdAt: t.createdAt ?? deps.now(),
      updatedAt: t.updatedAt ?? deps.now(),
    };
    itemRowsBySource.set(t.sourceId, row);
    itemRows.push(row);
  }
  // Resolve self-referential parents now that every item UUID is known.
  for (const t of orderedItems) {
    if (t.skip || t.parentItemSourceId === null) continue;
    const row = itemRowsBySource.get(t.sourceId);
    if (!row) continue;
    const parentUuid = itemIdBySource.get(t.parentItemSourceId);
    if (parentUuid) row.parentItemId = parentUuid;
    else {
      warnings.push({
        code: 'ITEM_PARENT_UNRESOLVED',
        message: `Item ${t.sourceId} parent ${t.parentItemSourceId} was not migrated; parent link dropped.`,
        sourceId: t.sourceId,
      });
    }
  }
  planned.items = itemRows.length;

  // Security Manager conditions (EUL5 EXP_TYPE='SM') have no Neo item type —
  // they correspond to row-level security policies, which are configured in Neo
  // rather than migrated automatically. Report them so they are not silently
  // dropped: losing a security rule quietly is the worst failure mode here.
  for (const sm of eul.data.securityConditions) {
    collect(transformItem(sm, version.version).warnings);
    skipped.push({
      table: 'security_conditions',
      sourceId: sm.sourceId,
      reason: 'Security Manager condition — recreate as a Neo row-level security policy',
    });
  }
  if (eul.data.securityConditions.length > 0) {
    await emit(
      'WARN',
      'security',
      `${eul.data.securityConditions.length} Security Manager condition(s) were NOT migrated. ` +
        'Recreate them as Discoverer Neo row-level security policies before granting access.',
    );
  }

  // --- 5. joins --------------------------------------------------------------
  // A EUL join (KEY_CONS) binds two FOLDERS; item-level keys are optional.
  // Neo's joins table matches that shape, so the folders drive the row and the
  // items only fill in when the source actually carried them.
  const joinRows: Record<string, unknown>[] = [];
  const joinPredicateRows: Record<string, unknown>[] = [];
  // A workbook's `0x0118` join reference (§7.8.9) names this same EUL join id,
  // so a worksheet's `Join Usage` resolves against this index once it is
  // built — a join that failed to migrate (folder(s) not migrated, skipped
  // below) simply has no entry, and the workbook reference stays unresolved.
  // An array because a join with item-level components explodes into one row
  // per component; today `readJoins` never populates components, so it is
  // always a singleton, but the reference is kept plural rather than assume
  // that stays true.
  const joinIdsBySourceId = new Map<number, string[]>();
  for (const eulJoin of eul.data.joins) {
    const t = transformJoin(eulJoin, version.version);
    collect(t.warnings);

    const leftFolderId =
      t.leftFolderSourceId !== null ? folderIdBySource.get(t.leftFolderSourceId) : undefined;
    const rightFolderId =
      t.rightFolderSourceId !== null ? folderIdBySource.get(t.rightFolderSourceId) : undefined;
    if (!leftFolderId || !rightFolderId) {
      skipped.push({
        table: 'joins',
        sourceId: t.sourceId,
        reason: 'join folder(s) not migrated',
      });
      continue;
    }

    // ONE row per EUL join. Until Phase 3.2 a multi-component join exploded
    // into one `joins` row per component, because Neo could only hold a single
    // item pair — which turned one three-column join into three separate
    // two-folder joins, each with a third of the condition. The components now
    // live in `join_predicates` and the join stays one join.
    const joinId = deps.genId();
    joinRows.push({
      id: joinId,
      name: t.name,
      leftFolderId,
      rightFolderId,
      oneToOne: t.oneToOne,
      allowMasterNoDetail: t.allowMasterNoDetail,
      allowDetailNoMaster: t.allowDetailNoMaster,
      mandatory: t.mandatory,
      predicateFormula: t.predicateFormula,
      isActive: t.isActive,
      createdAt: t.createdAt ?? deps.now(),
    });

    // Every component becomes a row, including one whose item did not migrate.
    // A missing row would shorten the emitted `ON` clause and return MORE rows
    // than the source did; a null endpoint refuses instead (D-058).
    for (const comp of t.components) {
      joinPredicateRows.push({
        id: deps.genId(),
        joinId,
        seq: comp.sequence,
        leftItemId:
          comp.leftItemSourceId !== null
            ? (itemIdBySource.get(comp.leftItemSourceId) ?? null)
            : null,
        rightItemId:
          comp.rightItemSourceId !== null
            ? (itemIdBySource.get(comp.rightItemSourceId) ?? null)
            : null,
        operator: comp.operator,
        createdAt: t.createdAt ?? deps.now(),
      });
    }

    joinIdsBySourceId.set(t.sourceId, [joinId]);
  }
  planned.joins = joinRows.length;
  planned.join_predicates = joinPredicateRows.length;

  // --- 6. hierarchies + levels ----------------------------------------------
  const hierarchyRows: Record<string, unknown>[] = [];
  const levelRows: Record<string, unknown>[] = [];
  for (const eulHier of eul.data.hierarchies) {
    const t = transformHierarchy(eulHier, version.version);
    collect(t.warnings);
    const baId = t.businessAreaSourceId !== null ? baIdBySource.get(t.businessAreaSourceId) : undefined;
    if (!baId) {
      skipped.push({ table: 'hierarchies', sourceId: t.sourceId, reason: 'no resolvable business area' });
      await emit('WARN', 'hierarchies', `Hierarchy "${t.name}" (${t.sourceId}) skipped: no business area.`, t.sourceId);
      continue;
    }
    const id = deps.genId();
    hierarchyIdBySource.set(t.sourceId, id);
    hierarchyRows.push({
      id,
      name: t.name,
      description: t.description,
      businessAreaId: baId,
      isActive: t.isActive,
      createdAt: t.createdAt ?? deps.now(),
      updatedAt: t.updatedAt ?? deps.now(),
    });
    // Levels are a TREE (EUL: HI_SEGMENTS), so every node gets a UUID first and
    // the parent link is resolved in a second pass — a child can precede its
    // parent in read order.
    const levelIdBySource = new Map<number, string>();
    for (const lvl of t.levels) levelIdBySource.set(lvl.sourceId, deps.genId());

    for (const lvl of t.levels) {
      const itemId = lvl.itemSourceId !== null ? itemIdBySource.get(lvl.itemSourceId) : undefined;
      if (lvl.itemSourceId !== null && !itemId) {
        // The node names an item that was not migrated — keep the level so the
        // drill path stays intact, but say the item is missing.
        warnings.push({
          code: 'HIER_LEVEL_ITEM_UNRESOLVED',
          message: `Hierarchy level "${lvl.levelName}" references item ${lvl.itemSourceId}, which was not migrated; the level was kept without an item.`,
          sourceId: lvl.sourceId,
        });
      }
      levelRows.push({
        id: levelIdBySource.get(lvl.sourceId),
        hierarchyId: id,
        levelName: lvl.levelName,
        // Nullable in Neo: a level with no resolvable item is still a real
        // step in the drill path and must not disappear.
        itemId: itemId ?? null,
        levelNumber: lvl.levelNumber,
        parentLevelId:
          lvl.parentSourceId !== null
            ? (levelIdBySource.get(lvl.parentSourceId) ?? null)
            : null,
      });
    }
  }
  planned.hierarchies = hierarchyRows.length;
  planned.hierarchy_levels = levelRows.length;

  // --- 7. custom functions --------------------------------------------------
  const functionRows: Record<string, unknown>[] = [];
  for (const eulFn of eul.data.customFunctions) {
    const t = transformCustomFunction(eulFn, version.version);
    collect(t.warnings);
    functionRows.push({
      id: deps.genId(),
      name: t.name,
      description: t.description,
      functionType: t.functionType,
      parameters: t.parameters,
      returnType: t.returnType,
      isActive: t.isActive,
    });
  }
  planned.custom_functions = functionRows.length;

  // --- 8. maps (from workbook worksheets) + items/conditions/params/calcs ---
  //
  // A workbook column names its item by EUL EXP_ID, which `itemIdBySource`
  // already resolves. The (folder name, item name) index built here is the
  // fallback for the rare column that records no id — see `TransformedMapItem`.
  const folderNameById = new Map<string, string>();
  for (const row of folderRows) {
    folderNameById.set(row.id as string, row.name as string);
  }
  const itemIdByLabel = new Map<string, string>();
  for (const row of itemRows) {
    const folderName = folderNameById.get(row.folderId as string);
    if (folderName === undefined) continue;
    const key = itemLabelKey(folderName, row.name as string);
    // First writer wins: duplicate labels within a folder are possible in a
    // hand-edited EUL, and picking the first keeps the mapping deterministic.
    if (!itemIdByLabel.has(key)) itemIdByLabel.set(key, row.id as string);
  }

  const mapRows: Record<string, unknown>[] = [];
  const mapItemRows: Record<string, unknown>[] = [];
  const mapConditionRows: Record<string, unknown>[] = [];
  const mapParameterRows: Record<string, unknown>[] = [];
  const mapCalculatedFieldRows: Record<string, unknown>[] = [];
  const mapTotalRows: Record<string, unknown>[] = [];
  const mapPageSetupRows: Record<string, unknown>[] = [];
  const mapLayoutRows: Record<string, unknown>[] = [];
  const usedMapNames = new Set<string>();
  let unresolvedMapItems = 0;
  let unresolvedMapConditions = 0;
  /** Join usage (§7.8.9) naming a EUL join that did not migrate. */
  let unresolvedMapJoins = 0;
  /** Totals dropped because the column they aggregate did not migrate. */
  let unresolvedMapTotals = 0;
  let migratedWorksheets = 0;

  for (const eulWb of eul.data.workbooks) {
    const worksheetMaps = transformWorkbook(eulWb, version.version);
    migratedWorksheets += eulWb.document.worksheets.length;

    for (const t of worksheetMaps) {
      collect(t.warnings);
      if (!workbookBaId) continue; // unreachable (set when workbooks exist), defensive
      const mapId = deps.genId();
      const owner = resolveUser(t.ownerUsername) ?? migrationUserId;
      mapRows.push({
        id: mapId,
        // Two worksheets in different workbooks can share a name; Neo has no
        // unique index on maps.name, but a duplicate is unusable in a picker,
        // so names are disambiguated the same way business-area names are.
        name: uniquify(t.name, usedMapNames),
        description: t.description,
        mapType: t.mapType satisfies NeoMapType,
        businessAreaId: workbookBaId,
        createdBy: owner,
        isPublic: t.isPublic,
        isActive: true,
        selectDistinct: t.selectDistinct,
        createdAt: t.createdAt ?? deps.now(),
        updatedAt: t.updatedAt ?? deps.now(),
      });

      // `map_totals` points at `map_items` / `map_calculated_fields` rows, not
      // at EUL items, so the ids have to be captured as those rows are pushed.
      // A column whose item did not resolve never enters this index, and the
      // total that names it is dropped below rather than left dangling.
      const mapItemIdByOrder = new Map<number, string>();
      const calculatedFieldIdByOrder = new Map<number, string>();

      for (const mi of t.items) {
        // A calculation column has no EUL item behind it — it is carried by
        // the map's calculated fields instead, so it is not an unresolved
        // reference and must not be counted as one.
        if (mi.isCalculation) continue;
        // EXP_ID first — it is exact, and survives a rename in the EUL. The
        // label pair is the fallback for a column that records no id.
        const itemId =
          (mi.itemSourceId !== null ? itemIdBySource.get(mi.itemSourceId) : undefined) ??
          (mi.folderLabel !== null && mi.itemLabel !== null
            ? itemIdByLabel.get(itemLabelKey(mi.folderLabel, mi.itemLabel))
            : undefined);
        if (!itemId) {
          unresolvedMapItems += 1;
          skipped.push({
            table: 'map_items',
            sourceId: t.sourceId,
            reason: `${mi.isHidden ? 'query item' : 'column'} ` +
              `"${mi.folderLabel ?? '?'}.${mi.itemLabel ?? '?'}" is not a migrated item`,
          });
          continue;
        }
        const mapItemId = deps.genId();
        mapItemIdByOrder.set(mi.displayOrder, mapItemId);
        mapItemRows.push({
          id: mapItemId,
          mapId,
          itemId,
          displayOrder: mi.displayOrder,
          displayName: mi.displayName,
          formatMask: mi.formatMask,
          // The workbook's measure vector meeting the EUL's Default aggregate
          // — see `mapItemAggFunction`. Null on every axis column, and on any
          // measure whose item resolves to `Detail` or to no default at all.
          aggFunction: mapItemAggFunction(mi, defaultAggregates),
          axisType: mi.axisType,
          axisOrder: mi.axisOrder,
          isHidden: mi.isHidden,
          // Sorting (§7.8.6). `sort_rank` stays null: `d4wkdmp` never prints
          // `DCBImportedItemSort::GetRank`, so nothing confirms a value for it.
          sortDirection: mi.sortDirection,
          sortOrder: mi.sortOrder,
          sortGroup: mi.sortGroup,
          // Item format (§7.8.8). `alignment` is always null — see `TransformedMapItem`.
          columnWidth: mi.columnWidth,
          dataType: mi.dataType,
          headingFormatMask: mi.headingFormatMask,
          alignment: mi.alignment,
          wordWrap: mi.wordWrap,
          sourceElementId: mi.sourceElementId,
          sourceAttrs: mi.sourceAttrs,
        });
      }

      // A condition Neo cannot express never reaches here — `transformWorkbook`
      // drops it with a warning. What is left can still fail to resolve to a
      // migrated item, and then the whole source condition goes, not part of it.
      const conditionRows = buildMapConditionRows(
        t.conditions,
        mapId,
        (cond) =>
          (cond.itemSourceId !== null ? itemIdBySource.get(cond.itemSourceId) : undefined) ??
          (cond.folderLabel !== null && cond.itemLabel !== null
            ? itemIdByLabel.get(itemLabelKey(cond.folderLabel, cond.itemLabel))
            : undefined),
        deps.genId,
      );
      mapConditionRows.push(...conditionRows.rows);
      for (const { reason } of conditionRows.skipped) {
        unresolvedMapConditions += 1;
        skipped.push({ table: 'map_conditions', sourceId: t.sourceId, reason });
      }

      // Neo has no unique index on (map_id, name) for parameters, but a
      // workbook can define the same prompt twice; deduping keeps the map's
      // parameter list usable. (It does have one on (map_id, bind_name), and a
      // repeated prompt shares its bind name — so writing both rows would fail
      // the insert outright, not merely look untidy.)
      const seenParameters = new Set<string>();
      for (const parameter of t.parameters) {
        const key = parameter.name.toLowerCase();
        if (seenParameters.has(key)) continue;
        seenParameters.add(key);
        mapParameterRows.push({
          id: deps.genId(),
          mapId,
          name: parameter.name,
          bindName: parameter.bindName,
          paramType: parameter.paramType,
          defaultValue: parameter.defaultValue,
          isRequired: parameter.isRequired,
        });
      }

      for (const calc of t.calculatedFields) {
        if (calc.formula === '') continue;
        const calculatedFieldId = deps.genId();
        calculatedFieldIdByOrder.set(calc.displayOrder, calculatedFieldId);
        mapCalculatedFieldRows.push({
          id: calculatedFieldId,
          mapId,
          name: calc.name,
          formula: calc.formula,
          displayOrder: calc.displayOrder,
          axisType: calc.axisType,
          isHidden: calc.isHidden,
        });
      }

      // Totals (§7.8.7). Written after the two tables they reference, from the
      // ids captured above — identical here and in `map-reimport.ts`.
      for (const total of t.totals) {
        const row = buildMapTotalRow(
          total,
          mapId,
          deps.genId(),
          mapItemIdByOrder,
          calculatedFieldIdByOrder,
        );
        if (row === null) {
          unresolvedMapTotals += 1;
          skipped.push({
            table: 'map_totals',
            sourceId: t.sourceId,
            reason:
              `total ${JSON.stringify(total.label ?? '')} aggregates a column that did ` +
              'not migrate',
          });
          continue;
        }
        mapTotalRows.push(row);
      }

      // Page setup (§7.8.12) — one row per map, all carrying the workbook's
      // single page-setup element; identical here and in `map-reimport.ts`.
      if (t.pageSetup !== null) {
        mapPageSetupRows.push(buildMapPageSetupRow(t.pageSetup, mapId, deps.genId()));
      }

      // Join usage (§7.8.9) — no `map_joins` table exists, so a worksheet's
      // forced joins are recorded as `map_layouts.source_attrs`, the one
      // column W3 added with nowhere better for them to live. Each join
      // reference is resolved against the joins this same run just migrated;
      // one that named a join that did not migrate keeps its raw fields with
      // `joinIds: null` rather than being dropped.
      const joinAttrs = t.joins.map((join) => {
        const joinIds =
          join.eulJoinSourceId !== null
            ? (joinIdsBySourceId.get(join.eulJoinSourceId) ?? null)
            : null;
        if (joinIds === null) unresolvedMapJoins += 1;
        return {
          sourceElementId: join.sourceElementId,
          eulJoinSourceId: join.eulJoinSourceId,
          identifier: join.identifier,
          name: join.name,
          owningFolderIdentifier: join.owningFolderIdentifier,
          owningFolderName: join.owningFolderName,
          joinIds,
        };
      });
      // One row per map, not one per map that forced a join: the worksheet's
      // index, GUID and printed title live here and nowhere else.
      mapLayoutRows.push(buildMapLayoutRow(t.layout, joinAttrs, mapId, deps.genId()));
    }
  }
  planned.maps = mapRows.length;
  planned.map_items = mapItemRows.length;
  planned.map_conditions = mapConditionRows.length;
  planned.map_parameters = mapParameterRows.length;
  planned.map_calculated_fields = mapCalculatedFieldRows.length;
  planned.map_totals = mapTotalRows.length;
  planned.map_page_setup = mapPageSetupRows.length;
  planned.map_layouts = mapLayoutRows.length;

  if (unresolvedMapJoins > 0) {
    await emit(
      'WARN',
      'maps',
      `${unresolvedMapJoins} worksheet join reference(s) named a EUL join that did not ` +
        'migrate; recorded in map_layouts.source_attrs with no resolved join id.',
    );
  }

  if (eul.data.workbooks.length > 0) {
    await emit(
      'INFO',
      'maps',
      `${eul.data.workbooks.length} workbook(s) holding ${migratedWorksheets} worksheet(s) ` +
        `migrated as ${mapRows.length} map(s) with ${mapItemRows.length} column(s), ` +
        `${mapConditionRows.length} condition(s), ${mapParameterRows.length} parameter(s), ` +
        `${mapCalculatedFieldRows.length} calculated field(s) and ` +
        `${mapTotalRows.length} total(s).`,
    );
  }
  if (unresolvedMapTotals > 0) {
    await emit(
      'WARN',
      'maps',
      `${unresolvedMapTotals} total(s) were not migrated because the column they ` +
        'aggregate did not migrate.',
    );
  }
  if (unresolvedMapItems > 0) {
    await emit(
      'WARN',
      'maps',
      `${unresolvedMapItems} worksheet item(s) referenced an item that is not in the EUL ` +
        'any more (the workbook outlived the item) and were dropped from their map; the ' +
        'skipped list says which were displayed columns and which the query named without ' +
        'displaying.',
    );
  }
  if (unresolvedMapConditions > 0) {
    await emit(
      'WARN',
      'maps',
      `${unresolvedMapConditions} worksheet condition(s) filter an item that is not in the EUL ` +
        'any more and were not migrated; their text is in the skipped list.',
    );
  }
  // Conditions Neo's filter model cannot hold at all are reported by
  // `transformWorkbook` — one warning each, naming the reason — rather than
  // counted here, so a reviewer sees which filter is missing, not just how
  // many.
  const inexpressibleConditions = warnings.filter(
    (warning) => warning.code === 'CONDITION_OPERATOR_UNMAPPED',
  ).length;
  if (inexpressibleConditions > 0) {
    await emit(
      'WARN',
      'maps',
      `${inexpressibleConditions} worksheet condition(s) could not be expressed as a Neo ` +
        'filter and were not migrated; each is reported with its own reason.',
    );
  }

  // --- 9. grants ------------------------------------------------------------
  const grantRows: Record<string, unknown>[] = [];
  const seenGrants = new Set<string>(); // userId|baId|perm — Neo unique index
  for (const eulGrant of eul.data.grants) {
    const t = transformGrant(eulGrant, version.version);
    collect(t.warnings);
    if (t.skip) {
      skipped.push({ table: 'user_business_area_grants', sourceId: t.sourceId, reason: 'no BA/folder reference' });
      continue;
    }
    const userId = resolveUser(t.granteeUsername);
    if (!userId) {
      skipped.push({ table: 'user_business_area_grants', sourceId: t.sourceId, reason: `grantee "${t.granteeUsername}" not a migrated user` });
      continue;
    }
    // Resolve the BA: directly for BA grants, via the folder's BA for folder grants.
    let baSource = t.businessAreaSourceId;
    if (t.level === 'FOLDER' && t.folderSourceId !== null) {
      baSource = folderBaSource.get(t.folderSourceId) ?? null;
    }
    const baId = baSource !== null ? baIdBySource.get(baSource) : undefined;
    if (!baId) {
      skipped.push({ table: 'user_business_area_grants', sourceId: t.sourceId, reason: 'business area not migrated' });
      continue;
    }
    const dedupeKey = `${userId}|${baId}|${t.permissionLevel}`;
    if (seenGrants.has(dedupeKey)) continue;
    seenGrants.add(dedupeKey);
    grantRows.push({
      id: deps.genId(),
      userId,
      businessAreaId: baId,
      permissionLevel: t.permissionLevel,
      grantedBy: migrationUserId,
      grantedAt: deps.now(),
    });
  }
  planned.user_business_area_grants = grantRows.length;

  // --- write ----------------------------------------------------------------
  const plan: Array<[TargetTable, Record<string, unknown>[]]> = [
    ['users', userRows],
    ['business_areas', baRows],
    ['folders', folderRows],
    ['folder_business_areas', folderShareRows],
    ['items', itemRows],
    ['joins', joinRows],
    ['join_predicates', joinPredicateRows],
    ['hierarchies', hierarchyRows],
    ['hierarchy_levels', levelRows],
    ['custom_functions', functionRows],
    ['maps', mapRows],
    ['map_items', mapItemRows],
    ['map_conditions', mapConditionRows],
    ['map_parameters', mapParameterRows],
    ['map_calculated_fields', mapCalculatedFieldRows],
    ['map_layouts', mapLayoutRows],
    ['map_totals', mapTotalRows],
    ['map_page_setup', mapPageSetupRows],
    ['user_business_area_grants', grantRows],
  ];

  let validation: MigrationValidationResult | undefined;

  if (dryRun) {
    await emit('INFO', 'dry-run', 'Dry run — no rows written. Planned counts computed.');
  } else {
    // Baseline counts before the transaction, so validation reconciles against
    // exactly what this run added (works even against a non-empty target DB).
    const baseline: TableCounts = EMPTY_COUNTS();
    for (const [table] of plan) baseline[table] = await writer.count(table);

    try {
      await writer.transaction(async (tx) => {
        for (const [table, rows] of plan) {
          if (rows.length === 0) continue;
          await tx.insert(table, rows);
          inserted[table] = rows.length;
          progress(table, rows.length, rows.length);
          await emit('INFO', table, `Inserted ${rows.length} row(s) into ${table}.`);
        }
      });
    } catch (err) {
      // The data transaction has rolled back; record why in the durable log
      // (which is written outside the transaction) before propagating.
      const detail = describeWriteFailure(err);
      await emit('ERROR', 'failed', `Migration rolled back: ${detail}`);
      throw new MigrationRunError(detail, err);
    }

    // Hand over the temporary passwords only now: the rows are committed, so
    // every credential in this file corresponds to an account that exists. A
    // failure here must not fail the migration — the data is already written —
    // but it MUST be loud, because nobody can log in without these.
    if (provisioned.length > 0 && deps.emitCredentials) {
      try {
        await deps.emitCredentials(provisioned);
      } catch (err) {
        await emit(
          'ERROR',
          'users',
          `Migration succeeded but the credentials file could not be written: ` +
            `${err instanceof Error ? err.message : String(err)}. ` +
            `The temporary passwords are now unrecoverable — reset them from the Users page.`,
        );
      }
    }

    validation = await validateMigration(writer, plan.map(([table]) => ({
      table,
      baseline: baseline[table],
      inserted: inserted[table],
    })));
    for (const issue of validation.issues) await emit('ERROR', 'validate', issue);
    await emit(
      validation.valid ? 'INFO' : 'ERROR',
      'done',
      validation.valid ? 'Migration completed and reconciled.' : 'Migration completed with reconciliation errors.',
    );
  }

  return {
    runId,
    dryRun,
    version,
    planned,
    inserted,
    skipped,
    warnings,
    sourceValidation,
    validation,
    syntheticBusinessAreas,
    migrationUserEmail: migrationEmail,
    preflight,
    durationMs: Date.now() - startedAt,
  };
}

/** `dryRun(options)` — validate and report without writing. */
export function dryRun(options: Omit<RunMigrationOptions, 'dryRun'>): Promise<MigrationResult> {
  return runMigration({ ...options, dryRun: true });
}

// ---------------------------------------------------------------------------
// Post-migration validation
// ---------------------------------------------------------------------------

export interface TableExpectation {
  table: TargetTable;
  baseline: number;
  inserted: number;
}

/**
 * Reconcile the target row counts against what the run inserted. Referential
 * integrity itself is guaranteed by Neo's NOT NULL + FK constraints (an orphan
 * row could not have been inserted), so this focuses on count reconciliation.
 */
export async function validateMigration(
  writer: MigrationWriter,
  expectations: TableExpectation[],
): Promise<MigrationValidationResult> {
  const reconciliations: TableReconciliation[] = [];
  const issues: string[] = [];
  for (const { table, baseline, inserted } of expectations) {
    const actual = await writer.count(table);
    const expected = baseline + inserted;
    const ok = actual === expected;
    reconciliations.push({ table, baseline, inserted, expected, actual, ok });
    if (!ok) {
      issues.push(`${table}: expected ${expected} row(s) (baseline ${baseline} + inserted ${inserted}) but found ${actual}.`);
    }
  }
  return { valid: issues.length === 0, reconciliations, issues };
}
