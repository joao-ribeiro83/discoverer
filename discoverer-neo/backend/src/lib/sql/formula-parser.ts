import {
  AGGREGATE_FUNCTIONS,
  SCALAR_FUNCTIONS,
  containsAggregateCall,
} from '@discoverer-neo/core/semantics';

import { SqlGenerationError } from '../../types/sql.js';

/**
 * Formula parser for calculated fields and calculated items.
 *
 * Formulas are authored by report builders and are the main free-text input
 * that ends up inside generated SQL, so they are never spliced in verbatim.
 * Instead they are tokenized, parsed into an AST against a strict grammar
 * (allowlisted functions, literals, item references, arithmetic, CASE), and
 * re-emitted as SQL from the AST. Anything outside the grammar is rejected.
 *
 * Item references are bare identifiers (AMOUNT) or bracketed display names
 * ([Order Amount]) resolved through a caller-supplied resolver, which maps
 * them to safe, fully-qualified column expressions.
 */

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

/**
 * The allowlist is declared once, in `@discoverer-neo/core/semantics`, and
 * re-exported here so every existing importer is unchanged.
 *
 * It moved because Phase 4.2's token renderer needs the same list and lives in
 * the migrator, which cannot import from this workspace. Copying it there
 * would have produced two lists that drift — defect BE-09, and the reason the
 * move happened at all. Do not re-declare a `new Set([...])` of function
 * names in this file.
 */
export {
  AGGREGATE_FUNCTIONS,
  SCALAR_FUNCTIONS,
  containsAggregateCall,
} from '@discoverer-neo/core/semantics';

/** Zero-argument pseudo-columns allowed as bare references. */
const SQL_CONSTANTS = new Set(['SYSDATE', 'CURRENT_DATE', 'CURRENT_TIMESTAMP']);

const KEYWORDS = new Set([
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS',
  'LIKE',
]);

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENT'
  | 'BRACKET_REF'
  | 'KEYWORD'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'STAR'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (type: TokenType, value: string, pos: number) =>
    tokens.push({ type, value, pos });

  while (i < input.length) {
    const ch = input[i]!;

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // string literal with '' escape
    if (ch === "'") {
      let j = i + 1;
      let value = '';
      for (;;) {
        if (j >= input.length) {
          throw new SqlGenerationError(
            `Unterminated string literal at position ${i}`,
          );
        }
        if (input[j] === "'") {
          if (input[j + 1] === "'") {
            value += "'";
            j += 2;
            continue;
          }
          break;
        }
        value += input[j];
        j += 1;
      }
      push('STRING', value, i);
      i = j + 1;
      continue;
    }

    // bracketed item reference: [Display Name]
    if (ch === '[') {
      const end = input.indexOf(']', i + 1);
      if (end === -1) {
        throw new SqlGenerationError(
          `Unterminated item reference at position ${i}`,
        );
      }
      const name = input.slice(i + 1, end).trim();
      if (!name) {
        throw new SqlGenerationError(`Empty item reference at position ${i}`);
      }
      push('BRACKET_REF', name, i);
      i = end + 1;
      continue;
    }

    // number
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      const m = /^[0-9]*\.?[0-9]+/.exec(input.slice(i))!;
      push('NUMBER', m[0], i);
      i += m[0].length;
      continue;
    }

    // identifier / keyword
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_$#]*/.exec(input.slice(i))!;
      const upper = m[0].toUpperCase();
      push(KEYWORDS.has(upper) ? 'KEYWORD' : 'IDENT', upper, i);
      i += m[0].length;
      continue;
    }

    // multi-char operators
    const two = input.slice(i, i + 2);
    if (two === '||' || two === '<>' || two === '!=' || two === '<=' || two === '>=') {
      push('OP', two === '!=' ? '<>' : two, i);
      i += 2;
      continue;
    }

    if ('+-/=<>'.includes(ch)) {
      push('OP', ch, i);
      i += 1;
      continue;
    }
    if (ch === '*') {
      push('STAR', '*', i);
      i += 1;
      continue;
    }
    if (ch === '(') {
      push('LPAREN', '(', i);
      i += 1;
      continue;
    }
    if (ch === ')') {
      push('RPAREN', ')', i);
      i += 1;
      continue;
    }
    if (ch === ',') {
      push('COMMA', ',', i);
      i += 1;
      continue;
    }

    throw new SqlGenerationError(
      `Unexpected character "${ch}" at position ${i} in formula`,
    );
  }

  push('EOF', '', input.length);
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser / emitter
// ---------------------------------------------------------------------------

