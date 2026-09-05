/**
 * Tests for the Discoverer workbook (`.DIS`) container parser.
 *
 * Fixtures are built with `buildWorkbookFixture`, the encoder for the same
 * byte layout the parser decodes — see `testing/workbook-fixture.ts`. Every
 * fixture also contains records the parser does not decode, so the resync path
 * that real workbooks depend on is exercised by default rather than by one
 * special-case test.
 */

import { describe, it, expect } from '@jest/globals';

import {
  CONDITION_OPERATOR_TABLE,
  CONDITION_OPERATORS,
  countWorkbookColumns,
  EUL_FUNCTION_NAMES,
  parseConditionTokens,
  parseConditionTree,
  parseWorkbookDocument,
  planCondition,
  readWorkbookElements,
} from '../services/workbook-parser.js';
import {
  buildWorkbookFixture,
  FIXTURE_CLASS,
  FIXTURE_NUMBER,
  FIXTURE_TAG,
  FIXTURE_TYPE,
  WorkbookFixtureBuilder,
} from '../testing/workbook-fixture.js';

describe('readWorkbookElements', () => {
  it('reads elements in file order with sequential ids', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.EUL_IDENTITY)
      .string(FIXTURE_TAG.EUL_OWNER, 'SIID_TESTES')
      .element(FIXTURE_CLASS.WORKBOOK)
      .string(FIXTURE_TAG.WORKBOOK_NAME, 'GD_M.M172_V01')
      .build();

    expect(readWorkbookElements(data)).toEqual([
      expect.objectContaining({ id: 1, cls: FIXTURE_CLASS.EUL_IDENTITY }),
      expect.objectContaining({ id: 2, cls: FIXTURE_CLASS.WORKBOOK }),
    ]);
  });

  it('skips records it cannot type instead of derailing', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.WORKBOOK)
      .opaque(0x07d2, 32)
      .string(FIXTURE_TAG.WORKBOOK_NAME, 'WB')
      .opaque(0x07d3, 17)
      .element(FIXTURE_CLASS.WORKSHEET)
      .string(FIXTURE_TAG.WORKSHEET_NAME, 'Folha 1')
      .build();

    const elements = readWorkbookElements(data);
    expect(elements).toHaveLength(2);
    expect(elements[0]?.strings).toContainEqual({
      tag: FIXTURE_TAG.WORKBOOK_NAME,
      value: 'WB',
    });
    expect(elements[1]?.strings).toContainEqual({
      tag: FIXTURE_TAG.WORKSHEET_NAME,
      value: 'Folha 1',
    });
  });

  it('decodes accented latin-1 text the way a WE8ISO8859P1 EUL wrote it', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.COLUMN)
      .string(FIXTURE_TAG.COLUMN_HEADING, 'Nº de Operações')
      .build();
    expect(readWorkbookElements(data)[0]?.strings[0]?.value).toBe('Nº de Operações');
  });

  it('ignores a BEGIN whose element id breaks the sequence', () => {
    // Real workbooks contain payload bytes that look like a BEGIN marker. The
    // strict id sequence is what rejects them, so a forged out-of-sequence
    // marker must not open an element.
    const forged = Buffer.from([
      0x00, 0x01, 0x00, 0x00, 0x00, 0xdb, 0x00, 0x00, 0x99, 0x00, 0x00, 0x00,
    ]);
    const data = Buffer.concat([
      new WorkbookFixtureBuilder().element(FIXTURE_CLASS.WORKBOOK).build(),
      forged,
    ]);
    expect(readWorkbookElements(data).map((e) => e.id)).toEqual([1]);
  });
});

describe('parseConditionTokens', () => {
  it('pulls the operator, item, parameter and literals out of a token tree', () => {
    expect(parseConditionTokens('[1,92]([6,28],[8,65],[8,29])')).toMatchObject({
      operator: 'BETWEEN',
      combiner: null,
      itemRefs: [28],
      parameterRefs: [65, 29],
      literals: [],
      parseError: null,
    });
    expect(parseConditionTokens('[1,88]([6,85],[5,2,"15"],[5,2,"16"])')).toMatchObject({
      operator: 'IN',
      itemRefs: [85],
      literals: ['15', '16'],
    });
  });

  it('reports a compound condition as a combiner, not an operator', () => {
    const info = parseConditionTokens('[1,98]([1,92]([6,26],[8,58],[8,59]),[1,81]([6,48],[5,1,"V"]))');
    expect(info.combiner).toBe('AND');
    // The branches' operators belong to the branches; the condition as a whole
    // has none, and claiming one would migrate the wrong filter.
    expect(info.operator).toBeNull();
    expect(info.itemRefs).toEqual([26, 48]);
  });

  it('leaves an unknown operator code null rather than guessing', () => {
    expect(parseConditionTokens('[1,200]([6,1])').operator).toBeNull();
    expect(parseConditionTokens(null).operator).toBeNull();
    expect(parseConditionTokens('').itemRefs).toEqual([]);
  });

  it('maps every documented operator code', () => {
    expect(CONDITION_OPERATORS[81]).toBe('=');
    expect(CONDITION_OPERATORS[92]).toBe('BETWEEN');
    expect(CONDITION_OPERATORS[90]).toBe('IS NOT NULL');
  });
});

describe('parseConditionTree', () => {
  it('reads a nested tree, not a flat scan', () => {
    const { tree, error } = parseConditionTree(
      '[1,98]([1,92]([6,26],[8,58],[8,59]),[1,81]([6,48],[5,1,"V"]))',
    );
    expect(error).toBeNull();
    expect(tree).toEqual({
      type: 'call',
      code: 98,
      name: 'AND',
      args: [
        {
          type: 'call',
          code: 92,
          name: 'BETWEEN',
          args: [
            { type: 'item', elementId: 26 },
            { type: 'parameter', elementId: 58 },
            { type: 'parameter', elementId: 59 },
          ],
        },
        {
          type: 'call',
          code: 81,
          name: '=',
          args: [
            { type: 'item', elementId: 48 },
            { type: 'literal', literalKind: 1, value: 'V' },
          ],
        },
      ],
    });
  });

  it('keeps a comma inside a quoted literal out of the argument list', () => {
    const { tree } = parseConditionTree('[1,81]([6,1],[5,1,"A,B"])');
    expect(tree).toMatchObject({
      args: [{ type: 'item' }, { type: 'literal', value: 'A,B' }],
    });
    const escaped = parseConditionTree(`[1,81]([6,1],[5,1,"say \\"hi\\""])`);
    expect(escaped.tree).toMatchObject({ args: [{}, { value: 'say "hi"' }] });
  });

  it('reads a zero-argument code and a custom function reference', () => {
    // [1,48] is SYSDATE, [1,115] NULL — both written with an empty list.
    expect(parseConditionTree('[1,48]()').tree).toEqual({
      type: 'call',
      code: 48,
      name: 'SYSDATE',
      args: [],
    });
    expect(parseConditionTree('[2,20]([6,3])').tree).toMatchObject({
      type: 'function',
      elementId: 20,
    });
  });

  it('fails rather than half-reading a malformed tree', () => {
    for (const bad of ['[1,81]([6,1]', '[1,81]([6,1],)', 'garbage', '[1,81]([6,1]) trailing']) {
      const { tree, error } = parseConditionTree(bad);
      expect(tree).toBeNull();
      expect(error).not.toBeNull();
    }
  });

  it('names built-in codes from Oracle own function table', () => {
    // Recovered from DCESQRES.DLL and confirmed against the live EUL4.
    expect(EUL_FUNCTION_NAMES[49]).toBe('TRUNC');
    expect(EUL_FUNCTION_NAMES[68]).toBe('NVL');
    expect(EUL_FUNCTION_NAMES[101]).toBe('NOT');
    expect(CONDITION_OPERATOR_TABLE[101]).toMatchObject({ kind: 'logical', neo: null });
  });
});

