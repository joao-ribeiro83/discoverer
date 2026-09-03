/**
 * Builder for synthetic Discoverer workbook bodies (`.DIS` containers).
 *
 * The parser in `services/workbook-parser.ts` reads a format Oracle never
 * documented, derived from real workbooks. Testing it against hand-written
 * hex would be unreadable and would not say *why* a byte is where it is, so
 * this builder emits the same container from a description of its contents —
 * the encoder to the parser's decoder.
 *
 * It writes the same records a real workbook does — scalars at their own
 * widths, counted strings, counted vectors, object references — so a fixture
 * exercises the record framing the worksheet model depends on. `opaque()` is
 * the exception: it writes a record followed by filler the record never
 * declared, which is how a test forces the **resynchronizing fallback**, the
 * path a real workbook takes only if its bytes are damaged.
 *
 * Byte layout (see `workbook-parser.ts` for the full derivation):
 *
 * ```
 *   BEGIN   00 01 00 00 | 00 <class:u16 LE> 00 | <elementId:u32 LE>
 *   END     00 02 00 00 | 00 <class:u16 LE> 00
 *   scalar  <type> <tag:u16 LE> 00 <payload, width from type>
 *   string  08 <tag:u16 LE> 00 <counted len> <latin-1 bytes>
 *   vector  00 0a 00 00 | <type> <tag> 00 <count:u16> <payloads> | 00 0b 00 00
 * ```
 *
 * Element ids must be strictly sequential from 1 — the parser uses exactly
 * that to reject false positives, so the builder assigns them itself.
 */

/** Element classes, mirroring the `CLASS` table in the parser. */
export const FIXTURE_CLASS = {
  EUL_IDENTITY: 0x0064,
  WORKBOOK: 0x012c,
  ITEM_REF: 0x00db,
  CALCULATION: 0x00dc,
  CONDITION: 0x00fa,
  PARAMETER: 0x0104,
  COLUMN: 0x02bc,
  FORMAT: 0x0640,
  FONT: 0x07d0,
  WORKSHEET: 0x01f4,
  FUNCTION: 0x00d2,
  TOTAL: 0x0c1c,

  // --- the worksheet model ------------------------------------------------
  EUL_FILTER_REF: 0x00f9,
  SORT: 0x00f0,
  JOIN_REF: 0x0118,
  QUERY_REQUEST: 0x0122,
  SHEET_LAYOUT: 0x0258,
  CELL_STYLE: 0x0320,
  VIEW_TABLE: 0x0384,
  VIEW_CROSSTAB: 0x0385,
  SORT_LIST: 0x04b0,
  SORT_ENTRY: 0x0514,
  SORT_GROUP: 0x05dc,
  PAGE_SETUP: 0x0834,
  PARAMETER_VALUE: 0x0898,
  QUERY_LINK: 0x0d48,
} as const;

/** String tags, mirroring the `TAG` table in the parser. */
/** Numeric field tags, mirroring `NUMERIC_TAGS` in the parser. */
export const FIXTURE_NUMBER = {
  /** On an item element: the EUL `EXPRESSIONS.EXP_ID`. Record type `0x01`. */
  ITEM_SOURCE_ID: { type: 0x01, tag: 0x00dd },
  /** On a column element: the element id of the item shown. Record type `0x02`. */
  COLUMN_ITEM_REF: { type: 0x02, tag: 0x02bf },
} as const;

export const FIXTURE_TAG = {
  EUL_OWNER: 0x0066,
  EUL_NAME: 0x0067,
  NLS: 0x0137,
  DISCOVERER_VERSION: 0x012e,
  WORKBOOK_NAME: 0x0132,
  ITEM_NAME: 0x0fa0,
  ITEM_LABEL: 0x00de,
  FOLDER_NAME: 0x0fa1,
  FOLDER_LABEL: 0x00e5,
  CALC_FORMULA: 0x00e0,
  FORMAT_DISPLAY: 0x064a,
  FORMAT_STORAGE: 0x064c,
  FONT_NAME: 0x07df,
  COLUMN_HEADING: 0x02c2,
  COLUMN_REF: 0x0fab,
  CONDITION_SQL: 0x00fc,
  CONDITION_NAME: 0x00fd,
  CONDITION_TOKENS: 0x00ff,
  PARAMETER_NAME: 0x0106,
  PARAMETER_DESCRIPTION: 0x0107,
  PARAMETER_PROMPT: 0x0109,
  PARAMETER_DEFAULT: 0x010a,
  WORKSHEET_NAME: 0x01f6,
  WORKSHEET_GUID: 0x0200,
  WORKSHEET_TITLE: 0x01f9,
  WORKSHEET_TITLE_RTF: 0x0201,
  WORKSHEET_TITLE_HTML: 0x0205,
  FUNCTION_NAME: 0x0faa,
  TOTAL_LABEL: 0x0c21,

  // --- the worksheet model ------------------------------------------------
  CALC_IDENTIFIER: 0x0fa0,
  CALC_DESCRIPTION: 0x00df,
  CALC_PLACEMENT: 0x00e2,
  CALC_DATA_TYPE: 0x00e3,
  CALC_ITEM_REFS: 0x00e4,
  CALC_HIDDEN: 0x00e6,
  CALC_IS_A_CALC: 0x00e7,
  CALC_FORMAT_MASK: 0x00e8,

  CONDITION_CASE_SENSITIVE: 0x0102,
  CONDITION_PARAMETER_REFS: 0x010c,
  FILTER_SOURCE_ID: 0x00fb,
  FILTER_FOLDER_NAME: 0x0fa3,
  FILTER_FOLDER_LABEL: 0x00fe,
  CONDITION_IDENTIFIER: 0x0fa2,

  PARAMETER_IDENTIFIER: 0x0fa4,
  PARAMETER_SOURCE_ID: 0x0105,
  PARAMETER_ITEM_REF: 0x010b,

  SORT_ITEM_REF: 0x00f1,
  SORT_DIRECTION: 0x00f2,
  SORT_ENTRY_DESCENDING: 0x0516,
  SORT_ENTRY_ITEM_REF: 0x0517,
  SORT_ENTRY_GROUP_REF: 0x0518,
  SORT_ENTRY_FLAG_0519: 0x0519,
  SORT_ENTRY_FLAG_051A: 0x051a,
  SORT_LIST_ENTRIES: 0x04b2,

  JOIN_SOURCE_ID: 0x0119,
  JOIN_NAME: 0x011a,
  JOIN_FOLDER_LABEL: 0x011b,
  JOIN_IDENTIFIER: 0x0fa7,
  JOIN_FOLDER_NAME: 0x0fa8,

  QUERY_AXIS_ITEMS: 0x0123,
  QUERY_MEASURE_ITEMS: 0x0124,
  QUERY_SORTS: 0x0125,
  QUERY_FILTERS: 0x0126,
  QUERY_JOINS: 0x0127,
  QUERY_DISTINCT: 0x0128,

  WORKSHEET_LAYOUT_REF: 0x01f7,
  WORKSHEET_VIEW_REF: 0x01f8,

  LAYOUT_COLUMNS: 0x025d,
  LAYOUT_SORT_LIST_REF: 0x0264,
  LAYOUT_FILTERS: 0x0265,
  LAYOUT_TOTALS: 0x0268,
  LAYOUT_PARAMETER_VALUES: 0x026a,
  LAYOUT_QUERY_LINKS: 0x026b,

  COLUMN_AXIS_TYPE: 0x02be,
  COLUMN_DATA_STYLE_REF: 0x02c0,
  COLUMN_HEADING_STYLE_REF: 0x02c1,
  STYLE_FONT_REF: 0x0322,

  FORMAT_DATA_TYPE: 0x0642,
  FORMAT_ALIGNMENT: 0x0643,
  FORMAT_WORD_WRAP: 0x0645,

  FONT_DISPLAY_WIDTH: 0x07e4,
  FONT_ROLE: 0x07e7,
  FONT_FORMAT_REF: 0x07e8,

  PAGE_TEXT_FIRST: 0x0840,
  PAGE_FONT_FIRST: 0x083a,
  PAGE_MARGIN_FIRST: 0x0846,

  PARAMETER_VALUE_REF: 0x0899,
  PARAMETER_VALUE_DATA: 0x089a,
  QUERY_LINK_REF: 0x0d49,

  TOTAL_FUNCTION: 0x0c1d,
  TOTAL_DATA_STYLE_REF: 0x0c1e,
  TOTAL_HEADING_STYLE_REF: 0x0c1f,
  TOTAL_PLACEMENT: 0x0c20,
  TOTAL_COLUMN_REF: 0x0c22,
  TOTAL_BREAK_COLUMN_REF: 0x0c23,
  /** `0x0c24`–`0x0c28`, all [UNCONFIRMED]; a fixture can still set them. */
  TOTAL_FLAG_FIRST: 0x0c24,
  TOTAL_FLAG_LAST: 0x0c28,
} as const;

