/**
 * Parser for the Discoverer workbook body — `EUL*_DOCUMENTS.DOC_DOCUMENT`.
 *
 * ## What this is
 *
 * A Discoverer workbook (the thing an end user calls "um mapa" / a report) is
 * NOT stored relationally. `DOCUMENTS` holds only the metadata; the workbook
 * itself is a single proprietary binary in `DOC_DOCUMENT`, a `LONG RAW` whose
 * byte length is repeated in `DOC_LENGTH` and whose media type is stamped in
 * `DOC_CONTENT_TYPE` (`application/vnd.oracle-disco.wb`). It is the same
 * payload a `.DIS` file on disk carries.
 *
 * Everything a worksheet displays — its columns, headings, format masks,
 * conditions, parameters and calculations — lives ONLY in that blob. On the
 * live EUL4 this was verified against: `EXPRESSIONS.IT_DOC_ID` and
 * `FIL_DOC_ID` are null for every row, and `ELEM_XREFS` is empty. So there is
 * no relational shortcut: parse the blob or migrate nothing.
 *
 * ## Container format
 *
 * Oracle never documented it. What follows was derived from 564 real workbooks
 * of a live 4.1 EUL plus Oracle's own three shipped `.DIS` samples, and holds
 * for every one of them.
 *
 * The blob is a flat stream of records. Every record starts with a 4-byte
 * header — `[type:u8][tag:u16 LE][flags:u8]` — followed by a payload whose
 * width the type byte fixes:
 *
 * | type          | payload                                                |
 * | ------------- | ------------------------------------------------------ |
 * | `0x00`        | a structural marker, or a 4-byte **object reference**   |
 * | `0x01`,`0x02` | int32 — also colours and element references            |
 * | `0x03`,`0x04` | int16                                                   |
 * | `0x05`,`0x07` | uint8                                                   |
 * | `0x06`        | IEEE float32                                            |
 * | `0x08`        | counted latin-1 string — u8, escaping to u16 then u32  |
 * | `0x0a`        | `[subtype:u32][len:u32][len bytes]` — dates, literals  |
 *
 * Type `0x00` carries the structure through six reserved tags:
 *
 * - `00 01 00 00` **BEGIN**, followed by `00 <class:u16 LE> 00` and a
 *   `u32 LE` **element id**;
 * - `00 02 00 00` **END**, followed by `00 <class:u16 LE> 00`, closing the body;
 * - `00 0a 00 00` … `00 0b 00 00` bracket a **counted vector**: the single
 *   record between them has a `u16` count before its payload and repeats it;
 * - `00 0c 00 00` … `00 0d 00 00` the same, for a vector whose items repeat
 *   the record header too.
 *
 * Under any **other** tag, type `0x00` is a 4-byte object reference — the
 * element id of another element. That is what turns a flat sequence of elements
 * into the graph the worksheet model lives in.
 *
 * Element ids are assigned **strictly sequentially from 1** across the whole
 * workbook, which is what makes this parser safe: a BEGIN is only honoured
 * when its id is exactly the next one expected. Random bytes inside payloads
 * we do not decode occasionally look like a BEGIN, and that one rule rejects
 * essentially all of them.
 *
 * With those rules, **490 942 of 490 942 element bodies** across the live
 * corpus parse as a complete record sequence, accounting for every byte from a
 * BEGIN to its END. The container is self-describing; it is not, as this file
 * used to say, schema-driven. (`EUL_SCHEMA_GROUND_TRUTH.md` §7.8.1 records
 * what that correction cost: a string length that escapes past one byte, which
 * without it silently dropped every calculation whose formula ran past 254
 * characters — 3 556 of them.)
 *
 * The parser nonetheless **still resynchronizes**. If a body does not frame,
 * it skips one byte at a time from there — recognizing only strings and the
 * `NUMERIC_TAGS` allowlist — until the next BEGIN with the expected id. So a
 * body that cannot be decoded costs that body and nothing else, and no width
 * is ever assumed. `RawElement.framed` says which path an element took.
 *
 * Elements are a flat sequence, not a tree: an element owns the records between
 * its BEGIN and its END. (An END names the *base* class rather than the
 * element's own — `0x0104` parameters close with `0x00dc`, the only class that
 * does — so the class it names is not used for anything.)
 *
 * ## Document layout
 *
 * Elements appear in this order:
 *
 * ```
 *   [0x0064] EUL identity      — owner schema, EUL name
 *   [0x012c] workbook header   — name, Discoverer version, NLS
 *   ... shared definitions: items, calculations, conditions, parameters ...
 *   ... worksheet 1 layout: column groups ...
 *   [0x01f4] worksheet 1       — name, GUID, title
 *   ... worksheet 2 layout ...
 *   [0x01f4] worksheet 2
 * ```
 *
 * A worksheet element comes **after** the layout it describes, so worksheets
 * partition the element stream into sections and section *k* belongs to the
 * *k*-th worksheet element.
 *
 * A displayed column is a group of elements ending in a `0x02bc`:
 *
 * ```
 *   [0x00db] item reference   ← or [0x00dc] calculation; PRESENT ONLY the first
 *                               time this item appears in the layout
 *   [0x0640] format masks     (display / storage)
 *   [0x07d0] font
 *   [0x0320] cell style
 *   [0x0640] [0x07d0] [0x0320]   heading style
 *   [0x02bc] the column       (heading text + the item's element id, 0x02bf)
 * ```
 *
 * The item a column shows is the one its `0x02bf` field names — **not** the
 * most recent item element, which most columns do not have.
 *
 * The worksheet element itself points at a layout (`0x0258`) that names those
 * columns, its totals, its sorts and the query request (`0x0122`) it runs —
 * the whole worksheet model, decoded in `EUL_SCHEMA_GROUND_TRUTH.md` §7.8 and
 * exposed on `ParsedWorksheet`.
 *
 * Conditions and parameters are workbook-scoped: on every workbook examined
 * they sit in the shared section before the first worksheet, and nothing in a
 * worksheet's own section references them. Which worksheet activates which
 * condition is therefore not recoverable — see `parseWorkbookDocument`'s
 * `conditionsAreWorkbookWide` warning.
 *
 * ## EUL5
 *
 * The reference documentation describes the workbook body as "XML", which is
 * true for later Discoverer releases. `parseWorkbookDocument` sniffs the input
 * and falls back to a light XML summary when the payload is text, so an EUL5
 * source that really does store XML still yields worksheet names.
 */

import type { EulVersion } from '../types/eul-versions.js';

// ---------------------------------------------------------------------------
// Record / element primitives
// ---------------------------------------------------------------------------

/** Record type byte for a latin-1 string. */
const TYPE_STRING = 0x08;

/** Record type byte for an opaque payload (`[subtype:u32][len:u32][bytes]`). */
const TYPE_BLOB = 0x0a;

/**
 * Payload width, in bytes, of one value of each fixed-width record type.
 *
 * Type `0x00` is in here at 4 bytes because outside the four structural tags
 * below it carries an **object reference** — the element id of another
 * element — which is how the worksheet model is wired together.
 */
const FIXED_WIDTH: Readonly<Record<number, number>> = {
  0x00: 4, // object reference
  0x01: 4, // int32
  0x02: 4, // int32 / COLORREF
  0x03: 2, // int16
  0x04: 2, // int16
  0x05: 1, // uint8
  0x06: 4, // IEEE float
  0x07: 1, // uint8
};

/** Marker tag that opens an element (`00 01 00 00`). */
const MARKER_BEGIN = 0x0001;

/** Marker tag that closes an element (`00 02 00 00`). */
const MARKER_END = 0x0002;

/**
 * The four structural tags of record type `0x00`. Everything else written
 * with type `0x00` is a 4-byte object reference.
 *
 * A `0x000a`…`0x000b` bracket makes the single record between them a
 * **counted vector**: the record's payload is preceded by a `u16` count and
 * repeats that many times. `0x000c`…`0x000d` is the same idea for a vector
 * whose items are complete records (header included) rather than bare
 * payloads — only `0x0898` (saved parameter values) uses it.
 */
const MARKER_VECTOR_VALUES = 0x000a;
const MARKER_VECTOR_VALUES_END = 0x000b;
const MARKER_VECTOR_RECORDS = 0x000c;
const MARKER_VECTOR_RECORDS_END = 0x000d;

/**
 * Element classes we care about.
 *
 * Exported (along with `TAG` and `RawElement`) purely so
 * `d4wkdmp-differ.ts` — a dev-only verification tool, not part of the
 * migration itself — can read the same raw elements this parser does without
 * duplicating the tag table. Nothing in the actual migration pipeline is
 * affected by this being exported.
 */
export const CLASS = {
  /** EUL identity — owner schema and EUL name. */
  EUL_IDENTITY: 0x0064,
  /** Workbook header — name, versions, NLS. */
  WORKBOOK: 0x012c,
  /** A reference to a real EUL item, by folder + item name. */
  ITEM_REF: 0x00db,
  /** A calculation / derived item defined inside the workbook. */
  CALCULATION: 0x00dc,
  /** A workbook condition (filter). */
  CONDITION: 0x00fa,
  /** A workbook parameter. */
  PARAMETER: 0x0104,
  /** A displayed worksheet column. */
  COLUMN: 0x02bc,
  /** Format masks (display + storage). */
  FORMAT: 0x0640,
  /** A worksheet. */
  WORKSHEET: 0x01f4,
  /** A registered custom (PL/SQL) function the workbook calls. */
  FUNCTION: 0x00d2,
  /** A total / summary row label. */
  TOTAL: 0x0c1c,

  // --- the worksheet model (see `EUL_SCHEMA_GROUND_TRUTH.md` §7.8) ---------

  /** Reference to a shared EUL filter (`d4wkdmp`: `EUL Filter Reference`). */
  EUL_FILTER_REF: 0x00f9,
  /** One sort a query applies (`d4wkdmp`: `EUL Sort Item Reference`). */
  SORT: 0x00f0,
  /** Reference to an EUL join (`d4wkdmp`: `EUL Join Reference`). */
  JOIN_REF: 0x0118,
  /** A query request (`d4wkdmp`: `Query Request QRn`). */
  QUERY_REQUEST: 0x0122,
  /** The document root — page setup and the ordered worksheet list. */
  DOCUMENT: 0x0190,
  /** A worksheet's layout: its columns, totals, filters and query links. */
  SHEET_LAYOUT: 0x0258,
  /** Cell style — binds a column to its font/format block. */
  CELL_STYLE: 0x0320,
  /** Table (non-crosstab) view settings for a worksheet. */
  VIEW_TABLE: 0x0384,
  /** Crosstab view settings for a worksheet. */
  VIEW_CROSSTAB: 0x0385,
  /** The worksheet's ordered sort list — a vector of `SORT_ENTRY`. */
  SORT_LIST: 0x04b0,
  /** One entry of the layout-side sort list. */
  SORT_ENTRY: 0x0514,
  /** Group/break block hanging off a sort entry. */
  SORT_GROUP: 0x05dc,
  /** Style block a `SORT_GROUP` points at. */
  SORT_GROUP_STYLE: 0x0578,
  /** An (item, value) pair — a page-item selection. Unconfirmed; see §7.8. */
  ITEM_VALUE: 0x076c,
  /** List of `ITEM_VALUE`. */
  ITEM_VALUE_LIST: 0x079e,
  /** Font + colours + display width. */
  FONT: 0x07d0,
  /** Page setup / display settings, one per document. */
  PAGE_SETUP: 0x0834,
  /** A saved parameter value. */
  PARAMETER_VALUE: 0x0898,
  /** Links a worksheet layout to the query request it runs. */
  QUERY_LINK: 0x0d48,
  /** Graph container — empty on every workbook of the live corpus. */
  GRAPH: 0x0272,
  /** One `name = value` graph setting. */
  GRAPH_SETTING: 0x026f,
} as const;

/**
 * String tags, named from the values they carry on real workbooks.
 *
 * Two pairs read confusingly and are worth spelling out: `ITEM_NAME` is the
 * EUL identifier (`DT_EMISSAO`) while `ITEM_LABEL` is the user-visible name
 * (`Dt Emissao`) — and it is the *label* that Discoverer Neo stores in
 * `items.name`, so the label is what resolves a reference. On a calculation
 * element the same `ITEM_NAME` tag holds a numeric element id instead of a
 * name, which is how the two element classes are told apart downstream.
 */
export const TAG = {
  EUL_OWNER: 0x0066,
  EUL_NAME: 0x0067,
  NLS: 0x0137,
  DISCOVERER_VERSION: 0x012e,
  WORKBOOK_NAME: 0x0132,
  WORKBOOK_KEY: 0x013b,

  ITEM_NAME: 0x0fa0,
  ITEM_LABEL: 0x00de,
  FOLDER_NAME: 0x0fa1,
  FOLDER_LABEL: 0x00e5,
  CALC_FORMULA: 0x00e0,

  FORMAT_DISPLAY: 0x064a,
  FORMAT_STORAGE: 0x064c,

  COLUMN_HEADING: 0x02c2,
  COLUMN_REF: 0x0fab,

  CONDITION_ID: 0x0fa2,
  CONDITION_SQL: 0x00fc,
  CONDITION_NAME: 0x00fd,
  CONDITION_TOKENS: 0x00ff,

  PARAMETER_ID: 0x0fa4,
  PARAMETER_NAME: 0x0106,
  PARAMETER_DESCRIPTION: 0x0107,
  PARAMETER_PROMPT: 0x0109,
  PARAMETER_DEFAULT: 0x010a,

  WORKSHEET_NAME: 0x01f6,
  WORKSHEET_GUID: 0x0200,
  WORKSHEET_TITLE: 0x01f9,
  /**
   * The same printed title as RTF (`0x0201`) and as an HTML fragment
   * (`0x0205`) — §7.8.4. Discoverer writes all three: the plain text is what a
   * grid heading needs, the other two carry the author's bold/colour/size.
   */
  WORKSHEET_TITLE_RTF: 0x0201,
  WORKSHEET_TITLE_HTML: 0x0205,
  WORKSHEET_REF: 0x0fa9,

  FUNCTION_NAME: 0x0faa,

  TOTAL_LABEL: 0x0c21,

  // --- the worksheet model (see `EUL_SCHEMA_GROUND_TRUTH.md` §7.8) ---------

  /** On a calculation: `Identifier`, `Desc`, `Placement`, `DataType`. */
  CALC_IDENTIFIER: 0x0fa0,
  CALC_DESCRIPTION: 0x00df,
  CALC_PLACEMENT: 0x00e2,
  CALC_DATA_TYPE: 0x00e3,
  /** Items the formula references, in first-appearance order. */
  CALC_ITEM_REFS: 0x00e4,
  CALC_HIDDEN: 0x00e6,
  CALC_IS_A_CALC: 0x00e7,
  CALC_FORMAT_MASK: 0x00e8,

  /** On a condition: `Case Sensitive`, and the items/parameters it binds. */
  CONDITION_CASE_SENSITIVE: 0x0102,
  CONDITION_ITEM_REFS: 0x00e4,
  CONDITION_PARAMETER_REFS: 0x010c,

  /** On an EUL filter reference (`0x00f9`). */
  FILTER_SOURCE_ID: 0x00fb,
  FILTER_FOLDER_NAME: 0x0fa3,
  FILTER_FOLDER_LABEL: 0x00fe,

  /** On a parameter: the item it is bound to. */
  PARAMETER_ITEM_REF: 0x010b,

  /** On a sort (`0x00f0`). */
  SORT_ITEM_REF: 0x00f1,
  SORT_DIRECTION: 0x00f2,

  /** On a layout sort entry (`0x0514`) and its list (`0x04b0`). */
  SORT_ENTRY_DESCENDING: 0x0516,
  SORT_ENTRY_ITEM_REF: 0x0517,
  SORT_ENTRY_GROUP_REF: 0x0518,
  SORT_ENTRY_FLAG_0519: 0x0519,
  SORT_ENTRY_FLAG_051A: 0x051a,
  SORT_LIST_ENTRIES: 0x04b2,

  /** On a join reference (`0x0118`). */
  JOIN_SOURCE_ID: 0x0119,
  JOIN_NAME: 0x011a,
  JOIN_FOLDER_LABEL: 0x011b,
  JOIN_IDENTIFIER: 0x0fa7,
  JOIN_FOLDER_NAME: 0x0fa8,

  /** On a query request (`0x0122`). */
  QUERY_AXIS_ITEMS: 0x0123,
  QUERY_MEASURE_ITEMS: 0x0124,
  QUERY_SORTS: 0x0125,
  QUERY_FILTERS: 0x0126,
  QUERY_JOINS: 0x0127,
  QUERY_DISTINCT: 0x0128,

  /** On the document root (`0x0190`). */
  DOCUMENT_HEADER_REF: 0x0192,
  DOCUMENT_PAGE_SETUP_REF: 0x0194,
  DOCUMENT_WORKSHEETS: 0x01f4,

  /** On a worksheet (`0x01f4`). */
  WORKSHEET_LAYOUT_REF: 0x01f7,
  WORKSHEET_VIEW_REF: 0x01f8,
  WORKSHEET_TITLE_FONT_REF: 0x01fa,

  /** On a worksheet layout (`0x0258`). */
  LAYOUT_COLUMNS: 0x025d,
  LAYOUT_EXTRA_COLUMNS: 0x025f,
  LAYOUT_SORT_LIST_REF: 0x0264,
  LAYOUT_FILTERS: 0x0265,
  LAYOUT_ITEM_VALUE_LIST_REF: 0x0266,
  LAYOUT_TOTALS: 0x0268,
  LAYOUT_PARAMETER_VALUES: 0x026a,
  LAYOUT_QUERY_LINKS: 0x026b,
  LAYOUT_GRAPH_REF: 0x026d,

  /** On a column (`0x02bc`). */
  COLUMN_AXIS_TYPE: 0x02be,
  COLUMN_DATA_STYLE_REF: 0x02c0,
  COLUMN_HEADING_STYLE_REF: 0x02c1,

  /** On a cell style (`0x0320`) — the font block it uses. */
  STYLE_FONT_REF: 0x0322,

  /** On a format block (`0x0640`). */
  FORMAT_DATA_TYPE: 0x0642,
  FORMAT_ALIGNMENT: 0x0643,
  FORMAT_NUMBER_STYLE: 0x0644,
  FORMAT_WORD_WRAP: 0x0645,
  FORMAT_COLOUR: 0x0649,

  /** On a font block (`0x07d0`). */
  FONT_NAME: 0x07df,
  FONT_FOREGROUND: 0x07e0,
  FONT_BACKGROUND: 0x07e1,
  FONT_DISPLAY_WIDTH: 0x07e4,
  FONT_ROLE: 0x07e7,
  FONT_FORMAT_REF: 0x07e8,

  /** On page setup (`0x0834`): six texts, six fonts, six margins. */
  PAGE_TEXT_FIRST: 0x0840,
  PAGE_TEXT_LAST: 0x0845,
  PAGE_FONT_FIRST: 0x083a,
  PAGE_FONT_LAST: 0x083f,
  PAGE_MARGIN_FIRST: 0x0846,
  PAGE_MARGIN_LAST: 0x084b,

  /** On a saved parameter value (`0x0898`). */
  PARAMETER_VALUE_REF: 0x0899,
  PARAMETER_VALUE_DATA: 0x089a,

  /** On a query link (`0x0d48`). */
  QUERY_LINK_REF: 0x0d49,

  /** On a total (`0x0c1c`). */
  TOTAL_FUNCTION: 0x0c1d,
  TOTAL_DATA_STYLE_REF: 0x0c1e,
  TOTAL_HEADING_STYLE_REF: 0x0c1f,
  TOTAL_PLACEMENT: 0x0c20,
  TOTAL_COLUMN_REF: 0x0c22,
  TOTAL_BREAK_COLUMN_REF: 0x0c23,
  /** Unconfirmed numeric flags — §7.8.7 records only how often each is set. */
  TOTAL_FLAG_0C24: 0x0c24,
  TOTAL_FLAG_0C25: 0x0c25,
  TOTAL_FLAG_0C26: 0x0c26,
  TOTAL_FLAG_0C27: 0x0c27,
  TOTAL_FLAG_0C28: 0x0c28,

  /** On an item value (`0x076c`) and its list (`0x079e`). */
  ITEM_VALUE_ITEM_REF: 0x076e,
  ITEM_VALUE_DATA: 0x076f,
  ITEM_VALUE_LIST_ENTRIES: 0x07a0,

  /** On a graph setting (`0x026f`). */
  GRAPH_SETTING_NAME: 0x0270,
  GRAPH_SETTING_VALUE: 0x0271,
} as const;

