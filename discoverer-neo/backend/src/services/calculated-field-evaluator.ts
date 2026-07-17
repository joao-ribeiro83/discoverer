/**
 * Row-level calculated field evaluator.
 *
 * Calculated fields supplied at execution time are computed in-process against
 * the result rows, so they can reference the query's *output* columns by name
 * (the Discoverer worksheet-calculation model). Formulas are the main free-text
 * input on this path, so they are never `eval`'d: each formula is tokenized and
 * parsed into an AST against a strict allowlist grammar (literals, output-column
 * references, arithmetic, a fixed set of scalar functions, and searched CASE),
 * then walked to a value per row. Anything outside the grammar is rejected at
 * parse time — there is no code path that executes arbitrary text.
 *
 * This is deliberately distinct from calculated *items* and *stored* map
 * calculated fields, which are compiled to SQL and pushed to the database by
 * the SQL generator. Row-level evaluation here covers ad-hoc, request-time
 * columns and references to already-computed output values; it does not support
 * aggregates (a row cannot see other rows) or time-dependent constants such as
 * SYSDATE (which would be non-deterministic) — those belong in SQL.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CalculatedFieldError extends Error {
  constructor(
    message: string,
    public fieldName?: string,
  ) {
    super(message);
    this.name = 'CalculatedFieldError';
  }
}

// ---------------------------------------------------------------------------
// Allowlists
// ---------------------------------------------------------------------------

/** Aggregates are meaningless row-by-row; named explicitly for a clear error. */
const AGGREGATE_FUNCTIONS = new Set([
  'SUM',
  'COUNT',
  'AVG',
  'MIN',
  'MAX',
  'STDDEV',
  'VARIANCE',
  'MEDIAN',
]);

const SCALAR_FUNCTIONS = new Set([
  // string
  'UPPER',
  'LOWER',
  'INITCAP',
  'LENGTH',
  'SUBSTR',
  'TRIM',
  'LTRIM',
  'RTRIM',
  'INSTR',
  'REPLACE',
  'CONCAT',
  'LPAD',
  'RPAD',
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
  'GREATEST',
  'LEAST',
  // date
  'TO_CHAR',
  'TO_DATE',
  'ADD_MONTHS',
  'MONTHS_BETWEEN',
  'LAST_DAY',
  // conversion / null handling
  'TO_NUMBER',
  'NVL',
  'NVL2',
  'COALESCE',
  'DECODE',
]);

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

