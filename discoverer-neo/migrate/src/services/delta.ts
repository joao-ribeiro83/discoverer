/**
 * Incremental delta (Phase 9.2, D-079) — bring an already-migrated target up to
 * date with a source that kept changing, touching only what changed.
 *
 * ## What "changed" means
 *
 * EUL4 cannot say. Every table has audit dates, but a delete removes the row,
 * and a workbook's migrated form depends on items it does not own
 * (`EUL_SCHEMA_GROUND_TRUTH.md` §7.13). So the delta is a content diff:
 *
 * 1. Replay the whole pipeline as a dry run (`runMigration` with `onPlan`), so
 *    the rows compared are exactly the rows a full run would write.
 * 2. Group the rows into source objects — a folder with its business-area
 *    shares, a join with its predicates, a worksheet with its columns,
 *    conditions, parameters, calculations, layout, totals and page setup.
 * 3. Hash each object with every id replaced by the source key it names, so
 *    the hash is the same on every replay and on the target's own rows.
 * 4. Compare with `migration_objects`, the hashes recorded at the last run.
 *
 * With the same commit, a hash moves only when the source did. A new commit
 * that changes what the migrator writes moves hashes too, and the delta applies
 * that as well — the run records both SHAs' worth of history in
 * `migration_log`, so the cause is never ambiguous.
 *
 * ## What it writes
 *
 * - **Added** objects are inserted.
 * - **Changed** objects are updated IN PLACE: the top row keeps its id, and
 *   its child rows are replaced. Never delete-and-insert a map or an item —
 *   schedules, shares and export jobs hang off `maps.id`, and map columns off
 *   `items.id`, all `ON DELETE CASCADE`.
 * - **Deleted** objects are refused and reported, not deleted (D-080): a
 *   worksheet may still be scheduled or shared, an item still referenced.
 *   The operator removes the object in Neo, where its dependents are visible;
 *   the next delta sees it gone and drops it from the baseline. Two deletions
 *   ARE applied, because keeping them would leave access broader than the
 *   source: a revoked grant is deleted, and a deleted user is deactivated.
 *
 * Everything runs in one transaction. A delta that fails half-way leaves the
 * target exactly as it was.
 *
 * ## The first delta
 *
 * A target migrated before this existed has no baseline. The first delta
 * adopts one: it matches the target's rows to the replay by natural key (a
 * folder's name, an item's folder and name, a workbook's `source_id`) and
 * hashes the target's own rows. Whatever differs from the replay is therefore
 * applied as a change. A natural key that matches more than one row refuses.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { TargetTable } from '../db/schema.js';
import type { ReadEulOptions } from './eul-reader.js';
import type { EulSource } from './oracle-client.js';
import type { MigrationLogInput, MigrationWriter } from './migration-writer.js';
import type { MigrationPlan } from './migration-runner.js';
import {
  SERVICE_USER_KEY,
  mapKey,
  runMigration,
  sanitizeWriteFailure,
  sourceStateDetail,
} from './migration-runner.js';
import type { EulVersion } from '../types/eul-versions.js';

type Row = Record<string, unknown>;

export interface BaselineEntry {
  targetId: string;
  hash: string;
}

/** Target-side seam; production is `createDeltaDb`, tests use an in-memory fake. */
export interface DeltaDb {
  /** Create `migration_log` and `migration_objects` (idempotent). */
  ensureSchema(): Promise<void>;
  /** Append a log row outside any transaction, so it survives a rollback. */
  log(entry: MigrationLogInput): Promise<void>;
  /** The recorded baseline; empty when no delta has run on this target. */
  readBaseline(): Promise<Map<string, BaselineEntry>>;
  readRows(table: TargetTable): Promise<Row[]>;
  transaction<T>(fn: (tx: DeltaTx) => Promise<T>): Promise<T>;
}