/** Record type bytes, mirroring the parser's `FIXED_WIDTH` table. */
export const FIXTURE_TYPE = {
  /** Object reference (and, with the four structural tags, a marker). */
  REF: 0x00,
  INT32: 0x01,
  INT32_ALT: 0x02,
  INT16: 0x03,
  UINT8: 0x05,
  FLOAT32: 0x06,
  UINT8_ALT: 0x07,
  STRING: 0x08,
  BLOB: 0x0a,
} as const;

/** A record header: `<type:u8><tag:u16 LE><flags:u8>`. */
function header(type: number, tag: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt8(type, 0);
  buf.writeUInt16LE(tag, 1);
  buf.writeUInt8(0x00, 3);
  return buf;
}

/** `DCWArchive`'s counted string length: u8, escaping to u16 then u32. */
function encodeStringLength(length: number): Buffer {
  if (length < 0xff) return Buffer.from([length]);
  if (length < 0xffff) {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(0xff, 0);
    buf.writeUInt16LE(length, 1);
    return buf;
  }
  const buf = Buffer.alloc(7);
  buf.writeUInt8(0xff, 0);
  buf.writeUInt16LE(0xffff, 1);
  buf.writeUInt32LE(length, 3);
  return buf;
}

/** One payload of a fixed-width record type. */
function encodeScalar(type: number, value: number): Buffer {
  switch (type) {
    case 0x00:
    case 0x01:
    case 0x02: {
      const buf = Buffer.alloc(4);
      buf.writeInt32LE(value, 0);
      return buf;
    }
    case 0x06: {
      const buf = Buffer.alloc(4);
      buf.writeFloatLE(value, 0);
      return buf;
    }
    case 0x03:
    case 0x04: {
      const buf = Buffer.alloc(2);
      buf.writeInt16LE(value, 0);
      return buf;
    }
    case 0x05:
    case 0x07:
      return Buffer.from([value & 0xff]);
    default:
      throw new Error(`fixture: record type 0x${type.toString(16)} has no fixed width`);
  }
}

export class WorkbookFixtureBuilder {
  private readonly chunks: Buffer[] = [];
  private nextElementId = 1;

  /** Open an element of `cls`; subsequent strings belong to it. */
  element(cls: number): this {
    const buf = Buffer.alloc(12);
    buf.writeUInt8(0x00, 0);
    buf.writeUInt16LE(0x0001, 1); // BEGIN
    buf.writeUInt8(0x00, 3);
    buf.writeUInt8(0x00, 4);
    buf.writeUInt16LE(cls, 5);
    buf.writeUInt8(0x00, 7);
    buf.writeUInt32LE(this.nextElementId, 8);
    this.nextElementId += 1;
    this.chunks.push(buf);
    return this;
  }

  /**
   * Write a string record. Values are encoded latin-1, as Discoverer does.
   *
   * The length uses `DCWArchive`'s counted form — one byte, escaping to a
   * `u16` at `0xff` and a `u32` at `0xffff` — so a fixture can carry a
   * formula longer than 254 bytes, which is what real workbooks do and what
   * the parser used to be unable to read.
   */
  string(tag: number, value: string): this {
    const bytes = Buffer.from(value, 'latin1');
    const head = Buffer.alloc(4);
    head.writeUInt8(0x08, 0);
    head.writeUInt16LE(tag, 1);
    head.writeUInt8(0x00, 3);
    this.chunks.push(head, encodeStringLength(bytes.length), bytes);
    return this;
  }