const DAY_MS = 86_400_000;

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
          throw new CalculatedFieldError(
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

    // bracketed output-column reference: [Display Name]
    if (ch === '[') {
      const end = input.indexOf(']', i + 1);
      if (end === -1) {
        throw new CalculatedFieldError(
          `Unterminated column reference at position ${i}`,
        );
      }
      const name = input.slice(i + 1, end).trim();
      if (!name) {
        throw new CalculatedFieldError(`Empty column reference at position ${i}`);
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

    if ('+-*/=<>'.includes(ch)) {
      push('OP', ch, i);
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

    throw new CalculatedFieldError(
      `Unexpected character "${ch}" at position ${i} in formula`,
    );
  }

  push('EOF', '', input.length);
  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

type CompareOp = '=' | '<>' | '<' | '>' | '<=' | '>=';

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'null' }
  | { kind: 'ref'; name: string }
  | { kind: 'unary'; op: '-' | '+'; operand: Node }
  | { kind: 'not'; operand: Node }
  | { kind: 'arith'; op: '+' | '-' | '*' | '/' | '||'; left: Node; right: Node }
  | { kind: 'logical'; op: 'AND' | 'OR'; left: Node; right: Node }
  | { kind: 'compare'; op: CompareOp; left: Node; right: Node }
  | { kind: 'like'; left: Node; right: Node }
  | { kind: 'isnull'; operand: Node; negated: boolean }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'case'; whens: Array<{ cond: Node; then: Node }>; elseNode: Node | null };

// ---------------------------------------------------------------------------
// Parser (recursive descent → AST)
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0;
  readonly references: string[] = [];

  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }

  private next(): Token {
    return this.tokens[this.pos++]!;
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.next();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new CalculatedFieldError(
        `Unexpected token "${t.value || t.type}" at position ${t.pos}` +
          (value ? ` (expected "${value}")` : ''),
      );
    }
    return t;
  }

  parse(): Node {
    const node = this.orExpr();
    const t = this.peek();
    if (t.type !== 'EOF') {
      throw new CalculatedFieldError(
        `Unexpected trailing token "${t.value}" at position ${t.pos}`,
      );
    }
    return node;
  }

  private orExpr(): Node {
    let left = this.andExpr();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'OR') {
      this.next();
      left = { kind: 'logical', op: 'OR', left, right: this.andExpr() };
    }
    return left;
  }

  private andExpr(): Node {
    let left = this.notExpr();
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'AND') {
      this.next();
      left = { kind: 'logical', op: 'AND', left, right: this.notExpr() };
    }
    return left;
  }

  private notExpr(): Node {
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'NOT') {
      this.next();
      return { kind: 'not', operand: this.notExpr() };
    }
    return this.predicate();
  }

  private predicate(): Node {
    const left = this.additive();
    const t = this.peek();

    if (t.type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(t.value)) {
      this.next();
      return {
        kind: 'compare',
        op: t.value as CompareOp,
        left,
        right: this.additive(),
      };
    }
    if (t.type === 'KEYWORD' && t.value === 'LIKE') {
      this.next();
      return { kind: 'like', left, right: this.additive() };
    }
    if (t.type === 'KEYWORD' && t.value === 'IS') {
      this.next();
      let negated = false;
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'NOT') {
        this.next();
        negated = true;
      }
      this.expect('KEYWORD', 'NULL');
      return { kind: 'isnull', operand: left, negated };
    }
    return left;
  }

  private additive(): Node {
    let left = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (t.type === 'OP' && (t.value === '+' || t.value === '-' || t.value === '||')) {
        this.next();
        left = {
          kind: 'arith',
          op: t.value,
          left,
          right: this.multiplicative(),
        };
      } else {
        return left;
      }
    }
  }

  private multiplicative(): Node {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.type === 'OP' && (t.value === '*' || t.value === '/')) {
        this.next();
        left = { kind: 'arith', op: t.value, left, right: this.unary() };
      } else {
        return left;
      }
    }
  }

  private unary(): Node {
    const t = this.peek();
    if (t.type === 'OP' && (t.value === '-' || t.value === '+')) {
      this.next();
      return { kind: 'unary', op: t.value, operand: this.unary() };
    }
    return this.primary();
  }

  private primary(): Node {
    const t = this.next();

    switch (t.type) {
      case 'NUMBER':
        return { kind: 'num', value: Number(t.value) };
      case 'STRING':
        return { kind: 'str', value: t.value };
      case 'KEYWORD':
        if (t.value === 'NULL') return { kind: 'null' };
        if (t.value === 'CASE') return this.caseExpr();
        throw new CalculatedFieldError(
          `Unexpected keyword "${t.value}" at position ${t.pos}`,
        );
      case 'LPAREN': {
        const inner = this.orExpr();
        this.expect('RPAREN');
        return inner;
      }
      case 'BRACKET_REF':
        this.references.push(t.value);
        return { kind: 'ref', name: t.value };
      case 'IDENT': {
        if (this.peek().type === 'LPAREN') {
          return this.functionCall(t.value, t.pos);
        }
        this.references.push(t.value);
        return { kind: 'ref', name: t.value };
      }
      default:
        throw new CalculatedFieldError(
          `Unexpected token "${t.value || t.type}" at position ${t.pos}`,
        );
    }
  }

  private functionCall(name: string, pos: number): Node {
    if (AGGREGATE_FUNCTIONS.has(name)) {
      throw new CalculatedFieldError(
        `Aggregate function "${name}" cannot be used in a row-level calculated field`,
      );
    }
    if (!SCALAR_FUNCTIONS.has(name)) {
      throw new CalculatedFieldError(
        `Function "${name}" is not allowed at position ${pos}`,
      );
    }
    this.expect('LPAREN');
    const args: Node[] = [];
    if (this.peek().type !== 'RPAREN') {
      args.push(this.orExpr());
      while (this.peek().type === 'COMMA') {
        this.next();
        args.push(this.orExpr());
      }
    }
    this.expect('RPAREN');
    return { kind: 'call', name, args };
  }

  private caseExpr(): Node {
    const whens: Array<{ cond: Node; then: Node }> = [];
    while (this.peek().type === 'KEYWORD' && this.peek().value === 'WHEN') {
      this.next();
      const cond = this.orExpr();
      this.expect('KEYWORD', 'THEN');
      const then = this.orExpr();
      whens.push({ cond, then });
    }
    if (whens.length === 0) {
      throw new CalculatedFieldError('CASE expression requires at least one WHEN');
    }
    let elseNode: Node | null = null;
    if (this.peek().type === 'KEYWORD' && this.peek().value === 'ELSE') {
      this.next();
      elseNode = this.orExpr();
    }
    this.expect('KEYWORD', 'END');
    return { kind: 'case', whens, elseNode };
  }
}

