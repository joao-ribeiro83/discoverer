/**
 * Joins-only re-import (Phase 3.2, MIG-01).
 *
 * The interesting part is not the SQL — it is the NAME mapping. The target
 * stores no source ids, so a source join's folders and predicate items have to
 * be found by name, and every failure to find one has to become a visible
 * skip rather than a silently half-written join.
 */

import { describe, it, expect } from '@jest/globals';

import { eul5Db, mockExecutor } from '../testing/mock-eul.js';
import type { MockDb } from '../testing/mock-eul.js';
import {
  itemKey,
  reimportJoins,
  type JoinReimportDb,
} from '../services/join-reimport.js';

/**
 * A `JoinReimportDb` over plain maps, recording what would be written.
 *
 * The fixture's names come from `eul5Db()`: folders `Invoice Headers` (200)
 * and `Sales Summary` (201); items `Invoice Amount` (300) and
 * `Amount With Tax` (301) in the first, `Region` (302) in the second.
 */
function fakeDb(overrides: { folders?: string[]; items?: Array<[string, string]> } = {}) {
  const folderNames = overrides.folders ?? ['Invoice Headers', 'Sales Summary'];
  const itemPairs =
    overrides.items ??
    ([
      ['Invoice Headers', 'Invoice Amount'],
      ['Invoice Headers', 'Amount With Tax'],
      ['Sales Summary', 'Region'],
    ] as Array<[string, string]>);

  const written = {
    joins: [] as Array<Record<string, unknown>>,
    predicates: [] as Array<Record<string, unknown>>,
    deleted: 0,
  };

  const db: JoinReimportDb = {
    folderIdsByName: async () =>
      new Map(folderNames.map((name, i) => [name, `folder-${i}`])),
    itemIdsByFolderAndName: async () =>
      new Map(itemPairs.map(([f, n], i) => [itemKey(f, n), `item-${i}`])),
    replaceJoins: async (joins, predicates) => {
      written.joins = joins;
      written.predicates = predicates;
      written.deleted = 3; // pretend the target held three stale rows
      return {
        joinsDeleted: 3,
        joinsInserted: joins.length,
        predicatesInserted: predicates.length,
      };
    },
  };
  return { db, written };
}

let idCounter = 0;
const deps = {
  genId: () => `id-${++idCounter}`,
  now: () => new Date('2026-01-01T00:00:00Z'),
};

describe('reimportJoins', () => {
  it('rewrites the join with its flags, orientation and predicate', async () => {
    const { db, written } = fakeDb();
    const result = await reimportJoins({
      source: mockExecutor(eul5Db()),
      db,
      version: 'EUL5',
      deps,
    });

    expect(result.read).toBe(1);
    expect(result.written).toBe(1);
    expect(result.joinsDeleted).toBe(3);

    // MASTER is `FK_OBJ_ID_REMOTE` (folder 201, `Sales Summary`) and DETAIL is
    // `KEY_OBJ_ID` (folder 200, `Invoice Headers`) — D-040.
    expect(written.joins[0]).toMatchObject({
      name: 'Invoices to Summary',
      leftFolderId: 'folder-1',
      rightFolderId: 'folder-0',
      oneToOne: false,
      allowMasterNoDetail: true,
      allowDetailNoMaster: false,
      mandatory: true,
      predicateFormula: '[1,81]([6,300],[6,302])',
    });

    // The predicate's operands were written detail-first in the source, so a
    // correct read has to have reordered them onto the master/detail axis.
    expect(written.predicates).toHaveLength(1);
    expect(written.predicates[0]).toMatchObject({
      seq: 0,
      leftItemId: 'item-2', // Sales Summary / Region — the MASTER side
      rightItemId: 'item-0', // Invoice Headers / Invoice Amount — the DETAIL
      operator: '=',
    });
  });

  it('writes nothing on a dry run, but reports the same counts', async () => {
    const { db, written } = fakeDb();
    const result = await reimportJoins({
      source: mockExecutor(eul5Db()),
      db,
      version: 'EUL5',
      dryRun: true,
      deps,
    });

    expect(result.dryRun).toBe(true);
    expect(result.written).toBe(1);
    expect(result.predicates).toBe(1);
    expect(result.joinsDeleted).toBe(0);
    expect(written.joins).toEqual([]);
  });

  it('skips a join whose folder is not in the target, and says which', async () => {
    // The master folder is missing from the target, so the join cannot be
    // written at all. Writing it with one endpoint would be a join between the
    // wrong tables.
    const { db, written } = fakeDb({ folders: ['Invoice Headers'] });
    const result = await reimportJoins({
      source: mockExecutor(eul5Db()),
      db,
      version: 'EUL5',
      deps,
    });

    expect(result.written).toBe(0);
    expect(written.joins).toEqual([]);
    expect(result.skipped).toEqual([
      {
        sourceId: 400,
        name: 'Invoices to Summary',
        reason: 'join folder(s) are not in the target',
      },
    ]);
  });

  it('keeps a predicate row with a null endpoint rather than dropping it', async () => {
    // The master-side item did not migrate. The component must still exist:
    // dropping it would shorten the emitted ON clause and return MORE rows
    // than the source did. A null endpoint refuses at query time instead.
    const { db, written } = fakeDb({
      items: [['Invoice Headers', 'Invoice Amount']],
    });
    await reimportJoins({
      source: mockExecutor(eul5Db()),
      db,
      version: 'EUL5',
      deps,
    });

    expect(written.predicates).toHaveLength(1);
    expect(written.predicates[0]).toMatchObject({
      leftItemId: null,
      rightItemId: 'item-0',
    });
  });

  it('names a join that arrives with no readable predicate (D-039)', async () => {
    const source = eul5Db();
    source.tables.EUL5_EXPRESSIONS = (source.tables.EUL5_EXPRESSIONS ?? []).filter(
      (row) => row.EXP_TYPE !== 'JP',
    );
    const { db, written } = fakeDb();
    const result = await reimportJoins({
      source: mockExecutor(source as MockDb),
      db,
      version: 'EUL5',
      deps,
    });

    // Migrated, not skipped — the folders are fine. But it cannot generate SQL,
    // so it is reported by NAME, which is what the operator needs before a user
    // meets the refusal.
    expect(result.written).toBe(1);
    expect(written.predicates).toEqual([]);
    expect(result.withoutPredicate).toEqual([
      { sourceId: 400, name: 'Invoices to Summary' },
    ]);
  });
});