  /**
   * Write a fixed-width numeric record: `<type> <tag:u16 LE> 00 <payload>`.
   *
   * Width follows the type — 4 bytes for `0x00`–`0x02` and `0x06`, 2 for
   * `0x03`/`0x04`, 1 for `0x05`/`0x07` — exactly as the parser resolves it.
   */
  number(type: number, tag: number, value: number): this {
    this.chunks.push(header(type, tag), encodeScalar(type, value));
    return this;
  }

  /** A 4-byte object reference — record type `0x00` under a non-structural tag. */
  ref(tag: number, elementId: number): this {
    return this.number(0x00, tag, elementId);
  }

  /**
   * A counted vector: `00 0a 00 00` · `<type> <tag> 00 <count:u16> <payloads>` ·
   * `00 0b 00 00`. This is how every list in the worksheet model is written.
   */
  vector(type: number, tag: number, values: readonly number[]): this {
    this.marker(0x000a);
    const count = Buffer.alloc(2);
    count.writeUInt16LE(values.length, 0);
    this.chunks.push(header(type, tag), count, ...values.map((v) => encodeScalar(type, v)));
    this.marker(0x000b);
    return this;
  }

  /** A counted vector of object references. */
  refVector(tag: number, elementIds: readonly number[]): this {
    return this.vector(0x00, tag, elementIds);
  }

  /** A `0x0a` record: `[subtype:u32][len:u32][bytes]`. */
  blob(tag: number, subtype: number, bytes: Buffer): this {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(subtype, 0);
    head.writeUInt32LE(bytes.length, 4);
    this.chunks.push(header(0x0a, tag), head, bytes);
    return this;
  }

  /**
   * A vector whose items are complete records rather than bare payloads —
   * the `00 0c 00 00` … `00 0d 00 00` bracket. Only saved parameter values
   * (`0x0898`) use it.
   */
  blobVector(tag: number, entries: ReadonlyArray<{ subtype: number; bytes: Buffer }>): this {
    this.marker(0x000c);
    const count = Buffer.alloc(2);
    count.writeUInt16LE(entries.length, 0);
    this.chunks.push(header(0x0a, tag), count);
    for (const entry of entries) {
      const head = Buffer.alloc(8);
      head.writeUInt32LE(entry.subtype, 0);
      head.writeUInt32LE(entry.bytes.length, 4);
      this.chunks.push(header(0x0a, tag), head, entry.bytes);
    }
    this.marker(0x000d);
    return this;
  }

  /** A bare 4-byte marker record — used for the vector brackets. */
  private marker(tag: number): this {
    this.chunks.push(header(0x00, tag));
    return this;
  }

  /**
   * Write a 4-byte integer field: `<type> <tag:u16 LE> 00 <value:i32 LE>`.
   *
   * Used for the two fields the parser reads as numbers — an item's EUL
   * `EXP_ID` (`0x00dd`) and a column's item reference (`0x02bf`). Signed,
   * because a workbook calculation stores a negative id in the first of them.
   */
  int32(type: number, tag: number, value: number): this {
    const buf = Buffer.alloc(8);
    buf.writeUInt8(type, 0);
    buf.writeUInt16LE(tag, 1);
    buf.writeUInt8(0x00, 3);
    buf.writeInt32LE(value, 4);
    this.chunks.push(buf);
    return this;
  }

  /**
   * Emit a record the parser does not decode — an int32 field, plus a run of
   * arbitrary bytes standing in for a schema-driven payload. Exists so tests
   * can prove the parser skips over what it cannot type instead of derailing.
   */
  opaque(tag = 0x07d2, filler = 6): this {
    const buf = Buffer.alloc(8 + filler);
    buf.writeUInt8(0x01, 0);
    buf.writeUInt16LE(tag, 1);
    buf.writeUInt8(0x00, 3);
    buf.writeInt32LE(-11, 4);
    for (let i = 0; i < filler; i += 1) buf.writeUInt8((i * 37 + 3) & 0xff, 8 + i);
    this.chunks.push(buf);
    return this;
  }

  /** An END marker. The parser ignores these; real workbooks are full of them. */
  end(cls: number): this {
    const buf = Buffer.alloc(8);
    buf.writeUInt8(0x00, 0);
    buf.writeUInt16LE(0x0002, 1); // END
    buf.writeUInt8(0x00, 3);
    buf.writeUInt8(0x00, 4);
    buf.writeUInt16LE(cls, 5);
    buf.writeUInt8(0x00, 7);
    this.chunks.push(buf);
    return this;
  }