// ---------------------------------------------------------------------------
// Value coercion (Oracle-ish)
// ---------------------------------------------------------------------------

function isNullish(v: unknown): boolean {
  return v === null || v === undefined;
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) {
    throw new CalculatedFieldError(
      `Cannot use value "${String(v)}" as a number`,
    );
  }
  return n;
}

function toText(v: unknown): string {
  if (v instanceof Date) return formatDate(v, 'YYYY-MM-DD');
  return String(v);
}

function truthy(v: unknown): boolean {
  return v === true;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC throughout for determinism)
// ---------------------------------------------------------------------------

const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const MONTHS_LONG = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];
const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAYS_LONG = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

function pad(n: number, width: number): string {
  return String(Math.abs(n)).padStart(width, '0');
}

function coerceToDate(v: unknown): Date {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) {
    throw new CalculatedFieldError(`Cannot use value "${s}" as a date`);
  }
  return new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    ),
  );
}

/** Minimal Oracle-style TO_CHAR for dates (common masks only). */
function formatDate(d: Date, mask: string): string {
  const tokens: Array<[RegExp, () => string]> = [
    [/^YYYY/, () => pad(d.getUTCFullYear(), 4)],
    [/^YYY/, () => pad(d.getUTCFullYear() % 1000, 3)],
    [/^YY/, () => pad(d.getUTCFullYear() % 100, 2)],
    [/^MONTH/i, () => MONTHS_LONG[d.getUTCMonth()]!],
    [/^MON/i, () => MONTHS_SHORT[d.getUTCMonth()]!],
    [/^MM/, () => pad(d.getUTCMonth() + 1, 2)],
    [/^DAY/i, () => DAYS_LONG[d.getUTCDay()]!],
    [/^DY/i, () => DAYS_SHORT[d.getUTCDay()]!],
    [/^DD/, () => pad(d.getUTCDate(), 2)],
    [/^HH24/, () => pad(d.getUTCHours(), 2)],
    [/^HH12|^HH/, () => pad(((d.getUTCHours() + 11) % 12) + 1, 2)],
    [/^MI/, () => pad(d.getUTCMinutes(), 2)],
    [/^SS/, () => pad(d.getUTCSeconds(), 2)],
    [/^AM|^PM/i, () => (d.getUTCHours() < 12 ? 'AM' : 'PM')],
  ];

  let out = '';
  let rest = mask;
  outer: while (rest.length > 0) {
    for (const [re, fn] of tokens) {
      const m = re.exec(rest);
      if (m) {
        out += fn();
        rest = rest.slice(m[0].length);
        continue outer;
      }
    }
    // Any non-token character is emitted verbatim (separators, literals).
    out += rest[0];
    rest = rest.slice(1);
  }
  return out;
}

/** Minimal numeric TO_CHAR: honours decimal count and thousands grouping. */
function formatNumber(n: number, mask: string): string {
  const cleaned = mask.replace(/FM/gi, '');
  const dot = cleaned.indexOf('.');
  const decimals =
    dot === -1 ? 0 : (cleaned.slice(dot + 1).match(/[09]/g) ?? []).length;
  const grouped = cleaned.includes(',');
  const fixed = n.toFixed(decimals);
  if (!grouped) return fixed;
  const [intPart, fracPart] = fixed.split('.');
  const sign = intPart!.startsWith('-') ? '-' : '';
  const digits = sign ? intPart!.slice(1) : intPart!;
  const withSep = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + withSep + (fracPart ? `.${fracPart}` : '');
}

