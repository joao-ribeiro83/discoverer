import type { Redis } from 'ioredis';
import type { BindParameters, Connection } from 'oracledb';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  folders,
  itemClasses,
  items,
  securityPolicies,
  securityPolicyRules,
} from '../db/schema.js';
import { assertDataEntitlement, businessAreasForFolders } from './business-area.service.js';
import { getUserPolicies } from './security.service.js';
import { folderTableRef } from '../lib/sql/from-clause.js';
import { quoteIdentifier } from '../lib/sql/identifiers.js';
import { ALIAS_TOKEN_RE, referencedBindNames } from '../lib/sql/security-predicates.js';
import * as pool from './oracle-connection-pool.js';

/**
 * Lists of values — the live pick-list behind a parameter prompt or a
 * condition's value box.
 *
 * Discoverer never stored LOV values: "the values are those values in the
 * database column on which the item is based" (`9.0.4/B10270_01.pdf` p. 8-3).
 * So this runs `SELECT DISTINCT` against the customer's Oracle whenever the
 * cache misses. Migrating the values as a static enum would freeze data that
 * changes daily.
 *
 * ## Two sources, one shape
 *
 * An **item class** (`item_classes`) is the configured source: it names the
 * item the LOV reads from, optionally a second item to order by, and carries
 * the `cached` / `cardinality` hints Discoverer used to judge how expensive
 * the query was.
 *
 * When an item has no class, the LOV falls back to the item's **own column**.
 * That is a deliberate departure from Discoverer, which showed a free-text box
 * in that case — see `docs/decisions/eul-fidelity-decisions.md` Decision 8. It
 * is what makes the feature reach the 7 521 parameters and 5 605 conditions on
 * an estate whose `EUL4_DOMAINS` is empty. It adds a dropdown, never removes
 * one, and it cannot reveal a value the user could not already query.
 *
 * ## The SQL surface
 *
 * This is a NEW place where metadata-supplied identifiers become SQL, so the
 * same three rules as the query generator apply, for the same reasons:
 *
 *  - identifiers are **validated and rejected**, never escaped
 *    (`quoteIdentifier` throws on anything outside the pattern);
 *  - every runtime value is a **bind**, the search term included;
 *  - entitlement is checked **before** the query runs, on the folder actually
 *    read from, and row-level security predicates are ANDed in.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Rows returned when the caller does not ask for a specific number. */
export const LOV_DEFAULT_LIMIT = 200;

/** Hard ceiling. A dropdown is not a result set. */
export const LOV_MAX_LIMIT = 1000;

/**
 * Above this many distinct values, the pick-list stops being a list.
 *
 * Oracle documents the same switch as "long LOVs": past a point the dropdown
 * becomes a search box. The estimate comes from `item_classes.cardinality`
 * (`DOM_CARDINALITY`) when the source recorded one; with no estimate the query
 * runs capped and `truncated` tells the UI to offer search anyway.
 */
export const LOV_SEARCH_THRESHOLD = 500;

/** Redis namespace and TTL. Short — the point of a live LOV is that it is live. */
const CACHE_PREFIX = 'lov:';
const CACHE_TTL_SECONDS = 120;

/** node-oracledb's OUT_FORMAT_OBJECT, hard-coded as elsewhere in this codebase. */
const OUT_FORMAT_OBJECT = 4002;

/** The query alias, so a `{alias}`-using security predicate has something to bind to. */
const LOV_ALIAS = 'lov';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LovErrorKind =
  /** The item has no column to read — a calculation, or a folder with no source. */
  | 'UNAVAILABLE'
  /** A metadata identifier failed validation. */
  | 'INVALID_IDENTIFIER'
  /** A policy-bearing folder for which this user resolves no predicate. */
  | 'FORBIDDEN';

export class LovError extends Error {
  constructor(
    readonly kind: LovErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LovError';
  }
}

export interface LovOptions {
  /** Prefix filter, case-insensitive. Bound, never interpolated. */
  search?: string;
  limit?: number;
  /** Page offset, so a capped list can still be walked. */
  offset?: number;
}

export interface LovResult {
  /**
   * `values` — here is the list.
   * `search` — too many distinct values to list; the caller must supply a
   * search term. Never returned when a search term was already given.
   */
  mode: 'values' | 'search';
  values: string[];
  /** True when the cap cut the list short — there are more values than these. */
  truncated: boolean;
  /** The class that configured this LOV, or null when it fell back to the item. */
  itemClassId: string | null;
  /** The source's own distinct-value estimate, when it recorded one. */
  cardinality: number | null;
}

