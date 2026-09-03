import { parseD4wkdmpDump } from '../services/d4wkdmp-dump-parser.js';
import { diffWorkbookDump } from '../services/d4wkdmp-differ.js';
import { parseWorkbookDocument } from '../services/workbook-parser.js';
import {
  WorkbookFixtureBuilder,
  FIXTURE_CLASS,
  FIXTURE_TAG,
  FIXTURE_NUMBER,
  FIXTURE_TYPE,
} from '../testing/workbook-fixture.js';

/**
 * Builds a workbook whose element ids are known in advance (the low-level
 * `WorkbookFixtureBuilder`, not the higher-level `FixtureWorkbook` helper —
 * this differ correlates on exact element ids, so the test needs to name
 * them) and a hand-written dump text that is grammatically faithful to real
 * `d4wkdmp.exe -f` output but describes placeholder data, matching the
 * `d4wkdmp-dump-parser.test.ts` fixture's approach for the same reason: the
 * real dumps are customer report metadata and never committed.
 *
 * Element sequence (ids assigned in call order):
 *   1  ITEM_REF        Widget Code   (F_WIDGETS / F Widgets)
 *   2  ITEM_REF        Widget Price  (F_WIDGETS / F Widgets)
 *   3  CALCULATION     PRICE TOTAL   = [1,1]([6,2])
 *   4  PARAMETER       Min Price
 *   5  CONDITION       Widget Price >= :Min Price
 *   6  FUNCTION        GET_WIDGET_STATUS
 *   7  COLUMN          shows item #1
 *   8  COLUMN          shows calc #3
 *   9  SORT            on item #2, descending
 *   10 JOIN_REF        F Widgets -> F Prices
 *   11 QUERY_REQUEST   distinct; axis #1, measure #3, sort #9, filter #5, join #10
 *   12 QUERY_LINK      -> #11
 *   13 SHEET_LAYOUT    columns #7 #8; query link #12; filter #5
 *   14 VIEW_TABLE      the sheet is a table, not a crosstab
 *   15 WORKSHEET       "Widgets" — closes worksheet 1's section
 *   16 ITEM_REF        Unmatched Item — no dump counterpart, on purpose
 */
