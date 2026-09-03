/**
 * Builds the **anonymised formula corpus** — the checked-in evidence Phases
 * 4.1-4.3 fit the token-formula renderer against (decision D-114).
 *
 *   npm run rebuild-corpus -w @discoverer-neo/core/migration
 *   # or: npx tsx src/scripts/build-formula-corpus.ts [--dumps-dir <path>]
 *
 * ## Why anonymised
 *
 * `d4dumps/` is customer report metadata and is gitignored; `DisplayFormula`
 * is the customer's business logic written in the customer's own vocabulary.
 * What the renderer is fitted against is *structure* — arity, fixity,
 * argument order, parenthesisation, literal formatting. None of that needs
 * the customer's words. So every identifier is replaced by a synthetic name
 * through a deterministic mapping, and only the mapping is secret.
 *
 * ## What is preserved, deliberately
 *
 * - **Byte class and length.** A byte is replaced by a byte of the same class
 *   (upper / lower / digit / non-ASCII); everything else — spaces, `_`, `.`,
 *   punctuation — is structural and passes through. A 6-byte name carrying a
 *   non-ASCII byte in position 3 stays exactly that, so Phase 4.1 can still
 *   settle the dump's character encoding from the corpus alone.
 * - **Literals.** `[5,k,"..."]` values are NOT identifiers and are kept
 *   verbatim: format masks (`"YYYY"`, `"DD-MON-RRRR"`) and the `[5,4]` date
 *   literal are exactly what 4.1 has to settle.
 * - **Oracle's own function vocabulary.** Any name in `EUL_FUNCTION_NAMES`
 *   is reserved and never replaced — it is Oracle's, not the customer's, and
 *   it is the fitting target.
 * - **Global stability.** The map is keyed by the identifier text, not by the
 *   workbook, so the same item keeps the same synthetic name in every dump.
 *   Calculation-reference chains (D-056, WB-04) still resolve.
 *
 * The dumps are a single-byte codepage (cp1252), so every file is read and
 * written as `latin1`: one byte, one char, no transcoding, no evidence
 * destroyed.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseD4wkdmpDump, type DumpEntry } from '../services/d4wkdmp-dump-parser.js';
import { EUL_FUNCTION_NAMES } from '../services/workbook-parser.js';

/** Paths are resolved from the migrate workspace root, which is where
 *  `npm run rebuild-corpus -w @discoverer-neo/core/migration` puts the cwd. */
const CORPUS_DIR = resolve(process.cwd(), 'corpus');
const CORPUS_PATH = join(CORPUS_DIR, 'formula-corpus.tsv');
const META_PATH = join(CORPUS_DIR, 'formula-corpus.meta.json');
const MAP_PATH = join(CORPUS_DIR, 'identifier-map.private.json');
const DEFAULT_DUMPS_DIR = resolve(process.cwd(), '../../d4dumps');

/** Fixed salt: the mapping must be reproducible from the dumps alone. */
const SALT = 'discoverer-neo/formula-corpus/v1';

/**
 * The non-ASCII bytes a non-ASCII byte may become: cp1252 letters only, so a
 * synthetic name stays a plausible name. 0xD7 and 0xF7 (the multiply and
 * divide signs) are excluded — they are not letters.
 */
const NON_ASCII_ALPHABET = Array.from({ length: 64 }, (_, i) => 0xc0 + i)
  .filter((b) => b !== 0xd7 && b !== 0xf7)
  .map((b) => String.fromCharCode(b));

/** Oracle's own vocabulary, upper-cased. Never anonymised. */
const RESERVED = new Set(Object.values(EUL_FUNCTION_NAMES).map((n) => n.toUpperCase()));

// ---------------------------------------------------------------------------
// Deterministic, byte-class- and length-preserving name mapping
// ---------------------------------------------------------------------------

function hashBytes(input: string, attempt: number): Buffer {
  let out = Buffer.alloc(0);
  let counter = 0;
  // Enough digest material for any name length, extended deterministically.
  while (out.length < input.length + 1) {
    const h = createHash('sha256');
    h.update(`${SALT} ${attempt} ${counter} ${input}`, 'latin1');
    out = Buffer.concat([out, h.digest()]);
    counter += 1;
  }
  return out;
}