  /** Element id the next `element()` call will use. */
  peekNextId(): number {
    return this.nextElementId;
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export interface FixtureColumn {
  folderName?: string;
  folderLabel?: string;
  itemName?: string;
  itemLabel?: string;
  heading?: string;
  formatMask?: string;
  /** Emit the column over a calculation element rather than an item reference. */
  calculation?: boolean;
  /**
   * Token-form formula for a `calculation` column. Without one the element is
   * a calculation the parser cannot read, and so produces no calculated field
   * — which is a real shape, but not the one most tests want.
   */
  formula?: string;
  /** EUL `EXP_ID` to stamp on the column's own item element. */
  sourceId?: number;
  /**
   * Reference a shared item declared in `FixtureWorkbook.items` by label,
   * instead of writing a fresh item element. This is how a real workbook
   * records every use of an item after the first — the column carries only the
   * reference — so it is the case that matters most.
   */
  item?: string;

  // --- worksheet model ----------------------------------------------------

  /** `0x02be`: 0 axis, 1 measure, 2 page. */
  axisType?: number;
  /** `0x0642` on the data format: 1 text, 2 number, 4 date. */
  dataType?: number;
  /** `0x07e4` on the data font. */
  displayWidth?: number;
  /** `0x0643` on the data format. */
  alignment?: number;
  /** `0x0645` on the data format. */
  wordWrap?: boolean;
  /** Mask on the heading's own format block. */
  headingFormatMask?: string;
  /**
   * Put an untypeable record inside this column's data font element, so the
   * element cannot be framed and the parser has to fall back to the
   * resynchronizing scan for it.
   */
  unframableFont?: boolean;
}

/** One sort, written both query-side (`0x00f0`) and layout-side (`0x0514`). */
export interface FixtureSort {
  /**
   * `itemLabel` of a shared item, or of a column's own item or calculation.
   * A shared item wins a label collision.
   */
  item: string;
  /** `Direction`: 1 ascending, 2 descending. Default 1. */
  direction?: number;
  /** `0x0516` on the layout entry. Defaults to `direction === 2`. */
  descending?: boolean;
  /** Emit a group/break block (`0x05dc`) and point the entry at it. */
  grouped?: boolean;
}

/** One total row. A bare string is shorthand for `{ label }`. */
export interface FixtureTotal {
  label: string;
  /** `0x0c1d` — `EDCBAggregateType`. 1 is the only established code (SUM). */
  functionCode?: number;
  /** `0x0c20` — `EDCBAggregateLocation`. 1 at-change, 3 and 6 grand total. */
  placementCode?: number;
  /** 0-based index of the column totalled (`0x0c22`, `GetMeasureItem`). */
  column?: number;
  /**
   * 0-based index of the column whose change breaks a subtotal (`0x0c23`,
   * `GetPlacementItem`). Pass `-1` to write an explicit `0`, which is how the
   * source says "no break column".
   */
  breakColumn?: number;
  /** `0x0c1e` / `0x0c1f` — the style elements the total points at. */
  dataStyleRef?: number;
  headingStyleRef?: number;
  /** `0x0c24`–`0x0c28`, in that order. Skip one by leaving a hole. */
  flags?: Array<number | undefined>;
}

/**
 * A condition's token tree, described symbolically.
 *
 * Element ids are assigned as the fixture is written, so a test cannot know
 * them in advance; naming the item and the parameter keeps the fixture
 * readable and the ids correct. Nest `args` to build a compound:
 *
 * ```ts
 *   { operatorCode: 98, args: [                      // AND
 *       { operatorCode: 86, item: 'Amount', literals: ['0'] },
 *       { operatorCode: 87, item: 'Region', parameter: 'Region' },
 *   ] }
 * ```
 */
export interface FixtureConditionNode {
  /** Written verbatim when given; otherwise built from the fields below. */
  tokens?: string;
  /** Operator or function code — `EUL_FUNCTIONS.FUN_ID`. 81 is `=`, 98 `AND`. */
  operatorCode?: number;
  /** `itemLabel` of a shared item, emitted as `[6,n]`. */
  item?: string;
  /** Name of a parameter, emitted as `[8,n]`. */
  parameter?: string;
  /** Names of further parameters, for a `BETWEEN` over two prompts. */
  parameters?: string[];
  /** Literal operands. Strings are `[5,1,…]`; pass `literalKind` for others. */
  literals?: string[];
  /** Literal kind: 1 string (default), 2 number, 4 date. */
  literalKind?: number;
  /** Sub-expressions, for a compound condition or a function on either side. */
  args?: FixtureConditionNode[];
}

export interface FixtureWorksheet {
  name: string;
  title?: string;
  /** The same printed title as RTF and as an HTML fragment. */
  titleRtf?: string;
  titleHtml?: string;
  guid?: string;
  columns?: FixtureColumn[];
  totals?: Array<string | FixtureTotal>;

  // --- worksheet model ----------------------------------------------------

  /** Which view element the worksheet points at. Default `'TABLE'`. */
  viewType?: 'TABLE' | 'CROSSTAB';
  /** `Distinct` on the worksheet's query request. */
  distinct?: boolean;
  /** Sorts the query applies, in query order. */
  sorts?: FixtureSort[];
  /**
   * Items the query names but no column displays. A bare string is an axis
   * item; pass `{ item, axis: 'MEASURE' }` to put one in the measure list
   * instead.
   */
  hiddenItems?: Array<string | { item: string; axis?: 'AXIS' | 'MEASURE' }>;
  /** Names of joins (see `FixtureWorkbook.joins`) the query forces. */
  joins?: string[];
  /** Parameter values saved with the worksheet, by parameter name. */
  parameterValues?: Array<{ parameter: string; values: string[] }>;
  /**
   * Write the worksheet's columns, but no layout element and no view element,
   * so the worksheet element names neither.
   *
   * The query request is still written and is still unreachable — the layout
   * is what links it — which is the stronger test: a worksheet whose layout
   * did not decode must not pick up a query request by position. This is the
   * case that has to migrate exactly as it did before §7.8: a table, no
   * `DISTINCT`, no axis on any column and no hidden items.
   */
  undecodableLayout?: boolean;
}

export interface FixtureWorkbook {
  name?: string;
  eulOwner?: string;
  eulName?: string;
  worksheets?: FixtureWorksheet[];
  /**
   * Item references defined in the shared section, before the worksheets.
   * A real workbook defines every item it uses here and repeats the reference
   * inside each worksheet's layout; conditions point at *these* ids, which is
   * why they have to exist before a condition can be written.
   */
  items?: Array<{
    folderName?: string;
    folderLabel?: string;
    itemName?: string;
    itemLabel: string;
    /** EUL `EXPRESSIONS.EXP_ID`. */
    sourceId?: number;
  }>;
  conditions?: Array<
    FixtureConditionNode & {
      sql?: string;
      name?: string;
      identifier?: string;
      /** The condition's own synthetic id — negative on a private filter. */
      sourceId?: number;
      caseSensitive?: boolean;
    }
  >;
  parameters?: Array<{
    name: string;
    prompt?: string;
    description?: string;
    defaultValue?: string;
    identifier?: string;
    /** `itemLabel` of the item the parameter is bound to. */
    item?: string;
  }>;
  calculations?: Array<{
    name: string;
    formula?: string;
    identifier?: string;
    description?: string;
    /** `DataType`: 1 text, 2 number, 4 date. */
    dataType?: number;
    /** `Placement`: 0 not placed, 1 measure, 2 axis. */
    placement?: number;
    hidden?: boolean;
    isACalc?: boolean;
    formatMask?: string;
    /** `itemLabel`s the formula references, in first-use order. */
    itemRefs?: string[];
  }>;
  /** EUL joins the workbook forces, referenced from a worksheet by `name`. */
  joins?: Array<{
    name: string;
    identifier?: string;
    sourceId?: number;
    owningFolderName?: string;
    owningFolderIdentifier?: string;
  }>;
  /** References to shared EUL filters (`0x00f9`). */
  eulFilters?: Array<{
    name: string;
    identifier?: string;
    sourceId?: number;
    folderName?: string;
    folderIdentifier?: string;
  }>;
  /** Page setup, in tag order — six texts, six margins. */
  pageSetup?: { texts?: Array<string | null>; margins?: Array<number | null> };
  functionNames?: string[];
}

/**
 * Build a complete workbook body.
 *
 * The element order mirrors a real workbook: identity and header first, then
 * the shared definitions (conditions, parameters, calculations, functions),
 * then each worksheet's column groups followed by the worksheet element that
 * closes its section.
 */
/**
 * Assemble a condition's token tree from a symbolic description.
 *
 * Operands are emitted in the order Discoverer writes them — item, then
 * parameters, then literals, then any nested sub-expression — so a fixture
 * exercises the same byte sequence the parser meets on a real workbook.
 */
function buildConditionTokens(
  condition: FixtureConditionNode,
  itemIds: Map<string, number>,
  parameterIds: Map<string, number>,
): string | null {
  if (condition.tokens !== undefined) return condition.tokens;
  if (condition.operatorCode === undefined) return null;

  const operands: string[] = [];
  if (condition.item !== undefined) {
    const id = itemIds.get(condition.item);
    if (id === undefined) {
      throw new Error(`fixture condition references unknown item "${condition.item}"`);
    }
    operands.push(`[6,${id}]`);
  }
  for (const name of [
    ...(condition.parameter !== undefined ? [condition.parameter] : []),
    ...(condition.parameters ?? []),
  ]) {
    const id = parameterIds.get(name);
    if (id === undefined) {
      throw new Error(`fixture condition references unknown parameter "${name}"`);
    }
    operands.push(`[8,${id}]`);
  }
  const literalKind = condition.literalKind ?? 1;
  for (const literal of condition.literals ?? []) {
    operands.push(`[5,${literalKind},"${literal}"]`);
  }
  for (const arg of condition.args ?? []) {
    const nested = buildConditionTokens(arg, itemIds, parameterIds);
    if (nested === null) throw new Error('fixture condition argument has no operator code');
    operands.push(nested);
  }

  // Zero-argument codes (SYSDATE, NULL) are written with an empty list, which
  // is how a real workbook records them.
  return `[1,${condition.operatorCode}](${operands.join(',')})`;
}

export function buildWorkbookFixture(spec: FixtureWorkbook = {}): Buffer {
  const b = new WorkbookFixtureBuilder();

  b.element(FIXTURE_CLASS.EUL_IDENTITY)
    .string(FIXTURE_TAG.EUL_OWNER, spec.eulOwner ?? 'EUL_OWNER')
    .string(FIXTURE_TAG.EUL_NAME, spec.eulName ?? 'EUL')
    .end(FIXTURE_CLASS.EUL_IDENTITY);

  b.element(FIXTURE_CLASS.WORKBOOK)
    .string(FIXTURE_TAG.NLS, 'PORTUGUESE_PORTUGAL.WE8ISO8859P1')
    .string(FIXTURE_TAG.DISCOVERER_VERSION, '4.1')
    .string(FIXTURE_TAG.WORKBOOK_NAME, spec.name ?? 'WB')
    .opaque()
    .end(FIXTURE_CLASS.WORKBOOK);

  for (const fn of spec.functionNames ?? []) {
    b.element(FIXTURE_CLASS.FUNCTION).string(FIXTURE_TAG.FUNCTION_NAME, fn);
  }

  // Shared item definitions, remembered by label so a condition can reference
  // them by name instead of by a hand-counted element id.
  const itemIds = new Map<string, number>();
  for (const item of spec.items ?? []) {
    itemIds.set(item.itemLabel, b.peekNextId());
    b.element(FIXTURE_CLASS.ITEM_REF);
    if (item.sourceId !== undefined) {
      b.int32(FIXTURE_NUMBER.ITEM_SOURCE_ID.type, FIXTURE_NUMBER.ITEM_SOURCE_ID.tag, item.sourceId);
    }
    b.string(FIXTURE_TAG.ITEM_NAME, item.itemName ?? item.itemLabel.toUpperCase())
      .string(FIXTURE_TAG.ITEM_LABEL, item.itemLabel)
      .string(FIXTURE_TAG.FOLDER_NAME, item.folderName ?? 'FOLDER')
      .string(FIXTURE_TAG.FOLDER_LABEL, item.folderLabel ?? 'Folder');
  }

  const parameterIds = new Map<string, number>();
  for (const parameter of spec.parameters ?? []) {
    parameterIds.set(parameter.name, b.peekNextId());
    b.element(FIXTURE_CLASS.PARAMETER).string(FIXTURE_TAG.PARAMETER_NAME, parameter.name);
    if (parameter.description !== undefined) {
      b.string(FIXTURE_TAG.PARAMETER_DESCRIPTION, parameter.description);
    }
    if (parameter.prompt !== undefined) b.string(FIXTURE_TAG.PARAMETER_PROMPT, parameter.prompt);
    if (parameter.defaultValue !== undefined) {
      b.string(FIXTURE_TAG.PARAMETER_DEFAULT, parameter.defaultValue);
    }
    if (parameter.identifier !== undefined) {
      b.string(FIXTURE_TAG.PARAMETER_IDENTIFIER, parameter.identifier);
    }
    if (parameter.item !== undefined) {
      const id = itemIds.get(parameter.item);
      if (id === undefined) {
        throw new Error(`fixture parameter references unknown item "${parameter.item}"`);
      }
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.PARAMETER_ITEM_REF, id);
    }
  }

  // Joins the workbook forces, remembered by name so a worksheet can reference
  // them the way its query request does.
  const joinIds = new Map<string, number>();
  for (const join of spec.joins ?? []) {
    joinIds.set(join.name, b.peekNextId());
    b.element(FIXTURE_CLASS.JOIN_REF)
      .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.JOIN_SOURCE_ID, join.sourceId ?? 0)
      .string(FIXTURE_TAG.JOIN_NAME, join.name)
      .string(FIXTURE_TAG.JOIN_IDENTIFIER, join.identifier ?? join.name.toUpperCase())
      .string(FIXTURE_TAG.JOIN_FOLDER_LABEL, join.owningFolderName ?? 'Folder')
      .string(FIXTURE_TAG.JOIN_FOLDER_NAME, join.owningFolderIdentifier ?? 'FOLDER');
  }

