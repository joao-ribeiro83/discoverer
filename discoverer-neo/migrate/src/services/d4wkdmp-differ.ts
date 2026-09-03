/**
 * Compares Oracle's own `d4wkdmp.exe -f` dump of a workbook against what
 * `workbook-parser.ts` reads from the same workbook's raw bytes.
 *
 * This is the verification harness `DISCOVERER_NEO_WORKSHEET_FIDELITY_PLAN.md`
 * (task W1) calls for: everything later in that plan (W2 onward) is checked
 * against this differ's report rather than trusted on inspection. See
 * `migrate/src/scripts/diff-corpus.ts` for the CLI that drives it against a
 * live source, and `migrate/src/scripts/README.md` for how to run it.
 *
 * ## Correlation
 *
 * The dump's `IoId` — printed only on `EUL Item Reference` and `EUL Function
 * Reference` entries, because those are the two classes the token language
 * addresses by numeric id (`[6,n]` and `[2,n]`) — is exactly the raw
 * element's own sequential `id` (`readWorkbookElements`). That is an exact,
 * structural correlation and this differ trusts it completely.
 *
 * `EUL Private Item` (calculations) carries no `IoId` either, but it does
 * carry a negative synthetic `Id` — the same `0x00dd` field a real item uses
 * for its `EXPRESSIONS.EXP_ID`, just negative because a calculation has no
 * EUL row of its own — and that is exact and unique per calculation, so it is
 * the primary correlation key (see `diffCalculations`), with name as a
 * fallback only.
 *
 * `EUL Private Filter` (conditions) carries the same negative synthetic id in
 * `0x00fb`, printed as its `Id`, and is correlated on that — which matches all
 * 3 331 of the corpus's filters where name matching found 3 299.
 *
 * `Parameter` carries no id at all — Discoverer addresses those by name within
 * a query — so it is correlated by **name**, best-effort, and every diff this
 * produces says so. A name collision within one workbook would misattribute a
 * match; both trailing-whitespace parameter-name collisions and
 * calculation-name collisions have been observed live (see
 * `EUL_SCHEMA_GROUND_TRUTH.md` §7.7).
 *
 * `EUL Sort Item Reference` and `Query Request QRn` are correlated by
 * **document position**: the dump prints them in element order and numbers the
 * query requests accordingly. `EUL Join Reference` correlates on the EUL join
 * id it prints as `Id`.
 */

import type { ParsedDump, DumpEntry, DumpItemUsage } from './d4wkdmp-dump-parser.js';
import {
  CLASS,
  TAG,
  TAG_ITEM_SOURCE_ID,
  readWorkbookElements,
  type RawElement,
  type ParsedWorkbookDocument,
} from './workbook-parser.js';

/**
 * Collapse runs of whitespace.
 *
 * `d4wkdmp` indents the item name inside a usage line with tabs
 * (`Sort Item Usage -  Name = \t\tEUL Item - Folder.Item`), so a raw
 * comparison against a name the parser assembled would fail on layout alone.
 */
function normalize(value: string | null): string | null {
  if (value === null) return null;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed === '' ? null : collapsed;
}

// ---------------------------------------------------------------------------
// Field-level tally
// ---------------------------------------------------------------------------

export interface FieldTally {
  agree: number;
  disagree: number;
  /** The dump has a value, the parser output has none. */
  onlyInDump: number;
  /** The parser output has a value, the dump has none. */
  onlyInParser: number;
}

function emptyTally(): FieldTally {
  return { agree: 0, disagree: 0, onlyInDump: 0, onlyInParser: 0 };
}

interface Mismatch {
  key: string;
  field: string;
  dumpValue: string | null;
  parserValue: string | null;
}

/** Compare one field. Blank strings are treated as absent, matching the parser's own convention. */
function tallyField(
  tallies: Record<string, FieldTally>,
  mismatches: Mismatch[],
  field: string,
  key: string,
  dumpValue: string | null,
  parserValue: string | null,
  maxExamples: number,
): void {
  const t = (tallies[field] ??= emptyTally());
  const d = dumpValue && dumpValue.trim() !== '' ? dumpValue.trim() : null;
  const p = parserValue && parserValue.trim() !== '' ? parserValue.trim() : null;
  if (d === null && p === null) return;
  if (d === null) {
    t.onlyInParser += 1;
  } else if (p === null) {
    t.onlyInDump += 1;
  } else if (d === p) {
    t.agree += 1;
  } else {
    t.disagree += 1;
    if (mismatches.length < maxExamples) mismatches.push({ key, field, dumpValue: d, parserValue: p });
  }
}

// ---------------------------------------------------------------------------
// Section report
// ---------------------------------------------------------------------------

export interface SectionReport {
  /** How dump entries were matched to parser output. */
  correlation: 'ioId' | 'name' | 'position';
  dumpCount: number;
  parserCount: number;
  matched: number;
  /** Dump entries no parser-side counterpart was found for. */
  unmatchedDump: string[];
  /** Parser-side items no dump entry was found for. */
  unmatchedParser: string[];
  fields: Record<string, FieldTally>;
  examples: Mismatch[];
}

const MAX_EXAMPLES_PER_SECTION = 20;
const MAX_UNMATCHED_EXAMPLES = 20;

function capped(list: string[]): string[] {
  return list.length > MAX_UNMATCHED_EXAMPLES
    ? [...list.slice(0, MAX_UNMATCHED_EXAMPLES), `... and ${list.length - MAX_UNMATCHED_EXAMPLES} more`]
    : list;
}