function synthesise(original: string, attempt: number): string {
  const h = hashBytes(original, attempt);
  let out = '';
  for (let i = 0; i < original.length; i += 1) {
    const c = original.charCodeAt(i);
    const r = h[i] as number;
    if (c >= 0x41 && c <= 0x5a) out += String.fromCharCode(0x41 + (r % 26));
    else if (c >= 0x61 && c <= 0x7a) out += String.fromCharCode(0x61 + (r % 26));
    else if (c >= 0x30 && c <= 0x39) out += String.fromCharCode(0x30 + (r % 10));
    else if (c >= 0x80) out += NON_ASCII_ALPHABET[r % NON_ASCII_ALPHABET.length];
    else out += original[i]; // structural: space, _, ., -, /, (, ) ...
  }
  return out;
}

/**
 * Builds the identifier map. Deterministic given the same input set: names
 * are mapped in sorted order and a collision re-seeds with the next attempt,
 * so two runs over the same dumps produce byte-identical output.
 */
export function buildIdentifierMap(names: Iterable<string>): Map<string, string> {
  const originals = new Set(names);
  const map = new Map<string, string>();
  const taken = new Set<string>();
  for (const name of [...originals].sort()) {
    let attempt = 0;
    let synth = synthesise(name, attempt);
    // Re-seed until the synthetic name collides with nothing: not another
    // synthetic, not Oracle's vocabulary, and not any *other* real name —
    // the last one is what lets the no-leak test be exact rather than
    // approximate, and stops a synthetic from reading as a real item.
    while (
      taken.has(synth) ||
      RESERVED.has(synth.toUpperCase()) ||
      (synth !== name && originals.has(synth))
    ) {
      attempt += 1;
      if (attempt > 1000) throw new Error(`cannot find a free synthetic name for a ${name.length}-char name`);
      synth = synthesise(name, attempt);
    }
    taken.add(synth);
    map.set(name, synth);
  }
  return map;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One alternation, longest name first, guarded on both sides so a short item
 * name can never eat part of a longer one or part of `TO_CHAR`.
 */
export function buildReplacer(map: Map<string, string>): (text: string) => [string, number] {
  const names = [...map.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  if (names.length === 0) return (text) => [text, 0];
  const re = new RegExp(
    `(?<![A-Za-z0-9_])(?:${names.map(escapeRe).join('|')})(?![A-Za-z0-9_])`,
    'g',
  );
  return (text: string) => {
    let hits = 0;
    const out = text.replace(re, (m) => {
      hits += 1;
      return map.get(m) ?? m;
    });
    return [out, hits];
  };
}

// ---------------------------------------------------------------------------
// Harvesting
// ---------------------------------------------------------------------------

/**
 * The name-shaped fields of an entry — the strings that can legitimately
 * appear inside a formula. `Desc` and `Prompt` are free prose, never a
 * formula token, and are left out on purpose.
 */
export function namesOf(e: DumpEntry): string[] {
  const out: Array<string | null | undefined> = [];
  switch (e.type) {
    case 'EulItemReference':
      out.push(e.identifier, e.name, e.folderIdentifier, e.folderName);
      break;
    case 'EulFunctionReference':
      out.push(e.identifier, e.functionName, e.displayName);
      break;
    case 'EulFilterReference':
      out.push(e.identifier, e.name, e.folderIdentifier, e.folderName);
      break;
    case 'EulJoinReference':
      out.push(e.identifier, e.name);
      break;
    case 'EulPrivateItem':
      out.push(e.identifier, e.name);
      break;
    case 'EulPrivateFilter':
      out.push(e.identifier, e.name);
      break;
    case 'Parameter':
      out.push(e.identifier, e.name);
      break;
    default:
      break;
  }
  return out
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());
}

/**
 * A name is only worth replacing if it is vocabulary. Two exclusions, both
 * of which would otherwise corrupt the evidence rather than protect anyone:
 *
 * - **No letter** — a purely numeric or punctuation "name" (`58`, `1`) would
 *   match inside `[1,58]` and inside numeric literals, silently rewriting the
 *   token codes the whole corpus exists to expose.
 * - **One character** — a single letter would match inside a quoted format
 *   mask. A one-character name carries no customer vocabulary anyway.
 *
 * `EUL_FUNCTION_NAMES` is excluded separately: it is Oracle's vocabulary.
 */
export function isAnonymisable(s: string): boolean {
  if (s.length < 2) return false;
  if (!/[A-Za-z\u0080-\u00ff]/.test(s)) return false;
  return !RESERVED.has(s.toUpperCase());
}

/**
 * Oracle's date/number format-model elements, longest first. A `[5,1]`
 * payload built only from these is Oracle's vocabulary, not the customer's —
 * and it is fitting evidence (`TO_CHAR(x,'YYYY')` has to keep its mask), so
 * it is kept verbatim. Anything else with a letter in it is treated as
 * customer text and anonymised: `Premio` and `Nota de Credito` both appear
 * as string literals in this estate.
 */
const FORMAT_ELEMENTS = [
  'SSSSS', 'YYYY', 'RRRR', 'IYYY', 'MONTH', 'HH24', 'HH12', 'EEEE',
  'MON', 'DAY', 'DDD', 'HH', 'MI', 'SS', 'FF', 'AM', 'PM', 'BC', 'AD',
  'RM', 'WW', 'IW', 'DY', 'DD', 'MM', 'YY', 'RR', 'TH', 'SP', 'FM', 'FX',
  'D', 'W', 'Q', 'J', 'Y', 'M', 'S', 'C', 'G', 'L', 'V', 'B', 'X', '0', '9',
].sort((a, b) => b.length - a.length);

const FORMAT_PUNCT = new Set([' ', ',', '.', '/', '-', ':', ';', "'"]);

/** An Oracle NLS parameter string, e.g. `NLS_NUMERIC_CHARACTERS = '.,'`. */
const NLS_PARAM_RE = /^NLS_[A-Z_]+ *= *'[^']*'$/;