describe('planCondition', () => {
  const plan = (tokens: string): ReturnType<typeof planCondition> =>
    planCondition(parseConditionTree(tokens).tree);

  it('makes a single test one group of one predicate', () => {
    const result = plan('[1,81]([6,4],[5,1,"V"])');
    expect(result.unsupported).toBeNull();
    expect(result.depth).toBe(0);
    expect(result.groups).toEqual([
      {
        join: 'AND',
        inner: 'AND',
        predicates: [
          {
            operator: '=',
            operatorCode: 81,
            neoOperator: '=',
            itemRef: 4,
            parameterRef: null,
            literals: ['V'],
          },
        ],
      },
    ]);
  });

  it('flattens a conjunction into one group per test', () => {
    const result = plan('[1,98]([1,86]([6,30],[8,51]),[1,85]([6,30],[8,52]))');
    expect(result.unsupported).toBeNull();
    expect(result.depth).toBe(1);
    expect(result.groups.map((g) => [g.join, g.inner, g.predicates.length])).toEqual([
      ['AND', 'AND', 1],
      ['AND', 'AND', 1],
    ]);
  });

  it('carries OR onto the second group so the SQL brackets it', () => {
    const result = plan('[1,99]([1,85]([6,18],[8,20]),[1,85]([6,19],[8,20]))');
    expect(result.groups.map((g) => g.join)).toEqual(['AND', 'OR']);
  });

  it('expresses an OR of ANDs as one group per conjunction', () => {
    // The shape the two deepest conditions in the source EUL have.
    const result = plan(
      '[1,99]([1,98]([1,81]([6,66],[5,2,"0"]),[1,81]([6,48],[5,1,"M"])),' +
        '[1,98]([1,83]([6,66],[5,2,"0"]),[1,81]([6,48],[5,1,"M"])))',
    );
    expect(result.unsupported).toBeNull();
    expect(result.depth).toBe(2);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({ join: 'AND', inner: 'AND' });
    expect(result.groups[1]).toMatchObject({ join: 'OR', inner: 'AND' });
    expect(result.groups.map((g) => g.predicates.length)).toEqual([2, 2]);
  });

  it('refuses a tree deeper than the group model reaches', () => {
    const result = plan(
      '[1,98]([1,99]([1,98]([1,81]([6,1],[5,2,"1"]),[1,81]([6,2],[5,2,"2"])),' +
        '[1,81]([6,3],[5,2,"3"])),[1,81]([6,4],[5,2,"4"]))',
    );
    expect(result.depth).toBe(3);
    expect(result.groups).toEqual([]);
    expect(result.unsupported).toContain('3 levels deep');
  });

  describe('BETWEEN over separate bounds', () => {
    it('expands into >= and <=, keeping both of Discoverer own prompts', () => {
      // `x BETWEEN :a AND :b` is defined as `x >= :a AND x <= :b`, so two rows
      // are the same filter. A Neo condition binds one parameter, so keeping
      // it as a single BETWEEN would mean discarding one of the two prompts.
      const result = plan('[1,92]([6,26],[8,58],[8,59])');
      expect(result.unsupported).toBeNull();
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]).toMatchObject({ inner: 'AND' });
      expect(result.groups[0]?.predicates).toMatchObject([
        { neoOperator: '>=', itemRef: 26, parameterRef: 58 },
        { neoOperator: '<=', itemRef: 26, parameterRef: 59 },
      ]);
    });

    it('expands a bound that mixes a literal with a parameter', () => {
      expect(plan('[1,92]([6,4],[8,7],[5,2,"9"])').groups[0]?.predicates).toMatchObject([
        { neoOperator: '>=', parameterRef: 7 },
        { neoOperator: '<=', literals: ['9'] },
      ]);
    });

    it('expands a literal bound containing a comma instead of refusing it', () => {
      // Neo splits a BETWEEN value on the comma, so `1,5` could not be stored
      // as half of `low,high` — but it is fine as a `>=` value of its own.
      expect(plan('[1,92]([6,4],[5,1,"1,5"],[5,1,"9"])').groups[0]?.predicates).toMatchObject([
        { neoOperator: '>=', literals: ['1,5'] },
        { neoOperator: '<=', literals: ['9'] },
      ]);
    });

    it('brackets the expansion when it sits under an OR', () => {
      const result = plan('[1,99]([1,92]([6,1],[8,2],[8,3]),[1,92]([6,4],[8,5],[8,6]))');
      expect(result.unsupported).toBeNull();
      expect(result.groups).toMatchObject([
        { join: 'AND', inner: 'AND' },
        { join: 'OR', inner: 'AND' },
      ]);
      expect(result.groups.map((g) => g.predicates.length)).toEqual([2, 2]);
    });

    it('refuses the expansion inside an OR nested in an AND', () => {
      // `p AND (q OR x BETWEEN :a AND :b)` would need the expansion bracketed
      // inside the OR, and there is no level left. Rendering it flat would
      // give `q OR x >= :a OR x <= :b`, which matches every row.
      const result = plan(
        '[1,98]([1,81]([6,1],[5,2,"1"]),[1,99]([1,81]([6,2],[5,2,"2"]),[1,92]([6,3],[8,4],[8,5])))',
      );
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain('one more level of brackets');
    });
  });

  describe('negation', () => {
    it('refuses a NOT node rather than migrating what it negates', () => {
      const result = plan('[1,101]([1,81]([6,4],[5,1,"V"]))');
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain('negated');
    });

    it('refuses a NOT anywhere inside a conjunction, and says it is a negation', () => {
      const result = plan(
        '[1,98]([1,81]([6,4],[5,1,"V"]),[1,101]([1,81]([6,5],[5,1,"X"])))',
      );
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain('NOT is a negated test');
    });

    it.each([
      [91, 'NOT IN', '[1,91]([6,4],[5,1,"M"],[5,1,"A"])'],
      [90, 'IS NOT NULL', '[1,90]([6,4])'],
      [93, 'NOT BETWEEN', '[1,93]([6,4],[5,2,"1"],[5,2,"9"])'],
      [100, 'NOT LIKE', '[1,100]([6,4],[5,1,"A%"])'],
    ])('refuses %i (%s), never its positive form', (_code, name, tokens) => {
      const result = plan(tokens);
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain(name);
      expect(result.unsupported).toContain('negated');
    });

    it('drops the whole condition, not just the negated half', () => {
      // `a = 1 AND b NOT IN (…)` migrated as `a = 1` would return more rows
      // than Discoverer did, and look like a clean migration.
      const result = plan('[1,98]([1,81]([6,4],[5,2,"1"]),[1,91]([6,5],[5,1,"M"]))');
      expect(result.groups).toEqual([]);
    });
  });

  describe('tests Neo cannot express', () => {
    it('refuses a function on the left rather than filtering the bare item', () => {
      const result = plan('[1,92]([1,49]([6,16]),[8,17],[8,18])');
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain('TRUNC(item #16)');
      expect(result.unsupported).toContain('not to a plain item');
    });

    it('accepts a BETWEEN over one parameter used for both bounds', () => {
      const result = plan('[1,92]([6,26],[8,58],[8,58])');
      expect(result.unsupported).toBeNull();
      expect(result.groups[0]?.predicates).toMatchObject([
        { neoOperator: 'BETWEEN', parameterRef: 58 },
      ]);
    });

    it('accepts a BETWEEN over two literal bounds as one row', () => {
      expect(plan('[1,92]([6,4],[5,2,"1"],[5,2,"9"])').groups[0]?.predicates).toMatchObject([
        { neoOperator: 'BETWEEN', literals: ['1', '9'] },
      ]);
    });

    it('refuses an expression on the right rather than harvesting its literals', () => {
      // TO_DATE(:p,'DD-MON-RRRR')+0.99999 — the old scan stored the format
      // mask and the 0.99999 as the condition's value.
      const result = plan('[1,85]([6,16],[1,94]([1,58]([8,76],[5,1,"DD-MON-RRRR"]),[5,2,"0.99999"]))');
      expect(result.groups).toEqual([]);
      expect(result.unsupported).toContain('an expression rather than a value');
    });

    it('refuses an IN value whose comma Neo would read as a separator', () => {
      expect(plan('[1,88]([6,4],[5,1,"A,B"],[5,1,"C"])').unsupported).toContain('comma');
    });

    it('accepts IN over literals and IN over a single parameter', () => {
      expect(plan('[1,88]([6,4],[5,2,"15"],[5,2,"16"])').groups[0]?.predicates[0]).toMatchObject({
        neoOperator: 'IN',
        literals: ['15', '16'],
      });
      expect(plan('[1,88]([6,4],[8,9])').groups[0]?.predicates[0]).toMatchObject({
        neoOperator: 'IN',
        parameterRef: 9,
      });
    });

    it('refuses an operator that is a value function, not a test', () => {
      expect(plan('[1,68]([6,4],[5,1,"X"])').unsupported).toContain('NVL is a value expression');
    });
  });
});