// ---------------------------------------------------------------------------
// Items and functions — IoId correlation
// ---------------------------------------------------------------------------

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
 * Raw signed value of `tag` on `element`, sign included — unlike
 * `workbook-parser.ts`'s own internal `itemSourceId()`, which treats a
 * negative `0x00dd` as absent because that helper only ever wants a real
 * `EXPRESSIONS.EXP_ID`. A calculation's negative synthetic id is exactly
 * what `d4wkdmp -f` prints as a private item's `Id`, so it is the correlation
 * key here — see `diffCalculations`.
 */
function rawNumber(element: RawElement | undefined, tag: number): number | null {
  if (!element) return null;
  for (const entry of element.numbers) {
    if (entry.tag === tag) return entry.value;
  }
  return null;
}

/** A number as the dump prints it, or null when the field is absent. */
function numberText(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** A boolean as the dump prints it (`1` / `0`), or null when absent. */
function flagText(value: boolean | null | undefined): string | null {
  return value === null || value === undefined ? null : value ? '1' : '0';
}

function diffItemReferences(dump: ParsedDump, byId: Map<number, RawElement>): SectionReport {
  const dumpItems = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'EulItemReference' }> =>
    e.type === 'EulItemReference',
  );
  const parserItems = [...byId.values()].filter((el) => el.cls === CLASS.ITEM_REF);

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  let matched = 0;
  const matchedParserIds = new Set<number>();

  for (const item of dumpItems) {
    if (item.ioId === null) {
      unmatchedDump.push(`(no IoId) ${item.identifier ?? item.name ?? '?'}`);
      continue;
    }
    const element = byId.get(item.ioId);
    if (!element || element.cls !== CLASS.ITEM_REF) {
      unmatchedDump.push(`IoId=${item.ioId} ${item.identifier ?? item.name ?? '?'}`);
      continue;
    }
    matched += 1;
    matchedParserIds.add(item.ioId);
    const key = `IoId=${item.ioId}`;
    tallyField(fields, examples, 'identifier', key, item.identifier, firstString(element, TAG.ITEM_NAME), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'name', key, item.name, firstString(element, TAG.ITEM_LABEL), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'folderIdentifier', key, item.folderIdentifier, firstString(element, TAG.FOLDER_NAME), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'folderName', key, item.folderName, firstString(element, TAG.FOLDER_LABEL), MAX_EXAMPLES_PER_SECTION);
  }

  const unmatchedParser = parserItems
    .filter((el) => !matchedParserIds.has(el.id))
    .map((el) => `element#${el.id} ${firstString(el, TAG.ITEM_LABEL) ?? '?'}`);

  return {
    correlation: 'ioId',
    dumpCount: dumpItems.length,
    parserCount: parserItems.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(unmatchedParser),
    fields,
    examples,
  };
}

function diffFunctionReferences(dump: ParsedDump, byId: Map<number, RawElement>): SectionReport {
  const dumpFns = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'EulFunctionReference' }> =>
    e.type === 'EulFunctionReference',
  );
  const parserFns = [...byId.values()].filter((el) => el.cls === CLASS.FUNCTION);

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  let matched = 0;
  const matchedParserIds = new Set<number>();

  for (const fn of dumpFns) {
    if (fn.ioId === null) {
      unmatchedDump.push(`(no IoId) ${fn.identifier ?? '?'}`);
      continue;
    }
    const element = byId.get(fn.ioId);
    if (!element || element.cls !== CLASS.FUNCTION) {
      unmatchedDump.push(`IoId=${fn.ioId} ${fn.identifier ?? '?'}`);
      continue;
    }
    matched += 1;
    matchedParserIds.add(fn.ioId);
    const key = `IoId=${fn.ioId}`;
    tallyField(fields, examples, 'functionName', key, fn.functionName, firstString(element, TAG.FUNCTION_NAME), MAX_EXAMPLES_PER_SECTION);
  }

  const unmatchedParser = parserFns
    .filter((el) => !matchedParserIds.has(el.id))
    .map((el) => `element#${el.id} ${firstString(el, TAG.FUNCTION_NAME) ?? '?'}`);

  return {
    correlation: 'ioId',
    dumpCount: dumpFns.length,
    parserCount: parserFns.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(unmatchedParser),
    fields,
    examples,
  };
}

// ---------------------------------------------------------------------------
// Calculations — correlated by the workbook's own negative synthetic id
// ---------------------------------------------------------------------------

/**
 * A calculation's `0x00dd` field is negative — a synthetic id, since it has
 * no real `EXPRESSIONS` row — and `d4wkdmp -f` prints that exact value as
 * `EUL Private Item`'s `Id`. That makes it as exact a correlation key as
 * `IoId` is for items, once you read it without `workbook-parser.ts`'s own
 * `itemSourceId()` filtering it out (that helper wants a real positive
 * `EXP_ID` and treats negative as absent, correctly, for its own callers).
 *
 * This matters a great deal after the dedup-by-name fix
 * (`EUL_SCHEMA_GROUND_TRUTH.md` §7.7): several calculations can now share a
 * display name (disambiguated as `"NAME #elementId"`), so name matching alone
 * would only ever find the first of them again. Name is kept as a fallback
 * for the rare case a calculation carries no `0x00dd` at all.
 */
