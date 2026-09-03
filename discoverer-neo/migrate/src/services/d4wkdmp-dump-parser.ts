/**
 * Parser for `DISCVR4\d4wkdmp.exe -f` text output — Oracle's own workbook
 * dumper, run against a live EUL. This is the reference the binary parser
 * (`workbook-parser.ts`) is checked against; see `d4wkdmp-differ.ts` and
 * `migrate/src/scripts/diff-corpus.ts`.
 *
 * ## Grammar
 *
 * The dump is line-oriented and its structure is carried entirely by
 * indentation — there is no other delimiter:
 *
 * - A **top-level header** has exactly one leading space and no `=`:
 *   ` EUL Item Reference`, ` EUL Private Item`, ` EUL Private Filter `,
 *   ` EUL Filter Reference`, ` EUL Join Reference`, ` EUL Function Reference`,
 *   ` EUL Sort Item Reference`, ` Parameter`, ` Query Request QR<n>`. It opens
 *   an **entry** that owns every line after it until the next header.
 * - An entry's **fields** are `Key = Value` lines indented two tabs. A line
 *   starting `***` is a found/not-found note, not a field.
 * - `Sheet Number <n>` has NO leading whitespace and opens a **sheet** block
 *   with its own grammar: one-tab `Key = Value` fields (`Sheet Name`, `Sheet
 *   Unique Name`, `Query(s) used`), bare `Query <n>` lines, and one-tab-plus-
 *   one-space `<Name> :-` list headers (`Items :-`, `Filters :-`, `Joins :-`)
 *   whose members are two-tab lines until the next list header or block end.
 * - `/{10,}` fence lines are purely decorative (before/after `Sheet Number`)
 *   and carry no structure; they are skipped.
 *
 * Resynchronizing by design, matching `workbook-parser.ts`'s own philosophy:
 * an unrecognized top-level header becomes an `Unknown` entry with its fields
 * preserved verbatim rather than being dropped, and an unrecognized list
 * under a sheet is kept under its own name in `otherLists`. Nothing the tool
 * printed is ever discarded — new element classes `d4wkdmp` learns to print
 * (the W2 targets) show up as `Unknown` entries or unfamiliar sheet lists
 * instead of vanishing.
 */

// ---------------------------------------------------------------------------
// Entry types
// ---------------------------------------------------------------------------

export interface DumpItemUsage {
  kind: 'Axis' | 'Measure' | 'Sort' | 'Filter' | 'Join';
  name: string;
}

interface EulItemReferenceEntry {
  type: 'EulItemReference';
  ioId: number | null;
  id: number | null;
  identifier: string | null;
  name: string | null;
  folderIdentifier: string | null;
  folderName: string | null;
  foundNote: string | null;
}

interface EulFunctionReferenceEntry {
  type: 'EulFunctionReference';
  ioId: number | null;
  id: number | null;
  identifier: string | null;
  functionName: string | null;
  displayName: string | null;
  foundNote: string | null;
}

interface EulFilterReferenceEntry {
  type: 'EulFilterReference';
  id: number | null;
  identifier: string | null;
  name: string | null;
  folderIdentifier: string | null;
  folderName: string | null;
  foundNote: string | null;
}

interface EulJoinReferenceEntry {
  type: 'EulJoinReference';
  id: number | null;
  identifier: string | null;
  name: string | null;
  owningFolderIdentifier: string | null;
  owningFolderName: string | null;
  foundNote: string | null;
}

interface EulPrivateItemEntry {
  type: 'EulPrivateItem';
  id: number | null;
  name: string | null;
  identifier: string | null;
  desc: string | null;
  dataType: number | null;
  placement: number | null;
  hidden: boolean | null;
  isACalc: boolean | null;
  ioFormula: string | null;
  displayFormula: string | null;
}

interface EulPrivateFilterEntry {
  type: 'EulPrivateFilter';
  id: number | null;
  identifier: string | null;
  name: string | null;
  desc: string | null;
  caseSensitive: boolean | null;
  ioFormula: string | null;
  displayFormula: string | null;
}

interface ParameterEntry {
  type: 'Parameter';
  name: string | null;
  identifier: string | null;
  prompt: string | null;
}

