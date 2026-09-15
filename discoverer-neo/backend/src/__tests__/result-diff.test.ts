import {
  diffRowSets,
  normaliseCell,
  roundDecimal,
  rowSetVerdict,
  selectStratifiedSample,
  tallyVerdicts,
  type Candidate,
  type DiffColumn,
} from '../lib/result-diff.js';

const text: DiffColumn = { name: 'Nome', kind: 'text', key: true };
const money: DiffColumn = { name: 'Premio', kind: 'number', scale: 2 };
const day: DiffColumn = { name: 'Data', kind: 'date', dateOnly: true };

describe('normaliseCell — what it absorbs', () => {
  it('treats null, undefined and an empty or blank string as one NULL', () => {
    for (const v of [null, undefined, '', '   ']) expect(normaliseCell(text, v)).toBeNull();
    expect(normaliseCell(money, '')).toBeNull();
  });

  it('drops CHAR padding, folds CP1252 read as ISO-8859-1, and composes to NFC', () => {
    expect(normaliseCell(text, 'SEGURO  ')).toBe('SEGURO');
    // A Windows export of "D’Ávila" decoded as ISO-8859-1 carries U+0092.
    expect(normaliseCell(text, `D${String.fromCharCode(0x92)}Ávila`)).toBe('D’Ávila');
    expect(normaliseCell(text, `Me${String.fromCharCode(0x301)}dia`)).toBe(normaliseCell(text, 'Média'));
  });

  it("rounds numbers the way Oracle's ROUND does, after removing binary noise", () => {
    expect(normaliseCell({ name: 'x', kind: 'number' }, 0.1 + 0.2)).toBe(normaliseCell({ name: 'x', kind: 'number' }, 0.3));
    expect(roundDecimal(1.005, 2)).toBe(1.01);
    expect(roundDecimal(-2.5, 0)).toBe(-3);
    expect(normaliseCell(money, '12.50')).toBe(normaliseCell(money, 12.5));
    expect(normaliseCell(money, -0.001)).toBe('0.00');
  });

  it('compares dates as local calendar values, to the day when asked', () => {
    const at = new Date(2026, 4, 6, 22, 8, 28);
    expect(normaliseCell({ name: 'd', kind: 'date' }, at)).toBe('2026-05-06 22:08:28');
    expect(normaliseCell({ name: 'd', kind: 'date' }, '2026-05-06 22:08:28')).toBe('2026-05-06 22:08:28');
    expect(normaliseCell(day, at)).toBe(normaliseCell(day, '2026-05-06'));
  });

  it('keeps a value that does not parse as its kind behind a marker', () => {
    expect(normaliseCell(money, 'n/d')).toBe('!n/d');
    expect(normaliseCell(day, 'ontem')).toBe('!ontem');
  });
});

