import { parseD4wkdmpDump } from '../services/d4wkdmp-dump-parser.js';

/**
 * A synthetic dump, grammatically faithful to real `d4wkdmp.exe -f` output
 * (see the parser's module doc) but built from placeholder data — the real
 * files live in the git-ignored `E:\claude\discoverer\d4dumps\` because they
 * are customer report metadata, so tests never read from there.
 *
 * Indentation is exactly what the real tool emits: one leading space for a
 * top-level header, two leading tabs for its fields, no leading whitespace
 * for `Sheet Number N`, one leading tab for a sheet's own fields, one tab
 * plus one space for a sheet's list headers, two tabs for list members.
 */
const FIXTURE = [
  ' EUL Item Reference',
  '\t\tIoId = 16',
  '\t\tId = 100812',
  '\t\tIdentifier = WIDGET_CODE',
  '\t\tName = Widget Code',
  '\t\tFolder Identifier = F_WIDGETS',
  '\t\tFolder Name = F Widgets',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Item Reference',
  '\t\tIoId = 24',
  '\t\tId = 100813',
  '\t\tIdentifier = WIDGET_PRICE',
  '\t\tName = Widget Price',
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
  '\t\tIOFormula = [1,1]([6,24])',
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
  '\t\tIOFormula = [1,86]([6,24],[8,1])',
  '\t\tDisplayFormula = Widget Price >= :Min Price',
  ' EUL Filter Reference',
  '\t\tId = 200100',
  '\t\tIdentifier = SHARED_WIDGET_FILTER',
  '\t\tName = Shared Widget Filter',
  '\t\tFolder Identifier = F_WIDGETS',
  '\t\tFolder Name = F Widgets',
  '\t\t*** Owning Folder not found in the EUL ***',
  ' EUL Join Reference ',
  '\t\tId = 300100',
  '\t\tIdentifier = F_WIDGETS_-_F_GADGETS',
  '\t\tName = F Widgets -> F Gadgets',
  '\t\tOwning Folder Identifier = F_GADGETS',
  '\t\tOwning Folder Name = F Gadgets',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Function Reference',
  '\t\tIoId = 40',
  '\t\tId = 400100',
  '\t\tIdentifier = GET_WIDGET_STATUS',
  '\t\tFunction Name = GET_WIDGET_STATUS',
  '\t\tDisplay Name = GET_WIDGET_STATUS',
  '\t\t*** Found in EUL by id *** ',
  ' EUL Sort Item Reference',
  '\t\tItem = \t\tEUL Item - F Widgets.Widget Code',
  '\t\tDirection = 1',
  ' Query Request QR1',
  '\t\tDistinct = 1',
  '\t\tAxis Item Usage -   Name = \t\tEUL Item - F Widgets.Widget Code',
  '\t\tMeasure Item Usage -  Name = \t\tCalculation - PRICE TOTAL',
  '\t\tSort Item Usage -  Name = \t\tSort On \t\tEUL Item - F Widgets.Widget Code',
  '\t\tFilter Usage -  Name = \t\tPrivate Filter - Widget Price >= :Min Price',
  '\t\tJoin Usage -  Name = \t\tEUL Join - F Widgets -> F Gadgets',
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
  '\t\tSort On \t\tEUL Item - F Widgets.Widget Code',
  '\t Filters :-',
  '\t\tPrivate Filter - Widget Price >= :Min Price',
  '\t Joins :-',
  '\t\tEUL Join - F Widgets -> F Gadgets',
  '',
  '///////////////////////////////////////////////////////////////////////////////',
  ' Some Future Element',
  '\t\tFoo = Bar',
  '\t\tBaz = Qux',
  'Sheet Number 2',
  '///////////////////////////////////////////////////////////////////////////////',
  '\tSheet Name = Widgets Crosstab',
  '\tSheet Unique Name = {00000000-0000-0000-0000-000000000002}',
  '\tQuery(s) used = ',
  '\tQuery 1',
  '\t Items :-',
  '\t\tEUL Item - F Widgets.Widget Code',
  '\t\tCalculation - PRICE TOTAL',
  '\t Totals :-',
  '\t\tGrand Total',
  '',
  '///////////////////////////////////////////////////////////////////////////////',
].join('\n');