function truncDate(d: Date, fmt: string): Date {
  const f = fmt.toUpperCase();
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  if (f === 'YYYY' || f === 'YEAR' || f === 'YY' || f === 'Y') {
    return new Date(Date.UTC(y, 0, 1));
  }
  if (f === 'MM' || f === 'MONTH' || f === 'MON' || f === 'MONTHS') {
    return new Date(Date.UTC(y, mo, 1));
  }
  if (f === 'HH' || f === 'HH24' || f === 'HH12') {
    return new Date(Date.UTC(y, mo, day, d.getUTCHours()));
  }
  if (f === 'MI') {
    return new Date(Date.UTC(y, mo, day, d.getUTCHours(), d.getUTCMinutes()));
  }
  // DD / default: strip the time component.
  return new Date(Date.UTC(y, mo, day));
}

function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, mo + Math.trunc(months), 1));
  // Clamp to the last valid day of the target month (Oracle ADD_MONTHS rule).
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  // Preserve the original time-of-day.
  target.setUTCHours(
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
  return target;
}

// ---------------------------------------------------------------------------
// Scalar function implementations
// ---------------------------------------------------------------------------

function need(name: string, args: unknown[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    const range = min === max ? `${min}` : `${min}-${max}`;
    throw new CalculatedFieldError(
      `${name} expects ${range} argument(s), got ${args.length}`,
    );
  }
}

/** A function whose first argument is NULL returns NULL (unless listed below). */
const NULL_TOLERANT = new Set([
  'NVL',
  'NVL2',
  'COALESCE',
  'DECODE',
  'CONCAT',
  'GREATEST',
  'LEAST',
]);