export interface DeltaTx {
  insert(table: TargetTable, rows: Row[]): Promise<void>;
  update(table: TargetTable, id: string, values: Row): Promise<void>;
  deleteWhere(table: TargetTable, column: string, values: string[]): Promise<void>;
  readRows(table: TargetTable): Promise<Row[]>;
  saveBaseline(runId: string, upsert: Array<[string, BaselineEntry]>, remove: string[]): Promise<void>;
}

export interface DeltaOptions {
  source: EulSource;
  db: DeltaDb;
  readOptions?: ReadEulOptions;
  version?: 'auto' | EulVersion;
  dryRun?: boolean;
  /** Stamped on new folders. Defaults to the one data source the target's folders already use. */
  dataSourceId?: string;
  commitSha?: string;
  deps?: { genId?: () => string };
}

export type DeltaChangeKind = 'added' | 'changed' | 'deleted' | 'revoked' | 'deactivated' | 'missing';

export interface DeltaChange {
  key: string;
  table: TargetTable;
  kind: DeltaChangeKind;
}

export interface DeltaResult {
  runId: string | null;
  dryRun: boolean;
  /** True when this run built the baseline from the target (the first delta). */
  adopted: boolean;
  /** Source objects the replay produced. */
  objects: number;
  /**
   * Everything that differs. `deleted` is refused and left in place; `missing`
   * is an object recorded at the last run that is no longer in the target,
   * so it is neither updated nor re-created.
   */
  changes: DeltaChange[];
  /** Nothing to write: the source is exactly what was recorded. */
  noop: boolean;
  durationMs: number;
}

/** Refused before anything was written. */
export class DeltaRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeltaRefusedError';
  }
}

/** A child table, and the column naming the object it belongs to. */
const CHILD_OWNER: Partial<Record<TargetTable, [TargetTable, string]>> = {
  folder_business_areas: ['folders', 'folderId'],
  join_predicates: ['joins', 'joinId'],
  hierarchy_levels: ['hierarchies', 'hierarchyId'],
  map_items: ['maps', 'mapId'],
  map_conditions: ['maps', 'mapId'],
  map_parameters: ['maps', 'mapId'],
  map_calculated_fields: ['maps', 'mapId'],
  map_layouts: ['maps', 'mapId'],
  map_totals: ['maps', 'mapId'],
  map_page_setup: ['maps', 'mapId'],
  map_conditional_formats: ['maps', 'mapId'],
};

/** Never compared: ids are per-run, and timestamps move without content moving. */
const NOT_HASHED = new Set(['id', 'createdAt', 'updatedAt', 'grantedAt']);

/**
 * Columns a delta neither compares nor overwrites. A user's address, credential
 * and Neo role belong to Neo once the account exists; a folder's data source is
 * the operator's to point.
 */
const KEPT_ON_UPDATE: Partial<Record<TargetTable, readonly string[]>> = {
  users: ['email', 'passwordHash', 'mustChangePassword', 'role', 'isActive'],
  folders: ['dataSourceId'],
};

/** How the first delta finds a planned object among the target's rows. */
const NATURAL_KEY: Partial<Record<TargetTable, readonly string[]>> = {
  users: ['email'],
  business_areas: ['name'],
  folders: ['name'],
  item_classes: ['name'],
  items: ['folderId', 'name'],
  joins: ['name', 'leftFolderId', 'rightFolderId'],
  hierarchies: ['name', 'businessAreaId'],
  custom_functions: ['name'],
  workbooks: ['sourceId'],
  maps: ['workbookId', '#worksheet'],
  user_business_area_grants: ['userId', 'businessAreaId', 'permissionLevel'],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^-?\d+(\.\d+)?$/;

interface Unit {
  key: string;
  table: TargetTable;
  row: Row;
  children: Array<[TargetTable, Row]>;
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

/** A value in a form both sides agree on: pg returns `numeric` as '0.750', a plan may hold 0.75. */
function canon(value: unknown, sub: (s: string) => string): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return NUMERIC.test(value) ? String(Number(value)) : sub(value);
  if (Array.isArray(value)) return value.map((v) => canon(v, sub));
  if (typeof value === 'object') {
    const out: Row = {};
    for (const k of Object.keys(value).sort()) out[k] = canon((value as Row)[k], sub);
    return out;
  }
  return value;
}

/** Replace every id string, however deep — `map_layouts.source_attrs` carries join ids in JSON. */
function substitute(value: unknown, sub: (s: string) => string): unknown {
  if (typeof value === 'string') return sub(value);
  if (Array.isArray(value)) return value.map((v) => substitute(v, sub));
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Row = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, sub);
    return out;
  }
  return value;
}

