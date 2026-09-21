import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { headingLines, type ExportHeading, type ExportSource } from '../services/exporters/types.js';
import { totalLabelsFor } from '../services/exporters/total-labels.js';
import { writeCsv } from '../services/exporters/csv-exporter.js';
import { substituteTitleTokens } from '../lib/title-tokens.js';

const runAt = new Date('2026-09-21T10:30:00');

const heading: ExportHeading = {
  title: 'Apólices em vigor',
  description: 'Apólices em vigor\nEmitidas entre 01-01-2026 e 31-03-2026',
  parameters: [
    { name: 'Dt Início', value: '01-01-2026' },
    { name: 'Dt Fim', value: '31-03-2026' },
  ],
  runAt,
};

describe('headingLines', () => {
  it('prints title, description, parameters and run time as blocks', () => {
    expect(headingLines(heading, totalLabelsFor('pt-PT'), 'pt-PT')).toEqual([
      'Apólices em vigor',
      'Emitidas entre 01-01-2026 e 31-03-2026',
      '',
      'Parâmetros',
      'Dt Início: 01-01-2026',
      'Dt Fim: 31-03-2026',
      '',
      `Executado em: ${runAt.toLocaleString('pt-PT')}`,
    ]);
  });

  it('is empty without a heading, and just the run time for a bare map', () => {
    expect(headingLines(undefined, totalLabelsFor('en'))).toEqual([]);
    expect(
      headingLines({ title: null, description: null, parameters: [], runAt }, totalLabelsFor('en'), 'en'),
    ).toEqual([`Run at: ${runAt.toLocaleString('en')}`]);
  });
});

describe('writeCsv document header', () => {
  it('writes the header above the column labels', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-export-'));
    const file = path.join(dir, 'out.csv');
    const source: ExportSource = {
      columns: [
        { name: 'C1', label: 'Apólice', dataType: 'VARCHAR2' },
        { name: 'C2', label: 'Prémio', dataType: 'NUMBER' },
      ] as ExportSource['columns'],
      batches: (async function* () {
        yield [{ C1: 'A-1', C2: 10 }];
      })(),
    };
    const result = await writeCsv(file, source, { heading, locale: 'pt-PT' });
    const raw = fs.readFileSync(file, 'utf8');
    const lines = (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).trim().split(/\r?\n/);
    fs.rmSync(dir, { recursive: true, force: true });

    expect(result.rowCount).toBe(1);
    expect(lines[0]).toBe('Apólices em vigor');
    expect(lines).toContain('Dt Início: 01-01-2026');
    // Blank line, then the column labels, then the data.
    const labelIdx = lines.indexOf('Apólice,Prémio');
    expect(labelIdx).toBeGreaterThan(0);
    expect(lines[labelIdx - 1]).toBe('');
    expect(lines[labelIdx + 1]).toBe('A-1,10');
  });
});

describe('&Workbook / &Worksheet tokens', () => {
  it('substitute when the caller supplies them the way resolveHeading does', () => {
    const values = new Map([
      ['Workbook', 'M03_V19'],
      ['Worksheet', 'M03_V19'],
    ]);
    expect(substituteTitleTokens('&Workbook / &Worksheet', values, runAt)).toBe('M03_V19 / M03_V19');
  });
});
