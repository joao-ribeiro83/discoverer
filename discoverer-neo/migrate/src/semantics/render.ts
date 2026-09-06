/**
 * The token-formula renderer (Phase 4.2).
 *
 * Discoverer stores a formula as a token tree — `[1,95]([1,58]([5,4,…]),[5,2,"200"])`
 * — and showed the user a rendered string — `TO_DATE('01.12.01')-200`. This
 * module turns the first into two different things:
 *
 * - `renderDisplay` reproduces Discoverer's own display string. It is the
 *   **fidelity oracle**: it is compared against 37 971 real pairs, and a
 *   mismatch means the tree was read wrongly.
 * - `renderSql` emits an executable Oracle expression. It is the deliverable.
 *
 * They are separate because the display form is not the SQL (see
 * `builtin-codes.ts`), and because only one of them is a security boundary.
 *
 * ## Three rules that shape everything here
 *
 * 1. **Render from the tree, never from the display string** (D-050). The
 *    display language is ambiguous: `NVL(R Com Tx Com Vig/100,0)` holds a bare
 *    item name containing spaces abutting an operator, and nothing can
 *    reliably separate them. It is an oracle, not an input.
 * 2. **Parenthesise every infix node unconditionally** (D-051). `((a) + (b))`.
 *    This removes operator precedence from the problem entirely — there is no
 *    precedence table anywhere in this phase, and none is needed. The cost is
 *    uglier SQL, which is the right trade against silently wrong numbers.
 * 3. **Refuse rather than approximate** (D-058). Anything not implemented,
 *    not fitted, not resolvable or not allowlisted returns a quarantine with a
 *    stated reason. Nothing is best-effort. A quarantined formula is a visible
 *    gap; a wrongly rendered one is a wrong number in a report whose users
 *    have fifteen years of trained trust in it.
 */

import type { FormulaNode } from '../services/workbook-parser.js';
import { AGGREGATE_FUNCTIONS, SCALAR_FUNCTIONS, UNREAGGREGABLE_FUNCTIONS } from './allowlist.js';
import { builtinCode, PHASE_4_2_CODES } from './builtin-codes.js';
import { isValidBindName, isValidIdentifier } from './identifiers.js';

// ---------------------------------------------------------------------------
// Refusal
// ---------------------------------------------------------------------------

/**
 * Why a formula was refused. The set is closed on purpose: a caller
 * aggregating these into a histogram must not be handed free text.
 */
export type QuarantineReason =
  /** A `[1,n]` the Phase 4.1 fit could not settle. Never renders. */
  | 'UNFITTED_CODE'
  /** A FITTED `[1,n]` outside this phase's scope. Phase 4.3 lands it. */
  | 'CODE_NOT_IMPLEMENTED'
  /** A node the parser could not type. */
  | 'UNKNOWN_NODE'
  /** A `[2,n]` custom function. The aligned corpus attests none; 4.3 resolves them. */
  | 'UNRESOLVED_FUNCTION'
  /** A `[6,n]`/`[8,n]` the element table does not carry. */
  | 'UNRESOLVED_ELEMENT'
  /** A `[5,4]` date payload that is not midnight — truncating it would lose data. */
  | 'DATE_WITH_TIME'
  /** A `[5,k]` literal kind outside 1, 2 and 4. */
  | 'UNKNOWN_LITERAL_KIND'
  /** An argument count no attestation supports for that code. */
  | 'BAD_ARITY'
  /** A resolved name that is not a legal Oracle identifier. Rejected, never escaped. */
  | 'INVALID_IDENTIFIER'
  /** A fitted code whose SQL name is outside the allowlist. */
  | 'NOT_IN_ALLOWLIST'
  /** An aggregate the fan-trap planner cannot re-aggregate. */
  | 'UNREAGGREGABLE'
  /**
   * The code renders, but its rendering does not show what it computes, so no
   * SQL can be derived from it. `[1,126]` `2_Pass_Percentage` displays as its
   * argument alone and is the whole population of this reason.
   */
  | 'UNKNOWN_SEMANTICS'
  /** The token string is not a readable tree. */
  | 'PARSE_FAILED';

export class Quarantined extends Error {
  constructor(
    readonly reason: QuarantineReason,
    readonly detail: string,
  ) {
    super(`${reason}: ${detail}`);
    this.name = 'Quarantined';
  }
}

