import { describe, it, expect } from '@jest/globals';
import { parseResultAliasMap, discoverBatchResultTables } from '../services/batch-result-import.service.js';

describe('parseResultAliasMap', () => {
  it('extracts ordered (column, expression id) pairs from a BQ_RESULT_SQL template', () => {
    const sql = 'SELECT BRVC1 AS E445, BRN2 AS E10, BRD1 AS E900 FROM <TABLE_NAME> Order By BRVC1';
    expect(parseResultAliasMap(sql)).toEqual([
      { rawColumn: 'BRVC1', exprId: 445 },
      { rawColumn: 'BRN2', exprId: 10 },
      { rawColumn: 'BRD1', exprId: 900 },
    ]);
  });

  it('accepts the implicit-alias form (no AS keyword)', () => {
    expect(parseResultAliasMap('SELECT BRVC1 E445 FROM <TABLE_NAME>')).toEqual([
      { rawColumn: 'BRVC1', exprId: 445 },
    ]);
  });

  it('is case-insensitive', () => {
    expect(parseResultAliasMap('select brvc1 as e445 from <table_name>')).toEqual([
      { rawColumn: 'BRVC1', exprId: 445 },
    ]);
  });

  it('preserves select-list order across a 4-column split (BQ_RESULT_SQL_1..4 concatenated)', () => {
    const part1 = 'SELECT BRN1 AS E1, ';
    const part2 = 'BRVC3 AS E2, ';
    const part3 = 'BRD2 AS E3 ';
    const part4 = 'FROM <TABLE_NAME> Order By BRN1';
    expect(parseResultAliasMap(part1 + part2 + part3 + part4)).toEqual([
      { rawColumn: 'BRN1', exprId: 1 },
      { rawColumn: 'BRVC3', exprId: 2 },
      { rawColumn: 'BRD2', exprId: 3 },
    ]);
  });

  it('returns empty for a template with no result columns', () => {
    expect(parseResultAliasMap('FROM <TABLE_NAME> Order By BRVC1')).toEqual([]);
  });
});

describe('discoverBatchResultTables', () => {
  it('parses the timestamp and query index out of each matching table name', async () => {
    const conn = {
      execute: async () => ({
        rows: [
          { TABLE_NAME: 'EUL4_B260506220828Q1R1' },
          { TABLE_NAME: 'EUL4_B260506220828Q2R1' },
          { TABLE_NAME: 'EUL4_B110321141200Q1R1' },
        ],
      }),
    };

    const tables = await discoverBatchResultTables(conn, 'SIID_TESTES', 'EUL4_');
    expect(tables).toEqual([
      { tableName: 'EUL4_B260506220828Q1R1', timestamp: '260506220828', queryIndex: 1 },
      { tableName: 'EUL4_B260506220828Q2R1', timestamp: '260506220828', queryIndex: 2 },
      { tableName: 'EUL4_B110321141200Q1R1', timestamp: '110321141200', queryIndex: 1 },
    ]);
  });

  it('silently drops a row that does not match the naming pattern', async () => {
    const conn = {
      execute: async () => ({ rows: [{ TABLE_NAME: 'EUL4_SOME_OTHER_TABLE' }] }),
    };

    const tables = await discoverBatchResultTables(conn, 'SIID_TESTES', 'EUL4_');
    expect(tables).toEqual([]);
  });
});