describe('parseD4wkdmpDump', () => {
  const parsed = parseD4wkdmpDump(FIXTURE);

  it('produces no warnings for a well-formed dump', () => {
    expect(parsed.warnings).toEqual([]);
  });

  it('parses EUL Item Reference entries with IoId and the found note', () => {
    const items = parsed.entries.filter((e) => e.type === 'EulItemReference');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      ioId: 16,
      id: 100812,
      identifier: 'WIDGET_CODE',
      name: 'Widget Code',
      folderIdentifier: 'F_WIDGETS',
      folderName: 'F Widgets',
      foundNote: '*** Found in EUL by id ***',
    });
  });

  it('parses a calculation (EUL Private Item) including its negative synthetic id', () => {
    const calc = parsed.entries.find((e) => e.type === 'EulPrivateItem');
    expect(calc).toMatchObject({
      id: -900,
      name: 'PRICE TOTAL',
      identifier: '5',
      dataType: 2,
      placement: 1,
      hidden: false,
      isACalc: true,
      ioFormula: '[1,1]([6,24])',
      displayFormula: 'SUM(Widget Price)',
    });
  });

  it('parses a workbook-private filter', () => {
    const filter = parsed.entries.find((e) => e.type === 'EulPrivateFilter');
    expect(filter).toMatchObject({
      id: -800,
      identifier: '2',
      name: 'Widget Price >= :Min Price',
      caseSensitive: false,
      ioFormula: '[1,86]([6,24],[8,1])',
    });
  });

  it('parses a shared EUL Filter Reference, distinct from a private filter', () => {
    const shared = parsed.entries.find((e) => e.type === 'EulFilterReference');
    expect(shared).toMatchObject({
      id: 200100,
      identifier: 'SHARED_WIDGET_FILTER',
      name: 'Shared Widget Filter',
      foundNote: '*** Owning Folder not found in the EUL ***',
    });
  });

  it('parses a join reference', () => {
    const join = parsed.entries.find((e) => e.type === 'EulJoinReference');
    expect(join).toMatchObject({
      id: 300100,
      identifier: 'F_WIDGETS_-_F_GADGETS',
      owningFolderIdentifier: 'F_GADGETS',
    });
  });

  it('parses a custom function reference, which carries an IoId like an item', () => {
    const fn = parsed.entries.find((e) => e.type === 'EulFunctionReference');
    expect(fn).toMatchObject({ ioId: 40, id: 400100, functionName: 'GET_WIDGET_STATUS' });
  });

  it('parses a sort item reference with an embedded-tab value', () => {
    const sort = parsed.entries.find((e) => e.type === 'EulSortItemReference');
    expect(sort).toMatchObject({ item: 'EUL Item - F Widgets.Widget Code', direction: 1 });
  });

  it('parses a parameter', () => {
    const param = parsed.entries.find((e) => e.type === 'Parameter');
    expect(param).toMatchObject({ name: 'Min Price', identifier: '1', prompt: 'Enter the minimum price' });
  });

  it('parses a Query Request with every usage kind', () => {
    const qr = parsed.entries.find((e) => e.type === 'QueryRequest');
    expect(qr).toMatchObject({ number: 1, distinct: true });
    if (qr?.type !== 'QueryRequest') throw new Error('expected a QueryRequest');
    expect(qr.usages).toEqual([
      { kind: 'Axis', name: 'EUL Item - F Widgets.Widget Code' },
      { kind: 'Measure', name: 'Calculation - PRICE TOTAL' },
      { kind: 'Sort', name: 'Sort On \t\tEUL Item - F Widgets.Widget Code' },
      { kind: 'Filter', name: 'Private Filter - Widget Price >= :Min Price' },
      { kind: 'Join', name: 'EUL Join - F Widgets -> F Gadgets' },
    ]);
  });

  it('parses sheet 1: fields, items split from sort-ons, filters, and joins', () => {
    const sheets = parsed.entries.filter((e) => e.type === 'Sheet');
    expect(sheets).toHaveLength(2);
    const sheet1 = sheets[0]!;
    if (sheet1.type !== 'Sheet') throw new Error('expected a Sheet');
    expect(sheet1.name).toBe('Widgets');
    expect(sheet1.uniqueName).toBe('{00000000-0000-0000-0000-000000000001}');
    expect(sheet1.queriesUsed).toEqual([1]);
    expect(sheet1.items).toEqual(['EUL Item - F Widgets.Widget Code', 'Calculation - PRICE TOTAL']);
    expect(sheet1.sortOns).toEqual(['EUL Item - F Widgets.Widget Code']);
    expect(sheet1.filters).toEqual(['Private Filter - Widget Price >= :Min Price']);
    expect(sheet1.joins).toEqual(['EUL Join - F Widgets -> F Gadgets']);
  });

  it('does not let a Sheet block swallow an entry that follows it', () => {
    const unknown = parsed.entries.find((e) => e.type === 'Unknown');
    expect(unknown).toMatchObject({
      header: 'Some Future Element',
      fields: [
        { key: 'Foo', value: 'Bar' },
        { key: 'Baz', value: 'Qux' },
      ],
    });
  });

  it('collects an unrecognized sheet list under otherLists rather than dropping it', () => {
    const sheets = parsed.entries.filter((e) => e.type === 'Sheet');
    const sheet2 = sheets[1]!;
    if (sheet2.type !== 'Sheet') throw new Error('expected a Sheet');
    expect(sheet2.name).toBe('Widgets Crosstab');
    expect(sheet2.joins).toEqual([]);
    expect(sheet2.otherLists).toEqual({ Totals: ['Grand Total'] });
  });

  it('preserves entry order, interleaving entries and sheets as printed', () => {
    const order = parsed.entries.map((e) =>
      e.type === 'Sheet' ? `Sheet ${e.number}` : e.type === 'Unknown' ? `Unknown:${e.header}` : e.type,
    );
    expect(order).toEqual([
      'EulItemReference',
      'EulItemReference',
      'EulPrivateItem',
      'Parameter',
      'EulPrivateFilter',
      'EulFilterReference',
      'EulJoinReference',
      'EulFunctionReference',
      'EulSortItemReference',
      'QueryRequest',
      'Sheet 1',
      'Unknown:Some Future Element',
      'Sheet 2',
    ]);
  });
});