function callFunction(name: string, args: unknown[]): unknown {
  if (!NULL_TOLERANT.has(name) && args.length > 0 && isNullish(args[0])) {
    return null;
  }

  switch (name) {
    // ----- string -----
    case 'UPPER':
      need(name, args, 1);
      return toText(args[0]).toUpperCase();
    case 'LOWER':
      need(name, args, 1);
      return toText(args[0]).toLowerCase();
    case 'INITCAP':
      need(name, args, 1);
      return toText(args[0])
        .toLowerCase()
        .replace(/\b[a-z]/g, (c) => c.toUpperCase());
    case 'LENGTH':
      need(name, args, 1);
      return toText(args[0]).length;
    case 'SUBSTR': {
      need(name, args, 2, 3);
      const s = toText(args[0]);
      let start = Math.trunc(toNum(args[1]));
      // Oracle is 1-based; negative counts from the end.
      if (start === 0) start = 1;
      const from = start > 0 ? start - 1 : Math.max(s.length + start, 0);
      if (args.length === 3) {
        const len = Math.trunc(toNum(args[2]));
        if (len <= 0) return null;
        return s.slice(from, from + len);
      }
      return s.slice(from);
    }
    case 'TRIM':
      need(name, args, 1);
      return toText(args[0]).trim();
    case 'LTRIM':
      need(name, args, 1, 2);
      return args.length === 2
        ? trimSet(toText(args[0]), toText(args[1]), true, false)
        : toText(args[0]).replace(/^\s+/, '');
    case 'RTRIM':
      need(name, args, 1, 2);
      return args.length === 2
        ? trimSet(toText(args[0]), toText(args[1]), false, true)
        : toText(args[0]).replace(/\s+$/, '');
    case 'INSTR': {
      need(name, args, 2, 2);
      const idx = toText(args[0]).indexOf(toText(args[1]));
      return idx + 1; // 1-based, 0 = not found
    }
    case 'REPLACE': {
      need(name, args, 2, 3);
      const search = toText(args[1]);
      const repl = args.length === 3 ? toText(args[2]) : '';
      if (search === '') return toText(args[0]);
      return toText(args[0]).split(search).join(repl);
    }
    case 'CONCAT':
      need(name, args, 2);
      return concat(args[0]) + concat(args[1]);
    case 'LPAD':
      need(name, args, 2, 3);
      return padStr(toText(args[0]), Math.trunc(toNum(args[1])), args[2], true);
    case 'RPAD':
      need(name, args, 2, 3);
      return padStr(toText(args[0]), Math.trunc(toNum(args[1])), args[2], false);

    // ----- numeric -----
    case 'ROUND': {
      need(name, args, 1, 2);
      if (args[0] instanceof Date) {
        return truncDate(args[0], args.length === 2 ? toText(args[1]) : 'DD');
      }
      const digits = args.length === 2 ? Math.trunc(toNum(args[1])) : 0;
      const f = 10 ** digits;
      return Math.round(toNum(args[0]) * f) / f;
    }
    case 'TRUNC': {
      need(name, args, 1, 2);
      if (args[0] instanceof Date) {
        return truncDate(args[0], args.length === 2 ? toText(args[1]) : 'DD');
      }
      const digits = args.length === 2 ? Math.trunc(toNum(args[1])) : 0;
      const f = 10 ** digits;
      return Math.trunc(toNum(args[0]) * f) / f;
    }
    case 'FLOOR':
      need(name, args, 1);
      return Math.floor(toNum(args[0]));
    case 'CEIL':
      need(name, args, 1);
      return Math.ceil(toNum(args[0]));
    case 'ABS':
      need(name, args, 1);
      return Math.abs(toNum(args[0]));
    case 'MOD': {
      need(name, args, 2);
      const divisor = toNum(args[1]);
      if (divisor === 0) return toNum(args[0]); // Oracle MOD(x,0) = x
      return toNum(args[0]) % divisor;
    }
    case 'POWER':
      need(name, args, 2);
      return toNum(args[0]) ** toNum(args[1]);
    case 'SQRT':
      need(name, args, 1);
      return Math.sqrt(toNum(args[0]));
    case 'SIGN':
      need(name, args, 1);
      return Math.sign(toNum(args[0]));
    case 'GREATEST':
    case 'LEAST':
      return greatestLeast(name, args);

    // ----- date -----
    case 'TO_CHAR': {
      need(name, args, 1, 2);
      const v = args[0];
      if (v instanceof Date) {
        return formatDate(v, args.length === 2 ? toText(args[1]) : 'YYYY-MM-DD');
      }
      if (args.length === 2) return formatNumber(toNum(v), toText(args[1]));
      return toText(v);
    }
    case 'TO_DATE': {
      need(name, args, 1, 2);
      return coerceToDate(args[0]);
    }
    case 'ADD_MONTHS':
      need(name, args, 2);
      return addMonths(coerceToDate(args[0]), Math.trunc(toNum(args[1])));
    case 'MONTHS_BETWEEN': {
      need(name, args, 2);
      const a = coerceToDate(args[0]);
      const b = coerceToDate(args[1]);
      const months =
        (a.getUTCFullYear() - b.getUTCFullYear()) * 12 +
        (a.getUTCMonth() - b.getUTCMonth());
      const dayDiff = (a.getUTCDate() - b.getUTCDate()) / 31;
      return months + dayDiff;
    }
    case 'LAST_DAY': {
      need(name, args, 1);
      const d = coerceToDate(args[0]);
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    }

    // ----- conversion / null handling -----
    case 'TO_NUMBER':
      need(name, args, 1, 2);
      return toNum(args[0]);
    case 'NVL':
      need(name, args, 2);
      return isNullish(args[0]) ? args[1]! : args[0];
    case 'NVL2':
      need(name, args, 3);
      return isNullish(args[0]) ? args[2]! : args[1]!;
    case 'COALESCE': {
      need(name, args, 1, Number.MAX_SAFE_INTEGER);
      for (const a of args) if (!isNullish(a)) return a;
      return null;
    }
    case 'DECODE':
      return decode(args);

    default:
      // Unreachable: the parser only admits allowlisted names.
      throw new CalculatedFieldError(`Unhandled function "${name}"`);
  }
}

function concat(v: unknown): string {
  return isNullish(v) ? '' : toText(v);
}