function diffCalculations(
  dump: ParsedDump,
  doc: ParsedWorkbookDocument,
  byId: Map<number, RawElement>,
): SectionReport & { matchedVia: { rawId: number; name: number } } {
  const dumpCalcs = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'EulPrivateItem' }> =>
    e.type === 'EulPrivateItem',
  );

  const byRawId = new Map<number, ParsedWorkbookDocument['calculations'][number]>();
  const byName = new Map<string, ParsedWorkbookDocument['calculations'][number]>();
  for (const calc of doc.calculations) {
    const raw = rawNumber(byId.get(calc.elementId), TAG_ITEM_SOURCE_ID);
    if (raw !== null && raw < 0 && !byRawId.has(raw)) byRawId.set(raw, calc);
    if (!byName.has(calc.name)) byName.set(calc.name, calc);
  }

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  let matched = 0;
  let matchedViaRawId = 0;
  let matchedViaName = 0;
  const matchedElementIds = new Set<number>();

  for (const calc of dumpCalcs) {
    let parserCalc = calc.id !== null ? byRawId.get(calc.id) : undefined;
    let via: 'rawId' | 'name' | null = parserCalc ? 'rawId' : null;
    if (!parserCalc && calc.name !== null) {
      parserCalc = byName.get(calc.name);
      if (parserCalc) via = 'name';
    }
    if (!parserCalc) {
      unmatchedDump.push(calc.name ?? '(no name)');
      continue;
    }
    matched += 1;
    if (via === 'rawId') matchedViaRawId += 1;
    else matchedViaName += 1;
    matchedElementIds.add(parserCalc.elementId);
    const key = calc.name ? `${calc.name} (Id=${calc.id})` : `Id=${calc.id}`;
    tallyField(fields, examples, 'ioFormula', key, calc.ioFormula, parserCalc.tokens, MAX_EXAMPLES_PER_SECTION);
    // The dump prints the name as written; the parser's `name` may carry a
    // disambiguating `#<elementId>` suffix when worksheet siblings collide
    // (`EUL_SCHEMA_GROUND_TRUTH.md` §7.7), so the raw label is what compares.
    tallyField(fields, examples, 'name', key, calc.name, firstString(byId.get(parserCalc.elementId), TAG.ITEM_LABEL), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'identifier', key, calc.identifier, parserCalc.identifier, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'desc', key, calc.desc, parserCalc.description, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'dataType', key, numberText(calc.dataType), numberText(parserCalc.dataTypeCode), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'placement', key, numberText(calc.placement), numberText(parserCalc.placementCode), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'hidden', key, flagText(calc.hidden), flagText(parserCalc.hidden), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'isACalc', key, flagText(calc.isACalc), flagText(parserCalc.isACalc), MAX_EXAMPLES_PER_SECTION);
  }

  const unmatchedParser = doc.calculations
    .filter((c) => !matchedElementIds.has(c.elementId))
    .map((c) => c.name);

  return {
    correlation: 'name',
    dumpCount: dumpCalcs.length,
    parserCount: doc.calculations.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(unmatchedParser),
    fields,
    examples,
    matchedVia: { rawId: matchedViaRawId, name: matchedViaName },
  };
}

/**
 * Correlate private filters on the condition's own synthetic id.
 *
 * A private filter carries the same `0x00fb` field an EUL filter reference
 * uses for its `EXPRESSIONS.EXP_ID`, just negative — it has no EUL row — and
 * `d4wkdmp -f` prints that exact value as `EUL Private Filter`'s `Id`. That is
 * as exact as `IoId` is for items. It replaced name matching, which found
 * 3 299 of the corpus's 3 331 filters; the id finds all 3 331, and the
 * "unmatched, carries neither `CONDITION_SQL` nor `CONDITION_NAME`" gap the
 * earlier report flagged as unexplained turns out to have been nothing more
 * than a condition with no name to match on.
 */
function diffPrivateFilters(dump: ParsedDump, doc: ParsedWorkbookDocument): SectionReport & { matchedVia: { sql: number; name: number } } {
  const dumpFilters = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'EulPrivateFilter' }> =>
    e.type === 'EulPrivateFilter',
  );
  const bySourceId = new Map<number, ParsedWorkbookDocument['conditions'][number]>();
  for (const condition of doc.conditions) {
    if (condition.sourceId !== null && !bySourceId.has(condition.sourceId)) {
      bySourceId.set(condition.sourceId, condition);
    }
  }
  const bySql = new Map(doc.conditions.filter((c) => c.sql !== null).map((c) => [c.sql!.trim(), c]));
  const byName = new Map(doc.conditions.filter((c) => c.name !== null).map((c) => [c.name!.trim(), c]));

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  let matched = 0;
  let matchedViaSourceId = 0;
  let matchedViaName = 0;
  const matchedElementIds = new Set<number>();

  for (const filter of dumpFilters) {
    const name = filter.name?.trim() ?? null;
    let condition = filter.id !== null ? bySourceId.get(filter.id) : undefined;
    let via: 'sourceId' | 'name' | null = condition ? 'sourceId' : null;
    if (!condition && name !== null) {
      condition = bySql.get(name) ?? byName.get(name);
      if (condition) via = 'name';
    }
    if (!condition) {
      unmatchedDump.push(name ?? `(Id=${filter.id ?? '?'})`);
      continue;
    }
    matched += 1;
    if (via === 'sourceId') matchedViaSourceId += 1;
    else matchedViaName += 1;
    matchedElementIds.add(condition.elementId);
    const key = name ?? `Id=${filter.id ?? '?'}`;
    tallyField(fields, examples, 'ioFormula', key, filter.ioFormula, condition.tokens, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'identifier', key, filter.identifier, condition.identifier, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'caseSensitive', key, flagText(filter.caseSensitive), flagText(condition.caseSensitive), MAX_EXAMPLES_PER_SECTION);
  }

  const unmatchedParser = doc.conditions
    .filter((c) => !matchedElementIds.has(c.elementId))
    .map((c) => `element#${c.elementId} ${c.name ?? c.sql ?? '?'}`);

  return {
    correlation: 'name',
    dumpCount: dumpFilters.length,
    parserCount: doc.conditions.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(unmatchedParser),
    fields,
    examples,
    matchedVia: { sql: matchedViaSourceId, name: matchedViaName },
  };
}