/**
 * The `[1,n]` codes Phase 4.1 settled to a single shape.
 *
 * Carried as data so a refusal can say *which* kind of gap it is: a code
 * Phase 4.3 will implement, or one the evidence refuses to settle at all.
 * Pinned to `corpus/builtin-code-table.json` by `formula-renderer.test.ts`.
 */
export const FITTED_CODES: ReadonlySet<number> = new Set([
  1, 11, 12, 18, 23, 28, 32, 42, 43, 44, 48, 49, 55, 58, 61, 68, 73, 79, 81, 82, 83, 84, 85,
  86, 87, 88, 91, 92, 94, 95, 96, 97, 98, 99, 102, 103, 104, 106, 114, 115, 117, 126,
]);

function refuseCode(code: number): never {
  throw new Quarantined(
    FITTED_CODES.has(code) ? 'CODE_NOT_IMPLEMENTED' : 'UNFITTED_CODE',
    `[1,${code}]`,
  );
}

// ---------------------------------------------------------------------------
// Literals
// ---------------------------------------------------------------------------

/**
 * `[5,4]` payloads are `YYYYMMDDHHMISS`, and Oracle showed them `yy.mm.dd`.
 *
 * Fitted, not assumed: that shape reproduces 846 date-bearing corpus rows
 * against 184 for `dd.mm.yy`, 35 for `mm.dd.yy` and 0 for every other
 * candidate. Not one of the estate's 7 670 date literals carries a time, so
 * the trailing six digits are structural — but a payload that *did* carry one
 * is refused rather than truncated.
 */
export function displayDateLiteral(payload: string): string {
  if (!/^\d{14}$/.test(payload)) {
    throw new Quarantined('UNKNOWN_LITERAL_KIND', `[5,4,"${payload}"] is not YYYYMMDDHHMISS`);
  }
  if (!payload.endsWith('000000')) {
    throw new Quarantined('DATE_WITH_TIME', `[5,4,"${payload}"] carries a time component`);
  }
  return `'${payload.slice(2, 4)}.${payload.slice(4, 6)}.${payload.slice(6, 8)}'`;
}

// ---------------------------------------------------------------------------
// Display rendering — the fidelity oracle
// ---------------------------------------------------------------------------

/**
 * Marks a span the anonymised corpus cannot supply text for.
 *
 * `[6,n]` and `[8,n]` name a workbook element, and the committed corpus
 * carries no element table — Phase 0.5 replaced every identifier with a
 * length- and byte-class-preserving substitute (D-114). So the display
 * renderer emits a marked `i18` where the name would go, and `displayMatches`
 * unifies those spans against the real string with a back-reference, exactly
 * as the Phase 4.1 code fitter did. That is the strongest claim the anonymised
 * corpus permits; everything outside a marked span is compared byte for byte.
 *
 * U+0001 cannot occur in a display formula, so it can never be mistaken for
 * content.
 */
export const DISPLAY_NAME_MARK = '\u0001';
/** Shorthand, used heavily just below. */
const MARK = DISPLAY_NAME_MARK;

