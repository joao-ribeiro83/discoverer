// node-sql-parser ships a CJS build without statically-detectable named
// exports, so under this repo's ESM a named import is `undefined` at runtime
// even though tsc and jest both accept it — same interop gotcha as `oracledb`
// and `cron-parser`. Import the default and destructure.
import sqlParserPkg from 'node-sql-parser';
import { SqlGenerationError } from '../../types/sql.js';

const { Parser } = sqlParserPkg;

/**
 * Pure helpers for row-level security predicates: validation of admin-authored
 * WHERE-clause fragments, `{alias}` substitution for FOLDER-targeted rules,
 * context-bind extraction, and a preview-only textual injector for the admin
 * "test policy" endpoint.
 *
 * Enforcement itself does NOT go through textual injection — predicates are
 * handed to the SQL generator via `SqlGenerationOptions.securityPredicates`
 * and composed into the WHERE clause by `where-clause.ts` (the deliberate,
 * generator-integrated design).
 */

// ---------------------------------------------------------------------------
// Context binds
// ---------------------------------------------------------------------------

/**
 * The only bind variables a security predicate may reference. Their values are
 * supplied per-execution from the authenticated user, never from the request
 * body, so a predicate like `f.SALES_REP_ID = :current_user_id` is
 * tamper-proof.
 */
export const CONTEXT_BIND_NAMES = [
  'current_user_id',
  'current_user_email',
  'current_user_role',
] as const;

export type ContextBindName = (typeof CONTEXT_BIND_NAMES)[number];

/** Token FOLDER-targeted predicates use to refer to their folder's alias. */
export const ALIAS_TOKEN_RE = /\{alias\}/gi;

/** Longest predicate we accept — matches the column's `text` type sanity cap. */
export const MAX_PREDICATE_LENGTH = 4000;

// ---------------------------------------------------------------------------
// String-literal handling
// ---------------------------------------------------------------------------

/**
 * Replace the contents of single-quoted string literals with spaces so keyword
 * and bind scanning cannot be fooled by text inside literals. Doubled quotes
 * ('') inside a literal are handled. Returns null when a literal — or a quoted
 * identifier — never terminates: always a validation failure for the caller.
 *
 * Double-quoted identifiers are tracked but kept. `"DBMS_LOCK"."SLEEP"(1)` is a
 * real call, so the package scan has to see it; and tracking them stops the
 * apostrophe in `"O'Brien"` opening a literal Oracle never opens, which would
 * blank the real SQL between it and the next quote.
 */
export function stripStringLiterals(sql: string): string | null {
  let out = '';
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    if (quote === null) {
      if (ch === "'" || ch === '"') quote = ch;
      out += ch;
    } else if (ch !== quote) {
      out += quote === "'" ? ' ' : ch;
    } else if (quote === "'" && sql[i + 1] === "'") {
      out += '  ';
      i += 1;
    } else {
      quote = null;
      out += ch;
    }
  }
  return quote === null ? out : null;
}

/**
 * Why a predicate could break out of the bracket the SQL generator wraps it
 * in, or null when it cannot.
 *
 * The generator emits `AND (<predicate>)`, and that bracket is the whole of
 * the OR-cannot-escape guarantee. A predicate that closes it — `1=1) OR (1=1`
 * — turns the clause into `AND (1=1) OR (1=1)`, and every row escapes with the
 * OR. A comment can swallow the closing bracket or the clauses after it.
 * `validatePredicate` checks this on write; the generator checks it again, so
 * a stored row that predates a tightening is still stopped.
 */
export function bracketingError(predicate: string): string | null {
  const stripped = stripStringLiterals(predicate);
  if (stripped === null) {
    return 'Unterminated string literal or quoted identifier';
  }
  if (stripped.includes(';')) {
    return 'Statement separators (;) are not allowed';
  }
  if (stripped.includes('--') || stripped.includes('/*') || stripped.includes('*/')) {
    return 'SQL comments are not allowed';
  }
  // Our literal stripper does not understand q'...' quoting, so such a literal
  // could smuggle anything past every later check.
  if (/\bq'/i.test(stripped)) {
    return "Oracle alternative quoting (q'...') is not allowed";
  }

  // A bracket inside a quoted identifier is no bracket to Oracle either.
  const code = stripped.replace(/"[^"]*"/g, (identifier) => ' '.repeat(identifier.length));
  let depth = 0;
  for (const ch of code) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) break;
  }
  return depth === 0
    ? null
    : 'Unbalanced parentheses: a predicate must not close the bracket it is wrapped in';
}

