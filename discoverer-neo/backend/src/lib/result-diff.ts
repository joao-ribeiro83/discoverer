/**
 * Result-set equivalence (Phase 9.1): does Neo return what Discoverer returned?
 *
 * The `d4wkdmp` differ's pattern (`migrate/src/services/d4wkdmp-differ.ts`)
 * applied to results instead of metadata: a reference the legacy system
 * produced, a normaliser, a differ, and an aggregate report. This module is the
 * pure half — no database, no Oracle — so every normalisation rule is testable
 * on its own. `scripts/diff-results.ts` drives it against the live estate.
 *
 * ## Normalisation — what is absorbed, and nothing else
 *
 * - **NULL.** `null`, `undefined` and an empty string are one value: Oracle
 *   stores `''` as NULL, and an export prints NULL as nothing.
 * - **Text.** Trailing whitespace is dropped (CHAR padding), the string is put in
 *   Unicode NFC, and the C1 range U+0080–U+009F is read as Windows-1252. The
 *   estate is `WE8ISO8859P1`; a Windows client writes CP1252, and ISO-8859-1
 *   decodes CP1252's `€ ’ “ ”` as invisible control characters.
 * - **Numbers.** Cut to 15 significant digits (a double's binary noise), then
 *   rounded half away from zero — Oracle's `ROUND` — to the column's `scale`.
 *   A difference smaller than `scale` is invisible by construction: set the
 *   scale from what the reference can actually show, never wider.
 * - **Dates.** Compared as local `YYYY-MM-DD HH:MM:SS`, or to the day when the
 *   reference printed no time (`dateOnly`).
 *
 * A value that does not parse as its column's kind is kept verbatim behind a
 * `!` marker, so it can never quietly equal something else.
 */

export type Cell = string | number | Date | null | undefined;

export type CellKind = 'text' | 'number' | 'date';

export interface DiffColumn {
  /** Report label. Never a value. */
  name: string;
  kind: CellKind;
  /** Decimal places both sides round to (numbers). Default 9. */
  scale?: number;
  /** Compare to the day only (dates). */
  dateOnly?: boolean;
  /** Part of a row's identity — an axis item. Unmatched rows pair on these. */
  key?: boolean;
}

/** CP1252's printable characters in 0x80–0x9F. The five gaps stay as they are. */
const CP1252_C1: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

function foldText(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out += code >= 0x80 && code <= 0x9f ? (CP1252_C1[code] ?? ch) : ch;
  }
  return out.normalize('NFC').trimEnd();
}

/** Oracle's `ROUND(n, scale)`: half away from zero, on the decimal digits. */
export function roundDecimal(value: number, scale: number): number {
  const sig = Number(value.toPrecision(15));
  const abs = Math.abs(sig);
  // `1.005e2` is exactly 100.5, where `1.005 * 100` is 100.49999999999999.
  const text = String(abs);
  const shifted = text.includes('e') ? abs * 10 ** scale : Number(`${text}e${scale}`);
  const whole = Math.round(shifted);
  const back = String(whole).includes('e') ? whole / 10 ** scale : Number(`${whole}e-${scale}`);
  return sig < 0 ? -back : back;
}

const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;

