import type { Folder } from '../../db/schema.js';
import { SqlGenerationError, type MapDefinition } from '../../types/sql.js';
import { effectiveFolderSet, type EffectiveFolderSet } from './folder-set.js';
import { effectiveAggregate } from './select-clause.js';
import { AGGREGATE_FUNCTIONS } from './formula-parser.js';
import {
  RE_AGGREGATE,
  UNREAGGREGATABLE,
  type FlatReason,
  type PlanBranch,
  type PlanColumn,
  type PlanGroupKey,
  type PlanMeasure,
  type PlanPredicateComponent,
  type QueryPlan,
  type RefusalRule,
} from './query-plan.js';

/**
 * The fan-trap planner — `legacy-analysis.md` §1.11, steps 0 to 10.
 *
 * A fan trap is a master folder joined to detail folders that return more than
 * one row per master row. Aggregate across that expansion and every master
 * value is counted once per detail row: Oracle's own worked example inflates
 * two measures at once, 400 reported as 800 and 400 reported as 1200. In this
 * estate the same shape is `M M67 1 -> M M67`, header to lines, where a £2.4M
 * quarter would report as £9.6M — silently, to users with fifteen years of
 * trained trust in the numbers.
 *
 * Discoverer's answer was not to detect the expansion in the data. **It was
 * told, per join, by one boolean** (`OneToOne`, whose only documented effect is
 * fan-trap detection), and it aggregated each detail branch in its own inline
 * view before joining the branches back on the master key.
 *
 * This function reproduces that decision procedure and stops there: it decides,
 * it never emits. `renderRewrite` writes the SQL; `buildFromClause` writes the
 * flat shape. Neither decides for itself (D-018).
 */
