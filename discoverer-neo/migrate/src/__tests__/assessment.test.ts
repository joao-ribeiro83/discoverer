import { describe, it, expect } from '@jest/globals';

import {
  assessComplexity,
  estimateMigration,
  findOrphans,
  generateAssessmentReport,
  scoreReadiness,
  validateEulData,
} from '../services/assessment.js';
import { readEulSchema } from '../services/eul-reader.js';
import type {
  EulFullData,
  EulReadResult,
  ParsedWorkbook,
} from '../services/eul-reader.js';
import type {
  BusinessArea,
  EulVersion,
  EulVersionInfo,
  Folder,
  Hierarchy,
  Item,
  Join,
} from '../types/eul-versions.js';
import { EUL_PREFIX } from '../types/eul-versions.js';
import { eul3Db, eul4Db, eul5Db, mockExecutor } from './helpers/mock-eul.js';

// ---------------------------------------------------------------------------
// Synthetic-data factories (precise control over counts and references)
// ---------------------------------------------------------------------------

function version(v: EulVersion, overrides: Partial<EulVersionInfo> = {}): EulVersionInfo {
  return {
    version: v,
    prefix: EUL_PREFIX[v],
    discovererVersion: 'x',
    schemaVersion: v === 'EUL5' ? '5.1.0.0.0' : v === 'EUL4' ? '4.1.8.0.0' : '3.1.0.0.0',
    tableNames: [],
    owner: 'EUL_US',
    supported: v !== 'EUL3',
    warnings: [],
    ...overrides,
  };
}

function ba(sourceId: number, name = `BA${sourceId}`): BusinessArea {
  return {
    sourceId,
    name,
    description: null,
    language: 'US',
    developerKey: null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
  };
}

function folder(sourceId: number, businessAreaId: number | null, folderType = 'TABLE'): Folder {
  return {
    sourceId,
    businessAreaId,
    name: `Folder${sourceId}`,
    description: null,
    folderType,
    tableName: null,
    tableOwner: null,
    sequence: null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
  };
}

function item(sourceId: number, folderId: number | null, expType = 'CI'): Item {
  return {
    sourceId,
    folderId,
    name: `Item${sourceId}`,
    description: null,
    expType,
    formula: null,
    columnName: null,
    dataType: null,
    formatMask: null,
    aggregation: null,
    sequence: null,
    nullsAllowed: true,
    parentItemId: null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
  };
}

function join(sourceId: number, components: Join['components']): Join {
  return {
    sourceId,
    name: `Join${sourceId}`,
    description: null,
    joinType: 'INNER',
    components,
    createdBy: null,
    createdAt: null,
  };
}

function hierarchy(sourceId: number, businessAreaId: number | null): Hierarchy {
  return {
    sourceId,
    businessAreaId,
    name: `Hier${sourceId}`,
    description: null,
    levels: [],
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
  };
}

function workbook(sourceId: number, content: string | null, parsed: boolean): ParsedWorkbook {
  return {
    sourceId,
    name: `WB${sourceId}`,
    description: null,
    content,
    owner: null,
    developerKey: null,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
    info: {
      parsed,
      rootName: parsed ? 'workbook' : null,
      worksheetCount: parsed ? 1 : 0,
      worksheets: parsed ? [{ name: 'S1' }] : [],
      itemReferenceCount: 0,
      ...(parsed ? {} : { parseError: 'not xml' }),
    },
  };
}

function data(overrides: Partial<EulFullData> = {}): EulFullData {
  return {
    businessAreas: [],
    folders: [],
    items: [],
    conditions: [],
    securityConditions: [],
    joins: [],
    hierarchies: [],
    customFunctions: [],
    users: [],
    grants: [],
    workbooks: [],
    workbookUsage: [],
    ...overrides,
  };
}

function eul(v: EulVersion, d: Partial<EulFullData>, vOverrides: Partial<EulVersionInfo> = {}): EulReadResult {
  return { version: version(v, vOverrides), data: data(d) };
}

// ---------------------------------------------------------------------------
// findOrphans
// ---------------------------------------------------------------------------

