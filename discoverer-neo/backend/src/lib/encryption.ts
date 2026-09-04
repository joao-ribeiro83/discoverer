import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = 'discoverer-neo-salt';

/**
 * Derive the AES key from a passphrase.
 *
 * Exported so key rotation can hold two keys at once — the old one to decrypt
 * with and the new one to encrypt with. Everything else should use
 * {@link encrypt}/{@link decrypt}, which use the configured key.
 */
export function deriveKey(passphrase: string): Buffer {
  return scryptSync(passphrase, SALT, KEY_LENGTH);
}

// The configured key, derived once at module load.
const KEY = deriveKey(config.ENCRYPTION_KEY);

/**
 * Encrypt a plaintext string using AES-256-GCM under an explicit key.
 * Returns base64(iv + ciphertext + authTag).
 */
export function encryptWith(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypt a string produced by {@link encryptWith} under an explicit key.
 *
 * GCM's auth tag makes a successful decrypt proof that the key was right and
 * the ciphertext intact — a wrong key throws rather than returning garbage.
 * Rotation relies on that: it is what makes "it round-tripped" a verification
 * and not a guess.
 */
export function decryptWith(key: Buffer, ciphertext: string): string {
  const buffer = Buffer.from(ciphertext, 'base64');

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Encrypt a plaintext string under the configured `ENCRYPTION_KEY`.
 * Returns base64(iv + ciphertext + authTag).
 */
export function encrypt(plaintext: string): string {
  return encryptWith(KEY, plaintext);
}

/** Decrypt a string previously encrypted by {@link encrypt}. */
export function decrypt(ciphertext: string): string {
  return decryptWith(KEY, ciphertext);
}