/** Render the tree as Discoverer would have displayed it, with marked names. */
export function renderDisplay(node: FormulaNode): string {
  switch (node.type) {
    case 'item':
      return `${MARK}i${node.elementId}${MARK}`;
    case 'parameter':
      return `${MARK}p${node.elementId}${MARK}`;
    case 'function':
      // A `[2,n]` prints its own name, which the corpus also anonymised.
      return node.args.length === 0
        ? `${MARK}f${node.elementId}${MARK}`
        : `${MARK}f${node.elementId}${MARK}(${node.args.map(renderDisplay).join(',')})`;
    case 'literal':
      if (node.literalKind === 2) return node.value;
      if (node.literalKind === 1) return `'${node.value}'`;
      if (node.literalKind === 4) return displayDateLiteral(node.value);
      throw new Quarantined('UNKNOWN_LITERAL_KIND', `[5,${node.literalKind}]`);
    case 'unknown':
      throw new Quarantined('UNKNOWN_NODE', `fields [${node.fields.join(',')}]`);
    case 'call': {
      const entry = builtinCode(node.code);
      if (entry === undefined) refuseCode(node.code);
      const [min, max] = entry.arity;
      if (node.args.length < min || node.args.length > max) {
        throw new Quarantined(
          'BAD_ARITY',
          `[1,${node.code}] ${entry.displayName} with ${node.args.length} arguments`,
        );
      }
      const parts = node.args.map(renderDisplay);
      const name = entry.displayName;
      switch (entry.shape) {
        case 'prefix':
          return `${name}(${parts.join(',')})`;
        case 'zeroBare':
          return name;
        case 'infixTight':
          return parts.join(name);
        case 'infixSpaced':
          return parts.join(` ${name} `);
        case 'bracketSpaced':
          return `( ${parts[0]} )`;
        case 'unaryTight':
          return `${name}${parts[0]}`;
        case 'between':
          return `${parts[0]} ${name} ${parts[1]} AND ${parts[2]}`;
        case 'inList':
          return `${parts[0]} ${name} (${parts.slice(1).join(',')})`;
        case 'passthrough':
          // `[1,126]` leaves no mark on the rendering at all. Its argument is
          // the whole display form — which is exactly why it has no SQL.
          return parts[0]!;
      }
    }
  }
}

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * A name the corpus anonymised away.
 *
 * The second branch is the fitter's `strict` class verbatim, and its
 * constraints are load bearing: no bracket or comma, so a placeholder cannot
 * swallow structure and make a wrong shape "match"; and no leading or trailing
 * space, which is the only thing separating `a<b` from `a < b`.
 *
 * The first branch is this phase's one addition, and the corpus forced it.
 * Discoverer wraps a name that needs it in double quotes — a parameter as
 * `:"Prazo Restante (M/A)"`, an item as `"P TOTAL (BRUTO)"` — and those names
 * genuinely contain brackets. Under the bare strict class they can never
 * match, which is why nineteen otherwise-clean rows were being filed as
 * renderer defects. A quoted branch is safe where a widened strict class would
 * not be: the closing quote bounds the span, so it still cannot run past its
 * own name and eat the structure around it.
 */
const NAME_PATTERN = ':?"[^"]*"|[A-Za-z_:"\\u0080-\\u00ff](?:[^(),]*?[^(), ])?';

/**
 * Discoverer brackets a whole *condition* when it shows it — `( a OR b )` —
 * even though nothing in the token tree says so.
 *
 * Phase 4.1 established this and deliberately kept it out of every code's
 * shape: it is a property of the root position, not of the operator. Folding
 * it into `[1,99]` would fit `OR` as an operator that brackets itself, and
 * `[1,98]` `AND`, which also occurs unbracketed inside a `CASE`, could then
 * not be fitted at all. `fit-builtin-codes.ts:rootUnwrapped` is the same
 * function; the comparator has to know it too, or nine attested condition rows
 * read as renderer defects.
 */
function rootUnwrapped(display: string): string | null {
  return display.startsWith('( ') && display.endsWith(' )') ? display.slice(2, -2) : null;
}

/**
 * Does `template` reproduce `display`, treating marked spans as unknown names?
 *
 * A name repeated in one formula must render identically on each use — that
 * back-reference is a real constraint, and it is why a reading that renders
 * one item two different ways cannot pass.
 */
export function displayMatches(template: string, display: string): boolean {
  const parts = template.split(MARK);
  // Splitting on a paired marker yields literal, key, literal, key, …
  if (parts.length % 2 === 0) return false;
  const groups = new Map<string, number>();
  let pattern = '^';
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (i % 2 === 0) {
      pattern += part.replace(REGEX_SPECIALS, '\\$&');
    } else {
      const seen = groups.get(part);
      if (seen !== undefined) {
        pattern += `\\${seen}`;
      } else {
        groups.set(part, groups.size + 1);
        pattern += `(${NAME_PATTERN})`;
      }
    }
  }
  const regex = new RegExp(`${pattern}$`);
  if (regex.test(display)) return true;
  const inner = rootUnwrapped(display);
  return inner !== null && regex.test(inner);
}

// ---------------------------------------------------------------------------
// SQL rendering — the deliverable
// ---------------------------------------------------------------------------

