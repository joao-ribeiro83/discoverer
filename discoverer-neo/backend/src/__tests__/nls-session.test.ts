import { nlsStatements } from '../services/oracle-connection-pool.js';
import { config } from '../config.js';

/**
 * The guard behind ORA-01722 on a map whose formula reads
 * `TO_NUMBER(REPLACE("PREMIO_MIN", '.', ','))`: Discoverer ran it under the
 * author's NLS, and a session on a different decimal separator reads `458.33`
 * as a broken number.
 */
describe('nlsStatements', () => {
  const original = { ...config };
  afterEach(() => Object.assign(config, original));

  it('emits nothing when nothing is configured', () => {
    Object.assign(config, {
      ORACLE_NLS_NUMERIC_CHARACTERS: undefined,
      ORACLE_NLS_DATE_FORMAT: undefined,
      ORACLE_NLS_DATE_LANGUAGE: undefined,
    });
    expect(nlsStatements()).toEqual([]);
  });

  it('sets only what is configured', () => {
    Object.assign(config, {
      ORACLE_NLS_NUMERIC_CHARACTERS: ',.',
      ORACLE_NLS_DATE_FORMAT: undefined,
      ORACLE_NLS_DATE_LANGUAGE: undefined,
    });
    expect(nlsStatements()).toEqual([
      "ALTER SESSION SET NLS_NUMERIC_CHARACTERS = ',.'",
    ]);
  });

  it('quotes the value even though config.ts already validated its shape', () => {
    // Unreachable through the schema — kept because "validated upstream" is a
    // reason to check twice, not a reason to stop quoting.
    Object.assign(config, {
      ORACLE_NLS_NUMERIC_CHARACTERS: undefined,
      ORACLE_NLS_DATE_FORMAT: "DD-MON-RR' OR '1'='1",
      ORACLE_NLS_DATE_LANGUAGE: undefined,
    });
    expect(nlsStatements()[0]).toBe(
      "ALTER SESSION SET NLS_DATE_FORMAT = 'DD-MON-RR'' OR ''1''=''1'",
    );
  });
});
