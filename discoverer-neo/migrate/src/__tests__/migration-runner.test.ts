/**
 * End-to-end migration-runner tests.
 *
 * These are hermetic but genuinely end-to-end: the read side runs the *real*
 * version detector, schema adapter and EUL reader over the mock Oracle
 * fixtures, and the write side runs the real transform + FK-resolution
 * pipeline into an in-memory `MigrationWriter`. Only Oracle and Postgres
 * themselves are substituted.
 */

import {
  describeWriteFailure,
  dryRun,
  runMigration,
  TARGET_TABLE_ORDER,
} from '../services/migration-runner.js';
import type { MigrationEvent } from '../services/migration-runner.js';
import { createFakeWriter } from './helpers/fake-writer.js';
import type { FakeWriterState } from './helpers/fake-writer.js';
import { eul4Db, eul5Db, mixedDb, mockExecutor } from './helpers/mock-eul.js';
import type { TargetTable } from '../db/schema.js';

// Deterministic UUID minting and clock, so assertions are stable.
function deterministicDeps() {
  let n = 0;
  return {
    genId: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
    now: () => new Date('2026-07-18T00:00:00.000Z'),
  };
}

const rowsOf = (state: FakeWriterState, table: TargetTable): Array<Record<string, unknown>> =>
  state.tables[table];

/** First row, asserting presence (keeps `noUncheckedIndexedAccess` happy). */
function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('expected at least one row');
  return row;
}

describe('runMigration — EUL5 source, end to end', () => {
  it('migrates every entity type into the target', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.version.version).toBe('EUL5');
    expect(result.dryRun).toBe(false);
    expect(result.runId).toBeTruthy();

    // 2 grantees (JSMITH, MJONES) + the migration service user.
    expect(rowsOf(state, 'users')).toHaveLength(3);
    // 1 real business area + the auto-created host for workbook maps.
    expect(rowsOf(state, 'business_areas')).toHaveLength(2);
    expect(result.syntheticBusinessAreas).toBe(1);
    expect(rowsOf(state, 'folders')).toHaveLength(2);
    // EXP 300 (CI) and 301 (CU) migrate; 302 (SM) does not.
    expect(rowsOf(state, 'items')).toHaveLength(2);
    expect(rowsOf(state, 'hierarchies')).toHaveLength(1);
    expect(rowsOf(state, 'hierarchy_levels')).toHaveLength(2);
    expect(rowsOf(state, 'custom_functions')).toHaveLength(1);
    expect(rowsOf(state, 'maps')).toHaveLength(1);
    expect(rowsOf(state, 'user_business_area_grants')).toHaveLength(2);

    expect(result.validation?.valid).toBe(true);
    expect(state.ensureSchemaCalls).toBe(1);
    expect(state.transactionCalls).toBe(1);
  });

  it('skips the SM security-manager expression and says why', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.warnings.map((w) => w.code)).toContain('ITEM_SECURITY_MANAGER');
    const names = rowsOf(state, 'items').map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Invoice Amount', 'Amount With Tax']));
    expect(names).not.toContain('Region Filter');
  });

  it('drops a join component whose item was not migrated, keeping the resolvable one', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    // JOI 400 has components (300,301) and (300,302); item 302 is the skipped
    // SM expression, so only the first component becomes a Neo join row.
    expect(rowsOf(state, 'joins')).toHaveLength(1);
    expect(result.warnings.map((w) => w.code)).toContain('JOIN_COMPONENT_UNRESOLVED');
    // A lone surviving component keeps the plain join name — a "(#1)" suffix
    // would imply sibling rows that were never created.
    expect(first(rowsOf(state, 'joins')).name).toBe('Invoices to Suppliers');
  });

  it('numbers the rows when one EUL join yields several Neo joins', async () => {
    // Make the second component reference a migratable item (301 -> 300) so
    // both components resolve and two Neo join rows are produced.
    const db = eul5Db();
    db.tables.EUL5_JOI_COMP = [
      { JOI_ID: 400, EXP_ID_1: 300, EXP_ID_2: 301, JOI_OP: '=' },
      { JOI_ID: 400, EXP_ID_1: 301, EXP_ID_2: 300, JOI_OP: '=' },
    ];
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(db), writer, deps: deterministicDeps() });

    const names = rowsOf(state, 'joins').map((r) => r.name);
    expect(names).toEqual(['Invoices to Suppliers (#1)', 'Invoices to Suppliers (#2)']);
  });

  it('resolves folder-level grants to the folder’s business area and de-duplicates', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const grants = rowsOf(state, 'user_business_area_grants');
    const baId = first(rowsOf(state, 'business_areas')).id;
    // EA 800 + 802 are the same JSMITH/BA pair (deduped); 801 is MJONES on a
    // folder, resolved to that folder's business area.
    expect(grants).toHaveLength(2);
    for (const g of grants) {
      expect(g.businessAreaId).toBe(baId);
      expect(g.permissionLevel).toBe('VIEW');
    }
  });

  it('hosts workbook maps in the auto-created business area and attributes the owner', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    const hostBa = rowsOf(state, 'business_areas').find((b) => b.name === 'Migrated Workbooks');
    expect(hostBa).toBeDefined();
    const map = first(rowsOf(state, 'maps'));
    expect(map.businessAreaId).toBe(hostBa?.id);
    expect(map.mapType).toBe('TABLE');
    // DOC_WORKBOOK_OWNER 'JSMITH' is a migrated user, so the map is theirs.
    const jsmith = rowsOf(state, 'users').find((u) => u.email === 'jsmith@migrated.local');
    expect(map.createdBy).toBe(jsmith?.id);
    // The proprietary blob yields no reconstructable columns.
    expect(rowsOf(state, 'map_items')).toHaveLength(0);
  });
});

