import {
  SqlGenerationError,
  type GeneratedColumn,
  type MapDefinition,
  type SqlGenerationOptions,
} from '../../types/sql.js';
import { GenerationContext } from './context.js';
import { folderTableRef, joinOnClause } from './from-clause.js';
import { spanningJoinPath } from './folder-set.js';
import { makeColumnAlias, quoteIdentifier } from './identifiers.js';
import { buildWhereClause } from './where-clause.js';
import { effectiveAggregate } from './select-clause.js';
import type { PlanBranch, PlanColumn, RewritePlan } from './query-plan.js';

/**
 * Emit the fan-trap rewrite: one inline view per branch, joined back on the
 * master key.
 *
 * ===========================================================================
 * The shape, and why each part of it is load-bearing
 * ===========================================================================
 *
 * Oracle prints the generated SQL for its own ACCOUNT / SALES / BUDGET example
 * (`9.0.4\B10270_01.pdf` pp. 9-33…9-34). Read structurally it is:
 *
 * ```
 * SELECT   <axis columns>, REAGG_1(b1.m), REAGG_2(b2.m), …
 * FROM     (SELECT <master keys>[, <axis>], AGG(measure)
 *           FROM   <master> LEFT OUTER JOIN <detail_1> ON <predicate>
 *           WHERE  <conditions scoped to master or detail_1>
 *           GROUP BY <master keys>[, <axis>])            b1
 *          JOIN (…same for detail_2…)                    b2
 *            ON b1.<key> = b2.<key>
 * GROUP BY <axis columns>
 * ```
 *
 *  1. **Aggregation is pushed below the branch join.** Each inline view groups
 *     by the master key before anything else sees it, so no measure is ever
 *     exposed to the other branch's row multiplication.
 *  2. **The detail side is outer-joined, structurally.** This is not the join's
 *     `AllowMasterNoDetail` flag showing through — Oracle's example leaves the
 *     flags at their defaults. Inner-joining a branch would drop master rows
 *     that happen to be absent from that one detail, and those rows still have
 *     values on the other branch.
 *  3. **The outer aggregate re-aggregates**, because a branch may group finer
 *     than the outer query asks for. `SUM` over branch `SUM`, `SUM` over branch
 *     `COUNT`, `MIN`/`MAX` over themselves (D-035).
 *  4. **The axis columns ride on exactly one branch.** Duplicating a master
 *     descriptive column on every branch is harmless but pointless; the plan
 *     picks one home for each.
 *  5. **Conditions and parameters are branch-local.** A filter on branch *i*
 *     placed in the outer query silently drops master rows that branch *j*
 *     still matches. The arithmetic forces the placement, not taste.
 *
 * Oracle emitted this as a comma join with Oracle-8 `(+)` operators. Modern
 * `JOIN … ON` says the same thing and is graded a permitted modernisation.
 *
 * ===========================================================================
 * Security
 * ===========================================================================
 *
 * Every identifier still comes from metadata, is validated and is quoted; every
 * runtime value is still a bind. **Row-level security predicates are applied
 * inside every branch that contains their folder**, bracketed unconditionally —
 * a predicate applied only in the outer query would leak rows through the
 * inline view, which has already aggregated them.
 *
 * @throws SqlGenerationError for shapes this emitter does not yet write. Phase
 * 3.3 builds the guard; Phase 3.4 enables multi-folder generation and completes
 * the emitter. `buildFromClause` still refuses every multi-folder aggregate in
 * the meantime (D-014), so nothing reaches production through here yet.
 */