// ---------------------------------------------------------------------------
// Metadata resolution
// ---------------------------------------------------------------------------

export interface LovSource {
  itemClassId: string | null;
  cardinality: number | null;
  cacheable: boolean;
  /** Folder actually read from. */
  folderId: string;
  /** Every folder entitlement must cover. */
  folderIds: string[];
  dataSourceId: string;
  tableRef: string;
  valueColumn: string;
  sortColumn: string | null;
}

/** The item row plus the folder it lives in. */
async function loadItemWithFolder(itemId: string) {
  const [row] = await db
    .select({
      id: items.id,
      name: items.name,
      columnName: items.columnName,
      itemClassId: items.itemClassId,
      folder: folders,
    })
    .from(items)
    .innerJoin(folders, eq(items.folderId, folders.id))
    .where(and(eq(items.id, itemId), eq(items.isActive, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Work out what to query: from the item class when there is one, from the item
 * itself when there is not.
 */
export async function resolveLovSource(itemId: string): Promise<LovSource> {
  const item = await loadItemWithFolder(itemId);
  if (!item) throw new LovError('UNAVAILABLE', 'Item not found');

  let valueItem = item;
  let sortColumn: string | null = null;
  let cardinality: number | null = null;
  // With no class there is nothing saying the column is volatile, so the
  // fallback LOV caches. A class that says `DOM_CACHED = 0` turns it off.
  let cacheable = true;
  let classId: string | null = null;

  if (item.itemClassId) {
    const [cls] = await db
      .select()
      .from(itemClasses)
      .where(eq(itemClasses.id, item.itemClassId))
      .limit(1);
    if (cls) {
      classId = cls.id;
      cardinality = cls.cardinality;
      cacheable = cls.cached;
      if (cls.sourceItemId) {
        const lovItem = await loadItemWithFolder(cls.sourceItemId);
        if (lovItem) valueItem = lovItem;
      }
      if (cls.sortItemId) {
        const sortItem = await loadItemWithFolder(cls.sortItemId);
        // "The two items must be in the same folder" (p. 8-4). A sort item
        // anywhere else cannot be selected alongside the value, so it is
        // dropped rather than turned into a join this has no business making.
        if (sortItem && sortItem.folder.id === valueItem.folder.id) {
          sortColumn = sortItem.columnName;
        }
      }
    }
  }

  if (!valueItem.columnName) {
    throw new LovError(
      'UNAVAILABLE',
      `"${valueItem.name}" has no database column, so it has no list of values`,
    );
  }
  if (!valueItem.folder.dataSourceId) {
    throw new LovError(
      'UNAVAILABLE',
      `Folder "${valueItem.folder.name}" has no data source, so nothing can be queried`,
    );
  }

  let tableRef: string;
  let valueColumn: string;
  let quotedSort: string | null = null;
  try {
    tableRef = folderTableRef(valueItem.folder);
    valueColumn = quoteIdentifier(valueItem.columnName);
    if (sortColumn) quotedSort = quoteIdentifier(sortColumn);
  } catch (err) {
    // A table, owner or column name that is not a legal identifier is
    // REJECTED, not escaped — the same rule the query generator applies. These
    // names come out of an EUL nobody in this codebase controls.
    throw new LovError(
      'INVALID_IDENTIFIER',
      err instanceof Error ? err.message : 'Invalid identifier in metadata',
    );
  }

  // Entitlement covers the folder actually read from AND the folder the caller
  // named; they differ when an item class points at another folder's item.
  const folderIds = [...new Set([item.folder.id, valueItem.folder.id])];

  return {
    itemClassId: classId,
    cardinality,
    cacheable,
    folderId: valueItem.folder.id,
    folderIds,
    dataSourceId: valueItem.folder.dataSourceId,
    tableRef,
    valueColumn,
    sortColumn: quotedSort,
  };
}

// ---------------------------------------------------------------------------
// Row-level security
// ---------------------------------------------------------------------------

export interface LovSecurity {
  predicates: string[];
  binds: Record<string, unknown>;
}

/** Does any ACTIVE policy rule target this folder, or a business area it is in? */
async function folderIsPolicyBearing(folderId: string, areaIds: string[]): Promise<boolean> {
  const rows = await db
    .select({ id: securityPolicyRules.id })
    .from(securityPolicyRules)
    .innerJoin(securityPolicies, eq(securityPolicyRules.policyId, securityPolicies.id))
    .where(
      and(
        eq(securityPolicies.isActive, true),
        inArray(securityPolicyRules.targetId, [folderId, ...areaIds]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Row-level security for the one folder this LOV reads.
 *
 * Deliberately narrower than `resolveSecurityPredicates`, which works over a
 * map's whole folder set. The same two rules hold, though:
 *
 *  - applicable predicates are ANDed into the WHERE clause;
 *  - a folder that SOMEONE's active policy targets, but for which THIS user
 *    resolves no predicate, is refused rather than listed unfiltered (D-116).
 *    A pick-list that leaked the values a policy exists to hide would be that
 *    policy's most convenient bypass.
 */
export async function resolveLovSecurity(
  folderId: string,
  user: { id: string; role: string },
): Promise<LovSecurity> {
  const baByFolder = await businessAreasForFolders([folderId]);
  const areaIds = baByFolder.get(folderId) ?? [];

  const policies = await getUserPolicies(user.id, user.role);
  const predicates: string[] = [];
  for (const policy of policies) {
    for (const rule of policy.rules) {
      const applies =
        (rule.targetType === 'FOLDER' && rule.targetId === folderId) ||
        (rule.targetType === 'BUSINESS_AREA' && areaIds.includes(rule.targetId));
      if (applies) predicates.push(rule.sqlPredicate);
    }
  }

  if (predicates.length === 0) {
    if (await folderIsPolicyBearing(folderId, areaIds)) {
      throw new LovError(
        'FORBIDDEN',
        'This folder is covered by a row-level security policy you have no rule for',
      );
    }
    return { predicates: [], binds: {} };
  }

  return {
    predicates,
    binds: { current_user_id: user.id, current_user_role: user.role },
  };
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

export interface BuiltLovQuery {
  sql: string;
  binds: Record<string, unknown>;
}

/**
 * `SELECT DISTINCT` over one column, capped and paged with `ROWNUM`.
 *
 * `ROWNUM` rather than `OFFSET … FETCH FIRST`: a Discoverer 4.1 estate is
 * routinely still on Oracle 11g or earlier, where the ANSI form is a syntax
 * error. One row past the cap is fetched, so a full page can be reported as
 * truncated without a second counting query.
 */
export function buildLovQuery(
  source: Pick<LovSource, 'tableRef' | 'valueColumn' | 'sortColumn'>,
  security: LovSecurity,
  options: { search?: string; limit: number; offset: number },
): BuiltLovQuery {
  const binds: Record<string, unknown> = {};
  const where: string[] = [`${source.valueColumn} IS NOT NULL`];

  if (options.search !== undefined && options.search !== '') {
    // Bound, and the wildcard is appended in SQL so the user's own `%` and `_`
    // stay literal characters via ESCAPE instead of becoming patterns.
    binds.lov_search = options.search.toUpperCase().replace(/([\\%_])/g, '\\$1');
    where.push(`UPPER(${source.valueColumn}) LIKE :lov_search || '%' ESCAPE '\\'`);
  }

  for (const predicate of security.predicates) {
    ALIAS_TOKEN_RE.lastIndex = 0;
    where.push(`(${predicate.replace(ALIAS_TOKEN_RE, LOV_ALIAS)})`);
    ALIAS_TOKEN_RE.lastIndex = 0;
    // Only the context binds a predicate actually names are passed: an unused
    // bind is an error on some drivers and noise on all of them.
    for (const name of referencedBindNames(predicate)) {
      if (name in security.binds) binds[name] = security.binds[name];
    }
  }

  const select = source.sortColumn
    ? `DISTINCT ${source.valueColumn} AS LOV_VALUE, ${source.sortColumn} AS LOV_SORT`
    : `DISTINCT ${source.valueColumn} AS LOV_VALUE`;
  const orderBy = source.sortColumn ? 'LOV_SORT, LOV_VALUE' : 'LOV_VALUE';

  binds.lov_last = options.offset + options.limit + 1;
  binds.lov_first = options.offset;

  const inner =
    `SELECT ${select} FROM ${source.tableRef} ${LOV_ALIAS}` +
    ` WHERE ${where.join(' AND ')}` +
    ` ORDER BY ${orderBy}`;

  return {
    sql:
      'SELECT LOV_VALUE FROM (' +
      `SELECT LOV_VALUE, ROWNUM AS LOV_RN FROM (${inner}) WHERE ROWNUM <= :lov_last` +
      ') WHERE LOV_RN > :lov_first',
    binds,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ResolveLovDeps {
  getConnection: (dataSourceId: string) => Promise<Connection>;
  releaseConnection: (dataSourceId: string, conn: Connection) => Promise<void>;
}

export function defaultLovDeps(): ResolveLovDeps {
  return {
    getConnection: pool.getConnection,
    releaseConnection: pool.releaseConnection,
  };
}

/** What one Oracle round-trip yields: the values, and whether the cap bit. */
interface LovPage {
  values: string[];
  truncated: boolean;
}

async function runLovQuery(
  dataSourceId: string,
  sql: string,
  binds: Record<string, unknown>,
  limit: number,
  deps: ResolveLovDeps,
): Promise<LovPage> {
  const conn = await deps.getConnection(dataSourceId);
  try {
    const result = await conn.execute(sql, binds as BindParameters, {
      outFormat: OUT_FORMAT_OBJECT,
      maxRows: limit + 1,
    });
    const rows = (result.rows ?? []) as Array<{ LOV_VALUE: unknown }>;
    const values = rows
      .map((row) => row.LOV_VALUE)
      .filter((value) => value !== null && value !== undefined)
      .map((value) =>
        value instanceof Date ? value.toISOString().slice(0, 10) : String(value),
      );
    // `SELECT DISTINCT` is distinct in ORACLE's terms, and an Oracle DATE
    // carries a time. Two rows a second apart are two distinct values to the
    // database and one string here, so a pick-list over a DATE column comes
    // back with the same day repeated — measured on the live estate, where
    // 2018-03-27 appeared six times in 200 rows. Collapse them again on this
    // side, where the truncation that caused it happened.
    //
    // Truncation is judged on the ROW count, not the deduplicated one: after
    // collapsing, a full page looks short, and reporting it as complete would
    // hide the values beyond the cap.
    return { values: [...new Set(values)].slice(0, limit), truncated: rows.length > limit };
  } finally {
    await deps.releaseConnection(dataSourceId, conn);
  }
}

/**
 * The live list of values for an item, for this user.
 *
 * The order of operations is not incidental: metadata first (so a bad
 * identifier is rejected before anything connects), then entitlement, then
 * row-level security, then the cache, then Oracle.
 */
export async function resolveLov(
  itemId: string,
  user: { id: string; role: string },
  options: LovOptions = {},
  redis?: Redis,
  deps: ResolveLovDeps = defaultLovDeps(),
): Promise<LovResult> {
  const source = await resolveLovSource(itemId);

  await assertDataEntitlement(user.id, source.folderIds);
  const security = await resolveLovSecurity(source.folderId, user);

  const search = options.search?.trim() ?? '';
  const limit = Math.min(Math.max(options.limit ?? LOV_DEFAULT_LIMIT, 1), LOV_MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  // The source's own estimate is the cheapest way to know a dropdown is the
  // wrong control. With no search term and too many values, say so rather than
  // run a query whose answer cannot be displayed.
  if (search === '' && source.cardinality !== null && source.cardinality > LOV_SEARCH_THRESHOLD) {
    return {
      mode: 'search',
      values: [],
      truncated: true,
      itemClassId: source.itemClassId,
      cardinality: source.cardinality,
    };
  }

  const { sql, binds } = buildLovQuery(source, security, { search, limit, offset });

  // Never cache across users once a policy narrows the rows: the cached list
  // would be one user's view handed to the next. Nor when the source flagged
  // the class uncached.
  const cacheable = security.predicates.length === 0 && source.cacheable;
  const key = `${CACHE_PREFIX}${source.dataSourceId}:${itemId}:${offset}:${limit}:${search.toUpperCase()}`;

  let page: LovPage | null = null;
  if (cacheable && redis) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) page = JSON.parse(raw) as LovPage;
    } catch {
      // A cache miss and a broken cache are the same thing here.
    }
  }

  if (page === null) {
    page = await runLovQuery(source.dataSourceId, sql, binds, limit, deps);
    if (cacheable && redis) {
      try {
        await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(page));
      } catch {
        // Best effort, as everywhere else.
      }
    }
  }

  return {
    mode: 'values',
    values: page.values,
    truncated: page.truncated,
    itemClassId: source.itemClassId,
    cardinality: source.cardinality,
  };
}