function trimSet(s: string, set: string, left: boolean, right: boolean): string {
  const chars = new Set(set.split(''));
  let start = 0;
  let end = s.length;
  if (left) while (start < end && chars.has(s[start]!)) start += 1;
  if (right) while (end > start && chars.has(s[end - 1]!)) end -= 1;
  return s.slice(start, end);
}

function padStr(s: string, len: number, padArg: unknown, left: boolean): string {
  if (len <= 0) return '';
  if (s.length >= len) return s.slice(0, len);
  const padChar = padArg === undefined ? ' ' : toText(padArg) || ' ';
  let fill = '';
  while (fill.length < len - s.length) fill += padChar;
  fill = fill.slice(0, len - s.length);
  return left ? fill + s : s + fill;
}

function greatestLeast(name: string, args: unknown[]): unknown {
  if (args.length === 0) {
    throw new CalculatedFieldError(`${name} requires at least one argument`);
  }
  if (args.some(isNullish)) return null; // Oracle returns NULL if any arg is null
  const numeric = args.every((a) => typeof a === 'number');
  const sorted = [...args].sort((a, b) =>
    numeric
      ? (a as number) - (b as number)
      : toText(a) < toText(b)
        ? -1
        : toText(a) > toText(b)
          ? 1
          : 0,
  );
  return name === 'GREATEST' ? sorted[sorted.length - 1] : sorted[0];
}

function decode(args: unknown[]): unknown {
  if (args.length < 3) {
    throw new CalculatedFieldError('DECODE expects at least 3 arguments');
  }
  const expr = args[0];
  let i = 1;
  for (; i + 1 < args.length; i += 2) {
    const search = args[i];
    // DECODE treats two NULLs as equal (unlike ordinary =).
    if (
      (isNullish(expr) && isNullish(search)) ||
      (!isNullish(expr) && !isNullish(search) && looseEquals(expr, search))
    ) {
      return args[i + 1];
    }
  }
  return i < args.length ? args[i] : null; // trailing default
}

// ---------------------------------------------------------------------------
// Comparison / logical helpers
// ---------------------------------------------------------------------------

function looseEquals(a: unknown, b: unknown): boolean {
  return compareValues(a, b) === 0;
}

