/**
 * Fits **name, arity and fixity** for every `[1,n]` built-in code the estate
 * uses, against the committed formula corpus (decisions D-052, D-053).
 *
 *   npm run fit-codes -w @discoverer-neo/core
 *   # or: npx tsx src/scripts/fit-builtin-codes.ts [--examples]
 *
 * ## Why this is fitting and not research
 *
 * `corpus/formula-corpus.tsv` pairs what Discoverer STORED (`[1,95](…)`) with
 * what Discoverer SHOWED (`TO_DATE('01.12.01')-200`) — Oracle's own rendering
 * of its own token string, 37 971 times. Fixity is therefore *observable*:
 * render the token tree under a hypothesis, and see whether Oracle's text
 * could have come out of it.
 *
 * ## The method — constraint propagation, not guessing
 *
 * A row is only evidence for a code if every *other* code in it is already
 * settled, so the fit runs in rounds:
 *
 *  1. Rows containing exactly one distinct `[1,n]` code fit that code alone.
 *  2. Rows whose only remaining unknown is one code fit that one, and so on.
 *  3. Stop at the fixed point.
 *
 * Identifiers are the one thing the corpus cannot supply — `[6,17]` is an
 * element id and the element table is not in the corpus — so an identifier
 * leaf becomes a capturing placeholder, back-referenced on its second and
 * later use in the same formula. That back-reference is a real constraint: a
 * hypothesis that renders one item two different ways cannot match.
 *
 * ## Two things the corpus does to itself, which the fit has to survive
 *
 * **Calculation references expand inline.** A `[6,n]` leaf is sometimes
 * another calculation, and Oracle substitutes that calculation's *formula*
 * (D-056) — so an "identifier" can come out as `NVL(A,0)+NVL(B,0)`, brackets
 * and commas and all. Hence two placeholder classes: `strict` forbids
 * brackets and commas, `loose` allows them. Strict is tried first because it
 * constrains far harder; a code is only fitted loosely when strict finds no
 * shape at all, and the table records which.
 *
 * **The anonymiser clobbered some rows.** A Discoverer private filter's
 * `Name` is frequently its own `DisplayFormula` verbatim, so Phase 0.5's
 * identifier map replaced whole display strings as single identifiers —
 * byte-class- and length-preserving, so `Item LIKE :P` came out as
 * `Xxxx CWIE :Q` with Oracle's own keyword destroyed and the punctuation
 * intact. Those rows are anonymisation damage, not Oracle renderings, and
 * fitting against them is fitting against noise. They are detected (a literal
 * or a normally-present keyword has gone missing), counted and excluded.
 *
 * A code ends in exactly one of five states, and none of them is a guess:
 *
 * | State | Meaning |
 * | --- | --- |
 * | `FITTED` | exactly one shape survives every clean row that attests it |
 * | `AMBIGUOUS` | several shapes survive — the corpus cannot separate them |
 * | `CONTRADICTED` | no candidate shape matches; it needs a bespoke rendering |
 * | `UNTESTED` | attested, but never in a row whose other codes are settled |
 * | `UNATTESTED` | in the dumps with no aligned rendering to fit against |
 *
 * Anything but `FITTED` is refuse-only for the renderer (D-058).
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { readFormulaCorpus } from '../services/formula-corpus-agreement.js';
import {
  parseFormulaTree,
  EUL_FUNCTION_NAMES,
  type FormulaNode,
} from '../services/workbook-parser.js';

const CORPUS_DIR = resolve(process.cwd(), 'corpus');
const CORPUS_PATH = join(CORPUS_DIR, 'formula-corpus.tsv');
const TABLE_PATH = join(CORPUS_DIR, 'builtin-code-table.json');

/**
 * `[1,64]` GREATEST. It occurs in the dumps only in an `IOFormula` that has no
 * `DisplayFormula`, so the aligned corpus attests 55 codes and this is the
 * 56th. Its name is Oracle's own (`EUL_FUNCTION_NAMES`); its fixity is not
 * fitted here and must not be assumed.
 */
const UNATTESTED_CODES = [64];

// ---------------------------------------------------------------------------
// Candidate shapes
// ---------------------------------------------------------------------------