export function isFormatMask(payload: string): boolean {
  if (payload.length === 0) return false;
  if (NLS_PARAM_RE.test(payload)) return true;
  const upper = payload.toUpperCase();
  let i = 0;
  outer: while (i < upper.length) {
    if (FORMAT_PUNCT.has(upper[i] as string)) {
      i += 1;
      continue;
    }
    for (const el of FORMAT_ELEMENTS) {
      if (upper.startsWith(el, i)) {
        i += el.length;
        continue outer;
      }
    }
    return false;
  }
  return true;
}

/** A literal payload is customer text if it has a letter and is not a mask. */
export function literalNeedsAnonymising(payload: string): boolean {
  if (payload.length < 2) return false; // same reason as `isAnonymisable`
  if (!/[A-Za-z\u0080-\u00ff]/.test(payload)) return false;
  return !isFormatMask(payload);
}

const IO_LITERAL_RE = /\[5,(\d+),"([^"]*)"\]/g;

/**
 * `IOFormula` carries no bare identifiers — it is `[ns,code]` tokens, commas
 * and brackets, plus `[5,k,"..."]` literal payloads. Replacing across the
 * whole string would rewrite the token codes themselves, so only the literal
 * payloads are touched, and only the ones that are customer text: `[5,2]`
 * numbers and `[5,4]` dates stay verbatim because they are the evidence
 * Phase 4.1 needs, and format masks stay because they are Oracle's.
 */
function anonymiseIo(io: string, map: Map<string, string>): [string, number] {
  let hits = 0;
  const out = io.replace(IO_LITERAL_RE, (m, kind: string, body: string) => {
    const synth = map.get(body);
    if (!synth) return m;
    hits += 1;
    return `[5,${kind},"${synth}"]`;
  });
  return [out, hits];
}

/**
 * `DisplayFormula` is rendered prose: bare identifiers outside quotes,
 * literal payloads inside them. The two are replaced by different rules in
 * ONE pass, so nothing is anonymised twice — a synthetic name produced for a
 * quoted payload can never be re-matched as an identifier.
 */
function anonymiseDisplay(
  display: string,
  map: Map<string, string>,
  replaceIdentifiers: (text: string) => [string, number],
): [string, number] {
  let hits = 0;
  let out = '';
  let i = 0;
  while (i < display.length) {
    const q = display.indexOf("'", i);
    if (q < 0) break;
    const end = display.indexOf("'", q + 1);
    if (end < 0) break;
    const [plain, n] = replaceIdentifiers(display.slice(i, q));
    hits += n;
    const body = display.slice(q + 1, end);
    const synth = map.get(body);
    if (synth) hits += 1;
    out += `${plain}'${synth ?? body}'`;
    i = end + 1;
  }
  const [tail, n] = replaceIdentifiers(display.slice(i));
  hits += n;
  return [out + tail, hits];
}

interface Pair {
  io: string;
  display: string;
}

