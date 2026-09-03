/**
 * Assessment service — turns the normalized EUL data read by `eul-reader` into
 * a migration-readiness report and an integrity-validation result.
 *
 * Everything here is pure: it operates on an already-read `EulReadResult`, so
 * it is trivially testable with synthetic data and never touches Oracle. The
 * version-specific pieces (which columns EUL4 will default, whether a folder
 * type is legal for the source version) are derived from the same schema
 * adapter the reader used, rebuilt from the `EulVersionInfo`.
 */

import { createEulSchemaAdapter } from './eul-schema-adapter.js';
import type { EulFullData, EulReadResult, WorkbookUsageStat } from './eul-reader.js';
import type {
  ColumnMapping,
  EulSchemaAdapter,
  EulVersionInfo,
} from '../types/eul-versions.js';
import { NORMALIZED_FOLDER_TYPES } from '../types/eul-versions.js';

// ---------------------------------------------------------------------------
// Report shape
// ---------------------------------------------------------------------------

export interface EulObjectCounts {
  businessAreas: number;
  folders: number;
  items: number;
  calculatedItems: number;
  conditions: number;
  securityConditions: number;
  joins: number;
  hierarchies: number;
  customFunctions: number;
  workbooks: number;
  users: number;
  grants: number;
}

export interface OrphanRef {
  sourceId: number;
  name: string;
  /** Why the object is considered orphaned. */
  reason: string;
}

export interface OrphanReport {
  itemsWithoutFolder: OrphanRef[];
  joinsWithoutComponents: OrphanRef[];
  hierarchiesWithoutBusinessArea: OrphanRef[];
  foldersWithoutBusinessArea: OrphanRef[];
  total: number;
}

export type ComplexityScore = 'simple' | 'medium' | 'complex';

export interface ComplexityFactor {
  label: string;
  count: number;
  points: number;
}

export interface ComplexityAssessment {
  score: ComplexityScore;
  points: number;
  factors: ComplexityFactor[];
}

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface MigrationWarning {
  severity: WarningSeverity;
  code: string;
  message: string;
}

export interface WorkbookUsageSummary {
  hasQueryLog: boolean;
  workbookCount: number;
  workbooksWithUsage: number;
  totalExecutions: number;
  topWorkbooks: WorkbookUsageStat[];
}

/**
 * Coverage of the worksheet-fidelity model (crosstab layout, axis, sort,
 * totals, item format, forced joins — see `EUL_SCHEMA_GROUND_TRUTH.md` §7)
 * across every worksheet in the source, computed before a migration writes
 * anything. `layoutUndecoded` worksheets migrate as a flat column list: no
 * axis, sort, totals or per-item format, same as before that model existed.
 */
export interface WorksheetFidelitySummary {
  /** Worksheets across every workbook with a readable, decoded body. */
  totalWorksheets: number;
  /** Worksheets whose layout model decoded. */
  layoutDecoded: number;
  /** Worksheets with no decodable layout model. */
  layoutUndecoded: number;
  /** Worksheets drawn as a crosstab rather than a table. */
  crosstabs: number;
  /** Worksheets carrying at least one column or group/break sort. */
  withSorts: number;
  /** Worksheets defining at least one total/summary row. */
  withTotals: number;
  /** Worksheets whose query forces a specific join. */
  withForcedJoins: number;
  /** Worksheets that are `SELECT DISTINCT`. */
  selectDistinct: number;
}

export interface MigrationEstimate {
  totalObjects: number;
  estimatedMinutes: number;
  humanReadable: string;
}

/**
 * D-071 / F-12. None of these says "ready", and that is deliberate.
 *
 * This score is computed from the SOURCE alone — an EUL read, an orphan report
 * and a list of transform warnings. It never receives target state, so it
 * cannot know whether anything migrated, whether a map executes, or whether a
 * formula compiles. It once returned 75 / "ready-with-warnings" / no blockers
 * over an estate where none of 923 maps could run, and the defect was not the
 * arithmetic: the function had no output in scope to inspect.
 *
 * The fix is not to teach it about the target. It is to stop it speaking about
 * one. Every rating names the source, and `dn-migrate verify` is the gate on
 * whether a migration is usable.
 */