function diffParameters(dump: ParsedDump, doc: ParsedWorkbookDocument): SectionReport {
  const dumpParams = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'Parameter' }> => e.type === 'Parameter');
  const byName = new Map(doc.parameters.map((p) => [p.name, p]));

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  let matched = 0;
  const matchedNames = new Set<string>();

  for (const param of dumpParams) {
    const name = param.name;
    const parserParam = name !== null ? byName.get(name) : undefined;
    if (!parserParam) {
      unmatchedDump.push(name ?? '(no name)');
      continue;
    }
    matched += 1;
    matchedNames.add(name!);
    tallyField(fields, examples, 'prompt', name!, param.prompt, parserParam.prompt, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'identifier', name!, param.identifier, parserParam.identifier, MAX_EXAMPLES_PER_SECTION);
  }

  const unmatchedParser = doc.parameters.filter((p) => !matchedNames.has(p.name)).map((p) => p.name);

  return {
    correlation: 'name',
    dumpCount: dumpParams.length,
    parserCount: doc.parameters.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(unmatchedParser),
    fields,
    examples,
  };
}

// ---------------------------------------------------------------------------
// Sorts, query requests and joins — the worksheet model
// ---------------------------------------------------------------------------

/**
 * `EUL Sort Item Reference` entries against the parser's `0x00f0` elements.
 *
 * Both lists are in document order and the dump prints one entry per element,
 * so position is the correlation — the same rule that works for sheets.
 */
function diffSorts(dump: ParsedDump, byId: Map<number, RawElement>): SectionReport {
  const dumpSorts = dump.entries.filter(
    (e): e is Extract<DumpEntry, { type: 'EulSortItemReference' }> => e.type === 'EulSortItemReference',
  );
  const parserSorts = [...byId.values()].filter((el) => el.cls === CLASS.SORT).sort((a, b) => a.id - b.id);

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const matched = Math.min(dumpSorts.length, parserSorts.length);
  for (let k = 0; k < matched; k += 1) {
    const element = parserSorts[k]!;
    const key = `sort#${k + 1}`;
    tallyField(fields, examples, 'item', key, normalize(dumpSorts[k]!.item),
      normalize(elementDisplayName(rawFollow(byId, element, TAG.SORT_ITEM_REF), byId)), MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'direction', key, numberText(dumpSorts[k]!.direction),
      numberText(rawNumber(element, TAG.SORT_DIRECTION)), MAX_EXAMPLES_PER_SECTION);
  }

  return {
    correlation: 'position',
    dumpCount: dumpSorts.length,
    parserCount: parserSorts.length,
    matched,
    unmatchedDump: capped(dumpSorts.slice(matched).map((d) => normalize(d.item) ?? '?')),
    unmatchedParser: capped(parserSorts.slice(matched).map((el) => `element#${el.id}`)),
    fields,
    examples,
  };
}

/**
 * `Query Request QRn` against the parser's `0x0122` elements.
 *
 * The dump numbers query requests by document order, so `QRn` is the n-th
 * `0x0122` element — established by correlating the two across the corpus.
 * Each usage list is compared as the dump's own ordered ` | `-joined names,
 * which tests both membership and order in one field.
 */
function diffQueryRequests(dump: ParsedDump, byId: Map<number, RawElement>): SectionReport {
  const dumpQueries = dump.entries.filter(
    (e): e is Extract<DumpEntry, { type: 'QueryRequest' }> => e.type === 'QueryRequest',
  );
  const parserQueries = [...byId.values()].filter((el) => el.cls === CLASS.QUERY_REQUEST).sort((a, b) => a.id - b.id);

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const matched = Math.min(dumpQueries.length, parserQueries.length);
  const usageOf = (query: Extract<DumpEntry, { type: 'QueryRequest' }>, kind: string): string | null =>
    normalize(
      query.usages
        .filter((u) => u.kind === kind)
        .map((u) => u.name.replace(/^\s*Sort On\s*/, ''))
        .join(' | '),
    );
  const refsOf = (element: RawElement, tag: number): number[] => {
    for (const record of element.records) if (record.tag === tag && record.repeated) return record.numbers;
    return [];
  };

  for (let k = 0; k < matched; k += 1) {
    const dumpQuery = dumpQueries[k]!;
    const element = parserQueries[k]!;
    const key = `QR${dumpQuery.number}`;
    tallyField(fields, examples, 'distinct', key, flagText(dumpQuery.distinct),
      flagText(rawNumber(element, TAG.QUERY_DISTINCT) === null ? null : rawNumber(element, TAG.QUERY_DISTINCT) !== 0),
      MAX_EXAMPLES_PER_SECTION);
    for (const [field, kind, tag] of [
      ['axisItems', 'Axis', TAG.QUERY_AXIS_ITEMS],
      ['measureItems', 'Measure', TAG.QUERY_MEASURE_ITEMS],
      ['filters', 'Filter', TAG.QUERY_FILTERS],
      ['joins', 'Join', TAG.QUERY_JOINS],
    ] as const) {
      tallyField(fields, examples, field, key, usageOf(dumpQuery, kind),
        normalize(displayList(refsOf(element, tag), byId)), MAX_EXAMPLES_PER_SECTION);
    }
    // A sort usage names the item, not the sort element, so it is rendered
    // from the sort's own `Item` reference rather than through `displayList`.
    tallyField(fields, examples, 'sorts', key, usageOf(dumpQuery, 'Sort'),
      normalize(
        refsOf(element, TAG.QUERY_SORTS)
          .map((id) => elementDisplayName(rawFollow(byId, byId.get(id), TAG.SORT_ITEM_REF), byId) ?? '?')
          .join(' | '),
      ),
      MAX_EXAMPLES_PER_SECTION);
  }

  return {
    correlation: 'position',
    dumpCount: dumpQueries.length,
    parserCount: parserQueries.length,
    matched,
    unmatchedDump: capped(dumpQueries.slice(matched).map((d) => `QR${d.number}`)),
    unmatchedParser: capped(parserQueries.slice(matched).map((el) => `element#${el.id}`)),
    fields,
    examples,
  };
}

