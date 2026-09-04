import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { config } from '../config.js';
import { sweepCredentialFiles } from '../services/credential-file.service.js';

/**
 * The sweep that deletes temporary-password files once their TTL is up.
 *
 * It runs against a throwaway directory, never the real one: the whole point
 * of the code under test is that it deletes credentials.
 */
const TTL_MS = config.CREDENTIAL_FILE_TTL_HOURS * 60 * 60 * 1000;
const NOW = new Date('2026-09-03T12:00:00Z');
const now = () => NOW;

let dir: string;

async function writeAged(name: string, ageMs: number): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, 'username,email,temporary_password\n', 'utf8');
  const when = new Date(NOW.getTime() - ageMs);
  await utimes(path, when, when);
  return path;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cred-sweep-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('sweepCredentialFiles', () => {
  it('removes a credential file older than the TTL', async () => {
    await writeAged('credentials-old.csv', TTL_MS + 60_000);

    await expect(sweepCredentialFiles({ dir, now })).resolves.toEqual({
      deleted: 1,
      errors: 0,
    });
    await expect(readdir(dir)).resolves.toEqual([]);
  });

  it('keeps a credential file still inside the TTL', async () => {
    await writeAged('credentials-fresh.csv', TTL_MS - 60_000);

    await expect(sweepCredentialFiles({ dir, now })).resolves.toEqual({
      deleted: 0,
      errors: 0,
    });
    await expect(readdir(dir)).resolves.toEqual(['credentials-fresh.csv']);
  });

  it('only touches files this service writes', async () => {
    // An operator's own notes in the directory are not ours to delete, however
    // old they are.
    await writeAged('operator-notes.txt', TTL_MS * 10);
    await writeAged('credentials-old.csv', TTL_MS * 10);

    await expect(sweepCredentialFiles({ dir, now })).resolves.toEqual({
      deleted: 1,
      errors: 0,
    });
    await expect(readdir(dir)).resolves.toEqual(['operator-notes.txt']);
  });

  it('is a no-op when the directory does not exist yet', async () => {
    // Nothing has ever been migrated. Not an error — a fresh install runs this
    // at boot before any migration has written a file.
    await expect(
      sweepCredentialFiles({ dir: join(dir, 'never-created'), now }),
    ).resolves.toEqual({ deleted: 0, errors: 0 });
  });
});