export function planQuery(
  def: MapDefinition,
  folderSet: EffectiveFolderSet = deriveFolderSet(def),
): QueryPlan {
  const fromFolderIds = folderSet.columnBearingFolderIds;
  const folderIds = [
    ...fromFolderIds,
    ...folderSet.joinPathFolderIds.map((f) => f.folderId),
  ];
  const folderName = folderNamer(def);

  const measures = collectMeasures(def);
  const base = { folderSet, folderIds, fromFolderIds, measures };

  const flat = (reason: FlatReason): QueryPlan => ({
    ...base,
    kind: 'FLAT',
    reason,
    decision: `FLAT(${reason})`,
  });

  const refuse = (
    rule: RefusalRule,
    folders: string[],
    message: string,
  ): QueryPlan => ({
    ...base,
    kind: 'REFUSE',
    rule,
    folders,
    message,
    decision: `REFUSE(${rule})`,
  });

  // -- Step 0 -------------------------------------------------------------
  // No aggregate exists, so nothing can be inflated. A fan trap is an
  // aggregation defect only.
  //
  // This is the step that makes an unpopulated measure set fatal rather than
  // merely incomplete: with `map_items.agg_function` null across the estate
  // every query would take this path, and the whole guard would ship present,
  // unit-tested and structurally inert (D-031). `checkPlannerLive` in the
  // migration verifier exists to catch exactly that.
  if (measures.length === 0) return flat('NO_MEASURES');

  // -- Step 1 -------------------------------------------------------------
  // The join subgraph over the folders the query actually uses.
  if (fromFolderIds.length <= 1) return flat('SINGLE_FOLDER');

  const graph = buildGraph(def, folderIds);
  if (!isConnected(graph, fromFolderIds)) {
    // The FROM clause raises `NO_JOIN_PATH` by name a moment later, with the
    // message this estate's users already know. Nothing to plan over here.
    return flat('DISCONNECTED');
  }

  // -- Steps 2-5 ----------------------------------------------------------
  const columnBearing = new Set(fromFolderIds);
  const measureFolders = new Set(measures.map((m) => m.folderId));
  const axisFolders = axisItemFolders(def);

  /** Every folder that could be the single master of a fan (step 5 + 5a). */
  const candidates: FanCandidate[] = [];

  for (const folderId of folderIds) {
    const live = liveBranchesOf(graph, folderId, columnBearing);
    const fanning = live.filter((b) => b.fanning);
    if (fanning.length === 0) continue;

    const withMeasure = fanning.filter((b) =>
      [...b.subtree].some((id) => measureFolders.has(id)),
    );
    const masterMeasures = measures.filter((m) => m.folderId === folderId);

    // Step 5:  >= 2 fanning branches each contributing a measure.
    // Step 5a: a MASTER-side measure alongside >= 1 fanning branch. The
    //          master's value repeats once per detail row, so this is a fan
    //          trap with ONE branch — the £2.4M -> £9.6M case. A guard keyed
    //          on "two or more branches" walks straight past it (D-034).
    if (withMeasure.length >= 2 || masterMeasures.length >= 1) {
      candidates.push({
        folderId,
        fanning,
        withMeasure,
        masterMeasures,
        nonFanning: live.filter((b) => !b.fanning),
      });
    }
  }

  if (candidates.length === 0) return flat('NO_FAN_CANDIDATE');

  // -- Step 6, R1-R3 ------------------------------------------------------
  // Tested in §1.5's own order, and across every candidate before R4 is
  // considered: R1-R3 name a specific defect in a specific pair of folders,
  // while R4 only says "more than one fan". A query that is both gets the
  // message that tells the user what to change.
  for (const candidate of candidates) {
    const refusal = refuseR1toR3(candidate, graph, axisFolders, folderName);
    if (refusal) return { ...base, ...refusal };
  }

  // -- Step 6, R4 ---------------------------------------------------------
  // Two masters with detail branches is not one fan; branch identity is
  // undefined and there is no single key to join the branches back on.
  if (candidates.length > 1) {
    return refuse(
      'R4',
      candidates.map((c) => folderName(c.folderId)),
      'This query fans out from more than one folder at once, so there is no single ' +
        'master to summarise each branch against.',
    );
  }

  const master = candidates[0]!;
  const masterName = folderName(master.folderId);

  // A calculation that aggregates cannot be attributed to a branch: its
  // formula may read columns from several. Refusing is the honest answer —
  // no map in this estate has one on a multi-folder worksheet.
  const aggregatingCalc = def.calculatedFields.find(
    (f) => !f.isHidden && containsAggregateCall(f.formula),
  );
  if (aggregatingCalc) {
    return refuse(
      'REAGG',
      [masterName],
      `The calculation "${aggregatingCalc.name}" already totals values, and this query ` +
        'summarises more than one set of detail rows. Neo cannot tell which set the ' +
        'calculation belongs to.',
    );
  }

  // -- Step 8, re-aggregation ---------------------------------------------
  // Checked before the branches are built: a measure that cannot cross the fan
  // refuses whatever shape the rewrite would take (D-035).
  const unreaggregatable = measures.find(
    (m) => UNREAGGREGATABLE.has(m.aggregate) || !RE_AGGREGATE[m.aggregate],
  );
  if (unreaggregatable) {
    return refuse(
      'REAGG',
      [masterName],
      `"${unreaggregatable.label}" uses ${unreaggregatable.aggregate}, which cannot be ` +
        'recalculated from partial totals. Adding up sums gives the right answer; ' +
        'averaging averages, or counting distinct values twice, does not.',
    );
  }

  // -- Step 7 -------------------------------------------------------------
  const outerKeys = master.fanning[0]!.predicate.map((p) => p.master);
  const branches = buildBranches(def, master, outerKeys, axisFolders, measures);

  return {
    ...base,
    kind: 'REWRITE',
    masterFolderId: master.folderId,
    outerKeys,
    branches,
    // Re-aggregation is settled above, so every measure carries its outer
    // function by the time the plan leaves here.
    measures: branches.flatMap((b) => b.measures),
    decision: `REWRITE(${branches.length})`,
  };
}

/**
 * Refusal rules R1, R2 and R3 for one candidate master (`legacy-analysis.md`
 * §1.5). Returns the first that fires, or null.
 */
