/* eslint-disable @typescript-eslint/require-await -- an in-memory fake of an async seam */
/**
 * Incremental delta (Phase 9.2). Each test migrates the fixture EUL into an
 * in-memory target, changes the source, and checks the delta writes exactly
 * that change — and nothing when nothing moved.
 */

import { describe, expect, it } from '@jest/globals';

import type { TargetTable } from '../db/schema.js';
import { commandDelta, EXIT_ERROR, EXIT_OK } from '../cli.js';
import { DeltaRefusedError, runDelta, unitHash } from '../services/delta.js';
import type { BaselineEntry, DeltaDb, DeltaTx } from '../services/delta.js';
import { MigrationRunError, runMigration } from '../services/migration-runner.js';
import { createFakeWriter } from '../testing/fake-writer.js';
import type { FakeTables } from '../testing/fake-writer.js';
import { eul5Db, mockExecutor } from '../testing/mock-eul.js';
import type { MockDb } from '../testing/mock-eul.js';

type Row = Record<string, unknown>;

function deterministicDeps() {
  let n = 0;
  return {
    genId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    now: () => new Date('2026-07-18T00:00:00.000Z'),
  };
}

interface FakeState {
  tables: FakeTables;
  baseline: Map<string, BaselineEntry>;
  logs: Array<{ level: string; phase?: string | null; message: string }>;
  transactions: number;
  writes: Array<[string, TargetTable]>;
}

function fakeDeltaDb(tables: FakeTables, failOn?: 'insert' | 'update'): { db: DeltaDb; state: FakeState } {
  const state: FakeState = { tables: structuredClone(tables), baseline: new Map(), logs: [], transactions: 0, writes: [] };
  const tx: DeltaTx = {
    async insert(table, rows) {
      if (rows.length === 0) return;
      if (failOn === 'insert') throw new Error('insert failed');
      state.writes.push(['insert', table]);
      state.tables[table].push(...structuredClone(rows));
    },
    async update(table, id, values) {
      if (failOn === 'update') throw new Error('update failed');
      state.writes.push(['update', table]);
      Object.assign(state.tables[table].find((r) => r.id === id) as Row, values);
    },
    async deleteWhere(table, column, values) {
      state.writes.push(['delete', table]);
      state.tables[table] = state.tables[table].filter((r) => !values.includes(r[column] as string));
    },
    async readRows(table) {
      return state.tables[table];
    },
    async saveBaseline(_runId, upsert, remove) {
      for (const [key, entry] of upsert) state.baseline.set(key, entry);
      for (const key of remove) state.baseline.delete(key);
    },
  };
  const db: DeltaDb = {
    async ensureSchema() {},
    async log(entry) {
      state.logs.push(entry);
    },
    async readBaseline() {
      return new Map(state.baseline);
    },
    async readRows(table) {
      return structuredClone(state.tables[table]);
    },
    async transaction(fn) {
      state.transactions += 1;
      const before = structuredClone({ tables: state.tables, baseline: state.baseline });
      try {
        return await fn(tx);
      } catch (err) {
        state.tables = before.tables;
        state.baseline = before.baseline;
        throw err;
      }
    },
  };
  return { db, state };
}

/** A target holding a full migration of `source`. */
async function migrated(source: MockDb = eul5Db(), failOn?: 'insert' | 'update') {
  const { writer, state } = createFakeWriter();
  await runMigration({ source: mockExecutor(source), writer, deps: deterministicDeps() });
  return fakeDeltaDb(state.tables, failOn);
}

/** A target that has already had its first delta, so it holds a baseline. */
async function withBaseline(failOn?: 'insert' | 'update') {
  const fake = await migrated(eul5Db(), failOn);
  await runDelta({ source: mockExecutor(eul5Db()), db: fake.db });
  fake.state.writes = [];
  fake.state.logs = [];
  return fake;
}

const other = (kind: string) => (c: { kind: string }) => c.kind !== kind;