function canonicalDate(value: Date | string, dateOnly: boolean): string | null {
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    const m = ISO_DATE.exec(value.trim());
    if (!m) return null;
    date = new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  if (Number.isNaN(date.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  return dateOnly ? day : `${day} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** One cell to its canonical string, or null. See the module header. */
export function normaliseCell(column: DiffColumn, value: Cell): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  if (column.kind === 'number') {
    const n = typeof value === 'number' ? value : value instanceof Date ? NaN : NUMERIC.test(value.trim()) ? Number(value) : NaN;
    if (!Number.isFinite(n)) return `!${String(value)}`;
    const scale = column.scale ?? 9;
    return (roundDecimal(n, scale) || 0).toFixed(scale);
  }
  if (column.kind === 'date') {
    if (typeof value === 'number') return `!${value}`;
    return canonicalDate(value, column.dateOnly ?? false) ?? `!${String(value)}`;
  }
  if (value instanceof Date) return canonicalDate(value, false);
  if (typeof value === 'number') return String(Number(value.toPrecision(15)));
  return foldText(value) || null;
}

export interface DiffOptions {
  /** Column indexes the worksheet sorts on, highest priority first. */
  sortColumns?: number[];
  /** How many unpaired rows per side to keep as examples. Default 5. */
  examples?: number;
}

export interface CellDiff {
  column: string;
  reference: string | null;
  neo: string | null;
}

export interface RowSetDiff {
  referenceRows: number;
  neoRows: number;
  matchedRows: number;
  onlyInReference: number;
  onlyInNeo: number;
  /** Null when the worksheet has no sort to check. */
  orderMatches: boolean | null;
  /** Unmatched cells per column, across paired rows. Counts, never values. */
  columnMismatches: Record<string, number>;
  /** Unmatched rows paired on their key columns — both values of each cell. */
  cellDiffs: CellDiff[][];
  /** Unmatched rows no pair was found for, capped at `examples` per side. */
  unpaired: { reference: Array<Array<string | null>>; neo: Array<Array<string | null>> };
}

type Canon = Array<string | null>;

function groupBy(rows: Canon[], keyOf: (row: Canon) => string): Map<string, Canon[]> {
  const out = new Map<string, Canon[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = out.get(key);
    if (list) list.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/**
 * Compare two result sets as multisets of normalised rows — row order does not
 * count unless `sortColumns` says the worksheet sorts. Order is then checked on
 * the sort columns alone, so rows that tie on the sort may come back in any
 * order, exactly as Oracle is free to return them.
 */
export function diffRowSets(
  columns: DiffColumn[],
  reference: Cell[][],
  neo: Cell[][],
  options: DiffOptions = {},
): RowSetDiff {
  const canon = (row: Cell[]): Canon => columns.map((c, i) => normaliseCell(c, row[i]));
  const refRows = reference.map(canon);
  const neoRows = neo.map(canon);

  const remaining = new Map<string, number>();
  for (const row of refRows) {
    const key = JSON.stringify(row);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const unmatchedNeo: Canon[] = [];
  for (const row of neoRows) {
    const key = JSON.stringify(row);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else unmatchedNeo.push(row);
  }
  const unmatchedRef: Canon[] = [];
  for (const [key, left] of remaining) {
    for (let i = 0; i < left; i += 1) unmatchedRef.push(JSON.parse(key) as Canon);
  }

  const columnMismatches: Record<string, number> = {};
  const cellDiffs: CellDiff[][] = [];
  const keyIdx = columns.flatMap((c, i) => (c.key ? [i] : []));
  const paired = new Set<Canon>();
  if (keyIdx.length > 0 && keyIdx.length < columns.length) {
    const keyOf = (row: Canon) => JSON.stringify(keyIdx.map((i) => row[i]));
    const neoByKey = groupBy(unmatchedNeo, keyOf);
    for (const [key, refs] of groupBy(unmatchedRef, keyOf)) {
      const neos = neoByKey.get(key);
      if (refs.length !== 1 || neos?.length !== 1) continue;
      const [ref] = refs as [Canon];
      const [other] = neos as [Canon];
      const diffs = columns.flatMap((c, i) =>
        ref[i] === other[i] ? [] : [{ column: c.name, reference: ref[i] ?? null, neo: other[i] ?? null }],
      );
      for (const d of diffs) columnMismatches[d.column] = (columnMismatches[d.column] ?? 0) + 1;
      cellDiffs.push(diffs);
      paired.add(ref).add(other);
    }
  }

  const examples = options.examples ?? 5;
  const sort = options.sortColumns ?? [];
  const project = (rows: Canon[]) => rows.map((row) => JSON.stringify(sort.map((i) => row[i])));
  const orderMatches =
    sort.length === 0 ? null : JSON.stringify(project(refRows)) === JSON.stringify(project(neoRows));

  return {
    referenceRows: refRows.length,
    neoRows: neoRows.length,
    matchedRows: neoRows.length - unmatchedNeo.length,
    onlyInReference: unmatchedRef.length,
    onlyInNeo: unmatchedNeo.length,
    orderMatches,
    columnMismatches,
    cellDiffs,
    unpaired: {
      reference: unmatchedRef.filter((r) => !paired.has(r)).slice(0, examples),
      neo: unmatchedNeo.filter((r) => !paired.has(r)).slice(0, examples),
    },
  };
}

export type Verdict = 'MATCH' | 'MISMATCH' | 'REFUSED' | 'NOT_COMPARABLE';

export function rowSetVerdict(diff: RowSetDiff): 'MATCH' | 'MISMATCH' {
  return diff.onlyInReference === 0 && diff.onlyInNeo === 0 && diff.orderMatches !== false
    ? 'MATCH'
    : 'MISMATCH';
}

/**
 * Where a reference came from, strongest first. The report prints the label
 * beside every verdict, so a count-only match is never read as a row-level one.
 */
export const ORACLES = {
  LEGACY_SQL:
    'strong: the statement Discoverer generated for the sheet, kept by its scheduler, re-executed now on the same data',
  SOURCE_REFERENCE: 'independent, not Discoverer: a hand-written query over the source tables',
  QPP_ROW_COUNT: 'WEAK: the last row count Discoverer recorded for the sheet; the data may have changed since',
} as const;

export type OracleKind = keyof typeof ORACLES;

/** The hard cases Phase 9.1 requires the sample to cover, each way. */
export const STRATA = ['multiFolder', 'calculated', 'totals', 'distinct', 'masterDetail'] as const;
export type Stratum = (typeof STRATA)[number];

export interface Candidate {
  mapId: string;
  name: string;
  /** Recorded executions in `QPP_STATS`. */
  runs: number;
  strata: Record<Stratum, boolean>;
}

export interface SampleChoice extends Candidate {
  /** Why it was picked: the requirement it filled, or `usage`. */
  reason: string;
}

/**
 * Pick `size` worksheets: first one per requirement — each stratum present and
 * absent, and a master–detail join present — taking the most-used candidate
 * that fills it; then the rest by usage. Deterministic: ties break on name.
 * A requirement no candidate can fill is returned in `uncovered`, never
 * silently dropped.
 */
export function selectStratifiedSample(
  candidates: Candidate[],
  size: number,
): { sample: SampleChoice[]; uncovered: string[] } {
  const ranked = [...candidates].sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
  const requirements = STRATA.flatMap((s) =>
    s === 'masterDetail'
      ? [{ label: s, test: (c: Candidate) => c.strata[s] }]
      : [
          { label: s, test: (c: Candidate) => c.strata[s] },
          { label: `not ${s}`, test: (c: Candidate) => !c.strata[s] },
        ],
  );
  const sample: SampleChoice[] = [];
  const uncovered: string[] = [];
  for (const { label, test } of requirements) {
    if (sample.some(test)) continue;
    const pick = ranked.find((c) => test(c) && !sample.some((s) => s.mapId === c.mapId));
    if (pick) sample.push({ ...pick, reason: label });
    else uncovered.push(label);
  }
  for (const c of ranked) {
    if (sample.length >= size) break;
    if (!sample.some((s) => s.mapId === c.mapId)) sample.push({ ...c, reason: 'usage' });
  }
  return { sample, uncovered };
}

export interface VerdictRecord {
  mapId: string;
  name: string;
  oracle: OracleKind;
  verdict: Verdict;
  strata: Stratum[];
  /** Why — a refusal rule, an error, what made it not comparable. No values. */
  reason?: string;
  referenceRows?: number;
  neoRows?: number;
}

export function tallyVerdicts(records: VerdictRecord[]): {
  byVerdict: Record<Verdict, number>;
  byOracle: Record<string, Record<Verdict, number>>;
  byStratum: Record<string, Record<Verdict, number>>;
} {
  const zero = (): Record<Verdict, number> => ({ MATCH: 0, MISMATCH: 0, REFUSED: 0, NOT_COMPARABLE: 0 });
  const byVerdict = zero();
  const byOracle: Record<string, Record<Verdict, number>> = {};
  const byStratum: Record<string, Record<Verdict, number>> = {};
  for (const r of records) {
    byVerdict[r.verdict] += 1;
    (byOracle[r.oracle] ??= zero())[r.verdict] += 1;
    for (const s of r.strata) (byStratum[s] ??= zero())[r.verdict] += 1;
  }
  return { byVerdict, byOracle, byStratum };
}
