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
import { FOLDER_TYPES_BY_VERSION } from '../types/eul-versions.js';

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

export interface MigrationEstimate {
  totalObjects: number;
  estimatedMinutes: number;
  humanReadable: string;
}

export type ReadinessRating =
  | 'ready'
  | 'ready-with-warnings'
  | 'needs-attention'
  | 'not-supported';

export interface ReadinessScore {
  /** 0–100. */
  score: number;
  rating: ReadinessRating;
  blockers: string[];
  notes: string[];
}

export interface AssessmentReport {
  version: EulVersionInfo;
  counts: EulObjectCounts;
  folderTypeBreakdown: Record<string, number>;
  orphans: OrphanReport;
  workbookUsage: WorkbookUsageSummary;
  complexity: ComplexityAssessment;
  warnings: MigrationWarning[];
  estimate: MigrationEstimate;
  readiness: ReadinessScore;
}

// ---------------------------------------------------------------------------
// Counts and breakdowns
// ---------------------------------------------------------------------------

function countByType(data: EulFullData): EulObjectCounts {
  return {
    businessAreas: data.businessAreas.length,
    folders: data.folders.length,
    items: data.items.length,
    calculatedItems: data.items.filter((i) => i.expType === 'CU').length,
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

  const joinsWithoutComponents: OrphanRef[] = data.joins
    .filter((join) => join.components.length === 0)
    .map((join) => ({
      sourceId: join.sourceId,
      name: join.name,
      reason: 'join has no join components (no item pairs)',
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
    ['BA', adapter.getBusinessAreaColumns()],
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

  // Folder types that shouldn't exist for the source version (DERIVED/SUMMARY
  // are EUL5 concepts; seeing them in an EUL4/EUL3 source is anomalous).
  const legalTypes = new Set(FOLDER_TYPES_BY_VERSION[version.version]);
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
        `${count} folder(s) have type "${type}", which is not a documented ${version.version} ` +
        `folder type. Review these folders before migrating.`,
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

  // Workbooks whose DOC_CONTENT could not be parsed as XML.
  const unparsable = data.workbooks.filter((wb) => wb.content !== null && !wb.info.parsed);
  if (unparsable.length > 0) {
    warnings.push({
      severity: 'warning',
      code: 'WORKBOOK_PARSE',
      message:
        `${unparsable.length} workbook(s) have DOC_CONTENT that could not be parsed as XML ` +
        '(they may use an older binary format). Their layout will need manual review.',
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
// Readiness score
// ---------------------------------------------------------------------------

export function scoreReadiness(
  eul: EulReadResult,
  orphans: OrphanReport,
  warnings: MigrationWarning[],
): ReadinessScore {
  const { version } = eul;
  const blockers: string[] = [];
  const notes: string[] = [];

  // Unsupported version is a hard blocker.
  if (!version.supported) {
    blockers.push(`EUL version ${version.version} is not supported for automated migration.`);
    return {
      score: 15,
      rating: 'not-supported',
      blockers,
      notes: ['Upgrade the EUL to 4.x/5.x, or migrate manually.'],
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

  const rating: ReadinessRating =
    score >= 80
      ? 'ready'
      : score >= 50
        ? 'ready-with-warnings'
        : 'needs-attention';

  return { score, rating, blockers, notes };
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
  const readiness = scoreReadiness(eul, orphans, warnings);

  return {
    version,
    counts,
    folderTypeBreakdown: folderTypeBreakdown(data),
    orphans,
    workbookUsage: summarizeWorkbookUsage(data),
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

  // Broken joins: no components, or components referencing missing items.
  const emptyJoins: number[] = [];
  const brokenJoins: number[] = [];
  for (const join of data.joins) {
    if (join.components.length === 0) {
      emptyJoins.push(join.sourceId);
      continue;
    }
    const broken = join.components.some(
      (c) => !itemIds.has(c.masterItemId) || !itemIds.has(c.detailItemId),
    );
    if (broken) brokenJoins.push(join.sourceId);
  }
  if (emptyJoins.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'JOIN_NO_COMPONENTS',
      message: `${emptyJoins.length} join(s) have no join components.`,
      objectIds: emptyJoins,
    });
  }
  if (brokenJoins.length > 0) {
    issues.push({
      severity: 'error',
      code: 'JOIN_BROKEN_REF',
      message: `${brokenJoins.length} join(s) reference item(s) that do not exist.`,
      objectIds: brokenJoins,
    });
  }

  // Hierarchy levels referencing missing items.
  const brokenLevels: number[] = [];
  for (const hierarchy of data.hierarchies) {
    for (const level of hierarchy.levels) {
      if (level.itemId !== null && !itemIds.has(level.itemId)) brokenLevels.push(level.sourceId);
    }
  }
  if (brokenLevels.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'HIER_LEVEL_BROKEN_REF',
      message: `${brokenLevels.length} hierarchy level(s) reference item(s) that do not exist.`,
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