/** `EUL Join Reference` against the parser's `0x0118` elements, by EUL join id. */
function diffJoins(dump: ParsedDump, doc: ParsedWorkbookDocument): SectionReport {
  const dumpJoins = dump.entries.filter(
    (e): e is Extract<DumpEntry, { type: 'EulJoinReference' }> => e.type === 'EulJoinReference',
  );
  const bySourceId = new Map(doc.joins.filter((j) => j.sourceId !== null).map((j) => [j.sourceId!, j]));

  const fields: Record<string, FieldTally> = {};
  const examples: Mismatch[] = [];
  const unmatchedDump: string[] = [];
  const matchedElementIds = new Set<number>();
  let matched = 0;

  for (const join of dumpJoins) {
    const parserJoin = join.id === null ? undefined : bySourceId.get(join.id);
    if (!parserJoin) {
      unmatchedDump.push(join.name ?? `(Id=${join.id ?? '?'})`);
      continue;
    }
    matched += 1;
    matchedElementIds.add(parserJoin.elementId);
    const key = `Id=${join.id}`;
    tallyField(fields, examples, 'identifier', key, join.identifier, parserJoin.identifier, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'name', key, join.name, parserJoin.name, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'owningFolderIdentifier', key, join.owningFolderIdentifier, parserJoin.owningFolderIdentifier, MAX_EXAMPLES_PER_SECTION);
    tallyField(fields, examples, 'owningFolderName', key, join.owningFolderName, parserJoin.owningFolderName, MAX_EXAMPLES_PER_SECTION);
  }

  return {
    correlation: 'ioId',
    dumpCount: dumpJoins.length,
    parserCount: doc.joins.length,
    matched,
    unmatchedDump: capped(unmatchedDump),
    unmatchedParser: capped(doc.joins.filter((j) => !matchedElementIds.has(j.elementId)).map((j) => j.name ?? '?')),
    fields,
    examples,
  };
}

// ---------------------------------------------------------------------------
// Sheets — position correlation
// ---------------------------------------------------------------------------

/**
 * The name `d4wkdmp` prints for an element wherever it names one — a query
 * request's usage lines, a sheet's `Items :-` / `Filters :-` / `Joins :-`
 * lists, and a sort's `Item`. Rendering the parser's side the same way is what
 * makes those lists comparable at all.
 */
function elementDisplayName(
  element: RawElement | undefined,
  byId: Map<number, RawElement>,
): string | null {
  if (element === undefined) return null;
  switch (element.cls) {
    case CLASS.ITEM_REF: {
      const folder = firstString(element, TAG.FOLDER_LABEL);
      const item = firstString(element, TAG.ITEM_LABEL);
      return folder !== null && item !== null ? `EUL Item - ${folder}.${item}` : null;
    }
    case CLASS.CALCULATION: {
      const name = firstString(element, TAG.ITEM_LABEL);
      return name === null ? null : `Calculation - ${name}`;
    }
    case CLASS.EUL_FILTER_REF: {
      const folder = firstString(element, TAG.FILTER_FOLDER_LABEL);
      const name = firstString(element, TAG.CONDITION_SQL);
      return folder !== null && name !== null ? `EUL Filter - ${folder}.${name}` : null;
    }
    case CLASS.CONDITION: {
      const name = firstString(element, TAG.CONDITION_SQL);
      return name === null ? null : `Private Filter - ${name}`;
    }
    case CLASS.JOIN_REF: {
      const name = firstString(element, TAG.JOIN_NAME);
      return name === null ? null : `EUL Join - ${name}`;
    }
    case CLASS.SORT: {
      const item = elementDisplayName(rawFollow(byId, element, TAG.SORT_ITEM_REF), byId);
      return item === null ? null : `Sort On ${item}`;
    }
    default:
      return null;
  }
}

/** Follow a reference field to the element it names. */
function rawFollow(
  byId: Map<number, RawElement>,
  element: RawElement | undefined,
  tag: number,
): RawElement | undefined {
  const id = rawNumber(element, tag);
  return id === null || id === 0 ? undefined : byId.get(id);
}

/** Render a list of element ids as the dump's own ` | `-joined display names. */
function displayList(ids: readonly number[], byId: Map<number, RawElement>): string | null {
  if (ids.length === 0) return null;
  return ids.map((id) => elementDisplayName(byId.get(id), byId) ?? '?').join(' | ');
}