describe('parseWorkbookDocument', () => {
  it('reads the workbook header', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({ name: 'GD_M.M27_V07', eulOwner: 'SIID_TESTES', eulName: 'GADOR' }),
    );
    expect(doc).toMatchObject({
      format: 'DIS',
      name: 'GD_M.M27_V07',
      eulOwner: 'SIID_TESTES',
      eulName: 'GADOR',
      discovererVersion: '4.1',
      nls: 'PORTUGUESE_PORTUGAL.WE8ISO8859P1',
    });
  });

  it('assigns each column group to the worksheet whose section it is in', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [
          {
            name: 'M27',
            title: 'M27-PROCESSOS DE SINISTRO',
            guid: '{458971B1-48F9-4B42-BB11-8A962B226793}',
            columns: [
              { folderLabel: 'M M27', itemLabel: 'Tomador', heading: 'TOMADOR' },
              { folderLabel: 'M M27', itemLabel: 'Apolice' },
            ],
          },
          {
            name: 'M27 - Detalhe de Pagamentos',
            columns: [{ folderLabel: 'M M27 1', itemLabel: 'Pagamento' }],
          },
        ],
      }),
    );

    expect(doc.worksheets.map((w) => w.name)).toEqual([
      'M27',
      'M27 - Detalhe de Pagamentos',
    ]);
    expect(doc.worksheets[0]?.title).toBe('M27-PROCESSOS DE SINISTRO');
    expect(doc.worksheets[0]?.columns.map((c) => c.itemLabel)).toEqual(['Tomador', 'Apolice']);
    expect(doc.worksheets[1]?.columns.map((c) => c.folderLabel)).toEqual(['M M27 1']);
    expect(countWorkbookColumns(doc)).toBe(3);
  });

  // The reason the parser reads integers at all: a real workbook writes an
  // item element only the first time an item is displayed. Every later column
  // carries just the reference, and without following it 46 % of the columns
  // in the source EUL come out with no item.
  it('follows a column reference to a shared item element', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [
          {
            folderName: 'M_M27',
            folderLabel: 'M M27',
            itemName: 'DATA_ABERTURA',
            itemLabel: 'Data Abertura',
            sourceId: 109075,
          },
        ],
        worksheets: [
          {
            name: 'S',
            columns: [
              { item: 'Data Abertura', heading: 'DATA ABERTURA' },
              { item: 'Data Abertura', heading: 'ABERTURA (2)' },
            ],
          },
        ],
      }),
    );

    expect(doc.worksheets[0]?.columns).toEqual([
      expect.objectContaining({
        itemSourceId: 109075,
        folderLabel: 'M M27',
        itemLabel: 'Data Abertura',
        heading: 'DATA ABERTURA',
      }),
      expect.objectContaining({
        itemSourceId: 109075,
        itemLabel: 'Data Abertura',
        heading: 'ABERTURA (2)',
      }),
    ]);
  });

  it("reads a column's own item element and its EUL id", () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [
          {
            name: 'S',
            columns: [{ itemLabel: 'Nipc Er', folderLabel: 'M M27', sourceId: 109075 }],
          },
        ],
      }),
    );
    expect(doc.worksheets[0]?.columns[0]).toMatchObject({
      itemSourceId: 109075,
      itemLabel: 'Nipc Er',
    });
  });

  it('treats a calculation negative id as no EUL id at all', () => {
    // A workbook calculation has no EXPRESSIONS row, and stores a negative id.
    // Read unsigned it would come out near 2^32 and look like a real one.
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [{ itemLabel: 'Total', sourceId: -62 }],
        worksheets: [{ name: 'S', columns: [{ item: 'Total' }] }],
      }),
    );
    expect(doc.worksheets[0]?.columns[0]?.itemSourceId).toBeNull();
  });

  it('collects a calculation a column only referenced', () => {
    // A totals-only worksheet writes no calculation elements of its own; its
    // columns point back at ones defined for an earlier worksheet.
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        calculations: [{ name: 'TOT SOL COM', formula: '[2,20]()' }],
        worksheets: [
          { name: 'Detail', columns: [{ itemLabel: 'Valor' }] },
          // Element 3 is the calculation declared above.
          { name: 'Totals', columns: [] },
        ],
      }),
    );
    expect(doc.worksheets[0]?.calculations.map((c) => c.name)).toEqual(['TOT SOL COM']);
  });

  it('leaves itemSourceId null when the workbook records no EUL id', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [{ name: 'S', columns: [{ itemLabel: 'Tomador', folderLabel: 'M M27' }] }],
      }),
    );
    // The labels are still there — they are the fallback resolution path.
    expect(doc.worksheets[0]?.columns[0]).toMatchObject({
      itemSourceId: null,
      itemLabel: 'Tomador',
      folderLabel: 'M M27',
    });
  });

  it('takes the data format mask, not the heading mask that follows it', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [
          { name: 'S', columns: [{ itemLabel: 'Dt Emissao', formatMask: 'DD-MON-RRRR' }] },
        ],
      }),
    );
    expect(doc.worksheets[0]?.columns[0]?.formatMask).toBe('DD-MON-RRRR');
  });

  it('marks a column over a workbook calculation and leaves its folder null', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [
          {
            name: 'S',
            columns: [
              { itemLabel: 'GESTOR PROCESSO', calculation: true },
              { folderLabel: 'M M27', itemLabel: 'Tomador' },
            ],
          },
        ],
      }),
    );
    expect(doc.worksheets[0]?.columns[0]).toMatchObject({
      isCalculation: true,
      folderLabel: null,
      itemLabel: 'GESTOR PROCESSO',
    });
    expect(doc.worksheets[0]?.columns[1]?.isCalculation).toBe(false);
  });

  it('resolves a condition to the item and parameter it references', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [{ folderLabel: 'M M27', itemLabel: 'Dt Provisao' }],
        parameters: [{ name: 'Dt Início', prompt: 'Indique data início' }],
        conditions: [
          {
            sql: 'Dt Provisao >= :Dt Início',
            operatorCode: 86,
            item: 'Dt Provisao',
            parameter: 'Dt Início',
          },
        ],
        worksheets: [{ name: 'S', columns: [{ itemLabel: 'Dt Provisao' }] }],
      }),
    );

    expect(doc.conditions).toHaveLength(1);
    expect(doc.conditions[0]).toMatchObject({
      sql: 'Dt Provisao >= :Dt Início',
      unsupported: null,
    });
    expect(doc.conditions[0]?.groups).toHaveLength(1);
    expect(doc.conditions[0]?.groups[0]?.predicates[0]).toMatchObject({
      operator: '>=',
      neoOperator: '>=',
      itemLabel: 'Dt Provisao',
      folderLabel: 'M M27',
      parameterName: 'Dt Início',
      value: null,
    });
    expect(doc.conditions[0]?.parsed.operator).toBe('>=');
  });

  it('resolves every predicate of a compound condition, encoded as real bytes', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [
          { folderLabel: 'M M27', itemLabel: 'Estado' },
          { folderLabel: 'M M27', itemLabel: 'Ramo' },
        ],
        parameters: [{ name: 'Ramo' }],
        conditions: [
          {
            sql: "Estado = 'V' AND Ramo LIKE :Ramo",
            operatorCode: 98,
            args: [
              { operatorCode: 81, item: 'Estado', literals: ['V'] },
              { operatorCode: 87, item: 'Ramo', parameter: 'Ramo' },
            ],
          },
        ],
        worksheets: [{ name: 'S', columns: [{ item: 'Estado' }] }],
      }),
    );

    expect(doc.conditions[0]?.unsupported).toBeNull();
    expect(doc.conditions[0]?.groups).toHaveLength(2);
    expect(doc.conditions[0]?.groups.flatMap((g) => g.predicates)).toMatchObject([
      { neoOperator: '=', itemLabel: 'Estado', folderLabel: 'M M27', value: 'V' },
      { neoOperator: 'LIKE', itemLabel: 'Ramo', parameterName: 'Ramo', value: null },
    ]);
  });

  it('reports a condition that names an element the workbook does not define', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [{ itemLabel: 'Estado' }],
        // Element 9999 exists in no workbook this small.
        conditions: [{ sql: 'dangling', tokens: '[1,81]([6,9999],[5,1,"V"])' }],
        worksheets: [{ name: 'S', columns: [{ item: 'Estado' }] }],
      }),
    );
    expect(doc.conditions[0]?.groups).toEqual([]);
    expect(doc.conditions[0]?.unsupported).toContain('which the workbook does not define');
  });

  it('collects parameters, calculations, totals and custom functions', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        functionNames: ['GET_ATRIBUTOS_SINISTRO'],
        items: [{ itemLabel: 'Valor' }],
        parameters: [
          { name: 'Dt Fim', prompt: 'Indique data fim', defaultValue: '01-JAN-2024' },
        ],
        calculations: [{ name: 'Total Líquido', formula: '[2,20]([6,3],[8,4])' }],
        worksheets: [{ name: 'S', columns: [{ itemLabel: 'Valor' }], totals: ['Total &Value'] }],
      }),
    );

    expect(doc.functionNames).toEqual(['GET_ATRIBUTOS_SINISTRO']);
    expect(doc.parameters).toEqual([
      expect.objectContaining({ name: 'Dt Fim', prompt: 'Indique data fim', defaultValue: '01-JAN-2024' }),
    ]);
    expect(doc.calculations[0]?.name).toBe('Total Líquido');
    expect(doc.worksheets[0]?.totals.map((total) => total.label)).toEqual(['Total &Value']);
  });

  it('resolves element references inside a calculation formula to names', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        items: [{ itemLabel: 'Valor' }],
        parameters: [{ name: 'Taxa' }],
        // Element 3 is the shared item, element 4 the parameter.
        calculations: [{ name: 'Líquido', formula: '[2,20]([6,3],[8,4])' }],
        worksheets: [{ name: 'S' }],
      }),
    );
    // Function codes stay as written — Oracle's code table is not available,
    // so naming them would present a guess as fact.
    expect(doc.calculations[0]?.readableFormula).toBe('[2,20](Valor,:Taxa)');
  });

  it('scopes calculations to the worksheet that offers them, deduped by name', () => {
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        worksheets: [
          {
            name: 'One',
            // The same calculation is written into every column group that
            // offers it; the worksheet must list it once.
            columns: [
              { itemLabel: 'GESTOR', calculation: true },
              { itemLabel: 'GESTOR', calculation: true },
            ],
          },
          { name: 'Two', columns: [{ itemLabel: 'Outra', calculation: true }] },
        ],
        calculations: [{ name: 'GESTOR', formula: '[2,20]()' }],
      }),
    );

    // A calculation with no formula is only a reference to one defined
    // elsewhere, so the column groups alone contribute nothing here.
    expect(doc.worksheets[0]?.calculations.map((c) => c.name)).toEqual(['GESTOR']);
    expect(doc.worksheets[1]?.calculations).toEqual([]);
    expect(doc.calculations.map((c) => c.name)).toEqual(['GESTOR']);
  });

  it('keeps every same-named calculation instead of dropping later redefinitions', () => {
    // Discoverer allows the same calculation name to be redefined against a
    // genuinely different formula — real workbooks do this once per
    // month/period column, each with a different embedded literal date (see
    // EUL_SCHEMA_GROUND_TRUTH.md §7.7). Deduping by name used to keep only
    // the first occurrence and silently drop every later formula; the fix
    // dedupes by element id and disambiguates the display name instead.
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        calculations: [
          { name: 'RESSEGURO CEDIDO TOTAL1', formula: '[1,58]([5,1,"31-JAN-2005"])' },
          { name: 'RESSEGURO CEDIDO TOTAL1', formula: '[1,58]([5,1,"04-ABR-2008"])' },
        ],
        worksheets: [{ name: 'S' }],
      }),
    );

    expect(doc.worksheets[0]?.calculations).toHaveLength(2);
    const [first, second] = doc.worksheets[0]!.calculations;
    expect(first).toMatchObject({
      name: 'RESSEGURO CEDIDO TOTAL1',
      tokens: '[1,58]([5,1,"31-JAN-2005"])',
    });
    expect(second?.name).toMatch(/^RESSEGURO CEDIDO TOTAL1 #\d+$/);
    expect(second?.tokens).toBe('[1,58]([5,1,"04-ABR-2008"])');
    expect(second?.elementId).not.toBe(first?.elementId);
    // The document-level union keeps both too, deduped by element id.
    expect(doc.calculations).toHaveLength(2);
  });

  it('resolves a cross-calculation reference to the specific, disambiguated calculation', () => {
    // [6,n] in a formula usually names a plain item, but n can be another
    // calculation — and when that calculation's name collides with a
    // worksheet sibling's, the reference must resolve to the one it actually
    // names, not an arbitrary same-named calculation.
    const doc = parseWorkbookDocument(
      buildWorkbookFixture({
        // EUL identity (1) and the workbook header (2) take the first two
        // element ids, so these three calculations land on 3, 4 and 5.
        calculations: [
          { name: 'GESTOR', formula: '[2,20]()' },
          { name: 'GESTOR', formula: '[2,21]()' },
          // References element 4 — the SECOND "GESTOR", not the first.
          { name: 'Total Geral', formula: '[2,22]([6,4])' },
        ],
        worksheets: [{ name: 'S' }],
      }),
    );

    const [firstGestor, secondGestor, totalGeral] = doc.worksheets[0]!.calculations;
    expect(firstGestor?.name).toBe('GESTOR');
    expect(secondGestor?.name).toMatch(/^GESTOR #\d+$/);
    expect(secondGestor?.elementId).toBe(4);
    expect(totalGeral?.readableFormula).toBe(`[2,22](${secondGestor?.name})`);
  });

  it('flags a multi-worksheet workbook whose conditions cannot be attributed', () => {
    const single = parseWorkbookDocument(
      buildWorkbookFixture({ worksheets: [{ name: 'A' }] }),
    );
    expect(single.conditionsAreWorkbookWide).toBe(false);

    const many = parseWorkbookDocument(
      buildWorkbookFixture({ worksheets: [{ name: 'A' }, { name: 'B' }] }),
    );
    expect(many.conditionsAreWorkbookWide).toBe(true);
  });

  it('never throws on a body that is not a workbook', () => {
    expect(parseWorkbookDocument(Buffer.from([0xff, 0x00, 0x08, 0x99]))).toMatchObject({
      format: 'UNKNOWN',
      worksheets: [],
    });
    expect(parseWorkbookDocument(null).format).toBe('EMPTY');
  });
});

