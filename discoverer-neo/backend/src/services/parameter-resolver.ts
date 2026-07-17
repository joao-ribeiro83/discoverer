import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mapParameters, type MapParameter } from '../db/schema.js';

/**
 * Runtime parameter resolution for map execution.
 *
 * Parameters authored on a map (map_parameters) are prompted for at run time.
 * This module turns the raw values a caller supplies into bind-safe, typed
 * values that plug directly into the SQL generator's WHERE builder:
 *
 *  - STRING → string, as-is
 *  - NUMBER → JS number (validated finite)
 *  - DATE   → a normalized `YYYY-MM-DD` string. The WHERE builder already
 *             wraps date operands as `TO_DATE(:p, 'YYYY-MM-DD')`, so the bind
 *             value must be that plain string — never a JS Date or a
 *             pre-built TO_DATE(...) expression (which would double-wrap).
 *  - LIST   → an array of trimmed strings, which the WHERE builder expands
 *             into `IN (:p_0, :p_1, ...)`.
 *
 * Nothing here is ever concatenated into SQL text — resolved values only ever
 * become bind variables downstream. The single job of this module is
 * default-filling, required-checking, and type coercion.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParamType = 'STRING' | 'NUMBER' | 'DATE' | 'LIST';

export const PARAM_TYPES: readonly ParamType[] = [
  'STRING',
  'NUMBER',
  'DATE',
  'LIST',
];

/** The subset of a map_parameters row this module needs. */
export interface ParameterDefinition {
  name: string;
  paramType: string;
  defaultValue: string | null;
  isRequired: boolean;
}

export interface ResolvedParameters {
  /** Bind-ready values keyed by parameter name (defaults applied, cast). */
  resolved: Record<string, unknown>;
  /** Required parameters with neither a supplied value nor a default. */
  missing: string[];
}

/** Definition returned to the UI to build a run-time prompt dialog. */
export interface PromptParameter {
  name: string;
  paramType: ParamType;
  isRequired: boolean;
  defaultValue: string | null;
}

/** Thrown when a *supplied* value cannot be coerced to its declared type. */
export class ParameterResolutionError extends Error {
  constructor(
    public paramName: string,
    message: string,
  ) {
    super(message);
    this.name = 'ParameterResolutionError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A prompt dialog leaves unset fields empty. Treat undefined, null, and
 * empty/whitespace-only strings as "not supplied" so defaults and the
 * required-check apply. (An explicit empty-string filter is not a use case a
 * prompt can express, and is safer excluded than bound blindly.)
 */
function isAbsent(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function normalizeParamType(raw: string): ParamType {
  const upper = raw.toUpperCase();
  if ((PARAM_TYPES as readonly string[]).includes(upper)) {
    return upper as ParamType;
  }
  // Unknown declared types degrade to STRING rather than failing execution —
  // metadata drift should never harden into a run-time crash.
  return 'STRING';
}

function toNumber(name: string, raw: unknown): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      throw new ParameterResolutionError(
        name,
        `Parameter "${name}" must be a finite number`,
      );
    }
    return raw;
  }
  const s = String(raw).trim();
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) {
    throw new ParameterResolutionError(
      name,
      `Parameter "${name}" value "${s}" is not a valid number`,
    );
  }
  return n;
}