function refuseR1toR3(
  master: FanCandidate,
  graph: Graph,
  axisFolders: Set<string>,
  folderName: (folderId: string) => string,
): { kind: 'REFUSE'; rule: RefusalRule; folders: string[]; message: string; decision: string } | null {
  const masterName = folderName(master.folderId);
  const made = (
    rule: RefusalRule,
    folders: string[],
    message: string,
  ): { kind: 'REFUSE'; rule: RefusalRule; folders: string[]; message: string; decision: string } => ({
    kind: 'REFUSE',
    rule,
    folders,
    message,
    decision: `REFUSE(${rule})`,
  });

  // R1 — branch aggregates on different master keys are not on a common grain,
  // and the column the outer query would join them on does not exist.
  const keySignature = (b: LiveBranch): string =>
    b.predicate
      .map((p) => p.master.columnName)
      .sort()
      .join(',');
  const firstKey = keySignature(master.fanning[0]!);
  if (master.fanning.some((b) => keySignature(b) !== firstKey)) {
    return made(
      'R1',
      [masterName, ...master.fanning.map((b) => folderName(b.detailFolderId))],
      `The detail folders join "${masterName}" on different columns, so their totals ` +
        'are not measured against the same thing and cannot be put side by side.',
    );
  }

  // R2 — a direct edge between two branch subtrees closes a cycle, and the
  // branch decomposition stops being unique.
  for (let i = 0; i < master.fanning.length; i += 1) {
    for (let j = i + 1; j < master.fanning.length; j += 1) {
      const a = master.fanning[i]!;
      const b = master.fanning[j]!;
      const crossing = graph.edges.some(
        (e) =>
          (a.subtree.has(e.masterFolderId) && b.subtree.has(e.detailFolderId)) ||
          (b.subtree.has(e.masterFolderId) && a.subtree.has(e.detailFolderId)),
      );
      if (crossing) {
        return made(
          'R2',
          [folderName(a.detailFolderId), folderName(b.detailFolderId)],
          `"${folderName(a.detailFolderId)}" and "${folderName(b.detailFolderId)}" are joined ` +
            `to each other as well as to "${masterName}". That makes the relationship ` +
            'circular, and there is no one right way to summarise it.',
        );
      }
    }
  }

  // R3 — two independent detail grains on the axis IS a cross-product. No
  // rewrite restores it, so Discoverer stopped rather than inventing one.
  const branchesWithAxis = master.fanning.filter((b) =>
    [...b.subtree].some((id) => axisFolders.has(id)),
  );
  if (branchesWithAxis.length >= 2) {
    return made(
      'R3',
      branchesWithAxis.map((b) => folderName(b.detailFolderId)),
      'This query shows individual (non-totalled) values from more than one set of ' +
        'detail rows. Those sets do not line up with each other, so every combination ' +
        'would be shown rather than the rows you asked for.',
    );
  }

  return null;
}

/**
 * The folder set, derived with any un-emittable aggregate stripped.
 *
 * `effectiveFolderSet` runs the real clause builders, and the SELECT clause
 * rejects an aggregate it cannot write — `COUNT DISTINCT`, `STDDEV`,
 * `VARIANCE`. That error would fire before the planner ever saw the query, and
 * the user would be told "unsupported aggregate function" instead of *why* the
 * number cannot be produced across a fan (D-035).
 *
 * Blanking the aggregate cannot change which folders the query touches — the
 * same column of the same item is still read — so the set is identical. The
 * planner then classifies with the real aggregates and refuses in its own
 * words. A single-folder query is untouched and still gets the SELECT clause's
 * message, which is the right one there.
 */
function deriveFolderSet(def: MapDefinition): EffectiveFolderSet {
  const blocked = new Set(
    collectMeasures(def)
      .filter((m) => UNREAGGREGATABLE.has(m.aggregate) || !RE_AGGREGATE[m.aggregate])
      .map((m) => m.mapItemId),
  );
  if (blocked.size === 0) return effectiveFolderSet(def);

  return effectiveFolderSet({
    ...def,
    items: def.items.map((entry) =>
      blocked.has(entry.mapItem.id)
        ? {
            ...entry,
            mapItem: { ...entry.mapItem, aggFunction: null },
            item: { ...entry.item, aggFunction: null },
          }
        : entry,
    ),
  });
}

// ---------------------------------------------------------------------------
// Step 7 — branch construction
// ---------------------------------------------------------------------------

