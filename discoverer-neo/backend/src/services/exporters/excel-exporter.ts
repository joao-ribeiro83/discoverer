import ExcelJS from 'exceljs';
import type { ResultColumn } from '../map-execution.service.js';
import {
  cellValue,
  cellText,
  isDateType,
  PROGRESS_ROW_INTERVAL,
  type ExportSource,
  type ExportWriteOptions,
  type ExportWriteResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * Rows sampled to size columns before the first row is committed.
 *
 * True auto-sizing is impossible in a streaming writer: column widths are part
 * of the sheet header, which must be written before any row, but the widest
 * value can't be known until the last row has been read. Buffering the whole
 * result to measure it would defeat the entire point of streaming. So we widen
 * to fit a bounded sample of the leading rows — the memory ceiling stays flat
 * regardless of whether the export is 1k rows or 10M.
 */
const SAMPLE_ROWS = 500;

const MIN_WIDTH = 8;
const MAX_WIDTH = 60;
/** Padding beyond the measured text length, in character units. */
const WIDTH_PADDING = 2;

/**
 * Cap on sheets produced by a crosstab split. Excel imposes no hard limit, but
 * each open sheet costs a buffer and readers degrade badly past a few hundred.
 * Rows beyond the cap land in a single overflow sheet rather than being
 * dropped — losing data silently would be far worse than an awkward sheet.
 */
const MAX_SHEETS = 100;
const OVERFLOW_SHEET_NAME = 'Other';
const DEFAULT_SHEET_NAME = 'Data';

// ---------------------------------------------------------------------------
// Format masks
// ---------------------------------------------------------------------------

/**
 * Oracle date-mask tokens mapped to their Excel equivalents, longest-first so
 * that e.g. `HH24` is consumed before `HH` and `MONTH` before `MON`.
 *
 * Note `MI` (Oracle minutes) maps to `mm`, the same token Excel uses for
 * months. That is correct: Excel disambiguates by position, reading `mm` as
 * minutes when it follows an hour token.
 */
const DATE_TOKEN_PATTERN =
  /YYYY|RRRR|MONTH|DAY|HH24|HH12|MON|DY|YY|RR|MM|DD|HH|MI|SS|AM|PM/gi;

const DATE_TOKENS: Record<string, string> = {
  YYYY: 'yyyy',
  RRRR: 'yyyy',
  YY: 'yy',
  RR: 'yy',
  MONTH: 'mmmm',
  MON: 'mmm',
  MM: 'mm',
  DAY: 'dddd',
  DY: 'ddd',
  DD: 'dd',
  HH24: 'hh',
  HH12: 'hh',
  HH: 'hh',
  MI: 'mm',
  SS: 'ss',
  AM: 'AM/PM',
  PM: 'AM/PM',
};

/** Characters Excel accepts verbatim between date tokens. */
const DATE_LITERALS = /^[-/.,:\s]*$/;
/** Characters a converted number format may contain. */
const SAFE_NUMBER_FMT = /^[#0.,$%()\-+\s]+$/;

/** Excel's built-in fallbacks when a column has no usable mask. */
const DEFAULT_DATE_FMT = 'yyyy-mm-dd';
const DEFAULT_DATETIME_FMT = 'yyyy-mm-dd hh:mm:ss';

function convertDateMask(mask: string): string | undefined {
  let converted = '';
  let lastIndex = 0;
  DATE_TOKEN_PATTERN.lastIndex = 0;

  for (let m = DATE_TOKEN_PATTERN.exec(mask); m; m = DATE_TOKEN_PATTERN.exec(mask)) {
    const literal = mask.slice(lastIndex, m.index);
    if (!DATE_LITERALS.test(literal)) return undefined;
    converted += literal + DATE_TOKENS[m[0].toUpperCase()];
    lastIndex = m.index + m[0].length;
  }

  const tail = mask.slice(lastIndex);
  if (!DATE_LITERALS.test(tail)) return undefined;
  converted += tail;

  return converted.trim() === '' ? undefined : converted;
}

function convertNumberMask(mask: string): string | undefined {
  const converted = mask
    .replace(/^FM/i, '')
    .replace(/9/g, '#')
    .replace(/G/gi, ',')
    .replace(/D/gi, '.')
    .replace(/L/gi, '$');

  if (!SAFE_NUMBER_FMT.test(converted)) return undefined;
  // A mask of only separators would render every value blank.
  if (!/[#0]/.test(converted)) return undefined;
  return converted;
}

/**
 * Translate a map item's Oracle format mask into an Excel number format.
 *
 * The two mask languages only partly overlap, so anything not confidently
 * convertible falls back to a type-appropriate default rather than risking an
 * invalid format that would make the workbook unopenable.
 *
 * Exported for direct testing — the conversion table is the kind of thing that
 * silently rots otherwise.
 */
export function excelNumberFormat(column: ResultColumn): string | undefined {
  const { formatMask, dataType } = column;
  const date = isDateType(dataType);

  if (formatMask && formatMask.trim() !== '') {
    const converted = date
      ? convertDateMask(formatMask)
      : convertNumberMask(formatMask);
    if (converted) return converted;
  }

  if (date) {
    // A bare DATE still carries a time component in Oracle, but showing
    // 00:00:00 on every row of a date-only column is noise.
    return /TIMESTAMP/i.test(dataType ?? '')
      ? DEFAULT_DATETIME_FMT
      : DEFAULT_DATE_FMT;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Column sizing
// ---------------------------------------------------------------------------

function displayLength(value: unknown): number {
  if (value == null) return 0;
  if (value instanceof Date) return DEFAULT_DATETIME_FMT.length;
  return cellText(value).length;
}

/**
 * Width per column: the map item's configured width wins; otherwise fit the
 * header and the sampled values, clamped to a readable range.
 */
function computeWidths(
  columns: ResultColumn[],
  sample: Record<string, unknown>[],
): number[] {
  return columns.map((column) => {
    if (column.columnWidth && column.columnWidth > 0) return column.columnWidth;

    let widest = displayLength(column.label);
    for (const row of sample) {
      const len = displayLength(row[column.name]);
      if (len > widest) widest = len;
    }
    return Math.min(Math.max(widest + WIDTH_PADDING, MIN_WIDTH), MAX_WIDTH);
  });
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/**
 * Coerce an arbitrary cell value into a sheet name Excel will actually accept.
 *
 * The rules are unforgiving and a violation makes the whole workbook
 * unopenable, so this is deliberately strict: forbidden punctuation and any
 * control character (crosstab values are user data and routinely contain
 * newlines) are replaced, apostrophes may not sit at either end, the name is
 * capped at 31 characters, `History` is reserved, and it may not be empty.
 */
export function sheetNameFor(value: unknown, taken: Set<string>): string {
  const raw = value == null || value === '' ? '(blank)' : cellText(value);

  const sanitize = (s: string): string => {
    const cleaned = s
      // eslint-disable-next-line no-control-regex
      .replace(/[:\\/?*[\]\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Excel rejects a leading or trailing apostrophe.
      .replace(/^'+|'+$/g, '')
      .trim();
    if (cleaned === '') return '(blank)';
    // 'History' is reserved by Excel for its revision log.
    return /^history$/i.test(cleaned) ? `${cleaned}_` : cleaned;
  };

  const base = sanitize(raw).slice(0, 31).trim() || '(blank)';
  if (!taken.has(base)) return base;

  for (let i = 2; ; i += 1) {
    const suffix = `_${i}`;
    const candidate = (base.slice(0, 31 - suffix.length).trim() + suffix) || suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Stream a result set into an .xlsx file.
 *
 * Every row is committed to disk as it is written and never retained, so peak
 * memory is governed by the sizing sample and the writer's own zip buffer, not
 * by the row count. This is what makes 1M+ row exports viable.
 */
export async function writeXlsx(
  filePath: string,
  source: ExportSource,
  options: ExportWriteOptions = {},
): Promise<ExportWriteResult> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    // Styles are needed for per-column number formats.
    useStyles: true,
    // Critical for large exports: the shared-strings table is held in memory
    // for the lifetime of the workbook and grows with every distinct string.
    // Writing strings inline keeps memory flat at the cost of a larger file.
    useSharedStrings: false,
  });

  const { columns } = source;
  const formats = columns.map(excelNumberFormat);
  const iterator = source.batches[Symbol.asyncIterator]();

  // Pull batches until the sizing sample is full (or the data runs out). These
  // rows are held only until the header is written, then released.
  const sample: Record<string, unknown>[] = [];
  const pending: Record<string, unknown>[][] = [];
  let exhausted = false;
  while (sample.length < SAMPLE_ROWS && !exhausted) {
    const next = await iterator.next();
    if (next.done) {
      exhausted = true;
      break;
    }
    pending.push(next.value);
    for (const row of next.value) {
      if (sample.length >= SAMPLE_ROWS) break;
      sample.push(row);
    }
  }

  const widths = computeWidths(columns, sample);
  sample.length = 0;

  const sheets = new Map<string, ExcelJS.Worksheet>();
  const takenNames = new Set<string>();
  let overflowed = false;

  const openSheet = (name: string): ExcelJS.Worksheet => {
    const sheet = workbook.addWorksheet(name);
    // Setting `columns` writes the header row and fixes widths; in a streaming
    // writer this must happen before the sheet's first data row is committed.
    sheet.columns = columns.map((column, i) => ({
      header: column.label,
      key: column.name,
      width: widths[i],
      style: formats[i] ? { numFmt: formats[i] } : undefined,
    }));
    sheet.getRow(1).font = { bold: true };
    return sheet;
  };

  const sheetFor = (row: Record<string, unknown>): ExcelJS.Worksheet => {
    if (!options.sheetByColumn) {
      let sheet = sheets.get(DEFAULT_SHEET_NAME);
      if (!sheet) {
        sheet = openSheet(DEFAULT_SHEET_NAME);
        sheets.set(DEFAULT_SHEET_NAME, sheet);
        takenNames.add(DEFAULT_SHEET_NAME);
      }
      return sheet;
    }

    const key = cellText(row[options.sheetByColumn]);
    const existing = sheets.get(key);
    if (existing) return existing;

    if (sheets.size >= MAX_SHEETS) {
      overflowed = true;
      let overflow = sheets.get(OVERFLOW_SHEET_NAME);
      if (!overflow) {
        const name = sheetNameFor(OVERFLOW_SHEET_NAME, takenNames);
        overflow = openSheet(name);
        takenNames.add(name);
        sheets.set(OVERFLOW_SHEET_NAME, overflow);
      }
      return overflow;
    }

    const name = sheetNameFor(row[options.sheetByColumn], takenNames);
    takenNames.add(name);
    const sheet = openSheet(name);
    sheets.set(key, sheet);
    return sheet;
  };

  let rowCount = 0;
  let lastReported = 0;

  const writeBatch = (batch: Record<string, unknown>[]): void => {
    for (const row of batch) {
      const values: Record<string, unknown> = {};
      for (const column of columns) values[column.name] = cellValue(row[column.name]);
      // `.commit()` flushes the row to the underlying zip stream; without it
      // the worksheet would retain every row and defeat streaming entirely.
      sheetFor(row).addRow(values).commit();
      rowCount += 1;
    }
    if (options.onRows && rowCount - lastReported >= PROGRESS_ROW_INTERVAL) {
      lastReported = rowCount;
      options.onRows(rowCount);
    }
  };

  try {
    for (const batch of pending) writeBatch(batch);
    pending.length = 0;

    if (!exhausted) {
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        writeBatch(next.value);
      }
    }

    // An empty result still needs a sheet, or the workbook is unopenable.
    if (sheets.size === 0) {
      const sheet = openSheet(DEFAULT_SHEET_NAME);
      sheets.set(DEFAULT_SHEET_NAME, sheet);
    }

    for (const sheet of sheets.values()) sheet.commit();
    await workbook.commit();
  } catch (err) {
    // Abandon the iterator so the DB cursor is closed even on a write failure.
    await iterator.return?.(undefined);
    throw err;
  }

  options.onRows?.(rowCount);

  return {
    rowCount,
    sheets: [...sheets.values()].map((s) => s.name),
    ...(overflowed ? { overflowed: true } : {}),
  };
}