type Columns = Map<TargetTable, string[]>;

/** The columns the migration writes, per table — the only ones a hash may look at. */
function columnsOf(plan: MigrationPlan): Columns {
  const columns: Columns = new Map();
  for (const [table, rows] of plan.tables) {
    const keys = new Set<string>();
    for (const row of rows) for (const k of Object.keys(row)) keys.add(k);
    const kept = KEPT_ON_UPDATE[table] ?? [];
    columns.set(table, [...keys].filter((k) => !NOT_HASHED.has(k) && !kept.includes(k)).sort());
  }
  return columns;
}

function rowText(table: TargetTable, row: Row, columns: Columns, sub: (s: string) => string): string {
  return JSON.stringify([table, ...(columns.get(table) ?? []).map((c) => [c, canon(row[c], sub)])]);
}

/**
 * Hash one object with its children. An id pointing outside the object becomes
 * the key of what it names; an id pointing at a sibling child (a total naming a
 * column) becomes a name derived from that sibling's own content, since child
 * rows have no key of their own.
 */
export function unitHash(unit: Unit, columns: Columns, keyOf: (id: string) => string | undefined): string {
  const selfId = String(unit.row.id);
  const rows: Array<[TargetTable, Row]> = [[unit.table, unit.row], ...unit.children];
  const local = new Set(rows.flatMap(([, r]) => (typeof r.id === 'string' ? [r.id] : [])));
  const outside = (s: string): string => (UUID.test(s) ? (keyOf(s) ?? s) : s);

  const blanked = rows.map(([t, r]) => rowText(t, r, columns, (s) => (local.has(s) ? '@local' : outside(s))));
  const seen = new Map<string, number>();
  const localName = new Map<string, string>();
  rows.forEach(([, r], i) => {
    const text = blanked[i] ?? '';
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    if (typeof r.id === 'string') localName.set(r.id, `@${sha(text).slice(0, 16)}#${n}`);
  });

  const lines = rows.map(([t, r]) =>
    rowText(t, r, columns, (s) => (s === selfId ? '@self' : (localName.get(s) ?? outside(s)))),
  );
  return sha(lines.sort().join('\n'));
}

/** Group rows into objects. Rows with no key (target rows Neo authored) are left out. */
function assemble(
  tables: Array<[TargetTable, Row[]]>,
  keyOf: (id: string) => string | undefined,
): { units: Map<string, Unit>; duplicates: string[] } {
  const units = new Map<string, Unit>();
  const unitById = new Map<string, Unit>();
  const duplicates: string[] = [];
  for (const [table, rows] of tables) {
    if (CHILD_OWNER[table]) continue;
    for (const row of rows) {
      const key = keyOf(String(row.id));
      if (key === undefined) continue;
      if (units.has(key)) {
        duplicates.push(key);
        continue;
      }
      const unit: Unit = { key, table, row, children: [] };
      units.set(key, unit);
      unitById.set(String(row.id), unit);
    }
  }
  for (const [table, rows] of tables) {
    const owner = CHILD_OWNER[table];
    if (!owner) continue;
    for (const row of rows) unitById.get(String(row[owner[1]]))?.children.push([table, row]);
  }
  return { units, duplicates };
}

/** A map's worksheet part of its natural key: the layout carries the GUID. */
function worksheetOf(unit: Unit | undefined): string {
  const layout = unit?.children.find(([t]) => t === 'map_layouts')?.[1];
  return mapKey(0, (layout?.worksheetGuid as string | null) ?? null, (layout?.worksheetIndex as number | null) ?? null);
}

