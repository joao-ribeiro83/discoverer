import type {
  Map,
  MapItem,
  MapCondition,
  MapParameter,
  MapCalculatedField,
  MapTotal,
  Item,
  Folder,
  Join,
} from '../db/schema.js';

/**
 * Everything the SQL generator needs, pre-loaded. Keeping this a plain data
 * bundle makes the generator a pure function that can be unit-tested without
 * a database.
 */
export interface MapDefinition {
  map: Map;
  /** Selected columns, each with its metadata item and owning folder. */
  items: Array<{ mapItem: MapItem; item: Item; folder: Folder }>;
  /** Conditions with their metadata item and owning folder. */
  conditions: Array<{ condition: MapCondition; item: Item; folder: Folder }>;
  parameters: MapParameter[];
  calculatedFields: MapCalculatedField[];
  /**
   * Totals and percentages the map draws (`map_totals`). Optional because a
   * map authored before the table existed — and every caller that builds a
   * definition by hand — simply has none; the generator then emits no totals
   * queries and behaves exactly as it did before.
   */
  totals?: MapTotal[];
  /** All joins available in the business area (with side items/folders). */
  joins: Array<{
    join: Join;
    leftItem: Item;
    rightItem: Item;
    leftFolder: Folder;
    rightFolder: Folder;
  }>;
  /**
   * Items usable in formulas (usually all items of the folders involved).
   * Resolved by name, case-insensitively.
   */
  formulaItems: Array<{ item: Item; folder: Folder }>;
}

/**
 * One row-level security predicate to AND into the WHERE clause.
 *
 * When `folderId` is set (a FOLDER-targeted policy rule), any `{alias}`
 * token in the SQL is replaced with that folder's assigned query alias at
 * generation time — admins cannot know the alias (f1, f2, …) up front.
 * Predicates without a folder target must be self-contained.
 */
export interface SecurityPredicate {
  sql: string;
  folderId?: string;
}

export interface SqlGenerationOptions {
  /** Runtime parameter values; LIST values expand IN clauses. */
  parameterValues?: Record<string, unknown>;
  /**
   * Extra WHERE predicates (row-level security), ANDed in. Plain strings are
   * accepted as shorthand for `{ sql }` (no alias substitution).
   */
  securityPredicates?: Array<string | SecurityPredicate>;
  /**
   * Values for the context binds security predicates may reference
   * (e.g. `:current_user_id`). Only binds actually referenced by an applied
   * predicate are added to the statement's bind set — Oracle rejects unused
   * binds — and a referenced bind missing from this map is a hard error.
   */
  securityBindParams?: Record<string, unknown>;
  /** Max rows (FETCH FIRST). */
  rowLimit?: number;
  /** OFFSET for pagination. */
  offset?: number;
}

/**
 * Presentation metadata carried alongside a column so file exports can format
 * cells without re-reading the map definition.
 *
 * These are populated from the map item that produced the column. Columns with
 * no owning map item (stored calculated fields) leave them undefined, and
 * consumers fall back to inferring format from the runtime value.
 */
export interface ColumnFormat {
  /** Raw Oracle DATA_TYPE of the source item, e.g. 'NUMBER', 'DATE'. */
  dataType?: string;
  /** The map item's configured format mask, if any. */
  formatMask?: string;
  /** The map item's configured column width, if any. */
  columnWidth?: number;
  /** Data-cell alignment, when the map item states one. */
  alignment?: 'LEFT' | 'CENTER' | 'RIGHT';
  /** Wrap long values in the cell, when the map item states it. */
  wordWrap?: boolean;
  /** Format mask for the heading, when it carries one of its own. */
  headingFormatMask?: string;
  /**
   * Where the worksheet placed this column — Discoverer's `EDCBAxisType`.
   * A renderer needs it to lay out a crosstab; the SQL does not use it beyond
   * declining to apply an item's default aggregation to an `AXIS` column.
   */
  axisType?: 'AXIS' | 'MEASURE' | 'PAGE';
  /**
   * Which edge of a crosstab an `AXIS` column sits on. Null on everything the
   * migration produces — Discoverer records no such field — so it is only ever
   * set by someone building a crosstab in Neo.
   */
  axisEdge?: 'ROW' | 'COLUMN';
}

export interface GeneratedColumn extends ColumnFormat {
  /** SQL alias of the column in the SELECT list. */
  alias: string;
  /** Display label (map item displayName, item name, or calc field name). */
  label: string;
  /** True when the column is wrapped in an aggregate function. */
  isAggregate: boolean;
}