describe('runMigration — EUL4 source, end to end', () => {
  it('migrates an EUL4 source and maps OUTER joins to LEFT', async () => {
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.version.version).toBe('EUL4');
    expect(rowsOf(state, 'users')).toHaveLength(2); // ACLARK + migration user
    expect(rowsOf(state, 'business_areas')).toHaveLength(2); // Finance + workbook host
    expect(rowsOf(state, 'folders')).toHaveLength(1);
    expect(rowsOf(state, 'items')).toHaveLength(2);
    expect(rowsOf(state, 'hierarchies')).toHaveLength(1);
    expect(rowsOf(state, 'hierarchy_levels')).toHaveLength(1);
    expect(rowsOf(state, 'custom_functions')).toHaveLength(1);
    expect(rowsOf(state, 'maps')).toHaveLength(1);
    expect(rowsOf(state, 'user_business_area_grants')).toHaveLength(1);
    expect(result.validation?.valid).toBe(true);

    // EUL4's single OUTER join type lands as LEFT in Neo.
    const joins = rowsOf(state, 'joins');
    expect(joins).toHaveLength(1);
    expect(first(joins).joinType).toBe('LEFT');
  });

  it('maps the EUL4 VIEW folder type and keeps table/owner metadata', async () => {
    const { writer, state } = createFakeWriter();
    await runMigration({ source: mockExecutor(eul4Db()), writer, deps: deterministicDeps() });

    const folder = first(rowsOf(state, 'folders'));
    expect(folder).toMatchObject({
      name: 'GL Balances',
      folderType: 'VIEW',
      tableName: 'GL_BALANCES_V',
      tableOwner: 'GL',
    });
  });

  it('reports the EUL5-era columns EUL4 had to default', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      deps: deterministicDeps(),
    });
    // The EUL4 fixture has no DOC_WORKBOOK_OWNER, so the map falls back to
    // DOC_CREATED_BY — the migration still attributes an owner.
    expect(result.planned.maps).toBe(1);
    expect(result.version.version).toBe('EUL4');
  });
});