/**
 * How a `[1,n]` node might lay its name and arguments out. Every one of these
 * is a form the corpus actually shows somewhere; the fit decides which code
 * takes which.
 */
export type Shape =
  | 'prefix' // NAME(a,b)
  | 'zeroBare' // NAME
  | 'zeroCall' // NAME()
  | 'infixTight' // a+b
  | 'infixSpaced' // a AND b
  | 'unaryTight' // -a
  | 'unarySpaced' // ELSE a
  | 'postfixTight' // a%
  | 'postfixSpaced' // a IS NULL
  | 'bracketSpaced' // ( a )
  | 'bracketTight' // (a)
  | 'between' // a BETWEEN b AND c
  | 'inList' // a IN (b,c)
  | 'whenThen' // WHEN a THEN b
  | 'caseEnd' // CASE a b c END
  | 'passthrough' // a          — the code leaves no mark at all
  | 'spacePadded'; // ` a `

const ALL_SHAPES: readonly Shape[] = [
  'prefix',
  'zeroBare',
  'zeroCall',
  'infixTight',
  'infixSpaced',
  'unaryTight',
  'unarySpaced',
  'postfixTight',
  'postfixSpaced',
  'bracketSpaced',
  'bracketTight',
  'between',
  'inList',
  'whenThen',
  'caseEnd',
  'passthrough',
  'spacePadded',
];

/** Which shapes can even be written with `arity` arguments. */
function shapeAllowsArity(shape: Shape, arity: number): boolean {
  switch (shape) {
    case 'zeroBare':
    case 'zeroCall':
      return arity === 0;
    case 'unaryTight':
    case 'unarySpaced':
    case 'postfixTight':
    case 'postfixSpaced':
    case 'bracketSpaced':
    case 'bracketTight':
    case 'passthrough':
    case 'spacePadded':
      return arity === 1;
    case 'infixTight':
    case 'infixSpaced':
    case 'inList':
    case 'whenThen':
      return arity >= 2;
    case 'between':
      return arity === 3;
    case 'prefix':
    case 'caseEnd':
      return arity >= 1;
  }
}

/**
 * How a `[5,4]` date literal's `YYYYMMDDHHMISS` payload reaches the screen.
 * Fitted exactly as a shape is, from the same rows.
 */
export type DateShape = 'yy.mm.dd' | 'dd.mm.yy' | 'mm.dd.yy' | 'yyyy.mm.dd' | 'dd/mm/yyyy' | 'raw';

const ALL_DATE_SHAPES: readonly DateShape[] = [
  'yy.mm.dd',
  'dd.mm.yy',
  'mm.dd.yy',
  'yyyy.mm.dd',
  'dd/mm/yyyy',
  'raw',
];

function renderDate(payload: string, shape: DateShape): string {
  const yyyy = payload.slice(0, 4);
  const mm = payload.slice(4, 6);
  const dd = payload.slice(6, 8);
  const yy = yyyy.slice(2);
  switch (shape) {
    case 'yy.mm.dd':
      return `'${yy}.${mm}.${dd}'`;
    case 'dd.mm.yy':
      return `'${dd}.${mm}.${yy}'`;
    case 'mm.dd.yy':
      return `'${mm}.${dd}.${yy}'`;
    case 'yyyy.mm.dd':
      return `'${yyyy}.${mm}.${dd}'`;
    case 'dd/mm/yyyy':
      return `'${dd}/${mm}/${yyyy}'`;
    case 'raw':
      return `'${payload}'`;
  }
}

/** How a literal of each kind reaches the screen. */
function renderLiteral(kind: number, value: string, date: DateShape): string {
  if (kind === 2) return value;
  if (kind === 1) return `'${value}'`;
  if (kind === 4) return renderDate(value, date);
  throw new Unfittable(`literal kind ${kind}`);
}

// ---------------------------------------------------------------------------
// Rendering a tree to a regular expression under a hypothesis
// ---------------------------------------------------------------------------

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
const esc = (text: string): string => text.replace(REGEX_SPECIALS, '\\$&');

/**
 * An identifier the corpus cannot resolve. `strict` may not swallow a bracket
 * or a comma, which is what stops a wrong hypothesis absorbing structure into
 * a name and matching anyway; `loose` must, because a calculation reference
 * expands to a whole expression in its place (D-056).
 */