/** Bind names referenced by a predicate (literal contents ignored). */
export function referencedBindNames(predicate: string): string[] {
  const stripped = stripStringLiterals(predicate);
  if (stripped === null) {
    throw new SqlGenerationError(
      'Security predicate contains an unterminated string literal',
    );
  }
  const names = new Set<string>();
  for (const match of stripped.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(match[1]!);
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Keywords that have no business in a read-only WHERE fragment. Scanned at
 * word boundaries with literal contents removed, so SELECT/EXISTS/IN
 * subqueries stay allowed while every DDL/DML/PLSQL entry point is rejected.
 */
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'MERGE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'EXEC',
  'CALL',
  'BEGIN',
  'DECLARE',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'LOCK',
  'INTO',
  'RETURNING',
  'PURGE',
  'RENAME',
  'AUDIT',
  'NOAUDIT',
  'FLASHBACK',
  // Set operators. A row filter is one boolean test and never needs one, and a
  // predicate is spliced into every query its folder reaches.
  'UNION',
  'INTERSECT',
  'MINUS',
  'EXCEPT',
] as const;

/** Oracle package prefixes that would allow side effects or data exfil. */
const FORBIDDEN_PACKAGE_RE = /\b(DBMS_|UTL_|OWA_|HTP\.|HTF\.)/i;

const parser = new Parser();

export interface PredicateValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidatePredicateOptions {
  /**
   * Whether the `{alias}` folder-alias token is permitted. Only
   * FOLDER-targeted policy rules may use it — a business-area rule has no
   * single folder to resolve it against.
   */
  allowAliasToken?: boolean;
}

/**
 * Validate an admin-authored SQL predicate (a WHERE-clause fragment).
 *
 * **The administrator is the trust boundary for what a predicate says.** It is
 * raw SQL, spliced into every query its folder reaches, and nothing here can
 * tell a wrong rule from a right one. These layers stop mistakes and the known
 * ways out of the generator's bracket; they are not a sandbox.
 *
 * Defence layers, in order:
 *  1. length / emptiness
 *  2. `bracketingError`: unterminated literals and quoted identifiers,
 *     statement separators, comments, Oracle q-quote literals, and
 *     parentheses that would close the generator's bracket
 *  3. DDL/DML/PLSQL keywords, set operators and dangerous package prefixes
 *  4. bind variables outside the CONTEXT_BIND_NAMES allowlist
 *  5. a real syntax parse of `SELECT 1 FROM DUAL WHERE (<predicate>)`
 *     (node-sql-parser, db2 dialect — the closest match to Oracle)
 */
export function validatePredicate(
  predicate: string,
  options: ValidatePredicateOptions = {},
): PredicateValidationResult {
  const trimmed = predicate?.trim() ?? '';
  if (!trimmed) {
    return { valid: false, error: 'Predicate must not be empty' };
  }
  if (trimmed.length > MAX_PREDICATE_LENGTH) {
    return {
      valid: false,
      error: `Predicate exceeds ${MAX_PREDICATE_LENGTH} characters`,
    };
  }

  const escape = bracketingError(trimmed);
  if (escape) {
    return { valid: false, error: escape };
  }
  // bracketingError has already refused an unterminated literal.
  const stripped = stripStringLiterals(trimmed)!;

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(stripped)) {
      return {
        valid: false,
        error: `Keyword "${keyword}" is not allowed in a security predicate`,
      };
    }
  }
  const pkg = FORBIDDEN_PACKAGE_RE.exec(stripped);
  if (pkg) {
    return {
      valid: false,
      error: `References to ${pkg[1]!.replace(/[._]$/, '')} packages are not allowed`,
    };
  }

  const hasAliasToken = ALIAS_TOKEN_RE.test(trimmed);
  ALIAS_TOKEN_RE.lastIndex = 0;
  if (hasAliasToken && !options.allowAliasToken) {
    return {
      valid: false,
      error:
        'The {alias} token is only allowed in folder-targeted rules',
    };
  }

  const bindAllowlist = new Set<string>(CONTEXT_BIND_NAMES);
  for (const bind of referencedBindNames(trimmed)) {
    if (!bindAllowlist.has(bind)) {
      return {
        valid: false,
        error: `Unknown bind variable :${bind} — allowed: ${CONTEXT_BIND_NAMES.map((b) => `:${b}`).join(', ')}`,
      };
    }
  }

  // Syntax check. Substitute binds and the alias token with parse-neutral
  // stand-ins first (same approach as the generator's own parser tests).
  const parseable = trimmed
    .replace(ALIAS_TOKEN_RE, 't0')
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '1');
  try {
    parser.astify(`SELECT 1 FROM DUAL WHERE (${parseable})`, {
      database: 'db2',
    });
  } catch {
    return {
      valid: false,
      error: 'Predicate is not a valid SQL boolean expression',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Preview-only textual injection (admin "test policy" endpoint)
// ---------------------------------------------------------------------------

/**
 * Mask a SQL string so that everything inside string literals, quoted
 * identifiers, and parentheses is replaced by spaces. Positions are preserved,
 * so regex hits on the mask index directly into the original text. Used to
 * locate top-level clause keywords without a full parser.
 */
function maskNested(sql: string): string {
  let out = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i]!;
    if (inSingle) {
      if (ch === "'" && sql[i + 1] === "'") {
        out += '  ';
        i += 1;
        continue;
      }
      if (ch === "'") inSingle = false;
      out += ' ';
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      out += ' ';
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      out += ' ';
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ' ';
      continue;
    }
    if (ch === '(') {
      depth += 1;
      out += ' ';
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      out += ' ';
      continue;
    }
    out += depth === 0 ? ch : ' ';
  }
  return out;
}