describe('diffRowSets', () => {
  const columns = [text, money, day];
  const reference = [
    ['ANA  ', '100.10', '2026-01-31'],
    ['RUI', null, '2026-02-28'],
    ['RUI', null, '2026-02-28'],
    ['Sá', '0.30', null],
  ];
  // The same rows as Neo returns them: another order, typed values, float
  // noise, no padding, '' for NULL.
  const neo = [
    ['Sá', 0.1 + 0.2, ''],
    ['RUI', undefined, new Date(2026, 1, 28, 0, 0, 0)],
    ['ANA', 100.1, new Date(2026, 0, 31, 13, 45, 0)],
    ['RUI', '', new Date(2026, 1, 28)],
  ];

  it('matches the same rows in any order', () => {
    const diff = diffRowSets(columns, reference, neo);
    expect(diff).toMatchObject({ referenceRows: 4, neoRows: 4, matchedRows: 4, onlyInReference: 0, onlyInNeo: 0, orderMatches: null });
    expect(rowSetVerdict(diff)).toBe('MATCH');
  });

  it('counts duplicates — a row returned twice is not a row returned once', () => {
    const diff = diffRowSets(columns, reference, [...neo.slice(0, 3), ['ANA', 100.1, '2026-01-31']]);
    expect(diff).toMatchObject({ onlyInReference: 1, onlyInNeo: 1 });
    expect(rowSetVerdict(diff)).toBe('MISMATCH');
  });

  describe('does not mask a real difference — each deliberately altered value', () => {
    const alter = (row: number, col: number, value: unknown) =>
      neo.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r)) as typeof neo;

    it.each([
      ['a number, by one cent', 2, 1, 100.11, 'Premio', '100.10', '100.11'],
      ['a text, by one accent', 0, 0, 'Sa', 'Nome', 'Sá', null],
      ['a date, by one day', 2, 2, new Date(2026, 0, 30), 'Data', '2026-01-31', '2026-01-30'],
      ['a NULL, into zero', 1, 1, 0, 'Premio', null, '0.00'],
    ])('%s', (_label, row, col, value, column, before, after) => {
      const diff = diffRowSets(columns, reference, alter(row, col, value));
      expect(rowSetVerdict(diff)).toBe('MISMATCH');
      expect(diff.onlyInNeo).toBe(1);
      if (after === null) {
        // A changed key cannot pair: both rows are reported whole instead.
        expect(diff.unpaired.reference.flat()).toContain(before);
        expect(diff.unpaired.neo.flat()).toContain('Sa');
      } else {
        expect(diff.cellDiffs).toEqual([[{ column, reference: before, neo: after }]]);
        expect(diff.columnMismatches).toEqual({ [column]: 1 });
      }
    });
  });

  it('checks order on the sort columns only, so ties may come back in any order', () => {
    const cols: DiffColumn[] = [{ name: 'Ramo', kind: 'text' }, { name: 'Valor', kind: 'number', scale: 0 }];
    const ref = [['A', 1], ['A', 2], ['B', 3]];
    expect(diffRowSets(cols, ref, [['A', 2], ['A', 1], ['B', 3]], { sortColumns: [0] }).orderMatches).toBe(true);
    const swapped = diffRowSets(cols, ref, [['B', 3], ['A', 1], ['A', 2]], { sortColumns: [0] });
    expect(swapped.orderMatches).toBe(false);
    expect(rowSetVerdict(swapped)).toBe('MISMATCH');
  });
});

describe('selectStratifiedSample', () => {
  const none = { multiFolder: false, calculated: false, totals: false, distinct: false, masterDetail: false };
  const c = (mapId: string, runs: number, strata: Partial<Candidate['strata']> = {}): Candidate => ({
    mapId,
    name: mapId,
    runs,
    strata: { ...none, ...strata },
  });

  it('covers every hard case each way before filling by usage', () => {
    const candidates = [
      c('plain-busy', 900),
      c('plain-2', 800),
      c('calc', 50, { calculated: true, totals: true }),
      c('distinct', 5, { distinct: true }),
      c('fan', 1, { multiFolder: true, masterDetail: true }),
    ];
    const { sample, uncovered } = selectStratifiedSample(candidates, 5);
    expect(uncovered).toEqual([]);
    expect(sample.map((s) => `${s.mapId}:${s.reason}`)).toEqual([
      'fan:multiFolder',
      'plain-busy:not multiFolder',
      'calc:calculated',
      'distinct:distinct',
      'plain-2:usage',
    ]);
  });

  it('names a requirement nothing can fill instead of dropping it', () => {
    const { sample, uncovered } = selectStratifiedSample([c('only', 3)], 3);
    expect(sample).toHaveLength(1);
    expect(uncovered).toEqual(['multiFolder', 'calculated', 'totals', 'distinct', 'masterDetail']);
  });
});

it('tallies verdicts by verdict, oracle and stratum', () => {
  const t = tallyVerdicts([
    { mapId: '1', name: 'a', oracle: 'LEGACY_SQL', verdict: 'MATCH', strata: ['calculated'] },
    { mapId: '2', name: 'b', oracle: 'QPP_ROW_COUNT', verdict: 'MISMATCH', strata: ['calculated', 'distinct'] },
  ]);
  expect(t.byVerdict).toEqual({ MATCH: 1, MISMATCH: 1, REFUSED: 0, NOT_COMPARABLE: 0 });
  expect(t.byOracle.QPP_ROW_COUNT?.MISMATCH).toBe(1);
  expect(t.byStratum.calculated).toEqual({ MATCH: 1, MISMATCH: 1, REFUSED: 0, NOT_COMPARABLE: 0 });
});