export function renderRewrite(
  def: MapDefinition,
  plan: RewritePlan,
  options: SqlGenerationOptions = {},
): { sql: string; bindParams: Record<string, unknown>; columns: GeneratedColumn[] } {
  const drawnCalcField = def.calculatedFields.find((f) => !f.isHidden);
  if (drawnCalcField) {
    throw new SqlGenerationError(
      `The calculation "${drawnCalcField.name}" cannot yet be shown on a worksheet that ` +
        'summarises more than one set of detail rows.',
      { calculations: [drawnCalcField.name] },
      'FAN_TRAP_REAGG',
    );
  }

  const bindParams: Record<string, unknown> = {};
  const rendered = plan.branches.map((branch) =>
    renderBranch(def, plan, branch, options, bindParams),
  );

  // -- The outer query ----------------------------------------------------
  // Every drawn column, in the map's display order, resolved to the branch
  // that carries it. Axis columns are projected; measures re-aggregate.
  const takenAliases = new Set<string>();
  const selectParts: string[] = [];
  const columns: GeneratedColumn[] = [];
  const groupByExprs: string[] = [];
  const aliasByMapItemId = new globalThis.Map<string, string>();

  const drawn = [...def.items]
    .filter(({ mapItem }) => !mapItem.isHidden)
    .sort((a, b) => a.mapItem.displayOrder - b.mapItem.displayOrder);

  for (const { mapItem, item } of drawn) {
    const home = rendered.find((r) => r.outputByMapItemId.has(mapItem.id));
    if (!home) {
      throw new SqlGenerationError(
        `Column "${mapItem.displayName || item.name}" is not carried by any branch of the plan`,
      );
    }
    const source = `${home.alias}.${home.outputByMapItemId.get(mapItem.id)!}`;
    const measure = home.branch.measures.find((m) => m.mapItemId === mapItem.id);
    const expr = measure?.reAggregate ? `${measure.reAggregate}(${source})` : source;

    const label = mapItem.displayName || item.name;
    const alias = makeColumnAlias(label, takenAliases);
    aliasByMapItemId.set(mapItem.id, alias);
    selectParts.push(`${expr} AS ${alias}`);
    columns.push({
      alias,
      label,
      isAggregate: !!measure,
      dataType: item.dataType ?? undefined,
      formatMask: mapItem.formatMask ?? undefined,
      columnWidth: mapItem.columnWidth ?? undefined,
      alignment: mapItem.alignment ?? undefined,
      wordWrap: mapItem.wordWrap ?? undefined,
      headingFormatMask: mapItem.headingFormatMask ?? undefined,
      axisType: mapItem.axisType ?? undefined,
      axisEdge: mapItem.axisEdge ?? undefined,
    });
    if (!measure) groupByExprs.push(expr);
  }

  // -- The branch join ----------------------------------------------------
  // Equi-join on the master key. Every branch outer-joins its own detail, so
  // every branch returns exactly the master's surviving rows and the join
  // between them loses nothing.
  const [first, ...rest] = rendered;
  if (!first) throw new SqlGenerationError('The query plan has no branches');

  const fromParts = [`FROM (${indent(first.sql)}) ${first.alias}`];
  for (const branch of rest) {
    const on = plan.outerKeys
      .map(
        (_, i) =>
          `${first.alias}.${keyAlias(i)} = ${branch.alias}.${keyAlias(i)}`,
      )
      .join(' AND ');
    fromParts.push(`INNER JOIN (${indent(branch.sql)}) ${branch.alias} ON ${on}`);
  }

  const sql = [
    `SELECT ${selectParts.join(',\n       ')}`,
    fromParts.join('\n'),
    groupByExprs.length ? `GROUP BY ${groupByExprs.join(', ')}` : '',
    orderByAliases(def, aliasByMapItemId),
  ]
    .filter(Boolean)
    .join('\n');

  return { sql, bindParams, columns };
}

/**
 * The outer `ORDER BY`, written against the SELECT-list aliases.
 *
 * The flat clause sorts on the item expression; here that expression lives one
 * level down, inside an inline view, so the only name in scope at this level is
 * the alias. Oracle resolves an `ORDER BY` alias against the select list, so
 * the two say the same thing.
 *
 * A sort on a HIDDEN item is dropped rather than emitted: the outer query
 * groups by the drawn columns only, so a hidden one is not in scope to sort on.
 * Narrower than the flat shape, and recorded in `docs/troubleshooting/`.
 */