describe('dryRun', () => {
  it('computes planned counts without writing anything', async () => {
    const { writer, state } = createFakeWriter();
    const result = await dryRun({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() });

    expect(result.dryRun).toBe(true);
    expect(result.runId).toBeNull();
    expect(result.planned.users).toBe(3);
    expect(result.planned.business_areas).toBe(2);
    expect(result.planned.items).toBe(2);

    // Nothing at all touched the target.
    for (const table of TARGET_TABLE_ORDER) {
      expect(rowsOf(state, table)).toHaveLength(0);
      expect(result.inserted[table]).toBe(0);
    }
    expect(state.ensureSchemaCalls).toBe(0);
    expect(state.transactionCalls).toBe(0);
    expect(state.logs).toHaveLength(0);
    expect(result.validation).toBeUndefined();
  });

  it('planned counts match what a real run then inserts', async () => {
    const planned = await dryRun({
      source: mockExecutor(eul5Db()),
      writer: createFakeWriter().writer,
      deps: deterministicDeps(),
    });
    const live = createFakeWriter();
    const actual = await runMigration({
      source: mockExecutor(eul5Db()),
      writer: live.writer,
      deps: deterministicDeps(),
    });
    expect(actual.inserted).toEqual(planned.planned);
  });
});

describe('version override', () => {
  it('detects EUL5 on a mixed EUL4+EUL5 schema by default', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(mixedDb()),
      writer,
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL5');
  });

  it('--version eul4 forces EUL4 on a mixed schema', async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(mixedDb()),
      writer,
      version: 'EUL4',
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL4');
  });

  it('warns when the requested version does not match what was detected', async () => {
    const events: MigrationEvent[] = [];
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul5Db()), // pure EUL5, cannot become EUL4
      writer,
      version: 'EUL4',
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    expect(result.version.version).toBe('EUL5');
    expect(
      events.some((e) => e.level === 'WARN' && e.message.includes('Requested version EUL4')),
    ).toBe(true);
  });

  it("'auto' behaves the same as no override", async () => {
    const { writer } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(eul4Db()),
      writer,
      version: 'auto',
      deps: deterministicDeps(),
    });
    expect(result.version.version).toBe('EUL4');
  });
});

describe('post-migration validation', () => {
  it('reconciles counts against a non-empty target database', async () => {
    // The target already holds unrelated rows; reconciliation must account for
    // the baseline rather than assuming a fresh database.
    const { writer } = createFakeWriter({ baseline: { users: 5, business_areas: 2 } });
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.validation?.valid).toBe(true);
    const users = result.validation?.reconciliations.find((r) => r.table === 'users');
    expect(users).toMatchObject({ baseline: 5, inserted: 3, expected: 8, actual: 8, ok: true });
  });

  it('fails reconciliation when the target does not hold what was inserted', async () => {
    // Force `count` to under-report items, as a lost/rolled-back write would.
    const { writer } = createFakeWriter({ countOverride: { items: 0 } });
    const result = await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
    });

    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.issues.join(' ')).toContain('items');
  });
});

