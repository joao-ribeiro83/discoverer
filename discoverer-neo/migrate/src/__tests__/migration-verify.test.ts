import { describe, it, expect } from '@jest/globals';

import {
  checkFormulaCompileRate,
  checkMeasureSet,
  checkReconciliation,
  checkReferentialClosure,
  checkSqlGeneration,
  formatVerifyReport,
  summarise,
  verifyMigration,
  EXPECTED_LOSS_ALLOWANCES,
  type ExpectedLossAllowance,
  type SeamResult,
  type VerifyDb,
} from '../services/migration-verify.js';

/**
 * The verifier's own branches, driven by a fake database.
 *
 * The seams are exercised against real Postgres from the backend workspace
 * (`migration-seams.test.ts`), which is where the SQL generator lives. That
 * proves they work; it does not reach the reporting, skipping and guard paths,
 * and those are exactly where a verifier quietly turns into a green light
 * wired to nothing.
 *
 * `VerifyDb` is one method, so a queue of canned result sets is the whole
 * fixture. Each seam issues a deterministic sequence of statements.
 */
function fakeDb(pages: Array<Array<Record<string, unknown>>>): VerifyDb {
  let call = 0;
  return {
    execute: () => Promise.resolve({ rows: pages[call++] ?? [] }),
  };
}

const MAP_ROW = { id: 'map-1', name: 'Monthly Sales' };

describe('seam 1 — sql generation', () => {
  it('is SKIPPED, not PASS, without a generator', async () => {
    const result = await checkSqlGeneration(fakeDb([[MAP_ROW]]));
    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toContain('backend workspace');
  });

  it('passes when every map generates', async () => {
    const result = await checkSqlGeneration(fakeDb([[MAP_ROW]]), {
      generateSqlForMap: () => Promise.resolve('SELECT 1'),
    });
    expect(result.status).toBe('PASS');
    expect(result.metrics).toMatchObject({ maps: 1, generated: 1, failed: 0 });
    expect(result.reason).toBeUndefined();
  });

  it('names the map and the reason when one fails', async () => {
    const result = await checkSqlGeneration(fakeDb([[MAP_ROW]]), {
      generateSqlForMap: () => Promise.reject(new Error('Unknown item reference "1,102"')),
    });
    expect(result.status).toBe('FAIL');
    expect(result.findings[0]).toContain('Monthly Sales');
    expect(result.findings[0]).toContain('1,102');
  });

  it('survives a generator that throws a non-Error', async () => {
    const result = await checkSqlGeneration(fakeDb([[MAP_ROW]]), {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      generateSqlForMap: () => Promise.reject('just a string'),
    });
    expect(result.findings[0]).toContain('just a string');
  });

  it('caps its findings, however many maps fail', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, name: `Map ${i}` }));
    const result = await checkSqlGeneration(fakeDb([many]), {
      sampleLimit: 3,
      generateSqlForMap: () => Promise.reject(new Error('nope')),
    });
    expect(result.metrics.failed).toBe(50);
    expect(result.findings).toHaveLength(3);
  });
});

describe('seam 2 — formula compile rate', () => {
  const page = [{ id: 'f1', formula: 'SUM(A)' }, { id: 'f2', formula: '[1,1](x)' }];

  it('is SKIPPED without a compiler, but still counts', async () => {
    const result = await checkFormulaCompileRate(fakeDb([page, []]));
    expect(result.status).toBe('SKIPPED');
    expect(result.metrics.formulas).toBe(2);
    expect(result.metrics.quarantined).toBe(2);
  });

  it('accepts a bare bucket as well as one with a reason', async () => {
    const result = await checkFormulaCompileRate(fakeDb([page, []]), {
      compileFormula: (f) => (f.startsWith('SUM') ? 'COMPILED_UNVERIFIED' : { bucket: 'QUARANTINED', reason: 'token' }),
    });
    expect(result.metrics.compiledUnverified).toBe(1);
    expect(result.metrics.quarantined).toBe(1);
    expect(result.status).toBe('PASS');
  });

  it('never leaves a quarantine unexplained', async () => {
    const result = await checkFormulaCompileRate(fakeDb([page, []]), {
      compileFormula: () => 'QUARANTINED',
    });
    // A bucket handed back with no reason still gets one, so the count and the
    // explanation can never drift apart.
    expect(result.findings.join(' ')).toContain('no reason given');
  });

  it('counts a throwing classifier as FAILED and fails the seam', async () => {
    const result = await checkFormulaCompileRate(fakeDb([page, []]), {
      compileFormula: () => {
        throw new Error('unhandled shape');
      },
    });
    expect(result.metrics.failed).toBe(2);
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('do not handle');
  });

  it('treats a non-string formula column as empty rather than crashing', async () => {
    const result = await checkFormulaCompileRate(fakeDb([[{ id: 'f1', formula: null }], []]), {
      compileFormula: (f) => (f === '' ? { bucket: 'QUARANTINED', reason: 'empty' } : 'COMPILED_UNVERIFIED'),
    });
    expect(result.metrics.quarantined).toBe(1);
  });
});