describe('findOrphans', () => {
  it('flags items with missing/null folders, empty joins, and dangling parents', () => {
    const orphans = findOrphans(
      data({
        businessAreas: [ba(100)],
        folders: [folder(10, 100)],
        items: [item(1, 10), item(2, 999), item(3, null)],
        joins: [join(20, []), join(21, [{ masterItemId: 1, detailItemId: 1, operator: '=' }])],
        hierarchies: [hierarchy(30, 999)],
      }),
    );

    expect(orphans.itemsWithoutFolder.map((o) => o.sourceId)).toEqual([2, 3]);
    expect(orphans.joinsWithoutComponents.map((o) => o.sourceId)).toEqual([20]);
    expect(orphans.hierarchiesWithoutBusinessArea.map((o) => o.sourceId)).toEqual([30]);
    expect(orphans.foldersWithoutBusinessArea).toHaveLength(0);
    expect(orphans.total).toBe(4);
  });

  it('flags folders referencing a missing business area', () => {
    const orphans = findOrphans(
      data({ businessAreas: [ba(1)], folders: [folder(10, 1), folder(11, 999), folder(12, null)] }),
    );
    expect(orphans.foldersWithoutBusinessArea.map((o) => o.sourceId)).toEqual([11, 12]);
  });
});

// ---------------------------------------------------------------------------
// assessComplexity
// ---------------------------------------------------------------------------

describe('assessComplexity', () => {
  it('scores a tiny EUL as simple and lists only non-zero factors', () => {
    const result = assessComplexity(data({ businessAreas: [ba(1)], folders: [folder(10, 1)] }));
    expect(result.score).toBe('simple');
    expect(result.points).toBeLessThan(20);
    expect(result.factors.map((f) => f.label)).toEqual(['Business areas', 'Folders']);
  });

  it('scores a heavy EUL as complex', () => {
    const result = assessComplexity(
      data({
        businessAreas: Array.from({ length: 5 }, (_, i) => ba(i + 1)),
        folders: Array.from({ length: 40 }, (_, i) => folder(i + 100, 1)),
        joins: Array.from({ length: 20 }, (_, i) => join(i + 200, [])),
        hierarchies: Array.from({ length: 6 }, (_, i) => hierarchy(i + 300, 1)),
        items: Array.from({ length: 15 }, (_, i) => item(i + 400, 100, 'CU')),
        customFunctions: Array.from({ length: 8 }, (_, i) => ({
          sourceId: i + 500,
          name: `F${i}`,
          description: null,
        })),
      }),
    );
    expect(result.score).toBe('complex');
    expect(result.points).toBeGreaterThanOrEqual(60);
  });

  it('separates calculated items (CU) from plain items (CI) in the score', () => {
    const withCalc = assessComplexity(
      data({ items: [item(1, 10, 'CI'), item(2, 10, 'CU'), item(3, 10, 'CU')] }),
    );
    const calcFactor = withCalc.factors.find((f) => f.label === 'Calculated items');
    expect(calcFactor?.count).toBe(2); // only the CU rows
  });
});

// ---------------------------------------------------------------------------
// estimateMigration
// ---------------------------------------------------------------------------

describe('estimateMigration', () => {
  it('sums per-object effort and counts total objects', () => {
    const estimate = estimateMigration(
      eul('EUL5', {
        businessAreas: [ba(1)],
        folders: [folder(10, 1), folder(11, 1)],
        items: [item(1, 10), item(2, 10)],
      }),
    );
    expect(estimate.totalObjects).toBe(5);
    expect(estimate.estimatedMinutes).toBeGreaterThan(0);
    expect(estimate.humanReadable).toMatch(/min|h|day/);
  });

  it('inflates the estimate for EUL3 sources', () => {
    const d = { businessAreas: [ba(1)], folders: [folder(10, 1)] };
    const five = estimateMigration(eul('EUL5', d));
    const three = estimateMigration(eul('EUL3', d, { supported: false }));
    expect(three.estimatedMinutes).toBeGreaterThan(five.estimatedMinutes);
  });
});

// ---------------------------------------------------------------------------
// scoreReadiness
// ---------------------------------------------------------------------------