function buildBranches(
  def: MapDefinition,
  master: FanCandidate,
  outerKeys: PlanColumn[],
  axisFolders: Set<string>,
  measures: PlanMeasure[],
): PlanBranch[] {
  const branches: PlanBranch[] = [];
  const masterMeasureIds = new Set(master.masterMeasures.map((m) => m.mapItemId));

  /**
   * Folders folded into the master's own branch: the master itself, plus any
   * neighbour joined one-to-one. A one-to-one edge cannot multiply rows, so
   * aggregating across it at master grain is the same arithmetic.
   */
  const masterSide = [
    master.folderId,
    ...master.nonFanning.flatMap((b) => [...b.subtree]),
  ];

  // Branch 0 exists only when it has work to do: the master's own measures
  // (step 5a), or a one-to-one neighbour that has to be joined somewhere. The
  // master's AXIS columns alone do not justify one — Oracle's example carries
  // `masterName` on `inner2`, a detail branch, and an extra inline view joined
  // for a descriptive column is a join for nothing.
  const masterAxis = axisMapItemIds(def, new Set(masterSide));
  const needsMasterBranch = masterMeasureIds.size > 0 || master.nonFanning.length > 0;

  if (needsMasterBranch) {
    branches.push({
      id: 'b0',
      folderIds: masterSide,
      detailFolderId: null,
      joinIdx: null,
      predicate: [],
      ...scopedConditions(def, new Set(masterSide), master.folderId),
      groupKeys: [
        ...outerKeys.map((column): PlanGroupKey => ({ kind: 'KEY', column })),
        ...masterAxis.map((mapItemId): PlanGroupKey => ({ kind: 'AXIS', mapItemId })),
      ],
      measures: measures
        .filter((m) => masterMeasureIds.has(m.mapItemId))
        .map(withReAggregate),
      fanning: false,
    });
  }

  // One inline view per fanning detail branch. Axis columns from a branch ride
  // on that branch — R3 has already guaranteed at most one branch has any, and
  // if the master branch exists the master's ride there instead.
  master.fanning.forEach((branch, index) => {
    const inBranch = new Set([master.folderId, ...branch.subtree]);
    const branchAxis = axisMapItemIds(def, branch.subtree);
    // The master's axis columns ride on ONE branch — b0 when it exists, else
    // the first detail branch. Repeating them everywhere is harmless for
    // correctness and pointless in the SQL.
    const carriesMasterAxis = !needsMasterBranch && index === 0;
    const axis = carriesMasterAxis ? [...masterAxis, ...branchAxis] : branchAxis;
    branches.push({
      id: `b${index + 1}`,
      folderIds: [master.folderId, ...branch.subtree],
      detailFolderId: branch.detailFolderId,
      joinIdx: branch.joinIdx,
      predicate: branch.predicate,
      ...scopedConditions(def, inBranch, master.folderId),
      groupKeys: [
        ...outerKeys.map((column): PlanGroupKey => ({ kind: 'KEY', column })),
        ...axis.map((mapItemId): PlanGroupKey => ({ kind: 'AXIS', mapItemId })),
      ],
      measures: measures
        .filter(
          (m) => !masterMeasureIds.has(m.mapItemId) && branch.subtree.has(m.folderId),
        )
        .map(withReAggregate),
      fanning: true,
    });
  });

  return branches;
}

function withReAggregate(measure: PlanMeasure): PlanMeasure {
  return { ...measure, reAggregate: RE_AGGREGATE[measure.aggregate] ?? null };
}

/**
 * The conditions and parameters that belong INSIDE one branch's inline view.
 *
 * A filter on detail branch *i* must be applied before that branch's GROUP BY
 * or it filters post-aggregation and changes the answer; placed in the outer
 * query it silently drops master rows that branch *j* still matches
 * (`legacy-analysis.md` §1.9.2). The correct placement is forced by arithmetic,
 * not by taste.
 *
 * A filter on the MASTER is repeated in every branch. Each branch outer-joins
 * its detail, so each returns exactly the master's surviving rows; repeating
 * the filter keeps every branch's key set identical, which is what makes the
 * outer equi-join lossless. The estate's 7 521 parameters travel the same way
 * (§1.9.3).
 */
function scopedConditions(
  def: MapDefinition,
  branchFolderIds: Set<string>,
  masterFolderId: string,
): { conditionIds: string[]; parameterBindNames: string[] } {
  const conditionIds: string[] = [];
  const parameterBindNames = new Set<string>();

  for (const entry of def.conditions) {
    const folderId = entry.folder.id;
    if (!branchFolderIds.has(folderId) && folderId !== masterFolderId) continue;
    conditionIds.push(entry.condition.id);
    if (entry.condition.conditionType === 'PARAMETER' && entry.condition.paramName) {
      parameterBindNames.add(entry.condition.paramName);
    }
  }

  return { conditionIds, parameterBindNames: [...parameterBindNames] };
}