/**
 * One total (or percentage) a totals query returns.
 *
 * `alias` names it in that query's result set; `targetAlias` names the column
 * of the *main* query it belongs under, so a renderer can put the number in
 * the right place without re-reading the map definition. A target the map does
 * not draw (a hidden item) has no main-query column and leaves `targetAlias`
 * undefined.
 */
export interface GeneratedTotal {
  /** `map_totals.id`, so a caller can trace a number back to its row. */
  id: string;
  kind: 'TOTAL' | 'PERCENTAGE';
  /** Alias of this value inside the totals query's SELECT list. */
  alias: string;
  /** Alias of the column being totalled in the main query, when it is drawn. */
  targetAlias?: string;
  /** Display label of the column being totalled. */
  targetLabel: string;
  /**
   * The aggregate applied, or `INLINE` when the target is a calculation that
   * already aggregates and is therefore emitted unwrapped.
   */
  aggFunction: string;
  /**
   * Discoverer's label template, `&value` / `&item` interpolation intact. The
   * renderer substitutes; the generator does not, because the value only
   * exists once the query has run.
   */
  label?: string;
  displayOrder: number;
}

/**
 * One statement that produces a set of totals.
 *
 * Totals are a second query rather than a `ROLLUP` bolted onto the first: a
 * Discoverer worksheet shows detail rows *and* totals, and one grouped
 * statement cannot return both. Keeping them apart also means the detail query
 * stays exactly what it was — paginated, ordered, unchanged — while the totals
 * are computed over the whole filtered set rather than over the fetched page.
 *
 * Every totals query carries the main query's FROM and WHERE, and therefore
 * its bind parameters, minus pagination.
 */
export interface GeneratedTotalsQuery {
  /**
   * Alias of the break column in this query, or null for the grand-total
   * query. `AT_CHANGE` totals that break on the same column share one query.
   */
  breakAlias: string | null;
  /** Display label of the break column, when there is one. */
  breakLabel?: string;
  /** Alias of the break column in the *main* query, when it is drawn there. */
  breakTargetAlias?: string;
  sql: string;
  /**
   * The binds this statement needs — the main query's, minus pagination.
   * Carried per query rather than shared, because Oracle rejects a bind the
   * statement does not reference and a totals query has no OFFSET/FETCH.
   */
  bindParams: Record<string, unknown>;
  totals: GeneratedTotal[];
}

export interface GeneratedSql {
  sql: string;
  bindParams: Record<string, unknown>;
  hasAggregates: boolean;
  columns: GeneratedColumn[];
  /** True when the statement was emitted as `SELECT DISTINCT`. */
  distinct: boolean;
  /**
   * Aliases of the group/break columns, outermost first — the columns the
   * statement sorts on before anything else, and therefore the ones a renderer
   * draws a break at each change in. Empty when the map has no group sort.
   *
   * Only columns the map draws appear: a break on a hidden item groups the
   * rows but has no column to print the value in.
   */
  groupBreakAliases: string[];
  /**
   * Totals statements to run alongside the main query. Empty when the map
   * defines none. Each takes `bindParams` minus the pagination binds.
   */
  totals: GeneratedTotalsQuery[];
  /**
   * Map semantics that could not be expressed in this statement — a sort on a
   * hidden item under `SELECT DISTINCT`, a total whose aggregate did not
   * migrate. Advisory: the query is still valid and still runs.
   */
  warnings: string[];
}

/**
 * Statements needed to obtain an Oracle execution plan. EXPLAIN PLAN works
 * with bind placeholders present, so generated SQL can be explained as-is.
 */
export interface ExplainPlan {
  statementId: string;
  /** `EXPLAIN PLAN ... FOR <sql>` — execute first (returns no rows). */
  explainStatement: string;
  /** DBMS_XPLAN query returning the formatted plan, one row per line. */
  planQuery: string;
}

/**
 * A refusal is a `SqlGenerationError` the planner raises deliberately, because
 * it can build the SQL but cannot vouch for the answer. It carries a stable
 * code so the client can explain it instead of showing the message as an
 * error — the copy belongs to the UI and has to translate (D-036).
 */
export type RefusalCode = 'MULTI_FOLDER_AGGREGATE' | 'NO_JOIN_PATH';

export class SqlGenerationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
    /** Set only for deliberate refusals; absent means a genuine config error. */
    public code?: RefusalCode,
  ) {
    super(message);
    this.name = 'SqlGenerationError';
  }
}
