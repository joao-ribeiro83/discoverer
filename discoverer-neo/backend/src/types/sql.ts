import type {
  Map,
  MapItem,
  MapCondition,
  MapParameter,
  MapCalculatedField,
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

export interface SqlGenerationOptions {
  /** Runtime parameter values; LIST values expand IN clauses. */
  parameterValues?: Record<string, unknown>;
  /** Extra WHERE predicates (row-level security), ANDed in. */
  securityPredicates?: string[];
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
}

export interface GeneratedColumn extends ColumnFormat {
  /** SQL alias of the column in the SELECT list. */
  alias: string;
  /** Display label (map item displayName, item name, or calc field name). */
  label: string;
  /** True when the column is wrapped in an aggregate function. */
  isAggregate: boolean;
}

export interface GeneratedSql {
  sql: string;
  bindParams: Record<string, unknown>;
  hasAggregates: boolean;
  columns: GeneratedColumn[];
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

export class SqlGenerationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'SqlGenerationError';
  }
}
