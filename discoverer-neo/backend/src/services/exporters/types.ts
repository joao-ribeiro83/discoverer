import type { ResultColumn } from '../map-execution.service.js';

/**
 * The contract every exporter consumes.
 *
 * `batches` is deliberately an `AsyncIterable` rather than an array: an export
 * may be millions of rows, so the writer pulls one batch at a time and hands it
 * straight to disk. Nothing upstream or downstream accumulates the full set.
 */
export interface ExportSource {
  columns: ResultColumn[];
  batches: AsyncIterable<Record<string, unknown>[]>;
}

/**
 * The document header of an export: what Discoverer printed above a
 * worksheet, and what it wrote into the first row of an Excel export (the
 * data started on row 3, row 2 left blank). `title`/`description` arrive with
 * their `&Date`/`&Time`/`&<ParamName>` tokens already substituted with the
 * values this run used (`resolveHeading`); `parameters` lists the values that
 * the text did NOT already mention, so every parameter the run used is on
 * the page exactly once.
 */
export interface ExportHeading {
  title: string | null;
  description: string | null;
  parameters: Array<{ name: string; value: string }>;
  runAt: Date;
}

/**
 * The header as one block of text (line breaks inside), or null when there is
 * nothing to print. Shared by all three writers so the formats agree on what
 * the header says; only the typography differs.
 */
export function headingText(heading: ExportHeading | undefined): string | null {
  if (!heading) return null;
  const lines = [heading.title, heading.description]
    .filter((t): t is string => !!t && t.trim() !== '')
    .flatMap((t) => t.split(/\r?\n/))
    .map((l) => l.trimEnd())
    // The description opens by repeating the title on most migrated maps.
    .filter((l, i, all) => all.indexOf(l) === i);
  for (const p of heading.parameters) lines.push(`${p.name}: ${p.value}`);
  const text = lines.join('\n').trim();
  return text === '' ? null : text;
}

export interface ExportWriteOptions {
  /** Document header to write above the column labels; omitted = none. */
  heading?: ExportHeading;
  /**
   * Called as rows are written, with the running total. Exporters call this
   * once per batch (not per row) to keep progress cheap.
   */
  onRows?: (rowsWritten: number) => void;
  /**
   * Crosstab maps split into one sheet per distinct value of this column
   * (XLSX only; CSV has no concept of sheets and ignores it).
   */
  sheetByColumn?: string;
}

export interface ExportWriteResult {
  rowCount: number;
  /** Sheet names actually written (XLSX); single-element for flat exports. */
  sheets?: string[];
  /** True when a crosstab split hit the sheet cap and used an overflow sheet. */
  overflowed?: boolean;
}

/**
 * Rows written between `onRows` callbacks. Progress granularity, not memory:
 * batches arrive from the DB cursor at its own size and are never merged.
 */
export const PROGRESS_ROW_INTERVAL = 5_000;

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/** `undefined` is not a writable cell value; normalise it to null. */
export function cellValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

/**
 * Render a cell as text.
 *
 * A driver hands back more than scalars — a JSON column, an Oracle object
 * type — and a bare `String()` writes those into the file as
 * `[object Object]`. JSON keeps the content readable instead.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return value.toString();
  }
  if (value instanceof Date) return value.toString();
  return JSON.stringify(value) ?? '';
}

/**
 * Oracle DATA_TYPE substrings that denote a numeric column. Matches the
 * frontend's `item-utils.isNumericType` vocabulary so a column classified as a
 * measure in the builder formats as a number in the export.
 */
const NUMERIC_TYPE_HINTS = [
  'NUMBER',
  'NUMERIC',
  'DECIMAL',
  'FLOAT',
  'DOUBLE',
  'INTEGER',
  'INT',
  'BIGINT',
  'SMALLINT',
  'BINARY_FLOAT',
  'BINARY_DOUBLE',
];

const DATE_TYPE_HINTS = ['DATE', 'TIMESTAMP'];

export function isNumericType(dataType: string | null | undefined): boolean {
  if (!dataType) return false;
  const t = dataType.toUpperCase();
  return NUMERIC_TYPE_HINTS.some((hint) => t.includes(hint));
}

export function isDateType(dataType: string | null | undefined): boolean {
  if (!dataType) return false;
  const t = dataType.toUpperCase();
  // INTERVAL types contain neither hint but would false-positive on nothing;
  // TIMESTAMP WITH TIME ZONE still reads as a date, which is what we want.
  return DATE_TYPE_HINTS.some((hint) => t.includes(hint));
}