/** What a `[6,n]` element resolves to. Both halves are validated here. */
export interface ItemBinding {
  /** The item's name, reported in `referencedItems`. */
  name: string;
  /** Optional qualifier — a table alias or owner. */
  qualifier?: string;
  /** The column. */
  column: string;
}

/**
 * What a `[2,n]` resolves to: one row of `custom_functions`.
 *
 * The `[2,n]` id is a workbook-local `IoId`, not an EUL id — the dumps carry
 * `IoId = 16` beside `Id = 114404` — so the caller reaches the row through the
 * workbook element table exactly as it does for `[6,n]` and `[8,n]`. This
 * renderer never looks a function up; it is handed one or it refuses.
 */
export interface FunctionBinding {
  /**
   * `custom_functions.name`, emitted verbatim as the call's identifier once
   * validated. Never quoted: an unquoted Oracle identifier folds to upper
   * case and matches a function created the ordinary way, where quoting it
   * would make the call case-sensitive and miss.
   */
  name: string;
  /**
   * Inclusive `[min, max]` argument count from `custom_functions.parameters`,
   * or **null when the row carries no signature at all**.
   *
   * Null is the estate's normal case, not an edge one. `transformCustomFunction`
   * writes `parameters: null` for every row and raises
   * `FUNCTION_SIGNATURE_DEFAULTED`, because the EUL's normalized `FUNCTIONS`
   * read carries no argument list. So the arity check below is real and
   * enforced, and today it has nothing to bite on until somebody completes a
   * signature in Neo. Refusing every call for want of a signature would make
   * all 593 migrated functions permanently uncallable, which is not what the
   * missing column means.
   */
  arity: readonly [number, number] | null;
}

export interface SqlRenderContext {
  /** `[6,n]` → the column it names, or null when the element table lacks it. */
  resolveItem(elementId: number): ItemBinding | null;
  /** `[8,n]` → the bind NAME (no colon) the parameter binds to, or null. */
  resolveParameter(elementId: number): string | null;
  /**
   * `[2,n]` → the migrated `custom_functions` row, or null when nothing
   * resolves. Null is a refusal (D-057), never a pass-through: a call this
   * system cannot name is a call it must not emit.
   */
  resolveFunction(elementId: number): FunctionBinding | null;
  /** Register a runtime value; returns the placeholder to write, e.g. `:v1`. */
  bind(value: string): string;
}

/** Mirrors `ParsedFormula` in `backend/src/lib/sql/formula-parser.ts`. */
export interface RenderedFormula {
  sql: string;
  /**
   * True when the expression contains an aggregate. Read from the tree, never
   * re-derived from the emitted text — the fan-trap planner decides whether a
   * query needs rewriting on this flag, and a text scan would call a column
   * named `SUM_TOTAL` an aggregate.
   */
  containsAggregate: boolean;
  referencedItems: string[];
}

export type SqlRenderResult =
  | ({ ok: true } & RenderedFormula)
  | { ok: false; reason: QuarantineReason; detail: string };

/**
 * A ready-made bind allocator that numbers its own placeholders `:v1`, `:v2`,
 * … and collects their values. Callers with their own numbering pass their
 * own `bind` instead.
 */
export function createBindCollector(): {
  bind: (value: string) => string;
  values: Record<string, string>;
} {
  const values: Record<string, string> = {};
  let n = 0;
  return {
    bind(value) {
      n += 1;
      const name = `v${n}`;
      values[name] = value;
      return `:${name}`;
    },
    values,
  };
}

class SqlEmitter {
  containsAggregate = false;
  readonly referencedItems: string[] = [];

  constructor(private readonly ctx: SqlRenderContext) {}

  emit(node: FormulaNode): string {
    switch (node.type) {
      case 'item':
        return this.item(node.elementId);
      case 'parameter':
        return this.parameter(node.elementId);
      case 'function':
        return this.customFunction(node);
      case 'literal':
        return this.literal(node.literalKind, node.value);
      case 'unknown':
        throw new Quarantined('UNKNOWN_NODE', `fields [${node.fields.join(',')}]`);
      case 'call':
        return this.call(node);
    }
  }