function buildFixtureBytes(): Buffer {
  const b = new WorkbookFixtureBuilder();

  b.element(FIXTURE_CLASS.ITEM_REF) // #1
    .string(FIXTURE_TAG.ITEM_NAME, 'WIDGET_CODE')
    .string(FIXTURE_TAG.ITEM_LABEL, 'Widget Code')
    .string(FIXTURE_TAG.FOLDER_NAME, 'F_WIDGETS')
    .string(FIXTURE_TAG.FOLDER_LABEL, 'F Widgets');

  b.element(FIXTURE_CLASS.ITEM_REF) // #2
    .string(FIXTURE_TAG.ITEM_NAME, 'WIDGET_PRICE')
    // Deliberately different from the dump's "Widget Price" below, to
    // exercise the disagree path.
    .string(FIXTURE_TAG.ITEM_LABEL, 'Widget Price (renamed)')
    .string(FIXTURE_TAG.FOLDER_NAME, 'F_WIDGETS')
    .string(FIXTURE_TAG.FOLDER_LABEL, 'F Widgets');

  b.element(FIXTURE_CLASS.CALCULATION) // #3
    .string(FIXTURE_TAG.ITEM_LABEL, 'PRICE TOTAL')
    .string(FIXTURE_TAG.CALC_FORMULA, '[1,1]([6,2])')
    .string(FIXTURE_TAG.CALC_IDENTIFIER, '5')
    .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.CALC_DATA_TYPE, 2)
    .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.CALC_PLACEMENT, 1)
    .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.CALC_HIDDEN, 0)
    .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.CALC_IS_A_CALC, 1)
    // A calculation's negative synthetic id — what the dump's "EUL Private
    // Item" prints as `Id`, and the differ's primary correlation key.
    .int32(FIXTURE_NUMBER.ITEM_SOURCE_ID.type, FIXTURE_NUMBER.ITEM_SOURCE_ID.tag, -900);

  b.element(FIXTURE_CLASS.PARAMETER) // #4
    .string(FIXTURE_TAG.PARAMETER_NAME, 'Min Price')
    .string(FIXTURE_TAG.PARAMETER_IDENTIFIER, '1')
    .string(FIXTURE_TAG.PARAMETER_PROMPT, 'Enter the minimum price');

  b.element(FIXTURE_CLASS.CONDITION) // #5
    .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.FILTER_SOURCE_ID, -800)
    .string(FIXTURE_TAG.CONDITION_IDENTIFIER, '2')
    .string(FIXTURE_TAG.CONDITION_SQL, 'Widget Price >= :Min Price')
    .string(FIXTURE_TAG.CONDITION_TOKENS, '[1,86]([6,2],[8,4])')
    .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.CONDITION_CASE_SENSITIVE, 0);

  b.element(FIXTURE_CLASS.FUNCTION) // #6
    .string(FIXTURE_TAG.FUNCTION_NAME, 'GET_WIDGET_STATUS');

  b.element(FIXTURE_CLASS.COLUMN) // #7 — shows item #1
    .int32(FIXTURE_NUMBER.COLUMN_ITEM_REF.type, FIXTURE_NUMBER.COLUMN_ITEM_REF.tag, 1)
    .string(FIXTURE_TAG.COLUMN_HEADING, 'Widget Code');

  b.element(FIXTURE_CLASS.COLUMN) // #8 — shows calculation #3
    .int32(FIXTURE_NUMBER.COLUMN_ITEM_REF.type, FIXTURE_NUMBER.COLUMN_ITEM_REF.tag, 3)
    .string(FIXTURE_TAG.COLUMN_HEADING, 'Price Total');

  b.element(FIXTURE_CLASS.SORT) // #9 — on item #2, descending
    .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.SORT_ITEM_REF, 2)
    .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.SORT_DIRECTION, 2);

  b.element(FIXTURE_CLASS.JOIN_REF) // #10
    .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.JOIN_SOURCE_ID, 500100)
    .string(FIXTURE_TAG.JOIN_NAME, 'F Widgets -> F Prices')
    .string(FIXTURE_TAG.JOIN_IDENTIFIER, 'F_WIDGETS_-_F_PRICES')
    .string(FIXTURE_TAG.JOIN_FOLDER_LABEL, 'F Prices')
    .string(FIXTURE_TAG.JOIN_FOLDER_NAME, 'F_PRICES');

  b.element(FIXTURE_CLASS.QUERY_REQUEST) // #11
    .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.QUERY_DISTINCT, 1)
    .refVector(FIXTURE_TAG.QUERY_AXIS_ITEMS, [1])
    .refVector(FIXTURE_TAG.QUERY_MEASURE_ITEMS, [3])
    .refVector(FIXTURE_TAG.QUERY_SORTS, [9])
    .refVector(FIXTURE_TAG.QUERY_FILTERS, [5])
    .refVector(FIXTURE_TAG.QUERY_JOINS, [10]);

  b.element(FIXTURE_CLASS.QUERY_LINK) // #12
    .ref(FIXTURE_TAG.QUERY_LINK_REF, 11);

  b.element(FIXTURE_CLASS.SHEET_LAYOUT) // #13
    .refVector(FIXTURE_TAG.LAYOUT_COLUMNS, [7, 8])
    .refVector(FIXTURE_TAG.LAYOUT_FILTERS, [5])
    .vector(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.LAYOUT_QUERY_LINKS, [12]);

  b.element(FIXTURE_CLASS.VIEW_TABLE); // #14

  b.element(FIXTURE_CLASS.WORKSHEET) // #15
    .string(FIXTURE_TAG.WORKSHEET_NAME, 'Widgets')
    .string(FIXTURE_TAG.WORKSHEET_GUID, '{00000000-0000-0000-0000-000000000001}')
    .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_LAYOUT_REF, 13)
    .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_VIEW_REF, 14);

  b.element(FIXTURE_CLASS.ITEM_REF) // #16 — parser-only, no dump entry
    .string(FIXTURE_TAG.ITEM_NAME, 'UNMATCHED_ITEM')
    .string(FIXTURE_TAG.ITEM_LABEL, 'Unmatched Item')
    .string(FIXTURE_TAG.FOLDER_NAME, 'F_WIDGETS')
    .string(FIXTURE_TAG.FOLDER_LABEL, 'F Widgets');

  return b.build();
}

