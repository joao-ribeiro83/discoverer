import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive a fixed-length key from the configured encryption key.
const KEY = scryptSync(config.ENCRYPTION_KEY, 'discoverer-neo-salt', KEY_LENGTH);

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Prepends the IV to the ciphertext and returns a base64-encoded result
 * of the form: base64(iv + ciphertext + authTag).
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypt a string previously encrypted by {@link encrypt}.
 * Expects the base64-encoded format: base64(iv + ciphertext + authTag).
 */
export function decrypt(ciphertext: string): string {
  const buffer = Buffer.from(ciphertext, 'base64');

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
