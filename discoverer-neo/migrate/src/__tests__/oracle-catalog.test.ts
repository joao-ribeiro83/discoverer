import { readCatalog, objectKey, columnKey } from '../services/oracle-catalog.js';
import type { OracleExecutor } from '../services/oracle-client.js';

function fakeExecutor(rowsBySql: (sql: string, owner: string) => Array<Record<string, unknown>>): OracleExecutor {
  return (sql, binds) => Promise.resolve(rowsBySql(sql, typeof binds?.owner === 'string' ? binds.owner : ''));
}

describe('readCatalog', () => {
  it('reads object types and column comments per owner, once each', async () => {
    const seen: string[] = [];
    const execute = fakeExecutor((sql, owner) => {
      seen.push(`${owner}:${/ALL_OBJECTS/.test(sql) ? 'objects' : 'comments'}`);
      if (/ALL_OBJECTS/.test(sql)) {
        return [
          { OBJECT_NAME: 'APOLICES', OBJECT_TYPE: 'TABLE' },
          { OBJECT_NAME: 'V_APOLICES', OBJECT_TYPE: 'VIEW' },
        ];
      }
      return [
        { TABLE_NAME: 'APOLICES', COLUMN_NAME: 'NUMAPOL', COMMENTS: 'Número da apólice' },
        { TABLE_NAME: 'APOLICES', COLUMN_NAME: 'BLANK', COMMENTS: '   ' },
      ];
    });

    const lookup = await readCatalog(execute, [
      { owner: 'siid', name: 'APOLICES' },
      { owner: 'SIID', name: 'V_APOLICES' },
      { owner: null, name: 'NO_OWNER' },
      { owner: 'SIID', name: '' },
    ]);

    expect(seen).toEqual(['SIID:objects', 'SIID:comments']);
    expect(lookup.objectTypes.get(objectKey('siid', 'v_apolices'))).toBe('VIEW');
    expect(lookup.objectTypes.get(objectKey('SIID', 'APOLICES'))).toBe('TABLE');
    expect(lookup.columnComments.get(columnKey('SIID', 'APOLICES', 'numapol'))).toBe('Número da apólice');
    expect(lookup.columnComments.has(columnKey('SIID', 'APOLICES', 'BLANK'))).toBe(false);
    expect(lookup.failures).toEqual([]);
  });

  it('records a failure per owner instead of throwing', async () => {
    const execute = fakeExecutor(() => {
      throw new Error('ORA-00942: table or view does not exist');
    });
    const lookup = await readCatalog(execute, [{ owner: 'X', name: 'T' }]);
    expect(lookup.objectTypes.size).toBe(0);
    expect(lookup.failures).toEqual([{ owner: 'X', reason: 'ORA-00942: table or view does not exist' }]);
  });
});