// ---------------------------------------------------------------------------
// The join subgraph (steps 1-4)
// ---------------------------------------------------------------------------

interface GraphEdge {
  joinIdx: number;
  /** `leftFolder` is the MASTER side, `rightFolder` the DETAIL side (D-040). */
  masterFolderId: string;
  detailFolderId: string;
  /** False only when the join is explicitly flagged one-to-one (D-033). */
  fanning: boolean;
  predicate: PlanPredicateComponent[];
}

interface Graph {
  edges: GraphEdge[];
  /** Undirected adjacency, for reachability. */
  neighbours: Map<string, Set<string>>;
}

interface LiveBranch {
  joinIdx: number;
  detailFolderId: string;
  /** Every folder reachable through this edge without going back through the master. */
  subtree: Set<string>;
  predicate: PlanPredicateComponent[];
  fanning: boolean;
}

interface FanCandidate {
  folderId: string;
  fanning: LiveBranch[];
  withMeasure: LiveBranch[];
  masterMeasures: PlanMeasure[];
  nonFanning: LiveBranch[];
}

/**
 * Build the query's join subgraph.
 *
 * **Step 2 — orientation is metadata, never traversal order.** `leftFolder` is
 * the master and `rightFolder` the detail, as the loader records them. BFS
 * never flips it.
 *
 * **Step 3 — assume fanning (D-033).** `OneToOne` defaults to False in Oracle's
 * own DTD, and Oracle states its only effect is fan-trap detection. An unknown
 * or absent flag therefore means FANNING: treating a missing flag as safe
 * inverts Discoverer's bias and under-detects. Every one of this estate's ten
 * joins is in exactly that state.
 */
function buildGraph(def: MapDefinition, folderIds: string[]): Graph {
  const inScope = new Set(folderIds);
  const edges: GraphEdge[] = [];
  const neighbours = new Map<string, Set<string>>();
  for (const id of folderIds) neighbours.set(id, new Set());

  def.joins.forEach((j, joinIdx) => {
    const masterFolderId = j.join.leftFolderId;
    const detailFolderId = j.join.rightFolderId;
    if (!inScope.has(masterFolderId) || !inScope.has(detailFolderId)) return;

    edges.push({
      joinIdx,
      masterFolderId,
      detailFolderId,
      fanning: j.join.oneToOne !== true,
      predicate: predicateOf(j),
    });
    neighbours.get(masterFolderId)!.add(detailFolderId);
    neighbours.get(detailFolderId)!.add(masterFolderId);
  });

  return { edges, neighbours };
}

/**
 * The predicate's column pairs, master side first, in `seq` order.
 *
 * A component whose item did not migrate is dropped HERE and only here: the
 * planner needs the master-side key columns to compare branches (R1) and to
 * form the outer key, and it must not invent one. `buildFromClause` refuses the
 * query by name for the same missing component (D-039), so nothing runs on a
 * short predicate.
 */
function predicateOf(j: MapDefinition['joins'][number]): PlanPredicateComponent[] {
  return [...j.predicates]
    .sort((a, b) => a.predicate.seq - b.predicate.seq)
    .flatMap(({ predicate, leftItem, rightItem }) => {
      if (!leftItem?.columnName || !rightItem?.columnName) return [];
      return [
        {
          master: {
            folderId: leftItem.folderId,
            itemId: leftItem.id,
            columnName: leftItem.columnName,
          },
          detail: {
            folderId: rightItem.folderId,
            itemId: rightItem.id,
            columnName: rightItem.columnName,
          },
          operator: predicate.operator,
        },
      ];
    });
}

/**
 * Step 4 — the LIVE branches hanging off one folder.
 *
 * A branch is live when its subtree contributes at least one column the query
 * selects. A join present but contributing nothing is trimmed and cannot fan.
 */
function liveBranchesOf(
  graph: Graph,
  masterFolderId: string,
  columnBearing: Set<string>,
): LiveBranch[] {
  const branches: LiveBranch[] = [];

  for (const edge of graph.edges) {
    if (edge.masterFolderId !== masterFolderId) continue;
    const subtree = reachableWithout(
      graph,
      edge.detailFolderId,
      masterFolderId,
    );
    if (![...subtree].some((id) => columnBearing.has(id))) continue;
    branches.push({
      joinIdx: edge.joinIdx,
      detailFolderId: edge.detailFolderId,
      subtree,
      predicate: edge.predicate,
      fanning: edge.fanning,
    });
  }

  return branches;
}