/** Returns -1/0/1, or null when either operand is NULL (unknown). */
function compareValues(a: unknown, b: unknown): number | null {
  if (isNullish(a) || isNullish(b)) return null;
  if (a instanceof Date || b instanceof Date) {
    const da = coerceToDate(a).getTime();
    const dbv = coerceToDate(b).getTime();
    return da < dbv ? -1 : da > dbv ? 1 : 0;
  }
  if (typeof a === 'number' || typeof b === 'number') {
    const na = toNum(a);
    const nb = toNum(b);
    return na < nb ? -1 : na > nb ? 1 : 0;
  }
  const sa = toText(a);
  const sb = toText(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function likeToRegExp(pattern: string): RegExp {
  let out = '^';
  for (const ch of pattern) {
    if (ch === '%') out += '[\\s\\S]*';
    else if (ch === '_') out += '[\\s\\S]';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out + '$');
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

type RefResolver = (name: string) => { found: boolean; value: unknown };

function evalNode(node: Node, resolve: RefResolver): unknown {
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'str':
      return node.value;
    case 'null':
      return null;
    case 'ref': {
      const r = resolve(node.name);
      if (!r.found) {
        throw new CalculatedFieldError(
          `Unknown column reference "${node.name}"`,
        );
      }
      return r.value ?? null;
    }
    case 'unary': {
      const v = evalNode(node.operand, resolve);
      if (isNullish(v)) return null;
      return node.op === '-' ? -toNum(v) : toNum(v);
    }
    case 'not': {
      const v = evalNode(node.operand, resolve);
      if (isNullish(v)) return null;
      return !truthy(v);
    }
    case 'arith':
      return evalArith(node, resolve);
    case 'logical':
      return evalLogical(node, resolve);
    case 'compare': {
      const cmp = compareValues(
        evalNode(node.left, resolve),
        evalNode(node.right, resolve),
      );
      if (cmp === null) return null;
      switch (node.op) {
        case '=':
          return cmp === 0;
        case '<>':
          return cmp !== 0;
        case '<':
          return cmp < 0;
        case '>':
          return cmp > 0;
        case '<=':
          return cmp <= 0;
        case '>=':
          return cmp >= 0;
      }
      return null;
    }
    case 'like': {
      const left = evalNode(node.left, resolve);
      const right = evalNode(node.right, resolve);
      if (isNullish(left) || isNullish(right)) return null;
      return likeToRegExp(toText(right)).test(toText(left));
    }
    case 'isnull': {
      const v = evalNode(node.operand, resolve);
      const isNull = isNullish(v);
      return node.negated ? !isNull : isNull;
    }
    case 'call': {
      const args = node.args.map((a) => evalNode(a, resolve));
      return callFunction(node.name, args);
    }
    case 'case': {
      for (const { cond, then } of node.whens) {
        if (truthy(evalNode(cond, resolve))) return evalNode(then, resolve);
      }
      return node.elseNode ? evalNode(node.elseNode, resolve) : null;
    }
  }
}

function evalArith(
  node: Extract<Node, { kind: 'arith' }>,
  resolve: RefResolver,
): unknown {
  const left = evalNode(node.left, resolve);
  const right = evalNode(node.right, resolve);

  if (node.op === '||') {
    // NULL concatenates as empty string (Oracle semantics).
    return concat(left) + concat(right);
  }

  if (isNullish(left) || isNullish(right)) return null;

  // Date arithmetic: date ± number = date; date - date = day difference.
  if (node.op === '+' && left instanceof Date && typeof right === 'number') {
    return new Date(left.getTime() + right * DAY_MS);
  }
  if (node.op === '+' && typeof left === 'number' && right instanceof Date) {
    return new Date(right.getTime() + left * DAY_MS);
  }
  if (node.op === '-' && left instanceof Date && typeof right === 'number') {
    return new Date(left.getTime() - right * DAY_MS);
  }
  if (node.op === '-' && left instanceof Date && right instanceof Date) {
    return (left.getTime() - right.getTime()) / DAY_MS;
  }

  const a = toNum(left);
  const b = toNum(right);
  switch (node.op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) {
        throw new CalculatedFieldError('Division by zero in calculated field');
      }
      return a / b;
  }
  return null;
}

function evalLogical(
  node: Extract<Node, { kind: 'logical' }>,
  resolve: RefResolver,
): boolean | null {
  const left = evalNode(node.left, resolve);
  const right = evalNode(node.right, resolve);
  const lb = isNullish(left) ? null : truthy(left);
  const rb = isNullish(right) ? null : truthy(right);

  if (node.op === 'AND') {
    if (lb === false || rb === false) return false;
    if (lb === null || rb === null) return null;
    return true;
  }
  // OR
  if (lb === true || rb === true) return true;
  if (lb === null || rb === null) return null;
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CalcFieldInput {
  name: string;
  formula: string;
  displayOrder?: number | null;
}

/** Column metadata used to resolve formula references to row keys. */
export interface ColumnRef {
  /** Key the value is stored under in each row (the Oracle column/alias). */
  name: string;
  /** Human-facing label a formula may reference instead of the key. */
  label?: string;
}

export interface EvaluateOptions {
  /**
   * Output columns, so formulas can reference either the row key or the
   * display label. When omitted, references resolve against each row's own
   * keys (case-insensitively).
   */
  columns?: ColumnRef[];
  /**
   * When true (default) a reference that matches no column throws. When false,
   * an unresolved reference evaluates to NULL.
   */
  strictReferences?: boolean;
}

export interface CalculatedColumn {
  /** Row key the calculated value is stored under (the field name). */
  name: string;
  label: string;
}

export interface EvaluateResult {
  rows: Record<string, unknown>[];
  columns: CalculatedColumn[];
}

/**
 * Build a name→row-key resolver factory. References are matched
 * case-insensitively against, in priority order: calculated-field names
 * declared in this batch, then supplied column keys, then column labels, then
 * (as a fallback) the row's own keys.
 */
function makeResolverFactory(
  fieldNames: string[],
  options: EvaluateOptions,
): (row: Record<string, unknown>) => RefResolver {
  const strict = options.strictReferences ?? true;
  const keyByUpper = new globalThis.Map<string, string>();

  // Column keys, then labels (keys win on collision).
  for (const col of options.columns ?? []) {
    const upper = col.name.toUpperCase();
    if (!keyByUpper.has(upper)) keyByUpper.set(upper, col.name);
  }
  for (const col of options.columns ?? []) {
    if (col.label) {
      const upper = col.label.toUpperCase();
      if (!keyByUpper.has(upper)) keyByUpper.set(upper, col.name);
    }
  }
  // Calculated fields reference each other (and shadow columns) by name.
  for (const fname of fieldNames) {
    keyByUpper.set(fname.toUpperCase(), fname);
  }

  return (row) => (name) => {
    const upper = name.toUpperCase();
    const key = keyByUpper.get(upper);
    if (key !== undefined) {
      return { found: true, value: row[key] ?? null };
    }
    // Fallback: match a raw row key case-insensitively.
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      return { found: true, value: row[name] ?? null };
    }
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toUpperCase() === upper) {
        return { found: true, value: row[rowKey] ?? null };
      }
    }
    if (strict) return { found: false, value: null };
    return { found: true, value: null };
  };
}