export type SourceReadinessRating =
  | 'source-clean'
  | 'source-minor-issues'
  | 'source-needs-work'
  | 'source-not-supported';

export interface SourceReadinessScore {
  /** 0–100, describing the SOURCE's fitness for automated migration. */
  score: number;
  rating: SourceReadinessRating;
  blockers: string[];
  notes: string[];
  /**
   * Always false here. A pre-check cannot verify a target, and a field that is
   * structurally constant is cheaper to read than a comment nobody opens.
   */
  targetVerified: false;
}

export interface AssessmentReport {
  version: EulVersionInfo;
  counts: EulObjectCounts;
  folderTypeBreakdown: Record<string, number>;
  orphans: OrphanReport;
  workbookUsage: WorkbookUsageSummary;
  worksheetFidelity: WorksheetFidelitySummary;
  complexity: ComplexityAssessment;
  warnings: MigrationWarning[];
  estimate: MigrationEstimate;
  readiness: SourceReadinessScore;
}

// ---------------------------------------------------------------------------
// Counts and breakdowns
// ---------------------------------------------------------------------------

function countByType(data: EulFullData): EulObjectCounts {
  return {
    businessAreas: data.businessAreas.length,
    folders: data.folders.length,
    items: data.items.length,
    // CI = created item (a calculation). CO is the plain database item.
    calculatedItems: data.items.filter((i) => i.expType === 'CI').length,
    conditions: data.conditions.length,
    securityConditions: data.securityConditions.length,
    joins: data.joins.length,
    hierarchies: data.hierarchies.length,
    customFunctions: data.customFunctions.length,
    workbooks: data.workbooks.length,
    users: data.users.length,
    grants: data.grants.length,
  };
}

function folderTypeBreakdown(data: EulFullData): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const folder of data.folders) {
    const type = folder.folderType || 'UNKNOWN';
    breakdown[type] = (breakdown[type] ?? 0) + 1;
  }
  return breakdown;
}

// ---------------------------------------------------------------------------
// Orphan detection
// ---------------------------------------------------------------------------

export function findOrphans(data: EulFullData): OrphanReport {
  const folderIds = new Set(data.folders.map((f) => f.sourceId));
  const baIds = new Set(data.businessAreas.map((b) => b.sourceId));

  const itemsWithoutFolder: OrphanRef[] = data.items
    .filter((item) => item.folderId === null || !folderIds.has(item.folderId))
    .map((item) => ({
      sourceId: item.sourceId,
      name: item.name,
      reason:
        item.folderId === null
          ? 'item has no folder reference'
          : `item references folder ${item.folderId}, which does not exist`,
    }));

  // A join binds two FOLDERS; item-level components are optional, so a
  // component-less join is not an orphan. A join missing a folder — or
  // pointing at one that was never read — is.
  const joinsWithoutComponents: OrphanRef[] = data.joins
    .filter(
      (join) =>
        join.masterFolderId === null ||
        join.detailFolderId === null ||
        !folderIds.has(join.masterFolderId) ||
        !folderIds.has(join.detailFolderId),
    )
    .map((join) => ({
      sourceId: join.sourceId,
      name: join.name,
      reason: 'join is missing a folder on one or both sides',
    }));

  const hierarchiesWithoutBusinessArea: OrphanRef[] = data.hierarchies
    .filter((h) => h.businessAreaId === null || !baIds.has(h.businessAreaId))
    .map((h) => ({
      sourceId: h.sourceId,
      name: h.name,
      reason:
        h.businessAreaId === null
          ? 'hierarchy has no business-area reference'
          : `hierarchy references business area ${h.businessAreaId}, which does not exist`,
    }));

  const foldersWithoutBusinessArea: OrphanRef[] = data.folders
    .filter((f) => f.businessAreaId === null || !baIds.has(f.businessAreaId))
    .map((f) => ({
      sourceId: f.sourceId,
      name: f.name,
      reason:
        f.businessAreaId === null
          ? 'folder has no business-area reference'
          : `folder references business area ${f.businessAreaId}, which does not exist`,
    }));

  return {
    itemsWithoutFolder,
    joinsWithoutComponents,
    hierarchiesWithoutBusinessArea,
    foldersWithoutBusinessArea,
    total:
      itemsWithoutFolder.length +
      joinsWithoutComponents.length +
      hierarchiesWithoutBusinessArea.length +
      foldersWithoutBusinessArea.length,
  };
}

