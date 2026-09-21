import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { headingText, type ExportHeading, type ExportSource } from '../services/exporters/types.js';
import { writeCsv } from '../services/exporters/csv-exporter.js';
import { fontScaleFor } from '../services/exporters/pdf-exporter.js';
import { substituteTitleTokens } from '../lib/title-tokens.js';

const runAt = new Date('2026-09-21T10:30:00');

const heading: ExportHeading = {
  title: 'Apólices em vigor',
  description: 'Apólices em vigor\nEmitidas entre 01-01-2026 e 31-03-2026',
  // Only the parameters the text does not already print (resolveHeading's job).
  parameters: [{ name: 'Ramo', value: '10' }],
  runAt,
};

describe('headingText', () => {
  it('is the description with its unprinted parameters appended, title deduplicated', () => {
    expect(headingText(heading)).toBe(
      'Apólices em vigor\nEmitidas entre 01-01-2026 e 31-03-2026\nRamo: 10',
    );
  });

  it('is null when there is nothing to print', () => {
    expect(headingText(undefined)).toBeNull();
    expect(headingText({ title: null, description: '  ', parameters: [], runAt })).toBeNull();
  });
});

describe('writeCsv document header', () => {
  it("uses Discoverer's layout: header on row 1, row 2 blank, labels on row 3", async () => {
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
    const result = await writeCsv(file, source, { heading });
    const raw = fs.readFileSync(file, 'utf8');
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    fs.rmSync(dir, { recursive: true, force: true });

    expect(result.rowCount).toBe(1);
    // The multi-line header is one quoted CSV field, then a blank row.
    expect(text.startsWith('"Apólices em vigor\nEmitidas entre 01-01-2026 e 31-03-2026\nRamo: 10"\n\nApólice,Prémio\nA-1,10')).toBe(true);
  });
});

describe('PDF font scale', () => {
  it('keeps full size while the columns fit and shrinks proportionally after', () => {
    expect(fontScaleFor(5, 500)).toBe(1);
    // 25 columns need 1000pt at full size; the floor stops the shrink at 0.55.
    expect(fontScaleFor(25, 500)).toBe(0.55);
    expect(fontScaleFor(16, 500)).toBeCloseTo(500 / (16 * 40), 3);
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
