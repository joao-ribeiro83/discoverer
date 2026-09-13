import { describe, it, expect } from '@jest/globals';
import { deriveKey, encryptWith, decryptWith, encrypt, decrypt, DecryptionError } from '../lib/encryption.js';

describe('encryption', () => {
  it('round-trips a value under the same key', () => {
    expect(decrypt(encrypt('oracle-password-123'))).toBe('oracle-password-123');
  });

  it('throws DecryptionError, not a raw crypto error, when the key does not match (F-16)', () => {
    const ciphertext = encryptWith(deriveKey('key-one'), 'super-secret');

    let caught: unknown;
    try {
      decryptWith(deriveKey('key-two'), ciphertext);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DecryptionError);
    expect((caught as Error).message).toMatch(/ENCRYPTION_KEY/);
    expect((caught as Error).message).not.toContain('super-secret');
  });

  it('throws DecryptionError on corrupted ciphertext', () => {
    expect(() => decryptWith(deriveKey('any-key'), 'not-valid-base64-ciphertext!!')).toThrow(
      DecryptionError,
    );
  });
});