describe('runDelta', () => {
  it('adopts a baseline on the first run, and a second run with no source change is a no-op', async () => {
    const { db, state } = await migrated();

    const first = await runDelta({ source: mockExecutor(eul5Db()), db });
    expect(first.adopted).toBe(true);
    expect(first.changes).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(state.baseline.size).toBe(first.objects);

    const transactions = state.transactions;
    const second = await runDelta({ source: mockExecutor(eul5Db()), db });
    expect(second.noop).toBe(true);
    expect(second.changes).toEqual([]);
    expect(state.transactions).toBe(transactions);
    expect(state.logs.at(-1)?.message).toBe('No change since the last recorded run.');
  });

  it('applies only the object that changed, in place', async () => {
    const { db, state } = await withBaseline();
    const before = structuredClone(state.tables);
    const source = eul5Db();
    (source.tables.EUL5_EXPRESSIONS as Row[]).find((r) => r.EXP_ID === 301)!.EXP_NAME = 'Amount Incl Tax';

    const result = await runDelta({ source: mockExecutor(source), db });

    expect(result.changes).toEqual([{ key: 'item:301', table: 'items', kind: 'changed' }]);
    expect(state.writes).toEqual([['update', 'items']]);
    const item = state.tables.items.find((r) => r.name === 'Amount Incl Tax');
    expect(item?.id).toBe(before.items.find((r) => r.name === 'Amount With Tax')?.id);
    for (const table of Object.keys(before) as TargetTable[]) {
      if (table !== 'items') expect(state.tables[table]).toEqual(before[table]);
    }
  });

  it('re-adopts rows a maps re-import replaced under new ids, instead of calling them missing', async () => {
    const { db, state } = await withBaseline()
    // A maps re-import deletes every migrated map and writes it again with a
    // fresh id (children and shares follow), without touching the record.
    const mapChildren = ['map_items', 'map_conditions', 'map_parameters', 'map_calculated_fields', 'map_totals', 'map_layouts', 'map_page_setup', 'map_shares'] as const
    const renamed = new Map<string, string>()
    for (const row of state.tables.maps) {
      const next = `11111111-2222-4333-8444-${String(renamed.size + 1).padStart(12, '0')}`
      renamed.set(String(row.id), next)
      row.id = next
    }
    for (const table of mapChildren) {
      for (const row of state.tables[table] ?? []) {
        const mapped = renamed.get(String(row.mapId))
        if (mapped) row.mapId = mapped
      }
    }

    const result = await runDelta({ source: mockExecutor(eul5Db()), db })

    expect(result.changes.filter((c) => c.kind === 'missing')).toEqual([])
    expect(result.changes.filter((c) => c.kind === 'added')).toEqual([])
    expect(state.tables.maps.map((m) => m.id)).toEqual([...renamed.values()])
    for (const key of [...state.baseline.keys()].filter((k) => k.startsWith('map:'))) {
      expect(renamed.has(state.baseline.get(key)!.targetId)).toBe(false)
      expect([...renamed.values()]).toContain(state.baseline.get(key)!.targetId)
    }
    expect((await runDelta({ source: mockExecutor(eul5Db()), db })).noop).toBe(true)
  })

  it('a dry run reports the change and writes nothing', async () => {
    const { db, state } = await withBaseline();
    const source = eul5Db();
    (source.tables.EUL5_EXPRESSIONS as Row[]).find((r) => r.EXP_ID === 301)!.EXP_NAME = 'Amount Incl Tax';

    const result = await runDelta({ source: mockExecutor(source), db, dryRun: true });

    expect(result.changes.map((c) => c.key)).toEqual(['item:301']);
    expect(state.writes).toEqual([]);
    expect(state.logs.filter((l) => l.phase === 'delta')).toHaveLength(0);
  });

  it('refuses to delete an object the source lost, and reports it every run until Neo drops it', async () => {
    const { db, state } = await withBaseline();
    const source = eul5Db();
    source.tables.EUL5_FUNCTIONS = [];

    const result = await runDelta({ source: mockExecutor(source), db });

    expect(result.changes).toEqual([{ key: 'function:600', table: 'custom_functions', kind: 'deleted' }]);
    expect(state.tables.custom_functions).toHaveLength(1);
    expect(state.logs.some((l) => l.level === 'WARN' && l.message.includes('function:600'))).toBe(true);

    // Still reported next time …
    expect((await runDelta({ source: mockExecutor(source), db })).changes.map((c) => c.kind)).toEqual(['deleted']);
    // … until the operator removes it in Neo; then it leaves the baseline.
    state.tables.custom_functions = [];
    await runDelta({ source: mockExecutor(source), db });
    expect(state.baseline.has('function:600')).toBe(false);
    expect((await runDelta({ source: mockExecutor(source), db })).noop).toBe(true);
  });

  it('keeps a worksheet whose item was deleted: rewrites its columns in place, keeps the item', async () => {
    const { db, state } = await withBaseline();
    const mapIds = state.tables.maps.map((m) => m.id);
    const source = eul5Db();
    source.tables.EUL5_EXPRESSIONS = (source.tables.EUL5_EXPRESSIONS as Row[]).filter((r) => r.EXP_ID !== 300);

    const result = await runDelta({ source: mockExecutor(source), db });

    expect(result.changes.filter((c) => c.kind === 'deleted').map((c) => c.key)).toContain('item:300');
    expect(result.changes.filter((c) => c.kind === 'changed').map((c) => c.table)).toContain('maps');
    expect(state.tables.maps.map((m) => m.id)).toEqual(mapIds);
    expect(state.writes.some(([op, t]) => op === 'delete' && (t === 'maps' || t === 'items'))).toBe(false);
    expect(state.tables.items.some((i) => i.name === 'Invoice Amount')).toBe(true);
  });

  it('revokes a grant the source revoked, and deactivates a user the source deleted', async () => {
    const { db, state } = await withBaseline();
    const source = eul5Db();
    source.tables.EUL5_ACCESS_PRIVS = (source.tables.EUL5_ACCESS_PRIVS as Row[]).filter((r) => r.AP_ID !== 802);
    source.tables.EUL5_EUL_USERS = (source.tables.EUL5_EUL_USERS as Row[]).filter((r) => r.EU_ID !== 901);
    const grantsBefore = state.tables.user_business_area_grants.length;

    const result = await runDelta({ source: mockExecutor(source), db });

    // MJONES also held a workbook grant, so its map shares go with it: an
    // account the source deleted keeps no access to anyone's maps.
    expect(result.changes.filter(other('changed')).map((c) => [c.kind, c.key]).sort()).toEqual([
      ['deactivated', 'user:MJONES'],
      ['revoked', 'grant:SALES_ROLE|100|VIEW'],
      ['revoked', 'map_share:map:700:{11111111-1111-1111-1111-111111111111}|MJONES'],
    ]);
    expect(state.tables.user_business_area_grants).toHaveLength(grantsBefore - 1);
    expect(state.tables.users.find((u) => String(u.name).toUpperCase().includes('MJONES'))?.isActive).toBe(false);
  });

  it('adds a new source object with no change to anything else', async () => {
    const { db, state } = await withBaseline();
    const source = eul5Db();
    (source.tables.EUL5_FUNCTIONS as Row[]).push({ FUN_ID: 601, FUN_NAME: 'GET_FISCAL_QTR', FUN_DESCRIPTION: null });

    const result = await runDelta({ source: mockExecutor(source), db });

    expect(result.changes).toEqual([{ key: 'function:601', table: 'custom_functions', kind: 'added' }]);
    expect(state.writes).toEqual([['insert', 'custom_functions']]);
    expect(state.baseline.has('function:601')).toBe(true);
  });

  it('rolls a failed delta back completely, baseline included', async () => {
    const { db, state } = await withBaseline('update');
    const before = structuredClone({ tables: state.tables, baseline: state.baseline });
    const source = eul5Db();
    (source.tables.EUL5_FUNCTIONS as Row[]).push({ FUN_ID: 601, FUN_NAME: 'GET_FISCAL_QTR', FUN_DESCRIPTION: null });
    (source.tables.EUL5_EXPRESSIONS as Row[]).find((r) => r.EXP_ID === 301)!.EXP_NAME = 'Amount Incl Tax';

    await expect(runDelta({ source: mockExecutor(source), db })).rejects.toThrow('update failed');

    expect(state.tables).toEqual(before.tables);
    expect(state.baseline).toEqual(before.baseline);
    expect(state.logs.some((l) => l.level === 'ERROR' && l.message.startsWith('Delta rolled back'))).toBe(true);
  });

  it('refuses when a migrated grant is broader than the source', async () => {
    const { db, state } = await migrated();
    const service = state.tables.users.find((u) => String(u.email).startsWith('migration@'))!;
    const mjones = state.tables.users.find((u) => String(u.name).toUpperCase().includes('MJONES'))!;
    state.tables.user_business_area_grants.push({
      id: '11111111-1111-4111-8111-111111111111',
      userId: mjones.id,
      businessAreaId: state.tables.business_areas.find((b) => b.name === 'Sales Analysis')!.id,
      permissionLevel: 'ADMIN',
      grantedBy: service.id,
    });

    await expect(runDelta({ source: mockExecutor(eul5Db()), db })).rejects.toThrow(DeltaRefusedError);
    expect(state.baseline.size).toBe(0);
  });

  it('refuses a target that has never been migrated', async () => {
    const { writer, state } = createFakeWriter();
    const { db } = fakeDeltaDb(state.tables);
    void writer;
    await expect(runDelta({ source: mockExecutor(eul5Db()), db })).rejects.toThrow(/not been migrated/);
  });

  it('leaves the full-migration re-run guard refusing after a delta', async () => {
    const { db, state } = await withBaseline();
    await runDelta({ source: mockExecutor(eul5Db()), db });
    const { writer } = createFakeWriter({
      tables: state.tables,
      existingUserEmails: state.tables.users.map((u) => String(u.email)),
    });
    await expect(runMigration({ source: mockExecutor(eul5Db()), writer })).rejects.toThrow(MigrationRunError);
  });
});