  private item(elementId: number): string {
    const binding = this.ctx.resolveItem(elementId);
    if (binding === null) throw new Quarantined('UNRESOLVED_ELEMENT', `[6,${elementId}]`);
    // Rejected, never escaped: an identifier carrying a quote is a metadata
    // defect or an attack, and quoting it away would hide both.
    if (!isValidIdentifier(binding.column)) {
      throw new Quarantined(
        'INVALID_IDENTIFIER',
        `[6,${elementId}] column ${JSON.stringify(binding.column)}`,
      );
    }
    let sql = `"${binding.column}"`;
    if (binding.qualifier !== undefined) {
      if (!isValidIdentifier(binding.qualifier)) {
        throw new Quarantined(
          'INVALID_IDENTIFIER',
          `[6,${elementId}] qualifier ${JSON.stringify(binding.qualifier)}`,
        );
      }
      sql = `"${binding.qualifier}".${sql}`;
    }
    this.referencedItems.push(binding.name);
    return sql;
  }

  /**
   * A registered PL/SQL function call — the largest new SQL surface in this
   * phase, and the one place a name from migrated metadata reaches SQL text.
   *
   * Four gates, in this order, and every one of them refuses rather than
   * repairs:
   *
   * 1. **It must resolve.** A `[2,n]` with no `custom_functions` row is
   *    `UNRESOLVED_FUNCTION` (D-057). Never a pass-through — emitting an
   *    unknown name would either fail at run time or, worse, hit a different
   *    function that happens to exist.
   * 2. **The name must be an identifier.** `isValidIdentifier` is the same
   *    predicate the column path uses, so a name carrying a quote, a bracket,
   *    a space or a semicolon is rejected outright. It is never escaped and
   *    never quoted into safety: a hostile `custom_functions.name` is a
   *    metadata defect or an attack, and quoting it would hide both.
   * 3. **The arity must match** any signature the row carries.
   * 4. **The arguments go through the ordinary emitter**, so every literal
   *    inside the call is still a bind. There is no path here that splices a
   *    runtime value into text.
   *
   * The one thing this cannot check: the aligned corpus attests zero `[2,n]`
   * occurrences (decoder spec §9), so `NAME(args)` is Oracle's SQL form read
   * back, not a fitted display shape. It is marked `[INFER]` there and the
   * display renderer still marks the name as an unknown span rather than
   * claiming to reproduce it.
   */
  private customFunction(node: Extract<FormulaNode, { type: 'function' }>): string {
    const binding = this.ctx.resolveFunction(node.elementId);
    if (binding === null) {
      throw new Quarantined('UNRESOLVED_FUNCTION', `[2,${node.elementId}]`);
    }
    if (!isValidIdentifier(binding.name)) {
      throw new Quarantined(
        'INVALID_IDENTIFIER',
        `[2,${node.elementId}] function ${JSON.stringify(binding.name)}`,
      );
    }
    if (binding.arity !== null) {
      const [min, max] = binding.arity;
      if (node.args.length < min || node.args.length > max) {
        throw new Quarantined(
          'BAD_ARITY',
          `[2,${node.elementId}] ${binding.name} with ${node.args.length} arguments`,
        );
      }
    }
    const args = node.args.map((arg) => this.emit(arg));
    return `${binding.name}(${args.join(', ')})`;
  }

  private parameter(elementId: number): string {
    const name = this.ctx.resolveParameter(elementId);
    if (name === null) throw new Quarantined('UNRESOLVED_ELEMENT', `[8,${elementId}]`);
    if (!isValidBindName(name)) {
      throw new Quarantined('INVALID_IDENTIFIER', `[8,${elementId}] bind ${JSON.stringify(name)}`);
    }
    return `:${name}`;
  }