// ---------------------------------------------------------------------------
// Workbook usage
// ---------------------------------------------------------------------------

const TOP_WORKBOOKS = 10;

function summarizeWorkbookUsage(data: EulFullData): WorkbookUsageSummary {
  const usage = data.workbookUsage;
  return {
    hasQueryLog: usage.length > 0,
    workbookCount: data.workbooks.length,
    workbooksWithUsage: usage.filter((u) => u.executionCount > 0).length,
    totalExecutions: usage.reduce((sum, u) => sum + u.executionCount, 0),
    topWorkbooks: usage.slice(0, TOP_WORKBOOKS),
  };
}

export function summarizeWorksheetFidelity(data: EulFullData): WorksheetFidelitySummary {
  const worksheets = data.workbooks.flatMap((wb) => wb.document.worksheets);
  return {
    totalWorksheets: worksheets.length,
    layoutDecoded: worksheets.filter((ws) => ws.layoutDecoded).length,
    layoutUndecoded: worksheets.filter((ws) => !ws.layoutDecoded).length,
    crosstabs: worksheets.filter((ws) => ws.viewType === 'CROSSTAB').length,
    withSorts: worksheets.filter((ws) => ws.sorts.length > 0).length,
    withTotals: worksheets.filter((ws) => ws.totals.length > 0).length,
    withForcedJoins: worksheets.filter((ws) => ws.joins.length > 0).length,
    selectDistinct: worksheets.filter((ws) => ws.selectDistinct === true).length,
  };
}

// ---------------------------------------------------------------------------
// Complexity scoring
// ---------------------------------------------------------------------------

/**
 * Per-object complexity weights. Deliberately simple and explicit so the score
 * is explainable and tunable; the exact numbers are a judgment call, not a
 * derived constant. A migration's difficulty is driven far more by hand-tuned
 * artifacts (custom functions, security conditions, calculated logic) than by
 * the raw count of plain table folders, so those weigh more.
 */
export const COMPLEXITY_WEIGHTS = {
  businessArea: 2,
  folder: 1,
  join: 1,
  hierarchy: 2,
  calculatedItem: 1.5,
  condition: 1.5,
  securityCondition: 2,
  customFunction: 3,
  worksheet: 0.5,
} as const;

/** Point thresholds separating simple / medium / complex. */
export const COMPLEXITY_THRESHOLDS = { medium: 20, complex: 60 } as const;

export function assessComplexity(data: EulFullData): ComplexityAssessment {
  const calculatedItems = data.items.filter((i) => i.expType === 'CU').length;
  const totalWorksheets = data.workbooks.reduce((sum, wb) => sum + wb.info.worksheetCount, 0);

  const raw: Array<[string, number, number]> = [
    ['Business areas', data.businessAreas.length, COMPLEXITY_WEIGHTS.businessArea],
    ['Folders', data.folders.length, COMPLEXITY_WEIGHTS.folder],
    ['Joins', data.joins.length, COMPLEXITY_WEIGHTS.join],
    ['Hierarchies', data.hierarchies.length, COMPLEXITY_WEIGHTS.hierarchy],
    ['Calculated items', calculatedItems, COMPLEXITY_WEIGHTS.calculatedItem],
    ['Conditions', data.conditions.length, COMPLEXITY_WEIGHTS.condition],
    ['Security conditions', data.securityConditions.length, COMPLEXITY_WEIGHTS.securityCondition],
    ['Custom functions', data.customFunctions.length, COMPLEXITY_WEIGHTS.customFunction],
    ['Workbook worksheets', totalWorksheets, COMPLEXITY_WEIGHTS.worksheet],
  ];

  const factors: ComplexityFactor[] = raw
    .filter(([, count]) => count > 0)
    .map(([label, count, weight]) => ({ label, count, points: count * weight }));

  const points = Math.round(factors.reduce((sum, f) => sum + f.points, 0) * 10) / 10;
  const score: ComplexityScore =
    points >= COMPLEXITY_THRESHOLDS.complex
      ? 'complex'
      : points >= COMPLEXITY_THRESHOLDS.medium
        ? 'medium'
        : 'simple';

  return { score, points, factors };
}

