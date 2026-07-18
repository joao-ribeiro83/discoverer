import { describe, it, expect } from '@jest/globals';

import {
  CliUsageError,
  EXIT_ERROR,
  EXIT_INVALID,
  EXIT_OK,
  loadConnectionConfig,
  runCli,
} from '../cli.js';
import type { CliIO } from '../cli.js';
import type { AssessmentReport } from '../services/assessment.js';
import type { EulReadResult } from '../services/eul-reader.js';
import type { OracleExecutor } from '../services/oracle-client.js';
import type { MockDb } from './helpers/mock-eul.js';
import { eul4Db, eul5Db, mockExecutor } from './helpers/mock-eul.js';

function makeIO() {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIO = { out: (l) => out.push(l), err: (l) => err.push(l) };
  return { io, out, err, outText: () => out.join('\n'), errText: () => err.join('\n') };
}

/** eul5Db with one expression pointed at a non-existent folder (broken ref). */
function brokenDb(): MockDb {
  const db = eul5Db();
  db.tables.EUL5_EXPRESSIONS = (db.tables.EUL5_EXPRESSIONS ?? []).map((row, i) =>
    i === 0 ? { ...row, OBJ_ID: 99999 } : row,
  );
  return db;
}

function emptyCatalogDb(): OracleExecutor {
  const db = eul5Db();
  db.catalog = [];
  return mockExecutor(db);
}

describe('runCli — analyze', () => {
  it('prints a human-readable assessment report and exits 0', async () => {
    const cap = makeIO();
    const code = await runCli(['analyze'], { io: cap.io, source: mockExecutor(eul5Db()) });

    expect(code).toBe(EXIT_OK);
    const text = cap.outText();
    expect(text).toContain('EUL Migration Assessment');
    expect(text).toContain('EUL5');
    expect(text).toContain('Business areas');
    expect(text).toContain('Migration readiness');
  });

  it('emits JSON with --json', async () => {
    const cap = makeIO();
    const code = await runCli(['analyze', '--json'], { io: cap.io, source: mockExecutor(eul5Db()) });

    expect(code).toBe(EXIT_OK);
    const report = JSON.parse(cap.outText()) as AssessmentReport;
    expect(report.version.version).toBe('EUL5');
    expect(report.counts.businessAreas).toBe(1);
    expect(report.readiness).toBeDefined();
  });

  it('honours --prefer-version on a source', async () => {
    const cap = makeIO();
    // eul4Db is pure EUL4; preferVersion EUL4 is a no-op but must parse + run.
    const code = await runCli(['analyze', '--prefer-version', 'EUL4'], {
      io: cap.io,
      source: mockExecutor(eul4Db()),
    });
    expect(code).toBe(EXIT_OK);
    expect(cap.outText()).toContain('EUL4');
  });
});

describe('runCli — export', () => {
  it('writes normalized JSON to the output file and exits 0', async () => {
    const cap = makeIO();
    const written: Record<string, string> = {};
    const code = await runCli(['export', '--output', 'out.json'], {
      io: cap.io,
      source: mockExecutor(eul5Db()),
      writeFile: (path, content) => {
        written[path] = content;
        return Promise.resolve();
      },
    });

    expect(code).toBe(EXIT_OK);
    expect(written['out.json']).toBeDefined();
    const payload = JSON.parse(written['out.json'] as string) as EulReadResult;
    expect(payload.version.version).toBe('EUL5');
    expect(payload.data.businessAreas).toHaveLength(1);
    expect(payload.data.workbooks[0]?.info.worksheetCount).toBe(1);
    expect(cap.outText()).toContain('Exported EUL EUL5 metadata to out.json');
  });

  it('fails when --output is missing', async () => {
    const cap = makeIO();
    const code = await runCli(['export'], { io: cap.io, source: mockExecutor(eul5Db()) });
    expect(code).toBe(EXIT_ERROR);
    expect(cap.errText()).toContain('--output');
  });
});

describe('runCli — validate', () => {
  it('exits 0 on clean data', async () => {
    const cap = makeIO();
    const code = await runCli(['validate'], { io: cap.io, source: mockExecutor(eul5Db()) });
    expect(code).toBe(EXIT_OK);
    expect(cap.outText()).toContain('VALID');
  });

  it('exits 2 and reports integrity errors on broken data', async () => {
    const cap = makeIO();
    const code = await runCli(['validate'], { io: cap.io, source: mockExecutor(brokenDb()) });
    expect(code).toBe(EXIT_INVALID);
    const text = cap.outText();
    expect(text).toContain('INVALID');
    expect(text).toContain('ITEM_NO_FOLDER');
  });
});