describe('commandDelta', () => {
  const io = () => {
    const lines: string[] = [];
    return { lines, io: { out: (l: string) => lines.push(l), err: (l: string) => lines.push(l) } };
  };
  const options = { readOptions: {}, version: 'auto' as const, json: false };

  it('runs the verifier after a real delta and passes its verdict through', async () => {
    const { db, state } = await withBaseline();
    const source = eul5Db();
    source.tables.EUL5_EXPRESSIONS = (source.tables.EUL5_EXPRESSIONS as Row[]).filter((r) => r.EXP_ID !== 300);
    const calls: Array<{ compile: boolean; writesSoFar: number }> = [];
    const out = io();

    const code = await commandDelta(
      mockExecutor(source),
      db,
      async (compile) => {
        calls.push({ compile, writesSoFar: state.writes.length });
        return EXIT_ERROR; // the verifier found blockers
      },
      { ...options, dryRun: false },
      out.io,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.writesSoFar).toBeGreaterThan(0); // after the delta, not before
    expect(calls[0]?.compile).toBe(true); // a worksheet was rewritten
    expect(code).toBe(EXIT_ERROR);
    expect(out.lines).toContain('  REFUSED DELETE item:300 — remove it in Neo if it should go');
  });

  it('does not verify a dry run, and exits 0 when there is nothing to decide', async () => {
    const { db } = await withBaseline();
    let verified = false;
    const out = io();

    const code = await commandDelta(
      mockExecutor(eul5Db()),
      db,
      async () => {
        verified = true;
        return EXIT_OK;
      },
      { ...options, dryRun: true },
      out.io,
    );

    expect(verified).toBe(false);
    expect(code).toBe(EXIT_OK);
    expect(out.lines).toContain('  no change since the last recorded run');
  });
});