// ---------------------------------------------------------------------------
// Migration warnings
// ---------------------------------------------------------------------------

/** EUL5-only columns an EUL4/EUL3 read backfills with defaults or fallbacks. */
function defaultedColumns(adapter: EulSchemaAdapter): string[] {
  const groups: Array<[string, ColumnMapping[]]> = [
    ['BAS', adapter.getBusinessAreaColumns()],
    ['OBJS', adapter.getFolderColumns()],
    ['EXPRESSIONS', adapter.getExpressionColumns()],
    ['JOINS', adapter.getJoinColumns()],
    ['HIERARCHIES', adapter.getHierarchyColumns()],
    ['DOCUMENTS', adapter.getDocumentColumns()],
    ['FUNCTIONS', adapter.getFunctionColumns()],
  ];
  const names: string[] = [];
  for (const [table, mappings] of groups) {
    for (const mapping of mappings) {
      if (!mapping.existsInSource) names.push(`${table}.${mapping.name}`);
    }
  }
  return names;
}

export function collectWarnings(eul: EulReadResult, orphans: OrphanReport): MigrationWarning[] {
  const { version, data } = eul;
  const warnings: MigrationWarning[] = [];

  // Carry forward detection-time warnings (missing core tables, mixed schema…).
  for (const message of version.warnings) {
    warnings.push({ severity: 'warning', code: 'DETECTION', message });
  }

  // Version-specific format warnings.
  if (version.version === 'EUL3') {
    warnings.push({
      severity: 'error',
      code: 'EUL3_UNSUPPORTED',
      message:
        'EUL 3.x is a very old, desupported format with limited/best-effort migration ' +
        'support. Upgrade the EUL to 4.x/5.x with Oracle tooling before migrating, or ' +
        'expect to migrate manually.',
    });
  }

  if (version.version === 'EUL4' || version.version === 'EUL3') {
    const adapter = createEulSchemaAdapter(version);
    const columns = defaultedColumns(adapter);
    if (columns.length > 0) {
      warnings.push({
        severity: 'info',
        code: 'DEFAULTED_COLUMNS',
        message:
          `${version.version} has no EUL5-era metadata columns; ${columns.length} column(s) ` +
          `will be populated with defaults or fallbacks on migration: ${columns.join(', ')}.`,
      });
    }
  }

  // Folder types are compared AFTER normalization (SOBJ→TABLE, COBJ→COMPLEX),
  // so anything else is a raw OBJ_TYPE this reader has not seen before.
  const legalTypes = new Set(NORMALIZED_FOLDER_TYPES);
  const unexpectedTypes = new Map<string, number>();
  for (const folder of data.folders) {
    if (!legalTypes.has(folder.folderType)) {
      unexpectedTypes.set(folder.folderType, (unexpectedTypes.get(folder.folderType) ?? 0) + 1);
    }
  }
  for (const [type, count] of unexpectedTypes) {
    warnings.push({
      severity: 'warning',
      code: 'UNEXPECTED_FOLDER_TYPE',
      message:
        `${count} folder(s) have OBJ_TYPE "${type}", which is neither SOBJ nor COBJ. ` +
        `Review these folders before migrating.`,
    });
  }

  // Security model differences.
  if (version.version === 'EUL4' || version.version === 'EUL3') {
    warnings.push({
      severity: 'info',
      code: 'SECURITY_MODEL',
      message:
        `${version.version} uses the pre-EUL5 security model (EUL*_USERS / EUL*_ROLES and ` +
        'grant tables). Users are inferred from ELEM_ACCESS grantees, and legacy roles must ' +
        'be mapped to Discoverer Neo roles (ADMIN/MANAGER/USER/VIEWER) manually.',
    });
  } else if (data.securityConditions.length > 0) {
    warnings.push({
      severity: 'info',
      code: 'SECURITY_MANAGER',
      message:
        `${data.securityConditions.length} Security Manager condition(s) (EXP_TYPE='SM') were ` +
        'found. These migrate to Discoverer Neo row-level security policies and should be ' +
        'reviewed for equivalence.',
    });
  }

  // Orphaned objects.
  if (orphans.total > 0) {
    warnings.push({
      severity: 'warning',
      code: 'ORPHANS',
      message:
        `${orphans.total} orphaned object(s) found (items without folders, joins without ` +
        'components, or objects referencing a missing parent). These may not migrate cleanly.',
    });
  }

  // Worksheets whose layout model (crosstab, axis, sort, totals, per-item
  // format, forced joins) did not decode. Distinct from WORKBOOK_PARSE below:
  // these worksheets still migrate their columns, just as a flat list with
  // none of that detail — an operator needs to know how many before starting.
  const fidelity = summarizeWorksheetFidelity(data);
  if (fidelity.layoutUndecoded > 0) {
    warnings.push({
      severity: 'info',
      code: 'WORKSHEET_LAYOUT_COVERAGE',
      message:
        `${fidelity.layoutUndecoded} of ${fidelity.totalWorksheets} worksheet(s) have no ` +
        'decodable layout model. They will migrate as a flat column list with no axis, sort, ' +
        'totals or per-item format — review them after migrating.',
    });
  }

  // Workbooks whose body could not be decoded into worksheets. These migrate
  // as empty maps, so an operator needs to know how many before starting.
  const unparsable = data.workbooks.filter((wb) => wb.content !== null && !wb.info.parsed);
  if (unparsable.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'WORKBOOK_PARSE',
      message:
        `${unparsable.length} workbook(s) have a DOC_DOCUMENT body that could not be decoded ` +
        'into worksheets. They migrate as empty maps and their layout needs manual review.',
    });
  }

  // Workbooks with no body at all — nothing to migrate but the metadata.
  const bodyless = data.workbooks.filter((wb) => wb.content === null);
  if (bodyless.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'WORKBOOK_NO_BODY',
      message:
        `${bodyless.length} workbook(s) have no readable body in DOCUMENTS ` +
        '(the content column is absent or empty), so only their names migrate.',
    });
  }

  // Conditions live on the workbook, not the worksheet, so a multi-worksheet
  // workbook cannot say which of its worksheets used which condition.
  const ambiguous = data.workbooks.filter(
    (wb) => wb.document.conditionsAreWorkbookWide && wb.document.conditions.length > 0,
  );
  if (ambiguous.length > 0) {
    warnings.push({
      severity: 'info',
      code: 'WORKBOOK_CONDITIONS_SHARED',
      message:
        `${ambiguous.length} multi-worksheet workbook(s) carry conditions Discoverer stores ` +
        'per workbook rather than per worksheet. Every condition is attached to every map ' +
        'the workbook produces; review each map and remove the ones it did not use.',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Migration time estimate
// ---------------------------------------------------------------------------

/** Per-object migration effort in minutes (rough planning figures). */
export const EFFORT_MINUTES = {
  base: 5,
  businessArea: 1,
  folder: 0.5,
  item: 0.05,
  join: 0.2,
  hierarchy: 0.3,
  customFunction: 2,
  workbook: 0.5,
  securityCondition: 1,
} as const;

/** EUL3 needs heavy manual work; inflate its estimate. */
const EUL3_EFFORT_MULTIPLIER = 2;

function humanizeMinutes(minutes: number): string {
  if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 8) return `~${Math.round(hours * 10) / 10} h`;
  const days = hours / 8; // 8-hour working days
  return `~${Math.round(days * 10) / 10} working day(s)`;
}

export function estimateMigration(eul: EulReadResult): MigrationEstimate {
  const { version, data } = eul;
  const counts = countByType(data);
  const totalObjects =
    counts.businessAreas +
    counts.folders +
    counts.items +
    counts.conditions +
    counts.securityConditions +
    counts.joins +
    counts.hierarchies +
    counts.customFunctions +
    counts.workbooks;

  let minutes =
    EFFORT_MINUTES.base +
    counts.businessAreas * EFFORT_MINUTES.businessArea +
    counts.folders * EFFORT_MINUTES.folder +
    (counts.items + counts.conditions) * EFFORT_MINUTES.item +
    counts.joins * EFFORT_MINUTES.join +
    counts.hierarchies * EFFORT_MINUTES.hierarchy +
    counts.customFunctions * EFFORT_MINUTES.customFunction +
    counts.workbooks * EFFORT_MINUTES.workbook +
    counts.securityConditions * EFFORT_MINUTES.securityCondition;

  if (version.version === 'EUL3') minutes *= EUL3_EFFORT_MULTIPLIER;

  const estimatedMinutes = Math.round(minutes * 10) / 10;
  return {
    totalObjects,
    estimatedMinutes,
    humanReadable: humanizeMinutes(estimatedMinutes),
  };
}

// ---------------------------------------------------------------------------
// Source readiness pre-check
// ---------------------------------------------------------------------------

/** Carried on every result so no reading of this score can omit it. */
export const TARGET_UNVERIFIED_NOTE =
  'This scores the SOURCE only and cannot see a target. Run `dn-migrate verify --target <connection>` after migrating to find out whether the result is usable.';

/**
 * Score the SOURCE's fitness for automated migration. A pre-check, not a gate.
 * See `SourceReadinessRating` for why it can never say a migration is ready.
 */
export function scoreSourceReadiness(
  eul: EulReadResult,
  orphans: OrphanReport,
  warnings: MigrationWarning[],
): SourceReadinessScore {
  const { version } = eul;
  const blockers: string[] = [];
  // Stated on every result, including a perfect one: whatever this score says,
  // nothing has looked at a target.
  const notes: string[] = [TARGET_UNVERIFIED_NOTE];

  // Unsupported version is a hard blocker.
  if (!version.supported) {
    blockers.push(`EUL version ${version.version} is not supported for automated migration.`);
    return {
      score: 15,
      rating: 'source-not-supported',
      blockers,
      notes: [TARGET_UNVERIFIED_NOTE, 'Upgrade the EUL to 4.x/5.x, or migrate manually.'],
      targetVerified: false,
    };
  }

  let score = 100;

  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  const warningCount = warnings.filter((w) => w.severity === 'warning').length;

  if (errorCount > 0) {
    score -= errorCount * 20;
    blockers.push(`${errorCount} error-level warning(s) must be resolved.`);
  }
  if (warningCount > 0) {
    score -= Math.min(30, warningCount * 5);
    notes.push(`${warningCount} warning(s) to review.`);
  }
  if (orphans.total > 0) {
    score -= Math.min(20, orphans.total * 2);
    notes.push(`${orphans.total} orphaned object(s) may not migrate cleanly.`);
  }
  if (version.schemaVersion === 'unknown') {
    score -= 5;
    notes.push('EUL schema version could not be read from EUL*_EUL.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const rating: SourceReadinessRating =
    score >= 80
      ? 'source-clean'
      : score >= 50
        ? 'source-minor-issues'
        : 'source-needs-work';

  return { score, rating, blockers, notes, targetVerified: false };
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

export function generateAssessmentReport(eul: EulReadResult): AssessmentReport {
  const { version, data } = eul;
  const counts = countByType(data);
  const orphans = findOrphans(data);
  const warnings = collectWarnings(eul, orphans);
  const complexity = assessComplexity(data);
  const estimate = estimateMigration(eul);
  const readiness = scoreSourceReadiness(eul, orphans, warnings);

  return {
    version,
    counts,
    folderTypeBreakdown: folderTypeBreakdown(data),
    orphans,
    workbookUsage: summarizeWorkbookUsage(data),
    worksheetFidelity: summarizeWorksheetFidelity(data),
    complexity,
    warnings,
    estimate,
    readiness,
  };
}

// ---------------------------------------------------------------------------
// Integrity validation (drives `dn-migrate validate`)
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  /** Source ids of the objects implicated, when applicable. */
  objectIds?: number[];
}

export interface ValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
}

/**
 * Referential-integrity checks over the read EUL data: orphaned objects,
 * broken joins (components pointing at missing items), and hierarchy levels /
 * grants referencing missing parents. Errors mean broken references; warnings
 * mean anomalies worth a look. Includes version-specific notes.
 */
export function validateEulData(eul: EulReadResult): ValidationResult {
  const { version, data } = eul;
  const issues: ValidationIssue[] = [];

  const itemIds = new Set(data.items.map((i) => i.sourceId));
  // Conditions and security conditions are also expressions items may join to.
  for (const cond of data.conditions) itemIds.add(cond.sourceId);
  for (const sm of data.securityConditions) itemIds.add(sm.sourceId);
  const folderIds = new Set(data.folders.map((f) => f.sourceId));
  const baIds = new Set(data.businessAreas.map((b) => b.sourceId));

  const orphans = findOrphans(data);
  if (orphans.itemsWithoutFolder.length > 0) {
    issues.push({
      severity: 'error',
      code: 'ITEM_NO_FOLDER',
      message: `${orphans.itemsWithoutFolder.length} item(s) reference a missing or null folder.`,
      objectIds: orphans.itemsWithoutFolder.map((o) => o.sourceId),
    });
  }
  if (orphans.foldersWithoutBusinessArea.length > 0) {
    issues.push({
      severity: 'error',
      code: 'FOLDER_NO_BA',
      message:
        `${orphans.foldersWithoutBusinessArea.length} folder(s) reference a missing or null ` +
        'business area.',
      objectIds: orphans.foldersWithoutBusinessArea.map((o) => o.sourceId),
    });
  }
  if (orphans.hierarchiesWithoutBusinessArea.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'HIERARCHY_NO_BA',
      message:
        `${orphans.hierarchiesWithoutBusinessArea.length} hierarchy/hierarchies reference a ` +
        'missing or null business area.',
      objectIds: orphans.hierarchiesWithoutBusinessArea.map((o) => o.sourceId),
    });
  }

  // Broken joins. A join binds two FOLDERS; item-level components are
  // optional, so a component-less join is normal. What breaks a join is a
  // missing folder on either side, or a component pointing at a missing item.
  const folderlessJoins: number[] = [];
  const brokenJoins: number[] = [];
  for (const join of data.joins) {
    if (join.masterFolderId === null || join.detailFolderId === null) {
      folderlessJoins.push(join.sourceId);
      continue;
    }
    if (
      !folderIds.has(join.masterFolderId) ||
      !folderIds.has(join.detailFolderId) ||
      join.components.some(
        (c) =>
          (c.masterItemId !== null && !itemIds.has(c.masterItemId)) ||
          (c.detailItemId !== null && !itemIds.has(c.detailItemId)),
      )
    ) {
      brokenJoins.push(join.sourceId);
    }
  }
  if (folderlessJoins.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'JOIN_NO_FOLDERS',
      message: `${folderlessJoins.length} join(s) are missing a folder on one or both sides.`,
      objectIds: folderlessJoins,
    });
  }
  if (brokenJoins.length > 0) {
    issues.push({
      severity: 'error',
      code: 'JOIN_BROKEN_REF',
      message: `${brokenJoins.length} join(s) reference folder(s) or item(s) that do not exist.`,
      objectIds: brokenJoins,
    });
  }

  // Hierarchy nodes referencing missing items.
  const brokenLevels: number[] = [];
  for (const hierarchy of data.hierarchies) {
    for (const node of hierarchy.nodes) {
      if (node.itemId !== null && !itemIds.has(node.itemId)) brokenLevels.push(node.sourceId);
    }
  }
  if (brokenLevels.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'HIER_LEVEL_BROKEN_REF',
      message: `${brokenLevels.length} hierarchy node(s) reference item(s) that do not exist.`,
      objectIds: brokenLevels,
    });
  }

  // Grants referencing missing business areas / folders.
  const brokenGrants: number[] = [];
  for (const grant of data.grants) {
    const baMissing = grant.businessAreaId !== null && !baIds.has(grant.businessAreaId);
    const folderMissing = grant.folderId !== null && !folderIds.has(grant.folderId);
    if (baMissing || folderMissing) brokenGrants.push(grant.sourceId);
  }
  if (brokenGrants.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'GRANT_BROKEN_REF',
      message: `${brokenGrants.length} grant(s) reference a missing business area or folder.`,
      objectIds: brokenGrants,
    });
  }

  // Version-specific note.
  if (!version.supported) {
    issues.push({
      severity: 'error',
      code: 'VERSION_UNSUPPORTED',
      message: `EUL version ${version.version} is not supported for automated migration.`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  return { valid: errorCount === 0, errorCount, warningCount, issues };
}