/** An opaque `0x0a` payload — Oracle dates, GUIDs, typed literals. */
export interface WorkbookBlob {
  /** Payload discriminator Discoverer writes ahead of the bytes. */
  subtype: number;
  bytes: Buffer;
}

/**
 * One decoded record of an element body.
 *
 * `numbers`, `strings` and `blobs` are all present so a caller does not have
 * to switch on `type`; exactly one of them is ever non-empty. A record written
 * as a counted vector has `repeated: true` and as many entries as the vector
 * held — including zero.
 */
export interface WorkbookRecord {
  tag: number;
  /** Record type byte. `0x00` outside the structural tags is a reference. */
  type: number;
  /** True when written inside a `0x000a`/`0x000c` vector bracket. */
  repeated: boolean;
  /** Payload of a fixed-width numeric type. An object reference is a number. */
  numbers: number[];
  /** Payload of a `0x08` string record, latin-1 decoded. */
  strings: string[];
  /** Payload of a `0x0a` record. */
  blobs: WorkbookBlob[];
}

export interface RawElement {
  /** Sequential element id, 1-based, unique within the document. */
  id: number;
  /** Element class (see `CLASS`). */
  cls: number;
  /** Byte offset of the element's BEGIN marker, for diagnostics. */
  offset: number;
  /** Strings carried by this element, in file order. */
  strings: Array<{ tag: number; value: string }>;
  /** 4-byte integer fields — every numeric record when `framed`, else `NUMERIC_TAGS`. */
  numbers: Array<{ tag: number; value: number }>;
  /**
   * Every record of the element body, in file order.
   *
   * Populated only when `framed` is true. On the 567 workbooks this has been
   * run against (564 live + Oracle's three shipped samples) that is every
   * element of every one of them; it is empty on an element whose body could
   * not be framed, where `strings`/`numbers` still carry what the
   * resynchronizing scan recovered.
   */
  records: WorkbookRecord[];
  /**
   * True when the element body parsed as a complete record sequence that
   * closed exactly on the next element.
   */
  framed: boolean;
}

/**
 * Integer fields the **resynchronizing fallback** may read, by tag.
 *
 * This allowlist only applies to an element whose body could not be framed
 * (`RawElement.framed === false`). A framed element yields every field it
 * carries through `records`, at the width the record itself declares, so no
 * allowlist is involved — see `readElementRecords`.
 *
 * The fallback cannot know a record's width, so it notes a candidate and
 * advances a single byte; the allowlist is what keeps the false positives that
 * invites out of the result. Only tags whose record type is `0x01`/`0x02`
 * (4-byte) are listed: reading four bytes where the real record is one or two
 * wide would silently invent a value. The one-byte fields of the worksheet
 * model (`Hidden`, `Distinct`, `Case Sensitive`, …) are therefore *absent*
 * from an unframed element rather than guessed.
 */
const NUMERIC_TAGS: ReadonlySet<number> = new Set([
  // The two that make a workbook resolvable rather than merely readable.
  0x00dd, // item element: EUL `EXPRESSIONS.EXP_ID` (negative on a calculation)
  0x02bf, // column: element id of the item shown

  // Worksheet model, all confirmed 4-byte (see `EUL_SCHEMA_GROUND_TRUTH.md` §7.8).
  0x00e2, // calculation: Placement
  0x00e3, // calculation: DataType
  0x00f1, // sort: item reference
  0x00f2, // sort: Direction
  0x00fb, // filter: EUL filter id / private filter synthetic id
  0x0105, // parameter: synthetic id
  0x010b, // parameter: item reference
  0x0119, // join: EUL `KEY_CONS` id
  0x0192, // document: workbook-header reference
  0x0194, // document: page-setup reference
  0x01f7, // worksheet: layout reference
  0x01f8, // worksheet: view reference
  0x01fa, // worksheet: title-font reference
  0x0264, // layout: sort-list reference
  0x0266, // layout: item-value-list reference
  0x026b, // layout: query-link reference
  0x026d, // layout: graph reference
  0x02be, // column: axis type
  0x02c0, // column: data style reference
  0x02c1, // column: heading style reference
  0x0322, // cell style: font reference
  0x0516, // sort entry: descending flag
  0x0517, // sort entry: item reference
  0x0518, // sort entry: group-block reference
  0x051a, // sort entry: unconfirmed flag
  0x0642, // format: data type
  0x0643, // format: alignment
  0x07e4, // font: display width
  0x07e7, // font: role
  0x07e8, // font: format reference
  0x0899, // parameter value: parameter reference
  0x0c1d, // total: aggregate function
  0x0c1e, // total: data style reference
  0x0c1f, // total: heading style reference
  0x0c20, // total: placement
  0x0c22, // total: column totalled
  0x0c23, // total: break column
  0x076e, // item value: item reference
]);

/** Record types whose payload starts with a 4-byte little-endian integer. */
const NUMERIC_TYPES: ReadonlySet<number> = new Set([0x01, 0x02]);

/**
 * The blob is written by a Windows client in the EUL's own character set
 * (`PORTUGUESE_PORTUGAL.WE8ISO8859P1` on the source this was built against),
 * so bytes ≥ 0x80 are single-byte accented characters, not UTF-8 sequences.
 * latin1 is the decoding that round-trips them.
 */
function decodeString(bytes: Buffer): string {
  return bytes.toString('latin1');
}

/**
 * A string record's payload must look like text before we accept it —
 * otherwise a run of binary bytes that happens to start with `0x08` would be
 * read as a string and swallow the records after it.
 */
function looksLikeText(bytes: Buffer): boolean {
  for (const b of bytes) {
    if (b >= 0x20 && b < 0x7f) continue;
    if (b >= 0xa0) continue; // latin-1 accented range
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    return false;
  }
  return true;
}

/**
 * Read one string record's counted length.
 *
 * Discoverer's `DCWArchive` uses MFC `CArchive`'s convention: a one-byte
 * length, escaping to a `u16` at `0xff` and to a `u32` at `0xffff`. Only the
 * first two occur in the corpus — the longest string seen is a 27 kB
 * calculation formula — but the third costs one line to support and its
 * absence would silently truncate a longer one.
 */
function readStringLength(data: Buffer, at: number): { length: number; dataStart: number } | null {
  if (at >= data.length) return null;
  let p = at;
  let length = data[p]!;
  p += 1;
  if (length === 0xff) {
    if (p + 2 > data.length) return null;
    length = data.readUInt16LE(p);
    p += 2;
    if (length === 0xffff) {
      if (p + 4 > data.length) return null;
      length = data.readUInt32LE(p);
      p += 4;
    }
  }
  return { length, dataStart: p };
}

/**
 * Decode one element body as a complete record sequence, or return null.
 *
 * The container turns out to be **self-describing**: every record's payload
 * width follows from its type byte and — for a counted vector — the `u16` in
 * front of it, with no per-class schema involved. `[body, stop)` either parses
 * as a whole sequence of records or it does not, and this returns null in the
 * second case so the caller can fall back to the resynchronizing scan.
 * Nothing is ever advanced by a width the record did not declare.
 *
 * `stop` is the next element's BEGIN offset (or end of file for the last
 * element). An END record terminates the body: what follows it belongs to the
 * document, not the element, which is how the trailer after the last element
 * is skipped.
 */
function readElementRecords(
  data: Buffer,
  body: number,
  stop: number,
  nextElementId: number,
): { records: WorkbookRecord[]; end: number } | null {
  const records: WorkbookRecord[] = [];
  let i = body;
  let repeated = false;
  let vectorOfRecords = false;

  while (i < stop) {
    if (i + 4 > stop) return null;
    const type = data[i]!;
    const tag = data.readUInt16LE(i + 1);
    let p = i + 4;

    if (type === 0x00) {
      // An END closes the body. Whatever follows belongs to the next element
      // or, after the last one, to the document trailer. A truncated END is
      // not an END: the body would be claiming a record it cannot fit.
      if (tag === MARKER_END) return i + 8 <= stop ? { records, end: i + 8 } : null;
      // A body with no END of its own runs up to the next element's BEGIN.
      if (tag === MARKER_BEGIN) {
        return isElementBegin(data, i, nextElementId) ? { records, end: i } : null;
      }
      if (tag === MARKER_VECTOR_VALUES || tag === MARKER_VECTOR_RECORDS) {
        repeated = true;
        vectorOfRecords = tag === MARKER_VECTOR_RECORDS;
        i = p;
        continue;
      }
      if (tag === MARKER_VECTOR_VALUES_END || tag === MARKER_VECTOR_RECORDS_END) {
        repeated = false;
        vectorOfRecords = false;
        i = p;
        continue;
      }
    }

    let count = 1;
    if (repeated) {
      if (p + 2 > stop) return null;
      count = data.readUInt16LE(p);
      p += 2;
    }

    const record: WorkbookRecord = { tag, type, repeated, numbers: [], strings: [], blobs: [] };

    for (let k = 0; k < count; k += 1) {
      // Inside a `0x000c` vector each item repeats the record header before
      // its payload; inside a `0x000a` vector the payloads are bare.
      if (vectorOfRecords) {
        if (p + 4 > stop) return null;
        p += 4;
      }
      if (type === TYPE_STRING) {
        const header = readStringLength(data, p);
        if (header === null || header.dataStart + header.length > stop) return null;
        record.strings.push(decodeString(data.subarray(header.dataStart, header.dataStart + header.length)));
        p = header.dataStart + header.length;
        continue;
      }
      if (type === TYPE_BLOB) {
        if (p + 8 > stop) return null;
        const subtype = data.readUInt32LE(p);
        const length = data.readUInt32LE(p + 4);
        if (p + 8 + length > stop) return null;
        record.blobs.push({ subtype, bytes: data.subarray(p + 8, p + 8 + length) });
        p = p + 8 + length;
        continue;
      }
      const width = FIXED_WIDTH[type];
      if (width === undefined || p + width > stop) return null;
      record.numbers.push(
        type === 0x06
          ? data.readFloatLE(p)
          : width === 4
            ? data.readInt32LE(p)
            : width === 2
              ? data.readInt16LE(p)
              : data[p]!,
      );
      p += width;
    }

    records.push(record);
    i = p;
  }

  return { records, end: i };
}

/** True when `at` starts a BEGIN marker opening element `expectedId`. */
function isElementBegin(data: Buffer, at: number, expectedId: number): boolean {
  return (
    at + 12 <= data.length &&
    data[at] === 0x00 &&
    data.readUInt16LE(at + 1) === MARKER_BEGIN &&
    data[at + 3] === 0x00 &&
    data[at + 4] === 0x00 &&
    data[at + 7] === 0x00 &&
    data.readUInt32LE(at + 8) === expectedId
  );
}

/** Fill an element's `records`, and derive `strings`/`numbers` from them. */
function applyRecords(element: RawElement, records: WorkbookRecord[]): void {
  element.records = records;
  element.framed = true;
  element.strings = [];
  element.numbers = [];
  for (const record of records) {
    for (const value of record.strings) element.strings.push({ tag: record.tag, value });
    // A vector is not a scalar field: flattening one into `numbers` would make
    // `firstNumber` return an arbitrary member. Vectors are read from
    // `records`; `numbers` stays the scalar view it has always been.
    if (!record.repeated && record.numbers.length === 1) {
      element.numbers.push({ tag: record.tag, value: record.numbers[0]! });
    }
  }
}

/**
 * Walk the blob and return its elements in file order.
 *
 * An element opens at a BEGIN marker whose id is exactly the next one expected
 * — the rule that rejects the byte sequences inside undecoded payloads that
 * occasionally look like markers. From there the body is read as a **record
 * sequence**: every record's width follows from its type byte and, for a
 * counted vector, the `u16` in front of it, so the body either accounts for
 * every byte up to its END and lands on the next element, or it does not.
 *
 * When it does, `records` carries the whole element and the next element's
 * offset is known exactly rather than searched for. When it does not, the
 * parser falls back to **resynchronizing**: from that point it skips a byte at
 * a time, recognizing only strings and the `NUMERIC_TAGS` allowlist, until a
 * BEGIN with the expected id turns up. An undecodable body then costs that body
 * and nothing else — which is the property this parser has always had, and the
 * reason it never advances by a width it is not sure of.
 */