function naturalSig(
  table: TargetTable,
  row: Row,
  unit: Unit | undefined,
  sub: (s: string) => string,
): string {
  return JSON.stringify(
    (NATURAL_KEY[table] ?? []).map((column) => {
      if (column === '#worksheet') return worksheetOf(unit);
      const value = canon(row[column], sub);
      return column === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
    }),
  );
}

/**
 * Build a baseline from a target that has none, by matching its rows to the
 * replay. Returns target id → key for everything matched, plus the migrated
 * workbooks and worksheets the source no longer has (so they report as
 * deleted rather than disappearing from view).
 */
function adopt(
  plan: MigrationPlan,
  planUnits: Map<string, Unit>,
  target: Map<TargetTable, Row[]>,
): Map<string, string> {
  const targetKeyById = new Map<string, string>();
  const planSub = (s: string): string => plan.keyById.get(s) ?? s;
  const targetSub = (s: string): string => targetKeyById.get(s) ?? s;
  const ambiguous: string[] = [];

  // Target maps need their layout to be matched, so pre-group the children.
  const layoutUnits = new Map<string, Unit>();
  for (const row of target.get('maps') ?? []) {
    layoutUnits.set(String(row.id), { key: '', table: 'maps', row, children: [] });
  }
  for (const row of target.get('map_layouts') ?? []) {
    layoutUnits.get(String(row.mapId))?.children.push(['map_layouts', row]);
  }

  for (const [table] of plan.tables) {
    if (CHILD_OWNER[table] || !NATURAL_KEY[table]) continue;
    const candidates = new Map<string, string[]>();
    for (const row of target.get(table) ?? []) {
      const sig = naturalSig(table, row, layoutUnits.get(String(row.id)), targetSub);
      candidates.set(sig, [...(candidates.get(sig) ?? []), String(row.id)]);
    }
    for (const unit of planUnits.values()) {
      if (unit.table !== table) continue;
      const found = candidates.get(naturalSig(table, unit.row, unit, planSub)) ?? [];
      const free = found.filter((id) => !targetKeyById.has(id));
      if (found.length > 1 || (found.length === 1 && free.length === 0)) ambiguous.push(unit.key);
      else if (free.length === 1) targetKeyById.set(free[0] as string, unit.key);
    }
  }
  if (ambiguous.length > 0) {
    throw new DeltaRefusedError(
      `Cannot adopt a baseline: ${ambiguous.length} source object(s) match more than one target row ` +
        `by name (${ambiguous.slice(0, 10).join(', ')}${ambiguous.length > 10 ? ', …' : ''}). ` +
        'Rename or remove the duplicates in Neo, then run the delta again.',
    );
  }

  // Migrated workbooks and worksheets the source has lost: key them by their
  // own provenance so the deletion policy reports them.
  const workbookSource = new Map<string, number>();
  for (const row of target.get('workbooks') ?? []) {
    if (typeof row.sourceId !== 'number') continue;
    workbookSource.set(String(row.id), row.sourceId);
    if (!targetKeyById.has(String(row.id))) targetKeyById.set(String(row.id), `workbook:${row.sourceId}`);
  }
  for (const row of target.get('maps') ?? []) {
    const docId = workbookSource.get(String(row.workbookId));
    if (docId === undefined || targetKeyById.has(String(row.id))) continue;
    const layout = layoutUnits.get(String(row.id));
    targetKeyById.set(String(row.id), worksheetOf(layout).replace(/^map:0:/, `map:${docId}:`));
  }
  return targetKeyById;
}

/** Resolve the commit being run, for the record (D-078). */
export function commitShaFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.DN_MIGRATE_COMMIT ?? env.GIT_COMMIT ?? env.GITHUB_SHA;
}