export type ItemResolver = (name: string) => string | null;

export interface ParsedFormula {
  /** SQL expression re-emitted from the AST. */
  sql: string;
  /** True when the formula contains an aggregate function. */
  containsAggregate: boolean;
  /** Item names that the formula referenced. */
  referencedItems: string[];
  /**
   * BE-05 — the emitted SQL of every item reference that is **not** inside an
   * aggregate call, in first-use order.
   *
   * Oracle requires every non-aggregated SELECT expression to appear in
   * GROUP BY. `SUM(AMOUNT) / HEADCOUNT` contains an aggregate, so the whole
   * expression used to be treated as aggregated and `HEADCOUNT` never reached
   * GROUP BY — `ORA-00979`, on any map with a per-unit or share-of-total
   * calculation. `containsAggregate` answers "does this need a GROUP BY";
   * this answers "of what".
   *
   * Collected at emit time from the tree, never re-scanned out of the text.
   */
  bareReferences: string[];
}

class Parser {
  private pos = 0;
  containsAggregate = false;
  referencedItems: string[] = [];
  bareReferences: string[] = [];
  /**
   * How many aggregate calls enclose the node being emitted. A reference is
   * bare only at depth 0 — `SUM(A/B)` groups by nothing, `SUM(A)/B` groups
   * by B.
   */
  private aggregateDepth = 0;