/**
 * The display string a dump's "Items :-" list and Query Request usages use for
 * a column's source.
 *
 * Takes the identity fields alone, so it serves a displayed column and a
 * `ParsedWorksheet.hiddenItems` entry alike — both carry the same four.
 */
function columnDisplayName(col: {
  isCalculation: boolean;
  folderLabel: string | null;
  itemLabel: string | null;
}): string | null {
  if (col.isCalculation) return col.itemLabel !== null ? `Calculation - ${col.itemLabel}` : null;
  if (col.folderLabel === null || col.itemLabel === null) return null;
  return `EUL Item - ${col.folderLabel}.${col.itemLabel}`;
}

export interface SheetDiff {
  dumpSheetNumber: number;
  worksheetIndex: number | null;
  name: FieldTally;
  itemsMatched: number;
  itemsOnlyInDump: string[];
  itemsOnlyInParser: string[];
  /**
   * `Items :-` against the worksheet's **query** items rather than its
   * displayed columns.
   *
   * The dump lists what the sheet's queries name, which is a superset of the
   * layout's columns: an item a calculation needs but nothing displays is in
   * the list with no column of its own. Comparing against `columns` — as
   * `itemsMatched` above still does, kept so the two numbers can be read side
   * by side — is what made 3.4 % of the corpus's items look dump-only.
   */
  queryItemsMatched: number;
  queryItemsOnlyInDump: string[];
  queryItemsOnlyInParser: string[];
  /** `Query(s) used` — the `QRn` numbers the sheet runs, in order. */
  queries: FieldTally;
  /** `Filters :-`. */
  filters: FieldTally;
  /** `Joins :-`. */
  joins: FieldTally;

  // --- the derived layout model (§7.8), as the migration will write it -----
  //
  // `diffQueryRequests` already compares each `0x0122` element's raw vectors
  // against its `Query Request QRn` block. These four compare what the
  // *worksheet* resolves those vectors to: the axis each item ends up on, its
  // position on that axis, which items no column displays, and whether the
  // sheet is a `SELECT DISTINCT`. That is the shape `map_items.axis_type` /
  // `.axis_order` / `.is_hidden` and `maps.select_distinct` are written from,
  // so a disagreement here is a migration defect, not only a decoding one.

  /**
   * `Axis Item Usage` for the sheet's queries, in the dump's own order,
   * against the items the worksheet puts on an axis ordered by `axisOrder`.
   *
   * The parser side is built from each column's own `EDCBAxisType` (`0x02be`)
   * — falling back to the query list only where the column carries none —
   * which is what makes this a test of `0x02be` rather than a restatement of
   * the vector it was resolved against. A page item counts as an axis item,
   * as it does to the query request (§7.8.8).
   */
  axisItems: FieldTally;
  /** `Measure Item Usage`, the same way — measures are numbered separately. */
  measureItems: FieldTally;
  /**
   * The sheet's `Items :-` that no displayed column accounts for, against
   * `ParsedWorksheet.hiddenItems`. Compared as a sorted set: the items have
   * no display order, which is the point of them.
   */
  hiddenItems: FieldTally;
  /** `Distinct` on the sheet's query requests, against `selectDistinct`. */
  distinct: FieldTally;
  /**
   * The `Sort On …` entries inside the sheet's `Items :-` list, in the dump's
   * own order, against the worksheet's sorts in the order the migration
   * numbers them.
   *
   * This is the sheet-level printing of the sort list, separate from the
   * `Query Request QRn` block `diffQueryRequests` compares — so it is an
   * independent check on the one thing `map_items.sort_order` claims: which
   * item is sorted, and in what precedence. Direction is not in this list;
   * `diffSorts` compares that from `EUL Sort Item Reference`.
   */
  sortItems: FieldTally;
}

/** Tally one value pair into a fresh `FieldTally`. */
function tallyOne(dumpValue: string | null, parserValue: string | null): FieldTally {
  const tally = emptyTally();
  const d = normalize(dumpValue);
  const p = normalize(parserValue);
  if (d === null && p === null) return tally;
  if (d === null) tally.onlyInParser += 1;
  else if (p === null) tally.onlyInDump += 1;
  else if (d === p) tally.agree += 1;
  else tally.disagree += 1;
  return tally;
}

/**
 * The dump's ordered usage names of one kind, across the query requests a
 * sheet runs. `Sort On ` prefixes are stripped the way `diffQueryRequests`
 * strips them, so a sort usage compares as the item it names.
 */
function sheetUsage(
  queries: ReadonlyArray<Extract<DumpEntry, { type: 'QueryRequest' }>>,
  kind: DumpItemUsage['kind'],
): string | null {
  return normalize(
    queries
      .flatMap((query) => query.usages.filter((usage) => usage.kind === kind))
      .map((usage) => usage.name.replace(/^\s*Sort On\s*/, ''))
      .join(' | '),
  );
}

/**
 * The worksheet's items on one axis, in `axisOrder`, rendered as the dump's
 * own display names.
 *
 * A column's own `EDCBAxisType` decides which axis it is on, so this compares
 * that field against the dump rather than restating the query vector the
 * position came from; a column carrying none falls back to the list that
 * names it, which is what the migration writes. PAGE counts as AXIS — a page
 * item is an axis item to the query request (§7.8.8).
 */
