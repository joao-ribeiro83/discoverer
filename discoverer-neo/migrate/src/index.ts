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
  scoreSourceReadiness,
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
  SourceReadinessScore,
  SourceReadinessRating,
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
} from './services/assessment.js';

// --- Session 5.5: transformers -------------------------------------------
export {
  transformBusinessArea,
  transformFolder,
  transformItem,
  transformJoin,
  transformHierarchy,
  transformCustomFunction,
  transformWorkbook,
  transformUser,
  transformUsers,
  transformGrant,
  transformGrants,
  usernameToEmailLocal,
  FOLDER_TYPE_MAP_EUL4,
  FOLDER_TYPE_MAP_EUL5,
  ITEM_TYPE_MAP,
  GRANT_PERMISSION_MAP,
  MIGRATED_USER_PASSWORD_HASH,
  MIGRATED_EMAIL_DOMAIN,
} from './services/transformers/index.js';
export type {
  TransformWarning,
  TransformedBusinessArea,
  TransformedFolder,
  TransformedItem,
  TransformedJoin,
  TransformedHierarchy,
  TransformedCustomFunction,
  TransformedWorkbook,
  TransformedUser,
  TransformedGrant,
  NeoFolderType,
  NeoItemType,
  NeoMapType,
  NeoPermissionLevel,
  NeoUserRole,
} from './services/transformers/index.js';

// --- Session 5.5: target database + writer --------------------------------
export { createTargetDb } from './db/client.js';
export type { TargetConnectionConfig, TargetDatabase, TargetDb } from './db/client.js';
export { createMigrationWriter } from './services/migration-writer.js';
export type {
  MigrationWriter,
  MigrationLogInput,
  MigrationLogLevel,
  TargetSnapshot,
} from './services/migration-writer.js';
export type { TargetTable } from './db/schema.js';

// --- Session 5.5: migration runner ----------------------------------------
export {
  runMigration,
  dryRun,
  validateMigration,
  describeAlreadyMigrated,
  TARGET_TABLE_ORDER,
} from './services/migration-runner.js';
export type {
  RunMigrationOptions,
  MigrationResult,
  TargetPreflight,
  MigrationEvent,
  MigrationValidationResult,
  MigrationRunnerDeps,
  TableCounts,
  TableExpectation,
  TableReconciliation,
  SkipRecord,
} from './services/migration-runner.js';

// --- Formula corpus agreement gate (D-114) -------------------------------
export {
  measureAgreement,
  readFormulaCorpus,
  NO_RENDERER,
} from './services/formula-corpus-agreement.js';
export type {
  FormulaRenderer,
  AgreementResult,
  AgreementSample,
} from './services/formula-corpus-agreement.js';

// --- Post-commit verification (D-070) -------------------------------------
export {
  verifyMigration,
  checkSqlGeneration,
  checkFormulaCompileRate,
  checkReferentialClosure,
  checkReconciliation,
  checkMeasureSet,
  EXPECTED_LOSS_ALLOWANCES,
  summarise,
  formatVerifyReport,
} from './services/migration-verify.js';
export type {
  ExpectedLossAllowance,
  VerifyDb,
  SeamId,
  SeamStatus,
  SeamResult,
  CompileBucket,
  VerifyHooks,
  VerifyOptions,
  VerifyReport,
} from './services/migration-verify.js';

// --- Workbook body parser -------------------------------------------------
export {
  parseWorkbookDocument,
  parseConditionTokens,
  readWorkbookElements,
  countWorkbookColumns,
  CONDITION_OPERATORS,
  CONDITION_COMBINERS,
  DISCOVERER_WORKBOOK_CONTENT_TYPE,
} from './services/workbook-parser.js';
export type {
  ParsedWorkbookDocument,
  ParsedWorksheet,
  WorkbookColumn,
  WorkbookCondition,
  WorkbookParameter,
  WorkbookCalculation,
  WorkbookContentFormat,
  ConditionTokenInfo,
  // The worksheet model — see `EUL_SCHEMA_GROUND_TRUTH.md` §7.8. Nothing in
  // the migration consumes these yet; they are exported so W3–W7 can.
  RawElement,
  WorkbookRecord,
  WorkbookBlob,
  WorkbookQueryRequest,
  WorkbookSort,
  WorkbookSortLayout,
  WorkbookTotal,
  WorkbookJoin,
  WorkbookEulFilter,
  WorkbookParameterValue,
  WorkbookPageSetup,
  WorkbookAxisType,
  WorkbookDataType,
  WorkbookViewType,
  WorkbookSortDirection,
} from './services/workbook-parser.js';

// --- Maps-only re-import --------------------------------------------------
export {
  reimportMaps,
  MapReimportError,
  DEFAULT_HOST_BUSINESS_AREA,
} from './services/map-reimport.js';
export type {
  MapReimportOptions,
  MapReimportResult,
  MapReimportCounts,
} from './services/map-reimport.js';

// --- Provisioned credentials (temporary passwords) -------------------------
export {
  generateTemporaryPassword,
  TEMPORARY_PASSWORD_LENGTH,
} from './services/temporary-password.js';
export type {
  CredentialSink,
  ProvisionedCredential,
} from './services/temporary-password.js';

// --- Session 5.4/5.5: CLI -------------------------------------------------
export {
  runCli,
  main as runCliMain,
  loadConnectionConfig,
  loadTargetConfig,
  formatAssessmentReport,
  formatValidationResult,
  formatMigrationResult,
  formatMigrationValidation,
  commandAnalyze,
  commandExport,
  commandValidate,
  commandRun,
  commandValidateMigration,
  CliUsageError,
  EXIT_OK,
  EXIT_ERROR,
  EXIT_INVALID,
} from './cli.js';
export type { CliDeps, CliIO, RunCommandOptions } from './cli.js';