  constructor(
    private tokens: Token[],
    private resolveItem: ItemResolver,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    return this.tokens[this.pos++]!;
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new SqlGenerationError(
        `Unexpected token "${t.value || t.type}" at position ${t.pos}` +
          (value ? ` (expected "${value}")` : ''),
      );
    }
    return t;
  }

  parse(): string {
    const sql = this.orExpr();
    const t = this.peek();
    if (t.type !== 'EOF') {
      throw new SqlGenerationError(
        `Unexpected trailing token "${t.value}" at position ${t.pos}`,
      );
    }
    return sql;
  }

  private orExpr(): string {
    let left = this.andExpr();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'OR') {
      this.next();
      left = `${left} OR ${this.andExpr()}`;
    }
    return left;
  }

  private andExpr(): string {
    let left = this.notExpr();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'AND') {
      this.next();
      left = `${left} AND ${this.notExpr()}`;
    }
    return left;
  }

  private notExpr(): string {
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'NOT') {
      this.next();
      return `NOT ${this.notExpr()}`;
    }
    return this.predicate();
  }

  private predicate(): string {
    const left = this.additive();
    const t = this.peek();

    if (t.type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(t.value)) {
      this.next();
      return `${left} ${t.value} ${this.additive()}`;
    }
    if (t.type === 'KEYWORD' && t.value === 'LIKE') {
      this.next();
      return `${left} LIKE ${this.additive()}`;
    }
    if (t.type === 'KEYWORD' && t.value === 'IS') {
      this.next();
      let negated = false;
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'NOT') {
        this.next();
        negated = true;
      }
      this.expect('KEYWORD', 'NULL');
      return `${left} IS${negated ? ' NOT' : ''} NULL`;
    }
    return left;
  }

  private additive(): string {
    let left = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t.type === 'OP' && (t.value === '+' || t.value === '-' || t.value === '||')) {
        this.next();
        left = `${left} ${t.value} ${this.multiplicative()}`;
      } else {
        return left;
      }
    }
  }

  private multiplicative(): string {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'STAR' || (t.type === 'OP' && t.value === '/')) {
        this.next();
        left = `${left} ${t.type === 'STAR' ? '*' : '/'} ${this.unary()}`;
      } else {
        return left;
      }
    }
  }

  private unary(): string {
    const t = this.peek();
    if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
      this.next();
      return `${t.value}${this.unary()}`;
    }
    return this.primary();
  }

  private primary(): string {
    const t = this.next();

    switch (t.type) {
      case 'NUMBER':
        return t.value;

      case 'STRING':
        // Re-emit from the parsed value with '' escaping — the literal can
        // never terminate the string context.
        return `'${t.value.replace(/'/g, "''")}'`;

      case 'KEYWORD':
        if (t.value === 'NULL') return 'NULL';
        if (t.value === 'CASE') return this.caseExpr();
        throw new SqlGenerationError(
          `Unexpected keyword "${t.value}" at position ${t.pos}`,
        );

      case 'LPAREN': {
        const inner = this.orExpr();
        this.expect('RPAREN');
        return `(${inner})`;
      }

      case 'BRACKET_REF':
        return this.reference(t.value, t.pos);

      case 'IDENT': {
        if (this.peek().type === 'LPAREN') {
          return this.functionCall(t);
        }
        if (SQL_CONSTANTS.has(t.value)) return t.value;
        return this.reference(t.value, t.pos);
      }

      default:
        throw new SqlGenerationError(
          `Unexpected token "${t.value || t.type}" at position ${t.pos}`,
        );
    }
  }

  private functionCall(nameToken: Token): string {
    const name = nameToken.value;
    const isAggregate = AGGREGATE_FUNCTIONS.has(name);
    if (!isAggregate && !SCALAR_FUNCTIONS.has(name)) {
      throw new SqlGenerationError(
        `Function "${name}" is not allowed in formulas`,
      );
    }
    if (isAggregate) this.containsAggregate = true;
    // Everything emitted inside an aggregate is aggregated, however deeply
    // nested, so the depth is incremented for the whole call and restored in
    // a finally — a parse error must not leave the counter wrong for the rest
    // of the formula.
    if (isAggregate) this.aggregateDepth += 1;
    try {
      return this.functionCallBody(name, isAggregate);
    } finally {
      if (isAggregate) this.aggregateDepth -= 1;
    }
  }

  private functionCallBody(name: string, isAggregate: boolean): string {
    this.expect('LPAREN');

    // COUNT(*) special case
    if (name === 'COUNT' && this.peek().type === 'STAR') {
      this.next();
      this.expect('RPAREN');
      return 'COUNT(*)';
    }

    // Optional DISTINCT for aggregates
    let distinct = '';
    if (
      isAggregate &&
      this.peek().type === 'IDENT' &&
      this.peek().value === 'DISTINCT'
    ) {
      this.next();
      distinct = 'DISTINCT ';
    }

    const args: string[] = [];
    if (this.peek().type !== 'RPAREN') {
      args.push(this.orExpr());
      while (this.peek().type === 'COMMA') {
        this.next();
        args.push(this.orExpr());
      }
    }
    this.expect('RPAREN');

    if (args.length === 0) {
      throw new SqlGenerationError(`Function "${name}" requires arguments`);
    }
    return `${name}(${distinct}${args.join(', ')})`;
  }

  private reference(name: string, pos: number): string {
    const resolved = this.resolveItem(name);
    if (!resolved) {
      throw new SqlGenerationError(
        `Unknown item reference "${name}" at position ${pos}`,
      );
    }
    this.referencedItems.push(name);
    if (this.aggregateDepth === 0) this.bareReferences.push(resolved);
    return resolved;
  }

  private caseExpr(): string {
    // Searched CASE: CASE WHEN cond THEN expr [WHEN ...] [ELSE expr] END
    const parts: string[] = ['CASE'];
    let sawWhen = false;

    while (this.peek().type === 'KEYWORD' && this.peek().value === 'WHEN') {
      this.next();
      const cond = this.orExpr();
      this.expect('KEYWORD', 'THEN');
      const then = this.orExpr();
      parts.push(`WHEN ${cond} THEN ${then}`);
      sawWhen = true;
    }
    if (!sawWhen) {
      throw new SqlGenerationError('CASE expression requires at least one WHEN');
    }
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'ELSE') {
      this.next();
      parts.push(`ELSE ${this.orExpr()}`);
    }
    this.expect('KEYWORD', 'END');
    parts.push('END');
    return parts.join(' ');
  }
}

/**
 * Parse a formula and re-emit it as a safe SQL expression.
 *
 * @param formula   the user-authored formula text
 * @param resolveItem maps an item name (case-insensitive, bare or bracketed)
 *                    to a fully-qualified column expression, or null if the
 *                    name is unknown.
 */
export function parseFormula(
  formula: string,
  resolveItem: ItemResolver,
): ParsedFormula {
  if (!formula || !formula.trim()) {
    throw new SqlGenerationError('Formula is empty');
  }
  const parser = new Parser(tokenize(formula), resolveItem);
  const sql = parser.parse();
  return {
    sql,
    containsAggregate: parser.containsAggregate,
    referencedItems: parser.referencedItems,
    bareReferences: parser.bareReferences,
  };
}