export async function runDelta(options: DeltaOptions): Promise<DeltaResult> {
  const startedAt = Date.now();
  const dryRun = options.dryRun === true;
  const runId = dryRun ? null : (options.deps?.genId ?? randomUUID)();
  const { db } = options;
  const log = async (level: MigrationLogInput['level'], phase: string, message: string, detail?: unknown) => {
    if (runId) await db.log({ runId, level, phase, message, detail });
  };

  if (!dryRun) await db.ensureSchema();

  // --- target ---------------------------------------------------------------
  // Every migrated table is either a child or has a natural key, so this reads them all.
  const target = new Map<TargetTable, Row[]>();
  for (const table of [...Object.keys(CHILD_OWNER), ...Object.keys(NATURAL_KEY)] as TargetTable[]) {
    target.set(table, await db.readRows(table));
  }

  // --- replay ---------------------------------------------------------------
  // The replay sees an empty target: the runner disambiguates a synthesized
  // email against addresses already present, and every migrated user's own
  // address is present here.
  let dataSourceId = options.dataSourceId;
  if (dataSourceId === undefined) {
    const used = new Set((target.get('folders') ?? []).flatMap((f) => (typeof f.dataSourceId === 'string' ? [f.dataSourceId] : [])));
    if (used.size === 1) dataSourceId = [...used][0];
  }
  let plan: MigrationPlan | undefined;
  const replay = await runMigration({
    source: options.source,
    writer: { existingUserEmails: () => Promise.resolve(new Set<string>()) } as unknown as MigrationWriter,
    readOptions: options.readOptions,
    version: options.version,
    dryRun: true,
    dataSourceId,
    onPlan: (p) => {
      plan = p;
    },
  });
  if (!plan) throw new Error('The migration replay produced no plan.');
  const planned = plan;

  const { units: planUnits, duplicates } = assemble(planned.tables, (id) => planned.keyById.get(id));
  for (const [table, rows] of planned.tables) {
    if (CHILD_OWNER[table]) continue;
    const unkeyed = rows.filter((r) => !planned.keyById.has(String(r.id)));
    if (unkeyed.length > 0) throw new Error(`The replay wrote ${unkeyed.length} ${table} row(s) with no source key.`);
  }
  if (duplicates.length > 0) {
    throw new DeltaRefusedError(
      `Two source objects share a key (${duplicates.slice(0, 10).join(', ')}), so a delta cannot tell them apart.`,
    );
  }

  // The same guard as a full run, the other way round: a delta needs a migration to update.
  const serviceEmail = planUnits.get(SERVICE_USER_KEY)?.row.email;
  const serviceRow = (target.get('users') ?? []).find(
    (u) => String(u.email).toLowerCase() === String(serviceEmail).toLowerCase(),
  );
  if (!serviceRow) {
    throw new DeltaRefusedError(
      `The target has not been migrated (no "${String(serviceEmail)}" account). Run a full migration first; a delta only updates one.`,
    );
  }

  const columns = columnsOf(planned);
  const planHashes = new Map(
    [...planUnits].map(([key, unit]) => [key, unitHash(unit, columns, (id) => planned.keyById.get(id))]),
  );
  const planHash = (key: string): string => planHashes.get(key) as string;

  // --- baseline -------------------------------------------------------------
  let baseline = await db.readBaseline();
  const adopted = baseline.size === 0;
  if (adopted) {
    const targetKeyById = adopt(planned, planUnits, target);
    const { units: targetUnits } = assemble(
      [...target.entries()],
      (id) => targetKeyById.get(id),
    );
    baseline = new Map(
      [...targetUnits.values()].map((u) => [
        u.key,
        { targetId: String(u.row.id), hash: unitHash(u, columns, (id) => targetKeyById.get(id)) },
      ]),
    );
  }

  const targetIds = new Set<string>();
  for (const [table, rows] of target) if (!CHILD_OWNER[table]) for (const r of rows) targetIds.add(String(r.id));

  // --- diff -----------------------------------------------------------------
  const changes: DeltaChange[] = [];
  const idMap = new Map<string, string>(); // planned id → target id
  const write = new Map<string, 'added' | 'changed'>();
  for (const [key, unit] of planUnits) {
    const base = baseline.get(key);
    if (!base) {
      write.set(key, 'added');
      changes.push({ key, table: unit.table, kind: 'added' });
    } else if (!targetIds.has(base.targetId)) {
      changes.push({ key, table: unit.table, kind: 'missing' });
    } else {
      idMap.set(String(unit.row.id), base.targetId);
      if (base.hash !== planHash(key)) {
        write.set(key, 'changed');
        changes.push({ key, table: unit.table, kind: 'changed' });
      }
    }
  }
  const resolved: string[] = [];
  const revoke: Array<[string, BaselineEntry]> = [];
  const deactivate: Array<[string, BaselineEntry]> = [];
  const targetTableOf = new Map<string, TargetTable>();
  for (const [table, rows] of target) for (const r of rows) targetTableOf.set(String(r.id), table);
  for (const [key, base] of baseline) {
    if (planUnits.has(key)) continue;
    const table = targetTableOf.get(base.targetId);
    if (!table) {
      resolved.push(key); // gone from both sides: the operator removed it
    } else if (table === 'user_business_area_grants') {
      revoke.push([key, base]);
      changes.push({ key, table, kind: 'revoked' });
    } else if (table === 'users') {
      // Already inactive from an earlier delta: nothing left to do.
      if ((target.get('users') ?? []).find((u) => u.id === base.targetId)?.isActive === false) continue;
      deactivate.push([key, base]);
      changes.push({ key, table, kind: 'deactivated' });
    } else {
      changes.push({ key, table, kind: 'deleted' });
    }
  }

  const noop = write.size === 0 && revoke.length === 0 && deactivate.length === 0 && resolved.length === 0 && !adopted;
  const counts = countChanges(changes);
  const summary = `${adopted ? 'Baseline adopted from the target. ' : ''}${describeCounts(counts)}`;

  await log('INFO', 'source-state', `Delta source VERSIONS ${replay.version.schemaVersion}, commit ${options.commitSha ?? 'unknown'}.`, sourceStateDetail(replay.version, options.commitSha));
  // Refusals stand whether or not anything else is written, so they are logged first.
  for (const change of changes) {
    if (change.kind !== 'deleted' && change.kind !== 'missing') continue;
    const why =
      change.kind === 'deleted'
        ? 'no longer in the source — refused, left in place (D-080)'
        : 'no longer in the target — not re-created';
    await log('WARN', 'delta', `${change.table} ${change.key}: ${why}.`);
  }
  if (dryRun || noop) {
    await log('INFO', 'delta', noop ? 'No change since the last recorded run.' : summary, counts);
    return { runId, dryRun, adopted, objects: planUnits.size, changes, noop, durationMs: Date.now() - startedAt };
  }

  // --- apply ----------------------------------------------------------------
  const toTarget = (value: unknown): unknown => substitute(value, (s) => idMap.get(s) ?? s);
  const plannedGrantKeys = new Set([...planUnits.values()].filter((u) => u.table === 'user_business_area_grants').map((u) => u.key));
  const serviceUserId = String(serviceRow.id);

  try {
    await db.transaction(async (tx) => {
      // Children of a changed object are replaced, so clear them first.
      const changedIdsByTable = new Map<TargetTable, string[]>();
      for (const [key, kind] of write) {
        if (kind !== 'changed') continue;
        const unit = planUnits.get(key) as Unit;
        const id = idMap.get(String(unit.row.id)) as string;
        changedIdsByTable.set(unit.table, [...(changedIdsByTable.get(unit.table) ?? []), id]);
      }
      for (const [child, [ownerTable, column]] of Object.entries(CHILD_OWNER) as Array<[TargetTable, [TargetTable, string]]>) {
        const ids = changedIdsByTable.get(ownerTable);
        if (ids) await tx.deleteWhere(child, column, ids);
      }

      for (const [table, rows] of planned.tables) {
        const owner = CHILD_OWNER[table];
        if (owner) {
          const mine = rows.filter((r) => write.has(planned.keyById.get(String(r[owner[1]])) ?? ''));
          await tx.insert(table, mine.map((r) => toTarget(r) as Row));
          continue;
        }
        const added: Row[] = [];
        for (const row of rows) {
          const key = planned.keyById.get(String(row.id)) as string;
          const kind = write.get(key);
          if (kind === 'added') added.push(toTarget(row) as Row);
          if (kind !== 'changed') continue;
          const values = toTarget(row) as Row;
          for (const column of ['id', 'createdAt', ...(KEPT_ON_UPDATE[table] ?? [])]) delete values[column];
          await tx.update(table, idMap.get(String(row.id)) as string, values);
        }
        await tx.insert(table, added);
      }

      if (revoke.length > 0) {
        await tx.deleteWhere('user_business_area_grants', 'id', revoke.map(([, b]) => b.targetId));
      }
      for (const [, base] of deactivate) await tx.update('users', base.targetId, { isActive: false });

      await assertNoGrantWidening(tx, serviceUserId, plannedGrantKeys, baseline, write, planned, idMap);

      const upsert: Array<[string, BaselineEntry]> = adopted ? [...baseline] : [];
      for (const [key] of write) {
        const unit = planUnits.get(key) as Unit;
        upsert.push([key, { targetId: idMap.get(String(unit.row.id)) ?? String(unit.row.id), hash: planHash(key) }]);
      }
      await tx.saveBaseline(runId as string, upsert, [...resolved, ...revoke.map(([k]) => k)]);
    });
  } catch (err) {
    await log('ERROR', 'failed', `Delta rolled back: ${sanitizeWriteFailure(err)}`);
    throw err;
  }

  await log('INFO', 'delta', summary, counts);
  return { runId, dryRun, adopted, objects: planUnits.size, changes, noop, durationMs: Date.now() - startedAt };
}

