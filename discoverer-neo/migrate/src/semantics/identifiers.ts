/**
 * Identifier and bind-name validation — one declaration, two consumers.
 *
 * Moved here for the same reason as the allowlist: the renderer must validate
 * identifiers exactly as the backend's SQL builder does, and it cannot import
 * from `backend/`. `backend/src/lib/sql/identifiers.ts` re-exports these and
 * keeps its own throwing wrappers, so there is one pattern to drift from
 * rather than two.
 *
 * These are predicates only. Runtime values never come near them — those are
 * always bind variables.
 */

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_$#]*$/;
const BIND_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_BIND_NAME_LENGTH = 100;

export function isValidIdentifier(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_IDENTIFIER_LENGTH &&
    IDENTIFIER_PATTERN.test(name)
  );
}

export function isValidBindName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_BIND_NAME_LENGTH &&
    BIND_NAME_PATTERN.test(name)
  );
}
