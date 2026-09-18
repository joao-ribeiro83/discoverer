import { describe, it, expect } from '@jest/globals';

import {
  groupDatabaseFunctions,
  neoDataType,
  type AllArgumentsRow,
} from '../services/oracle-introspection.js';

/** Rows shaped on the live SIID_TESTES `ALL_ARGUMENTS`. */
function row(over: Partial<AllArgumentsRow>): AllArgumentsRow {
  return {
    OWNER: 'SIID_TESTES',
    PACKAGE_NAME: 'PKG_FORMULAS_COSEC',
    OBJECT_NAME: 'GET_VCEP',
    OVERLOAD: null,
    ARGUMENT_NAME: null,
    POSITION: 0,
    DATA_TYPE: 'NUMBER',
    DEFAULTED: 'N',
    IN_OUT: 'OUT',
    ...over,
  };
}

describe('groupDatabaseFunctions', () => {
  it('reads a packaged function with its typed arguments in order', () => {
    const [fn, ...rest] = groupDatabaseFunctions([
      row({}),
      row({ ARGUMENT_NAME: 'PI_DT_INICIO', POSITION: 2, DATA_TYPE: 'DATE', IN_OUT: 'IN' }),
      row({ ARGUMENT_NAME: 'PI_CDPERSON', POSITION: 1, DATA_TYPE: 'VARCHAR2', IN_OUT: 'IN' }),
      row({ ARGUMENT_NAME: 'P_TIPO', POSITION: 3, DATA_TYPE: 'VARCHAR2', DEFAULTED: 'Y', IN_OUT: 'IN' }),
    ]);
    expect(rest).toHaveLength(0);
    expect(fn).toEqual({
      owner: 'SIID_TESTES',
      packageName: 'PKG_FORMULAS_COSEC',
      name: 'GET_VCEP',
      overload: null,
      returnType: 'NUMBER',
      parameters: [
        { name: 'PI_CDPERSON', type: 'TEXT', required: true, position: 1 },
        { name: 'PI_DT_INICIO', type: 'DATE', required: true, position: 2 },
        { name: 'P_TIPO', type: 'TEXT', required: false, position: 3 },
      ],
      callableFromSql: true,
      reason: null,
    });
  });

  it('keeps same-named functions in different packages and overloads apart', () => {
    const fns = groupDatabaseFunctions([
      row({}),
      row({ PACKAGE_NAME: 'PKG_SINISTROS_UTIL' }),
      row({ OVERLOAD: '1' }),
      row({ OVERLOAD: '2', DATA_TYPE: 'VARCHAR2' }),
    ]);
    expect(fns.map((f) => [f.packageName, f.overload, f.returnType])).toEqual([
      ['PKG_FORMULAS_COSEC', null, 'NUMBER'],
      ['PKG_SINISTROS_UTIL', null, 'NUMBER'],
      ['PKG_FORMULAS_COSEC', '1', 'NUMBER'],
      ['PKG_FORMULAS_COSEC', '2', 'TEXT'],
    ]);
  });

  it('drops procedures and reads a no-argument function', () => {
    const fns = groupDatabaseFunctions([
      // A procedure: no POSITION 0 return row.
      row({ OBJECT_NAME: 'DO_THING', POSITION: 1, ARGUMENT_NAME: 'P', IN_OUT: 'IN' }),
      // A no-argument function: its placeholder row has no name.
      row({ OBJECT_NAME: 'NOW_ID' }),
      row({ OBJECT_NAME: 'NOW_ID', POSITION: 1, DATA_TYPE: null, IN_OUT: 'IN' }),
    ]);
    expect(fns).toHaveLength(1);
    expect(fns[0]).toMatchObject({ name: 'NOW_ID', parameters: [], callableFromSql: true });
  });

  it('marks what SQL cannot call, and says why', () => {
    const fns = groupDatabaseFunctions([
      row({ OBJECT_NAME: 'WITH_OUT' }),
      row({ OBJECT_NAME: 'WITH_OUT', POSITION: 1, ARGUMENT_NAME: 'PO_X', IN_OUT: 'IN/OUT' }),
      row({ OBJECT_NAME: 'IS_OK', DATA_TYPE: 'PL/SQL BOOLEAN' }),
    ]);
    expect(fns.map((f) => [f.name, f.callableFromSql, f.reason])).toEqual([
      ['WITH_OUT', false, 'argument PO_X is IN/OUT'],
      ['IS_OK', false, 'return value is PL/SQL BOOLEAN'],
    ]);
  });
});

describe('neoDataType', () => {
  it.each([
    ['VARCHAR2', 'TEXT'],
    ['CHAR', 'TEXT'],
    ['CLOB', 'TEXT'],
    ['NUMBER', 'NUMBER'],
    ['BINARY_INTEGER', 'NUMBER'],
    ['DATE', 'DATE'],
    ['TIMESTAMP(6)', 'DATE'],
    ['BLOB', 'BLOB'],
  ])('%s → %s', (oracle, neo) => {
    expect(neoDataType(oracle)).toBe(neo);
  });
});