  private literal(kind: number, value: string): string {
    // Every runtime value is a bind. Nothing is spliced, not even a number:
    // a "number" here is whatever bytes the workbook happened to store.
    if (kind === 1 || kind === 2) return this.ctx.bind(value);
    if (kind === 4) {
      // A `[5,4]` payload is `YYYYMMDDHHMISS` and Discoverer showed it
      // `'01.12.01'`. Emitting *that* would make the century depend on
      // NLS_DATE_FORMAT, so the display form is not the SQL here either.
      //
      // What goes out instead is the four-digit date with its mask spelled
      // out. The mask is a constant in this file, never taken from the data,
      // and the value is still a bind — so this adds no new splicing surface.
      //
      // The trailing six digits are dropped, and only because they are proven
      // to be zero: `displayDateLiteral` refuses a non-midnight payload rather
      // than truncating it. That refusal is kept for SQL too, even though a
      // 14-digit mask could carry a time — the year, month and day positions
      // are fitted (846 rows against 184 for the runner-up) and the time
      // positions are not, because not one of the estate's 7 670 date literals
      // exercises them. Emitting an unattested reading of six digits is the
      // guess this phase exists to refuse.
      displayDateLiteral(value);
      return `TO_DATE(${this.ctx.bind(value.slice(0, 8))}, 'YYYYMMDD')`;
    }
    throw new Quarantined('UNKNOWN_LITERAL_KIND', `[5,${kind}]`);
  }

  private call(node: Extract<FormulaNode, { type: 'call' }>): string {
    const entry = builtinCode(node.code);
    if (entry === undefined) refuseCode(node.code);
    const [min, max] = entry.arity;
    if (node.args.length < min || node.args.length > max) {
      throw new Quarantined(
        'BAD_ARITY',
        `[1,${node.code}] ${entry.displayName} with ${node.args.length} arguments`,
      );
    }
    const args = node.args.map((arg) => this.emit(arg));
    const { sql } = entry;
    switch (sql.kind) {
      case 'keyword':
        return sql.text;
      case 'group':
        return `(${args[0]})`;
      case 'operator':
        // D-051. Every operand parenthesised and the node itself parenthesised:
        // there is no precedence question left to get wrong.
        return `(${args.map((a) => `(${a})`).join(` ${sql.op} `)})`;
      case 'function':
        if (!SCALAR_FUNCTIONS.has(sql.name)) {
          throw new Quarantined('NOT_IN_ALLOWLIST', sql.name);
        }
        return `${sql.name}(${args.join(', ')})`;
      case 'aggregate':
        if (!AGGREGATE_FUNCTIONS.has(sql.name)) {
          throw new Quarantined('NOT_IN_ALLOWLIST', sql.name);
        }
        if (UNREAGGREGABLE_FUNCTIONS.has(sql.name)) {
          throw new Quarantined('UNREAGGREGABLE', sql.name);
        }
        this.containsAggregate = true;
        return `${sql.name}(${args.join(', ')})`;
      case 'unary':
        return `(${sql.op}(${args[0]}))`;
      case 'between':
        return `((${args[0]}) BETWEEN (${args[1]}) AND (${args[2]}))`;
      case 'inList':
        return `((${args[0]}) ${sql.not ? 'NOT IN' : 'IN'} (${args
          .slice(1)
          .map((arg) => `(${arg})`)
          .join(', ')}))`;
      case 'aggregateDistinct':
        // `COUNT(DISTINCT a)`. The fan-trap planner cannot re-aggregate it
        // (D-058, §10), so it refuses before it can be emitted. The emission
        // is written out anyway, so that lifting the restriction later is one
        // edit rather than a fresh guess about what `[1,117]` means.
        if (UNREAGGREGABLE_FUNCTIONS.has(`${sql.name}_DISTINCT`)) {
          throw new Quarantined('UNREAGGREGABLE', `${sql.name}_DISTINCT`);
        }
        if (!AGGREGATE_FUNCTIONS.has(sql.name)) {
          throw new Quarantined('NOT_IN_ALLOWLIST', sql.name);
        }
        this.containsAggregate = true;
        return `${sql.name}(DISTINCT ${args[0]})`;
      case 'displayOnly':
        throw new Quarantined(sql.reason, `[1,${node.code}] ${entry.displayName}`);
    }
  }
}

/** Render a token tree into an executable Oracle expression, or refuse. */
export function renderSql(node: FormulaNode, ctx: SqlRenderContext): SqlRenderResult {
  const emitter = new SqlEmitter(ctx);
  try {
    const sql = emitter.emit(node);
    return {
      ok: true,
      sql,
      containsAggregate: emitter.containsAggregate,
      referencedItems: emitter.referencedItems,
    };
  } catch (err) {
    if (err instanceof Quarantined) {
      return { ok: false, reason: err.reason, detail: err.detail };
    }
    throw err;
  }
}

export { PHASE_4_2_CODES };