/** Folders reachable from `start` without passing through `blocked`. */
function reachableWithout(
  graph: Graph,
  start: string,
  blocked: string,
): Set<string> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of graph.neighbours.get(current) ?? []) {
      if (next === blocked || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

function isConnected(graph: Graph, folderIds: string[]): boolean {
  const seen = reachableWithout(graph, folderIds[0]!, '');
  return folderIds.every((id) => seen.has(id));
}

// ---------------------------------------------------------------------------
// The measure and axis vectors
// ---------------------------------------------------------------------------

/**
 * `M` — the selected columns that aggregate.
 *
 * In a `.DIS` workbook the axis and measure vectors are two separate fields on
 * the query request, so the split is given rather than inferred. Here it is
 * recovered the way the SELECT list recovers it, through `effectiveAggregate`,
 * so the guard can never analyse a query the emitter does not write.
 *
 * A hidden item is included here for completeness, but it only ever matters
 * where its folder is column-bearing for another reason: Neo's SELECT clause
 * skips hidden items entirely, so a folder reached ONLY by one is not in the
 * query and cannot fan.
 */
function collectMeasures(def: MapDefinition): PlanMeasure[] {
  return def.items.flatMap(({ mapItem, item, folder }) => {
    const aggregate = effectiveAggregate(mapItem, item);
    if (!aggregate) return [];
    return [
      {
        mapItemId: mapItem.id,
        itemId: item.id,
        folderId: folder.id,
        label: mapItem.displayName || item.name,
        aggregate,
        reAggregate: null,
      },
    ];
  });
}

/** Folders contributing an AXIS (drawn, non-aggregated) column — R3's input. */
function axisItemFolders(def: MapDefinition): Set<string> {
  const folders = new Set<string>();
  for (const { mapItem, item, folder } of def.items) {
    if (mapItem.isHidden) continue;
    if (effectiveAggregate(mapItem, item)) continue;
    folders.add(folder.id);
  }
  return folders;
}

/** The drawn, non-aggregated columns whose folder falls inside a branch. */
function axisMapItemIds(def: MapDefinition, folderIds: Set<string>): string[] {
  return def.items
    .filter(
      ({ mapItem, item, folder }) =>
        !mapItem.isHidden &&
        !effectiveAggregate(mapItem, item) &&
        folderIds.has(folder.id),
    )
    .sort((a, b) => a.mapItem.displayOrder - b.mapItem.displayOrder)
    .map(({ mapItem }) => mapItem.id);
}

/**
 * Whether a formula calls an aggregate. Deliberately crude: it only has to be
 * conservative enough to reach a refusal, and the parser does the real work
 * everywhere a formula becomes SQL.
 */
function containsAggregateCall(formula: string): boolean {
  return [...AGGREGATE_FUNCTIONS].some((fn) =>
    new RegExp(`\\b${fn}\\s*\\(`, 'i').test(formula),
  );
}

function folderNamer(def: MapDefinition): (folderId: string) => string {
  const byId = new globalThis.Map<string, Folder>();
  const add = (f: Folder): void => {
    if (!byId.has(f.id)) byId.set(f.id, f);
  };
  for (const { folder } of def.items) add(folder);
  for (const { folder } of def.conditions) add(folder);
  for (const { folder } of def.formulaItems) add(folder);
  for (const j of def.joins) {
    add(j.leftFolder);
    add(j.rightFolder);
  }
  return (folderId) => byId.get(folderId)?.name ?? folderId;
}

/**
 * Raise a plan's refusal as the error the API and the UI already understand.
 * Refusal copy belongs to the client, which translates from `rule` (D-036);
 * the message is the fallback and the log line.
 */
export function refusalError(plan: {
  kind: 'REFUSE';
  rule: RefusalRule;
  folders: string[];
  message: string;
}): SqlGenerationError {
  return new SqlGenerationError(
    plan.message,
    { rule: plan.rule, folders: plan.folders },
    `FAN_TRAP_${plan.rule}`,
  );
}
