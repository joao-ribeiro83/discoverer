import { makeBindName, makeColumnAlias } from '../lib/sql/identifiers.js';

/**
 * The bind-name derivation exists in three places that cannot import each
 * other: here, `makeBindName` in `migrate/src/services/transformers/transform.ts`,
 * and the backfill in `backend/drizzle/0008_bind_safe_parameter_names.sql`.
 *
 * `BIND_NAME_CASES` is the shared contract. The migrate package has a test
 * asserting the same table, so a change on one side that is not mirrored on
 * the other fails there.
 */
export const BIND_NAME_CASES: Array<[label: string, expected: string]> = [
  // Already an identifier — left alone, so existing data stays put.
  ['p_region', 'P_REGION'],
  ['PERIOD', 'PERIOD'],
  // The names a Discoverer author actually typed.
  ['Dt Fim Vigência >=', 'DT_FIM_VIG_NCIA'],
  ['Apólice nº', 'AP_LICE_N'],
  ['DATA FIM', 'DATA_FIM'],
  ['VALOR SUPERIOR A', 'VALOR_SUPERIOR_A'],
  ['DT Pedido  <=', 'DT_PEDIDO'],
  ['U.E.', 'U_E'],
  // Runs of junk collapse to one separator; leading/trailing ones go.
  ['  spaced  out  ', 'SPACED_OUT'],
  ['>>>weird<<<', 'WEIRD'],
  // Must start with a letter.
  ['2024 total', 'P_2024_TOTAL'],
  ['_leading', 'LEADING'],
  // Nothing usable at all still has to yield a bindable name.
  ['>=', 'P'],
  ['', 'P'],
  // Capped at 26 so the WHERE builder's own suffixes still fit in Oracle's 30.
  ['A very long prompt name that runs past the limit', 'A_VERY_LONG_PROMPT_NAME_TH'],
];

describe('makeBindName', () => {
  it.each(BIND_NAME_CASES)('derives %j as %j', (label, expected) => {
    expect(makeBindName(label, new Set())).toBe(expected);
  });

  it('produces something validateBindName accepts for every case', () => {
    for (const [label] of BIND_NAME_CASES) {
      expect(makeBindName(label, new Set())).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    }
  });

  it('never exceeds 26 characters, so _lo/_hi/_999 still fit Oracle 30', () => {
    for (const [label] of BIND_NAME_CASES) {
      expect(makeBindName(label, new Set()).length).toBeLessThanOrEqual(26);
    }
  });

  it('uniquifies prompts that reduce to the same base', () => {
    const taken = new Set<string>();
    expect(makeBindName('Dt Pedido <=', taken)).toBe('DT_PEDIDO');
    expect(makeBindName('Dt Pedido >=', taken)).toBe('DT_PEDIDO_2');
    expect(makeBindName('DT PEDIDO', taken)).toBe('DT_PEDIDO_3');
  });

  it('uniquifies a base already at the length cap by truncating the base', () => {
    const taken = new Set<string>();
    const long = 'A very long prompt name that runs past the limit';
    const first = makeBindName(long, taken);
    const second = makeBindName(long, taken);
    expect(second).not.toBe(first);
    expect(second.length).toBeLessThanOrEqual(26);
    // Truncating the suffix instead would hand out `first` forever.
    expect(second.endsWith('_2')).toBe(true);
  });

  it('steps around a name a different prompt already took', () => {
    const taken = new Set<string>();
    // A prompt genuinely called "Dt Pedido 2" claims DT_PEDIDO_2 first.
    expect(makeBindName('Dt Pedido 2', taken)).toBe('DT_PEDIDO_2');
    expect(makeBindName('Dt Pedido <=', taken)).toBe('DT_PEDIDO');
    expect(makeBindName('Dt Pedido >=', taken)).toBe('DT_PEDIDO_3');
  });

  it('shares its shape with makeColumnAlias but not its taken-set', () => {
    // Both reduce a label the same way; they are uniquified independently
    // because a column alias and a bind name never collide with each other.
    expect(makeBindName('Invoice Amount', new Set())).toBe('INVOICE_AMOUNT');
    expect(makeColumnAlias('Invoice Amount', new Set())).toBe('INVOICE_AMOUNT');
  });
});