/**
 * A calculated field the same way every one of `select-clause.ts`,
 * `totals.ts` and `where-clause.ts` needs it: SQL text plus aggregate info.
 *
 * `field.formula` is **not** always safe to hand to `parseFormula`. Per its
 * own column comment (`map_calculated_fields.formula`), a field migrated
 * from a Discoverer workbook has item *names* substituted in but keeps
 * Discoverer's raw `[class,code](...)` function tokens — a different
 * grammar this parser does not speak. `[1,102]`'s argument list read as an
 * "unknown item reference" is that mismatch, not a bad migration: the real
 * SQL for a migrated field is `compiledSql`, written by the Phase 4
 * renderer (`dn-migrate verify --compile`) from `sourceTokens`, and this is
 * the one place that reads it — select/totals/where were each independently
 * re-parsing `formula` instead, which can only ever work by accident (a
 * formula with no Discoverer function codes in it).
 *
 * `sourceTokens` is what distinguishes the two cases: null means the field
 * was authored directly in Neo (or predates Phase 4.5), and `formula` there
 * is the only text that ever existed, so `parseFormula` is correct and
 * `compileStatus` staying null forever is not a refusal. Non-null means it
 * came from Discoverer, and only a `COMPILED`/`COMPILED_UNVERIFIED`
 * `compiledSql` may be trusted — anything else refuses loudly here rather
 * than reach `parseFormula` with raw tokens still inside it.
 *
 * `bareReferences` is empty for a compiled field: the renderer does not
 * persist per-reference structure, only the flat SQL, so BE-05's
 * mixed-aggregate GROUP BY refinement does not apply to it. A genuinely
 * mixed aggregate/bare compiled formula surfaces as Oracle's own
 * `ORA-00979` rather than a wrong GROUP BY — narrower than BE-05 covers,
 * but no narrower than "cannot plan at all", which is where every one of
 * these fields stood before.
 *
 * `opts.requireCompiled` forces the compiled path even when `sourceTokens`
 * is null. `where-clause.ts` sets it: a condition has required a `COMPILED`/
 * `COMPILED_UNVERIFIED` bucket regardless of provenance since D-059, and
 * that contract predates and is independent of this function existing —
 * loosening it for an ostensibly-Neo-authored field is a separate product
 * decision, not a side effect of fixing select/totals to stop misreading
 * `formula`.
 */
export function calculatedFieldSql(
  field: {
    name: string;
    formula: string;
    sourceTokens: string | null;
    compiledSql: string | null;
    compileStatus: string | null;
    compiledBinds?: Record<string, string | number> | null;
  },
  resolveItem: ItemResolver,
  opts: { requireCompiled?: boolean } = {},
): ParsedFormula & { binds: Record<string, string | number> } {
  if (field.sourceTokens != null || opts.requireCompiled) {
    if (
      field.compiledSql &&
      (field.compileStatus === 'COMPILED' || field.compileStatus === 'COMPILED_UNVERIFIED')
    ) {
      return {
        sql: field.compiledSql,
        containsAggregate: containsAggregateCall(field.compiledSql),
        referencedItems: [],
        bareReferences: [],
        // The renderer writes every literal as a bind (D-054). These are the
        // values; whichever statement carries `sql` has to bind them.
        binds: field.compiledBinds ?? {},
      };
    }
    throw new SqlGenerationError(
      `Calculated field "${field.name}" has not compiled ` +
        `(status: ${field.compileStatus ?? 'not verified'}) and cannot be used in a query`,
    );
  }
  return { ...parseFormula(field.formula, resolveItem), binds: {} };
}

/**
 * Add a calculated field's literal binds to a statement's bind set.
 *
 * The same field in two clauses brings the same values, which is harmless. A
 * name already bound to another value is refused rather than overwritten: one
 * of the two expressions would quietly compare against the wrong value.
 */
export function mergeBinds(into: Record<string, unknown>, binds: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(binds)) {
    if (name in into && into[name] !== value) {
      throw new SqlGenerationError(`Bind variable :${name} would carry two different values`);
    }
    into[name] = value;
  }
}

/** Validate a formula without emitting SQL (for save-time checks). */
export function validateFormula(
  formula: string,
  resolveItem: ItemResolver,
): { valid: boolean; error?: string } {
  try {
    parseFormula(formula, resolveItem);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