interface EulSortItemReferenceEntry {
  type: 'EulSortItemReference';
  item: string | null;
  direction: number | null;
}

interface QueryRequestEntry {
  type: 'QueryRequest';
  number: number;
  distinct: boolean | null;
  /** Every usage line, in file order. */
  usages: DumpItemUsage[];
}

interface SheetEntry {
  type: 'Sheet';
  number: number;
  name: string | null;
  uniqueName: string | null;
  queriesUsed: number[];
  /** "Items :-" entries that are not a "Sort On ..." line. */
  items: string[];
  /** The item name following "Sort On" in an "Items :-" entry. */
  sortOns: string[];
  /** "Filters :-" entries, verbatim. */
  filters: string[];
  /** "Joins :-" entries, verbatim — absent on most sheets. */
  joins: string[];
  /** Any list header under the sheet this parser does not know about yet. */
  otherLists: Record<string, string[]>;
}

/** An entry whose header this parser does not recognize. Nothing is lost. */
interface UnknownEntry {
  type: 'Unknown';
  header: string;
  fields: Array<{ key: string; value: string }>;
  foundNote: string | null;
}

export type DumpEntry =
  | EulItemReferenceEntry
  | EulFunctionReferenceEntry
  | EulFilterReferenceEntry
  | EulJoinReferenceEntry
  | EulPrivateItemEntry
  | EulPrivateFilterEntry
  | ParameterEntry
  | EulSortItemReferenceEntry
  | QueryRequestEntry
  | SheetEntry
  | UnknownEntry;