describe('runCli — errors', () => {
  it('exits 1 with a friendly message when no EUL is detected', async () => {
    const cap = makeIO();
    const code = await runCli(['analyze'], { io: cap.io, source: emptyCatalogDb() });
    expect(code).toBe(EXIT_ERROR);
    expect(cap.errText()).toMatch(/No EUL detected/);
  });

  it('exits 1 on an unknown command', async () => {
    const cap = makeIO();
    const code = await runCli(['frobnicate'], { io: cap.io, source: mockExecutor(eul5Db()) });
    expect(code).toBe(EXIT_ERROR);
  });

  it('exits 1 when no command is given', async () => {
    const cap = makeIO();
    const code = await runCli([], { io: cap.io, source: mockExecutor(eul5Db()) });
    expect(code).toBe(EXIT_ERROR);
  });

  it('exits 1 on an unknown option (strict mode)', async () => {
    const cap = makeIO();
    const code = await runCli(['analyze', '--bogus'], { io: cap.io, source: mockExecutor(eul5Db()) });
    expect(code).toBe(EXIT_ERROR);
  });

  it('exits 0 on --help without attempting a connection', async () => {
    const cap = makeIO();
    // No source and no connection flags: if help did not short-circuit, this
    // would fall through to connection building and fail.
    const code = await runCli(['--help'], { io: cap.io });
    expect(code).toBe(EXIT_OK);
  });
});

describe('runCli — connection building', () => {
  it('loads an inline JSON connection and builds a source via makeSource', async () => {
    const cap = makeIO();
    let receivedConfig: unknown;
    const code = await runCli(
      ['analyze', '--connection', '{"user":"u","password":"p","host":"h","serviceName":"s"}'],
      {
        io: cap.io,
        makeSource: (config) => {
          receivedConfig = config;
          return mockExecutor(eul5Db());
        },
      },
    );

    expect(code).toBe(EXIT_OK);
    expect(receivedConfig).toMatchObject({ user: 'u', password: 'p', host: 'h' });
  });

  it('exits 1 when connection details are incomplete', async () => {
    const cap = makeIO();
    const code = await runCli(['analyze', '--user', 'u'], {
      io: cap.io,
      makeSource: () => mockExecutor(eul5Db()),
    });
    expect(code).toBe(EXIT_ERROR);
    expect(cap.errText()).toMatch(/password/);
  });
});

describe('loadConnectionConfig', () => {
  const noRead = (): Promise<string> =>
    Promise.reject(new Error('readFile should not be called'));

  it('parses an inline JSON config', async () => {
    const config = await loadConnectionConfig(
      { connection: '{"user":"u","password":"p","connectString":"cs"}' },
      noRead,
    );
    expect(config).toMatchObject({ user: 'u', password: 'p', connectString: 'cs' });
  });

  it('reads a JSON file path via the injected reader', async () => {
    const config = await loadConnectionConfig(
      { connection: '/tmp/conn.json' },
      () => Promise.resolve('{"user":"fu","password":"fp","host":"fh","serviceName":"svc"}'),
    );
    expect(config).toMatchObject({ user: 'fu', host: 'fh' });
  });

  it('lets individual flags override file/inline fields', async () => {
    const config = await loadConnectionConfig(
      {
        connection: '{"user":"u","password":"p","host":"h"}',
        user: 'override',
        port: 1600,
      },
      noRead,
    );
    expect(config.user).toBe('override');
    expect(config.port).toBe(1600);
  });

  it('builds from flags alone with no --connection', async () => {
    const config = await loadConnectionConfig(
      { user: 'u', password: 'p', host: 'h', serviceName: 's' },
      noRead,
    );
    expect(config).toMatchObject({ user: 'u', host: 'h', serviceName: 's' });
  });

  it('throws CliUsageError when user/password are missing', async () => {
    await expect(loadConnectionConfig({ host: 'h' }, noRead)).rejects.toBeInstanceOf(CliUsageError);
  });

  it('throws CliUsageError when neither connectString nor host is given', async () => {
    await expect(
      loadConnectionConfig({ user: 'u', password: 'p' }, noRead),
    ).rejects.toBeInstanceOf(CliUsageError);
  });

  it('throws CliUsageError on invalid JSON', async () => {
    await expect(
      loadConnectionConfig({ connection: '{not json' }, noRead),
    ).rejects.toBeInstanceOf(CliUsageError);
  });
});