/**
 * The record framing the worksheet model rests on.
 *
 * Every field below is only readable because the element body parses as a
 * complete record sequence — width from the type byte, count from the `u16` in
 * front of a vector. The last test in this block is the other half of that
 * contract: a body that does *not* frame falls back to the resynchronizing
 * scan and loses those fields rather than guessing them.
 */
describe('record framing', () => {
  it('reads a string longer than the one-byte length can express', () => {
    // 385 bytes — the shape that made 3 556 of the live corpus's calculations
    // unreadable before: `0xff` escapes the length to a following u16.
    const formula = `[1,102](${'[6,1],'.repeat(60)}[5,2,"0"])`;
    expect(formula.length).toBeGreaterThan(0xff);
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.CALCULATION)
      .string(FIXTURE_TAG.ITEM_LABEL, 'LONG')
      .string(FIXTURE_TAG.CALC_FORMULA, formula)
      .build();
    const element = readWorkbookElements(data)[0]!;
    expect(element.framed).toBe(true);
    expect(element.strings).toContainEqual({ tag: FIXTURE_TAG.CALC_FORMULA, value: formula });
  });

  it('reads a counted vector as a repeated record, not as a scalar', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.QUERY_REQUEST)
      .refVector(FIXTURE_TAG.QUERY_AXIS_ITEMS, [7, 4, 9])
      .build();
    const element = readWorkbookElements(data)[0]!;
    const record = element.records.find((r) => r.tag === FIXTURE_TAG.QUERY_AXIS_ITEMS)!;
    expect(record).toMatchObject({ repeated: true, numbers: [7, 4, 9] });
    // A vector is not a scalar field, so it never lands in `numbers`, where
    // `firstNumber` would return an arbitrary member of it.
    expect(element.numbers.some((n) => n.tag === FIXTURE_TAG.QUERY_AXIS_ITEMS)).toBe(false);
  });

  it('reads an empty vector as a record with no values rather than as absent', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.QUERY_REQUEST)
      .refVector(FIXTURE_TAG.QUERY_MEASURE_ITEMS, [])
      .build();
    const record = readWorkbookElements(data)[0]!.records.find(
      (r) => r.tag === FIXTURE_TAG.QUERY_MEASURE_ITEMS,
    )!;
    expect(record).toMatchObject({ repeated: true, numbers: [] });
  });

  it('reads each fixed-width numeric type at its own width', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.FORMAT)
      .number(FIXTURE_TYPE.INT32, 0x0642, -7)
      .number(FIXTURE_TYPE.INT16, 0x0644, 300)
      .number(FIXTURE_TYPE.UINT8_ALT, 0x0645, 1)
      .number(FIXTURE_TYPE.FLOAT32, 0x0846, 0.75)
      .string(FIXTURE_TAG.FORMAT_DISPLAY, 'DD-MON-RRRR')
      .build();
    const element = readWorkbookElements(data)[0]!;
    expect(element.framed).toBe(true);
    expect(element.numbers).toEqual([
      { tag: 0x0642, value: -7 },
      { tag: 0x0644, value: 300 },
      { tag: 0x0645, value: 1 },
      { tag: 0x0846, value: 0.75 },
    ]);
    expect(element.strings).toEqual([{ tag: FIXTURE_TAG.FORMAT_DISPLAY, value: 'DD-MON-RRRR' }]);
  });

  it('reads a blob vector, whose items repeat the record header', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.PARAMETER_VALUE)
      .blobVector(FIXTURE_TAG.PARAMETER_VALUE_DATA, [
        { subtype: 1, bytes: Buffer.from('04-ABR-2008\0', 'latin1') },
        { subtype: 1, bytes: Buffer.from('25\0', 'latin1') },
      ])
      .build();
    const record = readWorkbookElements(data)[0]!.records.find(
      (r) => r.tag === FIXTURE_TAG.PARAMETER_VALUE_DATA,
    )!;
    expect(record.blobs.map((b) => b.bytes.toString('latin1'))).toEqual([
      '04-ABR-2008\0',
      '25\0',
    ]);
  });

  it('falls back to the resynchronizing scan on a body it cannot frame', () => {
    // `opaque()` writes an int32 record followed by filler the record never
    // declared, so the body cannot account for its own bytes.
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.COLUMN)
      .opaque(0x07d2, 13)
      .string(FIXTURE_TAG.COLUMN_HEADING, 'Nº Apólice')
      .int32(FIXTURE_NUMBER.COLUMN_ITEM_REF.type, FIXTURE_NUMBER.COLUMN_ITEM_REF.tag, 4)
      .element(FIXTURE_CLASS.WORKSHEET)
      .string(FIXTURE_TAG.WORKSHEET_NAME, 'Folha 1')
      .build();

    const [column, worksheet] = readWorkbookElements(data);
    expect(column).toMatchObject({ framed: false, records: [] });
    // The scan still recovers strings and the allowlisted 4-byte fields …
    expect(column?.strings).toContainEqual({ tag: FIXTURE_TAG.COLUMN_HEADING, value: 'Nº Apólice' });
    expect(column?.numbers).toContainEqual({ tag: FIXTURE_NUMBER.COLUMN_ITEM_REF.tag, value: 4 });
    // … and the element after it frames normally: a body we cannot decode
    // costs us that body and nothing else.
    expect(worksheet).toMatchObject({ framed: true });
  });

  it('reports unframed bodies on the document rather than failing the parse', () => {
    const data = new WorkbookFixtureBuilder()
      .element(FIXTURE_CLASS.WORKBOOK)
      .opaque(0x07d2, 13)
      .string(FIXTURE_TAG.WORKBOOK_NAME, 'WB')
      .element(FIXTURE_CLASS.WORKSHEET)
      .string(FIXTURE_TAG.WORKSHEET_NAME, 'Folha 1')
      .build();
    const doc = parseWorkbookDocument(data);
    expect(doc.name).toBe('WB');
    expect(doc.unframedElements).toBe(1);
    expect(doc.warnings.join(' ')).toContain('could not be framed');
  });
});