type PlaceholderMode = 'strict' | 'loose';
const PLACEHOLDER: Record<PlaceholderMode, string> = {
  // A plain identifier: it opens with a letter, an underscore, a parameter
  // marker (`:` or `:"`) or a cp1252 letter, carries no bracket or comma, and
  // never opens or closes on a space. Forbidding the space is what separates
  // `a<b` from `a < b`: without it a placeholder simply eats the spaces and
  // both fixities "match".
  strict: '[A-Za-z_:"\\u0080-\\u00ff](?:[^(),]*?[^(), ])?',
  // A calculation reference expands to a whole expression in place (D-056),
  // so brackets and commas are allowed here — but still no outer space.
  loose: '[^ ](?:.*?[^ ])?',
};

interface Hypothesis {
  shapes: ReadonlyMap<number, Shape>;
  date: DateShape;
  mode: PlaceholderMode;
}

class Unfittable extends Error {}

/** Builds the anchored regex a formula would have to have produced. */
function treeToRegex(root: FormulaNode, hypothesis: Hypothesis): string {
  const groups = new Map<string, number>();
  let groupCount = 0;

  const placeholder = (key: string): string => {
    const existing = groups.get(key);
    if (existing !== undefined) return `\\${existing}`;
    groupCount += 1;
    groups.set(key, groupCount);
    return `(${PLACEHOLDER[hypothesis.mode]})`;
  };

  const emit = (node: FormulaNode): string => {
    switch (node.type) {
      case 'item':
        return placeholder(`i${node.elementId}`);
      case 'parameter':
        return placeholder(`p${node.elementId}`);
      case 'function': {
        const name = placeholder(`f${node.elementId}`);
        const args = node.args.map(emit);
        return args.length === 0
          ? `${name}(?:\\(\\))?`
          : `${name}${esc('(')}${args.join(esc(','))}${esc(')')}`;
      }
      case 'literal':
        return esc(renderLiteral(node.literalKind, node.value, hypothesis.date));
      case 'unknown':
        throw new Unfittable('unknown node');
      case 'call': {
        const shape = hypothesis.shapes.get(node.code);
        if (shape === undefined) throw new Unfittable(`no hypothesis for [1,${node.code}]`);
        const name = EUL_FUNCTION_NAMES[node.code];
        if (name === undefined) throw new Unfittable(`no name for [1,${node.code}]`);
        return shapeToRegex(shape, name, node.args.map(emit), esc);
      }
    }
  };

  return `^${emit(root)}$`;
}