function orderByAliases(
  def: MapDefinition,
  aliasByMapItemId: globalThis.Map<string, string>,
): string {
  const LAST = Number.MAX_SAFE_INTEGER;
  const parts = [...def.items]
    .filter(({ mapItem }) => mapItem.sortDirection && aliasByMapItemId.has(mapItem.id))
    .sort((a, b) => {
      const ga = a.mapItem.sortGroup ? 0 : 1;
      const gb = b.mapItem.sortGroup ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const ra = a.mapItem.sortRank ?? LAST;
      const rb = b.mapItem.sortRank ?? LAST;
      if (ra !== rb) return ra - rb;
      const oa = a.mapItem.sortOrder ?? LAST;
      const ob = b.mapItem.sortOrder ?? LAST;
      if (oa !== ob) return oa - ob;
      return a.mapItem.displayOrder - b.mapItem.displayOrder;
    })
    .map(({ mapItem }) => {
      const direction = mapItem.sortDirection === 'DESC' ? 'DESC' : 'ASC';
      return `${aliasByMapItemId.get(mapItem.id)!} ${direction}`;
    });

  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

interface RenderedBranch {
  branch: PlanBranch;
  /** Alias of the inline view in the outer query. */
  alias: string;
  sql: string;
  /** `map_items.id` → the column alias this branch exposes for it. */
  outputByMapItemId: globalThis.Map<string, string>;
}

/** `K0`, `K1`, … — the master key columns, named identically in every branch. */
function keyAlias(index: number): string {
  return `K${index}`;
}

function renderBranch(
  def: MapDefinition,
  plan: RewritePlan,
  branch: PlanBranch,
  options: SqlGenerationOptions,
  bindParams: Record<string, unknown>,
): RenderedBranch {
  // Each branch is an independent SELECT with its own aliases: the rewrite
  // repeats the master folder inside every branch, so folder → alias stops
  // being one-to-one across the statement and can only stay one-to-one within
  // a branch (D-017).
  const ctx = new GenerationContext(def, branch.folderIds);
  const outputByMapItemId = new globalThis.Map<string, string>();
  const selectParts: string[] = [];
  const groupByExprs: string[] = [];

  const masterFolderId = plan.masterFolderId;
  const masterAlias = ctx.aliasFor(masterFolderId);
  const masterFolder = ctx.getFolder(masterFolderId);

  const columnRef = (column: PlanColumn): string =>
    `${ctx.aliasFor(column.folderId)}.${quoteIdentifier(column.columnName)}`;

  // The FROM: the master, then EVERY folder this branch carries — outer,
  // always (§1.4 property 2).
  //
  // A branch is a whole subtree, not one hop. `M M67 1 -> M M67 -> LOOKUP` is
  // one branch with two edges, and a branch that emitted only its first edge
  // would alias `LOOKUP` in the SELECT while never naming it in the FROM: an
  // unbound alias, so Oracle rejects the statement — or, where the alias is
  // reachable another way, a cross join. Spanning the branch's own folder set
  // is the same computation the flat clause does, rooted at the master.
  const spanning = spanningJoinPath([masterFolderId, ...branch.folderIds.filter((id) => id !== masterFolderId)], def.joins);
  if (spanning.unreachable.length > 0) {
    const folder = ctx.getFolder(spanning.unreachable[0]!);
    throw new SqlGenerationError(
      `No join path connects folder "${folder.name}" to the rest of the query`,
      { folders: spanning.unreachable.map((id) => ctx.getFolder(id).name) },
      'NO_JOIN_PATH',
    );
  }

  const fromParts = [`FROM ${folderTableRef(masterFolder)} ${masterAlias}`];
  for (const edge of spanning.edges) {
    // `joinOnClause` refuses BY NAME when the join carries no usable
    // predicate (D-039) — the same message the flat shape gives.
    fromParts.push(
      `LEFT OUTER JOIN ${folderTableRef(ctx.getFolder(edge.to))} ${ctx.aliasFor(edge.to)} ` +
        `ON ${joinOnClause(def.joins[edge.joinIdx]!, ctx)}`,
    );
  }

  // The SELECT and GROUP BY: keys first, then this branch's axis columns.
  plan.outerKeys.forEach((key, i) => {
    const expr = columnRef(key);
    selectParts.push(`${expr} AS ${keyAlias(i)}`);
    groupByExprs.push(expr);
  });

  const mapItemById = new globalThis.Map(
    def.items.map((entry) => [entry.mapItem.id, entry]),
  );

  let axisCounter = 0;
  for (const key of branch.groupKeys) {
    if (key.kind !== 'AXIS') continue;
    const entry = mapItemById.get(key.mapItemId);
    if (!entry) continue;
    const expr = ctx.itemExpression(entry.item, entry.folder);
    const alias = `A${axisCounter++}`;
    selectParts.push(`${expr} AS ${alias}`);
    groupByExprs.push(expr);
    outputByMapItemId.set(key.mapItemId, alias);
  }

  // The measures, aggregated here — below the branch join, which is the whole
  // point of the shape.
  branch.measures.forEach((measure, i) => {
    const entry = mapItemById.get(measure.mapItemId);
    if (!entry) return;
    const aggregate = effectiveAggregate(entry.mapItem, entry.item);
    const expr = ctx.itemExpression(entry.item, entry.folder);
    const alias = `M${i}`;
    selectParts.push(`${aggregate}(${expr}) AS ${alias}`);
    outputByMapItemId.set(measure.mapItemId, alias);
  });

  // The WHERE: this branch's conditions only, and the security predicates that
  // belong to a folder inside it. A predicate left to the outer query would be
  // applied after this view has already aggregated the rows it should have
  // removed.
  const branchConditionIds = new Set(branch.conditionIds);
  const branchFolderIds = new Set(branch.folderIds);
  const where = buildWhereClause(
    { ...def, conditions: def.conditions.filter((c) => branchConditionIds.has(c.condition.id)) },
    ctx,
    {
      ...options,
      bindPrefix: `${branch.id}_`,
      securityPredicates: (options.securityPredicates ?? []).filter((p) =>
        typeof p === 'string' || !p.folderId ? true : branchFolderIds.has(p.folderId),
      ),
    },
  );
  Object.assign(bindParams, where.bindParams);

  const sql = [
    `SELECT ${selectParts.join(',\n         ')}`,
    fromParts.join('\n'),
    where.sql,
    `GROUP BY ${groupByExprs.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { branch, alias: branch.id, sql, outputByMapItemId };
}

function indent(sql: string): string {
  return `\n  ${sql.split('\n').join('\n  ')}\n`;
}