/**
 * The worksheet model — every field here was confirmed against Oracle's own
 * `d4wkdmp.exe -f` output over the live 544-workbook corpus; see
 * `EUL_SCHEMA_GROUND_TRUTH.md` §7.8 for the per-field evidence.
 */
describe('worksheet model', () => {
  const doc = parseWorkbookDocument(
    buildWorkbookFixture({
      name: 'WB',
      items: [
        { itemLabel: 'Regiao', sourceId: 101 },
        { itemLabel: 'Valor', sourceId: 102 },
        { itemLabel: 'Taxa Cambio', sourceId: 103 },
      ],
      parameters: [{ name: 'Dt Fim', prompt: 'Data fim', identifier: '1', item: 'Regiao' }],
      conditions: [
        {
          sql: 'Valor > 0',
          identifier: '2',
          sourceId: -800,
          caseSensitive: true,
          operatorCode: 83,
          item: 'Valor',
          literals: ['0'],
          literalKind: 2,
        },
      ],
      calculations: [
        {
          name: 'TOTAL LIQUIDO',
          formula: '[1,1]([6,2])',
          identifier: '7',
          description: 'Soma do valor líquido',
          dataType: 2,
          placement: 1,
          hidden: false,
          isACalc: true,
          formatMask: '9G999G990D99',
          itemRefs: ['Valor'],
        },
      ],
      joins: [
        {
          name: 'M M27 -> M M27 1',
          identifier: 'M_M27_-_M_M27_1',
          sourceId: 109818,
          owningFolderName: 'M M27 1',
          owningFolderIdentifier: 'M_M27_1',
        },
      ],
      eulFilters: [
        {
          name: 'Department is Video Rental',
          identifier: 'DEPARTMENT_IS_VIDEO_RENTAL',
          sourceId: 103350,
          folderName: 'Video Analysis Information',
          folderIdentifier: 'DC_VIDEO_ANALYSIS_INFORMATION',
        },
      ],
      pageSetup: { texts: ['M70', null, 'Produção', null, null, '&Page / &Pages'], margins: [1, 1, 0.75, 0.75, 0.5, 0.5] },
      worksheets: [
        {
          name: 'Mapa 1',
          viewType: 'CROSSTAB',
          distinct: true,
          columns: [
            {
              item: 'Regiao',
              heading: 'Região',
              formatMask: 'DD-MON-RRRR',
              headingFormatMask: 'HEAD',
              axisType: 0,
              dataType: 4,
              displayWidth: 96,
              alignment: 3,
              wordWrap: true,
            },
            { item: 'Valor', axisType: 1, dataType: 2, displayWidth: 64 },
          ],
          // In the query but displayed by no column — a hidden item.
          hiddenItems: ['Taxa Cambio'],
          sorts: [
            { item: 'Regiao', direction: 1, grouped: true },
            { item: 'Valor', direction: 2 },
          ],
          totals: [
            {
              label: 'Total &Value',
              functionCode: 1,
              placementCode: 1,
              column: 1,
              breakColumn: 0,
              dataStyleRef: 41,
              headingStyleRef: 42,
              flags: [1, undefined, 3],
            },
            // An explicit `0` break column — how the source says "no break".
            { label: 'Total Geral', functionCode: 1, placementCode: 3, breakColumn: -1 },
            // A function code outside the one that is established, and a
            // placement code outside 1/3/6.
            { label: 'Contagem', functionCode: 4, placementCode: 9, column: 0 },
          ],
          joins: ['M M27 -> M M27 1'],
          parameterValues: [{ parameter: 'Dt Fim', values: ['04-ABR-2008'] }],
        },
      ],
    }),
  );
  const worksheet = doc.worksheets[0]!;

  it('reads the view type from the class of the element the worksheet names', () => {
    expect(worksheet.viewType).toBe('CROSSTAB');
    expect(worksheet.layoutElementId).not.toBeNull();
  });

  it('reads a column axis type, data type, width and alignment', () => {
    expect(worksheet.columns[0]).toMatchObject({
      itemLabel: 'Regiao',
      axisTypeCode: 0,
      axisType: 'AXIS',
      dataTypeCode: 4,
      dataType: 'DATE',
      displayWidth: 96,
      alignmentCode: 3,
      wordWrapFlag: 1,
      formatMask: 'DD-MON-RRRR',
      headingFormatMask: 'HEAD',
    });
    expect(worksheet.columns[1]).toMatchObject({ axisType: 'MEASURE', dataType: 'NUMBER', displayWidth: 64 });
  });

  it('resolves the format mask through the style chain, not by position', () => {
    const column = worksheet.columns[0]!;
    expect(column.dataStyleRef).not.toBeNull();
    expect(column.headingStyleRef).not.toBeNull();
    expect(column.headingStyleRef).not.toBe(column.dataStyleRef);
  });

  it('reads the query request the worksheet runs, and everything it names', () => {
    expect(worksheet.queries).toHaveLength(1);
    const query = worksheet.queries[0]!;
    expect(query.number).toBe(1);
    expect(query.distinct).toBe(true);
    // The axis/measure split, read from the request's two literal vectors —
    // `0x0123` axis and `0x0124` measure (§7.8.3). It is the input the
    // fan-trap guard's measure set is built from, and it is given by the
    // workbook, never inferred (D-031), so the two lists are asserted as the
    // disjoint sets they are rather than only counted.
    expect(query.axisItemRefs).toHaveLength(2); // Regiao + the hidden Taxa Cambio
    expect(query.measureItemRefs).toHaveLength(1);
    expect(query.measureItemRefs[0]).toBe(worksheet.columns[1]!.itemElementRef);
    expect(query.axisItemRefs).toContain(worksheet.columns[0]!.itemElementRef);
    expect(query.axisItemRefs).not.toContain(query.measureItemRefs[0]);
    expect(query.sortRefs).toHaveLength(2);
    expect(query.filterRefs).toHaveLength(1);
    expect(query.joinRefs).toHaveLength(1);
  });

  it('lists every item the query names, including one no column displays', () => {
    // The dump's sheet `Items :-` list is this, not the column list: an item a
    // query needs but nothing displays belongs to the worksheet all the same.
    expect(worksheet.queryItemRefs).toHaveLength(3);
    expect(worksheet.columns).toHaveLength(2);
    const displayed = new Set(worksheet.columns.map((c) => c.itemElementRef));
    expect(worksheet.queryItemRefs.filter((id) => !displayed.has(id))).toHaveLength(1);
  });

  it('reads sort direction, and the layout entry that carries the grouping', () => {
    expect(worksheet.sorts.map((s) => s.direction)).toEqual(['ASC', 'DESC']);
    expect(worksheet.sorts.map((s) => s.directionCode)).toEqual([1, 2]);
    expect(worksheet.sorts[0]?.layout).toMatchObject({ grouped: true, descendingFlag: false });
    expect(worksheet.sorts[1]?.layout).toMatchObject({ grouped: false, descendingFlag: true });
  });

  it('reads a total with its function, placement and the columns it spans', () => {
    expect(worksheet.totals).toHaveLength(3);
    const [subtotal, grand, count] = worksheet.totals;
    expect(subtotal).toMatchObject({
      label: 'Total &Value',
      functionCode: 1,
      // Code 1 is the only established `EDCBAggregateType` value.
      aggFunction: 'SUM',
      placementCode: 1,
      placement: 'AT_CHANGE',
      dataStyleRef: 41,
      headingStyleRef: 42,
    });
    expect(subtotal?.columnRef).toBe(worksheet.columns[1]?.elementId);
    expect(subtotal?.breakColumnRef).toBe(worksheet.columns[0]?.elementId);
    // `0x0c24`–`0x0c28` are carried verbatim, holes included.
    expect(subtotal?.unconfirmedFlags).toEqual([1, null, 3, null, null]);
    // An explicit break column of `0` reads as null, not as element #0.
    expect(grand).toMatchObject({
      label: 'Total Geral',
      placementCode: 3,
      placement: 'GRAND_TOTAL',
      breakColumnRef: null,
    });
    // Code 4 is decoded as COUNT DISTINCT, which Neo cannot express — so it is
    // named at the Discoverer level and left null at the Neo level. The
    // placement code is outside 1/3/6 and stays unnamed entirely.
    expect(count).toMatchObject({
      label: 'Contagem',
      functionCode: 4,
      aggFunction: null,
      discovererName: 'COUNT DISTINCT',
      placementCode: 9,
      placement: null,
    });
  });

  it('reads the join the query forces', () => {
    expect(worksheet.joins).toEqual([
      expect.objectContaining({
        sourceId: 109818,
        identifier: 'M_M27_-_M_M27_1',
        name: 'M M27 -> M M27 1',
        owningFolderIdentifier: 'M_M27_1',
        owningFolderName: 'M M27 1',
      }),
    ]);
    expect(doc.joins).toHaveLength(1);
  });

  it('reads the parameter values saved with the worksheet, without their NUL terminator', () => {
    expect(worksheet.parameterValues).toHaveLength(1);
    expect(worksheet.parameterValues[0]?.values).toEqual(['04-ABR-2008']);
    expect(worksheet.parameterValues[0]?.parameterRef).toBe(doc.parameters[0]?.elementId);
  });

  it('reads the calculation fields the dump names', () => {
    expect(doc.calculations[0]).toMatchObject({
      name: 'TOTAL LIQUIDO',
      identifier: '7',
      description: 'Soma do valor líquido',
      dataTypeCode: 2,
      dataType: 'NUMBER',
      placementCode: 1,
      hidden: false,
      isACalc: true,
      formatMask: '9G999G990D99',
    });
    expect(doc.calculations[0]?.itemRefs).toHaveLength(1);
  });

  it('reads a condition identifier, synthetic id, case sensitivity and its references', () => {
    expect(doc.conditions[0]).toMatchObject({
      identifier: '2',
      sourceId: -800,
      caseSensitive: true,
    });
  });

  it('reads a parameter identifier and the item it is bound to', () => {
    expect(doc.parameters[0]).toMatchObject({ identifier: '1' });
    expect(doc.parameters[0]?.itemElementRef).not.toBeNull();
  });

  it('reads a reference to a shared EUL filter', () => {
    expect(doc.eulFilters).toEqual([
      expect.objectContaining({
        sourceId: 103350,
        identifier: 'DEPARTMENT_IS_VIDEO_RENTAL',
        name: 'Department is Video Rental',
        folderIdentifier: 'DC_VIDEO_ANALYSIS_INFORMATION',
        folderName: 'Video Analysis Information',
      }),
    ]);
  });

  it('reads page setup as six texts and six margins, in tag order', () => {
    expect(doc.pageSetup?.texts).toEqual(['M70', null, 'Produção', null, null, '&Page / &Pages']);
    expect(doc.pageSetup?.margins).toEqual([1, 1, 0.75, 0.75, 0.5, 0.5]);
  });

  it('frames every element of a complete workbook', () => {
    expect(doc.unframedElements).toBe(0);
    expect(doc.warnings).toEqual([]);
  });

  it('places each column on the axis its query request lists it under', () => {
    // Axis items and measures are numbered separately — the measure is the
    // second column but the first measure.
    expect(worksheet.columns[0]).toMatchObject({ queryAxisKind: 'AXIS', axisOrder: 0 });
    expect(worksheet.columns[1]).toMatchObject({ queryAxisKind: 'MEASURE', axisOrder: 0 });
  });

  it('resolves the items no column displays, with their own identity and place', () => {
    expect(worksheet.hiddenItems).toEqual([
      expect.objectContaining({
        itemLabel: 'Taxa Cambio',
        itemSourceId: 103,
        folderLabel: 'Folder',
        isCalculation: false,
        axisKind: 'AXIS',
        // Second in the axis list, after Regiao.
        axisOrder: 1,
      }),
    ]);
  });

  it('reports the sheet-level Distinct and that the layout decoded', () => {
    expect(worksheet.selectDistinct).toBe(true);
    expect(worksheet.layoutDecoded).toBe(true);
  });
});

