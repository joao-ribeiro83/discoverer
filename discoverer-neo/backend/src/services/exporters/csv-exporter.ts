import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { format as formatCsv } from 'fast-csv';
import {
  cellValue,
  cellText,
  isDateType,
  PROGRESS_ROW_INTERVAL,
  type ExportSource,
  type ExportWriteOptions,
  type ExportWriteResult,
} from './types.js';

/**
 * Byte-order mark. Excel assumes the host ANSI code page when opening a CSV
 * and will mangle any non-ASCII text without this; every other reader treats a
 * leading BOM as a no-op. Since these exports are opened in Excel more often
 * than not, the BOM is written unconditionally.
 */
const UTF8_BOM = '﻿';

/** ISO-8601 without the `T`, matching the Excel exporter's default date format. */
function formatDate(value: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
    `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}

/**
 * Render a cell as text. Escaping (commas, quotes, newlines) is fast-csv's job
 * — doing it here as well would double-escape.
 */
function toText(value: unknown, dateOnly: boolean): string {
  const v = cellValue(value);
  if (v === null) return '';
  if (v instanceof Date) {
    const text = formatDate(v);
    return dateOnly ? text.slice(0, 10) : text;
  }
  return cellText(v);
}

/**
 * Stream a result set into a .csv file.
 *
 * Rows are pushed through fast-csv into the file stream one batch at a time
 * with backpressure respected, so there is no row limit and memory stays flat
 * regardless of result size.
 */
export async function writeCsv(
  filePath: string,
  source: ExportSource,
  options: ExportWriteOptions = {},
): Promise<ExportWriteResult> {
  const { columns } = source;
  // A DATE column carries a time in Oracle, but rendering 00:00:00 on every
  // row of a date-only column is noise — mirrors the Excel exporter's default.
  const dateOnly = columns.map(
    (c) => isDateType(c.dataType) && !/TIMESTAMP/i.test(c.dataType ?? ''),
  );

  const csv = formatCsv({ headers: columns.map((c) => c.label) });
  const out = fs.createWriteStream(filePath);
  out.write(UTF8_BOM);

  let rowCount = 0;
  let lastReported = 0;

  // A generator feeding `pipeline` gives us backpressure for free: it is only
  // pulled from as fast as the file stream drains.
  async function* rows(): AsyncGenerator<string[]> {
    for await (const batch of source.batches) {
      for (const row of batch) {
        yield columns.map((column, i) => toText(row[column.name], dateOnly[i]!));
        rowCount += 1;
      }
      if (options.onRows && rowCount - lastReported >= PROGRESS_ROW_INTERVAL) {
        lastReported = rowCount;
        options.onRows(rowCount);
      }
    }
  }

  // `pipeline` destroys every stage if any of them fails, so a write error
  // can't leave the file handle dangling.
  await pipeline(rows(), csv, out);

  options.onRows?.(rowCount);

  return { rowCount };
}