export function readWorkbookElements(data: Buffer): RawElement[] {
  const elements: RawElement[] = [];
  const n = data.length;
  let current: RawElement | null = null;
  let expectedId = 1;
  let i = 0;

  while (i + 4 <= n) {
    const type = data[i]!;

    if (isElementBegin(data, i, expectedId)) {
      current = {
        id: expectedId,
        cls: data.readUInt16LE(i + 5),
        offset: i,
        strings: [],
        numbers: [],
        records: [],
        framed: false,
      };
      elements.push(current);
      expectedId += 1;
      const body = i + 12;
      const framed = readElementRecords(data, body, n, expectedId);
      if (framed !== null) {
        applyRecords(current, framed.records);
        i = framed.end;
      } else {
        i = body;
      }
      continue;
    }

    // --- resynchronizing fallback, for a body that did not frame ------------

    // A named integer field: <type> <tag:u16> 00 <value:u32 LE>.
    //
    // Deliberately advances a single byte rather than the record's width. The
    // payload width is not knowable here — that is exactly what framing gives
    // and this path lacks — so consuming eight bytes could step over the start
    // of a real record; noting the candidate and moving on cannot. The tag
    // allowlist is what keeps the false positives this invites out of the
    // result.
    if (
      NUMERIC_TYPES.has(type) &&
      data[i + 3] === 0x00 &&
      i + 8 <= n &&
      current !== null &&
      !current.framed &&
      NUMERIC_TAGS.has(data.readUInt16LE(i + 1))
    ) {
      // Signed: a workbook calculation carries a NEGATIVE id here (it has no
      // EUL row of its own). Read unsigned, those become values near 2^32 that
      // look like plausible ids and would be carried into the migration as
      // nonsense.
      current.numbers.push({
        tag: data.readUInt16LE(i + 1),
        value: data.readInt32LE(i + 4),
      });
    }

    // String: 08 <tag:u16> <flags> <len:u8> <bytes>
    if (type === TYPE_STRING && data[i + 3] === 0x00 && i + 5 <= n) {
      const length = data[i + 4]!;
      const end = i + 5 + length;
      if (end <= n) {
        const bytes = data.subarray(i + 5, end);
        if (length === 0 || looksLikeText(bytes)) {
          if (current !== null && !current.framed) {
            current.strings.push({ tag: data.readUInt16LE(i + 1), value: decodeString(bytes) });
          }
          i = end;
          continue;
        }
      }
    }

    i += 1;
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Condition token language
// ---------------------------------------------------------------------------

/**
 * Discoverer stores every condition twice: once as the SQL-ish text the user
 * typed (`CONDITION_SQL`) and once as a machine-readable token tree
 * (`CONDITION_TOKENS`):
 *
 * ```
 *   [1,92]([6,28],[8,65],[8,29])       Dt Provisao BETWEEN :Dt Inicio AND :Dt Fim
 *   [1,98]([1,86]([6,30],[8,51]),      DT_ANULACAO >= :"Dt Cancelamento >=" AND
 *          [1,85]([6,30],[8,52]))      DT_ANULACAO <= :"Dt Cancelamento <="
 * ```
 *
 * Only the token form is authoritative. `CONDITION_SQL` is a display string
 * Discoverer cuts at 100 characters — 272 of the source EUL's 3 395 conditions
 * are truncated mid-expression — so it can be shown to a person but never
 * parsed.
 *
 * A node is `[kind,…]`, optionally followed by a parenthesised argument list:
 *
 * | Node | Meaning |
 * | --- | --- |
 * | `[1,n]` | built-in operator or function; `n` is `EUL_FUNCTIONS.FUN_ID` |
 * | `[2,n]` | custom (PL/SQL) function, `n` an element id in this workbook |
 * | `[5,k,"…"]` | literal; `k` is 1 string, 2 number, 4 date |
 * | `[6,n]` | item element `n` |
 * | `[8,n]` | parameter element `n` |
 */

/** The escape character inside a quoted literal. */
const BACKSLASH = String.fromCharCode(0x5c);

/**
 * `EUL_FUNCTIONS.FUN_ID` → the name Discoverer generates SQL with
 * (`FUN_EXT_NAME`), for every built-in of a 4.1 EUL.
 *
 * Recovered from `DISCVR4/DCESQRES.DLL`, which carries the EUL seed script as
 * literal `insert into EUL4_FUNCTIONS (…) VALUES (…)` text, and then checked
 * row for row against the live source's own `EUL4_FUNCTIONS`: identical for
 * all 222 built-ins. Ids above 222 are customer-defined functions, which the
 * token language reaches through `[2,n]` instead — on the live source they
 * start at 112 777.
 *
 * This is the table whose absence the parser used to work around, so the
 * operator codes below are Oracle's own rather than correlated guesses.
 */
export const EUL_FUNCTION_NAMES: Record<number, string> = {
  1: 'SUM', 2: 'CEIL', 3: 'COS', 4: 'COSH', 5: 'EXP', 6: 'FLOOR', 7: 'LN', 8: 'LOG', 9: 'MOD',
  10: 'POWER', 11: 'ROUND', 12: 'SIGN', 13: 'SIN', 14: 'SINH', 15: 'SQRT', 16: 'TAN', 17: 'TANH',
  18: 'TRUNC', 19: 'CHR', 20: 'CONCAT', 21: 'INITCAP', 22: 'LOWER', 23: 'LPAD', 24: 'LTRIM',
  25: 'NLS_INITCAP', 26: 'NLS_LOWER', 27: 'NLS_UPPER', 28: 'REPLACE', 29: 'RPAD', 30: 'RTRIM',
  31: 'SOUNDEX', 32: 'SUBSTR', 33: 'SUBSTRB', 34: 'TRANSLATE', 35: 'UPPER', 36: 'ASCII',
  37: 'INSTR', 38: 'INSTRB', 39: 'LENGTH', 40: 'LENGTHB', 41: 'NLSSORT', 42: 'ADD_MONTHS',
  43: 'LAST_DAY', 44: 'MONTHS_BETWEEN', 45: 'NEW_TIME', 46: 'NEXT_DAY', 47: 'ROUND', 48: 'SYSDATE',
  49: 'TRUNC', 50: 'CHARTOROWID', 51: 'CONVERT', 52: 'HEXTORAW', 53: 'RAWTOHEX',
  54: 'ROWIDTOCHAR', 55: 'TO_CHAR', 56: 'TO_CHAR', 57: 'TO_CHAR', 58: 'TO_DATE', 59: 'TO_LABEL',
  60: 'TO_MULTI_BYTE', 61: 'TO_NUMBER', 62: 'TO_SINGLE_BYTE', 63: 'DUMP', 64: 'GREATEST',
  65: 'GREATEST_LB', 66: 'LEAST', 67: 'LEAST_UB', 68: 'NVL', 69: 'UID', 70: 'USER', 71: 'USERENV',
  72: 'VSIZE', 73: 'COUNT', 74: 'GLB', 75: 'LUB', 76: 'MAX', 77: 'MIN', 78: 'STDDEV', 79: 'ABS',
  80: 'VARIANCE', 81: '=', 82: '<>', 83: '>', 84: '<', 85: '<=', 86: '>=', 87: 'LIKE', 88: 'IN',
  89: 'IS NULL', 90: 'IS NOT NULL', 91: 'NOT IN', 92: 'BETWEEN', 93: 'NOT BETWEEN', 94: '+',
  95: '-', 96: '*', 97: '/', 98: 'AND', 99: 'OR', 100: 'NOT LIKE', 101: 'NOT', 102: 'DECODE',
  103: '||', 104: '!=', 105: '^=', 106: '()', 107: 'AVG', 108: 'EUL_DATE_TRUNC',
  109: 'SUM_SQUARES', 110: 'Detail', 111: 'ROWCOUNT', 112: 'ROWNUM', 113: 'ROWID', 114: '-',
  115: 'NULL', 116: 'AVG_DISTINCT', 117: 'COUNT_DISTINCT', 118: 'MAX_DISTINCT',
  119: 'MIN_DISTINCT', 120: 'STDDEV_DISTINCT', 121: 'SUM_DISTINCT', 122: 'VARIANCE_DISTINCT',
  123: 'EXISTS', 124: 'ANY', 125: 'ALL', 126: '2_Pass_Percentage', 127: '2_Pass_Rank',
  128: 'TIMESTAMPADD', 129: 'TIMESTAMPDIFF', 130: 'RANK', 131: 'DENSE_RANK', 132: 'PERCENT_RANK',
  133: 'CUME_DIST', 134: 'NTILE', 135: 'LAG', 136: 'LEAD', 137: 'OVER', 138: 'PARTITION',
  139: 'ORDER', 140: 'NPASSORDERCOMP', 141: 'ASC', 142: 'DESC', 143: 'NULLSFIRST',
  144: 'NULLSLAST', 145: 'WINDOW', 146: 'ROWS', 147: 'RANGE', 148: 'NPASSBETWEEN',
  149: 'NPASSBETWEENCOMP', 150: 'UNBOUNDEDPRECEDING', 151: 'UNBOUNDEDFOLLOWING',
  152: 'CURRENTROW', 153: 'PRECEDING', 154: 'FOLLOWING', 155: 'INTERVAL', 156: 'YEAR',
  157: 'MONTH', 158: 'DAY', 159: 'HOUR', 160: 'MINUTE', 161: 'SECOND', 162: 'CASE', 163: 'WHEN',
  164: 'ELSE', 165: 'NUMTODSINTERVAL', 166: 'NUMTOYMINTERVAL', 167: 'INTERVALPRECISION',
  168: 'ACOS', 169: 'ATAN', 170: 'ATAN2', 171: 'ASIN', 172: 'NVL2', 173: 'CORR',
  174: 'COVAR_POP', 175: 'COVAR_SAMP', 176: 'REGR_SLOPE', 177: 'REGR_INTERCEPT',
  178: 'REGR_COUNT', 179: 'REGR_R2', 180: 'REGR_AVGX', 181: 'REGR_AVGY', 182: 'REGR_SXX',
  183: 'REGR_SYY', 184: 'REGR_SXY', 185: 'STDDEV_POP', 186: 'STDDEV_SAMP', 187: 'VAR_POP',
  188: 'VAR_SAMP', 189: 'FIRST_VALUE', 190: 'LAST_VALUE', 191: 'RATIO_TO_REPORT',
  192: 'ROW_NUMBER', 193: 'SUM', 194: 'COUNT', 195: 'MAX', 196: 'MIN', 197: 'STDDEV',
  198: 'VARIANCE', 199: 'AVG', 200: 'SUM_DISTINCT', 201: 'COUNT_DISTINCT', 202: 'MAX_DISTINCT',
  203: 'MIN_DISTINCT', 204: 'STDDEV_DISTINCT', 205: 'VARIANCE_DISTINCT', 206: 'AVG_DISTINCT',
  207: 'CORR', 208: 'COVAR_POP', 209: 'COVAR_SAMP', 210: 'REGR_SLOPE', 211: 'REGR_INTERCEPT',
  212: 'REGR_COUNT', 213: 'REGR_R2', 214: 'REGR_AVGX', 215: 'REGR_AVGY', 216: 'REGR_SXX',
  217: 'REGR_SYY', 218: 'REGR_SXY', 219: 'STDDEV_POP', 220: 'STDDEV_SAMP', 221: 'VAR_POP',
  222: 'VAR_SAMP',
};

/** How a `[1,n]` node behaves — `EUL_FUNCTIONS.FUN_FUNCTION_TYPE`. */
export type ConditionOperatorKind =
  /** Compares operands and yields a boolean (`FUN_FUNCTION_TYPE` 1). */
  | 'predicate'
  /** AND, OR, NOT — combines booleans (`FUN_FUNCTION_TYPE` 3). */
  | 'logical';

export interface ConditionOperator {
  name: string;
  kind: ConditionOperatorKind;
  minArgs: number;
  /** null when the operator is variadic (`IN`, `AND`). */
  maxArgs: number | null;
  /**
   * The Discoverer Neo `map_operator` this is *exactly* equivalent to, or null
   * when Neo has none. Never an approximation: `NOT IN` maps to null rather
   * than to `IN`, because migrating it as `IN` inverts the filter.
   */
  neo: NeoConditionOperator | null;
}

/** The `map_operator` enum values Discoverer Neo accepts. */
export type NeoConditionOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'IN'
  | 'BETWEEN'
  | 'IS_NULL';

/**
 * Every `EUL_FUNCTIONS` row of type 1 (predicate) or 3 (logical) — that is,
 * every code that can legally appear at a boolean position in a condition
 * tree. A code outside this table at such a position is a value expression,
 * not a test, and the condition carrying it is reported.
 */
export const CONDITION_OPERATOR_TABLE: Record<number, ConditionOperator> = {
  81: { name: '=', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '=' },
  82: { name: '<>', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '<>' },
  83: { name: '>', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '>' },
  84: { name: '<', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '<' },
  85: { name: '<=', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '<=' },
  86: { name: '>=', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '>=' },
  87: { name: 'LIKE', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: 'LIKE' },
  88: { name: 'IN', kind: 'predicate', minArgs: 2, maxArgs: null, neo: 'IN' },
  89: { name: 'IS NULL', kind: 'predicate', minArgs: 1, maxArgs: 1, neo: 'IS_NULL' },
  90: { name: 'IS NOT NULL', kind: 'predicate', minArgs: 1, maxArgs: 1, neo: null },
  91: { name: 'NOT IN', kind: 'predicate', minArgs: 2, maxArgs: null, neo: null },
  92: { name: 'BETWEEN', kind: 'predicate', minArgs: 3, maxArgs: 3, neo: 'BETWEEN' },
  93: { name: 'NOT BETWEEN', kind: 'predicate', minArgs: 3, maxArgs: 3, neo: null },
  98: { name: 'AND', kind: 'logical', minArgs: 2, maxArgs: null, neo: null },
  99: { name: 'OR', kind: 'logical', minArgs: 2, maxArgs: null, neo: null },
  100: { name: 'NOT LIKE', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: null },
  101: { name: 'NOT', kind: 'logical', minArgs: 1, maxArgs: 1, neo: null },
  104: { name: '!=', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '<>' },
  105: { name: '^=', kind: 'predicate', minArgs: 2, maxArgs: 2, neo: '<>' },
  123: { name: 'EXISTS', kind: 'predicate', minArgs: 1, maxArgs: 1, neo: null },
  124: { name: 'ANY', kind: 'predicate', minArgs: 1, maxArgs: 1, neo: null },
  125: { name: 'ALL', kind: 'predicate', minArgs: 1, maxArgs: 1, neo: null },
};

/**
 * The codes that carry a negation.
 *
 * `NOT` (`FUN_ID` 101) is the token-language spelling of the per-node negation
 * flag in Oracle's own workbook object model — `DCBImportedFilterNode::IsNot`
 * in `DISCVR4/DCBIMPB.DLL`, set through `SetNot` and read by
 * `BuildFilterString` when a filter is rendered back to text. The rest fold
 * the negation into the operator's own name.
 *
 * All of them map to `neo: null` above, so a condition containing one is
 * reported rather than written. Nothing negated may migrate: dropping the
 * negation would replace a filter by its complement, which is the one failure
 * mode a reviewer looking at row counts would not notice.
 */
export const CONDITION_NEGATION_CODES: readonly number[] = [90, 91, 93, 100, 101];

/** Operator symbol by code — the predicate subset, kept for callers. */
export const CONDITION_OPERATORS: Record<number, string> = Object.fromEntries(
  Object.entries(CONDITION_OPERATOR_TABLE)
    .filter(([, operator]) => operator.kind === 'predicate')
    .map(([code, operator]) => [Number(code), operator.name]),
);

/** Compound operators — a condition that joins several sub-conditions. */
export const CONDITION_COMBINERS: Record<number, 'AND' | 'OR'> = {
  98: 'AND',
  99: 'OR',
};

// --- the tree --------------------------------------------------------------

/** A node of a parsed condition (or calculation) token tree. */
export type ConditionNode =
  /** `[1,code](…)` — a built-in operator or function. */
  | { type: 'call'; code: number; name: string | null; args: ConditionNode[] }
  /** `[2,n](…)` — a custom function, `n` an element id in this workbook. */
  | { type: 'function'; elementId: number; args: ConditionNode[] }
  /** `[5,kind,"…"]` — a literal; kind 1 string, 2 number, 4 date. */
  | { type: 'literal'; literalKind: number; value: string }
  /** `[6,n]` — item element `n`. */
  | { type: 'item'; elementId: number }
  /** `[8,n]` — parameter element `n`. */
  | { type: 'parameter'; elementId: number }
  /**
   * A node whose leading field is none of the above. Kept rather than dropped,
   * so an unrecognized construct is reported instead of silently ignored.
   */
  | { type: 'unknown'; fields: number[]; args: ConditionNode[] };

export interface ConditionTreeResult {
  /** The parsed tree, or null when the token string could not be read. */
  tree: ConditionNode | null;
  /** Why it could not be read; null on success. */
  error: string | null;
}

/**
 * Parse a token string into a tree.
 *
 * Deliberately strict: anything the grammar does not cover is an error, not a
 * shrug. That is the whole point of replacing the previous regex scan — a scan
 * cannot fail, and so cannot tell a condition it understood from one it did
 * not, which is how compound conditions came to be silently flattened.
 */
export function parseConditionTree(tokens: string | null): ConditionTreeResult {
  if (tokens === null || tokens.trim() === '') {
    return { tree: null, error: 'the condition stores no token tree' };
  }
  const source = tokens;
  let at = 0;

  function fail(what: string): never {
    throw new SyntaxError(`${what} at offset ${at} of ${JSON.stringify(source)}`);
  }

  function readNode(): ConditionNode {
    if (source[at] !== '[') fail('expected "["');
    at += 1;

    const fields: number[] = [];
    let literal: string | null = null;
    for (;;) {
      if (source[at] === '"') {
        at += 1;
        let text = '';
        while (at < source.length && source[at] !== '"') {
          // Backslash escapes are honoured so a literal may carry a quote or a
          // comma of its own. No workbook in the source EUL exercises it —
          // none of its 3 395 token strings contains a backslash — so this is
          // tolerance, not a confirmed encoding.
          if (source[at] === BACKSLASH) {
            text += source[at + 1] ?? '';
            at += 2;
          } else {
            text += source[at];
            at += 1;
          }
        }
        if (source[at] !== '"') fail('unterminated string literal');
        at += 1;
        literal = text;
      } else {
        const start = at;
        if (source[at] === '-') at += 1;
        while (at < source.length && source[at]! >= '0' && source[at]! <= '9') at += 1;
        if (at === start) fail('expected a number or a quoted literal');
        fields.push(Number(source.slice(start, at)));
      }
      if (source[at] === ',') {
        at += 1;
        continue;
      }
      if (source[at] === ']') {
        at += 1;
        break;
      }
      fail('expected "," or "]"');
    }

    const args: ConditionNode[] = [];
    if (source[at] === '(') {
      at += 1;
      if (source[at] === ')') {
        at += 1;
      } else {
        for (;;) {
          args.push(readNode());
          if (source[at] === ',') {
            at += 1;
            continue;
          }
          if (source[at] === ')') {
            at += 1;
            break;
          }
          fail('expected "," or ")"');
        }
      }
    }

    const [kind, second] = fields;
    const plain = fields.length === 2 && second !== undefined && literal === null;
    switch (kind) {
      case 1:
        return plain
          ? { type: 'call', code: second, name: EUL_FUNCTION_NAMES[second] ?? null, args }
          : { type: 'unknown', fields, args };
      case 2:
        return plain
          ? { type: 'function', elementId: second, args }
          : { type: 'unknown', fields, args };
      case 5:
        return second !== undefined && literal !== null && args.length === 0
          ? { type: 'literal', literalKind: second, value: literal }
          : { type: 'unknown', fields, args };
      case 6:
        return plain ? { type: 'item', elementId: second } : { type: 'unknown', fields, args };
      case 8:
        return plain ? { type: 'parameter', elementId: second } : { type: 'unknown', fields, args };
      default:
        return { type: 'unknown', fields, args };
    }
  }

  try {
    const tree = readNode();
    if (at !== source.length) fail('trailing characters after the tree');
    return { tree, error: null };
  } catch (err) {
    return { tree: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Render a node back to something a person can read, for warning text. */
export function describeConditionNode(node: ConditionNode): string {
  const list = (args: ConditionNode[]): string => args.map(describeConditionNode).join(', ');
  switch (node.type) {
    case 'call': {
      const name = node.name ?? `EUL_FUNCTIONS ${node.code}`;
      return node.args.length === 0 ? name : `${name}(${list(node.args)})`;
    }
    case 'function':
      return `custom function #${node.elementId}(${list(node.args)})`;
    case 'literal':
      return node.literalKind === 2 ? node.value : `'${node.value}'`;
    case 'item':
      return `item #${node.elementId}`;
    case 'parameter':
      return `:parameter #${node.elementId}`;
    case 'unknown':
      return `[${node.fields.join(',')}]`;
  }
}

// --- flattening a tree onto Discoverer Neo's condition model ---------------

/**
 * One `map_conditions` row's worth of a condition: a single test of one item
 * against literals or one parameter.
 */
export interface ConditionPredicate {
  /** Operator symbol as Discoverer spells it (`=`, `LIKE`, `BETWEEN`). */
  operator: string;
  /** `EUL_FUNCTIONS.FUN_ID` of that operator. */
  operatorCode: number;
  /** Neo's equivalent — always non-null on a predicate that reached here. */
  neoOperator: NeoConditionOperator;
  /** Element id of the item on the left-hand side. */
  itemRef: number;
  /** Element id of the parameter bound on the right, when there is one. */
  parameterRef: number | null;
  /** Literal operands on the right, in order. */
  literals: string[];
}

/**
 * A parenthesised run of predicates joined by one operator.
 *
 * This is exactly what Neo's `map_conditions.group_id` expresses: rows sharing
 * a group are parenthesized together and joined by `inner`; the group as a
 * whole is joined to the previous group by `join`.
 */
export interface ConditionGroup {
  /** How this group joins the one before it. 'AND' on the first group. */
  join: 'AND' | 'OR';
  /** How the predicates inside this group join each other. */
  inner: 'AND' | 'OR';
  predicates: ConditionPredicate[];
}

export interface ConditionPlan {
  /** The condition as groups of predicates, or empty when `unsupported`. */
  groups: ConditionGroup[];
  /**
   * Why the condition cannot be expressed as Neo filters, or null when it can.
   *
   * A condition is all or nothing. Migrating the expressible part of a
   * conjunction would widen the filter and of a disjunction would narrow it,
   * and either way the map would return a different set of rows while looking
   * like it had migrated cleanly.
   */
  unsupported: string | null;
  /** Depth of the boolean tree: 0 for a single test, 1 for `a AND b`. */
  depth: number;
}

/** How deep the AND/OR/NOT spine of a tree goes. */
function booleanDepth(node: ConditionNode): number {
  if (node.type !== 'call') return 0;
  const operator = CONDITION_OPERATOR_TABLE[node.code];
  if (operator?.kind !== 'logical') return 0;
  return 1 + Math.max(0, ...node.args.map(booleanDepth));
}

/**
 * Read one test, as the rows Neo needs to express it, or say why it cannot.
 *
 * Neo's model is `item OPERATOR value`: the left side must be the item itself,
 * not an expression over it. `TRUNC(Dt Emissao) BETWEEN :a AND :b` therefore
 * does not migrate — storing it against `Dt Emissao` would compare a timestamp
 * where Discoverer compared a date, and quietly drop rows.
 *
 * Returns a list because one test is occasionally two rows: see the BETWEEN
 * expansion below, which is an identity rather than an approximation.
 */
function readPredicates(node: ConditionNode): ConditionPredicate[] | string {
  if (node.type !== 'call') {
    return `the test is ${describeConditionNode(node)}, not a comparison`;
  }
  const operator = CONDITION_OPERATOR_TABLE[node.code];
  if (operator === undefined) {
    const name = EUL_FUNCTION_NAMES[node.code];
    return name === undefined
      ? `operator code ${node.code} is not a known EUL function`
      : `${name} is a value expression, not a test`;
  }
  // Negation is checked before nesting: a NOT reached here is a negation
  // wherever it sits, and saying "nested too deep" would send a reviewer
  // looking for the wrong problem.
  if (CONDITION_NEGATION_CODES.includes(node.code)) {
    return `${operator.name} is a negated test and Discoverer Neo has no negation`;
  }
  if (operator.kind === 'logical') {
    return `${operator.name} nested deeper than Discoverer Neo's condition groups reach`;
  }
  if (operator.neo === null) {
    return `${operator.name} has no Discoverer Neo equivalent`;
  }

  const [left, ...right] = node.args;
  if (left === undefined) return `${operator.name} has no operands`;
  if (left.type !== 'item') {
    return `${operator.name} is applied to ${describeConditionNode(left)}, not to a plain item`;
  }

  /** One row against the item on the left. */
  const row = (
    neoOperator: NeoConditionOperator,
    name: string,
    operands: ConditionNode[],
  ): ConditionPredicate => ({
    operator: name,
    operatorCode: node.code,
    neoOperator,
    itemRef: left.elementId,
    parameterRef: operands.find((operand) => operand.type === 'parameter')?.elementId ?? null,
    literals: operands.flatMap((operand) => (operand.type === 'literal' ? [operand.value] : [])),
  });

  if (operator.neo === 'IS_NULL') {
    return right.length === 0
      ? [row('IS_NULL', operator.name, [])]
      : `${operator.name} carries operands it should not have`;
  }

  if (right.length === 0) return `${operator.name} has no right-hand side`;
  const expression = right.find((arg) => arg.type !== 'literal' && arg.type !== 'parameter');
  if (expression !== undefined) {
    return (
      `${operator.name} compares against ${describeConditionNode(expression)}, ` +
      'which is an expression rather than a value'
    );
  }

  // Neo reads an IN list and a BETWEEN range back by splitting the stored
  // value on the comma, so a value containing one could not be recovered.
  const withComma = right.find((arg) => arg.type === 'literal' && arg.value.includes(','));

  if (operator.neo === 'BETWEEN') {
    if (right.length !== 2) return 'BETWEEN does not carry exactly two bounds';
    const [low, high] = right as [ConditionNode, ConditionNode];

    // One BETWEEN row when Neo can hold both bounds: two literals in the
    // `low,high` value, or one parameter supplying both.
    if (low.type === 'literal' && high.type === 'literal' && withComma === undefined) {
      return [row('BETWEEN', operator.name, [low, high])];
    }
    if (low.type === 'parameter' && high.type === 'parameter' && low.elementId === high.elementId) {
      return [row('BETWEEN', operator.name, [low])];
    }

    // Otherwise expand. `x BETWEEN a AND b` is *defined* as `x >= a AND x <= b`
    // — Oracle's own definition, including the unknown-on-NULL behaviour — so
    // two rows joined by AND are the same filter, not an approximation of it.
    // This is what keeps Discoverer's two separate prompts (`:"Dt >="` and
    // `:"Dt <="`) as two parameters instead of discarding one of them.
    return [row('>=', '>=', [low]), row('<=', '<=', [high])];
  }

  if (operator.neo === 'IN') {
    if (withComma !== undefined) {
      return 'an IN value contains a comma, which Neo uses to separate the values';
    }
    if (right.every((arg) => arg.type === 'literal')) {
      return [row('IN', operator.name, right)];
    }
    if (right.length === 1 && right[0]!.type === 'parameter') {
      return [row('IN', operator.name, right)];
    }
    // `x IN (:p, 'A')` would need one row per operand ORed together, and an OR
    // of rows cannot sit inside a group that is already ANDing.
    return 'IN mixes literal values with parameters';
  }

  if (right.length !== 1) {
    return `${operator.name} compares against ${right.length} values`;
  }
  return [row(operator.neo, operator.name, right)];
}

/**
 * Flatten a condition tree onto Discoverer Neo's two-level condition model.
 *
 * Neo stores conditions as a flat list of rows carrying a `group_id` and a
 * `logic_operator`: rows sharing a group are parenthesized and joined by their
 * own operators, and the groups are joined to each other. That expresses any
 * boolean tree two levels deep and no more.
 *
 * Measured over the source EUL's 3 395 conditions that is enough for all of
 * them — 92.6 % are a single test, 5.9 % a flat AND, 1.4 % a flat OR, and the
 * two remaining conditions are an OR of ANDs, which is exactly what a group
 * per AND expresses. See `EUL_SCHEMA_GROUND_TRUTH.md` §7.5. Anything deeper is
 * reported instead, rather than being reshaped into something that reads the
 * same and filters differently.
 */
export function planCondition(tree: ConditionNode | null): ConditionPlan {
  if (tree === null) return { groups: [], unsupported: 'the condition has no token tree', depth: 0 };

  const depth = booleanDepth(tree);
  const reject = (unsupported: string): ConditionPlan => ({ groups: [], unsupported, depth });

  // A single test: one group. Usually one predicate, two when a BETWEEN over
  // separate bounds expands into `>=` and `<=`.
  if (depth === 0 || tree.type !== 'call') {
    const predicates = readPredicates(tree);
    return typeof predicates === 'string'
      ? reject(predicates)
      : { groups: [{ join: 'AND', inner: 'AND', predicates }], depth, unsupported: null };
  }

  if (tree.code === 101) {
    return reject('the condition is negated (NOT) and Discoverer Neo has no negation');
  }
  if (depth > 2) {
    return reject(
      `the condition nests AND/OR ${depth} levels deep and Discoverer Neo's ` +
        'condition groups express two',
    );
  }

  const combiner = CONDITION_COMBINERS[tree.code];
  if (combiner === undefined) {
    return reject('the condition combines its tests with an operator that is neither AND nor OR');
  }

  // Each child of the root becomes a group: a nested AND/OR child becomes a
  // parenthesized run, a bare test becomes a group of one.
  const groups: ConditionGroup[] = [];
  for (const [index, child] of tree.args.entries()) {
    const join = index === 0 ? 'AND' : combiner;
    const childCombiner = child.type === 'call' ? CONDITION_COMBINERS[child.code] : undefined;

    if (childCombiner === undefined) {
      const predicates = readPredicates(child);
      if (typeof predicates === 'string') return reject(predicates);
      groups.push({ join, inner: 'AND', predicates });
      continue;
    }

    const predicates: ConditionPredicate[] = [];
    for (const leaf of child.type === 'call' ? child.args : []) {
      const read = readPredicates(leaf);
      if (typeof read === 'string') return reject(read);
      // A group joins its rows by one operator. An expanded BETWEEN needs its
      // two rows ANDed, so it cannot live inside a group that is ORing — that
      // would turn `x BETWEEN a AND b` into `x >= a OR x <= b`, which is every
      // row. It needs a group of its own, and there is no level left for one.
      if (read.length > 1 && childCombiner === 'OR') {
        return reject(
          'a BETWEEN over separate bounds sits inside an OR nested in an ' +
            'AND, which needs one more level of brackets than Discoverer Neo has',
        );
      }
      predicates.push(...read);
    }
    groups.push({ join, inner: childCombiner, predicates });
  }

  return { groups, unsupported: null, depth };
}

export interface ConditionTokenInfo {
  /** Top-level operator symbol, or null when the root is AND/OR/NOT. */
  operator: string | null;
  /** 'AND'/'OR' when the condition combines several sub-conditions. */
  combiner: 'AND' | 'OR' | null;
  /** Element ids of items referenced anywhere in the tree, in order. */
  itemRefs: number[];
  /** Element ids of parameters referenced anywhere in the tree, in order. */
  parameterRefs: number[];
  /** Literal values appearing in the tree, in order. */
  literals: string[];
  /** The parsed tree, or null when the token string could not be read. */
  tree: ConditionNode | null;
  /** Why the tree could not be read; null on success. */
  parseError: string | null;
  /** The tree flattened onto Neo's condition model, or the reason it cannot be. */
  plan: ConditionPlan;
}

/** Collect every reference and literal in a tree, depth first, in order. */
function collectRefs(node: ConditionNode, info: ConditionTokenInfo): void {
  switch (node.type) {
    case 'item':
      info.itemRefs.push(node.elementId);
      return;
    case 'parameter':
      info.parameterRefs.push(node.elementId);
      return;
    case 'literal':
      info.literals.push(node.value);
      return;
    default:
      for (const arg of node.args) collectRefs(arg, info);
  }
}

/**
 * Parse a condition's token tree and work out what Discoverer Neo can do with
 * it.
 *
 * The reference lists are kept because callers use them to resolve a condition
 * to the elements it names; `plan` is what decides whether it migrates.
 */
export function parseConditionTokens(tokens: string | null): ConditionTokenInfo {
  const { tree, error } = parseConditionTree(tokens);
  const info: ConditionTokenInfo = {
    operator: null,
    combiner: null,
    itemRefs: [],
    parameterRefs: [],
    literals: [],
    tree,
    parseError: error,
    plan: { groups: [], unsupported: error, depth: 0 },
  };
  if (tree === null) return info;

  if (tree.type === 'call') {
    info.combiner = CONDITION_COMBINERS[tree.code] ?? null;
    // A compound condition's own "operator" is the combiner; the operator of
    // each branch belongs to that branch, not to the condition as a whole.
    info.operator = info.combiner === null ? (CONDITION_OPERATORS[tree.code] ?? null) : null;
  }
  collectRefs(tree, info);
  info.plan = planCondition(tree);
  return info;
}

// ---------------------------------------------------------------------------
// Parsed document model
// ---------------------------------------------------------------------------

export interface WorkbookColumn {
  /** Position within the worksheet, 0-based, in display order. */
  displayOrder: number;
  /**
   * EUL `EXPRESSIONS.EXP_ID` of the item this column shows, when the workbook
   * records one. This is the reliable way to resolve a column: the labels
   * below are what the workbook saw when it was saved and may since have been
   * renamed in the EUL.
   */
  itemSourceId: number | null;
  /** EUL folder identifier (`M_M27`); null on a workbook calculation. */
  folderName: string | null;
  /** Folder display name (`M M27`) — matches Discoverer Neo's `folders.name`. */
  folderLabel: string | null;
  /** EUL item identifier (`DT_EMISSAO`); null on a workbook calculation. */
  itemName: string | null;
  /** Item display name (`Dt Emissao`) — matches Neo's `items.name`. */
  itemLabel: string | null;
  /** Heading the worksheet shows for this column, when it overrides the item. */
  heading: string | null;
  /** Display format mask (`DD-MON-RRRR`, `9G999G990D99`). */
  formatMask: string | null;
  /** True when the column shows a workbook calculation rather than an EUL item. */
  isCalculation: boolean;
  /** Element id the column refers to, for cross-referencing. */
  elementRef: number | null;

  // --- worksheet model (§7.8) ---------------------------------------------

  /** This column's own element id. */
  elementId: number;
  /**
   * Element id of the item or calculation the column shows (`0x02bf`).
   *
   * This is what ties a column to the rest of the model: the same id appears
   * in a query request's axis/measure lists, in `ParsedWorksheet.queryItemRefs`
   * and in a sort's item reference.
   */
  itemElementRef: number | null;
  /** Raw `0x02be`: 0 axis, 1 measure, 2 page. */
  axisTypeCode: number | null;
  /** `axisTypeCode` named, or null for a code outside the observed three. */
  axisType: WorkbookAxisType | null;
  /**
   * `0x0642` on the column's data format — 0 unformatted, 1 text, 2 number,
   * 4 date. The same code space `WorkbookCalculation.dataTypeCode` uses.
   */
  dataTypeCode: number | null;
  dataType: WorkbookDataType | null;
  /** `0x07e4` on the column's data font. Unit unconfirmed; see §7.8. */
  displayWidth: number | null;
  /** `0x0643` on the data format. Value mapping unconfirmed; see §7.8. */
  alignmentCode: number | null;
  /** `0x0645` on the data format — set on 6.4 % of columns. Unconfirmed. */
  wordWrapFlag: number | null;
  /** Format mask applied to the heading, when it carries one. */
  headingFormatMask: string | null;
  /** Style elements the column points at (`0x02c0` / `0x02c1`). */
  dataStyleRef: number | null;
  headingStyleRef: number | null;
  /**
   * Which of the query request's two item lists names this column's item —
   * `d4wkdmp -f`'s `Axis Item Usage` / `Measure Item Usage`.
   *
   * Independent evidence for `axisType`, which reads the column's own
   * `0x02be`: the two agree on all but 11 of the corpus's 33 509 columns
   * (§7.8.8). Null when neither list names the item, which is the case for a
   * column whose worksheet has no decodable query request.
   */
  queryAxisKind: WorkbookQueryAxisKind | null;
  /**
   * Position within that list, 0-based — the order the dump prints the usage
   * lines in. Axis items and measures are numbered separately, so a measure's
   * position is its index among the measures, not among all the columns.
   */
  axisOrder: number | null;
}

/** Which of a query request's two item lists names an item. */
export type WorkbookQueryAxisKind = 'AXIS' | 'MEASURE';

/**
 * An item a worksheet's query names, identified the way a column identifies
 * the item it shows.
 *
 * `ParsedWorksheet.hiddenItems` holds the ones **no column displays** — the
 * 1 176 of the corpus's 34 683 query items that are in `d4wkdmp -f`'s sheet
 * `Items :-` list with no column of their own, typically because a
 * calculation needs them (§7.8.4).
 */
export interface WorkbookQueryItem {
  /** Element id of the `0x00db` / `0x00dc` the query list names. */
  elementId: number;
  /** EUL `EXPRESSIONS.EXP_ID`, when the element carries one. */
  itemSourceId: number | null;
  /** EUL folder identifier (`M_M27`); null on a workbook calculation. */
  folderName: string | null;
  folderLabel: string | null;
  /** EUL item identifier (`DT_EMISSAO`); null on a workbook calculation. */
  itemName: string | null;
  itemLabel: string | null;
  /** True when the query names a workbook calculation rather than an EUL item. */
  isCalculation: boolean;
  /** Which list named it, and where in that list. */
  axisKind: WorkbookQueryAxisKind;
  axisOrder: number;
}

/** Where a column sits — Oracle's `EDCBAxisType`, by observed value. */
export type WorkbookAxisType = 'AXIS' | 'MEASURE' | 'PAGE';

/** A Discoverer item type, as `DataType` / `0x0642` encode it. */
export type WorkbookDataType = 'TEXT' | 'NUMBER' | 'DATE';

/** How a worksheet is drawn — Oracle's `EDCBViewType`. */
export type WorkbookViewType = 'TABLE' | 'CROSSTAB';

/** Sort direction — Oracle's `EDCBSortDirection`, by observed value. */
export type WorkbookSortDirection = 'ASC' | 'DESC';

/**
 * A total's aggregate function, named **and expressible in Discoverer Neo** —
 * the vocabulary `backend/src/lib/sql/formula-parser.ts` accepts.
 *
 * `EDCBAggregateType` (`0x0c1d`) has sixteen members and four of its codes are
 * now established (§7.12). Three of the four are in this set; the fourth,
 * `COUNT DISTINCT`, is a function Neo's SQL generator cannot emit, so it is
 * named by `discovererAggregateName` and reported rather than written here —
 * emitting `COUNT` for it would count duplicates and change the number the
 * report shows.
 */
export type WorkbookAggregateFunction = 'SUM' | 'AVG' | 'COUNT';

/**
 * What Discoverer computes for an `EDCBAggregateType` code, whether or not Neo
 * can express it. `COUNT DISTINCT` is the one value outside
 * `WorkbookAggregateFunction`.
 */
export type WorkbookDiscovererAggregate = WorkbookAggregateFunction | 'COUNT DISTINCT';

/**
 * Where a total sits — Oracle's `EDCBAggregateLocation` (`0x0c20`).
 *
 * `AT_CHANGE` is code `1` and is solid: `0x0c23` (the break column) is
 * non-zero on exactly those totals and zero on every other. Codes `3` and `6`
 * are both grand totals with no break column and nothing separates them, so
 * both name `GRAND_TOTAL` and the raw code is kept alongside.
 */
export type WorkbookTotalPlacement = 'GRAND_TOTAL' | 'AT_CHANGE';

/**
 * One sort a worksheet's query applies (`0x00f0`), in query order.
 *
 * `d4wkdmp -f` prints exactly this as `EUL Sort Item Reference`, which is what
 * `directionCode` was confirmed against.
 */
export interface WorkbookSort {
  elementId: number;
  /** Element id of the item sorted on. */
  itemElementRef: number | null;
  /** Raw `Direction` — 1 or 2 on every workbook seen. */
  directionCode: number | null;
  /** `directionCode` named: 1 → ASC, 2 → DESC. Null for any other code. */
  direction: WorkbookSortDirection | null;
  /** Layout-side detail for the same sort, matched by position. */
  layout: WorkbookSortLayout | null;
}

/** The layout-side half of a sort (`0x0514`) — grouping and break detail. */
export interface WorkbookSortLayout {
  elementId: number;
  /** Element id of the item sorted on; agrees with `WorkbookSort` 99.6 % of the time. */
  itemElementRef: number | null;
  /** `0x0516` — set on exactly the sorts whose `directionCode` is 2. */
  descendingFlag: boolean | null;
  /** True when the entry carries a group/break block (`0x0518` → `0x05dc`). */
  grouped: boolean;
  /** `0x0519` / `0x051a` — flags whose meaning is unconfirmed; see §7.8. */
  flag0519: number | null;
  flag051a: number | null;
}

/**
 * One query the worksheet runs (`0x0122`) — `d4wkdmp -f`'s `Query Request QRn`.
 *
 * `number` is the `n` the dump prints: query requests are numbered by document
 * order, which is how the two were correlated.
 */
export interface WorkbookQueryRequest {
  elementId: number;
  /** 1-based position among the document's query requests. */
  number: number;
  /** `Distinct` — whether the query de-duplicates rows. */
  distinct: boolean | null;
  /** Element ids of the items on an axis, in the dump's own order. */
  axisItemRefs: number[];
  /** Element ids of the items used as measures. */
  measureItemRefs: number[];
  /** Element ids of the `0x00f0` sorts this query applies. */
  sortRefs: number[];
  /** Element ids of the conditions (`0x00fa`) / EUL filters (`0x00f9`) it applies. */
  filterRefs: number[];
  /** Element ids of the `0x0118` joins it forces. */
  joinRefs: number[];
}

/**
 * A total / summary row (`0x0c1c`) — Oracle's `DCBImportedSummary`.
 *
 * The class has exactly five accessors, read straight off `DCBIMPB.DLL`'s
 * export table: `GetFunction` (`EDCBAggregateType`), `GetLabel`,
 * `GetMeasureItem`, `GetPlacement` (`EDCBAggregateLocation`) and
 * `GetPlacementItem` — which is field-for-field what this interface carries.
 * `DCBImportedSheet::GetSummaries()` returns a vector of them, one list per
 * worksheet, which is why they live on `ParsedWorksheet`.
 *
 * **A percentage is one of these, not its own class.** `DCBIMPB.DLL` — the
 * import/export model the `.DIS` body serializes — defines thirteen
 * `DCBImported*` classes and none of them is a percentage; Discoverer's
 * percentage lives in the *query* layer (`DCBPercentageRequest` in `DCB.DLL`),
 * which is constructed from an `EDCBAggregateType`. See §7.12.
 */
export interface WorkbookTotal {
  elementId: number;
  /** Label template; `&value` / `&item` interpolate the broken-on value. */
  label: string | null;
  /**
   * `0x0c1d` — `EDCBAggregateType`. 1 is SUM (the only code that appears on
   * numeric columns exclusively); the rest are unconfirmed, see §7.12.
   */
  functionCode: number | null;
  /**
   * `functionCode` named, restricted to what Neo can run. Null for a code that
   * is not established, and also for `COUNT DISTINCT` — see `discovererName`.
   */
  aggFunction: WorkbookAggregateFunction | null;
  /**
   * `functionCode` named as *Discoverer* computes it. Differs from
   * `aggFunction` only on `COUNT DISTINCT`, which Neo cannot express.
   */
  discovererName: WorkbookDiscovererAggregate | null;
  /**
   * `0x0c20` — `EDCBAggregateLocation`. 1 means "at each change in
   * `breakColumnRef`"; 3 and 6 carry no break column. Unconfirmed beyond that.
   */
  placementCode: number | null;
  /** `placementCode` named; both grand-total codes collapse to `GRAND_TOTAL`. */
  placement: WorkbookTotalPlacement | null;
  /** Element id of the column being totalled (`0x0c22`) — `GetMeasureItem`. */
  columnRef: number | null;
  /**
   * Element id of the column whose change breaks a subtotal (`0x0c23`) —
   * `GetPlacementItem`. Zero means "no break column" and reads as null.
   */
  breakColumnRef: number | null;
  /** Style elements the total points at (`0x0c1e` / `0x0c1f`). */
  dataStyleRef: number | null;
  headingStyleRef: number | null;
  /**
   * `0x0c24`–`0x0c28`, in that order. Every one is **[UNCONFIRMED]**: §7.8.7
   * records only how often each is set across the corpus. They are carried
   * verbatim so a migration can keep them without pretending to read them.
   */
  unconfirmedFlags: (number | null)[];
}

/** A reference to an EUL join the worksheet forces (`0x0118`). */
export interface WorkbookJoin {
  elementId: number;
  /** EUL join id — `d4wkdmp`'s `Id` on `EUL Join Reference`. */
  sourceId: number | null;
  identifier: string | null;
  name: string | null;
  owningFolderIdentifier: string | null;
  owningFolderName: string | null;
}

/**
 * A reference to a *shared* EUL filter (`0x00f9`) — a filter defined in the
 * EUL rather than inside the workbook.
 *
 * Absent from all 564 workbooks of the live source, which define their filters
 * privately; present in Oracle's own shipped `VIDSTR4.DIS`, which is where
 * every field below was confirmed.
 */
export interface WorkbookEulFilter {
  elementId: number;
  /** EUL `EXPRESSIONS.EXP_ID` of the filter. */
  sourceId: number | null;
  identifier: string | null;
  name: string | null;
  folderIdentifier: string | null;
  folderName: string | null;
}

/** A parameter value saved with the worksheet (`0x0898`). */
export interface WorkbookParameterValue {
  elementId: number;
  /** Element id of the `0x0104` parameter this value is for. */
  parameterRef: number | null;
  /** The saved values, as written (Discoverer NUL-terminates each). */
  values: string[];
}

/**
 * Page setup / display settings (`0x0834`) — one per document.
 *
 * The six texts pair 1:1 with the six fonts, and Oracle's own
 * `DCBImportedDisplaySettings` has exactly six header/footer slots
 * (left/centre/right × header/footer) with a style each. Which slot is which
 * is **unconfirmed** — `d4wkdmp` prints none of this — so they are exposed in
 * tag order rather than named. Same for the six margins.
 */
export interface WorkbookPageSetup {
  elementId: number;
  /** `0x0840`–`0x0845`, in tag order. */
  texts: Array<string | null>;
  /** Element ids of the six fonts `0x083a`–`0x083f`, in tag order. */
  fontRefs: Array<number | null>;
  /** `0x0846`–`0x084b`, in tag order. Inches on every workbook seen. */
  margins: Array<number | null>;
}

/**
 * A predicate with its element references resolved to the things they name.
 *
 * One of these becomes one `map_conditions` row.
 */
export interface ResolvedConditionPredicate extends ConditionPredicate {
  /** EUL `EXPRESSIONS.EXP_ID` of the item filtered, when the workbook records one. */
  itemSourceId: number | null;
  /** Item/folder labels as the workbook recorded them, for name-based fallback. */
  itemLabel: string | null;
  folderLabel: string | null;
  /** Name of the parameter bound on the right, when there is one. */
  parameterName: string | null;
  /**
   * Right-hand side as Neo stores it: the literal, or the comma-joined list
   * for `IN`, or `low,high` for `BETWEEN`. Null on a parameter comparison and
   * on `IS NULL`.
   */
  value: string | null;
}

/** A resolved run of predicates that a single pair of parentheses encloses. */
export interface ResolvedConditionGroup {
  join: 'AND' | 'OR';
  inner: 'AND' | 'OR';
  predicates: ResolvedConditionPredicate[];
}

export interface WorkbookCondition {
  /** EUL element id of the condition inside the workbook. */
  elementId: number;
  /** The condition as Discoverer displays it — truncated at 100 characters. */
  sql: string | null;
  /** The condition's own name, when it has one distinct from its SQL. */
  name: string | null;
  /** Raw token tree, kept verbatim so nothing is lost in translation. */
  tokens: string | null;
  /** Decoded operator/reference information from `tokens`. */
  parsed: ConditionTokenInfo;
  /**
   * The condition as groups of resolved predicates — what a caller writes to
   * `map_conditions`. Empty when `unsupported` says why it cannot migrate.
   */
  groups: ResolvedConditionGroup[];
  /**
   * Why the condition cannot be expressed as Discoverer Neo filters, or null.
   *
   * All or nothing: a condition with one unsupported test migrates none of
   * itself. Keeping the rest would widen a conjunction or narrow a
   * disjunction, and the map would return a different set of rows while
   * looking like it had migrated cleanly.
   */
  unsupported: string | null;

  // --- worksheet model (§7.8) ---------------------------------------------

  /** `Identifier` — a small integer, unique within the workbook. */
  identifier: string | null;
  /** The condition's own synthetic id (negative, as a private filter has no EUL row). */
  sourceId: number | null;
  /** `Case Sensitive` — confirmed against all 3 331 dumped conditions. */
  caseSensitive: boolean | null;
  /** Element ids of the items the condition tests. */
  itemRefs: number[];
  /** Element ids of the parameters it binds. */
  parameterRefs: number[];
}

export interface WorkbookParameter {
  elementId: number;
  name: string;
  /** Prompt shown to the user when the workbook is opened. */
  prompt: string | null;
  description: string | null;
  defaultValue: string | null;

  // --- worksheet model (§7.8) ---------------------------------------------

  /** `Identifier` — a small integer, unique within the workbook. */
  identifier: string | null;
  /** The parameter's own synthetic id (negative). */
  sourceId: number | null;
  /** Element id of the item the parameter is bound to, when it is bound. */
  itemElementRef: number | null;
}

export interface WorkbookCalculation {
  elementId: number;
  /**
   * Display name as the workbook recorded it, unless a worksheet sibling
   * shares it — Discoverer allows the same calculation name to be redefined
   * with a different formula (typically once per month/period column with a
   * different embedded literal), and a later same-named entry has this
   * element's own id appended (`"NAME #123"`) so it stays addressable.
   */
  name: string;
  /** Token-form formula, with element references left as written. */
  tokens: string | null;
  /**
   * `tokens` with `[6,n]` / `[8,n]` references replaced by the item or
   * parameter they name, which is as close to a readable formula as the
   * token language gets without Oracle's function table.
   */
  readableFormula: string | null;

  // --- worksheet model (§7.8), each confirmed field-for-field against
  // `d4wkdmp -f`'s `EUL Private Item` on all 41 982 of the corpus ----------

  /** `Identifier` — a small integer, unique within the workbook. */
  identifier: string | null;
  /** `Desc` — the description the author typed. */
  description: string | null;
  /** `DataType` — 1 text, 2 number, 4 date. */
  dataTypeCode: number | null;
  dataType: WorkbookDataType | null;
  /** `Placement` — 0 not placed on this sheet, 1 measure/data, 2 axis. */
  placementCode: number | null;
  /**
   * `Hidden` — set on 38 436 of the corpus's 47 548 calculations, near-exactly
   * the complement of `placementCode === 0`: a calculation is written into
   * every worksheet section that offers it, and most of those are not on that
   * sheet's layout.
   */
  hidden: boolean | null;
  /**
   * `IsACalc`. **Not** simply "this element is a calculation" — every `0x00dc`
   * is one, and the flag is *clear* on 277 of 47 548, Oracle's own `Profit SUM`
   * sample (a `SUM` over an existing item) among them. Semantics unconfirmed;
   * see `EUL_SCHEMA_GROUND_TRUTH.md` §7.8.13.
   */
  isACalc: boolean | null;
  /** Format mask stored on the calculation itself (`0x00e8`). */
  formatMask: string | null;
  /** Element ids of the items the formula references, in first-use order. */
  itemRefs: number[];
}

export interface ParsedWorksheet {
  /** Position within the workbook, 0-based. */
  index: number;
  name: string | null;
  /** Multi-line title/header text Discoverer prints above the data. */
  title: string | null;
  /** The same title as RTF (`0x0201`), keeping the author's formatting. */
  titleRtf: string | null;
  /** The same title as an HTML fragment (`0x0205`). */
  titleHtml: string | null;
  /** Stable GUID Discoverer assigns the worksheet. */
  guid: string | null;
  columns: WorkbookColumn[];
  /**
   * Calculations available on this worksheet, deduplicated by element id.
   *
   * Calculation elements are written into each worksheet's own section — the
   * same calculation appears once per worksheet that offers it, with different
   * element ids each time — so they are collected per worksheet and deduped
   * there rather than pooled across the workbook. A colliding display name
   * does NOT collapse two calculations onto one: see `WorkbookCalculation.name`.
   */
  calculations: WorkbookCalculation[];
  /** Total/summary rows defined on this worksheet, in layout order. */
  totals: WorkbookTotal[];

  // --- worksheet model (§7.8) ---------------------------------------------

  /** This worksheet's own element id. */
  elementId: number;
  /** Element id of the layout element (`0x0258`) the worksheet points at. */
  layoutElementId: number | null;
  /** How the worksheet is drawn, from the class of the element `0x01f8` names. */
  viewType: WorkbookViewType | null;
  /**
   * The queries this worksheet runs, in the order its layout links them —
   * `d4wkdmp -f`'s `Query(s) used`.
   */
  queries: WorkbookQueryRequest[];
  /** Sorts the worksheet's queries apply, in query order, deduplicated. */
  sorts: WorkbookSort[];
  /** Joins the worksheet's queries force. */
  joins: WorkbookJoin[];
  /** Parameter values saved with the worksheet. */
  parameterValues: WorkbookParameterValue[];
  /**
   * Element ids of every item the worksheet's queries name — the superset of
   * `columns`, and exactly what `d4wkdmp -f` lists under the sheet's `Items :-`.
   * An id here with no column is an item the query needs but does not display.
   */
  queryItemRefs: number[];
  /**
   * The items in `queryItemRefs` that **no column displays**, resolved to the
   * same identity a column carries so they can migrate alongside the columns.
   *
   * In display order terms they have none — Discoverer never draws them — so
   * they are listed axis items first, then measures, each in its query list's
   * own order.
   */
  hiddenItems: WorkbookQueryItem[];
  /**
   * `Distinct` on the worksheet's query requests (`0x0128`) — whether the
   * sheet is a `SELECT DISTINCT`.
   *
   * Null when no query request carries the flag, and also when a sheet's
   * several requests disagree: 923 of 923 live worksheets link exactly one
   * request, so a disagreement is not something to resolve by picking a side.
   */
  selectDistinct: boolean | null;
  /**
   * True when the worksheet's layout model decoded — it named a layout
   * element, a view class and at least one query request.
   *
   * False means the presentation fields above are absent, not wrong: the
   * worksheet still carries its name, columns and calculations, and a caller
   * must fall back to what it did before §7.8 rather than infer an axis or a
   * view type from what is left.
   */
  layoutDecoded: boolean;
}

export type WorkbookContentFormat = 'DIS' | 'XML' | 'EMPTY' | 'UNKNOWN';

export interface ParsedWorkbookDocument {
  format: WorkbookContentFormat;
  /** Workbook name as stored inside the blob (may differ from `DOC_NAME`). */
  name: string | null;
  /** EUL schema owner the workbook was saved against. */
  eulOwner: string | null;
  /** EUL name the workbook was saved against. */
  eulName: string | null;
  /** Discoverer release that wrote it, e.g. '4.1'. */
  discovererVersion: string | null;
  /** NLS territory/charset stamp, e.g. 'PORTUGUESE_PORTUGAL.WE8ISO8859P1'. */
  nls: string | null;
  worksheets: ParsedWorksheet[];
  /**
   * Conditions and parameters are workbook-scoped: on every workbook examined
   * they appear only in the shared section before the first worksheet, and
   * nothing in a worksheet's own section references them. See
   * `conditionsAreWorkbookWide`.
   */
  conditions: WorkbookCondition[];
  parameters: WorkbookParameter[];
  /** Every calculation in the workbook, across all worksheets, deduped by element id. */
  calculations: WorkbookCalculation[];
  /** Names of registered custom functions the workbook calls. */
  functionNames: string[];
  /**
   * True when the workbook has more than one worksheet, in which case its
   * conditions and parameters cannot be attributed to a single worksheet:
   * nothing in a worksheet's own section of the blob references them.
   */
  conditionsAreWorkbookWide: boolean;
  /** Bytes read from `DOC_DOCUMENT`. */
  byteLength: number;
  /** Non-fatal problems worth reporting to an operator. */
  warnings: string[];

  // --- worksheet model (§7.8) ---------------------------------------------

  /** EUL joins the workbook forces, deduplicated by element id. */
  joins: WorkbookJoin[];
  /** References to shared EUL filters, deduplicated by element id. */
  eulFilters: WorkbookEulFilter[];
  /** Page setup / display settings, one per document. */
  pageSetup: WorkbookPageSetup | null;
  /**
   * How many element bodies could not be framed and fell back to the
   * resynchronizing scan. Zero on all 567 workbooks decoded so far; a non-zero
   * count means some fields of those elements are unavailable, not wrong.
   */
  unframedElements: number;
}

function emptyDocument(format: WorkbookContentFormat, byteLength: number): ParsedWorkbookDocument {
  return {
    format,
    name: null,
    eulOwner: null,
    eulName: null,
    discovererVersion: null,
    nls: null,
    worksheets: [],
    conditions: [],
    parameters: [],
    calculations: [],
    functionNames: [],
    conditionsAreWorkbookWide: false,
    byteLength,
    warnings: [],
    joins: [],
    eulFilters: [],
    pageSetup: null,
    unframedElements: 0,
  };
}

/** Tag whose value is the EUL `EXPRESSIONS.EXP_ID` of an item element. */
export const TAG_ITEM_SOURCE_ID = 0x00dd;

/** Tag whose value is the element id of the item a column displays. */
export const TAG_COLUMN_ITEM_REF = 0x02bf;

/** First value carried under `tag`, or null when absent. */
function firstNumber(element: RawElement | undefined, tag: number): number | null {
  if (!element) return null;
  for (const entry of element.numbers) {
    if (entry.tag === tag) return entry.value;
  }
  return null;
}

/**
 * The EUL `EXP_ID` an item element names, or null when it has none.
 *
 * A workbook calculation stores a negative id here — it exists only inside the
 * workbook and has no `EXPRESSIONS` row — so only positive values are ids.
 */
function itemSourceId(element: RawElement | undefined): number | null {
  const value = firstNumber(element, TAG_ITEM_SOURCE_ID);
  return value !== null && value > 0 ? value : null;
}

/** First value carried under `tag`, trimmed, or null when absent/blank. */
function firstString(element: RawElement | undefined, tag: number): string | null {
  if (!element) return null;
  for (const entry of element.strings) {
    if (entry.tag !== tag) continue;
    const trimmed = entry.value.trim();
    if (trimmed !== '') return trimmed;
  }
  return null;
}

/**
 * True for an element that stands in for a column's data source: either a
 * reference to a real EUL item or a calculation defined in the workbook.
 */
function isItemElement(cls: number): boolean {
  return cls === CLASS.ITEM_REF || cls === CLASS.CALCULATION;
}

// ---------------------------------------------------------------------------
// Worksheet-model accessors
//
// These read `RawElement.records`, so they are only ever populated on a framed
// element. On an unframed one they return null / empty and the caller carries
// on: a field the container did not let us type is absent, never guessed.
// ---------------------------------------------------------------------------

/** The vector carried under `tag`, or an empty list. */
function numberVector(element: RawElement | undefined, tag: number): number[] {
  if (!element) return [];
  for (const record of element.records) {
    if (record.tag === tag && record.repeated) return record.numbers;
  }
  return [];
}

/** Blob payloads under `tag`, decoded latin-1 with any trailing NUL removed. */
function blobStrings(element: RawElement | undefined, tag: number): string[] {
  if (!element) return [];
  const out: string[] = [];
  for (const record of element.records) {
    if (record.tag !== tag) continue;
    for (const blob of record.blobs) {
      out.push(decodeString(blob.bytes).replace(/\0+$/, ''));
    }
  }
  return out;
}

/** A one-byte flag read as a boolean, or null when the element does not carry it. */
function firstFlag(element: RawElement | undefined, tag: number): boolean | null {
  const value = firstNumber(element, tag);
  return value === null ? null : value !== 0;
}

/** Follow a reference field to the element it names. */
function follow(
  byId: Map<number, RawElement>,
  element: RawElement | undefined,
  tag: number,
): RawElement | undefined {
  const id = firstNumber(element, tag);
  return id === null || id === 0 ? undefined : byId.get(id);
}

/**
 * The format block a style element ultimately names.
 *
 * A column points at a cell style (`0x0320`), the style at a font block
 * (`0x07d0`), and the font block back at the format block (`0x0640`) that
 * holds the mask. Walking that chain resolves the mask exactly, where the
 * older rule — "the first `0x0640` after the item element" — resolved it by
 * position. On the live corpus the two agree on all 21 978 columns that carry
 * a mask and the chain finds one more, so the chain is used when it resolves
 * and the positional rule remains the fallback for an unframed element.
 */
function formatOfStyle(
  byId: Map<number, RawElement>,
  styleId: number | null,
): RawElement | undefined {
  if (styleId === null) return undefined;
  const font = follow(byId, byId.get(styleId), TAG.STYLE_FONT_REF);
  return follow(byId, font, TAG.FONT_FORMAT_REF);
}

/** `0x02be` → the axis a column sits on. */
function axisTypeOf(code: number | null): WorkbookAxisType | null {
  if (code === 0) return 'AXIS';
  if (code === 1) return 'MEASURE';
  if (code === 2) return 'PAGE';
  return null;
}

/** `DataType` / `0x0642` → the item type it encodes. */
function dataTypeOf(code: number | null): WorkbookDataType | null {
  if (code === 1) return 'TEXT';
  if (code === 2) return 'NUMBER';
  if (code === 4) return 'DATE';
  return null;
}

/** `Direction` → the sort order it encodes. */
function sortDirectionOf(code: number | null): WorkbookSortDirection | null {
  if (code === 1) return 'ASC';
  if (code === 2) return 'DESC';
  return null;
}

/** Read a `0x00f0` sort element. */
function readSort(element: RawElement): WorkbookSort {
  const directionCode = firstNumber(element, TAG.SORT_DIRECTION);
  return {
    elementId: element.id,
    itemElementRef: firstNumber(element, TAG.SORT_ITEM_REF),
    directionCode,
    direction: sortDirectionOf(directionCode),
    layout: null,
  };
}

/** Read a `0x0514` layout sort entry. */
function readSortLayout(element: RawElement): WorkbookSortLayout {
  return {
    elementId: element.id,
    itemElementRef: firstNumber(element, TAG.SORT_ENTRY_ITEM_REF),
    descendingFlag: firstFlag(element, TAG.SORT_ENTRY_DESCENDING),
    grouped: (firstNumber(element, TAG.SORT_ENTRY_GROUP_REF) ?? 0) !== 0,
    flag0519: firstNumber(element, TAG.SORT_ENTRY_FLAG_0519),
    flag051a: firstNumber(element, TAG.SORT_ENTRY_FLAG_051A),
  };
}

/**
 * `EDCBAggregateType` → the function Discoverer computes.
 *
 * Four of the sixteen members are established, each against the live source's
 * 19 639 summaries (§7.12 carries the full argument):
 *
 * - **`1` = `SUM`** — 19 085 totals, every one on a numeric column, labelled
 *   `Total` / `Total Geral` / `SubTotal por …`.
 * - **`2` = `AVG`** — 13 of its 35 totals are labelled exactly `Média`, which
 *   is Oracle's own Portuguese word for Average (`DCMRESPT.MSB` message 283),
 *   and the rest `Valor Médio …`. All 35 are on numeric columns, and on two
 *   columns it sits beside a `1`: sum and average of the same measure.
 * - **`3` = `COUNT`** — the only code whose labels use Oracle's word for Count
 *   (`Contagem`, message 285): `Contagem`, `Contagem Todos os Valores`,
 *   `Contagem por &Item`. It is applied to per-row identifiers
 *   (`N Processo`, `N Garantia`).
 * - **`4` = `COUNT DISTINCT`** — the other half of the pair. It shares a
 *   column with a `3` thirteen times, never uses the word `Contagem`, and sits
 *   on repeating entity keys (`Entidade Risco`, `Tomador`, `Nipc Devedor`)
 *   under labels like `Nº Entidades por País`. Counting *rows* of a
 *   policyholder column is not what those reports ask.
 *
 * `5` (4 totals, one workbook), `6` (17, one report template copied) and `9`
 * (1, no label and no column) stay unnamed: all three are single authoring
 * decisions, and the only functions left for them are Minimum and Maximum,
 * which nothing separates. A wrong function silently changes what a migrated
 * report computes, so those codes are preserved rather than guessed.
 */
export function discovererAggregateName(
  code: number | null,
): WorkbookDiscovererAggregate | null {
  if (code === 1) return 'SUM';
  if (code === 2) return 'AVG';
  if (code === 3) return 'COUNT';
  if (code === 4) return 'COUNT DISTINCT';
  return null;
}

/**
 * The same, narrowed to what Discoverer Neo's SQL generator can emit.
 *
 * `COUNT DISTINCT` drops out: `backend/src/lib/sql/select-clause.ts` throws on
 * an aggregate outside `SUM`/`COUNT`/`AVG`/`MIN`/`MAX`, and writing `COUNT`
 * instead would produce a different number rather than a failure.
 */
export function aggregateFunctionOf(code: number | null): WorkbookAggregateFunction | null {
  const name = discovererAggregateName(code);
  return name === null || name === 'COUNT DISTINCT' ? null : name;
}

/** `EDCBAggregateLocation` → where Neo puts the total. */
export function totalPlacementOf(code: number | null): WorkbookTotalPlacement | null {
  if (code === 1) return 'AT_CHANGE';
  if (code === 3 || code === 6) return 'GRAND_TOTAL';
  return null;
}

/** Read a `0x0c1c` total element. */
function readTotal(element: RawElement): WorkbookTotal {
  const breakColumnRef = firstNumber(element, TAG.TOTAL_BREAK_COLUMN_REF);
  const functionCode = firstNumber(element, TAG.TOTAL_FUNCTION);
  const placementCode = firstNumber(element, TAG.TOTAL_PLACEMENT);
  return {
    elementId: element.id,
    label: firstString(element, TAG.TOTAL_LABEL),
    functionCode,
    aggFunction: aggregateFunctionOf(functionCode),
    discovererName: discovererAggregateName(functionCode),
    placementCode,
    placement: totalPlacementOf(placementCode),
    columnRef: firstNumber(element, TAG.TOTAL_COLUMN_REF),
    breakColumnRef: breakColumnRef === 0 ? null : breakColumnRef,
    dataStyleRef: firstNumber(element, TAG.TOTAL_DATA_STYLE_REF),
    headingStyleRef: firstNumber(element, TAG.TOTAL_HEADING_STYLE_REF),
    unconfirmedFlags: [
      TAG.TOTAL_FLAG_0C24,
      TAG.TOTAL_FLAG_0C25,
      TAG.TOTAL_FLAG_0C26,
      TAG.TOTAL_FLAG_0C27,
      TAG.TOTAL_FLAG_0C28,
    ].map((tag) => firstNumber(element, tag)),
  };
}

/** Read a `0x0118` join reference. */
function readJoin(element: RawElement): WorkbookJoin {
  return {
    elementId: element.id,
    sourceId: firstNumber(element, TAG.JOIN_SOURCE_ID),
    identifier: firstString(element, TAG.JOIN_IDENTIFIER),
    name: firstString(element, TAG.JOIN_NAME),
    owningFolderIdentifier: firstString(element, TAG.JOIN_FOLDER_NAME),
    owningFolderName: firstString(element, TAG.JOIN_FOLDER_LABEL),
  };
}

/** Read a `0x00f9` shared-EUL-filter reference. */
function readEulFilter(element: RawElement): WorkbookEulFilter {
  return {
    elementId: element.id,
    sourceId: firstNumber(element, TAG.FILTER_SOURCE_ID),
    identifier: firstString(element, TAG.CONDITION_ID),
    name: firstString(element, TAG.CONDITION_SQL),
    folderIdentifier: firstString(element, TAG.FILTER_FOLDER_NAME),
    folderName: firstString(element, TAG.FILTER_FOLDER_LABEL),
  };
}

/** Read a `0x0898` saved parameter value. */
function readParameterValue(element: RawElement): WorkbookParameterValue {
  return {
    elementId: element.id,
    parameterRef: firstNumber(element, TAG.PARAMETER_VALUE_REF),
    values: blobStrings(element, TAG.PARAMETER_VALUE_DATA),
  };
}

/** Read a `0x0834` page-setup element. */
function readPageSetup(element: RawElement): WorkbookPageSetup {
  const range = (first: number, last: number): number[] => {
    const tags: number[] = [];
    for (let tag = first; tag <= last; tag += 1) tags.push(tag);
    return tags;
  };
  return {
    elementId: element.id,
    texts: range(TAG.PAGE_TEXT_FIRST, TAG.PAGE_TEXT_LAST).map((tag) => firstString(element, tag)),
    fontRefs: range(TAG.PAGE_FONT_FIRST, TAG.PAGE_FONT_LAST).map((tag) => firstNumber(element, tag)),
    margins: range(TAG.PAGE_MARGIN_FIRST, TAG.PAGE_MARGIN_LAST).map((tag) =>
      firstNumber(element, tag),
    ),
  };
}

// ---------------------------------------------------------------------------
// Binary (.DIS) parse
// ---------------------------------------------------------------------------

function parseDisDocument(data: Buffer): ParsedWorkbookDocument {
  const doc = emptyDocument('DIS', data.length);
  const elements = readWorkbookElements(data);
  if (elements.length === 0) {
    doc.format = 'UNKNOWN';
    doc.warnings.push('Workbook body carried no recognizable Discoverer records.');
    return doc;
  }

  const byId = new Map<number, RawElement>();
  for (const element of elements) byId.set(element.id, element);

  // --- header ---------------------------------------------------------------
  for (const element of elements) {
    if (element.cls === CLASS.EUL_IDENTITY) {
      doc.eulOwner ??= firstString(element, TAG.EUL_OWNER);
      doc.eulName ??= firstString(element, TAG.EUL_NAME);
    } else if (element.cls === CLASS.WORKBOOK) {
      doc.name ??= firstString(element, TAG.WORKBOOK_NAME);
      doc.nls ??= firstString(element, TAG.NLS);
      doc.discovererVersion ??= firstString(element, TAG.DISCOVERER_VERSION);
    }
  }

  // --- worksheets, and the layout section each one owns ----------------------
  // A worksheet element closes its own section, so the columns that belong to
  // it are the ones since the previous worksheet element.
  const worksheetIndexes: number[] = [];
  elements.forEach((element, index) => {
    if (element.cls === CLASS.WORKSHEET) worksheetIndexes.push(index);
  });

  // `d4wkdmp -f` numbers query requests `QR1`, `QR2`, … by document order, so
  // that order is what a `WorkbookQueryRequest.number` reports. Established by
  // correlating the two on all 896 worksheets of the dumped corpus.
  const queryNumberById = new Map<number, number>();
  for (const element of elements) {
    if (element.cls === CLASS.QUERY_REQUEST) queryNumberById.set(element.id, queryNumberById.size + 1);
  }

  let sectionStart = 0;
  worksheetIndexes.forEach((endIndex, sheetIndex) => {
    const element = elements[endIndex]!;
    const layout = follow(byId, element, TAG.WORKSHEET_LAYOUT_REF);
    const view = follow(byId, element, TAG.WORKSHEET_VIEW_REF);
    const worksheet: ParsedWorksheet = {
      index: sheetIndex,
      name: firstString(element, TAG.WORKSHEET_NAME),
      title: firstString(element, TAG.WORKSHEET_TITLE),
      titleRtf: firstString(element, TAG.WORKSHEET_TITLE_RTF),
      titleHtml: firstString(element, TAG.WORKSHEET_TITLE_HTML),
      guid: firstString(element, TAG.WORKSHEET_GUID),
      columns: [],
      calculations: [],
      totals: [],
      elementId: element.id,
      layoutElementId: layout?.id ?? null,
      viewType:
        view === undefined
          ? null
          : view.cls === CLASS.VIEW_CROSSTAB
            ? 'CROSSTAB'
            : view.cls === CLASS.VIEW_TABLE
              ? 'TABLE'
              : null,
      queries: [],
      sorts: [],
      joins: [],
      parameterValues: [],
      queryItemRefs: [],
      hiddenItems: [],
      selectDistinct: null,
      layoutDecoded: false,
    };

    // Walk the section, remembering the most recent item and format elements;
    // a `0x02bc` closes a column group and binds them together.
    let pendingItem: RawElement | null = null;
    let pendingFormat: RawElement | null = null;

    // --- calculations: collect every element in this section, keyed by id ---
    //
    // Discoverer writes a calculation element once per column group that
    // offers it, and — on real workbooks, far more often than the byte
    // format alone would suggest — writes the SAME display name against a
    // genuinely different formula within one worksheet: typically the same
    // named total redefined once per month/period column with a different
    // embedded literal date (see `EUL_SCHEMA_GROUND_TRUTH.md` §7.7). Deduping
    // by name, as this used to, kept only the first occurrence and silently
    // discarded every later formula. The element id is what actually
    // identifies a distinct calculation, so that is the dedup key now.
    //
    // Names still matter — they are what a person sees and what another
    // formula's `[6,n]` reference resolves to (`humanizeFormula`) — so a name
    // that collides within the worksheet is disambiguated by suffixing the
    // colliding element's own id. That keeps the common, non-colliding case
    // completely unchanged, stays stable for as long as the byte stream does
    // (a re-parse of the same bytes reproduces the same ids), and traces
    // straight back to the source element for anyone cross-checking against
    // `d4wkdmp -f`'s own `IoId`.
    const finalNameById = new Map<number, string>();
    const nameOccurrences = new Map<string, number>();
    const registerCalcName = (id: number, rawName: string): void => {
      const seen = (nameOccurrences.get(rawName) ?? 0) + 1;
      nameOccurrences.set(rawName, seen);
      finalNameById.set(id, seen === 1 ? rawName : `${rawName} #${id}`);
    };

    const calcNodesById = new Map<number, RawElement>();
    for (let i = sectionStart; i < endIndex; i += 1) {
      const node = elements[i]!;
      if (node.cls === CLASS.CALCULATION) calcNodesById.set(node.id, node);
    }
    // Only a calculation that carries its own formula gets a name slot — one
    // with none is a bare reference to another element and `readCalculation`
    // drops it regardless, so excluding it here keeps the occurrence count
    // (and so the disambiguating suffix) identical to what actually ships.
    for (const [id, node] of calcNodesById) {
      const rawName = firstString(node, TAG.ITEM_LABEL);
      const tokens = firstString(node, TAG.CALC_FORMULA);
      if (rawName !== null && tokens !== null) registerCalcName(id, rawName);
    }

    const includedCalcIds = new Set<number>();
    for (const [id, node] of calcNodesById) {
      const calculation = readCalculation(node, byId, finalNameById);
      if (calculation === null) continue;
      includedCalcIds.add(id);
      worksheet.calculations.push(calculation);
    }

    /**
     * Record a calculation this worksheet offers whose own section carried no
     * BEGIN for it — a column pointing at an element written elsewhere.
     *
     * Not observed on any real workbook this parser has been checked against
     * (calculations are rewritten once per worksheet section), but the token
     * stream is only ever resynchronized, never validated, so this stays a
     * defensive fallback rather than an assumption baked into the dedup pass.
     */
    const collectStrayCalculation = (node: RawElement | null | undefined): void => {
      if (!node || node.cls !== CLASS.CALCULATION || includedCalcIds.has(node.id)) return;
      const rawName = firstString(node, TAG.ITEM_LABEL);
      const tokens = firstString(node, TAG.CALC_FORMULA);
      if (rawName === null || tokens === null) return;
      registerCalcName(node.id, rawName);
      const calculation = readCalculation(node, byId, finalNameById);
      if (calculation === null) return;
      includedCalcIds.add(node.id);
      worksheet.calculations.push(calculation);
    };

    for (let i = sectionStart; i < endIndex; i += 1) {
      const node = elements[i]!;
      if (isItemElement(node.cls)) {
        pendingItem = node;
        pendingFormat = null;
        continue;
      }
      if (node.cls === CLASS.FORMAT) {
        // The first format element after the item carries the data mask; the
        // later one styles the heading, so only the first is kept.
        pendingFormat ??= node;
        continue;
      }
      if (node.cls === CLASS.TOTAL) {
        worksheet.totals.push(readTotal(node));
        continue;
      }
      if (node.cls !== CLASS.COLUMN) continue;

      // The column names the element it displays. A column only carries its
      // own item element the first time that item appears in the layout, so
      // this reference — not the preceding element — is what identifies the
      // item. `pendingItem` is the fallback for a column that names nothing.
      const referencedId = firstNumber(node, TAG_COLUMN_ITEM_REF);
      const referenced = referencedId !== null ? byId.get(referencedId) : undefined;
      const source =
        referenced !== undefined && isItemElement(referenced.cls) ? referenced : pendingItem;
      const isCalculation = source !== null && source !== undefined && source.cls === CLASS.CALCULATION;
      // A calculation the column only referenced still belongs to this
      // worksheet's formula list.
      if (isCalculation) collectStrayCalculation(source);
      const reference = firstString(node, TAG.COLUMN_REF);

      // Style chain: the column names a cell style, the style a font block and
      // the font block the format block that holds the mask. That resolves the
      // mask exactly; `pendingFormat` — the first `0x0640` after the item — is
      // the positional fallback for an element that did not frame.
      const dataStyleRef = firstNumber(node, TAG.COLUMN_DATA_STYLE_REF);
      const headingStyleRef = firstNumber(node, TAG.COLUMN_HEADING_STYLE_REF);
      const dataFormat = formatOfStyle(byId, dataStyleRef);
      const dataFont = follow(byId, dataStyleRef === null ? undefined : byId.get(dataStyleRef), TAG.STYLE_FONT_REF);
      const dataTypeCode = firstNumber(dataFormat, TAG.FORMAT_DATA_TYPE);
      const axisTypeCode = firstNumber(node, TAG.COLUMN_AXIS_TYPE);

      worksheet.columns.push({
        displayOrder: worksheet.columns.length,
        itemSourceId: itemSourceId(source ?? undefined),
        folderName: isCalculation ? null : firstString(source ?? undefined, TAG.FOLDER_NAME),
        folderLabel: isCalculation ? null : firstString(source ?? undefined, TAG.FOLDER_LABEL),
        itemName: isCalculation ? null : firstString(source ?? undefined, TAG.ITEM_NAME),
        itemLabel: firstString(source ?? undefined, TAG.ITEM_LABEL),
        heading: firstString(node, TAG.COLUMN_HEADING),
        formatMask:
          firstString(dataFormat, TAG.FORMAT_DISPLAY) ??
          firstString(pendingFormat ?? undefined, TAG.FORMAT_DISPLAY),
        isCalculation,
        elementRef: reference !== null && /^\d+$/.test(reference) ? Number(reference) : null,
        elementId: node.id,
        itemElementRef: source?.id ?? null,
        axisTypeCode,
        axisType: axisTypeOf(axisTypeCode),
        dataTypeCode,
        dataType: dataTypeOf(dataTypeCode),
        displayWidth: firstNumber(dataFont, TAG.FONT_DISPLAY_WIDTH),
        alignmentCode: firstNumber(dataFormat, TAG.FORMAT_ALIGNMENT),
        wordWrapFlag: firstNumber(dataFormat, TAG.FORMAT_WORD_WRAP),
        headingFormatMask: firstString(formatOfStyle(byId, headingStyleRef), TAG.FORMAT_DISPLAY),
        dataStyleRef,
        headingStyleRef,
        // Filled in below: the query requests that name the item are read
        // after the section walk, because the layout links them.
        queryAxisKind: null,
        axisOrder: null,
      });

      pendingItem = null;
      pendingFormat = null;
    }

    // --- the queries this worksheet runs, and what they carry ---------------
    //
    // The layout (`0x0258`) links the query requests; each request lists its
    // axis items, measures, sorts, filters and joins by element id. That is the
    // whole of `d4wkdmp -f`'s `Query Request QRn` block, and where the sheet's
    // `Items :-` list comes from — the union of axis and measure items, which
    // is a superset of the displayed columns.
    for (const linkId of numberVector(layout, TAG.LAYOUT_QUERY_LINKS)) {
      const request = follow(byId, byId.get(linkId), TAG.QUERY_LINK_REF);
      if (request === undefined || request.cls !== CLASS.QUERY_REQUEST) continue;
      const number = queryNumberById.get(request.id);
      worksheet.queries.push({
        elementId: request.id,
        number: number ?? worksheet.queries.length + 1,
        distinct: firstFlag(request, TAG.QUERY_DISTINCT),
        axisItemRefs: numberVector(request, TAG.QUERY_AXIS_ITEMS),
        measureItemRefs: numberVector(request, TAG.QUERY_MEASURE_ITEMS),
        sortRefs: numberVector(request, TAG.QUERY_SORTS),
        filterRefs: numberVector(request, TAG.QUERY_FILTERS),
        joinRefs: numberVector(request, TAG.QUERY_JOINS),
      });
    }

    // Sorts, with the layout-side entry matched by position. The two lists
    // name the same item in 99.6 % of the corpus's 3 864 sorts; where they
    // disagree the query-side element is the one `d4wkdmp` prints, so it wins
    // and the layout entry is carried alongside rather than merged in.
    const sortEntries = (() => {
      const list = follow(byId, layout, TAG.LAYOUT_SORT_LIST_REF);
      return numberVector(list, TAG.SORT_LIST_ENTRIES)
        .map((id) => byId.get(id))
        .filter((el): el is RawElement => el !== undefined && el.cls === CLASS.SORT_ENTRY)
        .map(readSortLayout);
    })();
    const seenSorts = new Set<number>();
    for (const query of worksheet.queries) {
      for (const sortId of query.sortRefs) {
        if (seenSorts.has(sortId)) continue;
        const node = byId.get(sortId);
        if (node === undefined || node.cls !== CLASS.SORT) continue;
        seenSorts.add(sortId);
        const sort = readSort(node);
        sort.layout = sortEntries[worksheet.sorts.length] ?? null;
        worksheet.sorts.push(sort);
      }
    }

    const seenJoins = new Set<number>();
    for (const query of worksheet.queries) {
      for (const joinId of query.joinRefs) {
        if (seenJoins.has(joinId)) continue;
        const node = byId.get(joinId);
        if (node === undefined || node.cls !== CLASS.JOIN_REF) continue;
        seenJoins.add(joinId);
        worksheet.joins.push(readJoin(node));
      }
    }

    for (const valueId of numberVector(layout, TAG.LAYOUT_PARAMETER_VALUES)) {
      const node = byId.get(valueId);
      if (node === undefined || node.cls !== CLASS.PARAMETER_VALUE) continue;
      worksheet.parameterValues.push(readParameterValue(node));
    }

    const queryItems = new Set<number>();
    for (const query of worksheet.queries) {
      for (const id of query.axisItemRefs) queryItems.add(id);
      for (const id of query.measureItemRefs) queryItems.add(id);
    }
    worksheet.queryItemRefs = [...queryItems];

    // --- where each item sits, and which of them nothing displays ----------
    //
    // The query request numbers its axis items and its measures separately —
    // that is what `d4wkdmp -f` prints as `Axis Item Usage` and
    // `Measure Item Usage`, each in its own order — so an item's position is
    // its index within *its* list. A sheet with more than one request is
    // unobserved on the live corpus; the first request that names an item is
    // the one that places it, so a second request cannot silently renumber
    // what the first already placed.
    const axisPositions = new Map<number, number>();
    const measurePositions = new Map<number, number>();
    for (const query of worksheet.queries) {
      query.axisItemRefs.forEach((id, order) => {
        if (!axisPositions.has(id)) axisPositions.set(id, order);
      });
      query.measureItemRefs.forEach((id, order) => {
        if (!measurePositions.has(id)) measurePositions.set(id, order);
      });
    }

    for (const column of worksheet.columns) {
      const id = column.itemElementRef;
      if (id === null) continue;
      // The column's own `0x02be` says which list to believe when an item is
      // in both; where it is silent, or names a list that does not hold the
      // item, the list that does is the answer. Neither is a guess — both are
      // fields Discoverer wrote — and when neither names the item the
      // position simply stays null.
      const preferMeasure = column.axisType === 'MEASURE';
      const kinds: WorkbookQueryAxisKind[] = preferMeasure
        ? ['MEASURE', 'AXIS']
        : ['AXIS', 'MEASURE'];
      for (const kind of kinds) {
        const order = (kind === 'AXIS' ? axisPositions : measurePositions).get(id);
        if (order === undefined) continue;
        column.queryAxisKind = kind;
        column.axisOrder = order;
        break;
      }
    }

    const displayed = new Set(
      worksheet.columns
        .map((column) => column.itemElementRef)
        .filter((id): id is number => id !== null),
    );
    for (const [kind, positions] of [
      ['AXIS', axisPositions],
      ['MEASURE', measurePositions],
    ] as const) {
      for (const [id, order] of [...positions].sort((a, b) => a[1] - b[1])) {
        if (displayed.has(id)) continue;
        const node = byId.get(id);
        if (node === undefined || !isItemElement(node.cls)) continue;
        const isCalculation = node.cls === CLASS.CALCULATION;
        worksheet.hiddenItems.push({
          elementId: id,
          itemSourceId: itemSourceId(node),
          folderName: isCalculation ? null : firstString(node, TAG.FOLDER_NAME),
          folderLabel: isCalculation ? null : firstString(node, TAG.FOLDER_LABEL),
          itemName: isCalculation ? null : firstString(node, TAG.ITEM_NAME),
          itemLabel: firstString(node, TAG.ITEM_LABEL),
          isCalculation,
          axisKind: kind,
          axisOrder: order,
        });
      }
    }

    // One value for the sheet, from requests that agree. A sheet whose
    // requests disagree has no single answer and reports none.
    const distincts = [
      ...new Set(
        worksheet.queries
          .map((query) => query.distinct)
          .filter((value): value is boolean => value !== null),
      ),
    ];
    worksheet.selectDistinct = distincts.length === 1 ? distincts[0]! : null;

    worksheet.layoutDecoded =
      worksheet.layoutElementId !== null &&
      worksheet.viewType !== null &&
      worksheet.queries.length > 0;

    doc.worksheets.push(worksheet);
    sectionStart = endIndex + 1;
  });

  // --- conditions, parameters, calculations, functions -----------------------
  // Resolving a condition's item reference needs every element indexed first,
  // which is why these run after the worksheet pass rather than inside it.
  for (const element of elements) {
    switch (element.cls) {
      case CLASS.PARAMETER: {
        const name = firstString(element, TAG.PARAMETER_NAME);
        if (name === null) break;
        doc.parameters.push({
          elementId: element.id,
          name,
          prompt: firstString(element, TAG.PARAMETER_PROMPT),
          description: firstString(element, TAG.PARAMETER_DESCRIPTION),
          defaultValue: firstString(element, TAG.PARAMETER_DEFAULT),
          identifier: firstString(element, TAG.PARAMETER_ID),
          sourceId: firstNumber(element, 0x0105),
          itemElementRef: firstNumber(element, TAG.PARAMETER_ITEM_REF),
        });
        break;
      }
      case CLASS.CONDITION: {
        const tokens = firstString(element, TAG.CONDITION_TOKENS);
        const parsed = parseConditionTokens(tokens);
        const resolved = resolveConditionPlan(parsed.plan, byId);
        doc.conditions.push({
          elementId: element.id,
          sql: firstString(element, TAG.CONDITION_SQL),
          name: firstString(element, TAG.CONDITION_NAME),
          tokens,
          parsed,
          groups: resolved.groups,
          unsupported: resolved.unsupported,
          identifier: firstString(element, TAG.CONDITION_ID),
          sourceId: firstNumber(element, TAG.FILTER_SOURCE_ID),
          caseSensitive: firstFlag(element, TAG.CONDITION_CASE_SENSITIVE),
          itemRefs: numberVector(element, TAG.CONDITION_ITEM_REFS),
          parameterRefs: numberVector(element, TAG.CONDITION_PARAMETER_REFS),
        });
        break;
      }
      case CLASS.FUNCTION: {
        const name = firstString(element, TAG.FUNCTION_NAME);
        if (name !== null && !doc.functionNames.includes(name)) doc.functionNames.push(name);
        break;
      }
      case CLASS.JOIN_REF: {
        doc.joins.push(readJoin(element));
        break;
      }
      case CLASS.EUL_FILTER_REF: {
        doc.eulFilters.push(readEulFilter(element));
        break;
      }
      case CLASS.PAGE_SETUP: {
        doc.pageSetup ??= readPageSetup(element);
        break;
      }
      default:
        break;
    }
  }

  doc.unframedElements = elements.reduce((n, element) => n + (element.framed ? 0 : 1), 0);
  if (doc.unframedElements > 0) {
    doc.warnings.push(
      `${doc.unframedElements} of ${elements.length} element bodies could not be framed as a ` +
        'record sequence; fields carried by those elements are missing rather than wrong.',
    );
  }

  // The document-level calculation list is the union of the worksheets', so a
  // caller that only wants "what does this workbook calculate" does not have
  // to walk the worksheets itself. Deduped by element id, not name: element
  // ids are unique across the whole document by construction, and two
  // worksheets legitimately defining a same-named calculation is not the bug
  // that per-worksheet name collisions are — it says nothing about whether
  // their formulas agree.
  const seenAcrossWorkbook = new Set<number>();
  for (const worksheet of doc.worksheets) {
    for (const calculation of worksheet.calculations) {
      if (seenAcrossWorkbook.has(calculation.elementId)) continue;
      seenAcrossWorkbook.add(calculation.elementId);
      doc.calculations.push(calculation);
    }
  }

  doc.conditionsAreWorkbookWide = doc.worksheets.length > 1;

  if (doc.worksheets.length === 0) {
    doc.warnings.push(
      'Workbook body parsed but declared no worksheets; its column layout could not be recovered.',
    );
  }

  return doc;
}

/**
 * Resolve a condition plan's element references against the workbook.
 *
 * A predicate whose item element is missing from the workbook cannot be
 * attributed to anything, and a parameter reference that names no parameter
 * element would migrate as a filter bound to nothing — both make the whole
 * condition unsupported rather than a partially resolved one.
 */
function resolveConditionPlan(
  plan: ConditionPlan,
  byId: Map<number, RawElement>,
): { groups: ResolvedConditionGroup[]; unsupported: string | null } {
  if (plan.unsupported !== null) return { groups: [], unsupported: plan.unsupported };

  const groups: ResolvedConditionGroup[] = [];
  for (const group of plan.groups) {
    const predicates: ResolvedConditionPredicate[] = [];
    for (const predicate of group.predicates) {
      const itemElement = byId.get(predicate.itemRef);
      if (itemElement === undefined) {
        return {
          groups: [],
          unsupported: `the condition filters element #${predicate.itemRef}, which the workbook does not define`,
        };
      }
      let parameterName: string | null = null;
      if (predicate.parameterRef !== null) {
        parameterName = firstString(byId.get(predicate.parameterRef), TAG.PARAMETER_NAME);
        if (parameterName === null) {
          return {
            groups: [],
            unsupported: `the condition binds parameter #${predicate.parameterRef}, which the workbook does not define`,
          };
        }
      }
      predicates.push({
        ...predicate,
        itemSourceId: itemSourceId(itemElement),
        itemLabel: firstString(itemElement, TAG.ITEM_LABEL),
        folderLabel: firstString(itemElement, TAG.FOLDER_LABEL),
        parameterName,
        // Neo reads `IN` and `BETWEEN` values back by splitting on the comma,
        // so the join has to be the bare separator it expects.
        value: predicate.literals.length > 0 ? predicate.literals.join(',') : null,
      });
    }
    groups.push({ join: group.join, inner: group.inner, predicates });
  }
  return { groups, unsupported: null };
}

/**
 * Read a calculation element, or null when it carries no usable name.
 *
 * A calculation with no formula is a column that merely *references* one
 * defined elsewhere in the same section; it contributes nothing on its own and
 * is dropped rather than migrated as an empty calculated field.
 *
 * `calcNameById` supplies this element's own display name, disambiguated
 * against any worksheet sibling that shares its raw label — see the dedup
 * pass in `parseDisDocument`. Falling back to the raw label when the element
 * is missing from the map only happens for a calculation `readCalculation` is
 * asked to read outside that pass (there is no such caller today).
 */
function readCalculation(
  element: RawElement,
  byId: Map<number, RawElement>,
  calcNameById: ReadonlyMap<number, string>,
): WorkbookCalculation | null {
  const rawName = firstString(element, TAG.ITEM_LABEL);
  if (rawName === null) return null;
  const tokens = firstString(element, TAG.CALC_FORMULA);
  if (tokens === null) return null;
  const dataTypeCode = firstNumber(element, TAG.CALC_DATA_TYPE);
  return {
    elementId: element.id,
    name: calcNameById.get(element.id) ?? rawName,
    tokens,
    readableFormula: humanizeFormula(tokens, byId, calcNameById),
    identifier: firstString(element, TAG.CALC_IDENTIFIER),
    description: firstString(element, TAG.CALC_DESCRIPTION),
    dataTypeCode,
    dataType: dataTypeOf(dataTypeCode),
    placementCode: firstNumber(element, TAG.CALC_PLACEMENT),
    hidden: firstFlag(element, TAG.CALC_HIDDEN),
    isACalc: firstFlag(element, TAG.CALC_IS_A_CALC),
    formatMask: firstString(element, TAG.CALC_FORMAT_MASK),
    itemRefs: numberVector(element, TAG.CALC_ITEM_REFS),
  };
}

/**
 * Replace `[6,n]` / `[8,n]` element references in a token formula with the
 * names they point at, so a reviewer can read it.
 *
 * The function codes (`[1,49]`, `[2,20]`, …) are left alone. `[1,n]` could now
 * be named from `EUL_FUNCTION_NAMES`, but half the codes are infix operators
 * (`[1,94]` is `+`, `[1,106]` is a bracket) and rendering only the prefix ones
 * would produce a formula that reads like SQL and is not — worse than leaving
 * it plainly in token form. Naming them is a job for a formula renderer.
 *
 * A `[6,n]` reference is usually a plain EUL item, but `n` is sometimes
 * itself another `0x00dc` calculation — Oracle's own dump tool recursively
 * substitutes that calculation's *formula* in its place; `tokens` (and so
 * this rendering) does not walk that chain, and still names the referenced
 * calculation rather than expanding it, which is deliberately out of scope
 * here (see `EUL_SCHEMA_GROUND_TRUTH.md` §7.7). What this function does own
 * is naming the *right* calculation: `n`'s name is looked up in
 * `calcNameById` rather than read straight off the element, so a reference to
 * one of several same-named worksheet siblings resolves to that one's own
 * disambiguated name instead of an arbitrary sibling's.
 */
function humanizeFormula(
  tokens: string,
  byId: Map<number, RawElement>,
  calcNameById: ReadonlyMap<number, string>,
): string {
  return tokens.replace(/\[([68]),(\d+)\]/g, (whole, kind: string, id: string) => {
    const elementId = Number(id);
    const element = byId.get(elementId);
    if (kind === '8') {
      const name = firstString(element, TAG.PARAMETER_NAME);
      return name === null ? whole : `:${name}`;
    }
    const name =
      element?.cls === CLASS.CALCULATION
        ? (calcNameById.get(elementId) ?? firstString(element, TAG.ITEM_LABEL))
        : (firstString(element, TAG.ITEM_LABEL) ?? firstString(element, TAG.ITEM_NAME));
    return name ?? whole;
  });
}

// ---------------------------------------------------------------------------
// XML fallback (later Discoverer releases)
// ---------------------------------------------------------------------------

/**
 * Minimal XML summary for a workbook body that is text rather than the 4.1
 * binary. Intentionally regex-based and tolerant: this path exists so an EUL5
 * source is not reported as unreadable, and a dependency on a full XML parser
 * is not worth carrying for a shape no available source confirms.
 */
function parseXmlDocument(text: string, byteLength: number): ParsedWorkbookDocument {
  const doc = emptyDocument('XML', byteLength);
  const nameMatch = /<\s*workbook\b[^>]*\bname\s*=\s*"([^"]*)"/i.exec(text);
  doc.name = nameMatch ? nameMatch[1]!.trim() || null : null;

  let index = 0;
  for (const match of text.matchAll(/<\s*(?:worksheet|sheet)\b([^>]*)>/gi)) {
    const attrs = match[1] ?? '';
    const sheetName = /\bname\s*=\s*"([^"]*)"/i.exec(attrs);
    doc.worksheets.push({
      index,
      name: sheetName ? (sheetName[1]!.trim() || null) : null,
      title: null,
      titleRtf: null,
      titleHtml: null,
      guid: null,
      columns: [],
      calculations: [],
      totals: [],
      elementId: 0,
      layoutElementId: null,
      viewType: null,
      queries: [],
      sorts: [],
      joins: [],
      parameterValues: [],
      queryItemRefs: [],
      hiddenItems: [],
      selectDistinct: null,
      // The XML path reads names only, so the layout model is simply absent.
      layoutDecoded: false,
    });
    index += 1;
  }

  doc.warnings.push(
    'Workbook body is XML rather than the Discoverer 4.1 binary; only worksheet names were read.',
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Content type `DOCUMENTS.DOC_CONTENT_TYPE` carries for a 4.x workbook. */
export const DISCOVERER_WORKBOOK_CONTENT_TYPE = 'application/vnd.oracle-disco.wb';

/**
 * Parse a workbook body into its worksheets, columns, conditions, parameters
 * and calculations.
 *
 * Never throws. A null, empty or unrecognizable body comes back as an empty
 * document with `format` saying which, so a single corrupt workbook can never
 * take down a migration of several hundred.
 */
export function parseWorkbookDocument(
  content: Buffer | string | null,
  _version?: EulVersion,
): ParsedWorkbookDocument {
  if (content === null) return emptyDocument('EMPTY', 0);

  if (typeof content === 'string') {
    if (content.trim() === '') return emptyDocument('EMPTY', 0);
    return parseXmlDocument(content, Buffer.byteLength(content, 'latin1'));
  }

  if (content.length === 0) return emptyDocument('EMPTY', 0);

  // Sniff: an XML body starts with a declaration or an element once leading
  // whitespace is skipped. Anything else is treated as the binary container.
  const head = content.subarray(0, 64).toString('latin1').trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<')) {
    return parseXmlDocument(content.toString('latin1'), content.length);
  }

  try {
    return parseDisDocument(content);
  } catch (err) {
    const doc = emptyDocument('UNKNOWN', content.length);
    doc.warnings.push(
      `Workbook body could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return doc;
  }
}

/** Total number of columns across every worksheet — a quick fidelity metric. */
export function countWorkbookColumns(doc: ParsedWorkbookDocument): number {
  return doc.worksheets.reduce((total, sheet) => total + sheet.columns.length, 0);
}
