import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildIdentifierMap,
  buildReplacer,
  isAnonymisable,
  isFormatMask,
  literalNeedsAnonymising,
} from '../scripts/build-formula-corpus.js';

/**
 * The corpus is the output of a privacy control (D-114), so these tests are
 * the control's proof, not a nicety:
 *
 * - the mapping is deterministic, or a rebuild churns the whole corpus and
 *   calculation-reference chains stop resolving across dumps;
 * - the mapping preserves byte class and length, or Phase 4.1 loses the
 *   evidence it needs to settle the dump's character encoding;
 * - nothing the mapping was supposed to hide survives into the committed
 *   file.
 *
 * The last one needs the mapping, which lives only where `d4dumps/` does, so
 * it runs locally and CI verifies the recorded `sha256` instead — that ties
 * the committed bytes to the run that passed the leak check.
 */

const CORPUS_DIR = resolve(process.cwd(), 'corpus');
const CORPUS_PATH = resolve(CORPUS_DIR, 'formula-corpus.tsv');
const META_PATH = resolve(CORPUS_DIR, 'formula-corpus.meta.json');
const MAP_PATH = resolve(CORPUS_DIR, 'identifier-map.private.json');

/** cp1252 'e-acute' — a single non-ASCII byte, as in the real estate. */
const E_ACUTE = String.fromCharCode(0xe9);

describe('identifier mapping', () => {
  const names = ['Premio Acumulado', 'Cap Prop Me', `Pr${E_ACUTE}mio`, 'F_WIDGETS', 'Item 12'];

  it('is deterministic — the same input maps the same way twice', () => {
    const a = buildIdentifierMap(names);
    const b = buildIdentifierMap([...names].reverse());
    expect([...b]).toEqual([...a]);
  });

  it('anonymising a known input twice gives identical output', () => {
    const input = 'NVL(Cap Prop Me,0)+Premio Acumulado';
    const once = buildReplacer(buildIdentifierMap(names))(input);
    const twice = buildReplacer(buildIdentifierMap(names))(input);
    expect(once).toEqual(twice);
    expect(once[0]).not.toContain('Premio');
    expect(once[1]).toBe(2);
  });

  it('preserves length, byte class and structural characters', () => {
    const map = buildIdentifierMap(names);
    for (const [original, synth] of map) {
      expect(synth).toHaveLength(original.length);
      for (let i = 0; i < original.length; i += 1) {
        const o = original.charCodeAt(i);
        const s = synth.charCodeAt(i);
        const cls = (n: number) =>
          n >= 0x41 && n <= 0x5a ? 'upper'
          : n >= 0x61 && n <= 0x7a ? 'lower'
          : n >= 0x30 && n <= 0x39 ? 'digit'
          : n >= 0x80 ? 'non-ascii'
          : 'structural';
        if (cls(o) !== 'structural') expect(cls(s)).toBe(cls(o));
        else expect(s).toBe(o); // spaces, '_' and punctuation are structure
      }
    }
    // The non-ASCII byte is still non-ASCII, in the same position.
    expect(map.get(`Pr${E_ACUTE}mio`)?.charCodeAt(2)).toBeGreaterThanOrEqual(0x80);
  });

  it('is locally reversible — the map inverts without collisions', () => {
    const map = buildIdentifierMap(names);
    const inverse = new Map([...map].map(([k, v]) => [v, k]));
    expect(inverse.size).toBe(map.size);
    for (const [original, synth] of map) expect(inverse.get(synth)).toBe(original);
  });

  it('never anonymises a token code or a one-character name', () => {
    // The bug this guards: an item literally named "58" would otherwise
    // match inside `[1,58]` and silently rewrite the corpus's token codes.
    expect(isAnonymisable('58')).toBe(false);
    expect(isAnonymisable('1')).toBe(false);
    expect(isAnonymisable('A')).toBe(false);
    expect(isAnonymisable('NVL')).toBe(false); // Oracle's vocabulary
    expect(isAnonymisable('Premio')).toBe(true);
  });

  it('keeps a short name from eating part of a longer name or a function', () => {
    const map = buildIdentifierMap(['TO', 'Prop', 'Cap Prop Me']);
    const [out] = buildReplacer(map)('TO_CHAR(Cap Prop Me)');
    expect(out).toContain('TO_CHAR(');
    expect(out).not.toContain('Cap Prop Me');
  });
});

