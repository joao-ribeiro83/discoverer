/**
 * Pure EUL → Discoverer Neo entity transformers.
 *
 * Each function maps one normalized EUL entity (from `eul-reader`) to a
 * `Transformed*` value carrying the Neo column values plus the *source*
 * foreign-key references the migration runner resolves to UUIDs. All lossy or
 * version-specific mapping decisions are made here and surfaced as warnings.
 */

import type {
  BusinessArea,
  CustomFunction,
  EulUser,
  EulVersion,
  Folder,
  Grant,
  Hierarchy,
  Item,
  Join,
} from '../../types/eul-versions.js';
import type { ParsedWorkbook } from '../eul-reader.js';
import {
  clamp,
  DEFAULT_GRANT_PERMISSION,
  folderTypeMapFor,
  GRANT_PERMISSION_MAP,
  ITEM_TYPE_MAP,
  JOIN_TYPE_MAP,
  MIGRATED_USER_PASSWORD_HASH,
  NEO_FOLDER_TYPES,
  normalizeAggregation,
  type NeoFolderType,
  type NeoItemType,
  type NeoJoinType,
  type TransformedBusinessArea,
  type TransformedCustomFunction,
  type TransformedFolder,
  type TransformedGrant,
  type TransformedHierarchy,
  type TransformedHierarchyLevel,
  type TransformedItem,
  type TransformedJoin,
  type TransformedMapCalculatedField,
  type TransformedMapCondition,
  type TransformedMapItem,
  type TransformedMapJoin,
  type TransformedMapLayout,
  type TransformedMapPageSetup,
  type TransformedMapParameter,
  type TransformedMapTotal,
  type TransformedUser,
  type TransformedWorkbook,
  type TransformWarning,
  type NeoConditionType,
  type NeoMapOperator,
  type NeoMapAxisType,
  type NeoMapParameterType,
  type NeoMapTotalKind,
  type NeoMapTotalPlacement,
  type NeoMapType,
  type NeoSortDirection,
} from './types.js';

const NAME_MAX = 255;

// ---------------------------------------------------------------------------
// Business area
// ---------------------------------------------------------------------------