/** Parse a Date or ISO-ish string into a validated `YYYY-MM-DD` string. */
function toIsoDate(name: string, raw: unknown): string {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      throw new ParameterResolutionError(
        name,
        `Parameter "${name}" is an invalid Date`,
      );
    }
    const y = raw.getUTCFullYear();
    const m = raw.getUTCMonth() + 1;
    const d = raw.getUTCDate();
    return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
  }

  const s = String(raw).trim();
  // Accept a full ISO timestamp or a bare date; only the date part is used.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  if (!match) {
    throw new ParameterResolutionError(
      name,
      `Parameter "${name}" value "${s}" is not an ISO date (expected YYYY-MM-DD)`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Reject impossible calendar dates (e.g. 2024-02-31) by round-tripping.
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new ParameterResolutionError(
      name,
      `Parameter "${name}" value "${s}" is not a real calendar date`,
    );
  }
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/** Split a LIST value into trimmed, non-empty string members. */
function toList(raw: unknown): string[] {
  const parts = Array.isArray(raw)
    ? raw.map((v) => (typeof v === 'string' ? v : String(v)))
    : String(raw).split(',');
  return parts.map((v) => v.trim()).filter((v) => v.length > 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

// ---------------------------------------------------------------------------
// Public: value coercion
// ---------------------------------------------------------------------------

/**
 * Coerce a single supplied value to its parameter's declared type, returning a
 * bind-ready value. Throws ParameterResolutionError on a value that cannot be
 * coerced. Callers should skip absent values (see {@link isAbsent}); passing an
 * absent value here for a NUMBER/DATE parameter is treated as an error.
 */
export function validateParameterValue(
  param: ParameterDefinition,
  value: unknown,
): unknown {
  const type = normalizeParamType(param.paramType);
  switch (type) {
    case 'NUMBER':
      return toNumber(param.name, value);
    case 'DATE':
      return toIsoDate(param.name, value);
    case 'LIST':
      return toList(value);
    case 'STRING':
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Public: resolution (pure core)
// ---------------------------------------------------------------------------

/**
 * Resolve a set of parameter definitions against caller-supplied values.
 *
 * For each parameter: use the supplied value if present, else its default,
 * else — when required — report it as missing. Present values (whether from
 * the caller or a default) are type-cast; a value that fails to cast throws.
 *
 * Missing required parameters are RETURNED (not thrown) so a UI can prompt for
 * them and callers can decide policy. The execution service treats a non-empty
 * `missing` list as a hard configuration error.
 */
export function resolveParametersForDefinitions(
  definitions: ParameterDefinition[],
  provided: Record<string, unknown> = {},
): ResolvedParameters {
  const resolved: Record<string, unknown> = {};
  const missing: string[] = [];

  for (const def of definitions) {
    const supplied = provided[def.name];
    if (!isAbsent(supplied)) {
      resolved[def.name] = validateParameterValue(def, supplied);
      continue;
    }
    if (!isAbsent(def.defaultValue)) {
      resolved[def.name] = validateParameterValue(def, def.defaultValue);
      continue;
    }
    if (def.isRequired) {
      missing.push(def.name);
    }
    // Optional with no default and no value: omit. The WHERE builder emits an
    // unbound placeholder only if a condition references it — matching the
    // pre-existing behaviour for un-supplied optional parameters.
  }

  return { resolved, missing };
}

// ---------------------------------------------------------------------------
// Public: database-backed wrappers
// ---------------------------------------------------------------------------

function toDefinition(row: MapParameter): ParameterDefinition {
  return {
    name: row.name,
    paramType: row.paramType,
    defaultValue: row.defaultValue,
    isRequired: row.isRequired,
  };
}

/** Load a map's parameter definitions, ordered by name for stable prompts. */
async function loadParameterDefinitions(
  mapId: string,
): Promise<ParameterDefinition[]> {
  const rows = await db
    .select()
    .from(mapParameters)
    .where(eq(mapParameters.mapId, mapId))
    .orderBy(asc(mapParameters.name));
  return rows.map(toDefinition);
}

/**
 * Resolve all parameters for a stored map against supplied values.
 * Fetches map_parameters, then delegates to the pure core.
 */
export async function resolveParameters(
  mapId: string,
  provided: Record<string, unknown> = {},
): Promise<ResolvedParameters> {
  const definitions = await loadParameterDefinitions(mapId);
  return resolveParametersForDefinitions(definitions, provided);
}

/**
 * Parameter definitions for a map, shaped for a run-time prompt dialog.
 */
export async function buildPromptParameters(
  mapId: string,
): Promise<PromptParameter[]> {
  const definitions = await loadParameterDefinitions(mapId);
  return definitions.map((d) => ({
    name: d.name,
    paramType: normalizeParamType(d.paramType),
    isRequired: d.isRequired,
    defaultValue: d.defaultValue,
  }));
}