describe('seam 3 — referential closure', () => {
  const clean = [
    [{ refs: 4, unresolved_item: 0, unresolved_folder: 0, folder_without_data_source: 0, unresolved_data_source: 0, inactive_item: 0, inactive_folder: 0 }],
    [{ c: 0 }],
    [{ c: 0 }],
    [{ c: 0 }],
  ];

  it('passes when nothing is broken', async () => {
    const result = await checkReferentialClosure(fakeDb(clean));
    expect(result.status).toBe('PASS');
    expect(result.metrics.references).toBe(4);
    expect(result.findings).toEqual([]);
  });

  it('reports each broken invariant with its count', async () => {
    const result = await checkReferentialClosure(
      fakeDb([
        [{ refs: 10, unresolved_item: 2, unresolved_folder: 0, folder_without_data_source: 7, unresolved_data_source: 0, inactive_item: 0, inactive_folder: 0 }],
        [{ c: 1 }],
        [{ c: 3 }],
        [{ c: 0 }],
      ]),
    );
    expect(result.status).toBe('FAIL');
    // Largest first — fix what most references hit.
    expect(result.findings[0]).toBe('7x folderWithoutDataSource');
    expect(result.reason).toContain('4 closure invariant');
  });

  it('treats a missing count column as zero', async () => {
    const result = await checkReferentialClosure(fakeDb([[{}], [{}], [{}], [{}]]));
    expect(result.status).toBe('PASS');
    expect(result.metrics.references).toBe(0);
  });
});

describe('seam 4 — reconciliation', () => {
  const one: ExpectedLossAllowance = {
    concept: 'folders',
    table: 'folders',
    sourceCount: 212,
    expectedTarget: 212,
    why: 'Carried across whole.',
    explained: true,
  };

  it('passes when the count matches the declaration', async () => {
    const result = await checkReconciliation(fakeDb([[{ c: 212 }]]), { allowances: [one] });
    expect(result.status).toBe('PASS');
    expect(result.metrics.drifted).toBe(0);
  });

  it('fails short and says by how much', async () => {
    const result = await checkReconciliation(fakeDb([[{ c: 200 }]]), { allowances: [one] });
    expect(result.status).toBe('FAIL');
    expect(result.findings[0]).toContain('short by 12');
    expect(result.metrics.rowsLostToAllowances).toBe(12);
  });

  it('fails over too — a stale declaration is how an allowance becomes permanent', async () => {
    const result = await checkReconciliation(fakeDb([[{ c: 300 }]]), { allowances: [one] });
    expect(result.status).toBe('FAIL');
    expect(result.findings[0]).toContain('over by 88');
    // Recovered rows are not a loss.
    expect(result.metrics.rowsLostToAllowances).toBe(0);
  });

  it('counts a gap nobody has explained', async () => {
    const result = await checkReconciliation(fakeDb([[{ c: 60 }]]), {
      allowances: [{ ...one, concept: 'grants', sourceCount: 138, expectedTarget: 60, explained: false }],
    });
    expect(result.metrics.unexplainedAllowances).toBe(1);
  });

  it('does not count an unmeasured source as a loss', async () => {
    const result = await checkReconciliation(fakeDb([[{ c: 0 }]]), {
      allowances: [{ ...one, sourceCount: null, expectedTarget: 0, explained: false }],
    });
    expect(result.metrics.rowsLostToAllowances).toBe(0);
    expect(result.metrics.unexplainedAllowances).toBe(0);
  });

  it('refuses a table name that is not a bare identifier', async () => {
    await expect(
      checkReconciliation(fakeDb([[{ c: 0 }]]), {
        allowances: [{ ...one, table: 'users; DROP TABLE users' }],
      }),
    ).rejects.toThrow('not a bare table name');
  });

  it('defaults to the checked-in declaration', async () => {
    const result = await checkReconciliation(fakeDb([]), {});
    expect(result.metrics.concepts).toBe(EXPECTED_LOSS_ALLOWANCES.length);
  });
});

describe('seam 5 — measure set', () => {
  /** One estate-shaped row; each case overrides only what it is about. */
  const estate = (over: Record<string, number> = {}) => [
    [
      {
        columns: 25_965,
        axis: 20_014,
        measure: 5_920,
        page: 26,
        unclassified: 5,
        with_aggregate: 1_842,
        measures_without_aggregate: 4_078,
        maps_with_a_measure: 610,
        ...over,
      },
    ],
  ];

  it('passes when the estate has measures carrying an aggregate', async () => {
    const result = await checkMeasureSet(fakeDb(estate()));
    expect(result.status).toBe('PASS');
    expect(result.metrics).toMatchObject({ measure: 5_920, withAggregate: 1_842 });
    expect(result.reason).toBeUndefined();
  });

  it('fails when nothing is on the measure vector', async () => {
    const result = await checkMeasureSet(fakeDb(estate({ measure: 0 })));
    expect(result.status).toBe('FAIL');
    expect(result.reason).toContain('|M| = 0');
    expect(result.findings).toContain('no column is on the measure vector');
  });

  // The state this whole phase existed to leave behind: the split decoded,
  // every aggregate null, and a guard that would run on nothing.
  it('fails when the split exists but no column carries an aggregate', async () => {
    const result = await checkMeasureSet(
      fakeDb(estate({ with_aggregate: 0, measures_without_aggregate: 5_920, maps_with_a_measure: 0 })),
    );
    expect(result.status).toBe('FAIL');
    expect(result.findings).toContain('no column carries an aggregate function');
  });

  // `Detail` is Oracle's marker for "do not aggregate" and 8 152 items carry
  // it. A measure over one is correctly null, so the count is tracked and
  // never failed on — the alternative is defaulting to SUM, which is a wrong
  // number wearing a passing test.
  it('reports measures without an aggregate rather than failing on them', async () => {
    const result = await checkMeasureSet(fakeDb(estate({ measures_without_aggregate: 5_919 })));
    expect(result.status).toBe('PASS');
    expect(result.metrics.measuresWithoutAggregate).toBe(5_919);
  });

  it('fails on an estate with no map columns at all', async () => {
    const result = await checkMeasureSet(fakeDb([[]]));
    expect(result.status).toBe('FAIL');
    expect(result.findings).toEqual(['no map columns to classify']);
  });
});

