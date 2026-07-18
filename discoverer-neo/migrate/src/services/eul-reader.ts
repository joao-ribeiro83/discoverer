/**
 * EUL reader service — the connection-level facade over the version detector
 * and schema adapter (Session 5.3).
 *
 * Where the adapter's read functions take an already-built adapter, the
 * functions here take a raw connection (or a mock executor) and run the whole
 * detect → adapt → read pipeline, so a caller only ever needs connection
 * details. `readEulSchema` runs detection once and reads everything through a
 * single pooled executor; the per-entity helpers are standalone convenience
 * wrappers that each re-detect.
 *
 * Workbook DOC_CONTENT is stored as a proprietary Discoverer blob that the
 * reference documents as "XML". `readWorkbooks` best-effort-parses it into a
 * light structural summary (worksheet names/counts) via xml2js, tolerant of
 * both EUL4 and EUL5 element naming and of content that isn't valid XML at all.
 */

import xml2jsNs from 'xml2js';

import type { EulSchemaAdapter } from '../types/eul-versions.js';
import type {
  BusinessArea,
  CustomFunction,
  EulUser,
  EulVersionInfo,
  Folder,
  Grant,
  Hierarchy,
  Item,
  Join,
  Workbook,
} from '../types/eul-versions.js';
import type { DetectEulVersionOptions } from './eul-version-detector.js';
import { detectEulVersionFromExecutor } from './eul-version-detector.js';
import {
  createEulSchemaAdapter,
  EulReadError,
  readBusinessAreas as readBusinessAreasWith,
  readCustomFunctions as readCustomFunctionsWith,
  readFolders as readFoldersWith,
  readGrants as readGrantsWith,
  readHierarchies as readHierarchiesWith,
  readItems as readItemsWith,
  readJoins as readJoinsWith,
  readUsers as readUsersWith,
  readWorkbooks as readWorkbooksWith,
} from './eul-schema-adapter.js';
import type { EulSource, OracleExecutor } from './oracle-client.js';
import { dbString, isTableNotFoundError, resolveExecutor } from './oracle-client.js';

// xml2js ships as CommonJS. Its named exports happen to survive Node's ESM
// interop, but the repo convention (oracledb / cron-parser / node-sql-parser)
// is to unwrap `.default` defensively rather than trust static named exports.
const { parseStringPromise } = (xml2jsNs as { default?: typeof xml2jsNs } & typeof xml2jsNs)
  .default ?? xml2jsNs;

// ---------------------------------------------------------------------------
// Expression-type selectors
// ---------------------------------------------------------------------------

/** Condition expressions (EXP_TYPE='CO') — read separately from items. */
export const CONDITION_EXP_TYPES: readonly string[] = ['CO'];
/** Security-manager expressions (EXP_TYPE='SM') — EUL5 only. */
export const SECURITY_MANAGER_EXP_TYPES: readonly string[] = ['SM'];

// ---------------------------------------------------------------------------
// Workbook content parsing
// ---------------------------------------------------------------------------

export interface WorkbookSheet {
  name: string | null;
}

export interface WorkbookInfo {
  /** True when DOC_CONTENT parsed as well-formed XML. */
  parsed: boolean;
  /** Root element tag name, e.g. 'Workbook' / 'workbook'. */
  rootName: string | null;
  worksheetCount: number;
  worksheets: WorkbookSheet[];
  /** Best-effort count of item/column references found in the XML. */
  itemReferenceCount: number;
  /** Present when the content could not be parsed as XML. */
  parseError?: string;
}

export interface ParsedWorkbook extends Workbook {
  info: WorkbookInfo;
}

const EMPTY_WORKBOOK_INFO: WorkbookInfo = {
  parsed: false,
  rootName: null,
  worksheetCount: 0,
  worksheets: [],
  itemReferenceCount: 0,
};

function extractSheetName(child: unknown): string | null {
  if (child === null || typeof child !== 'object' || Array.isArray(child)) return null;
  const attrs = (child as { $?: Record<string, unknown> }).$;
  if (!attrs) return null;
  for (const key of ['name', 'Name', 'title', 'Title', 'NAME', 'TITLE']) {
    const value = attrs[key];
    if (value !== undefined && value !== null) return dbString(value);
  }
  return null;
}

/**
 * Walk an xml2js-parsed tree (default options: children are arrays, attrs
 * under `$`) and collect worksheet-like elements and item references,
 * case-insensitively, so both the EUL4 and EUL5 workbook dialects are covered.
 * Attribute-less elements come back as empty strings from xml2js, so counting
 * happens at the parent level rather than by visiting each child object.
 */