  for (const filter of spec.eulFilters ?? []) {
    b.element(FIXTURE_CLASS.EUL_FILTER_REF)
      .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FILTER_SOURCE_ID, filter.sourceId ?? 0)
      .string(FIXTURE_TAG.CONDITION_IDENTIFIER, filter.identifier ?? filter.name.toUpperCase())
      .string(FIXTURE_TAG.CONDITION_SQL, filter.name)
      .string(FIXTURE_TAG.FILTER_FOLDER_NAME, filter.folderIdentifier ?? 'FOLDER')
      .string(FIXTURE_TAG.FILTER_FOLDER_LABEL, filter.folderName ?? 'Folder');
  }

  if (spec.pageSetup !== undefined) {
    b.element(FIXTURE_CLASS.PAGE_SETUP);
    (spec.pageSetup.texts ?? []).forEach((text, index) => {
      if (text !== null) b.string(FIXTURE_TAG.PAGE_TEXT_FIRST + index, text);
    });
    (spec.pageSetup.margins ?? []).forEach((margin, index) => {
      if (margin !== null) {
        b.number(FIXTURE_TYPE.FLOAT32, FIXTURE_TAG.PAGE_MARGIN_FIRST + index, margin);
      }
    });
  }

  const conditionElementIds: number[] = [];
  for (const condition of spec.conditions ?? []) {
    conditionElementIds.push(b.peekNextId());
    b.element(FIXTURE_CLASS.CONDITION);
    if (condition.sourceId !== undefined) {
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FILTER_SOURCE_ID, condition.sourceId);
    }
    if (condition.identifier !== undefined) {
      b.string(FIXTURE_TAG.CONDITION_IDENTIFIER, condition.identifier);
    }
    if (condition.sql !== undefined) b.string(FIXTURE_TAG.CONDITION_SQL, condition.sql);
    if (condition.name !== undefined) b.string(FIXTURE_TAG.CONDITION_NAME, condition.name);
    const tokens = buildConditionTokens(condition, itemIds, parameterIds);
    if (tokens !== null) b.string(FIXTURE_TAG.CONDITION_TOKENS, tokens);
    if (condition.caseSensitive !== undefined) {
      b.number(
        FIXTURE_TYPE.UINT8_ALT,
        FIXTURE_TAG.CONDITION_CASE_SENSITIVE,
        condition.caseSensitive ? 1 : 0,
      );
    }
  }

  for (const calculation of spec.calculations ?? []) {
    b.element(FIXTURE_CLASS.CALCULATION).string(FIXTURE_TAG.ITEM_LABEL, calculation.name);
    if (calculation.identifier !== undefined) {
      b.string(FIXTURE_TAG.CALC_IDENTIFIER, calculation.identifier);
    }
    if (calculation.description !== undefined) {
      b.string(FIXTURE_TAG.CALC_DESCRIPTION, calculation.description);
    }
    if (calculation.dataType !== undefined) {
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.CALC_DATA_TYPE, calculation.dataType);
    }
    if (calculation.placement !== undefined) {
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.CALC_PLACEMENT, calculation.placement);
    }
    if (calculation.hidden !== undefined) {
      b.number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.CALC_HIDDEN, calculation.hidden ? 1 : 0);
    }
    if (calculation.isACalc !== undefined) {
      b.number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.CALC_IS_A_CALC, calculation.isACalc ? 1 : 0);
    }
    if (calculation.formatMask !== undefined) {
      b.string(FIXTURE_TAG.CALC_FORMAT_MASK, calculation.formatMask);
    }
    if (calculation.itemRefs !== undefined) {
      b.vector(
        FIXTURE_TYPE.INT32_ALT,
        FIXTURE_TAG.CALC_ITEM_REFS,
        calculation.itemRefs.map((label) => {
          const id = itemIds.get(label);
          if (id === undefined) {
            throw new Error(`fixture calculation references unknown item "${label}"`);
          }
          return id;
        }),
      );
    }
    if (calculation.formula !== undefined) {
      b.string(FIXTURE_TAG.CALC_FORMULA, calculation.formula);
    }
  }

  let columnRef = 1;
  for (const worksheet of spec.worksheets ?? []) {
    const columnIds: number[] = [];
    const axisItemIds: number[] = [];
    const measureItemIds: number[] = [];
    /**
     * Element ids a sort of *this* worksheet may name: the shared items, plus
     * the item or calculation element a column writes for itself. A real
     * workbook's sort points straight at the element the column shows —
     * including a calculation, which 183 of the 3 782 sorts in Oracle's dumps
     * of the corpus do — so a fixture has to be able to say that too. The
     * shared items win a label collision, keeping every existing fixture's
     * meaning unchanged.
     */
    const sortableIds = new Map(itemIds);

    for (const column of worksheet.columns ?? []) {
      // A column that names a shared item writes no item element of its own —
      // only the reference, resolved when the column element is emitted below.
      let itemElementId: number | null = null;
      if (column.item !== undefined) {
        const id = itemIds.get(column.item);
        if (id === undefined) {
          throw new Error(`fixture column references unknown item "${column.item}"`);
        }
        itemElementId = id;
      } else if (column.calculation) {
        itemElementId = b.peekNextId();
        b.element(FIXTURE_CLASS.CALCULATION)
          .string(FIXTURE_TAG.ITEM_LABEL, column.itemLabel ?? 'Calc')
          .string(FIXTURE_TAG.ITEM_NAME, String(200 + columnRef));
        if (column.formula !== undefined) {
          b.string(FIXTURE_TAG.CALC_FORMULA, column.formula);
        }
      } else {
        itemElementId = b.peekNextId();
        b.element(FIXTURE_CLASS.ITEM_REF);
        if (column.sourceId !== undefined) {
          b.int32(
            FIXTURE_NUMBER.ITEM_SOURCE_ID.type,
            FIXTURE_NUMBER.ITEM_SOURCE_ID.tag,
            column.sourceId,
          );
        }
        b.string(FIXTURE_TAG.ITEM_NAME, column.itemName ?? 'ITEM')
          .string(FIXTURE_TAG.ITEM_LABEL, column.itemLabel ?? 'Item')
          .string(FIXTURE_TAG.FOLDER_NAME, column.folderName ?? 'FOLDER')
          .string(FIXTURE_TAG.FOLDER_LABEL, column.folderLabel ?? 'Folder');
      }
      if (itemElementId !== null) {
        (column.axisType === 1 ? measureItemIds : axisItemIds).push(itemElementId);
        if (column.itemLabel !== undefined && !sortableIds.has(column.itemLabel)) {
          sortableIds.set(column.itemLabel, itemElementId);
        }
      }

      // The real style chain, in the order a real workbook writes it: format,
      // font, cell style — twice, once for the data and once for the heading.
      // The font points back at its format and the style at its font, which is
      // how the parser resolves a column's mask exactly rather than by
      // position; both are emitted so both rules stay under test.
      const dataFormatId = b.peekNextId();
      b.element(FIXTURE_CLASS.FORMAT)
        .string(FIXTURE_TAG.FORMAT_DISPLAY, column.formatMask ?? '')
        .string(FIXTURE_TAG.FORMAT_STORAGE, '')
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FORMAT_DATA_TYPE, column.dataType ?? 0)
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FORMAT_ALIGNMENT, column.alignment ?? 1)
        .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.FORMAT_WORD_WRAP, column.wordWrap ? 1 : 0);
      const dataFontId = b.peekNextId();
      b.element(FIXTURE_CLASS.FONT).string(FIXTURE_TAG.FONT_NAME, 'Arial');
      if (column.unframableFont) b.opaque();
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FONT_DISPLAY_WIDTH, column.displayWidth ?? 0)
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FONT_ROLE, 1)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.FONT_FORMAT_REF, dataFormatId);
      const dataStyleId = b.peekNextId();
      b.element(FIXTURE_CLASS.CELL_STYLE).number(
        FIXTURE_TYPE.INT32_ALT,
        FIXTURE_TAG.STYLE_FONT_REF,
        dataFontId,
      );

      const headingFormatId = b.peekNextId();
      b.element(FIXTURE_CLASS.FORMAT)
        .string(FIXTURE_TAG.FORMAT_DISPLAY, column.headingFormatMask ?? 'HEADINGMASK')
        .string(FIXTURE_TAG.FORMAT_STORAGE, '');
      const headingFontId = b.peekNextId();
      b.element(FIXTURE_CLASS.FONT)
        .string(FIXTURE_TAG.FONT_NAME, 'Arial')
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FONT_ROLE, 2)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.FONT_FORMAT_REF, headingFormatId);
      const headingStyleId = b.peekNextId();
      b.element(FIXTURE_CLASS.CELL_STYLE).number(
        FIXTURE_TYPE.INT32_ALT,
        FIXTURE_TAG.STYLE_FONT_REF,
        headingFontId,
      );

      columnIds.push(b.peekNextId());
      b.element(FIXTURE_CLASS.COLUMN);
      if (column.heading !== undefined) b.string(FIXTURE_TAG.COLUMN_HEADING, column.heading);
      b.string(FIXTURE_TAG.COLUMN_REF, String(columnRef));
      if (itemElementId !== null) {
        b.int32(
          FIXTURE_NUMBER.COLUMN_ITEM_REF.type,
          FIXTURE_NUMBER.COLUMN_ITEM_REF.tag,
          itemElementId,
        );
      }
      b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.COLUMN_AXIS_TYPE, column.axisType ?? 0)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.COLUMN_DATA_STYLE_REF, dataStyleId)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.COLUMN_HEADING_STYLE_REF, headingStyleId);
      columnRef += 1;
    }

    // Items the query names but no column displays — what makes `d4wkdmp`'s
    // sheet `Items :-` list a superset of the layout's columns.
    for (const entry of worksheet.hiddenItems ?? []) {
      const hidden = typeof entry === 'string' ? { item: entry, axis: 'AXIS' as const } : entry;
      const id = itemIds.get(hidden.item);
      if (id === undefined) {
        throw new Error(`fixture worksheet references unknown item "${hidden.item}"`);
      }
      (hidden.axis === 'MEASURE' ? measureItemIds : axisItemIds).push(id);
    }

    // --- sorts: the layout entry first, then the query-side element ---------
    const sortEntryIds: number[] = [];
    const sortIds: number[] = [];
    for (const sort of worksheet.sorts ?? []) {
      const sortItemId = sortableIds.get(sort.item);
      if (sortItemId === undefined) {
        throw new Error(`fixture sort references unknown item "${sort.item}"`);
      }
      let groupId = 0;
      if (sort.grouped) {
        groupId = b.peekNextId();
        b.element(FIXTURE_CLASS.SORT_GROUP);
      }
      const direction = sort.direction ?? 1;
      sortEntryIds.push(b.peekNextId());
      b.element(FIXTURE_CLASS.SORT_ENTRY)
        .number(
          FIXTURE_TYPE.INT32,
          FIXTURE_TAG.SORT_ENTRY_DESCENDING,
          (sort.descending ?? direction === 2) ? 1 : 0,
        )
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.SORT_ENTRY_ITEM_REF, sortItemId)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.SORT_ENTRY_GROUP_REF, groupId)
        .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.SORT_ENTRY_FLAG_0519, 0)
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.SORT_ENTRY_FLAG_051A, 0);
    }
    let sortListId = 0;
    if (sortEntryIds.length > 0) {
      sortListId = b.peekNextId();
      b.element(FIXTURE_CLASS.SORT_LIST).refVector(FIXTURE_TAG.SORT_LIST_ENTRIES, sortEntryIds);
    }
    for (const sort of worksheet.sorts ?? []) {
      sortIds.push(b.peekNextId());
      b.element(FIXTURE_CLASS.SORT)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.SORT_ITEM_REF, sortableIds.get(sort.item)!)
        .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.SORT_DIRECTION, sort.direction ?? 1);
    }

    // --- parameter values saved with the worksheet --------------------------
    const parameterValueIds: number[] = [];
    for (const saved of worksheet.parameterValues ?? []) {
      const parameterId = parameterIds.get(saved.parameter);
      if (parameterId === undefined) {
        throw new Error(`fixture references unknown parameter "${saved.parameter}"`);
      }
      parameterValueIds.push(b.peekNextId());
      b.element(FIXTURE_CLASS.PARAMETER_VALUE)
        .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.PARAMETER_VALUE_REF, parameterId)
        .blobVector(
          FIXTURE_TAG.PARAMETER_VALUE_DATA,
          saved.values.map((value) => ({
            subtype: 1,
            bytes: Buffer.concat([Buffer.from(value, 'latin1'), Buffer.from([0])]),
          })),
        );
    }

    // --- the query request, and the link the layout follows to reach it -----
    const joinElementIds = (worksheet.joins ?? []).map((joinName) => {
      const id = joinIds.get(joinName);
      if (id === undefined) {
        throw new Error(`fixture worksheet references unknown join "${joinName}"`);
      }
      return id;
    });
    const queryId = b.peekNextId();
    b.element(FIXTURE_CLASS.QUERY_REQUEST)
      .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.QUERY_DISTINCT, worksheet.distinct ? 1 : 0)
      .refVector(FIXTURE_TAG.QUERY_AXIS_ITEMS, axisItemIds)
      .refVector(FIXTURE_TAG.QUERY_MEASURE_ITEMS, measureItemIds)
      .refVector(FIXTURE_TAG.QUERY_SORTS, sortIds)
      .refVector(FIXTURE_TAG.QUERY_FILTERS, conditionElementIds)
      .refVector(FIXTURE_TAG.QUERY_JOINS, joinElementIds);
    const queryLinkId = b.peekNextId();
    b.element(FIXTURE_CLASS.QUERY_LINK).ref(FIXTURE_TAG.QUERY_LINK_REF, queryId);

    // --- totals -------------------------------------------------------------
    const totalIds: number[] = [];
    for (const entry of worksheet.totals ?? []) {
      const total: FixtureTotal = typeof entry === 'string' ? { label: entry } : entry;
      totalIds.push(b.peekNextId());
      b.element(FIXTURE_CLASS.TOTAL).string(FIXTURE_TAG.TOTAL_LABEL, total.label);
      if (total.functionCode !== undefined) {
        b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.TOTAL_FUNCTION, total.functionCode);
      }
      if (total.placementCode !== undefined) {
        b.number(FIXTURE_TYPE.INT32, FIXTURE_TAG.TOTAL_PLACEMENT, total.placementCode);
      }
      if (total.column !== undefined) {
        b.number(
          FIXTURE_TYPE.INT32_ALT,
          FIXTURE_TAG.TOTAL_COLUMN_REF,
          columnIds[total.column] ?? 0,
        );
      }
      if (total.breakColumn !== undefined) {
        b.number(
          FIXTURE_TYPE.INT32_ALT,
          FIXTURE_TAG.TOTAL_BREAK_COLUMN_REF,
          total.breakColumn < 0 ? 0 : (columnIds[total.breakColumn] ?? 0),
        );
      }
      if (total.dataStyleRef !== undefined) {
        b.number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.TOTAL_DATA_STYLE_REF, total.dataStyleRef);
      }
      if (total.headingStyleRef !== undefined) {
        b.number(
          FIXTURE_TYPE.INT32_ALT,
          FIXTURE_TAG.TOTAL_HEADING_STYLE_REF,
          total.headingStyleRef,
        );
      }
      (total.flags ?? []).forEach((flag, offset) => {
        if (flag === undefined) return;
        const tag = FIXTURE_TAG.TOTAL_FLAG_FIRST + offset;
        if (tag > FIXTURE_TAG.TOTAL_FLAG_LAST) return;
        b.number(FIXTURE_TYPE.UINT8_ALT, tag, flag);
      });
    }

    // --- the layout, the view, then the worksheet that closes the section ---
    //
    // A worksheet whose layout cannot be decoded writes neither: its element
    // names no layout and no view, so nothing downstream may infer an axis, a
    // view type or a `DISTINCT` for it — the query request written above stays
    // in the stream, unreachable.
    if (worksheet.undecodableLayout) {
      b.element(FIXTURE_CLASS.WORKSHEET).string(FIXTURE_TAG.WORKSHEET_NAME, worksheet.name);
      if (worksheet.guid !== undefined) b.string(FIXTURE_TAG.WORKSHEET_GUID, worksheet.guid);
      if (worksheet.title !== undefined) b.string(FIXTURE_TAG.WORKSHEET_TITLE, worksheet.title);
      if (worksheet.titleRtf !== undefined)
        b.string(FIXTURE_TAG.WORKSHEET_TITLE_RTF, worksheet.titleRtf);
      if (worksheet.titleHtml !== undefined)
        b.string(FIXTURE_TAG.WORKSHEET_TITLE_HTML, worksheet.titleHtml);
      b.end(FIXTURE_CLASS.WORKSHEET);
      continue;
    }

    const layoutId = b.peekNextId();
    b.element(FIXTURE_CLASS.SHEET_LAYOUT).refVector(FIXTURE_TAG.LAYOUT_COLUMNS, columnIds);
    if (sortListId !== 0) {
      b.number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.LAYOUT_SORT_LIST_REF, sortListId);
    }
    b.refVector(FIXTURE_TAG.LAYOUT_FILTERS, conditionElementIds)
      .refVector(FIXTURE_TAG.LAYOUT_TOTALS, totalIds)
      .refVector(FIXTURE_TAG.LAYOUT_PARAMETER_VALUES, parameterValueIds)
      .vector(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.LAYOUT_QUERY_LINKS, [queryLinkId]);

    const viewId = b.peekNextId();
    b.element(
      worksheet.viewType === 'CROSSTAB' ? FIXTURE_CLASS.VIEW_CROSSTAB : FIXTURE_CLASS.VIEW_TABLE,
    );

    b.element(FIXTURE_CLASS.WORKSHEET).string(FIXTURE_TAG.WORKSHEET_NAME, worksheet.name);
    if (worksheet.guid !== undefined) b.string(FIXTURE_TAG.WORKSHEET_GUID, worksheet.guid);
    if (worksheet.title !== undefined) b.string(FIXTURE_TAG.WORKSHEET_TITLE, worksheet.title);
    if (worksheet.titleRtf !== undefined)
      b.string(FIXTURE_TAG.WORKSHEET_TITLE_RTF, worksheet.titleRtf);
    if (worksheet.titleHtml !== undefined)
      b.string(FIXTURE_TAG.WORKSHEET_TITLE_HTML, worksheet.titleHtml);
    b.number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_LAYOUT_REF, layoutId)
      .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_VIEW_REF, viewId)
      .end(FIXTURE_CLASS.WORKSHEET);
  }

  return b.build();
}
