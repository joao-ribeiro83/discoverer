import { substituteTitleTokens } from '../lib/title-tokens.js';

describe('substituteTitleTokens', () => {
  const now = new Date('2026-09-12T14:30:00');

  it('substitutes &Date and &Time', () => {
    const result = substituteTitleTokens('Data da última consulta: &Date (&Time)', new Map(), now);
    expect(result).toBe(`Data da última consulta: ${now.toLocaleDateString()} (${now.toLocaleTimeString()})`);
  });

  it('substitutes a named parameter, matching case-insensitively', () => {
    const params = new Map([['Dt Início', '01-JAN-2026']]);
    expect(substituteTitleTokens('&Dt Início', params, now)).toBe('01-JAN-2026');
    expect(substituteTitleTokens('&DT INÍCIO', params, now)).toBe('01-JAN-2026');
  });

  it('prefers the longer of two overlapping parameter names', () => {
    const params = new Map([
      ['Dt Fim', 'A'],
      ['Dt Fim Vigência', 'B'],
    ]);
    expect(substituteTitleTokens('&Dt Fim Vigência', params, now)).toBe('B');
    expect(substituteTitleTokens('&Dt Fim', params, now)).toBe('A');
  });

  it('leaves an unrecognized token exactly as written, like Discoverer itself', () => {
    expect(substituteTitleTokens('&NoSuchParameter', new Map(), now)).toBe('&NoSuchParameter');
  });

  it('passes through null and empty strings unchanged', () => {
    expect(substituteTitleTokens(null, new Map(), now)).toBeNull();
    expect(substituteTitleTokens('', new Map(), now)).toBe('');
  });
});
