/**
 * The SQL function allowlist — one declaration, two consumers.
 *
 * This is the security contract for every generated expression: a function
 * name reaches SQL only if it is named here. It used to live in
 * `backend/src/lib/sql/formula-parser.ts`, which the migrator cannot import
 * (`@discoverer-neo/backend` publishes no entry point, and `migrate`'s
 * `rootDir` forbids reaching across). The renderer needing the same list is
 * exactly how a second, drifting copy gets written — defect BE-09 — so the
 * list moved *here* and the backend re-exports it, the same way
 * `backend/src/db/schema.ts` re-exports the 21 shared tables rather than
 * redeclaring them.
 *
 * Adding a `new Set([...])` of function names on the backend side
 * re-introduces the hazard the move removed. Don't.
 */

/** Aggregates. Membership sets `ParsedFormula.containsAggregate`. */
export const AGGREGATE_FUNCTIONS = new Set(['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']);

export const SCALAR_FUNCTIONS = new Set([
  // string
  'SUBSTR',
  'LENGTH',
  'UPPER',
  'LOWER',
  'TRIM',
  'LTRIM',
  'RTRIM',
  'INSTR',
  'REPLACE',
  'LPAD',
  'RPAD',
  'CONCAT',
  'INITCAP',
  // numeric
  'ROUND',
  'TRUNC',
  'FLOOR',
  'CEIL',
  'ABS',
  'MOD',
  'POWER',
  'SQRT',
  'SIGN',
  // date
  'ADD_MONTHS',
  'MONTHS_BETWEEN',
  'LAST_DAY',
  'NEXT_DAY',
  // conversion / null handling
  'TO_CHAR',
  'TO_NUMBER',
  'TO_DATE',
  'NVL',
  'NVL2',
  'COALESCE',
  'DECODE',
  'GREATEST',
  'LEAST',
]);

/**
 * Aggregates the fan-trap planner cannot re-aggregate over a rewritten
 * sub-query. A formula carrying one is refused (`UNREAGGREGABLE`, D-058)
 * rather than rewritten into a wrong number.
 *
 * `AVG` cannot re-aggregate at all without carrying `SUM` and `COUNT`
 * separately — Oracle says Discoverer decomposed it internally, but says so
 * about a different feature, so reproducing it here would be a guess about
 * money. `COUNT DISTINCT` is not re-aggregatable by any decomposition:
 * distinct counts of overlapping sets do not add. `STDDEV`, `VARIANCE` and
 * `MEDIAN` are the same problem with more arithmetic. This is ordinary user
 * behaviour, not an edge case — the estate carries 282 `COUNT DISTINCT`
 * totals — so the refusal has to explain itself (D-035, D-036).
 *
 * Both spellings of `COUNT DISTINCT` are here, and the abbreviated `VAR`,
 * because a measure's stored aggregate reaches this set as free text and both
 * forms occur. This list used to be declared twice, differing in exactly those
 * three names — defect BE-09 again — with `query-plan.ts` holding the fuller
 * one. That one won, and `query-plan.ts` now re-exports this.
 */
export const UNREAGGREGABLE_FUNCTIONS = new Set([
  'AVG',
  'COUNT DISTINCT',
  'COUNT_DISTINCT',
  'STDDEV',
  'VARIANCE',
  'VAR',
  'MEDIAN',
]);

/** True when `name` may be emitted into SQL at all. */
export function isAllowedFunction(name: string): boolean {
  return AGGREGATE_FUNCTIONS.has(name) || SCALAR_FUNCTIONS.has(name);
}