describe('literal policy', () => {
  it('treats Oracle format masks as Oracle vocabulary, not customer text', () => {
    for (const mask of ['YYYY', 'DD-MON-RRRR', 'dd-mon-yyyy', 'MM', '9999999999D999999999999']) {
      expect(isFormatMask(mask)).toBe(true);
      expect(literalNeedsAnonymising(mask)).toBe(false);
    }
    expect(isFormatMask("NLS_NUMERIC_CHARACTERS = '.,'")).toBe(true);
  });

  it('anonymises customer text that appears as a string literal', () => {
    for (const text of ['FRACCIONAMENTO', `Pr${E_ACUTE}mio`, 'PAG', '31-JAN-2005']) {
      expect(literalNeedsAnonymising(text)).toBe(true);
    }
  });

  it('leaves number and date payloads alone — 4.1 needs them verbatim', () => {
    expect(literalNeedsAnonymising('20011201000000')).toBe(false);
    expect(literalNeedsAnonymising('-1')).toBe(false);
    expect(literalNeedsAnonymising('')).toBe(false);
  });
});

describe('the committed corpus', () => {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8')) as Record<string, unknown>;
  const corpus = readFileSync(CORPUS_PATH, 'latin1');

  it('matches the sha256 of the run that produced it', () => {
    expect(createHash('sha256').update(corpus, 'latin1').digest('hex')).toBe(meta['sha256']);
  });

  it('records a denominator for the Phase 4.2 and 4.3 percentage gates', () => {
    expect(meta['sampled']).toBe(false);
    expect(meta['alignedPairs']).toBeGreaterThan(0);
    expect(corpus.split('\n').filter(Boolean).length - 1).toBe(meta['distinctPairs']);
  });

  it('kept the token codes and the non-ASCII bytes intact', () => {
    expect(corpus.startsWith('occurrences\tio_formula\tdisplay_formula\n')).toBe(true);
    expect(corpus).toMatch(/\[1,102\]/); // the most-used built-in code
    expect(corpus).toMatch(/\[5,4,"\d+"\]/); // the date literal Phase 4.1 must settle
    expect(corpus).toMatch(/[\u0080-\u00ff]/); // the encoding evidence
  });

  const itWithMap = existsSync(MAP_PATH) ? it : it.skip;

  /**
   * The synthetic names keep the original's spaces, so a multi-word synthetic
   * is a string of random word-shaped fragments — and a 2- or 3-letter
   * fragment can coincide with some other estate's 2- or 3-letter identifier
   * by chance. Those coincidences are synthetic bytes, not survivals, and
   * two or three letters carry no vocabulary. So the test is stated at the
   * length where a match would mean something: nothing 4 characters or
   * longer survives, and no coincidence is longer than 3.
   */
  itWithMap('leaks no identifier the mapping was built to hide', () => {
    const map = JSON.parse(readFileSync(MAP_PATH, 'latin1')) as Record<string, string>;
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = (minLength: number) => {
      const names = Object.keys(map)
        .filter((n) => n.length >= minLength)
        .sort((a, b) => b.length - a.length);
      expect(names.length).toBeGreaterThan(0);
      const re = new RegExp(`(?<![A-Za-z0-9_])(?:${names.map(escape).join('|')})(?![A-Za-z0-9_])`, 'g');
      return corpus.match(re) ?? [];
    };

    expect(match(4)).toEqual([]);
    expect(match(2).every((m) => m.length <= 3)).toBe(true);
  });
});