const DUMP_TEXT = [
  ' EUL Item Reference',
  '\t\tIoId = 1',
  '\t\tId = 100812',
  '\t\tIdentifier = WIDGET_CODE',
  '\t\tName = Widget Code',
  '\t\tFolder Identifier = F_WIDGETS',
  '\t\tFolder Name = F Widgets',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Item Reference',
  '\t\tIoId = 2',
  '\t\tId = 100813',
  '\t\tIdentifier = WIDGET_PRICE',
  '\t\tName = Widget Price',
  '\t\tFolder Identifier = F_WIDGETS',
  '\t\tFolder Name = F Widgets',
  '\t\t*** Found in EUL by id *** ',
  // No dump counterpart for element #10 exists — proves unmatchedParser.
  ' EUL Item Reference',
  '\t\tIoId = 99',
  '\t\tId = 100999',
  '\t\tIdentifier = GHOST_ITEM',
  '\t\tName = Ghost Item',
  '\t\tFolder Identifier = F_WIDGETS',
  '\t\tFolder Name = F Widgets',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Private Item',
  '\t\tId = -900',
  '\t\tName = PRICE TOTAL',
  '\t\tIdentifier = 5',
  '\t\tDesc = ',
  '\t\tDataType = 2',
  '\t\tPlacement = 1',
  '\t\tHidden = 0',
  '\t\tIsACalc = 1',
  '\t\tIOFormula = [1,1]([6,2])',
  '\t\tDisplayFormula = SUM(Widget Price)',
  ' Parameter',
  '\t\tName = Min Price',
  '\t\tIdentifier = 1',
  '\t\tPrompt = Enter the minimum price',
  ' EUL Private Filter ',
  '\t\tId = -800',
  '\t\tIdentifier = 2',
  '\t\tName = Widget Price >= :Min Price',
  '\t\tDesc = ',
  '\t\tCase Sensitive = 0',
  '\t\tIOFormula = [1,86]([6,2],[8,4])',
  '\t\tDisplayFormula = Widget Price >= :Min Price',
  ' EUL Function Reference',
  '\t\tIoId = 6',
  '\t\tId = 400100',
  '\t\tIdentifier = GET_WIDGET_STATUS',
  '\t\tFunction Name = GET_WIDGET_STATUS',
  '\t\tDisplay Name = GET_WIDGET_STATUS',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Join Reference ',
  '\t\tId = 500100',
  '\t\tIdentifier = F_WIDGETS_-_F_PRICES',
  '\t\tName = F Widgets -> F Prices',
  '\t\tOwning Folder Identifier = F_PRICES',
  '\t\tOwning Folder Name = F Prices',
  ' EUL Sort Item Reference',
  '\t\tItem = \t\tEUL Item - F Widgets.Widget Price (renamed)',
  '\t\tDirection = 2',
  ' Query Request QR1',
  '\t\tDistinct = 1',
  '\t\tAxis Item Usage -   Name = \t\tEUL Item - F Widgets.Widget Code',
  '\t\tMeasure Item Usage -  Name = \t\tCalculation - PRICE TOTAL',
  '\t\tSort Item Usage -  Name = \t\tSort On \t\tEUL Item - F Widgets.Widget Price (renamed)',
  '\t\tFilter Usage -  Name = \t\tPrivate Filter - Widget Price >= :Min Price',
  '\t\tJoin Usage -  Name = \t\tEUL Join - F Widgets -> F Prices',
  '',
  '///////////////////////////////////////////////////////////////////////////////',
  'Sheet Number 1',
  '///////////////////////////////////////////////////////////////////////////////',
  '\tSheet Name = Widgets',
  '\tSheet Unique Name = {00000000-0000-0000-0000-000000000001}',
  '\tQuery(s) used = ',
  '\tQuery 1',
  '\t Items :-',
  '\t\tEUL Item - F Widgets.Widget Code',
  '\t\tCalculation - PRICE TOTAL',
  // A real dump prints the sheet's sorts inside `Items :-`, after the items.
  '\t\tSort On \t\tEUL Item - F Widgets.Widget Price (renamed)',
  '\t Filters :-',
  '\t\tPrivate Filter - Widget Price >= :Min Price',
  '\t Joins :-',
  '\t\tEUL Join - F Widgets -> F Prices',
  '',
  '///////////////////////////////////////////////////////////////////////////////',
].join('\n');