function worksheetAxis(
  worksheet: ParsedWorkbookDocument['worksheets'][number],
  kind: 'AXIS' | 'MEASURE',
): string | null {
  const entries: Array<{ order: number; name: string }> = [];
  for (const column of worksheet.columns) {
    if (column.axisOrder === null) continue;
    const axis = column.axisType ?? column.queryAxisKind;
    if ((axis === 'MEASURE' ? 'MEASURE' : 'AXIS') !== kind) continue;
    const name = normalize(columnDisplayName(column));
    if (name !== null) entries.push({ order: column.axisOrder, name });
  }
  for (const hidden of worksheet.hiddenItems) {
    if (hidden.axisKind !== kind) continue;
    const name = normalize(columnDisplayName(hidden));
    if (name !== null) entries.push({ order: hidden.axisOrder, name });
  }
  if (entries.length === 0) return null;
  return entries.sort((a, b) => a.order - b.order).map((entry) => entry.name).join(' | ');
}

/**
 * The worksheet's sorts as `map_items.sort_order` numbers them: the item each
 * one names, in `ParsedWorksheet.sorts` order.
 *
 * Rendered as the dump's display names so it compares directly against the
 * sheet's `Sort On …` lines. A sort whose item cannot be named renders `?`
 * rather than being dropped, so a decode failure shows up as a disagreement
 * instead of a shorter list that happens to line up.
 */
function worksheetSortItems(
  worksheet: ParsedWorkbookDocument['worksheets'][number],
  byId: Map<number, RawElement>,
): string | null {
  if (worksheet.sorts.length === 0) return null;
  return worksheet.sorts
    .map((sort) =>
      sort.itemElementRef === null
        ? '?'
        : (elementDisplayName(byId.get(sort.itemElementRef), byId) ?? '?'),
    )
    .join(' | ');
}

function diffSheets(
  dump: ParsedDump,
  doc: ParsedWorkbookDocument,
  byId: Map<number, RawElement>,
): { sheets: SheetDiff[]; unmatchedDumpSheets: number[]; unmatchedWorksheets: number[] } {
  const dumpSheets = dump.entries.filter((e): e is Extract<DumpEntry, { type: 'Sheet' }> => e.type === 'Sheet');
  const queryByNumber = new Map(
    dump.entries
      .filter((e): e is Extract<DumpEntry, { type: 'QueryRequest' }> => e.type === 'QueryRequest')
      .map((query) => [query.number, query]),
  );
  const sheets: SheetDiff[] = [];
  const matchedWorksheetIndexes = new Set<number>();
  const unmatchedDumpSheets: number[] = [];

  for (const dumpSheet of dumpSheets) {
    const worksheet = doc.worksheets[dumpSheet.number - 1];
    if (!worksheet) {
      unmatchedDumpSheets.push(dumpSheet.number);
      continue;
    }
    matchedWorksheetIndexes.add(worksheet.index);

    const nameTally = emptyTally();
    const d = dumpSheet.name?.trim() || null;
    const p = worksheet.name?.trim() || null;
    if (d === null && p === null) {
      /* both absent, nothing to tally */
    } else if (d === null) nameTally.onlyInParser += 1;
    else if (p === null) nameTally.onlyInDump += 1;
    else if (d === p) nameTally.agree += 1;
    else nameTally.disagree += 1;

    const parserNames = new Set(
      worksheet.columns.map(columnDisplayName).filter((n): n is string => n !== null),
    );
    const dumpNames = new Set(dumpSheet.items);
    let itemsMatched = 0;
    const itemsOnlyInDump: string[] = [];
    for (const n of dumpNames) {
      if (parserNames.has(n)) itemsMatched += 1;
      else itemsOnlyInDump.push(n);
    }
    const itemsOnlyInParser = [...parserNames].filter((n) => !dumpNames.has(n));

    // The `QRn` blocks this sheet runs, in the order `Query(s) used` names
    // them — the dump's own axis and measure usage lists for the sheet.
    const dumpQueries = dumpSheet.queriesUsed
      .map((number) => queryByNumber.get(number))
      .filter((query): query is Extract<DumpEntry, { type: 'QueryRequest' }> => query !== undefined);

    const queryNames = new Set(
      worksheet.queryItemRefs
        .map((id) => normalize(elementDisplayName(byId.get(id), byId)))
        .filter((n): n is string => n !== null),
    );
    const dumpQueryNames = new Set(
      dumpSheet.items.map((n) => normalize(n)).filter((n): n is string => n !== null),
    );
    let queryItemsMatched = 0;
    const queryItemsOnlyInDump: string[] = [];
    for (const n of dumpQueryNames) {
      if (queryNames.has(n)) queryItemsMatched += 1;
      else queryItemsOnlyInDump.push(n);
    }

    sheets.push({
      dumpSheetNumber: dumpSheet.number,
      worksheetIndex: worksheet.index,
      name: nameTally,
      itemsMatched,
      itemsOnlyInDump: capped(itemsOnlyInDump),
      itemsOnlyInParser: capped(itemsOnlyInParser),
      queryItemsMatched,
      queryItemsOnlyInDump: capped(queryItemsOnlyInDump),
      queryItemsOnlyInParser: capped([...queryNames].filter((n) => !dumpQueryNames.has(n))),
      queries: tallyOne(
        dumpSheet.queriesUsed.join(','),
        worksheet.queries.map((q) => q.number).join(','),
      ),
      filters: tallyOne(
        [...new Set(dumpSheet.filters.map((f) => normalize(f)))].sort().join(' | '),
        [
          ...new Set(
            worksheet.queries
              .flatMap((q) => q.filterRefs)
              .map((id) => normalize(elementDisplayName(byId.get(id), byId))),
          ),
        ]
          .sort()
          .join(' | '),
      ),
      joins: tallyOne(
        [...new Set(dumpSheet.joins.map((j) => normalize(j)))].sort().join(' | '),
        [...new Set(worksheet.joins.map((j) => (j.name === null ? null : `EUL Join - ${j.name}`)))]
          .sort()
          .join(' | '),
      ),
      axisItems: tallyOne(sheetUsage(dumpQueries, 'Axis'), worksheetAxis(worksheet, 'AXIS')),
      measureItems: tallyOne(
        sheetUsage(dumpQueries, 'Measure'),
        worksheetAxis(worksheet, 'MEASURE'),
      ),
      hiddenItems: tallyOne(
        // What the dump lists for the sheet that no displayed column covers.
        // Set difference, not list subtraction: `Items :-` is a set already.
        [...dumpQueryNames].filter((n) => !parserNames.has(n)).sort().join(' | ') || null,
        [
          ...new Set(
            worksheet.hiddenItems
              .map((hidden) => normalize(columnDisplayName(hidden)))
              .filter((n): n is string => n !== null),
          ),
        ]
          .sort()
          .join(' | ') || null,
      ),
      distinct: tallyOne(
        flagText(
          (() => {
            const values = [
              ...new Set(
                dumpQueries.map((query) => query.distinct).filter((v): v is boolean => v !== null),
              ),
            ];
            return values.length === 1 ? values[0]! : null;
          })(),
        ),
        flagText(worksheet.selectDistinct),
      ),
      sortItems: tallyOne(
        normalize(dumpSheet.sortOns.join(' | ')),
        worksheetSortItems(worksheet, byId),
      ),
    });
  }

  const unmatchedWorksheets = doc.worksheets
    .map((w) => w.index)
    .filter((idx) => !matchedWorksheetIndexes.has(idx));

  return { sheets, unmatchedDumpSheets, unmatchedWorksheets };
}

