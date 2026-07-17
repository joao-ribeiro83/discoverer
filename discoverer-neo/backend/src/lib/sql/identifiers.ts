import { SqlGenerationError } from '../../types/sql.js';

/**
 * Identifier safety.
 *
 * Table, owner, and column names are never taken from request input — they
 * come from the metadata tables (populated by admins / Oracle introspection).
 * Even so, every identifier is validated against a strict pattern before it
 * is placed into generated SQL, then double-quoted. Runtime values NEVER go
 * through this path; they are always bind variables.
 */

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_$#]*$/;
const MAX_IDENTIFIER_LENGTH = 128;

export function isValidIdentifier(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(name)
  );
}

/** Validate and double-quote an Oracle identifier. */
export function quoteIdentifier(name: string): string {
  if (!isValidIdentifier(name)) {
    throw new SqlGenerationError(
      `Invalid SQL identifier: ${JSON.stringify(name)}`,
    );
  }
  return `"${name}"`;
}

/** Validate a bind parameter name (used after a leading colon). */
export function validateBindName(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || name.length > 100) {
    throw new SqlGenerationError(
      `Invalid bind parameter name: ${JSON.stringify(name)}`,
    );
  }
  return name;
}

/**
 * Derive a unique, Oracle-safe column alias from a display label.
 * Aliases are structural (not user data escaping) — they are reduced to
 * [A-Z0-9_] so they can never break out of the SQL context.
 */
export function makeColumnAlias(label: string, taken: Set<string>): string {
  let base = label
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 26);
  if (!base || !/^[A-Z]/.test(base)) base = `COL_${base}`.slice(0, 26);

  let alias = base;
  let n = 2;
  while (taken.has(alias)) {
    alias = `${base}_${n}`.slice(0, 30);
    n += 1;
  }
  taken.add(alias);
  return alias;
}
