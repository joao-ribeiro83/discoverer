/**
 * Tests for temporary-password generation.
 *
 * These guard a security property, so they check the things that would make a
 * generated password weak — bias, short length, predictable structure — rather
 * than just "it returns a string".
 */

import {
  TEMPORARY_PASSWORD_LENGTH,
  generateTemporaryPassword,
} from '../services/temporary-password.js';

describe('generateTemporaryPassword', () => {
  it('is the requested length', () => {
    expect(generateTemporaryPassword()).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
    expect(generateTemporaryPassword(24)).toHaveLength(24);
  });

  it('refuses a length short enough to be brute-forceable', () => {
    expect(() => generateTemporaryPassword(7)).toThrow(/at least 8/);
  });

  it('always contains every character class', () => {
    // Run enough times that a per-class miss would show up.
    for (let i = 0; i < 200; i += 1) {
      const pw = generateTemporaryPassword();
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#%^*\-_=+?]/);
    }
  });

  it('excludes characters that are misread on a printed list', () => {
    // These are transcribed by hand, so O/0, l/1/I, B/8, S/5 confusion turns
    // into support calls — and support calls turn into passwords over chat.
    const joined = Array.from({ length: 300 }, () => generateTemporaryPassword()).join('');
    for (const ambiguous of ['O', '0', 'l', '1', 'I', 'B', 'S']) {
      expect(joined).not.toContain(ambiguous);
    }
  });

  it('does not place the guaranteed classes at fixed positions', () => {
    // A per-position template would make position 0 always lowercase, etc.
    // Shuffling should spread every class across the string.
    const samples = Array.from({ length: 300 }, () => generateTemporaryPassword());
    const firstCharClasses = new Set(
      samples.map((pw) => {
        const c = pw[0]!;
        if (/[a-z]/.test(c)) return 'lower';
        if (/[A-Z]/.test(c)) return 'upper';
        if (/[0-9]/.test(c)) return 'digit';
        return 'symbol';
      }),
    );
    expect(firstCharClasses.size).toBeGreaterThan(1);
  });

  it('does not repeat across calls', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTemporaryPassword()));
    // 500 draws from a >16-char alphabet space: any collision means the
    // generator is not actually random.
    expect(seen.size).toBe(500);
  });

  it('spreads characters across the alphabet rather than favouring a few', () => {
    // A crude bias check: over many samples every allowed character should
    // appear at least once, which a badly-skewed generator would fail.
    const joined = Array.from({ length: 500 }, () => generateTemporaryPassword()).join('');
    const distinct = new Set(joined.split(''));
    // 25 lower + 22 upper + 8 digits + 11 symbols = 66 characters.
    expect(distinct.size).toBeGreaterThan(60);
  });
});