describe('unitHash', () => {
  // A condition group id is minted per run: only which rows share it may count.
  const columns = new Map<TargetTable, string[]>([
    ['maps', ['name']],
    ['map_conditions', ['groupId', 'mapId', 'operator']],
  ]);
  const unit = (groups: [string, string, string]) => ({
    key: 'map:1:#0',
    table: 'maps' as const,
    row: { id: 'aaaaaaaa-0000-4000-8000-000000000000', name: 'Sheet 1' },
    children: groups.map((groupId, i): ['map_conditions', Row] => [
      'map_conditions',
      { id: `cccccccc-0000-4000-8000-00000000000${i}`, mapId: 'aaaaaaaa-0000-4000-8000-000000000000', operator: ['=', '>', '<'][i], groupId },
    ]),
  });
  const g1 = '11111111-1111-4111-8111-111111111111';
  const g2 = '22222222-2222-4222-8222-222222222222';
  const g3 = '33333333-3333-4333-8333-333333333333';
  const none = () => undefined;

  it('ignores the value of a per-run token but not how rows share it', () => {
    expect(unitHash(unit([g1, g1, g2]), columns, none)).toBe(unitHash(unit([g3, g3, g1]), columns, none));
    expect(unitHash(unit([g1, g1, g2]), columns, none)).not.toBe(unitHash(unit([g1, g2, g2]), columns, none));
  });
});