export function transformBusinessArea(ba: BusinessArea, _version: EulVersion): TransformedBusinessArea {
  const warnings: TransformWarning[] = [];

  let name = (ba.name ?? '').trim();
  if (name === '') {
    name = `Business Area ${ba.sourceId}`;
    warnings.push({
      code: 'BA_MISSING_NAME',
      message: `Business area ${ba.sourceId} has no name; using "${name}".`,
      sourceId: ba.sourceId,
    });
  }

  // BA_LANGUAGE / BA_DEVELOPER_KEY do not exist on BAS in any confirmed
  // source, so there is nothing to drop and no warning to raise.

  return {
    sourceId: ba.sourceId,
    name: clamp(name, NAME_MAX),
    description: ba.description,
    isActive: true,
    createdByUsername: ba.createdBy,
    updatedByUsername: ba.updatedBy,
    createdAt: ba.createdAt,
    updatedAt: ba.updatedAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

function mapFolderType(
  raw: string,
  version: EulVersion,
  sourceId: number,
  warnings: TransformWarning[],
): NeoFolderType {
  const upper = (raw ?? '').toUpperCase();
  const versionMap = folderTypeMapFor(version);
  const mapped = versionMap[upper];
  if (mapped) return mapped;

  // A type Neo understands but that isn't documented for this EUL version
  // (e.g. DERIVED/SUMMARY in an EUL4 source): keep it, but flag the anomaly.
  if (NEO_FOLDER_TYPES.has(upper)) {
    warnings.push({
      code: 'FOLDER_TYPE_UNEXPECTED',
      message: `Folder ${sourceId} has type "${upper}", not a documented ${version} folder type; kept as-is.`,
      sourceId,
    });
    return upper as NeoFolderType;
  }

  warnings.push({
    code: 'FOLDER_TYPE_UNKNOWN',
    message: `Folder ${sourceId} has unrecognized type "${raw}"; mapped to COMPLEX.`,
    sourceId,
  });
  return 'COMPLEX';
}

export function transformFolder(folder: Folder, version: EulVersion): TransformedFolder {
  const warnings: TransformWarning[] = [];

  let name = (folder.name ?? '').trim();
  if (name === '') {
    name = `Folder ${folder.sourceId}`;
    warnings.push({
      code: 'FOLDER_MISSING_NAME',
      message: `Folder ${folder.sourceId} has no name; using "${name}".`,
      sourceId: folder.sourceId,
    });
  }

  const folderType = mapFolderType(folder.folderType, version, folder.sourceId, warnings);

  // Non-table folders (COMPLEX/DERIVED/JOIN/SUMMARY) have no backing table and
  // no SQL in EUL metadata — their definition has to be completed in Neo.
  if (folderType !== 'TABLE' && folderType !== 'VIEW' && !folder.tableName) {
    warnings.push({
      code: 'FOLDER_DEFINITION_INCOMPLETE',
      message: `Folder "${name}" is ${folderType} with no source table; its SQL/definition must be completed in Neo.`,
      sourceId: folder.sourceId,
    });
  }

  // BA_OBJ_LINKS is many-to-many; Neo's folders.business_area_id is a single
  // NOT NULL column. A folder shared across business areas therefore lands in
  // only one of them — surfaced here rather than dropped silently.
  const shared = folder.sharedBusinessAreaIds ?? [];
  if (shared.length > 1) {
    warnings.push({
      code: 'FOLDER_SHARED_ACROSS_BUSINESS_AREAS',
      message:
        `Folder "${name}" belongs to ${shared.length} business areas in the EUL ` +
        `(${shared.join(', ')}); Neo folders belong to exactly one, so it was placed in ` +
        `${folder.businessAreaId ?? 'none'}. Recreate it in the others if it is needed there.`,
      sourceId: folder.sourceId,
    });
  }

  return {
    sourceId: folder.sourceId,
    businessAreaSourceId: folder.businessAreaId,
    businessAreaSourceIds: shared,
    name: clamp(name, NAME_MAX),
    description: folder.description,
    folderType,
    tableName: folder.tableName ? clamp(folder.tableName, NAME_MAX) : null,
    tableOwner: folder.tableOwner ? clamp(folder.tableOwner, NAME_MAX) : null,
    customSql: null,
    displayOrder: folder.sequence ?? 0,
    isActive: true,
    createdByUsername: folder.createdBy,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

export function transformItem(item: Item, _version: EulVersion): TransformedItem {
  const warnings: TransformWarning[] = [];
  const rawType = (item.expType ?? '').toUpperCase();
  const mappedType = ITEM_TYPE_MAP[rawType];

  const itemType: NeoItemType = mappedType ?? 'CI';
  let skip = false;
  if (!mappedType) {
    skip = true;
    if (rawType === 'SM') {
      warnings.push({
        code: 'ITEM_SECURITY_MANAGER',
        message: `Item ${item.sourceId} is a Security Manager condition (EXP_TYPE='SM'); migrate it to a Neo row-level security policy, not an item.`,
        sourceId: item.sourceId,
      });
    } else {
      warnings.push({
        code: 'ITEM_TYPE_UNKNOWN',
        message: `Item ${item.sourceId} has unrecognized EXP_TYPE "${item.expType}"; skipped.`,
        sourceId: item.sourceId,
      });
    }
  }

  let name = (item.name ?? '').trim();
  if (name === '' && !skip) {
    name = `Item ${item.sourceId}`;
    warnings.push({
      code: 'ITEM_MISSING_NAME',
      message: `Item ${item.sourceId} has no name; using "${name}".`,
      sourceId: item.sourceId,
    });
  }

  return {
    sourceId: item.sourceId,
    folderSourceId: item.folderId,
    name: clamp(name, NAME_MAX),
    description: item.description,
    itemType,
    columnName: item.columnName ? clamp(item.columnName, NAME_MAX) : null,
    formula: item.formula,
    dataType: item.dataType ? clamp(item.dataType, 64) : null,
    formatMask: item.formatMask ? clamp(item.formatMask, NAME_MAX) : null,
    aggFunction: normalizeAggregation(item.aggregation),
    displayOrder: item.sequence ?? 0,
    isHidden: false,
    isActive: true,
    parentItemSourceId: item.parentItemId,
    createdByUsername: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    warnings,
    skip,
  };
}

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

export function transformJoin(join: Join, _version: EulVersion): TransformedJoin {
  const warnings: TransformWarning[] = [];
  const rawType = (join.joinType ?? 'INNER').toUpperCase();
  const joinType: NeoJoinType = JOIN_TYPE_MAP[rawType] ?? 'INNER';
  if (!JOIN_TYPE_MAP[rawType]) {
    warnings.push({
      code: 'JOIN_TYPE_UNKNOWN',
      message: `Join ${join.sourceId} has unrecognized type "${join.joinType}"; defaulted to INNER.`,
      sourceId: join.sourceId,
    });
  }

  const components = join.components.map((c) => ({
    leftItemSourceId: c.masterItemId,
    rightItemSourceId: c.detailItemId,
    operator: c.operator,
  }));

  // A join in the EUL binds two FOLDERS (KEY_CONS.KEY_OBJ_ID /
  // FK_OBJ_ID_REMOTE); item-level key columns are optional and often absent.
  // Neo's joins table matches that — folder ids NOT NULL, item ids nullable —
  // so a component-less join is normal, not a defect. What actually blocks a
  // join is a missing folder on either side.
  if (join.masterFolderId === null || join.detailFolderId === null) {
    warnings.push({
      code: 'JOIN_NO_FOLDERS',
      message: `Join "${join.name}" (${join.sourceId}) is missing a folder on one or both sides and will be skipped.`,
      sourceId: join.sourceId,
    });
  }

  let name = (join.name ?? '').trim();
  if (name === '') name = `Join ${join.sourceId}`;

  return {
    sourceId: join.sourceId,
    name: clamp(name, NAME_MAX),
    leftFolderSourceId: join.masterFolderId,
    rightFolderSourceId: join.detailFolderId,
    joinType,
    isActive: true,
    createdAt: join.createdAt,
    components,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Hierarchy (+ levels)
// ---------------------------------------------------------------------------

export function transformHierarchy(hierarchy: Hierarchy, _version: EulVersion): TransformedHierarchy {
  const warnings: TransformWarning[] = [];

  // The EUL stores a node tree, not numbered levels — depth is derived by
  // walking HI_SEGMENTS (see readHierarchies). Nodes arrive root-first, so the
  // array index is the level order; `depth` is preferred when the walk
  // reached the node, and the index is the fallback for orphans.
  const levels: TransformedHierarchyLevel[] = hierarchy.nodes.map((node, idx) => {
    let levelName = (node.name ?? '').trim();
    if (levelName === '') levelName = `Level ${idx + 1}`;
    return {
      sourceId: node.sourceId,
      itemSourceId: node.itemId,
      levelName: clamp(levelName, NAME_MAX),
      levelNumber: node.depth ?? idx + 1,
      parentSourceId: node.parentNodeId,
    };
  });

  const orphanNodes = hierarchy.nodes.filter((n) => n.depth === null).length;
  if (orphanNodes > 0) {
    warnings.push({
      code: 'HIER_NODE_UNREACHABLE',
      message: `Hierarchy "${hierarchy.name}" has ${orphanNodes} node(s) not reachable from a root in HI_SEGMENTS; their depth was inferred from read order.`,
      sourceId: hierarchy.sourceId,
    });
  }

  const missingItemLevels = levels.filter((l) => l.itemSourceId === null).length;
  if (missingItemLevels > 0) {
    warnings.push({
      code: 'HIER_LEVEL_NO_ITEM',
      message: `Hierarchy "${hierarchy.name}" has ${missingItemLevels} level(s) with no item; those levels will be skipped (Neo requires an item per level).`,
      sourceId: hierarchy.sourceId,
    });
  }

  let name = (hierarchy.name ?? '').trim();
  if (name === '') name = `Hierarchy ${hierarchy.sourceId}`;

  return {
    sourceId: hierarchy.sourceId,
    businessAreaSourceId: hierarchy.businessAreaId,
    name: clamp(name, NAME_MAX),
    description: hierarchy.description,
    isActive: true,
    createdAt: hierarchy.createdAt,
    updatedAt: hierarchy.updatedAt,
    levels,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Custom function
// ---------------------------------------------------------------------------

export function transformCustomFunction(
  fn: CustomFunction,
  _version: EulVersion,
): TransformedCustomFunction {
  const warnings: TransformWarning[] = [];
  let name = (fn.name ?? '').trim();
  if (name === '') name = `Function ${fn.sourceId}`;

  // EUL FUNCTIONS metadata carries no argument list or return type in the
  // normalized read, so these default and should be reviewed post-migration.
  warnings.push({
    code: 'FUNCTION_SIGNATURE_DEFAULTED',
    message: `Custom function "${name}" migrated as PL/SQL with no parameters/return type; complete its signature in Neo.`,
    sourceId: fn.sourceId,
  });

  return {
    sourceId: fn.sourceId,
    name: clamp(name, NAME_MAX),
    description: fn.description,
    functionType: 'PLSQL',
    returnType: null,
    parameters: null,
    isActive: true,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Workbook → maps (one per worksheet) + items/conditions/parameters/calcs
// ---------------------------------------------------------------------------

/**
 * Longest bind base name `makeBindName` will produce. Oracle caps identifiers
 * at 30 characters on 11g and earlier, and the SQL generator appends its own
 * suffixes to a bind base (`_lo`/`_hi`, `_0`…`_n`), so 26 leaves room.
 */
const MAX_BIND_BASE_LENGTH = 26;

/**
 * Derive a unique, Oracle-safe bind name from a prompt's display label.
 *
 * Discoverer let people name a prompt anything: `Dt Fim Vigência >=`,
 * `Apólice nº`, `VALOR SUPERIOR A`. None of those can be a bind variable, and
 * a map filtering on one could not generate SQL at all. The label stays the
 * prompt (`map_parameters.name`); this is the name the SQL binds
 * (`map_parameters.bind_name`), and it is what `map_conditions.param_name`
 * stores.
 *
 * `taken` accumulates the names already handed out for one map, so two prompts
 * that reduce to the same base (`Dt Anulação <=` and `Dt Anulação >=` both
 * give `DT_ANULA_O`) stay distinct filters instead of collapsing onto one bind.
 *
 * Mirrors `makeBindName` in `backend/src/lib/sql/identifiers.ts` — the two
 * packages do not share code, so the derivation is duplicated on purpose.
 * Change one and you must change the other, and the backfill in
 * `backend/drizzle/0008_bind_safe_parameter_names.sql` with them.
 */
/**
 * Key a prompt is looked up by. Discoverer matched a condition's parameter
 * reference to a declaration case-insensitively (a condition on `RAMO` against
 * a prompt declared `Ramo`), so the lookup here has to as well.
 */
function promptKey(prompt: string): string {
  return prompt.trim().toLowerCase();
}

export function makeBindName(label: string, taken: Set<string>): string {
  let base = label
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_BIND_BASE_LENGTH);
  if (!base) base = 'P';
  else if (!/^[A-Z]/.test(base)) {
    base = `P_${base}`.slice(0, MAX_BIND_BASE_LENGTH);
  }

  let name = base;
  let n = 2;
  while (taken.has(name)) {
    const suffix = `_${n}`;
    // Truncate the base rather than the suffix: a suffix eaten by the length
    // cap would hand out the same name forever.
    name = `${base.slice(0, MAX_BIND_BASE_LENGTH - suffix.length)}${suffix}`;
    n += 1;
  }
  taken.add(name);
  return name;
}

/**
 * Guess a parameter's type from its default value and prompt.
 *
 * The workbook body records no type for a parameter — Discoverer infers it
 * from the item the parameter is compared against at run time. STRING is the
 * safe default because Neo only uses `param_type` to pick an input widget.
 */
export function inferParameterType(
  defaultValue: string | null,
  hint: string | null,
): NeoMapParameterType {
  const value = (defaultValue ?? '').trim();
  if (value.includes(',') && /'/.test(value)) return 'LIST';
  if (value !== '' && /^-?\d+(?:[.,]\d+)?$/.test(value)) return 'NUMBER';
  const dateish = /\d{1,2}[-/][A-Za-z]{3,}[-/]\d{2,4}|\d{4}-\d{2}-\d{2}/;
  if (dateish.test(value)) return 'DATE';
  const mask = `${defaultValue ?? ''} ${hint ?? ''}`;
  if (/\b(?:DD|MM|YYYY|RRRR|MON)\b/.test(mask)) return 'DATE';
  return 'STRING';
}

/**
 * A calculation's `Placement` (`0x00e2`) as a Neo axis.
 *
 * `1` is a measure and `2` an axis — the observed values, **[DUMP]**-matched
 * on all 41 982 corpus calculations. `0` is not a third axis: it says the
 * calculation is not placed on this worksheet at all, which the same element's
 * `Hidden` flag already records, so it maps to no axis rather than to one.
 */
export function axisTypeForPlacement(code: number | null): NeoMapAxisType | null {
  if (code === 1) return 'MEASURE';
  if (code === 2) return 'AXIS';
  return null;
}

/**
 * What one Discoverer sort becomes on the column it sorts.
 *
 * `direction` is null only when `Direction` held a code neither 1 nor 2, which
 * no workbook in the corpus does; `order` is set regardless, because the
 * position in the sort list is a fact about the sort whether or not its
 * direction could be named.
 */
interface WorksheetSortPlacement {
  direction: NeoSortDirection | null;
  order: number;
  group: boolean;
}

/**
 * Index a worksheet's sorts by the *item element* each one names, so a column
 * can look up its own sort.
 *
 * The key is the element id of the item sorted on, which is the same id a
 * column carries as `itemElementRef` and a hidden item as `elementId` — one id
 * space, so this cannot cross-match. `ParsedWorksheet.sorts` is already in
 * query order (`Sort Item Usage`, and `EUL Sort Item Reference` in document
 * order), so the index into it *is* the precedence.
 *
 * The layout half supplies `IsABreak` only. Its direction flag (`0x0516`) is
 * deliberately not read here: the query half's `Direction` is the field
 * `d4wkdmp` prints and the one confirmed 3 775/3 775 against it, and the two
 * halves name a different item on 14 of the corpus's 3 864 sorts — so the
 * query half wins, exactly as `workbook-parser.ts` keeps them apart (§7.8.6).
 */
function indexWorksheetSorts(
  sorts: ParsedWorkbook['document']['worksheets'][number]['sorts'],
): Map<number, WorksheetSortPlacement> {
  const byItem = new Map<number, WorksheetSortPlacement>();
  sorts.forEach((sort, order) => {
    if (sort.itemElementRef === null) return;
    // A repeated item cannot be sorted twice; the first entry is the one the
    // query applies, and keeping it makes the mapping deterministic.
    if (byItem.has(sort.itemElementRef)) return;
    byItem.set(sort.itemElementRef, {
      direction: sort.direction,
      order,
      group: sort.layout?.grouped ?? false,
    });
  });
  return byItem;
}

/**
 * What one Discoverer summary needs from the worksheet's columns.
 *
 * `0x0c22` and `0x0c23` name **column** elements (`0x02bc`), not items, so a
 * total resolves through the column list rather than through the item
 * identities `map_items` is matched on elsewhere. Every column is keyed by its
 * own element id, which is the id the summary carries.
 */
interface TotalColumnTarget {
  /** `display_order` of the column — the key both writers index their rows by. */
  displayOrder: number;
  /** True when the column shows a workbook calculation rather than an EUL item. */
  isCalculation: boolean;
  /**
   * Element id of the calculation the column shows, when it shows one. This is
   * what ties the column to a `worksheet.calculations` entry, and so to the
   * `map_calculated_fields` row that entry becomes.
   */
  calculationElementId: number | null;
}

/** Index a worksheet's columns by their own element id, for `0x0c22`/`0x0c23`. */
function indexTotalColumns(
  columns: ParsedWorkbook['document']['worksheets'][number]['columns'],
): Map<number, TotalColumnTarget> {
  const byElement = new Map<number, TotalColumnTarget>();
  for (const column of columns) {
    byElement.set(column.elementId, {
      displayOrder: column.displayOrder,
      isCalculation: column.isCalculation,
      calculationElementId: column.isCalculation ? column.itemElementRef : null,
    });
  }
  return byElement;
}

/**
 * `document.pageSetup` (`0x0834`) as a `map_page_setup` value. See
 * `TransformedMapPageSetup` for why every slot but the element id lands in
 * `sourceAttrs` rather than a named column.
 */
function buildPageSetup(
  pageSetup: NonNullable<ParsedWorkbook['document']['pageSetup']>,
): TransformedMapPageSetup {
  return {
    sourceElementId: pageSetup.elementId,
    sourceAttrs: {
      texts: pageSetup.texts,
      fontRefs: pageSetup.fontRefs,
      margins: pageSetup.margins,
    },
  };
}

/**
 * The EUL joins this worksheet's query requests force (§7.8.9), deduplicated
 * by element id across every query the worksheet links — corpus-wide there is
 * only ever one, but the format allows more.
 */
function resolveWorksheetJoins(
  worksheet: ParsedWorkbook['document']['worksheets'][number],
  joinsByElement: Map<number, ParsedWorkbook['document']['joins'][number]>,
): TransformedMapJoin[] {
  const elementIds = new Set<number>();
  for (const query of worksheet.queries) {
    for (const id of query.joinRefs) elementIds.add(id);
  }
  const joins: TransformedMapJoin[] = [];
  for (const elementId of elementIds) {
    const join = joinsByElement.get(elementId);
    if (join === undefined) continue;
    joins.push({
      sourceElementId: join.elementId,
      eulJoinSourceId: join.sourceId,
      identifier: join.identifier,
      name: join.name,
      owningFolderIdentifier: join.owningFolderIdentifier,
      owningFolderName: join.owningFolderName,
    });
  }
  return joins;
}

/** The sort placement fields of a `TransformedMapItem`, for an unsorted item. */
const NO_SORT = {
  sortDirection: null,
  sortOrder: null,
  sortGroup: false,
} satisfies Pick<TransformedMapItem, 'sortDirection' | 'sortOrder' | 'sortGroup'>;

/**
 * Name the map a worksheet becomes.
 *
 * A single-worksheet workbook keeps the workbook's own name, which is what
 * users have always called that report (`GD_M.M172_V01`). Only when a workbook
 * holds several worksheets is the worksheet name appended, because there the
 * workbook name alone would name several different maps.
 */
export function mapNameForWorksheet(
  workbookName: string,
  worksheetName: string | null,
  worksheetCount: number,
): string {
  const sheet = (worksheetName ?? '').trim();
  if (worksheetCount <= 1 || sheet === '') return workbookName;
  if (sheet.toLowerCase() === workbookName.toLowerCase()) return workbookName;
  return `${workbookName} — ${sheet}`;
}

/**
 * Turn one EUL workbook into one Neo map per worksheet.
 *
 * Returns an array, not a single map: see `TransformedWorkbook` for why a
 * workbook cannot collapse into one map. A workbook whose body could not be
 * decoded still yields exactly one map, carrying the metadata and a warning,
 * so nothing disappears from the target just because its layout was
 * unreadable.
 */
export function transformWorkbook(
  workbook: ParsedWorkbook,
  _version: EulVersion,
): TransformedWorkbook[] {
  const document = workbook.document;

  let workbookName = (workbook.name ?? '').trim();
  if (workbookName === '') workbookName = document.name?.trim() ?? '';
  if (workbookName === '') workbookName = `Workbook ${workbook.sourceId}`;

  const owner = workbook.owner ?? workbook.createdBy;
  const base = {
    sourceId: workbook.sourceId,
    description: workbook.description,
    ownerUsername: owner,
    isPublic: false,
    createdAt: workbook.createdAt,
    updatedAt: workbook.updatedAt,
    worksheetCount: document.worksheets.length,
  };

  // --- body unreadable: one metadata-only map, clearly flagged ---------------
  if (document.worksheets.length === 0) {
    const reason =
      document.format === 'EMPTY'
        ? 'its body is empty in DOCUMENTS'
        : document.format === 'XML'
          ? 'its body is XML that carries no worksheet elements'
          : 'its body could not be decoded';
    return [
      {
        ...base,
        worksheetIndex: 0,
        name: clamp(workbookName, NAME_MAX),
        // Nothing decoded, so nothing to say about the layout: a map with no
        // worksheet is a table that selects every row, exactly as it was
        // before the layout model existed.
        mapType: 'TABLE' satisfies NeoMapType,
        selectDistinct: false,
        items: [],
        conditions: [],
        parameters: [],
        calculatedFields: [],
        totals: [],
        pageSetup: null,
        // No worksheet decoded, so there is no heading, GUID or element id to
        // record. The row is still written: index 0 is true of the one map
        // this workbook produces, and a `map_layouts` row that exists and is
        // empty says "nothing was readable here", which a missing row does not.
        layout: {
          worksheetIndex: 0,
          worksheetGuid: null,
          title: null,
          titleRtf: null,
          titleHtml: null,
          queryCount: null,
          sourceElementId: null,
        },
        joins: [],
        warnings: [
          {
            code: 'WORKBOOK_LAYOUT_MANUAL',
            message:
              `Workbook "${workbookName}" migrates as an empty map because ${reason}; ` +
              'its worksheets and column layout must be rebuilt in Discoverer Neo.',
            sourceId: workbook.sourceId,
          },
          ...document.warnings.map((message) => ({
            code: 'WORKBOOK_PARSE',
            message: `Workbook "${workbookName}": ${message}`,
            sourceId: workbook.sourceId,
          })),
        ],
      },
    ];
  }

  // Conditions, parameters and calculations are stored once per workbook, and
  // nothing in a worksheet's own section of the body says which worksheet
  // activates which. They are therefore attached to every map the workbook
  // produces — dropping them would lose real filters, and a multi-worksheet
  // workbook gets an explicit warning to review them.
  //
  // The prompt is what its author typed; a bind variable has to be an Oracle
  // identifier. Both are derived once per workbook so that every map the
  // workbook produces binds the same prompt the same way.
  const declaredBinds = new Set<string>();
  const bindByPrompt = new globalThis.Map<string, string>();
  const parameters: TransformedMapParameter[] = document.parameters.map((parameter) => {
    const name = clamp(parameter.name, NAME_MAX);
    const key = promptKey(name);
    // A workbook can declare the same prompt twice. The writer keeps only the
    // first row, so a repeat has to reuse its bind name rather than take a
    // second one and leave conditions pointing at a row nobody wrote.
    let bindName = bindByPrompt.get(key);
    if (bindName === undefined) {
      bindName = makeBindName(name, declaredBinds);
      bindByPrompt.set(key, bindName);
    }
    return {
      name,
      bindName,
      paramType: inferParameterType(parameter.defaultValue, parameter.description),
      defaultValue: parameter.defaultValue,
      isRequired: parameter.defaultValue === null,
    };
  });

  // Page setup (§7.8.12) is one element per document, in the shared prefix
  // every worksheet's section follows — so every map this workbook produces
  // gets the same row, exactly as every map gets the same parameter list.
  const pageSetup = document.pageSetup ? buildPageSetup(document.pageSetup) : null;
  const joinsByElement = new globalThis.Map(document.joins.map((join) => [join.elementId, join]));

  return document.worksheets.map((worksheet) => {
    const warnings: TransformWarning[] = [];

    // A condition can name a prompt the workbook never declared — Discoverer
    // resolved those case-insensitively and did not always write the
    // declaration back. It still needs a bind name, and one that cannot
    // collide with a declared prompt's. Allocated per map because the bind
    // names have to be unique per map, and every worksheet of this workbook
    // sees the same condition list, so every map gets the same answer.
    const undeclaredBinds = new Set(declaredBinds);
    const undeclaredByPrompt = new globalThis.Map<string, string>();
    const bindNameFor = (prompt: string): string => {
      const key = promptKey(prompt);
      const declared = bindByPrompt.get(key);
      if (declared !== undefined) return declared;
      let bind = undeclaredByPrompt.get(key);
      if (bind === undefined) {
        bind = makeBindName(clamp(prompt, NAME_MAX), undeclaredBinds);
        undeclaredByPrompt.set(key, bind);
      }
      return bind;
    };
    const name = clamp(
      mapNameForWorksheet(workbookName, worksheet.name, document.worksheets.length),
      NAME_MAX,
    );

    // A worksheet whose layout model did not decode keeps exactly the shape it
    // had before §7.8 was read: a table, no DISTINCT, no axis on any column
    // and no hidden items. An undecodable layout is a missing answer, never a
    // reason to invent one.
    const layout = worksheet.layoutDecoded;

    // Sorting reaches the worksheet through the same layout → query-request
    // chain the axis lists do, so an undecodable layout has no sorts to place
    // and every column below keeps `NO_SORT` — the state every map was in
    // before sorting migrated at all.
    const sortByItem = layout
      ? indexWorksheetSorts(worksheet.sorts)
      : new globalThis.Map<number, WorksheetSortPlacement>();
    const placedSorts = new Set<number>();
    const sortFor = (
      itemElementRef: number | null,
    ): Pick<TransformedMapItem, 'sortDirection' | 'sortOrder' | 'sortGroup'> => {
      if (itemElementRef === null) return NO_SORT;
      const sort = sortByItem.get(itemElementRef);
      if (sort === undefined) return NO_SORT;
      placedSorts.add(itemElementRef);
      return { sortDirection: sort.direction, sortOrder: sort.order, sortGroup: sort.group };
    };

    const items: TransformedMapItem[] = worksheet.columns.map((column) => ({
      itemSourceId: column.itemSourceId,
      folderLabel: column.folderLabel,
      itemLabel: column.itemLabel,
      // Only a heading that actually differs from the item's own name is worth
      // storing; repeating the name adds a redundant override in Neo's UI.
      displayName:
        column.heading !== null && column.heading !== column.itemLabel
          ? clamp(column.heading, NAME_MAX)
          : null,
      formatMask: column.formatMask ? clamp(column.formatMask, NAME_MAX) : null,
      displayOrder: column.displayOrder,
      isCalculation: column.isCalculation,
      // The column's own `EDCBAxisType` first: it is the only field that can
      // say PAGE. The query request's list is the fallback, and is the same
      // thing Oracle's dump reports as Axis / Measure Item Usage.
      axisType: layout ? (column.axisType ?? column.queryAxisKind) : null,
      axisOrder: layout ? column.axisOrder : null,
      isHidden: false,
      // Item format (§7.8.8) — the style chain the parser already resolved
      // (`0x02c0` → `0x0320` → `0x07d0` → `0x0640`) exactly the way it
      // resolves `formatMask` above.
      columnWidth: column.displayWidth,
      dataType: column.dataType,
      headingFormatMask: column.headingFormatMask
        ? clamp(column.headingFormatMask, NAME_MAX)
        : null,
      // `0x0643` has six observed codes and an independent bit with no
      // confirmed mapping (§7.8.8), so alignment is never named — only kept
      // raw in `sourceAttrs` below.
      alignment: null,
      wordWrap: column.wordWrapFlag === null ? null : column.wordWrapFlag !== 0,
      sourceElementId: column.elementId,
      sourceAttrs: column.alignmentCode === null ? null : { alignmentCode: column.alignmentCode },
      ...sortFor(column.itemElementRef),
    }));

    // Items the query names that no column draws. They carry no display order
    // of their own, so they follow the columns in the order the query lists
    // them — which keeps `display_order` unique within the map without
    // implying they are drawn after the last column.
    if (layout) {
      worksheet.hiddenItems.forEach((hidden, offset) => {
        items.push({
          itemSourceId: hidden.itemSourceId,
          folderLabel: hidden.folderLabel,
          itemLabel: hidden.itemLabel,
          displayName: null,
          formatMask: null,
          displayOrder: worksheet.columns.length + offset,
          isCalculation: hidden.isCalculation,
          axisType: hidden.axisKind,
          axisOrder: hidden.axisOrder,
          isHidden: true,
          // A hidden item shows no column, so it carries no format block —
          // nothing here to read the item format's fields off of.
          columnWidth: null,
          dataType: null,
          headingFormatMask: null,
          alignment: null,
          wordWrap: null,
          sourceElementId: hidden.elementId,
          sourceAttrs: null,
          // A sort can name an item the sheet does not draw. The row records
          // it, and Neo's ORDER BY skips it the same way its SELECT list does
          // — a hidden item has no SELECT position to order by.
          ...sortFor(hidden.elementId),
        });
      });
    }

    // --- what sorting could not carry, said plainly ------------------------

    // A sort whose `Direction` is neither 1 nor 2. Unobserved corpus-wide
    // (3 754 ascending / 28 descending across the dumped 3 782), so this is a
    // report, not a fallback: the row keeps its position and gets no direction.
    const unnamedDirections = worksheet.sorts.filter(
      (sort) => sort.directionCode !== null && sort.direction === null,
    ).length;
    if (layout && unnamedDirections > 0) {
      warnings.push({
        code: 'MAP_SORT_DIRECTION_UNKNOWN',
        message:
          `Map "${name}": ${unnamedDirections} sort(s) carry a Direction code that is ` +
          'neither 1 (ascending) nor 2 (descending); the column keeps its sort position ' +
          'but no direction, so the map generates no ORDER BY for it.',
        sourceId: workbook.sourceId,
      });
    }

    // A sort on a workbook calculation. `map_items.item_id` is NOT NULL, so a
    // calculation column is a `map_calculated_fields` row instead, and that
    // table has no sort columns — the sort is lost, not silently moved.
    // 183 of the 3 782 sorts in Oracle's own dumps of the corpus (4.8 %).
    const calculationSorts = items.filter(
      (item) => item.isCalculation && item.sortOrder !== null,
    ).length;
    if (calculationSorts > 0) {
      warnings.push({
        code: 'MAP_SORT_ON_CALCULATION',
        message:
          `Map "${name}": ${calculationSorts} sort(s) are on a workbook calculation, ` +
          'which migrates as a calculated field rather than a map column and has no ' +
          'sort of its own; re-apply the sort after rewriting the calculation as SQL.',
        sourceId: workbook.sourceId,
      });
    }

    // A sort naming an item that neither a column nor a hidden item accounts
    // for. Nothing in the corpus produces this — every sort's item is in the
    // query — so it means the layout and the query disagree, worth saying.
    const unplacedSorts = [...sortByItem.keys()].filter((id) => !placedSorts.has(id)).length;
    if (unplacedSorts > 0) {
      warnings.push({
        code: 'MAP_SORT_ITEM_UNRESOLVED',
        message:
          `Map "${name}": ${unplacedSorts} sort(s) name an item the worksheet neither ` +
          'displays nor queries, so they could not be attached to a column; ' +
          're-apply them manually.',
        sourceId: workbook.sourceId,
      });
    }

    // A column's cell alignment (`0x0643`) has no confirmed code → value
    // mapping (§7.8.8), so `alignment` above is always null; this is the one
    // place that says so, rather than a column-by-column warning for each of
    // what can be thousands of columns.
    const unnamedAlignments = worksheet.columns.filter((c) => c.alignmentCode !== null).length;
    if (unnamedAlignments > 0) {
      warnings.push({
        code: 'MAP_ITEM_ALIGNMENT_UNKNOWN',
        message:
          `Map "${name}": ${unnamedAlignments} column(s) carry a cell-alignment code ` +
          'Discoverer never documented; the column migrates with its format mask, width ' +
          'and word wrap but no alignment — set it in Discoverer Neo. The raw code is kept ' +
          'in map_items.source_attrs.alignmentCode.',
        sourceId: workbook.sourceId,
      });
    }

    // The joins (§7.8.9) this worksheet's query requests force, resolved to
    // the workbook's own `0x0118` elements. Unioned across every query the
    // worksheet links — the corpus never links more than one, but the format
    // allows it.
    const joins = resolveWorksheetJoins(worksheet, joinsByElement);

    // A Discoverer condition is a tree; a Neo condition is a row. One source
    // condition therefore produces one row per test it makes, tied together by
    // `groupKey` so the generated SQL brackets them the way Discoverer did.
    const conditions: TransformedMapCondition[] = [];
    document.conditions.forEach((condition, index) => {
      const sourceText = condition.sql ?? condition.name;
      if (condition.unsupported !== null) {
        warnings.push({
          code: 'CONDITION_OPERATOR_UNMAPPED',
          message:
            `Map "${name}": condition ${JSON.stringify(sourceText ?? '')} was not migrated ` +
            `as a filter because ${condition.unsupported}; recreate it manually.`,
          sourceId: workbook.sourceId,
        });
        return;
      }
      for (const [groupIndex, group] of condition.groups.entries()) {
        // Only a group with something to bracket needs a key; a lone predicate
        // is its own clause and a key would only add empty parentheses.
        const groupKey =
          group.predicates.length > 1 ? `c${index}g${groupIndex}` : null;
        for (const [predicateIndex, predicate] of group.predicates.entries()) {
          conditions.push({
            itemSourceId: predicate.itemSourceId,
            folderLabel: predicate.folderLabel,
            itemLabel: predicate.itemLabel,
            operator: predicate.neoOperator,
            value: predicate.value,
            // The parameter's bind name, not the prompt — see `makeBindName`.
            paramName:
              predicate.parameterName === null
                ? null
                : bindNameFor(predicate.parameterName),
            conditionType: predicate.parameterName !== null ? 'PARAMETER' : 'STATIC',
            displayOrder: conditions.length,
            sourceText,
            sourceIndex: index,
            groupKey,
            // The first row of a group carries how the group joins the
            // previous one; the rest carry how they join inside it.
            logicOperator: predicateIndex === 0 ? group.join : group.inner,
          });
        }
      }
    });

    // Calculations belong to the worksheet that offers them — the workbook
    // writes them once per worksheet section.
    const calculatedFields: TransformedMapCalculatedField[] = worksheet.calculations.map(
      (calculation, index) => ({
        name: clamp(calculation.name, NAME_MAX),
        // The token form is the only formula the workbook stores. It is kept
        // verbatim (with item/parameter references resolved to names) rather
        // than machine-translated to SQL: Oracle's function-code table is not
        // available, and a half-translated formula would look runnable when it
        // is not.
        formula: calculation.readableFormula ?? calculation.tokens ?? '',
        displayOrder: index,
        // `Placement` and `Hidden` are the calculation element's own fields —
        // both printed by `d4wkdmp -f` and agreeing with it on all 41 982
        // calculations of the source corpus — so they do not depend on the
        // layout decoding.
        axisType: axisTypeForPlacement(calculation.placementCode),
        isHidden: calculation.hidden ?? false,
      }),
    );

    // --- totals (§7.8.7, §7.12) --------------------------------------------
    //
    // A total is written into the worksheet's own section, so it belongs to
    // that worksheet with no layout indirection — unlike sorting, it does not
    // reach the sheet through the query request. It is still gated on `layout`
    // for one reason: `measureItemOrder` names a `map_items` row, and an
    // undecodable layout is exactly the case where the column list Neo writes
    // is not the one Discoverer drew.
    const columnByElement = layout
      ? indexTotalColumns(worksheet.columns)
      : new globalThis.Map<number, TotalColumnTarget>();
    // `worksheet.calculations` is what becomes `map_calculated_fields`, in
    // order, so a calculation's index there is its `display_order`.
    const calculationOrderByElement = new globalThis.Map<number, number>();
    worksheet.calculations.forEach((calculation, index) => {
      calculationOrderByElement.set(calculation.elementId, index);
    });

    let unresolvedTotalColumns = 0;
    let unnamedTotalFunctions = 0;
    let inexpressibleTotalFunctions = 0;
    let breaksOnCalculation = 0;
    const totals: TransformedMapTotal[] = [];
    worksheet.totals.forEach((total) => {
      const measure = total.columnRef === null ? undefined : columnByElement.get(total.columnRef);
      if (measure === undefined) {
        // 2 of the corpus's 19 639 summaries name a column the worksheet does
        // not hold. A total with no column to aggregate is not a total, so it
        // is dropped and counted rather than written pointing at nothing.
        unresolvedTotalColumns += 1;
        return;
      }

      // A calculation column has no `map_items` row — `map_items.item_id` is
      // NOT NULL — but `map_totals` has its own reference for that case, so a
      // total on a calculation migrates in full rather than being lost.
      const measureCalculationOrder =
        measure.isCalculation && measure.calculationElementId !== null
          ? (calculationOrderByElement.get(measure.calculationElementId) ?? null)
          : null;
      const measureItemOrder = measure.isCalculation ? null : measure.displayOrder;
      // The other way to get here: the column shows a calculation the parser
      // could not read, so no calculated field carries it either.
      if (measureItemOrder === null && measureCalculationOrder === null) {
        unresolvedTotalColumns += 1;
        return;
      }

      // A break column that resolves to nothing leaves `break_map_item_id`
      // null and keeps the row: the aggregate is unchanged, only where
      // Discoverer drew it is lost, and `0x0c23` survives in `sourceAttrs`.
      const breakColumn =
        total.breakColumnRef === null ? undefined : columnByElement.get(total.breakColumnRef);
      if (breakColumn !== undefined && breakColumn.isCalculation) breaksOnCalculation += 1;
      // Two different failures, reported apart: a code nothing has decoded, and
      // a function that *is* decoded but Neo's SQL generator cannot emit.
      if (total.aggFunction === null) {
        if (total.discovererName !== null) inexpressibleTotalFunctions += 1;
        else if (total.functionCode !== null) unnamedTotalFunctions += 1;
      }

      totals.push({
        // Discoverer keeps a percentage in this same element, as a value of
        // the same aggregate enum (§7.12), and none of the corpus's codes is
        // one — so nothing here can honestly claim to be a PERCENTAGE.
        kind: 'TOTAL',
        measureItemOrder,
        measureCalculationOrder,
        breakItemOrder:
          breakColumn === undefined || breakColumn.isCalculation
            ? null
            : breakColumn.displayOrder,
        aggFunction: total.aggFunction,
        placement: total.placement,
        label: total.label === null ? null : clamp(total.label, NAME_MAX),
        displayOrder: totals.length,
        sourceElementId: total.elementId,
        // `d4wkdmp` prints nothing at all about summaries, so every raw code
        // here is worth keeping: the two enums are only partly decoded and the
        // five flags not at all.
        sourceAttrs: {
          functionCode: total.functionCode,
          // What Discoverer computes, including the one value Neo cannot run.
          functionName: total.discovererName,
          placementCode: total.placementCode,
          columnElementRef: total.columnRef,
          breakColumnElementRef: total.breakColumnRef,
          dataStyleRef: total.dataStyleRef,
          headingStyleRef: total.headingStyleRef,
          unconfirmedFlags: total.unconfirmedFlags,
        },
      });
    });

    // --- what totalling could not carry, said plainly ----------------------

    if (unresolvedTotalColumns > 0) {
      warnings.push({
        code: 'MAP_TOTAL_COLUMN_UNRESOLVED',
        message:
          `Map "${name}": ${unresolvedTotalColumns} total(s) aggregate a column that ` +
          'could not be resolved to a map column or a calculated field, and were not ' +
          'migrated; re-create them in Discoverer Neo.',
        sourceId: workbook.sourceId,
      });
    }

    // The function is the one field that changes what the total *computes*, so
    // neither of the two failures below is defaulted to SUM.

    // Decoded, but outside SUM/COUNT/AVG/MIN/MAX — in practice COUNT DISTINCT
    // (§7.12). Neo's SELECT builder throws on an aggregate it does not know,
    // so writing it would break the map; writing COUNT instead would count
    // duplicates and quietly show a different number.
    if (inexpressibleTotalFunctions > 0) {
      warnings.push({
        code: 'MAP_TOTAL_AGG_UNSUPPORTED',
        message:
          `Map "${name}": ${inexpressibleTotalFunctions} total(s) compute COUNT DISTINCT, ` +
          'which Discoverer Neo cannot express — its SQL generator accepts only SUM, ' +
          'COUNT, AVG, MIN and MAX. The total migrates with its label and placement and ' +
          'no aggregate function; the function is recorded in ' +
          'map_totals.source_attrs.functionName.',
        sourceId: workbook.sourceId,
      });
    }

    // Not decoded at all: EDCBAggregateType codes 5, 6 and 9 (§7.12).
    if (unnamedTotalFunctions > 0) {
      warnings.push({
        code: 'MAP_TOTAL_FUNCTION_UNKNOWN',
        message:
          `Map "${name}": ${unnamedTotalFunctions} total(s) use an EDCBAggregateType code ` +
          'that is not decoded — only 1 (SUM), 2 (AVG), 3 (COUNT) and 4 (COUNT DISTINCT) ' +
          'are established. The total migrates with its label and placement but no ' +
          'aggregate function — set it in Discoverer Neo. The raw code is kept in ' +
          'map_totals.source_attrs.',
        sourceId: workbook.sourceId,
      });
    }

    // `map_totals.break_map_item_id` references `map_items`, and a calculation
    // column is not one — the same NOT NULL `item_id` that costs sorting its
    // calculation columns.
    if (breaksOnCalculation > 0) {
      warnings.push({
        code: 'MAP_TOTAL_BREAK_ON_CALCULATION',
        message:
          `Map "${name}": ${breaksOnCalculation} subtotal(s) break at each change in a ` +
          'workbook calculation, which migrates as a calculated field rather than a map ' +
          'column; the total keeps its function and label but breaks on nothing — ' +
          're-apply the break after rewriting the calculation as SQL.',
        sourceId: workbook.sourceId,
      });
    }

    // Displayed calculation columns only: a calculation the query names but
    // draws nowhere is not something a reader has to rewrite as SQL to see.
    const calculationColumns = items.filter(
      (item) => item.isCalculation && !item.isHidden,
    ).length;
    if (calculationColumns > 0) {
      warnings.push({
        code: 'MAP_CALCULATION_COLUMNS',
        message:
          `Map "${name}" displays ${calculationColumns} workbook calculation(s). ` +
          'They are migrated as calculated fields with their Discoverer formula text, ' +
          'which must be rewritten as SQL before the map will run.',
        sourceId: workbook.sourceId,
      });
    }

    if (!layout) {
      warnings.push({
        code: 'WORKSHEET_LAYOUT_UNDECODED',
        message:
          `Map "${name}" migrates without its Discoverer layout: the worksheet named no ` +
          'layout, view type or query request that could be decoded. It becomes a table ' +
          'that selects every row, with no axis on any column and no hidden items — ' +
          'review the axis and DISTINCT settings in Discoverer Neo.',
        sourceId: workbook.sourceId,
      });
    }

    if (document.conditionsAreWorkbookWide && document.conditions.length > 0) {
      warnings.push({
        code: 'CONDITIONS_WORKBOOK_WIDE',
        message:
          `Workbook "${workbookName}" has ${document.worksheets.length} worksheets and ` +
          `${document.conditions.length} condition(s). Discoverer stores conditions per ` +
          'workbook, not per worksheet, so every condition was attached to every map it ' +
          `produced — review "${name}" and remove the ones that worksheet did not use.`,
        sourceId: workbook.sourceId,
      });
    }

    for (const message of document.warnings) {
      warnings.push({
        code: 'WORKBOOK_PARSE',
        message: `Workbook "${workbookName}": ${message}`,
        sourceId: workbook.sourceId,
      });
    }

    return {
      ...base,
      worksheetIndex: worksheet.index,
      name,
      // The worksheet's printed title is more informative than the workbook
      // description (which is null on every workbook of the source EUL), so it
      // becomes the map description when there is one.
      description: worksheet.title ?? workbook.description,
      // `EDCBViewType` is the class the worksheet's `0x01f8` names, and Neo's
      // `maps.map_type` is where it lives — its other two values (PAGE_DETAIL,
      // CHART) are Neo-only and no migration writes them (§7.9.2).
      mapType: (worksheet.viewType === 'CROSSTAB' ? 'CROSSTAB' : 'TABLE') satisfies NeoMapType,
      selectDistinct: worksheet.selectDistinct === true,
      items,
      conditions,
      parameters,
      calculatedFields,
      totals,
      pageSetup,
      layout: {
        worksheetIndex: worksheet.index,
        worksheetGuid: worksheet.guid,
        title: worksheet.title,
        titleRtf: worksheet.titleRtf,
        titleHtml: worksheet.titleHtml,
        // The query links are a layout field, so an undecoded layout has no
        // count to report — 0 would claim the worksheet ran no query.
        queryCount: layout ? worksheet.queries.length : null,
        sourceElementId: worksheet.elementId,
      },
      joins,
      warnings,
    };
  });
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** Turn an Oracle username into a safe email local-part. */
export function usernameToEmailLocal(username: string): string {
  const local = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
  return local === '' ? 'user' : local;
}

export const MIGRATED_EMAIL_DOMAIN = 'migrated.local';

export function transformUser(user: EulUser, _version: EulVersion): TransformedUser {
  const warnings: TransformWarning[] = [];
  const username = user.username.trim();
  const local = usernameToEmailLocal(username);
  const email = `${local}@${MIGRATED_EMAIL_DOMAIN}`;

  if (local !== username.toLowerCase()) {
    warnings.push({
      code: 'USER_EMAIL_SYNTHESIZED',
      message: `User "${username}" has no email; synthesized "${email}".`,
    });
  }

  // A database ROLE is a grant-holder, not a person. Migrating it as an
  // ordinary user would imply someone can sign in as it.
  if (user.isRole) {
    warnings.push({
      code: 'GRANTEE_IS_DB_ROLE',
      message:
        `"${username}" is an Oracle database role, not a user. It was migrated as a ` +
        `non-login principal that holds grants; assign real users to it in Neo.`,
    });
  }

  return {
    username,
    email: clamp(email, NAME_MAX),
    name: clamp(username, NAME_MAX),
    // The runner replaces this for real people, once it has a hasher. Roles
    // keep it: they hold grants and must never be able to authenticate.
    passwordHash: MIGRATED_USER_PASSWORD_HASH,
    role: 'USER',
    isRole: user.isRole,
    // A role has no password to rotate; a person provisioned with a temporary
    // one must change it before the account is usable.
    mustChangePassword: !user.isRole,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Grant
// ---------------------------------------------------------------------------

export function transformGrant(grant: Grant, _version: EulVersion): TransformedGrant {
  const warnings: TransformWarning[] = [];
  const privType = (grant.privType ?? '').toUpperCase();
  const permissionLevel = GRANT_PERMISSION_MAP[privType] ?? DEFAULT_GRANT_PERMISSION;

  // Neo only models business-area-level grants. A FOLDER/OBJECT grant is
  // migrated as a grant on the folder's owning business area (resolved by the
  // runner); if it references neither a BA nor a folder, it can't be migrated.
  let skip = false;
  if (grant.level === 'BUSINESS_AREA' && grant.businessAreaId === null) {
    skip = true;
    warnings.push({
      code: 'GRANT_NO_BA',
      message: `Grant ${grant.sourceId} for "${grant.grantee}" has no business area; skipped.`,
      sourceId: grant.sourceId,
    });
  } else if (grant.level === 'FOLDER' && grant.folderId === null) {
    skip = true;
    warnings.push({
      code: 'GRANT_NO_FOLDER',
      message: `Folder-level grant ${grant.sourceId} for "${grant.grantee}" has no folder; skipped.`,
      sourceId: grant.sourceId,
    });
  } else if (grant.level === 'DOCUMENT') {
    // ACCESS_PRIVS.GD_DOC_ID — a share on a single workbook. Neo has no
    // workbook-level grant, and workbooks themselves are not migrated yet.
    skip = true;
    warnings.push({
      code: 'GRANT_ON_WORKBOOK',
      message: `Grant ${grant.sourceId} for "${grant.grantee}" applies to workbook ${grant.documentId}; Neo has no workbook-level grant, so it was not migrated.`,
      sourceId: grant.sourceId,
    });
  } else if (grant.level === 'EUL') {
    // An EUL-wide privilege (GP_APP_ID with no object target) — e.g. the
    // administration privileges. Not representable as a business-area grant.
    skip = true;
    warnings.push({
      code: 'GRANT_EUL_WIDE',
      message: `Grant ${grant.sourceId} for "${grant.grantee}" is an EUL-wide privilege (code ${grant.privCode ?? 'unknown'}); review it manually in Neo.`,
      sourceId: grant.sourceId,
    });
  }

  return {
    sourceId: grant.sourceId,
    granteeUsername: grant.grantee,
    granteeIsRole: grant.granteeIsRole,
    businessAreaSourceId: grant.businessAreaId,
    folderSourceId: grant.folderId,
    level: grant.level,
    permissionLevel,
    warnings,
    skip,
  };
}

// ---------------------------------------------------------------------------
// Plural convenience wrappers (match the session-plan signatures)
// ---------------------------------------------------------------------------

export function transformUsers(users: EulUser[], version: EulVersion): TransformedUser[] {
  return users.map((u) => transformUser(u, version));
}

export function transformGrants(grants: Grant[], version: EulVersion): TransformedGrant[] {
  return grants.map((g) => transformGrant(g, version));
}

// ---------------------------------------------------------------------------
// Writing a map's totals
// ---------------------------------------------------------------------------

export interface MapTotalRow {
  [column: string]: unknown;
  id: string;
  mapId: string;
  kind: NeoMapTotalKind;
  mapItemId: string | null;
  mapCalculatedFieldId: string | null;
  breakMapItemId: string | null;
  aggFunction: string | null;
  placement: NeoMapTotalPlacement | null;
  label: string | null;
  displayOrder: number;
  sourceElementId: number;
  sourceAttrs: Record<string, unknown>;
}

/**
 * Turn one transformed total into a `map_totals` row, or `null` if the column
 * it aggregates did not survive the migration.
 *
 * Shared by the full migration and the maps-only re-import for the same reason
 * `buildMapConditionRows` is: `map_totals` is the one map table whose foreign
 * keys point at *other map rows* rather than at EUL entities, so its
 * references can only be resolved from what the caller has just written. The
 * lookups are the two the caller fills as it pushes rows, keyed by
 * `display_order`.
 *
 * A total whose measure column did not migrate is dropped, not written with a
 * null reference: `map_totals` with neither `map_item_id` nor
 * `map_calculated_field_id` aggregates nothing and would show in Neo as a
 * total of no column. The break column is different — it is a placement
 * detail, and a subtotal that has lost only its break still computes the same
 * aggregate — so a missing one leaves `break_map_item_id` null and keeps the
 * row.
 */
export function buildMapTotalRow(
  total: TransformedMapTotal,
  mapId: string,
  id: string,
  mapItemIdByOrder: ReadonlyMap<number, string>,
  calculatedFieldIdByOrder: ReadonlyMap<number, string>,
): MapTotalRow | null {
  const mapItemId =
    total.measureItemOrder === null
      ? null
      : (mapItemIdByOrder.get(total.measureItemOrder) ?? null);
  const mapCalculatedFieldId =
    total.measureCalculationOrder === null
      ? null
      : (calculatedFieldIdByOrder.get(total.measureCalculationOrder) ?? null);
  if (mapItemId === null && mapCalculatedFieldId === null) return null;

  return {
    id,
    mapId,
    kind: total.kind,
    mapItemId,
    mapCalculatedFieldId,
    breakMapItemId:
      total.breakItemOrder === null
        ? null
        : (mapItemIdByOrder.get(total.breakItemOrder) ?? null),
    aggFunction: total.aggFunction,
    placement: total.placement,
    label: total.label,
    displayOrder: total.displayOrder,
    sourceElementId: total.sourceElementId,
    sourceAttrs: total.sourceAttrs,
  };
}

// ---------------------------------------------------------------------------
// Writing a map's page setup
// ---------------------------------------------------------------------------

export interface MapPageSetupRow {
  [column: string]: unknown;
  id: string;
  mapId: string;
  orientation: null;
  scalePercent: null;
  headerLeft: null;
  headerCenter: null;
  headerRight: null;
  footerLeft: null;
  footerCenter: null;
  footerRight: null;
  marginTop: null;
  marginBottom: null;
  marginLeft: null;
  marginRight: null;
  marginHeader: null;
  marginFooter: null;
  printGridLines: null;
  printHeadings: null;
  sourceElementId: number;
  sourceAttrs: Record<string, unknown>;
}

/**
 * Turn a workbook's page setup into a `map_page_setup` row.
 *
 * Shared by the full migration and the maps-only re-import — unlike
 * `buildMapTotalRow`, there is nothing here for either caller to resolve, so
 * both would otherwise write this same object literal. Every named column but
 * `sourceElementId` is null: §7.8.12 confirms the six texts, fonts and
 * margins exist but not their tag order, and orientation, scale and the
 * grid-line/heading toggles are unconfirmed altogether — so a value in any of
 * them would be a guess. `sourceAttrs` (`pageSetup.sourceAttrs`) keeps the raw
 * arrays instead.
 */
export function buildMapPageSetupRow(
  pageSetup: TransformedMapPageSetup,
  mapId: string,
  id: string,
): MapPageSetupRow {
  return {
    id,
    mapId,
    orientation: null,
    scalePercent: null,
    headerLeft: null,
    headerCenter: null,
    headerRight: null,
    footerLeft: null,
    footerCenter: null,
    footerRight: null,
    marginTop: null,
    marginBottom: null,
    marginLeft: null,
    marginRight: null,
    marginHeader: null,
    marginFooter: null,
    printGridLines: null,
    printHeadings: null,
    sourceElementId: pageSetup.sourceElementId,
    sourceAttrs: pageSetup.sourceAttrs,
  };
}

// ---------------------------------------------------------------------------
// Writing a map's layout
// ---------------------------------------------------------------------------

export interface MapLayoutRow {
  [column: string]: unknown;
  id: string;
  mapId: string;
  worksheetIndex: number | null;
  worksheetGuid: string | null;
  title: string | null;
  titleRtf: string | null;
  titleHtml: string | null;
  queryCount: number | null;
  graph: unknown;
  sourceElementId: number | null;
  sourceAttrs: Record<string, unknown> | null;
}

/**
 * Turn a worksheet's identity, printed heading and join usage into one
 * `map_layouts` row.
 *
 * **Every migrated map gets one.** This used to be written only when the
 * worksheet forced a join, so a map's worksheet index, GUID and printed title
 * were lost on every worksheet that did not — which was most of them. The row
 * is the only place those live: `maps` has the worksheet's *name*, not the
 * multi-line heading Discoverer printed above the data.
 *
 * `graph` stays null. The graph block (`0x0272`) is empty on all 917 corpus
 * worksheets that have one, and Neo has no chart model to put it in — see the
 * migration guide's "Manual Migration Required".
 *
 * `joinAttrs` is passed in rather than resolved here: the full migration can
 * match a join reference to the `joins` row it just wrote, and the maps-only
 * re-import cannot, so each caller resolves its own and this shares the rest.
 */
export function buildMapLayoutRow(
  layout: TransformedMapLayout,
  joinAttrs: unknown[],
  mapId: string,
  id: string,
): MapLayoutRow {
  return {
    id,
    mapId,
    worksheetIndex: layout.worksheetIndex,
    worksheetGuid: layout.worksheetGuid,
    title: layout.title,
    titleRtf: layout.titleRtf,
    titleHtml: layout.titleHtml,
    queryCount: layout.queryCount,
    graph: null,
    sourceElementId: layout.sourceElementId,
    // Only carry the key when there is something under it: `{ joins: [] }` on
    // every join-free worksheet would read as "this worksheet was examined and
    // forced no joins" for readers who cannot tell it from an empty default.
    sourceAttrs: joinAttrs.length > 0 ? { joins: joinAttrs } : null,
  };
}

// ---------------------------------------------------------------------------
// Writing a map's conditions
// ---------------------------------------------------------------------------

export interface MapConditionRow {
  [column: string]: unknown;
  id: string;
  mapId: string;
  itemId: string;
  operator: NeoMapOperator;
  value: string | null;
  paramName: string | null;
  conditionType: NeoConditionType;
  groupId: string | null;
  logicOperator: 'AND' | 'OR';
  displayOrder: number;
}

export interface MapConditionRowsResult {
  rows: MapConditionRow[];
  /** One entry per source condition that could not be written, with the reason. */
  skipped: Array<{ reason: string }>;
}

/**
 * Turn a map's transformed conditions into `map_conditions` rows.
 *
 * Shared by the full migration and the maps-only re-import because two things
 * here are easy to get subtly wrong and expensive to get wrong twice:
 *
 *  - **All or nothing per source condition.** A compound condition becomes
 *    several rows; if any one of them names an item that did not migrate, none
 *    of them may be written. Keeping the rest would widen a conjunction
 *    (`a AND b` becoming `a`) or narrow a disjunction, and the map would
 *    silently return a different set of rows.
 *  - **Group ids are per map.** Two maps produced from the same workbook
 *    repeat the same conditions, and a group id shared across them would
 *    bracket rows belonging to different maps together.
 */
export function buildMapConditionRows(
  conditions: TransformedMapCondition[],
  mapId: string,
  resolveItem: (condition: TransformedMapCondition) => string | undefined,
  genId: () => string,
): MapConditionRowsResult {
  const rows: MapConditionRow[] = [];
  const skipped: MapConditionRowsResult['skipped'] = [];
  const groupIds = new Map<string, string>();

  const bySource = new Map<number, TransformedMapCondition[]>();
  for (const condition of conditions) {
    const group = bySource.get(condition.sourceIndex);
    if (group === undefined) bySource.set(condition.sourceIndex, [condition]);
    else group.push(condition);
  }

  for (const group of bySource.values()) {
    const resolved = group.map((condition) => ({
      condition,
      itemId: resolveItem(condition),
    }));
    const missing = resolved.find((entry) => entry.itemId === undefined);
    if (missing !== undefined) {
      const { condition } = missing;
      skipped.push({
        reason:
          `condition ${JSON.stringify(condition.sourceText ?? '')} on ` +
          `"${condition.folderLabel ?? '?'}.${condition.itemLabel ?? '?'}" — item not migrated`,
      });
      continue;
    }
    for (const { condition, itemId } of resolved) {
      let groupId: string | null = null;
      if (condition.groupKey !== null) {
        groupId = groupIds.get(condition.groupKey) ?? genId();
        groupIds.set(condition.groupKey, groupId);
      }
      rows.push({
        id: genId(),
        mapId,
        itemId: itemId!,
        // A transformed condition only carries an operator Neo accepts; the
        // ones it does not were dropped with a warning by `transformWorkbook`.
        operator: condition.operator!,
        value: condition.value,
        paramName: condition.paramName,
        conditionType: condition.conditionType,
        groupId,
        logicOperator: condition.logicOperator,
        displayOrder: condition.displayOrder,
      });
    }
  }

  return { rows, skipped };
}