// ---------------------------------------------------------------------------
// Fields the dump carries that the parser produces nowhere today
// ---------------------------------------------------------------------------

/**
 * Hand-maintained, not derived — this is the "exhaustive list of fields
 * present in the dump that [the parser] does not yet produce" the plan asks
 * for (task W1 step 5), kept next to the diff logic above that established
 * it rather than in a separate doc that could drift.
 *
 * Grouped by the dump section that carries the field. A field absent from
 * this list either already has a `fields` tally above, or was not observed in
 * any dump examined while building this tool — the latter is itself worth
 * knowing, so `parseD4wkdmpDump`'s `Unknown` entries and `otherLists`
 * surface unfamiliar sections instead of silently dropping them.
 */
export const FIELDS_NOT_YET_PRODUCED: Readonly<Record<string, readonly string[]>> = {
  // W2 closed the rest: `EUL Private Item`'s DataType/Placement/Hidden/IsACalc,
  // `Case Sensitive`, `EUL Sort Item Reference`, the whole `Query Request`
  // block, `EUL Join Reference` and the sheet's `Query(s) used` / `Filters :-`
  // / `Joins :-` lists all have a tally above now. W7 closed the sheet's
  // `Sort On` lines, which `SheetDiff.sortItems` compares against the order
  // `map_items.sort_order` is written in.
  Parameter: ['Drill Segment Id'],
};

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

export interface DumpDiffReport {
  items: SectionReport;
  functions: SectionReport;
  calculations: SectionReport & { matchedVia: { rawId: number; name: number } };
  privateFilters: SectionReport & { matchedVia: { sql: number; name: number } };
  parameters: SectionReport;
  /** `EUL Sort Item Reference` — direction and the item sorted on. */
  sorts: SectionReport;
  /** `Query Request QRn` — `Distinct` and every usage list. */
  queryRequests: SectionReport;
  /** `EUL Join Reference`. */
  joins: SectionReport;
  sheets: ReturnType<typeof diffSheets>;
  /**
   * How many element bodies framed as a complete record sequence, and how many
   * fell back to the resynchronizing scan. Every field of the worksheet model
   * needs framing, so this is the ceiling on what the sections above can even
   * be compared on.
   */
  framing: { framed: number; unframed: number };
  parseWarnings: string[];
}

export function diffWorkbookDump(
  dump: ParsedDump,
  doc: ParsedWorkbookDocument,
  rawBytes: Buffer,
): DumpDiffReport {
  const elements = readWorkbookElements(rawBytes);
  const byId = new Map(elements.map((el) => [el.id, el]));

  return {
    items: diffItemReferences(dump, byId),
    functions: diffFunctionReferences(dump, byId),
    calculations: diffCalculations(dump, doc, byId),
    privateFilters: diffPrivateFilters(dump, doc),
    parameters: diffParameters(dump, doc),
    sorts: diffSorts(dump, byId),
    queryRequests: diffQueryRequests(dump, byId),
    joins: diffJoins(dump, doc),
    sheets: diffSheets(dump, doc, byId),
    framing: {
      framed: elements.reduce((n, el) => n + (el.framed ? 1 : 0), 0),
      unframed: elements.reduce((n, el) => n + (el.framed ? 0 : 1), 0),
    },
    parseWarnings: dump.warnings,
  };
}

/** Fold one report into a running aggregate — the CLI's job across 500+ workbooks. */
export function mergeFieldTallies(
  into: Record<string, FieldTally>,
  from: Record<string, FieldTally>,
): void {
  for (const [field, tally] of Object.entries(from)) {
    const t = (into[field] ??= emptyTally());
    t.agree += tally.agree;
    t.disagree += tally.disagree;
    t.onlyInDump += tally.onlyInDump;
    t.onlyInParser += tally.onlyInParser;
  }
}