describe('fixture scoping', () => {
  // Every seam accepts a map-id prefix so a test fixture's own rows can be
  // verified inside a database that also holds a real estate. Without it the
  // seam tests would either need their own database or would silently report
  // the live numbers.
  it('scopes each seam to a prefix without changing what it concludes', async () => {
    const generation = await checkSqlGeneration(fakeDb([[MAP_ROW]]), {
      mapIdPrefix: '5ea11e57-',
      generateSqlForMap: () => Promise.resolve('SELECT 1'),
    });
    expect(generation.status).toBe('PASS');

    const closure = await checkReferentialClosure(fakeDb([[{ refs: 1 }], [{ c: 0 }], [{ c: 0 }], [{ c: 0 }]]), {
      mapIdPrefix: '5ea11e57-',
    });
    expect(closure.status).toBe('PASS');

    const reconciliation = await checkReconciliation(fakeDb([[{ c: 2 }]]), {
      mapIdPrefix: '5ea11e57-',
      allowances: [
        { concept: 'folders', table: 'folders', sourceCount: 2, expectedTarget: 2, why: 'fixture', explained: true },
      ],
    });
    expect(reconciliation.status).toBe('PASS');

    const measures = await checkMeasureSet(
      fakeDb([[{ columns: 2, measure: 1, with_aggregate: 1 }]]),
      { mapIdPrefix: '5ea11e57-' },
    );
    expect(measures.status).toBe('PASS');
  });
});

describe('report assembly', () => {
  const pass: SeamResult = { id: 'reconciliation', name: 'ok', status: 'PASS', metrics: { a: 1 }, findings: [] };
  const skip: SeamResult = { id: 'sql-generation', name: 'skipped', status: 'SKIPPED', metrics: {}, findings: [], reason: 'no generator' };
  const fail: SeamResult = { id: 'referential-closure', name: 'broken', status: 'FAIL', metrics: {}, findings: ['7x x'], reason: '7 broken' };

  it('is VERIFIED only when nothing failed', () => {
    expect(summarise('db', [pass]).status).toBe('VERIFIED');
    // SKIPPED is not a failure, and it is not a pass either — it just cannot
    // block, which is why the command that skips says so in its output.
    expect(summarise('db', [pass, skip]).status).toBe('VERIFIED');
    expect(summarise('db', [pass, fail]).status).toBe('COMPLETED_WITH_BLOCKERS');
  });

  it('lists one blocker per failing seam', () => {
    const report = summarise('db', [fail, pass]);
    expect(report.blockers).toEqual(['referential-closure: 7 broken']);
  });

  it('falls back to the seam name when a failure carries no reason', () => {
    const report = summarise('db', [{ ...fail, reason: undefined }]);
    expect(report.blockers[0]).toBe('referential-closure: broken');
  });

  it('renders status, metrics, reasons and findings', () => {
    const text = formatVerifyReport(summarise('discoverer_neo', [fail, skip]));
    expect(text).toContain('discoverer_neo');
    expect(text).toContain('COMPLETED_WITH_BLOCKERS');
    expect(text).toContain('· 7x x');
    expect(text).toContain('BLOCKER');
  });

  it('runs every seam and names the database', async () => {
    const report = await verifyMigration(
      fakeDb([
        [{ db: 'discoverer_neo' }],
        [], // seam 1: no maps
        [], // seam 2: no formulas
        [{}], [{}], [{}], [{}], // seam 3
        [{ columns: 1, measure: 1, with_aggregate: 1 }], // seam 5
      ]),
      { allowances: [] },
    );
    expect(report.target).toBe('discoverer_neo');
    expect(report.seams.map((s) => s.id)).toEqual([
      'sql-generation',
      'formula-compile',
      'referential-closure',
      'reconciliation',
      'measure-set',
    ]);
  });

  it('says "unknown" rather than guessing when the database will not name itself', async () => {
    const report = await verifyMigration(fakeDb([[]]), { allowances: [] });
    expect(report.target).toBe('unknown');
  });
});
