import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import {
  cellText,
  PROGRESS_ROW_INTERVAL,
  type ExportSource,
  type ExportWriteOptions,
  type ExportWriteResult,
} from './types.js';

// ---------------------------------------------------------------------------
// map_page_setup, as this exporter needs it
//
// Every field but `orientation`/margins/header/footer/print toggles is
// authored-only (nothing migrates a value into them — see
// buildMapPageSetupRow's comment and Decision 13): a null here just means
// "not set", not "broken", and gets a sensible default below.
// ---------------------------------------------------------------------------

export interface PdfPageSetup {
  orientation?: 'PORTRAIT' | 'LANDSCAPE' | null;
  headerLeft?: string | null;
  headerCenter?: string | null;
  headerRight?: string | null;
  footerLeft?: string | null;
  footerCenter?: string | null;
  footerRight?: string | null;
  /** Inches. `string` because Postgres `numeric` round-trips through drizzle as text. */
  marginTop?: number | string | null;
  marginBottom?: number | string | null;
  marginLeft?: number | string | null;
  marginRight?: number | string | null;
  /** Cell borders. Defaults on — an ungridded export reads like a wall of text. */
  printGridLines?: boolean | null;
  /** Repeat the column-header row on every page. Defaults on. */
  printHeadings?: boolean | null;
}

export interface PdfExportOptions extends ExportWriteOptions {
  pageSetup?: PdfPageSetup | null;
  /** The worksheet's own name — the default title, and the `&T` placeholder. */
  title?: string;
  /** BCP-47 tag for the `&D` placeholder's date format. Defaults to 'en'. */
  locale?: string;
}

const POINTS_PER_INCH = 72;
const DEFAULT_MARGIN_IN = 0.5;
const FONT_SIZE = 8;
const HEADER_FONT_SIZE = 8;
const ROW_HEIGHT = 16;
const CELL_PAD_X = 4;
const CHROME_FONT_SIZE = 8;
const MIN_COLUMN_WIDTH = 40;

function inchesToPoints(value: number | string | null | undefined, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  const inches = parsed != null && parsed > 0 ? parsed : fallback;
  return inches * POINTS_PER_INCH;
}

/**
 * Discoverer's own header/footer tokens (`&P`, `&D`, ...) were never decoded
 * for this estate (Decision 13) — these are Neo's own, documented where a
 * page-setup row is authored, not a guess at Discoverer's syntax.
 */
function interpolateChrome(
  template: string | null | undefined,
  page: number,
  title: string,
  dateFormat: Intl.DateTimeFormat,
): string {
  if (!template) return '';
  return template
    .replace(/&P/g, String(page))
    .replace(/&D/g, dateFormat.format(new Date()))
    .replace(/&T/g, title);
}

/** Column widths in points, proportional to each column's own configured width (equal split when none set). */
function computeColumnWidths(columns: ExportSource['columns'], usableWidth: number): number[] {
  const configured = columns.map((c) => (c.columnWidth && c.columnWidth > 0 ? c.columnWidth : null));
  const totalConfigured = configured.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const unconfiguredCount = configured.filter((w) => w == null).length;

  if (totalConfigured === 0) {
    const equal = usableWidth / columns.length;
    return columns.map(() => Math.max(equal, MIN_COLUMN_WIDTH));
  }

  // Configured columns get their share of the usable width proportional to
  // their own width; unconfigured ones split whatever remains equally.
  const remaining = Math.max(usableWidth - totalConfigured, 0);
  const shareForUnconfigured = unconfiguredCount > 0 ? remaining / unconfiguredCount : 0;
  const scale = totalConfigured > usableWidth ? usableWidth / totalConfigured : 1;
  return configured.map((w) =>
    Math.max(w != null ? w * scale : shareForUnconfigured, MIN_COLUMN_WIDTH),
  );
}

/**
 * Stream a result set into a paginated .pdf: a bordered table matching the
 * worksheet grid, with `map_page_setup`'s orientation/margins/header/footer/
 * grid-line settings honoured when set (defaults otherwise, which is every
 * row migration has written so far — nothing here required that to change).
 *
 * Table rows are drawn directly with pdfkit's low-level text/rect primitives
 * rather than a table plugin, because pagination has to interleave with the
 * same row stream CSV/XLSX consume — a plugin that wants the whole table
 * up front would defeat the streaming this exporter exists for.
 */
