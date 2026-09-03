/**
 * Writes the temporary-password file produced by a migration.
 *
 * This file is the most sensitive artifact the application ever produces: it
 * contains working credentials, in plaintext, for every migrated account. The
 * handling below is deliberate.
 *
 *  - Written to a dedicated directory, never alongside exports or scheduled
 *    results, which are downloadable over the API. This one is NOT.
 *  - Created 0600 (owner read/write only) and the directory 0700, so another
 *    account on the host cannot read it.
 *  - Written via an exclusive create ('wx'): a run can never silently
 *    overwrite an earlier file whose passwords are still in circulation.
 *  - Filename carries the run id, so a file is traceable to a migration.
 *  - Never logged, never returned over HTTP, never placed on the migration
 *    result object.
 *
 * The file is intended to be read once, distributed, and deleted. That
 * instruction is written into the file itself, because whoever opens it is
 * not necessarily whoever ran the migration.
 */

import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import type { ProvisionedCredential } from '@discoverer-neo/migrate';
import { config } from '../config.js';

/** Owner-only, for both the directory and the file. */
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

export interface CredentialFileResult {
  /** Absolute path inside the container. */
  path: string;
  /** File name only — safe to show in the UI; the directory is not. */
  fileName: string;
  accountCount: number;
  /** SHA-256 of the file contents, so a transfer can be verified. */
  sha256: string;
}

/** RFC 4180 quoting: always quote, so a name containing `,` or `"` is safe. */
function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildCredentialCsv(
  credentials: ProvisionedCredential[],
  meta: { runId: string; generatedAt: Date },
): string {
  const lines = [
    '# Discoverer Neo — temporary credentials',
    `# Migration run: ${meta.runId}`,
    `# Generated:     ${meta.generatedAt.toISOString()}`,
    '#',
    '# These are WORKING PASSWORDS. Treat this file as a secret:',
    '#   1. Deliver each row to its owner over a channel you trust.',
    '#   2. DELETE THIS FILE once every password has been delivered.',
    '# Each account must change its password at first login; until then it',
    '# cannot use any other part of the application.',
    '#',
    // Header after the comments so the file is still a valid CSV import in
    // Excel/LibreOffice, both of which skip leading '#' lines on request.
    ['username', 'email', 'temporary_password'].map(csvCell).join(','),
  ];

  for (const c of credentials) {
    lines.push([c.username, c.email, c.temporaryPassword].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Resolve the credentials directory.
 *
 * Kept separate from EXPORT_DIR/SCHEDULE_RESULT_DIR on purpose — those are
 * served to users over authenticated download routes, and a secrets file must
 * not live in a directory anything knows how to stream.
 */
export function credentialsDir(): string {
  const configured = config.CREDENTIALS_DIR;
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
}

export async function writeCredentialFile(
  credentials: ProvisionedCredential[],
  options: { runId?: string; now?: () => Date } = {},
): Promise<CredentialFileResult> {
  const runId = options.runId ?? randomUUID();
  const generatedAt = (options.now ?? (() => new Date()))();

  const dir = credentialsDir();
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  // mkdir's mode is subject to umask, and does nothing at all if the directory
  // already existed — so set it explicitly either way.
  await chmod(dir, DIR_MODE).catch(() => {
    // Best effort: a bind-mounted host directory may not accept chmod
    // (notably Windows/Docker Desktop). The file mode below still applies.
  });

  const fileName = `credentials-${runId}.csv`;
  const path = join(dir, fileName);
  const contents = buildCredentialCsv(credentials, { runId, generatedAt });

  // 'wx' fails if the path exists: never clobber credentials still in use.
  await writeFile(path, contents, { encoding: 'utf8', mode: FILE_MODE, flag: 'wx' });
  await chmod(path, FILE_MODE).catch(() => {
    // As above — bind mounts may ignore chmod. The directory is the real
    // boundary on such hosts, which is why it is dedicated and 0700.
  });

  return {
    path,
    fileName,
    accountCount: credentials.length,
    sha256: createHash('sha256').update(contents, 'utf8').digest('hex'),
  };
}
