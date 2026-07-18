/**
 * Discoverer Neo migration tool — public API.
 *
 * Session 5.3 delivers the version-detection and schema-adapter foundation;
 * later sessions build the actual migration pipeline on top of it.
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