/**
 * Phase 5.1's rule, asserted inside the transaction on every delta: no grant the
 * migration wrote may be broader than the source. A migrated grant (granted by
 * the service account) must match a grant the source holds now, user, business
 * area and level alike. One that does not rolls the delta back.
 */
async function assertNoGrantWidening(
  tx: DeltaTx,
  serviceUserId: string,
  plannedGrantKeys: Set<string>,
  baseline: Map<string, BaselineEntry>,
  write: Map<string, 'added' | 'changed'>,
  plan: MigrationPlan,
  idMap: Map<string, string>,
): Promise<void> {
  const keyOf = new Map<string, string>();
  for (const [key, base] of baseline) keyOf.set(base.targetId, key);
  for (const [id, key] of plan.keyById) if (write.has(key) || idMap.has(id)) keyOf.set(idMap.get(id) ?? id, key);

  const wider: string[] = [];
  for (const grant of await tx.readRows('user_business_area_grants')) {
    if (grant.grantedBy !== serviceUserId) continue;
    const user = keyOf.get(String(grant.userId));
    const ba = keyOf.get(String(grant.businessAreaId));
    const key = user && ba ? `grant:${user.slice('user:'.length)}|${ba.slice('ba:'.length)}|${String(grant.permissionLevel)}` : null;
    if (key === null || !plannedGrantKeys.has(key)) wider.push(key ?? String(grant.id));
  }
  if (wider.length > 0) {
    throw new DeltaRefusedError(
      `${wider.length} migrated grant(s) would be broader than the source (${wider.slice(0, 5).join(', ')}); the delta was rolled back.`,
    );
  }
}

export function countChanges(changes: DeltaChange[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const c of changes) {
    const byTable = (out[c.kind] ??= {});
    byTable[c.table] = (byTable[c.table] ?? 0) + 1;
  }
  return out;
}

function describeCounts(counts: Record<string, Record<string, number>>): string {
  const parts = Object.entries(counts).map(
    ([kind, tables]) => `${kind}: ${Object.entries(tables).map(([t, n]) => `${n} ${t}`).join(', ')}`,
  );
  return parts.length > 0 ? `${parts.join('; ')}.` : 'No change.';
}
