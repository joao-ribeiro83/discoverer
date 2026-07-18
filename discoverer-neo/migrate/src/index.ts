/**
 * Discoverer Neo migration tool — public API.
 *
 * Session 5.3 delivers the version-detection and schema-adapter foundation;
 * Session 5.4 adds the connection-level EUL reader, the assessment service,
 * and the `dn-migrate` CLI on top of it.
 */

export * from './types/eul-versions.js';
export {
  buildConnectString,
  closeAllPools,
  createExecutor,
  isTableNotFoundError,
  resolveExecutor,
  EulConnectionError,
  EulQueryError,
} from './services/oracle-client.js';
export type { EulConnectionConfig, EulSource, OracleExecutor } from './services/oracle-client.js';
export {
  detectEulVersion,
  detectEulVersionFromExecutor,
  describeDiscovererRelease,
  EulDetectionError,
} from './services/eul-version-detector.js';
export type { DetectEulVersionOptions } from './services/eul-version-detector.js';
export {
  createEulSchemaAdapter,
  normalizeRow,
  readBusinessAreas,
  readFolders,
  readItems,
  readJoins,
  readHierarchies,
  readCustomFunctions,
  readWorkbooks,
  readUsers,
  readGrants,
  EulReadError,
  DEFAULT_ITEM_EXP_TYPES,
} from './services/eul-schema-adapter.js';

// --- Session 5.4: EUL reader (connection-level facade) -------------------
export {
  readEulSchema,
  parseWorkbookContent,
  readWorkbookUsage,
  CONDITION_EXP_TYPES,
  SECURITY_MANAGER_EXP_TYPES,
} from './services/eul-reader.js';
export type {
  EulFullData,
  EulReadResult,
  ReadEulOptions,
  ParsedWorkbook,
  WorkbookInfo,
  WorkbookSheet,
  WorkbookUsageStat,
} from './services/eul-reader.js';

// --- Session 5.4: assessment service -------------------------------------
export {
  generateAssessmentReport,
  validateEulData,
  findOrphans,
  assessComplexity,
  collectWarnings,
  estimateMigration,
  scoreReadiness,
  COMPLEXITY_WEIGHTS,
  COMPLEXITY_THRESHOLDS,
  EFFORT_MINUTES,
} from './services/assessment.js';
export type {
  AssessmentReport,
  EulObjectCounts,
  OrphanReport,
  OrphanRef,
  ComplexityScore,
  ComplexityAssessment,
  ComplexityFactor,
  MigrationWarning,
  WarningSeverity,
  WorkbookUsageSummary,
  MigrationEstimate,
  ReadinessScore,
  ReadinessRating,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './services/assessment.js';

// --- Session 5.4: CLI ----------------------------------------------------
export {
  runCli,
  main as runCliMain,
  loadConnectionConfig,
  formatAssessmentReport,
  formatValidationResult,
  commandAnalyze,
  commandExport,
  commandValidate,
  CliUsageError,
  EXIT_OK,
  EXIT_ERROR,
  EXIT_INVALID,
} from './cli.js';
export type { CliDeps, CliIO } from './cli.js';