export interface ParsedDump {
  entries: DumpEntry[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Line classification
// ---------------------------------------------------------------------------

const FENCE_RE = /^\/{10,}\s*$/;
const SHEET_HEADER_RE = /^Sheet Number (\d+)\s*$/;
const QUERY_REQUEST_HEADER_RE = /^ Query Request QR(\d+)\s*$/;
/** One leading space, no tab, no '=' — a top-level entry header. */
const GENERIC_HEADER_RE = /^ ([^\t=][^\t]*)$/;

/** Split "Key = Value" on the first '=', both sides trimmed. Null if no '='. */
function splitField(line: string): { key: string; value: string } | null {
  const idx = line.indexOf('=');
  if (idx === -1) return null;
  return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
}

function toIntOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function toBoolOrNull(value: string | undefined): boolean | null {
  const trimmed = value?.trim();
  if (trimmed === '1') return true;
  if (trimmed === '0') return false;
  return null;
}

// ---------------------------------------------------------------------------
// Entry construction from a header + its raw fields
// ---------------------------------------------------------------------------

function buildEntry(
  header: string,
  fields: Array<{ key: string; value: string }>,
  foundNote: string | null,
): DumpEntry {
  const get = (key: string): string | undefined => fields.find((f) => f.key === key)?.value;

  switch (header.trim()) {
    case 'EUL Item Reference':
      return {
        type: 'EulItemReference',
        ioId: toIntOrNull(get('IoId')),
        id: toIntOrNull(get('Id')),
        identifier: get('Identifier') ?? null,
        name: get('Name') ?? null,
        folderIdentifier: get('Folder Identifier') ?? null,
        folderName: get('Folder Name') ?? null,
        foundNote,
      };
    case 'EUL Function Reference':
      return {
        type: 'EulFunctionReference',
        ioId: toIntOrNull(get('IoId')),
        id: toIntOrNull(get('Id')),
        identifier: get('Identifier') ?? null,
        functionName: get('Function Name') ?? null,
        displayName: get('Display Name') ?? null,
        foundNote,
      };
    case 'EUL Filter Reference':
      return {
        type: 'EulFilterReference',
        id: toIntOrNull(get('Id')),
        identifier: get('Identifier') ?? null,
        name: get('Name') ?? null,
        folderIdentifier: get('Folder Identifier') ?? null,
        folderName: get('Folder Name') ?? null,
        foundNote,
      };
    case 'EUL Join Reference':
      return {
        type: 'EulJoinReference',
        id: toIntOrNull(get('Id')),
        identifier: get('Identifier') ?? null,
        name: get('Name') ?? null,
        owningFolderIdentifier: get('Owning Folder Identifier') ?? null,
        owningFolderName: get('Owning Folder Name') ?? null,
        foundNote,
      };
    case 'EUL Private Item':
      return {
        type: 'EulPrivateItem',
        id: toIntOrNull(get('Id')),
        name: get('Name') ?? null,
        identifier: get('Identifier') ?? null,
        desc: get('Desc') ?? null,
        dataType: toIntOrNull(get('DataType')),
        placement: toIntOrNull(get('Placement')),
        hidden: toBoolOrNull(get('Hidden')),
        isACalc: toBoolOrNull(get('IsACalc')),
        ioFormula: get('IOFormula') ?? null,
        displayFormula: get('DisplayFormula') ?? null,
      };
    case 'EUL Private Filter':
      return {
        type: 'EulPrivateFilter',
        id: toIntOrNull(get('Id')),
        identifier: get('Identifier') ?? null,
        name: get('Name') ?? null,
        desc: get('Desc') ?? null,
        caseSensitive: toBoolOrNull(get('Case Sensitive')),
        ioFormula: get('IOFormula') ?? null,
        displayFormula: get('DisplayFormula') ?? null,
      };
    case 'Parameter':
      return {
        type: 'Parameter',
        name: get('Name') ?? null,
        identifier: get('Identifier') ?? null,
        prompt: get('Prompt') ?? null,
      };
    case 'EUL Sort Item Reference':
      return {
        type: 'EulSortItemReference',
        item: get('Item') ?? null,
        direction: toIntOrNull(get('Direction')),
      };
    default:
      return { type: 'Unknown', header: header.trim(), fields, foundNote };
  }
}

/** Header text that closes with a trailing space, e.g. " EUL Private Filter ". */
const KNOWN_HEADERS = new Set([
  'EUL Item Reference',
  'EUL Function Reference',
  'EUL Filter Reference',
  'EUL Join Reference',
  'EUL Private Item',
  'EUL Private Filter',
  'Parameter',
  'EUL Sort Item Reference',
]);

// ---------------------------------------------------------------------------
// Query Request usage lines
// ---------------------------------------------------------------------------

const USAGE_PREFIXES: Array<{ prefix: string; kind: DumpItemUsage['kind'] }> = [
  { prefix: 'Axis Item Usage', kind: 'Axis' },
  { prefix: 'Measure Item Usage', kind: 'Measure' },
  { prefix: 'Sort Item Usage', kind: 'Sort' },
  { prefix: 'Filter Usage', kind: 'Filter' },
  { prefix: 'Join Usage', kind: 'Join' },
];

function parseUsageLine(trimmed: string): DumpItemUsage | null {
  for (const { prefix, kind } of USAGE_PREFIXES) {
    if (!trimmed.startsWith(prefix)) continue;
    const rest = trimmed.slice(prefix.length);
    const field = splitField(rest.replace(/^\s*-\s*/, ''));
    if (field && field.key === 'Name') return { kind, name: field.value };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parse
// ---------------------------------------------------------------------------

export function parseD4wkdmpDump(text: string): ParsedDump {
  // Split on \n after normalizing \r\n; do not trim lines (indentation is
  // meaningful) — trailing \r is stripped explicitly instead.
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  const entries: DumpEntry[] = [];
  const warnings: string[] = [];

  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i]!;

    if (line.trim() === '' || FENCE_RE.test(line)) {
      i += 1;
      continue;
    }

    const sheetMatch = SHEET_HEADER_RE.exec(line);
    if (sheetMatch) {
      i += 1;
      const sheet: SheetEntry = {
        type: 'Sheet',
        number: Number(sheetMatch[1]),
        name: null,
        uniqueName: null,
        queriesUsed: [],
        items: [],
        sortOns: [],
        filters: [],
        joins: [],
        otherLists: {},
      };
      let currentList: string[] | null = null;
      let currentListName: string | null = null;

      while (i < n) {
        const raw = lines[i]!;
        if (raw.trim() === '' || FENCE_RE.test(raw)) {
          i += 1;
          continue;
        }
        // Anything back at the top level (a new header, or another Sheet)
        // ends this block.
        if (SHEET_HEADER_RE.test(raw) || GENERIC_HEADER_RE.test(raw)) break;

        const trimmed = raw.trim();
        const listHeaderMatch = /^([A-Za-z][A-Za-z ]*)\s*:-\s*$/.exec(trimmed);
        if (listHeaderMatch && !raw.startsWith('\t\t')) {
          currentListName = listHeaderMatch[1]!.trim();
          if (currentListName === 'Items') currentList = null; // handled specially below
          else if (currentListName === 'Filters') currentList = sheet.filters;
          else if (currentListName === 'Joins') currentList = sheet.joins;
          else {
            sheet.otherLists[currentListName] ??= [];
            currentList = sheet.otherLists[currentListName]!;
          }
          i += 1;
          continue;
        }

        if (raw.startsWith('\t\t')) {
          // A member of whichever list is open.
          if (currentListName === 'Items') {
            const sortOnMatch = /^Sort On\s+(.*)$/.exec(trimmed);
            if (sortOnMatch) sheet.sortOns.push(sortOnMatch[1]!.trim());
            else sheet.items.push(trimmed);
          } else if (currentList) {
            currentList.push(trimmed);
          } else {
            warnings.push(`Sheet ${sheet.number}: list entry outside any list header: ${trimmed}`);
          }
          i += 1;
          continue;
        }

        // One-tab field or bare "Query N" line.
        const queryMatch = /^Query (\d+)\s*$/.exec(trimmed);
        if (queryMatch) {
          sheet.queriesUsed.push(Number(queryMatch[1]));
          i += 1;
          continue;
        }
        const field = splitField(trimmed);
        if (field) {
          if (field.key === 'Sheet Name') sheet.name = field.value || null;
          else if (field.key === 'Sheet Unique Name') sheet.uniqueName = field.value || null;
          // "Query(s) used" itself carries no value worth keeping — the
          // "Query N" lines that follow are what matters.
          i += 1;
          continue;
        }

        warnings.push(`Sheet ${sheet.number}: unrecognized line: ${trimmed}`);
        i += 1;
      }

      entries.push(sheet);
      continue;
    }

    const qrMatch = QUERY_REQUEST_HEADER_RE.exec(line);
    if (qrMatch) {
      i += 1;
      const qr: QueryRequestEntry = { type: 'QueryRequest', number: Number(qrMatch[1]), distinct: null, usages: [] };
      while (i < n) {
        const raw = lines[i]!;
        if (raw.trim() === '' || FENCE_RE.test(raw)) break;
        if (SHEET_HEADER_RE.test(raw) || GENERIC_HEADER_RE.test(raw)) break;
        const trimmed = raw.trim();
        const usage = parseUsageLine(trimmed);
        if (usage) {
          qr.usages.push(usage);
        } else {
          const field = splitField(trimmed);
          if (field && field.key === 'Distinct') qr.distinct = toBoolOrNull(field.value);
          else warnings.push(`Query Request QR${qr.number}: unrecognized line: ${trimmed}`);
        }
        i += 1;
      }
      entries.push(qr);
      continue;
    }

    const genericMatch = GENERIC_HEADER_RE.exec(line);
    if (genericMatch) {
      const header = genericMatch[1]!;
      i += 1;
      const fields: Array<{ key: string; value: string }> = [];
      let foundNote: string | null = null;
      while (i < n) {
        const raw = lines[i]!;
        if (raw.trim() === '' || FENCE_RE.test(raw)) break;
        if (SHEET_HEADER_RE.test(raw) || GENERIC_HEADER_RE.test(raw)) break;
        const trimmed = raw.trim();
        if (trimmed.startsWith('***')) {
          foundNote = trimmed;
        } else {
          const field = splitField(trimmed);
          if (field) fields.push(field);
          else warnings.push(`${header.trim()}: unrecognized line: ${trimmed}`);
        }
        i += 1;
      }
      entries.push(buildEntry(header, fields, foundNote));
      continue;
    }

    warnings.push(`unrecognized top-level line: ${line}`);
    i += 1;
  }

  return { entries, warnings };
}

/** Header strings this parser turns into a typed entry rather than `Unknown`. */
export function isKnownDumpHeader(header: string): boolean {
  return KNOWN_HEADERS.has(header.trim());
}
