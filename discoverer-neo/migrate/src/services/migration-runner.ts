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
import type { TargetTable } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Options / result types
// ---------------------------------------------------------------------------

export interface MigrationRunnerDeps {
  /** UUID minter (injectable for deterministic tests). */
  genId: () => string;
  /** Clock (injectable for deterministic tests). */
  now: () => Date;
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
  'items',
  'joins',
  'hierarchies',
  'hierarchy_levels',
  'custom_functions',
  'maps',
  'map_items',
  'user_business_area_grants',
];

const EMPTY_COUNTS = (): TableCounts => ({
  users: 0,
  business_areas: 0,
  folders: 0,
  items: 0,
  joins: 0,
  hierarchies: 0,
  hierarchy_levels: 0,
  custom_functions: 0,
  maps: 0,
  map_items: 0,
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
 * Turn a driver-level write failure into something an operator can act on.
 *
 * Drizzle's message embeds the failing statement *and every bound parameter*
 * ("params: …"), which would put migrated row values — user names, emails,
 * password hashes — into the durable `migration_log`. Those are stripped here;
 * the log gets the statement shape and the Postgres diagnostic, nothing more.
 */
export function describeWriteFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const withoutParams = raw.split(/\r?\nparams:/)[0] ?? raw;
  const message =
    withoutParams.length > MAX_FAILURE_MESSAGE
      ? `${withoutParams.slice(0, MAX_FAILURE_MESSAGE)}…`
      : withoutParams;

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

/** Case-insensitive username key. */
function ukey(username: string): string {
  return username.trim().toUpperCase();
}

/** Make `name` unique within `used`, suffixing " (2)", " (3)", … as needed. */
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

  // --- 0. schema + read -----------------------------------------------------
  if (!dryRun) await writer.ensureSchema();

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

  const usedEmails = new Set<string>();
  const usedBaNames = new Set<string>();

  // --- 1. users -------------------------------------------------------------
  const migrationEmail = options.migrationUser?.email ?? `migration@${MIGRATED_EMAIL_DOMAIN}`;
  const migrationName = options.migrationUser?.name ?? 'Migration Service';
  const migrationUserId = deps.genId();
  usedEmails.add(migrationEmail.toLowerCase());

  const userRows: Record<string, unknown>[] = [
    {
      id: migrationUserId,
      email: migrationEmail,
      passwordHash: MIGRATED_USER_PASSWORD_HASH,
      name: migrationName,
      role: 'USER',
      createdAt: deps.now(),
      updatedAt: deps.now(),
    },
  ];

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
    userRows.push({
      id,
      email,
      passwordHash: t.passwordHash,
      name: t.name,
      role: t.role,
      createdAt: deps.now(),
      updatedAt: deps.now(),
    });
  }
  planned.users = userRows.length;
  await emit('INFO', 'users', `Migrated users are login-disabled until an admin resets their password.`);

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
      description: 'Auto-created to host maps migrated from Discoverer workbooks. Rebuild their layout manually.',
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

  // --- 4. items (plain/calculated CI-CU + conditions CO) --------------------
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

  // --- 5. joins (one Neo row per component) ---------------------------------
  const joinRows: Record<string, unknown>[] = [];
  for (const eulJoin of eul.data.joins) {
    const t = transformJoin(eulJoin, version.version);
    collect(t.warnings);
    if (t.components.length === 0) {
      skipped.push({ table: 'joins', sourceId: t.sourceId, reason: 'no components' });
      continue;
    }
    // An EUL join can carry several component item-pairs; Neo models a single
    // pair per row, so each resolvable component becomes its own join row.
    const emitted: Array<Record<string, unknown>> = [];
    t.components.forEach((comp, idx) => {
      const leftItemId = itemIdBySource.get(comp.leftItemSourceId);
      const rightItemId = itemIdBySource.get(comp.rightItemSourceId);
      const leftFolderId = itemFolderUuid.get(comp.leftItemSourceId);
      const rightFolderId = itemFolderUuid.get(comp.rightItemSourceId);
      if (!leftFolderId || !rightFolderId) {
        warnings.push({
          code: 'JOIN_COMPONENT_UNRESOLVED',
          message: `Join "${t.name}" component ${idx + 1} references item(s) whose folder was not migrated; component dropped.`,
          sourceId: t.sourceId,
        });
        return;
      }
      emitted.push({
        id: deps.genId(),
        name: t.name,
        leftFolderId,
        rightFolderId,
        leftItemId: leftItemId ?? null,
        rightItemId: rightItemId ?? null,
        joinType: t.joinType,
        isActive: t.isActive,
        createdAt: t.createdAt ?? deps.now(),
      });
    });

    if (emitted.length === 0) {
      skipped.push({ table: 'joins', sourceId: t.sourceId, reason: 'no component resolved to migrated folders' });
      continue;
    }
    // Only disambiguate when this join actually produced more than one row —
    // suffixing a lone row with "(#1)" would imply siblings that don't exist.
    if (emitted.length > 1) {
      emitted.forEach((row, idx) => {
        row.name = `${t.name} (#${idx + 1})`;
      });
    }
    joinRows.push(...emitted);
  }
  planned.joins = joinRows.length;

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
    for (const lvl of t.levels) {
      const itemId = lvl.itemSourceId !== null ? itemIdBySource.get(lvl.itemSourceId) : undefined;
      if (!itemId) {
        skipped.push({ table: 'hierarchy_levels', sourceId: lvl.sourceId, reason: 'level item not migrated' });
        continue;
      }
      levelRows.push({
        id: deps.genId(),
        hierarchyId: id,
        levelName: lvl.levelName,
        itemId,
        levelNumber: lvl.levelNumber,
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

  // --- 8. maps (from workbooks) + map_items ---------------------------------
  const mapRows: Record<string, unknown>[] = [];
  const mapItemRows: Record<string, unknown>[] = [];
  for (const eulWb of eul.data.workbooks) {
    const t = transformWorkbook(eulWb, version.version);
    collect(t.warnings);
    if (!workbookBaId) continue; // unreachable (set when workbooks exist), defensive
    const mapId = deps.genId();
    const owner = resolveUser(t.ownerUsername) ?? migrationUserId;
    mapRows.push({
      id: mapId,
      name: t.name,
      description: t.description,
      mapType: t.mapType satisfies NeoMapType,
      businessAreaId: workbookBaId,
      createdBy: owner,
      isPublic: t.isPublic,
      isActive: true,
      createdAt: t.createdAt ?? deps.now(),
      updatedAt: t.updatedAt ?? deps.now(),
    });
    t.items.forEach((mi, idx) => {
      const itemId = mi.itemSourceId !== null ? itemIdBySource.get(mi.itemSourceId) : undefined;
      if (!itemId) return;
      mapItemRows.push({
        id: deps.genId(),
        mapId,
        itemId,
        displayOrder: mi.displayOrder ?? idx,
        displayName: mi.displayName,
      });
    });
  }
  planned.maps = mapRows.length;
  planned.map_items = mapItemRows.length;

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
    ['items', itemRows],
    ['joins', joinRows],
    ['hierarchies', hierarchyRows],
    ['hierarchy_levels', levelRows],
    ['custom_functions', functionRows],
    ['maps', mapRows],
    ['map_items', mapItemRows],
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