function summarizeWorkbookTree(root: Record<string, unknown>): {
  worksheets: WorkbookSheet[];
  itemReferenceCount: number;
} {
  const worksheets: WorkbookSheet[] = [];
  let itemReferenceCount = 0;

  const visit = (node: Record<string, unknown>): void => {
    for (const [key, rawValue] of Object.entries(node)) {
      if (key === '$' || key === '_') continue;
      const lower = key.toLowerCase();
      const children = Array.isArray(rawValue) ? rawValue : [rawValue];

      if (lower === 'worksheet' || lower === 'sheet') {
        for (const child of children) worksheets.push({ name: extractSheetName(child) });
      } else if (
        lower === 'item' ||
        lower === 'column' ||
        lower === 'itemref' ||
        lower === 'item_ref'
      ) {
        itemReferenceCount += children.length;
      }

      for (const child of children) {
        if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
          visit(child as Record<string, unknown>);
        }
      }
    }
  };

  visit(root);
  return { worksheets, itemReferenceCount };
}

/**
 * Parse a workbook's DOC_CONTENT into a structural summary. Never throws:
 * null/empty content and non-XML blobs come back as `parsed: false`.
 */
export async function parseWorkbookContent(content: string | null): Promise<WorkbookInfo> {
  if (content === null || content.trim() === '') {
    return { ...EMPTY_WORKBOOK_INFO };
  }
  let tree: Record<string, unknown>;
  try {
    tree = (await parseStringPromise(content, {
      explicitArray: true,
      explicitRoot: true,
    })) as Record<string, unknown>;
  } catch (err) {
    return {
      ...EMPTY_WORKBOOK_INFO,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  const rootName = Object.keys(tree)[0] ?? null;
  const { worksheets, itemReferenceCount } = summarizeWorkbookTree(tree);
  return {
    parsed: true,
    rootName,
    worksheetCount: worksheets.length,
    worksheets,
    itemReferenceCount,
  };
}

// ---------------------------------------------------------------------------
// Workbook usage statistics (QPP_STATS query log)
// ---------------------------------------------------------------------------

export interface WorkbookUsageStat {
  workbookName: string | null;
  executionCount: number;
  totalElapsedTime: number;
  avgElapsedTime: number;
  totalRowsReturned: number;
  lastRun: Date | null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(dbString(value));
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined) return null;
  const d = new Date(dbString(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Aggregate the EUL*_QPP_STATS query-execution log into per-workbook usage
 * stats. Returns `[]` when the query-log table is absent or empty — usage data
 * is optional and a missing log is not an error.
 */
export async function readWorkbookUsage(
  adapter: EulSchemaAdapter,
  execute: OracleExecutor,
): Promise<WorkbookUsageStat[]> {
  const table = adapter.getQualifiedTableName('QPP_STATS');
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await execute(
      `SELECT DOC_NAME, ES_ELAPSED_TIME, ES_ROWS_RETURNED, ES_CREATED_DATE FROM ${table}`,
    );
  } catch (err) {
    if (isTableNotFoundError(err)) return [];
    throw new EulReadError(
      `Failed to read workbook usage from ${table}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      err,
    );
  }

  const byWorkbook = new Map<string, WorkbookUsageStat>();
  for (const row of rows) {
    const name = row.DOC_NAME === null || row.DOC_NAME === undefined ? null : dbString(row.DOC_NAME);
    const key = name ?? ' <unnamed>';
    const elapsed = toNumber(row.ES_ELAPSED_TIME);
    const runAt = toDate(row.ES_CREATED_DATE);

    const stat = byWorkbook.get(key) ?? {
      workbookName: name,
      executionCount: 0,
      totalElapsedTime: 0,
      avgElapsedTime: 0,
      totalRowsReturned: 0,
      lastRun: null,
    };
    stat.executionCount += 1;
    stat.totalElapsedTime += elapsed;
    stat.totalRowsReturned += toNumber(row.ES_ROWS_RETURNED);
    if (runAt && (stat.lastRun === null || runAt.getTime() > stat.lastRun.getTime())) {
      stat.lastRun = runAt;
    }
    byWorkbook.set(key, stat);
  }

  const stats = [...byWorkbook.values()];
  for (const stat of stats) {
    stat.avgElapsedTime =
      stat.executionCount > 0 ? stat.totalElapsedTime / stat.executionCount : 0;
  }
  stats.sort((a, b) => b.executionCount - a.executionCount);
  return stats;
}

// ---------------------------------------------------------------------------
// Full read
// ---------------------------------------------------------------------------

export interface EulFullData {
  businessAreas: BusinessArea[];
  folders: Folder[];
  /** Plain and calculated items (EXP_TYPE CI/CU). */
  items: Item[];
  /** Conditions (EXP_TYPE CO). */
  conditions: Item[];
  /** Security-manager conditions (EXP_TYPE SM) — EUL5 only, else empty. */
  securityConditions: Item[];
  joins: Join[];
  hierarchies: Hierarchy[];
  customFunctions: CustomFunction[];
  users: EulUser[];
  grants: Grant[];
  workbooks: ParsedWorkbook[];
  workbookUsage: WorkbookUsageStat[];
}

export interface EulReadResult {
  version: EulVersionInfo;
  data: EulFullData;
}

export type ReadEulOptions = DetectEulVersionOptions;

interface OpenedEul {
  execute: OracleExecutor;
  version: EulVersionInfo;
  adapter: EulSchemaAdapter;
}

/**
 * Resolve a single pooled executor, detect the EUL version and build the
 * adapter — the shared prelude for every read below.
 */
async function openEul(source: EulSource, options: ReadEulOptions = {}): Promise<OpenedEul> {
  const execute = resolveExecutor(source);
  const version = await detectEulVersionFromExecutor(execute, options);
  const adapter = createEulSchemaAdapter(version);
  return { execute, version, adapter };
}

async function parseWorkbooks(workbooks: Workbook[]): Promise<ParsedWorkbook[]> {
  return Promise.all(
    workbooks.map(async (wb) => ({ ...wb, info: await parseWorkbookContent(wb.content) })),
  );
}

/**
 * Detect the version, adapt, and read every metadata entity through one
 * executor. Reads run sequentially to stay friendly to the small connection
 * pool and to keep the emitted SQL order deterministic.
 */
export async function readEulSchema(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<EulReadResult> {
  const { execute, version, adapter } = await openEul(source, options);

  const businessAreas = await readBusinessAreasWith(adapter, execute);
  const folders = await readFoldersWith(adapter, execute);
  const items = await readItemsWith(adapter, execute);
  const conditions = await readItemsWith(adapter, execute, { expTypes: CONDITION_EXP_TYPES });
  const securityConditions =
    version.version === 'EUL5'
      ? await readItemsWith(adapter, execute, { expTypes: SECURITY_MANAGER_EXP_TYPES })
      : [];
  const joins = await readJoinsWith(adapter, execute);
  const hierarchies = await readHierarchiesWith(adapter, execute);
  const customFunctions = await readCustomFunctionsWith(adapter, execute);
  const users = await readUsersWith(adapter, execute);
  const grants = await readGrantsWith(adapter, execute);
  const rawWorkbooks = await readWorkbooksWith(adapter, execute);
  const workbooks = await parseWorkbooks(rawWorkbooks);
  const workbookUsage = await readWorkbookUsage(adapter, execute);

  return {
    version,
    data: {
      businessAreas,
      folders,
      items,
      conditions,
      securityConditions,
      joins,
      hierarchies,
      customFunctions,
      users,
      grants,
      workbooks,
      workbookUsage,
    },
  };
}

// ---------------------------------------------------------------------------
// Per-entity convenience readers (each re-detects the version)
// ---------------------------------------------------------------------------

export async function readBusinessAreas(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<BusinessArea[]> {
  const { execute, adapter } = await openEul(source, options);
  return readBusinessAreasWith(adapter, execute);
}

export async function readFolders(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<Folder[]> {
  const { execute, adapter } = await openEul(source, options);
  return readFoldersWith(adapter, execute);
}

export async function readItems(
  source: EulSource,
  options: ReadEulOptions & { expTypes?: readonly string[] } = {},
): Promise<Item[]> {
  const { execute, adapter } = await openEul(source, options);
  return readItemsWith(adapter, execute, { expTypes: options.expTypes });
}

export async function readJoins(source: EulSource, options: ReadEulOptions = {}): Promise<Join[]> {
  const { execute, adapter } = await openEul(source, options);
  return readJoinsWith(adapter, execute);
}

export async function readHierarchies(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<Hierarchy[]> {
  const { execute, adapter } = await openEul(source, options);
  return readHierarchiesWith(adapter, execute);
}

export async function readCustomFunctions(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<CustomFunction[]> {
  const { execute, adapter } = await openEul(source, options);
  return readCustomFunctionsWith(adapter, execute);
}

export async function readUsers(source: EulSource, options: ReadEulOptions = {}): Promise<EulUser[]> {
  const { execute, adapter } = await openEul(source, options);
  return readUsersWith(adapter, execute);
}

export async function readGrants(source: EulSource, options: ReadEulOptions = {}): Promise<Grant[]> {
  const { execute, adapter } = await openEul(source, options);
  return readGrantsWith(adapter, execute);
}

export async function readWorkbooks(
  source: EulSource,
  options: ReadEulOptions = {},
): Promise<ParsedWorkbook[]> {
  const { execute, adapter } = await openEul(source, options);
  const rawWorkbooks = await readWorkbooksWith(adapter, execute);
  return parseWorkbooks(rawWorkbooks);
}