export async function writePdf(
  filePath: string,
  source: ExportSource,
  options: PdfExportOptions = {},
): Promise<ExportWriteResult> {
  const pageSetup = options.pageSetup ?? null;
  const title = options.title ?? 'Export';
  const printGridLines = pageSetup?.printGridLines ?? true;
  const printHeadings = pageSetup?.printHeadings ?? true;
  const dateFormat = new Intl.DateTimeFormat(options.locale ?? 'en');

  const doc = new PDFDocument({
    size: 'A4',
    layout: pageSetup?.orientation === 'LANDSCAPE' ? 'landscape' : 'portrait',
    margins: {
      top: inchesToPoints(pageSetup?.marginTop, DEFAULT_MARGIN_IN),
      bottom: inchesToPoints(pageSetup?.marginBottom, DEFAULT_MARGIN_IN),
      left: inchesToPoints(pageSetup?.marginLeft, DEFAULT_MARGIN_IN),
      right: inchesToPoints(pageSetup?.marginRight, DEFAULT_MARGIN_IN),
    },
    bufferPages: false,
    autoFirstPage: false,
  });

  const out = fs.createWriteStream(filePath);
  const written = new Promise<void>((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });
  doc.pipe(out);

  const { columns } = source;
  const hasHeaderText = !!(pageSetup?.headerLeft || pageSetup?.headerCenter || pageSetup?.headerRight);
  const hasFooterText = !!(pageSetup?.footerLeft || pageSetup?.footerCenter || pageSetup?.footerRight);
  const chromeHeight = CHROME_FONT_SIZE + 6;

  let pageNumber = 0;
  let columnWidths: number[] = [];
  let contentTop = 0;
  let contentBottom = 0;
  let contentLeft = 0;
  let cursorY = 0;

  function drawChromeLine(text: string, y: number, width: number, x: number): void {
    if (!text) return;
    doc.font('Helvetica').fontSize(CHROME_FONT_SIZE).text(text, x, y, { width, lineBreak: false });
  }

  function drawHeaderFooter(): void {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const third = width / 3;
    if (hasHeaderText) {
      const y = doc.page.margins.top - chromeHeight;
      drawChromeLine(interpolateChrome(pageSetup?.headerLeft, pageNumber, title, dateFormat), y, third, left);
      doc
        .font('Helvetica')
        .fontSize(CHROME_FONT_SIZE)
        .text(interpolateChrome(pageSetup?.headerCenter, pageNumber, title, dateFormat), left + third, y, {
          width: third,
          align: 'center',
          lineBreak: false,
        });
      doc
        .font('Helvetica')
        .fontSize(CHROME_FONT_SIZE)
        .text(interpolateChrome(pageSetup?.headerRight, pageNumber, title, dateFormat), left + third * 2, y, {
          width: third,
          align: 'right',
          lineBreak: false,
        });
    }
    if (hasFooterText) {
      const y = doc.page.height - doc.page.margins.bottom + 4;
      // pdfkit auto-adds a page the instant text() is asked to draw below
      // `page.height - margins.bottom` — exactly where a footer belongs — so
      // the bottom margin is zeroed for the duration of this draw and
      // restored immediately after (the standard pdfkit footer workaround).
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      drawChromeLine(interpolateChrome(pageSetup?.footerLeft, pageNumber, title, dateFormat), y, third, left);
      doc
        .font('Helvetica')
        .fontSize(CHROME_FONT_SIZE)
        .text(interpolateChrome(pageSetup?.footerCenter, pageNumber, title, dateFormat), left + third, y, {
          width: third,
          align: 'center',
          lineBreak: false,
        });
      doc
        .font('Helvetica')
        .fontSize(CHROME_FONT_SIZE)
        .text(interpolateChrome(pageSetup?.footerRight, pageNumber, title, dateFormat), left + third * 2, y, {
          width: third,
          align: 'right',
          lineBreak: false,
        });
      doc.page.margins.bottom = savedBottom;
    }
  }

  function drawHeaderRow(): void {
    doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE);
    let x = contentLeft;
    columns.forEach((column, i) => {
      const w = columnWidths[i]!;
      if (printGridLines) doc.rect(x, cursorY, w, ROW_HEIGHT).stroke();
      doc.text(column.label, x + CELL_PAD_X, cursorY + 4, {
        width: w - CELL_PAD_X * 2,
        height: ROW_HEIGHT - 4,
        ellipsis: true,
        lineBreak: false,
      });
      x += w;
    });
    cursorY += ROW_HEIGHT;
  }

  function renderPageChrome(): void {
    contentTop = doc.page.margins.top + (hasHeaderText ? chromeHeight : 0);
    contentBottom = doc.page.height - doc.page.margins.bottom - (hasFooterText ? chromeHeight : 0);
    contentLeft = doc.page.margins.left;
    cursorY = contentTop;
    drawHeaderFooter();
    if (printHeadings) drawHeaderRow();
  }

  function startPage(): void {
    pageNumber += 1;
    doc.addPage();
    renderPageChrome();
  }

  // Page size/orientation/margins are fixed at document construction, so the
  // first page (needed before `doc.page` exists at all, hence before column
  // widths can be measured) doubles as the one-time width computation.
  doc.addPage();
  pageNumber = 1;
  columnWidths = computeColumnWidths(
    columns,
    doc.page.width - doc.page.margins.left - doc.page.margins.right,
  );
  renderPageChrome();

  function drawDataRow(row: Record<string, unknown>): void {
    if (cursorY + ROW_HEIGHT > contentBottom) {
      startPage();
    }
    doc.font('Helvetica').fontSize(FONT_SIZE);
    let x = contentLeft;
    columns.forEach((column, i) => {
      const w = columnWidths[i]!;
      if (printGridLines) doc.rect(x, cursorY, w, ROW_HEIGHT).stroke();
      doc.text(cellText(row[column.name]), x + CELL_PAD_X, cursorY + 4, {
        width: w - CELL_PAD_X * 2,
        height: ROW_HEIGHT - 4,
        ellipsis: true,
        lineBreak: false,
      });
      x += w;
    });
    cursorY += ROW_HEIGHT;
  }

  let rowCount = 0;
  let lastReported = 0;

  try {
    for await (const batch of source.batches) {
      for (const row of batch) {
        drawDataRow(row);
        rowCount += 1;
      }
      if (options.onRows && rowCount - lastReported >= PROGRESS_ROW_INTERVAL) {
        lastReported = rowCount;
        options.onRows(rowCount);
      }
    }
  } catch (err) {
    doc.end();
    throw err;
  }

  doc.end();
  await written;
  options.onRows?.(rowCount);

  return { rowCount };
}
