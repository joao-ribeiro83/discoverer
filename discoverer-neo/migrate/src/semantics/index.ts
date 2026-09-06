/**
 * Discoverer formula semantics — the token-tree renderer and the SQL contract
 * it shares with the backend.
 *
 * Lives in the migrator rather than the backend because the backend can import
 * from here and not the other way round (D-011, D-054): `@discoverer-neo/core`
 * publishes entry points, `@discoverer-neo/backend` does not. That direction
 * is what lets the allowlist and the identifier rules have exactly one
 * declaration instead of two that drift.
 */

export {
  AGGREGATE_FUNCTIONS,
  SCALAR_FUNCTIONS,
  UNREAGGREGABLE_FUNCTIONS,
  isAllowedFunction,
} from './allowlist.js';

export {
  isValidIdentifier,
  isValidBindName,
  MAX_IDENTIFIER_LENGTH,
  MAX_BIND_NAME_LENGTH,
} from './identifiers.js';

export {
  builtinCode,
  IMPLEMENTED_CODES,
  PHASE_4_2_CODES,
  PHASE_4_2_GATE_CLOSERS,
  PHASE_4_2_TOP_TEN,
} from './builtin-codes.js';
export type { BuiltinCode, DisplayShape, SqlForm } from './builtin-codes.js';

export {
  createBindCollector,
  displayDateLiteral,
  FITTED_CODES,
  displayMatches,
  Quarantined,
  renderDisplay,
  renderSql,
} from './render.js';
export type {
  ItemBinding,
  QuarantineReason,
  RenderedFormula,
  SqlRenderContext,
  SqlRenderResult,
} from './render.js';