describe('worksheet model — a layout that does not decode', () => {
  const doc = parseWorkbookDocument(
    buildWorkbookFixture({
      items: [{ itemLabel: 'Regiao', sourceId: 101 }, { itemLabel: 'Valor', sourceId: 102 }],
      worksheets: [
        {
          name: 'Sem Layout',
          undecodableLayout: true,
          distinct: true,
          columns: [{ item: 'Regiao', axisType: 0 }, { item: 'Valor', axisType: 1 }],
          hiddenItems: ['Valor'],
        },
      ],
    }),
  );
  const worksheet = doc.worksheets[0]!;

  it('still reads the worksheet and its columns', () => {
    expect(worksheet.name).toBe('Sem Layout');
    expect(worksheet.columns.map((column) => column.itemLabel)).toEqual(['Regiao', 'Valor']);
  });

  it('reports no view type, no query and no layout', () => {
    expect(worksheet.viewType).toBeNull();
    expect(worksheet.layoutElementId).toBeNull();
    // The query request is in the stream; nothing links to it, so it is not
    // this worksheet's — a request is never picked up by position.
    expect(worksheet.queries).toEqual([]);
    expect(worksheet.layoutDecoded).toBe(false);
  });

  it('reports no axis, no position, no hidden items and no Distinct', () => {
    for (const column of worksheet.columns) {
      expect(column.queryAxisKind).toBeNull();
      expect(column.axisOrder).toBeNull();
    }
    expect(worksheet.hiddenItems).toEqual([]);
    expect(worksheet.queryItemRefs).toEqual([]);
    expect(worksheet.selectDistinct).toBeNull();
  });

  it('still reads the axis the column itself carries', () => {
    // `0x02be` is on the column element, not the layout, so it survives —
    // what is missing is the position, which only the query request holds.
    expect(worksheet.columns.map((column) => column.axisType)).toEqual(['AXIS', 'MEASURE']);
  });
});

