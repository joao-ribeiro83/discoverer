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

export interface ExportWriteOptions {
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