/**
 * Evaluate calculated fields against result rows, returning new rows with the
 * calculated columns appended (input rows are not mutated). Fields are computed
 * in displayOrder, so a later field may reference an earlier one by name.
 */
export function evaluateCalculatedFields(
  rows: Record<string, unknown>[],
  calculatedFields: CalcFieldInput[],
  options: EvaluateOptions = {},
): EvaluateResult {
  if (calculatedFields.length === 0) {
    return { rows, columns: [] };
  }

  const sorted = [...calculatedFields].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
  );

  // Reject duplicate field names (case-insensitive) — the output key would be
  // ambiguous.
  const seen = new Set<string>();
  for (const field of sorted) {
    const upper = field.name.toUpperCase();
    if (seen.has(upper)) {
      throw new CalculatedFieldError(
        `Duplicate calculated field name "${field.name}"`,
        field.name,
      );
    }
    seen.add(upper);
  }

  // Parse up front so a bad formula fails before we touch any rows.
  const compiled = sorted.map((field) => {
    try {
      return { field, ast: parse(field.formula) };
    } catch (err) {
      if (err instanceof CalculatedFieldError) {
        throw new CalculatedFieldError(
          `Calculated field "${field.name}": ${err.message}`,
          field.name,
        );
      }
      throw err;
    }
  });

  const resolverFor = makeResolverFactory(
    sorted.map((f) => f.name),
    options,
  );

  const outRows = rows.map((row) => {
    const newRow: Record<string, unknown> = { ...row };
    const resolve = resolverFor(newRow);
    for (const { field, ast } of compiled) {
      try {
        newRow[field.name] = evalNode(ast, resolve);
      } catch (err) {
        if (err instanceof CalculatedFieldError) {
          throw new CalculatedFieldError(
            `Calculated field "${field.name}": ${err.message}`,
            field.name,
          );
        }
        throw err;
      }
    }
    return newRow;
  });

  return {
    rows: outRows,
    columns: sorted.map((f) => ({ name: f.name, label: f.name })),
  };
}

function parse(formula: string): Node {
  if (!formula || !formula.trim()) {
    throw new CalculatedFieldError('Formula is empty');
  }
  return new Parser(tokenize(formula)).parse();
}

/**
 * Validate a calculated-field formula without evaluating it. Checks balanced
 * parentheses and grammar, that every function is allowlisted, and — when
 * `knownReferences` is supplied — that every column reference resolves.
 * Dangerous constructs (statement separators, PL/SQL blocks, EXECUTE, unknown
 * functions) are rejected by the allowlist grammar itself.
 */
export function validateFormula(
  formula: string,
  knownReferences?: string[],
): { valid: boolean; error?: string } {
  try {
    const parser = new Parser(tokenize(formula ?? ''));
    if (!formula || !formula.trim()) {
      return { valid: false, error: 'Formula is empty' };
    }
    parser.parse();
    if (knownReferences) {
      const known = new Set(knownReferences.map((r) => r.toUpperCase()));
      for (const ref of parser.references) {
        if (!known.has(ref.toUpperCase())) {
          return { valid: false, error: `Unknown column reference "${ref}"` };
        }
      }
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