function shapeToRegex(
  shape: Shape,
  name: string,
  parts: readonly string[],
  kw: (text: string) => string,
): string {
  switch (shape) {
    case 'prefix':
      return `${kw(`${name}(`)}${parts.join(esc(','))}${esc(')')}`;
    case 'zeroBare':
      return kw(name);
    case 'zeroCall':
      return kw(`${name}()`);
    case 'infixTight':
      return parts.join(kw(name));
    case 'infixSpaced':
      return parts.join(kw(` ${name} `));
    case 'unaryTight':
      return `${kw(name)}${parts[0]}`;
    case 'unarySpaced':
      return `${kw(`${name} `)}${parts[0]}`;
    case 'postfixTight':
      return `${parts[0]}${kw(name)}`;
    case 'postfixSpaced':
      return `${parts[0]}${kw(` ${name}`)}`;
    case 'bracketSpaced':
      return `${esc('( ')}${parts[0]}${esc(' )')}`;
    case 'bracketTight':
      return `${esc('(')}${parts[0]}${esc(')')}`;
    case 'between':
      return `${parts[0]}${kw(' BETWEEN ')}${parts[1]}${kw(' AND ')}${parts[2]}`;
    case 'inList':
      return `${parts[0]}${kw(' IN (')}${parts.slice(1).join(esc(','))}${esc(')')}`;
    case 'whenThen':
      return `${kw(`${name} `)}${parts[0]}${kw(' THEN ')}${parts.slice(1).join(esc(' '))}`;
    case 'caseEnd':
      return `${kw(`${name} `)}${parts.join(esc(' '))}${kw(' END')}`;
    case 'passthrough':
      return parts[0]!;
    case 'spacePadded':
      return `${esc(' ')}${parts[0]}${esc(' ')}`;
  }
}

// ---------------------------------------------------------------------------
// The corpus, parsed once
// ---------------------------------------------------------------------------

interface Row {
  occurrences: number;
  io: string;
  display: string;
  tree: FormulaNode;
  /** Distinct `[1,n]` codes anywhere in the tree. */
  codes: Set<number>;
  hasDateLiteral: boolean;
  clobbered: boolean;
}

interface Stats {
  arities: Map<number, Map<number, number>>;
  weight: Map<number, number>;
  distinct: Map<number, number>;
  literalKinds: Map<number, number>;
  parseFailures: number;
  unknownNodes: number;
  dateWithTime: number;
  dateTotal: number;
  nonAsciiRows: number;
  nonAsciiBytes: Map<number, number>;
  minByte: number;
  maxByte: number;
}

function walk(node: FormulaNode, visit: (n: FormulaNode) => void): void {
  visit(node);
  if (node.type === 'call' || node.type === 'function' || node.type === 'unknown') {
    for (const arg of node.args) walk(arg, visit);
  }
}

/** A name Oracle prints as a word, and which anonymiser damage would erase. */
const WORD_NAME = /^[A-Za-z][A-Za-z0-9_]*(?: [A-Za-z][A-Za-z0-9_]*)*$/;

/** Split of the clobber count by which signal caught the row. */
let clobberSignals = { missingLiteralRows: 0, missingNameRows: 0 };

function loadRows(): {
  rows: Row[];
  stats: Stats;
  totalOccurrences: number;
  totalRows: number;
  clobberedRows: number;
  clobberedOccurrences: number;
} {
  const corpus = readFormulaCorpus(CORPUS_PATH);
  const stats: Stats = {
    arities: new Map(),
    weight: new Map(),
    distinct: new Map(),
    literalKinds: new Map(),
    parseFailures: 0,
    unknownNodes: 0,
    dateWithTime: 0,
    dateTotal: 0,
    nonAsciiRows: 0,
    nonAsciiBytes: new Map(),
    minByte: 0x7f,
    maxByte: 0,
  };
  let totalOccurrences = 0;
  const draft: Row[] = [];

  for (const entry of corpus) {
    totalOccurrences += entry.occurrences;
    for (const text of [entry.io, entry.display]) {
      let sawNonAscii = false;
      for (let i = 0; i < text.length; i += 1) {
        const byte = text.charCodeAt(i);
        if (byte < stats.minByte) stats.minByte = byte;
        if (byte > stats.maxByte) stats.maxByte = byte;
        if (byte >= 0x80) {
          sawNonAscii = true;
          stats.nonAsciiBytes.set(byte, (stats.nonAsciiBytes.get(byte) ?? 0) + 1);
        }
      }
      if (sawNonAscii && text === entry.io) stats.nonAsciiRows += 1;
    }
    const parsed = parseFormulaTree(entry.io);
    if (parsed.tree === null) {
      stats.parseFailures += 1;
      continue;
    }
    const codes = new Set<number>();
    let hasDateLiteral = false;
    walk(parsed.tree, (node) => {
      if (node.type === 'call') {
        codes.add(node.code);
        const byArity = stats.arities.get(node.code) ?? new Map<number, number>();
        byArity.set(node.args.length, (byArity.get(node.args.length) ?? 0) + entry.occurrences);
        stats.arities.set(node.code, byArity);
        stats.weight.set(node.code, (stats.weight.get(node.code) ?? 0) + entry.occurrences);
      }
      if (node.type === 'literal') {
        stats.literalKinds.set(
          node.literalKind,
          (stats.literalKinds.get(node.literalKind) ?? 0) + entry.occurrences,
        );
        if (node.literalKind === 4) {
          hasDateLiteral = true;
          stats.dateTotal += entry.occurrences;
          if (node.value.slice(8) !== '000000') stats.dateWithTime += entry.occurrences;
        }
      }
      if (node.type === 'unknown') stats.unknownNodes += 1;
    });
    for (const code of codes) stats.distinct.set(code, (stats.distinct.get(code) ?? 0) + 1);
    draft.push({
      occurrences: entry.occurrences,
      io: entry.io,
      display: entry.display,
      tree: parsed.tree,
      codes,
      hasDateLiteral,
      clobbered: false,
    });
  }

  // --- clobber detection ---------------------------------------------------
  // Two things Oracle always prints verbatim: the literals, and a built-in's
  // own word-shaped name. A row missing either is not a rendering this fit may
  // learn from. Both signals are counted, because they do not mean the same
  // thing: a missing literal is anonymiser damage and nothing else, while a
  // missing name is *either* damage or a code that genuinely renders without
  // its name. Excluding both is the safe reading — it costs a handful of rows
  // and it makes a wrong `FITTED` much harder to reach.
  let missingLiteralRows = 0;
  let missingNameRows = 0;
  let clobberedRows = 0;
  let clobberedOccurrences = 0;
  for (const row of draft) {
    let lostLiteral = false;
    let lostName = false;
    walk(row.tree, (node) => {
      if (node.type === 'literal') {
        const text = renderLiteral(node.literalKind, node.value, 'yy.mm.dd');
        const bare = node.literalKind === 4 ? null : node.value;
        if (!row.display.includes(text) && (bare === null || !row.display.includes(bare))) {
          lostLiteral = true;
        }
      }
      if (node.type === 'call') {
        const name = EUL_FUNCTION_NAMES[node.code];
        if (name !== undefined && WORD_NAME.test(name) && !row.display.includes(name)) {
          lostName = true;
        }
      }
    });
    if (lostLiteral) missingLiteralRows += 1;
    if (lostName) missingNameRows += 1;
    row.clobbered = lostLiteral || lostName;
    if (row.clobbered) {
      clobberedRows += 1;
      clobberedOccurrences += row.occurrences;
    }
  }
  clobberSignals = { missingLiteralRows, missingNameRows };

  return {
    rows: draft,
    stats,
    totalOccurrences,
    totalRows: corpus.length,
    clobberedRows,
    clobberedOccurrences,
  };
}

// ---------------------------------------------------------------------------
// The fit
// ---------------------------------------------------------------------------

export type FitState = 'FITTED' | 'AMBIGUOUS' | 'CONTRADICTED' | 'UNTESTED' | 'UNATTESTED';

export interface CodeFit {
  code: number;
  name: string;
  state: FitState;
  shape: Shape | null;
  /** 'strict' when the hard placeholder settled it, 'loose' when it did not. */
  evidence: PlaceholderMode | null;
  survivors: Shape[];
  arities: number[];
  occurrences: number;
  distinctRows: number;
  evidenceRows: number;
  /** Clean evidence rows the chosen shape actually explains. */
  matchedRows: number;
  /** Evidence rows no candidate shape at all can produce — damaged rows. */
  unexplainedRows: number;
  round: number | null;
  /** Verbatim attestations from the anonymised corpus, for 4.2 and 4.3. */
  examples: { io: string; display: string }[];
}

/**
 * Discoverer wraps a whole rendered private filter in `( … )` even when no
 * `[1,106]` bracket node is present — `[1,99](a,b)` comes out as
 * `( a OR b )`. That is a property of the *position*, not of the operator, so
 * it is allowed at the root rather than folded into any code's shape;
 * otherwise `OR` would be fitted as an operator that brackets itself and
 * `AND`, which also occurs unbracketed inside `CASE`, could not be fitted at
 * all.
 */
function rootUnwrapped(display: string): string | null {
  return display.startsWith('( ') && display.endsWith(' )') ? display.slice(2, -2) : null;
}

function matches(row: Row, hypothesis: Hypothesis): boolean {
  let source: string;
  try {
    source = treeToRegex(row.tree, hypothesis);
  } catch {
    return false;
  }
  let regex: RegExp;
  try {
    regex = new RegExp(source, 's');
  } catch {
    return false;
  }
  if (regex.test(row.display)) return true;
  const inner = rootUnwrapped(row.display);
  return inner !== null && regex.test(inner);
}

function candidatesFor(code: number, arities: readonly number[]): Shape[] {
  if (EUL_FUNCTION_NAMES[code] === undefined) return [];
  return ALL_SHAPES.filter((shape) => arities.every((arity) => shapeAllowsArity(shape, arity)));
}

interface FitRun {
  solved: Map<number, Shape>;
  survivors: Map<number, Shape[]>;
  evidenceRows: Map<number, number>;
  matchedRows: Map<number, number>;
  unexplainedRows: Map<number, number>;
  round: Map<number, number>;
}

/**
 * ## When a shape counts as settled
 *
 * Not "it matches every row". The anonymiser's damage is only *detectable*
 * where a row carries a literal or a word-shaped built-in name; a row built
 * from identifiers and symbol operators alone can be overwritten wholesale
 * and still look well-formed (`a ZCK b` for `a AND b` — measured, four such
 * rows in `[1,98]` alone). Demanding every row lets one invisible casualty
 * veto a shape that hundreds of rows attest.
 *
 * So the rule is: **a row only counts against a shape if some other candidate
 * shape explains it.** A row no shape at all can produce is not evidence
 * about fixity — it is a damaged row — and it is counted and reported as
 * `unexplained` rather than being allowed to vote.
 *
 * That is not circular. A row that genuinely contradicts the winner by
 * matching a rival is never discarded; only rows that contradict *every*
 * hypothesis are. A wrong shape cannot use this to silence the evidence
 * against it, because that evidence would be matching some rival.
 */

function runFit(
  rows: readonly Row[],
  codes: readonly number[],
  arities: ReadonlyMap<number, Map<number, number>>,
  dateShape: DateShape,
  mode: PlaceholderMode,
): FitRun {
  const survivors = new Map<number, Shape[]>();
  for (const code of codes) {
    survivors.set(code, candidatesFor(code, [...(arities.get(code) ?? new Map()).keys()]));
  }
  const solved = new Map<number, Shape>();
  const round = new Map<number, number>();
  const evidenceRows = new Map<number, number>();
  const matchedRows = new Map<number, number>();
  const unexplainedRows = new Map<number, number>();

  for (let pass = 1; pass <= 12; pass += 1) {
    let progress = false;
    for (const code of codes) {
      if (solved.has(code)) continue;
      const open = survivors.get(code) ?? [];
      if (open.length === 0) continue;
      const evidence = rows.filter(
        (row) =>
          !row.clobbered &&
          row.codes.has(code) &&
          [...row.codes].every((other) => other === code || solved.has(other)),
      );
      if (evidence.length === 0) continue;
      const grew = evidence.length !== (evidenceRows.get(code) ?? -1);
      evidenceRows.set(code, evidence.length);
      const explained = new Array<boolean>(evidence.length).fill(false);
      const scored = open.map((shape) => {
        const hit = evidence.map((row) => {
          const shapes = new Map(solved);
          shapes.set(code, shape);
          return matches(row, { shapes, date: dateShape, mode });
        });
        hit.forEach((ok, i) => {
          if (ok) explained[i] = true;
        });
        return { shape, hits: hit.filter(Boolean).length };
      });
      const explainable = explained.filter(Boolean).length;
      const covers = explainable > 0 ? scored.filter((s) => s.hits === explainable) : [];
      const best = Math.max(0, ...scored.map((s) => s.hits));
      matchedRows.set(code, best);
      unexplainedRows.set(code, evidence.length - explainable);
      const winners =
        covers.length > 0
          ? covers.map((s) => s.shape)
          : scored.filter((s) => s.hits === best && best > 0).map((s) => s.shape);
      survivors.set(code, winners);
      if (winners.length !== open.length || grew) progress = true;
      if (covers.length === 1) {
        solved.set(code, covers[0]!.shape);
        round.set(code, pass);
        progress = true;
      }
    }
    if (!progress) break;
  }
  return { solved, survivors, evidenceRows, matchedRows, unexplainedRows, round };
}

/**
 * Which `YYYYMMDDHHMISS` -> screen format the corpus supports.
 *
 * The date format and the fixities are entangled — a wrong date makes every
 * date-bearing row fail, which can veto a fixity, and a wrong fixity can hide
 * a wrong date. So the whole fit is simply run once per candidate format, and
 * each is scored by **how many date-bearing rows the resulting shapes
 * actually reproduce**. Scoring on date rows is the point: a wrong format
 * leaves exactly those rows unexplained and nothing else. Expensive and
 * completely unambiguous, which is the right trade for a value that decides
 * whether a report reads 1 December or 12 January.
 */
function fitDateShape(
  rows: readonly Row[],
  codes: readonly number[],
  arities: ReadonlyMap<number, Map<number, number>>,
): { shape: DateShape; scores: { shape: DateShape; dateRowsReproduced: number }[] } {
  const scores = ALL_DATE_SHAPES.map((shape) => {
    const run = runFit(rows, codes, arities, shape, 'loose');
    let reproduced = 0;
    for (const row of rows) {
      if (!row.hasDateLiteral || row.clobbered) continue;
      if (![...row.codes].every((code) => run.solved.has(code))) continue;
      if (matches(row, { shapes: run.solved, date: shape, mode: 'loose' })) reproduced += 1;
    }
    return { shape, dateRowsReproduced: reproduced };
  }).sort((x, y) => y.dateRowsReproduced - x.dateRowsReproduced);
  return { shape: scores[0]!.shape, scores };
}

function main(): void {
  const showExamples = process.argv.includes('--examples');
  const { rows, stats, totalOccurrences, totalRows, clobberedRows, clobberedOccurrences } =
    loadRows();
  const codes = [...stats.weight.keys()].sort((a, b) => a - b);

  const date = fitDateShape(rows, codes, stats.arities);

  const strict = runFit(rows, codes, stats.arities, date.shape, 'strict');
  const loose = runFit(rows, codes, stats.arities, date.shape, 'loose');

  const exampleFor = (code: number): { io: string; display: string }[] =>
    rows
      .filter((r) => !r.clobbered && r.codes.has(code))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 2)
      .map((r) => ({ io: r.io.slice(0, 240), display: r.display.slice(0, 240) }));

  const fits: CodeFit[] = codes.map((code) => {
    const strictShape = strict.solved.get(code) ?? null;
    const looseShape = loose.solved.get(code) ?? null;
    const shape = strictShape ?? looseShape;
    const evidence: PlaceholderMode | null =
      strictShape !== null ? 'strict' : looseShape !== null ? 'loose' : null;
    const open = strictShape !== null ? [strictShape] : (loose.survivors.get(code) ?? []);
    // Support must be read off ONE run: pairing a strict numerator with a
    // loose denominator produces nonsense like "17 of 15 703".
    const pick =
      strictShape !== null
        ? strict
        : (loose.evidenceRows.get(code) ?? 0) >= (strict.evidenceRows.get(code) ?? 0)
          ? loose
          : strict;
    const evidenceCount = pick.evidenceRows.get(code) ?? 0;
    const matched = pick.matchedRows.get(code) ?? 0;
    const unexplained = pick.unexplainedRows.get(code) ?? 0;
    const state: FitState =
      shape !== null
        ? 'FITTED'
        : evidenceCount === 0
          ? 'UNTESTED'
          : open.length === 0
            ? 'CONTRADICTED'
            : 'AMBIGUOUS';
    return {
      code,
      name: EUL_FUNCTION_NAMES[code] ?? `EUL_FUNCTIONS ${code}`,
      state,
      shape,
      evidence,
      survivors: open,
      arities: [...(stats.arities.get(code) ?? new Map()).keys()].sort((a, b) => a - b),
      occurrences: stats.weight.get(code) ?? 0,
      distinctRows: stats.distinct.get(code) ?? 0,
      evidenceRows: evidenceCount,
      matchedRows: matched,
      unexplainedRows: unexplained,
      round: strict.round.get(code) ?? loose.round.get(code) ?? null,
      examples: exampleFor(code),
    };
  });

  for (const code of UNATTESTED_CODES) {
    fits.push({
      code,
      name: EUL_FUNCTION_NAMES[code] ?? `EUL_FUNCTIONS ${code}`,
      state: 'UNATTESTED',
      shape: null,
      evidence: null,
      survivors: [],
      arities: [],
      occurrences: 0,
      distinctRows: 0,
      evidenceRows: 0,
      matchedRows: 0,
      unexplainedRows: 0,
      round: null,
      examples: [],
    });
  }

  // ---- report ------------------------------------------------------------

  console.log(`corpus rows ${totalRows}  occurrences ${totalOccurrences}`);
  console.log(`parse failures ${stats.parseFailures}  unknown nodes ${stats.unknownNodes}`);
  console.log(
    `clobbered rows ${clobberedRows} (${((clobberedRows / totalRows) * 100).toFixed(2)}%), ` +
      `${clobberedOccurrences} occurrences (${((clobberedOccurrences / totalOccurrences) * 100).toFixed(2)}%)` +
      ` — lost a literal ${clobberSignals.missingLiteralRows}, lost a name ${clobberSignals.missingNameRows}`,
  );
  console.log(`distinct [1,n] codes attested ${codes.length} (+${UNATTESTED_CODES.length} unattested)`);
  console.log(
    `literal kinds ${[...stats.literalKinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ')}`,
  );
  console.log(
    `date literals ${stats.dateTotal}, non-midnight ${stats.dateWithTime}; format ${date.shape} ` +
      `(date rows reproduced: ${date.scores.map((s) => `${s.shape}=${s.dateRowsReproduced}`).join(' ')})`,
  );
  console.log(
    `bytes: min 0x${stats.minByte.toString(16)} max 0x${stats.maxByte.toString(16)}; ` +
      `${stats.nonAsciiRows} rows carry a non-ASCII byte; ` +
      `${[...stats.nonAsciiBytes.keys()].filter((b) => b >= 0x80 && b <= 0x9f).length} distinct bytes in 0x80-0x9f`,
  );
  const weightOf = (state: FitState): number =>
    fits.filter((f) => f.state === state).reduce((n, f) => n + f.occurrences, 0);
  const totalWeight = fits.reduce((n, f) => n + f.occurrences, 0);
  for (const state of ['FITTED', 'AMBIGUOUS', 'CONTRADICTED', 'UNTESTED', 'UNATTESTED'] as const) {
    const list = fits.filter((f) => f.state === state);
    console.log(
      `${state}: ${list.length} codes, ${weightOf(state)} uses (${((weightOf(state) / totalWeight) * 100).toFixed(2)}%)`,
    );
  }
  console.log('');
  console.log('code name                 state         shape                 ev     arity       uses   rows  support  dmgd');
  for (const fit of [...fits].sort((a, b) => b.occurrences - a.occurrences)) {
    console.log(
      [
        String(fit.code).padStart(4),
        fit.name.padEnd(20).slice(0, 20),
        fit.state.padEnd(13),
        (fit.shape ?? (fit.survivors.join('|') || '-')).padEnd(21).slice(0, 21),
        (fit.evidence ?? '-').padEnd(6),
        fit.arities.join('/').padEnd(9).slice(0, 9),
        String(fit.occurrences).padStart(6),
        String(fit.distinctRows).padStart(6),
        `${fit.matchedRows}/${fit.evidenceRows}`.padStart(12),
        String(fit.unexplainedRows).padStart(5),
      ].join(' '),
    );
  }

  if (showExamples) {
    console.log('');
    for (const fit of fits) {
      if (fit.state === 'FITTED' || fit.state === 'UNATTESTED') continue;
      console.log(`--- [1,${fit.code}] ${fit.name} ${fit.state} (${fit.survivors.join(',') || 'nothing fits'})`);
      for (const example of fit.examples) {
        console.log(`    ${example.io.slice(0, 130)}`);
        console.log(` => ${example.display.slice(0, 130)}`);
      }
    }
  }

  const table = {
    generatedBy: 'migrate/src/scripts/fit-builtin-codes.ts',
    decisions: [
      'D-052 fit against the corpus, do not guess',
      'D-053 scope to the codes actually used',
      'D-058 anything not FITTED is refuse-only',
    ],
    corpus: {
      rows: totalRows,
      occurrences: totalOccurrences,
      clobberedRows,
      clobberedOccurrences,
      clobberSignals,
      parseFailures: stats.parseFailures,
      unknownNodes: stats.unknownNodes,
    },
    dateLiteral: {
      shape: date.shape,
      scores: date.scores,
      total: stats.dateTotal,
      nonMidnight: stats.dateWithTime,
    },
    codes: fits.sort((a, b) => a.code - b.code),
  };
  writeFileSync(TABLE_PATH, `${JSON.stringify(table, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${TABLE_PATH}`);
}

main();