describe('diffWorkbookDump', () => {
  const rawBytes = buildFixtureBytes();
  const dump = parseD4wkdmpDump(DUMP_TEXT);
  const doc = parseWorkbookDocument(rawBytes);
  const report = diffWorkbookDump(dump, doc, rawBytes);

  it('correlates items by IoId and agrees on the identifier field', () => {
    expect(report.items.dumpCount).toBe(3); // includes the ghost (IoId 99)
    expect(report.items.matched).toBe(2); // IoId 1 and 2 resolve; 99 does not
    expect(report.items.fields.identifier).toEqual({ agree: 2, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('reports a disagreement on the field that was deliberately mismatched', () => {
    expect(report.items.fields.name).toEqual({ agree: 1, disagree: 1, onlyInDump: 0, onlyInParser: 0 });
    expect(report.items.examples).toContainEqual({
      key: 'IoId=2',
      field: 'name',
      dumpValue: 'Widget Price',
      parserValue: 'Widget Price (renamed)',
    });
  });

  it('reports the unresolvable dump IoId and the dump-less parser element', () => {
    expect(report.items.unmatchedDump).toEqual(['IoId=99 GHOST_ITEM']);
    expect(report.items.unmatchedParser).toEqual(['element#16 Unmatched Item']);
  });

  it('correlates the custom function by IoId', () => {
    expect(report.functions.matched).toBe(1);
    expect(report.functions.fields.functionName).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('correlates a calculation by its raw negative synthetic id and agrees on its formula', () => {
    expect(report.calculations.matched).toBe(1);
    expect(report.calculations.matchedVia).toEqual({ rawId: 1, name: 0 });
    expect(report.calculations.fields.ioFormula).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('compares the calculation fields W2 decoded, rather than counting them as dump-only', () => {
    for (const field of ['dataType', 'placement', 'hidden', 'isACalc', 'identifier'] as const) {
      expect(report.calculations.fields[field]).toEqual({
        agree: 1,
        disagree: 0,
        onlyInDump: 0,
        onlyInParser: 0,
      });
    }
  });

  it('correlates a private filter by its synthetic id and agrees on formula, identifier and case sensitivity', () => {
    expect(report.privateFilters.matched).toBe(1);
    // `sql` is the slot the synthetic-id match reports through; see `matchedVia`.
    expect(report.privateFilters.matchedVia).toEqual({ sql: 1, name: 0 });
    for (const field of ['ioFormula', 'identifier', 'caseSensitive'] as const) {
      expect(report.privateFilters.fields[field]).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    }
  });

  it('correlates the sort by position and agrees on its item and direction', () => {
    expect(report.sorts.matched).toBe(1);
    expect(report.sorts.fields.item).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    expect(report.sorts.fields.direction).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('correlates the query request by position and agrees on every usage list', () => {
    expect(report.queryRequests.matched).toBe(1);
    for (const field of ['distinct', 'axisItems', 'measureItems', 'sorts', 'filters', 'joins'] as const) {
      expect(report.queryRequests.fields[field]).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    }
  });

  it('correlates the join by its EUL id', () => {
    expect(report.joins.matched).toBe(1);
    for (const field of ['identifier', 'name', 'owningFolderIdentifier', 'owningFolderName'] as const) {
      expect(report.joins.fields[field]).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    }
  });

  it('reports that every element body framed', () => {
    expect(report.framing).toEqual({ framed: 16, unframed: 0 });
  });

  it('correlates a parameter by name and agrees on its prompt', () => {
    expect(report.parameters.matched).toBe(1);
    expect(report.parameters.fields.prompt).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('correlates sheet 1 by position and matches both of its displayed items', () => {
    expect(report.sheets.sheets).toHaveLength(1);
    const sheet = report.sheets.sheets[0]!;
    expect(sheet).toMatchObject({ dumpSheetNumber: 1, worksheetIndex: 0, itemsMatched: 2 });
    expect(sheet.name).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    expect(sheet.itemsOnlyInDump).toEqual([]);
    expect(sheet.itemsOnlyInParser).toEqual([]);
    expect(report.sheets.unmatchedDumpSheets).toEqual([]);
    expect(report.sheets.unmatchedWorksheets).toEqual([]);
  });

  it('compares the sheet Items list against the query items, and its query, filter and join lists', () => {
    const sheet = report.sheets.sheets[0]!;
    expect(sheet.queryItemsMatched).toBe(2);
    expect(sheet.queryItemsOnlyInDump).toEqual([]);
    expect(sheet.queryItemsOnlyInParser).toEqual([]);
    expect(sheet.queries).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    expect(sheet.filters).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    expect(sheet.joins).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  // The sheet's own printing of the sort list, which is what
  // `map_items.sort_order` numbers — an independent check on the
  // `Query Request` block's `Sort Item Usage` compared above.
  it("compares the sheet's Sort On lines against the order sorting migrates in", () => {
    const sheet = report.sheets.sheets[0]!;
    expect(sheet.sortItems).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  // The layout model as the migration writes it, not the raw vectors the
  // query-request section already covers: which axis the worksheet puts each
  // item on, in what order, which items it draws nowhere, and DISTINCT.
  it('confirms the axis and measure usage lists against what the worksheet resolves', () => {
    const sheet = report.sheets.sheets[0]!;
    expect(sheet.axisItems).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    expect(sheet.measureItems).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('confirms Distinct against the sheet-level selectDistinct', () => {
    expect(report.sheets.sheets[0]!.distinct).toEqual({
      agree: 1,
      disagree: 0,
      onlyInDump: 0,
      onlyInParser: 0,
    });
  });

  it('reports no hidden items when every item the query names has a column', () => {
    expect(report.sheets.sheets[0]!.hiddenItems).toEqual({
      agree: 0,
      disagree: 0,
      onlyInDump: 0,
      onlyInParser: 0,
    });
  });
});

/**
 * A workbook whose query names an item no column draws.
 *
 * `Items :-` lists it, `Axis Item Usage` lists it second, and the layout's
 * column list does not — the shape that becomes a `map_items` row with
 * `is_hidden`. A separate fixture rather than an addition to the one above,
 * because that dump text names elements by id and adding one would renumber
 * them all.
 *
 * Element sequence:
 *   1 ITEM_REF       Widget Code   — displayed
 *   2 ITEM_REF       Widget Cost   — in the query, drawn by nothing
 *   3 COLUMN         shows #1, axis type 0
 *   4 QUERY_REQUEST  not distinct; axis #1 then #2
 *   5 QUERY_LINK     -> #4
 *   6 SHEET_LAYOUT   columns #3; query link #5
 *   7 VIEW_TABLE
 *   8 WORKSHEET      "Costs"
 */
describe('diffWorkbookDump — an item the query names but no column draws', () => {
  const rawBytes = (() => {
    const b = new WorkbookFixtureBuilder();
    b.element(FIXTURE_CLASS.ITEM_REF) // #1
      .string(FIXTURE_TAG.ITEM_NAME, 'WIDGET_CODE')
      .string(FIXTURE_TAG.ITEM_LABEL, 'Widget Code')
      .string(FIXTURE_TAG.FOLDER_NAME, 'F_WIDGETS')
      .string(FIXTURE_TAG.FOLDER_LABEL, 'F Widgets');
    b.element(FIXTURE_CLASS.ITEM_REF) // #2
      .string(FIXTURE_TAG.ITEM_NAME, 'WIDGET_COST')
      .string(FIXTURE_TAG.ITEM_LABEL, 'Widget Cost')
      .string(FIXTURE_TAG.FOLDER_NAME, 'F_WIDGETS')
      .string(FIXTURE_TAG.FOLDER_LABEL, 'F Widgets');
    b.element(FIXTURE_CLASS.COLUMN) // #3
      .int32(FIXTURE_NUMBER.COLUMN_ITEM_REF.type, FIXTURE_NUMBER.COLUMN_ITEM_REF.tag, 1)
      .number(FIXTURE_TYPE.INT32, FIXTURE_TAG.COLUMN_AXIS_TYPE, 0);
    b.element(FIXTURE_CLASS.QUERY_REQUEST) // #4
      .number(FIXTURE_TYPE.UINT8_ALT, FIXTURE_TAG.QUERY_DISTINCT, 0)
      .refVector(FIXTURE_TAG.QUERY_AXIS_ITEMS, [1, 2])
      .refVector(FIXTURE_TAG.QUERY_MEASURE_ITEMS, []);
    b.element(FIXTURE_CLASS.QUERY_LINK).ref(FIXTURE_TAG.QUERY_LINK_REF, 4); // #5
    b.element(FIXTURE_CLASS.SHEET_LAYOUT) // #6
      .refVector(FIXTURE_TAG.LAYOUT_COLUMNS, [3])
      .vector(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.LAYOUT_QUERY_LINKS, [5]);
    b.element(FIXTURE_CLASS.VIEW_TABLE); // #7
    b.element(FIXTURE_CLASS.WORKSHEET) // #8
      .string(FIXTURE_TAG.WORKSHEET_NAME, 'Costs')
      .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_LAYOUT_REF, 6)
      .number(FIXTURE_TYPE.INT32_ALT, FIXTURE_TAG.WORKSHEET_VIEW_REF, 7);
    return b.build();
  })();

  const dumpText = [
    ' EUL Item Reference',
    '\t\tIoId = 1',
    '\t\tId = 100812',
    '\t\tIdentifier = WIDGET_CODE',
    '\t\tName = Widget Code',
    '\t\tFolder Identifier = F_WIDGETS',
    '\t\tFolder Name = F Widgets',
    ' EUL Item Reference',
    '\t\tIoId = 2',
    '\t\tId = 100814',
    '\t\tIdentifier = WIDGET_COST',
    '\t\tName = Widget Cost',
    '\t\tFolder Identifier = F_WIDGETS',
    '\t\tFolder Name = F Widgets',
    ' Query Request QR1',
    '\t\tDistinct = 0',
    '\t\tAxis Item Usage -   Name = \t\tEUL Item - F Widgets.Widget Code',
    '\t\tAxis Item Usage -   Name = \t\tEUL Item - F Widgets.Widget Cost',
    '',
    'Sheet Number 1',
    '\tSheet Name = Costs',
    '\tQuery(s) used = ',
    '\tQuery 1',
    '\t Items :-',
    '\t\tEUL Item - F Widgets.Widget Code',
    '\t\tEUL Item - F Widgets.Widget Cost',
    '',
  ].join('\n');

  const report = diffWorkbookDump(parseD4wkdmpDump(dumpText), parseWorkbookDocument(rawBytes), rawBytes);
  const sheet = report.sheets.sheets[0]!;

  it('agrees on the ordered axis list, columns and hidden item together', () => {
    expect(sheet.axisItems).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    // Nothing is a measure, on either side.
    expect(sheet.measureItems).toEqual({ agree: 0, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });

  it('agrees on which item the sheet lists but never draws', () => {
    expect(sheet.hiddenItems).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
    // The same item is the whole of the gap between `Items :-` and the columns.
    expect(sheet.itemsMatched).toBe(1);
    expect(sheet.itemsOnlyInDump).toEqual(['EUL Item - F Widgets.Widget Cost']);
    expect(sheet.queryItemsMatched).toBe(2);
    expect(sheet.queryItemsOnlyInDump).toEqual([]);
  });

  it('agrees that the sheet is not a SELECT DISTINCT', () => {
    expect(sheet.distinct).toEqual({ agree: 1, disagree: 0, onlyInDump: 0, onlyInParser: 0 });
  });
});
