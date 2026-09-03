/**
 * Temporary-password generation for provisioned accounts.
 *
 * Migrated users arrive with no credential of their own — Discoverer stores
 * usernames, never passwords. Each therefore gets a freshly generated
 * temporary password which the account is forced to change on first login.
 *
 * Design notes that matter for security:
 *
 *  - `randomInt` (CSPRNG), never `Math.random`. A predictable temporary
 *    password is worse than none, because it is issued to a real account with
 *    real grants.
 *  - Rejection-free uniform selection: `crypto.randomInt(max)` is already
 *    unbiased, so no modulo skew is introduced over the alphabet.
 *  - The alphabet excludes characters that are misread when a human copies a
 *    password off a printed list — `O/0`, `l/1/I`, `S/5`, `B/8` — because
 *    these passwords are distributed by hand. Ambiguity here turns into
 *    support calls, and support calls turn into passwords sent over chat.
 *  - Every class is guaranteed present, then the result is shuffled, so the
 *    password satisfies a typical complexity policy without the predictable
 *    "Xxxx####!" shape that per-position templates produce.
 */

import { randomInt } from 'node:crypto';

const LOWER = 'abcdefghijkmnopqrstuvwxyz'; // no l
const UPPER = 'ACDEFGHJKLMNPQRTUVWXYZ'; // no B, I, O, S
const DIGITS = '23456789'; // no 0, 1
const SYMBOLS = '!@#%^*-_=+?';

const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS;

/** Long enough that the temporary window is not the weak link. */
export const TEMPORARY_PASSWORD_LENGTH = 16;

function pick(chars: string): string {
  return chars[randomInt(chars.length)]!;
}

/**
 * Fisher–Yates using the CSPRNG, so the guaranteed-class characters are not
 * left sitting in fixed positions.
 */
function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars;
}

export function generateTemporaryPassword(
  length: number = TEMPORARY_PASSWORD_LENGTH,
): string {
  if (length < 8) throw new Error('Temporary password must be at least 8 characters');

  // One of each class up front guarantees the complexity floor…
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALPHABET));

  // …and shuffling removes the positional pattern that would otherwise leak.
  return shuffle([...required, ...rest]).join('');
}

/** One provisioned credential. Plaintext — see `CredentialSink`. */
export interface ProvisionedCredential {
  username: string;
  email: string;
  /** Plaintext temporary password. Never logged, never returned over the API. */
  temporaryPassword: string;
}

/**
 * Where provisioned credentials are handed to the caller.
 *
 * Deliberately a callback rather than a field on the migration result: the
 * result object is serialized into API responses and the durable migration
 * log, and plaintext passwords must reach neither. The runner hands each
 * credential to this sink and keeps no copy.
 */
export type CredentialSink = (credentials: ProvisionedCredential[]) => Promise<void>;