/**
 * Produce a preview of a query with security predicates ANDed into its WHERE
 * clause (adding one if absent, always ahead of GROUP BY / HAVING / ORDER BY /
 * OFFSET / FETCH). The existing WHERE condition is parenthesized so an OR in
 * it cannot swallow the predicates.
 *
 * PREVIEW ONLY: real enforcement composes predicates inside the SQL generator.
 * This textual path exists so admins can paste an arbitrary sample query and
 * see where their predicates would land. Top-level set operations
 * (UNION/INTERSECT/MINUS) are rejected — each branch would need its own
 * injection, which the preview cannot do faithfully.
 */
export function previewSecuredSql(sql: string, predicates: string[]): string {
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  if (!cleaned) {
    throw new SqlGenerationError('Sample query must not be empty');
  }
  const applicable = predicates.map((p) => p.trim()).filter(Boolean);
  if (applicable.length === 0) return cleaned;

  const mask = maskNested(cleaned);
  if (/\b(UNION|INTERSECT|MINUS|EXCEPT)\b/i.test(mask)) {
    throw new SqlGenerationError(
      'Sample queries with top-level set operations (UNION/INTERSECT/MINUS) are not supported — wrap the query in a subquery',
    );
  }

  const predsSql = applicable.map((p) => `(${p})`).join(' AND ');

  const whereMatch = /\bWHERE\b/i.exec(mask);
  const tailMatch =
    /\b(GROUP\s+BY|HAVING|ORDER\s+BY|OFFSET|FETCH)\b/i.exec(mask);

  if (whereMatch) {
    const whereStart = whereMatch.index;
    const condStart = whereStart + whereMatch[0].length;
    const condEnd = tailMatch ? tailMatch.index : cleaned.length;
    const existing = cleaned.slice(condStart, condEnd).trim();
    const tail = cleaned.slice(condEnd);
    return (
      `${cleaned.slice(0, whereStart)}WHERE (${existing}) AND ${predsSql}` +
      (tail ? `\n${tail.trim()}` : '')
    );
  }

  if (tailMatch) {
    const head = cleaned.slice(0, tailMatch.index).trimEnd();
    const tail = cleaned.slice(tailMatch.index).trim();
    return `${head}\nWHERE ${predsSql}\n${tail}`;
  }

  return `${cleaned}\nWHERE ${predsSql}`;
}