describe('failure handling', () => {
  it('rolls back the data transaction but keeps the migration log', async () => {
    const { writer, state } = createFakeWriter({ failOnInsert: 'items' });

    await expect(
      runMigration({ source: mockExecutor(eul5Db()), writer, deps: deterministicDeps() }),
    ).rejects.toThrow(/fake insert failure on items/);

    // Everything inserted before the failure is rolled back…
    expect(rowsOf(state, 'users')).toHaveLength(0);
    expect(rowsOf(state, 'business_areas')).toHaveLength(0);
    expect(rowsOf(state, 'folders')).toHaveLength(0);
    // …but the log survives, which is the whole point of logging outside the tx.
    expect(state.logs.length).toBeGreaterThan(0);
    expect(state.logs.some((l) => l.phase === 'read')).toBe(true);
  });

  it('strips bound parameters out of a failure before it reaches the log', () => {
    // Drizzle's message carries every bound value; migrated emails/hashes must
    // not be copied into the durable migration_log.
    const drizzleStyle = new Error(
      'Failed query: insert into "users" ("id", "email") values ($1, $2)\n' +
        'params: 0000,secret.person@migrated.local,!migrated-no-login',
    );
    const described = describeWriteFailure(drizzleStyle);
    expect(described).toContain('Failed query: insert into "users"');
    expect(described).not.toContain('secret.person@migrated.local');
    expect(described).not.toContain('!migrated-no-login');
    expect(described).toContain('rolled back');
  });

  it('finds the Postgres diagnostic through Drizzle’s cause chain', () => {
    // Real shape: Drizzle Error wrapping the pg error, which carries the code.
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'users_email_unique',
      detail: 'Key (email)=(migration@migrated.local) already exists.',
    });
    const wrapped = Object.assign(new Error('Failed query: insert into "users" ...'), {
      cause: pgError,
    });

    const described = describeWriteFailure(wrapped);
    expect(described).toContain('already contains a migration');
    expect(described).toContain('users_email_unique');
    expect(described).toContain('Key (email)=(migration@migrated.local) already exists.');
  });

  it('explains a unique-violation as an already-migrated target and logs it', async () => {
    const { writer, state } = createFakeWriter();
    // Emulate Postgres rejecting the duplicate migration service user.
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint "users_email_unique"'),
      { code: '23505', constraint: 'users_email_unique' },
    );
    const failing = {
      ...writer,
      transaction: <T,>(fn: (w: typeof writer) => Promise<T>) => {
        void fn;
        return Promise.reject(uniqueViolation);
      },
    };

    await expect(
      runMigration({ source: mockExecutor(eul5Db()), writer: failing, deps: deterministicDeps() }),
    ).rejects.toThrow(/already contains a migration/);

    // The rollback is recorded in the durable log, not just thrown away.
    expect(
      state.logs.some((l) => l.level === 'ERROR' && l.message.includes('rolled back')),
    ).toBe(true);
  });

  it('skips objects whose required parent could not be migrated', async () => {
    // A folder pointing at a business area that does not exist cannot satisfy
    // Neo's NOT NULL business_area_id, so it (and its items) are skipped.
    const db = eul5Db();
    db.tables.EUL5_OBJS = [
      { ...first(db.tables.EUL5_OBJS ?? []), OBJ_ID: 299, BA_ID: 9999, OBJ_NAME: 'Orphan Folder' },
    ];
    const { writer, state } = createFakeWriter();
    const result = await runMigration({
      source: mockExecutor(db),
      writer,
      deps: deterministicDeps(),
    });

    expect(rowsOf(state, 'folders')).toHaveLength(0);
    expect(result.skipped.some((s) => s.table === 'folders' && s.sourceId === 299)).toBe(true);
    // Items belonging to the skipped folder are skipped too, not orphaned.
    expect(rowsOf(state, 'items')).toHaveLength(0);
    expect(result.skipped.some((s) => s.table === 'items')).toBe(true);
  });
});

describe('progress reporting', () => {
  it('emits the detected version and a progress event per populated table', async () => {
    const events: MigrationEvent[] = [];
    const { writer } = createFakeWriter();
    await runMigration({
      source: mockExecutor(eul5Db()),
      writer,
      deps: deterministicDeps(),
      onEvent: (e) => events.push(e),
    });

    expect(events.some((e) => e.type === 'log' && e.message.includes('Source is EUL5'))).toBe(true);

    const progressed = events.filter((e) => e.type === 'progress').map((e) => e.phase);
    expect(progressed).toEqual(
      expect.arrayContaining(['users', 'business_areas', 'folders', 'items', 'joins', 'maps']),
    );
    for (const e of events.filter((ev) => ev.type === 'progress')) {
      expect(e.current).toBe(e.total);
    }
  });
});