describe('scoreReadiness', () => {
  it('rates an unsupported version as not-supported with a blocker', () => {
    const e = eul('EUL3', {}, { supported: false });
    const readiness = scoreReadiness(e, findOrphans(e.data), []);
    expect(readiness.rating).toBe('not-supported');
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.score).toBeLessThan(50);
  });

  it('rates a clean supported EUL as ready', () => {
    const e = eul('EUL5', { businessAreas: [ba(1)], folders: [folder(10, 1)] });
    const readiness = scoreReadiness(e, findOrphans(e.data), []);
    expect(readiness.rating).toBe('ready');
    expect(readiness.score).toBe(100);
  });

  it('deducts for warnings and orphans', () => {
    const e = eul('EUL5', {
      businessAreas: [ba(1)],
      items: [item(1, 999)], // orphan
    });
    const orphans = findOrphans(e.data);
    const readiness = scoreReadiness(e, orphans, [
      { severity: 'warning', code: 'X', message: 'x' },
    ]);
    expect(readiness.score).toBeLessThan(100);
    expect(readiness.notes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateAssessmentReport (end-to-end over mock reads)
// ---------------------------------------------------------------------------

describe('generateAssessmentReport', () => {
  it('EUL5: counts objects and flags Security Manager conditions', async () => {
    const report = generateAssessmentReport(await readEulSchema(mockExecutor(eul5Db())));

    expect(report.version.version).toBe('EUL5');
    expect(report.counts.businessAreas).toBe(1);
    expect(report.counts.items).toBe(2);
    expect(report.counts.calculatedItems).toBe(1);
    expect(report.counts.securityConditions).toBe(1);
    expect(report.folderTypeBreakdown).toMatchObject({ TABLE: 1, SUMMARY: 1 });
    expect(report.warnings.some((w) => w.code === 'SECURITY_MANAGER')).toBe(true);
    expect(report.readiness.rating).not.toBe('not-supported');
  });

  it('EUL4: warns about defaulted columns and the legacy security model', async () => {
    const report = generateAssessmentReport(await readEulSchema(mockExecutor(eul4Db())));

    expect(report.version.version).toBe('EUL4');
    const codes = report.warnings.map((w) => w.code);
    expect(codes).toContain('DEFAULTED_COLUMNS');
    expect(codes).toContain('SECURITY_MODEL');
    const defaulted = report.warnings.find((w) => w.code === 'DEFAULTED_COLUMNS');
    expect(defaulted?.message).toContain('BA_LANGUAGE');
  });

  it('EUL3: is rated not-supported with an error-level warning', async () => {
    const report = generateAssessmentReport(await readEulSchema(mockExecutor(eul3Db())));

    expect(report.version.version).toBe('EUL3');
    expect(report.readiness.rating).toBe('not-supported');
    expect(report.warnings.some((w) => w.severity === 'error' && w.code === 'EUL3_UNSUPPORTED')).toBe(
      true,
    );
  });

  it('warns about folder types that are anomalous for the source version', () => {
    const report = generateAssessmentReport(
      eul('EUL4', { folders: [folder(1, null, 'SUMMARY'), folder(2, null, 'DERIVED')] }),
    );
    const warning = report.warnings.find((w) => w.code === 'UNEXPECTED_FOLDER_TYPE');
    expect(warning).toBeDefined();
  });

  it('warns about workbooks whose DOC_CONTENT could not be parsed', () => {
    const report = generateAssessmentReport(
      eul('EUL5', { workbooks: [workbook(1, 'binary blob', false)] }),
    );
    expect(report.warnings.some((w) => w.code === 'WORKBOOK_PARSE')).toBe(true);
  });

  it('summarizes workbook usage when a query log is present', () => {
    const report = generateAssessmentReport(
      eul('EUL5', {
        workbooks: [workbook(1, '<workbook/>', true)],
        workbookUsage: [
          {
            workbookName: 'WB1',
            executionCount: 3,
            totalElapsedTime: 300,
            avgElapsedTime: 100,
            totalRowsReturned: 90,
            lastRun: null,
          },
        ],
      }),
    );
    expect(report.workbookUsage.hasQueryLog).toBe(true);
    expect(report.workbookUsage.totalExecutions).toBe(3);
    expect(report.workbookUsage.topWorkbooks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// validateEulData
// ---------------------------------------------------------------------------

describe('validateEulData', () => {
  it('passes clean, fully-referenced data', () => {
    const result = validateEulData(
      eul('EUL5', {
        businessAreas: [ba(100)],
        folders: [folder(10, 100)],
        items: [item(1, 10), item(2, 10)],
        joins: [join(20, [{ masterItemId: 1, detailItemId: 2, operator: '=' }])],
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it('reports a broken join referencing a missing item as an error', () => {
    const result = validateEulData(
      eul('EUL5', {
        businessAreas: [ba(100)],
        folders: [folder(10, 100)],
        items: [item(1, 10)],
        joins: [join(20, [{ masterItemId: 1, detailItemId: 999, operator: '=' }])],
      }),
    );
    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('JOIN_BROKEN_REF');
  });

  it('reports items without folders as an error', () => {
    const result = validateEulData(eul('EUL5', { items: [item(1, null)] }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'ITEM_NO_FOLDER')).toBe(true);
  });

  it('flags an unsupported version as an integrity error', () => {
    const result = validateEulData(eul('EUL3', {}, { supported: false }));
    expect(result.issues.some((i) => i.code === 'VERSION_UNSUPPORTED')).toBe(true);
    expect(result.valid).toBe(false);
  });
});