describe('worksheet model — a hidden measure, and a page item', () => {
  const doc = parseWorkbookDocument(
    buildWorkbookFixture({
      items: [
        { itemLabel: 'Regiao', sourceId: 101 },
        { itemLabel: 'Ano', sourceId: 102 },
        { itemLabel: 'Valor', sourceId: 103 },
        { itemLabel: 'Custo', sourceId: 104 },
      ],
      worksheets: [
        {
          name: 'Mapa',
          distinct: false,
          columns: [
            // A page item is an axis item to the query request, so it takes a
            // position in the axis list like any other.
            { item: 'Regiao', axisType: 2 },
            { item: 'Ano', axisType: 0 },
            { item: 'Valor', axisType: 1 },
          ],
          hiddenItems: [{ item: 'Custo', axis: 'MEASURE' }],
        },
      ],
    }),
  );
  const worksheet = doc.worksheets[0]!;

  it('numbers a page item within the axis list', () => {
    expect(worksheet.columns[0]).toMatchObject({
      axisType: 'PAGE',
      queryAxisKind: 'AXIS',
      axisOrder: 0,
    });
    expect(worksheet.columns[1]).toMatchObject({ axisType: 'AXIS', axisOrder: 1 });
  });

  it('numbers a hidden measure among the measures, not among all the items', () => {
    expect(worksheet.columns[2]).toMatchObject({ axisType: 'MEASURE', axisOrder: 0 });
    expect(worksheet.hiddenItems).toEqual([
      expect.objectContaining({ itemLabel: 'Custo', axisKind: 'MEASURE', axisOrder: 1 }),
    ]);
  });

  it('reports Distinct as false rather than absent when the query says so', () => {
    expect(worksheet.selectDistinct).toBe(false);
  });
});
