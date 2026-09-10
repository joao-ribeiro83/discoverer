/**
 * The master–detail verification for Phase 3.4 (`legacy-analysis.md` §10.1 H3).
 *
 * READ ONLY against both databases. Builds a worksheet from THIS ESTATE'S OWN
 * migrated metadata — `M M67 1` (policy header, master) joined to `M M67`
 * (receipt lines, detail) on the three-column key the EUL actually records —
 * puts a `SUM` on a header column and a filter on the detail, and then asks
 * Oracle three questions:
 *
 *   1. **Reference.** `SUM(header)` over the headers that have at least one
 *      line matching the filter, written as an `EXISTS` so no row can repeat.
 *      This is the number the worksheet is supposed to report, and it comes
 *      from the source system, not from Neo.
 *   2. **Naive.** The flat inner join Neo would have emitted with no guard.
 *      Oracle's own worked example puts the inflation at 2-3x; this estate's
 *      own shape is where a £2.4M quarter reports as £9.6M.
 *   3. **Neo.** Whatever `generateSql` emits today, run unchanged.
 *
 * (3) must equal (1). (2) must not — if the naive query happens to agree, the
 * fixture contains no fan and the test would be passing vacuously, so that is
 * reported as a failure of the CHECK rather than a pass.
 *
 * Run inside the backend container: the Oracle Instant Client lives there and
 * this EUL account needs thick mode.
 *
 *   docker exec -e ORACLE_THICK_MODE=true discoverer-neo-backend \
 *     sh -c 'cd /app/backend && /app/node_modules/.bin/tsx src/scripts/verify-fan-trap-m67.ts'
 */
import { eq, inArray } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { folders, items, joins, joinPredicates } from '../db/schema.js';
import { getConnection, releaseConnection } from '../services/oracle-connection-pool.js';
import { generateSql } from '../services/sql-generator.js';
import { planQuery } from '../lib/sql/planner.js';
import type { MapDefinition } from '../types/sql.js';

const MASTER_FOLDER = 'M M67 1';
const DETAIL_FOLDER = 'M M67';
const JOIN_NAME = 'M M67 1 -> M M67';
/** The header column the worksheet totals. Numeric, and not part of the key. */
const MEASURE_COLUMN = 'PENALIDADE';
/**
 * The detail column the worksheet filters on. A fan needs the detail in scope,
 * and `LIKE '%'` puts it there without depending on any particular data value —
 * it matches every non-null row, so the reference query can say the same thing.
 */
const FILTER_COLUMN = 'ESTADO';
const FILTER_SQL = "LIKE '%'";

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read the real metadata
// ---------------------------------------------------------------------------

const folderRows = await db
  .select()
  .from(folders)
  .where(inArray(folders.name, [MASTER_FOLDER, DETAIL_FOLDER]));
const master = folderRows.find((f) => f.name === MASTER_FOLDER);
const detail = folderRows.find((f) => f.name === DETAIL_FOLDER);
if (!master || !detail) fail('the M67 folders are not in this target');

const itemRows = await db
  .select()
  .from(items)
  .where(inArray(items.folderId, [master.id, detail.id]));

const [joinRow] = await db.select().from(joins).where(eq(joins.name, JOIN_NAME));
if (!joinRow) fail(`join "${JOIN_NAME}" is not in this target`);
const predicateRows = await db
  .select()
  .from(joinPredicates)
  .where(eq(joinPredicates.joinId, joinRow.id));
if (predicateRows.length === 0) {
  fail('the join carries no predicate — run `dn-migrate reimport-joins` first');
}

const itemById = new Map(itemRows.map((i) => [i.id, i]));
const measureItem = itemRows.find(
  (i) => i.folderId === master.id && i.columnName === MEASURE_COLUMN,
);
const filterItem = itemRows.find(
  (i) => i.folderId === detail.id && i.columnName === FILTER_COLUMN,
);
if (!measureItem || !filterItem) fail('the measure or filter column is missing');

const folderOf = (folderId: string) => (folderId === master.id ? master : detail);

// ---------------------------------------------------------------------------
// Build the worksheet — a header total, filtered by the detail
// ---------------------------------------------------------------------------

const now = new Date();
const mapItem = {
  id: 'mi-measure',
  mapId: 'verify-m67',
  itemId: measureItem.id,
  calculatedFieldId: null,
  displayOrder: 0,
  displayName: 'Penalidade',
  isHidden: false,
  aggFunction: 'SUM',
  axisType: 'MEASURE',
} as unknown as MapDefinition['items'][number]['mapItem'];