export function pairsOf(e: DumpEntry): Pair[] {
  if (e.type !== 'EulPrivateItem' && e.type !== 'EulPrivateFilter') return [];
  if (!e.ioFormula || !e.displayFormula) return [];
  return [{ io: e.ioFormula, display: e.displayFormula }];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const dumpsDirArg = argv.indexOf('--dumps-dir');
  const dumpsDir = (dumpsDirArg >= 0 ? argv[dumpsDirArg + 1] : undefined) ?? DEFAULT_DUMPS_DIR;

  const files = readdirSync(dumpsDir)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .sort();

  const allNames = new Set<string>();
  const names = new Set<string>();
  const rawPairs: Pair[] = [];
  let ioOnly = 0;

  for (const file of files) {
    const text = readFileSync(join(dumpsDir, file), 'latin1');
    const { entries } = parseD4wkdmpDump(text);
    for (const e of entries) {
      for (const n of namesOf(e)) {
        allNames.add(n);
        if (isAnonymisable(n)) names.add(n);
      }
      for (const [, , body] of (e.type === 'EulPrivateItem' || e.type === 'EulPrivateFilter'
        ? [...(e.ioFormula ?? '').matchAll(IO_LITERAL_RE)]
        : [])) {
        allNames.add(body as string);
        if (literalNeedsAnonymising(body as string)) names.add(body as string);
      }
      const p = pairsOf(e);
      if (
        p.length === 0 &&
        (e.type === 'EulPrivateItem' || e.type === 'EulPrivateFilter') &&
        e.ioFormula &&
        !e.displayFormula
      ) {
        ioOnly += 1;
      }
      rawPairs.push(...p);
    }
  }

  const map = buildIdentifierMap(names);
  const replace = buildReplacer(map);

  // Distinct (io, display) pairs with an occurrence count. Nothing is
  // sampled or dropped — this is a lossless columnar compaction, and both
  // denominators are recorded in the meta file.
  const counts = new Map<string, { io: string; display: string; n: number }>();
  let replacements = 0;
  for (const { io, display } of rawPairs) {
    const [aIo, hIo] = anonymiseIo(io, map);
    const [aDisplay, hDisplay] = anonymiseDisplay(display, map, replace);
    replacements += hIo + hDisplay;
    if (aIo.includes('\t') || aDisplay.includes('\t')) {
      throw new Error('formula contains a tab — TSV encoding would be lossy');
    }
    const key = `${aIo}\t${aDisplay}`;
    const hit = counts.get(key);
    if (hit) hit.n += 1;
    else counts.set(key, { io: aIo, display: aDisplay, n: 1 });
  }

  const rows = [...counts.values()].sort(
    (a, b) => b.n - a.n || (a.io < b.io ? -1 : a.io > b.io ? 1 : 0),
  );
  const codes = new Set<string>();
  for (const r of rows) for (const m of r.io.matchAll(/\[1,(\d+)\]/g)) codes.add(m[1] as string);

  mkdirSync(CORPUS_DIR, { recursive: true });
  const body = rows.map((r) => `${r.n}\t${r.io}\t${r.display}`).join('\n');
  const corpusText = `occurrences\tio_formula\tdisplay_formula\n${body}\n`;
  writeFileSync(CORPUS_PATH, corpusText, 'latin1');

  const meta = {
    generatedBy: 'migrate/src/scripts/build-formula-corpus.ts',
    decision: 'D-114 option 1 - anonymised corpus',
    encoding: 'latin1 (cp1252 single-byte, as the dumps are)',
    sampled: false,
    dumps: files.length,
    /** The denominator for Phase 4.2's and 4.3's percentage gates. */
    alignedPairs: rawPairs.length,
    distinctPairs: rows.length,
    ioWithoutDisplay: ioOnly,
    distinctIdentifiers: map.size,
    /**
     * Harvested names left in place: Oracle's own function names, names with
     * no letter, and one-character names. See `isAnonymisable`.
     */
    identifiersLeftInPlace: allNames.size - map.size,
    identifierReplacements: replacements,
    distinctBuiltinCodes: codes.size,
    /**
     * Ties the committed corpus to the run that passed the no-leak check.
     * CI has no `d4dumps/` and so cannot re-derive the mapping; it verifies
     * this instead, and the leak test itself runs wherever the map exists.
     */
    sha256: createHash('sha256').update(corpusText, 'latin1').digest('hex'),
  };
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  writeFileSync(
    MAP_PATH,
    `${JSON.stringify(Object.fromEntries([...map].sort()), null, 2)}\n`,
    'latin1',
  );

  console.log(JSON.stringify(meta, null, 2));
  console.log(`corpus  -> ${CORPUS_PATH}`);
  console.log(`mapping -> ${MAP_PATH} (gitignored - treat as the dumps themselves)`);
}

if (process.argv[1] && process.argv[1].endsWith('build-formula-corpus.ts')) main();