const condition = {
  id: 'mc-filter',
  mapId: 'verify-m67',
  itemId: filterItem.id,
  operator: 'LIKE',
  value: '%',
  paramName: null,
  conditionType: 'STATIC',
  groupId: null,
  logicOperator: 'AND',
  displayOrder: 0,
  createdAt: now,
};

const def: MapDefinition = {
  map: {
    id: 'verify-m67',
    name: 'M67 fan-trap verification',
    mapType: 'TABLE',
    isActive: true,
  } as unknown as MapDefinition['map'],
  items: [{ mapItem, item: measureItem, folder: master }],
  conditions: [{ condition, item: filterItem, folder: detail }],
  parameters: [],
  calculatedFields: [],
  totals: [],
  joins: [
    {
      join: joinRow,
      leftFolder: folderOf(joinRow.leftFolderId),
      rightFolder: folderOf(joinRow.rightFolderId),
      predicates: predicateRows
        .sort((a, b) => a.seq - b.seq)
        .map((predicate) => ({
          predicate,
          leftItem: itemById.get(predicate.leftItemId ?? '') ?? null,
          rightItem: itemById.get(predicate.rightItemId ?? '') ?? null,
        })),
    },
  ],
  formulaItems: itemRows.map((item) => ({ item, folder: folderOf(item.folderId) })),
} as unknown as MapDefinition;

const plan = planQuery(def);
console.log(`plan decision: ${plan.decision}`);
if (plan.kind !== 'REWRITE') {
  fail(
    `expected REWRITE, got ${plan.decision}. A header measure filtered by its ` +
      'detail is the fan trap this stage exists to guard.',
  );
}

const generated = generateSql(def);
console.log('\n--- Neo\'s SQL ---\n' + generated.sql + '\n');

// ---------------------------------------------------------------------------
// The three questions, asked of Oracle
// ---------------------------------------------------------------------------

const q = (name: string) => `"${name}"`;
const masterTable = `${q(master.tableOwner!)}.${q(master.tableName!)}`;
const detailTable = `${q(detail.tableOwner!)}.${q(detail.tableName!)}`;
const onClause = predicateRows
  .sort((a, b) => a.seq - b.seq)
  .map((p) => {
    const l = itemById.get(p.leftItemId ?? '');
    const r = itemById.get(p.rightItemId ?? '');
    if (!l || !r) fail('a join predicate endpoint did not migrate');
    return `h.${q(l.columnName!)} ${p.operator} d.${q(r.columnName!)}`;
  })
  .join(' AND ');

const REFERENCE = `SELECT SUM(h.${q(MEASURE_COLUMN)}) AS TOTAL FROM ${masterTable} h
 WHERE EXISTS (SELECT 1 FROM ${detailTable} d WHERE ${onClause} AND d.${q(FILTER_COLUMN)} ${FILTER_SQL})`;

const NAIVE = `SELECT SUM(h.${q(MEASURE_COLUMN)}) AS TOTAL FROM ${masterTable} h
 INNER JOIN ${detailTable} d ON ${onClause}
 WHERE d.${q(FILTER_COLUMN)} ${FILTER_SQL}`;

const conn = await getConnection(String(master.dataSourceId));
try {
  const runOne = async (label: string, sqlText: string, binds: Record<string, unknown> = {}) => {
    const result = (await conn.execute(
      sqlText,
      binds as never,
      { outFormat: 4002 /* OUT_FORMAT_OBJECT */ },
    )) as { rows?: Array<Record<string, unknown>> };
    const rows = result.rows ?? [];
    const total = rows.reduce((sum, row) => {
      const v = Object.values(row).find((x) => typeof x === 'number');
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
    console.log(`${label.padEnd(28)} rows=${String(rows.length).padStart(6)}  total=${total}`);
    return total;
  };

  const reference = await runOne('1. Oracle reference', REFERENCE);
  const naive = await runOne('2. naive flat join', NAIVE);
  const neo = await runOne('3. Neo (rewritten)', generated.sql, generated.bindParams);

  console.log('');
  if (naive === reference) {
    fail(
      'the naive join returned the reference total, so this shape contains no ' +
        'fan and the check would have passed vacuously',
    );
  }
  if (neo !== reference) {
    fail(`Neo returned ${neo}, the source system says ${reference}`);
  }
  const inflation = reference === 0 ? 0 : naive / reference;
  console.log(
    `PASS — Neo matches the source system (${neo}). The unguarded join would ` +
      `have reported ${naive}, an inflation of ${inflation.toFixed(2)}x.`,
  );
} finally {
  await releaseConnection(String(master.dataSourceId), conn);
  await pool.end();
  process.exit(0);
}
