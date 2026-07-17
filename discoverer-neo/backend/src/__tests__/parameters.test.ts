import { describe, it, expect } from '@jest/globals';
import {
  resolveParametersForDefinitions,
  validateParameterValue,
  ParameterResolutionError,
  type ParameterDefinition,
} from '../services/parameter-resolver.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function def(
  overrides: Partial<ParameterDefinition> & { name: string },
): ParameterDefinition {
  return {
    paramType: 'STRING',
    defaultValue: null,
    isRequired: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateParameterValue
// ---------------------------------------------------------------------------

describe('validateParameterValue', () => {
  it('passes STRING values through as strings', () => {
    expect(validateParameterValue(def({ name: 'p', paramType: 'STRING' }), 'hi')).toBe(
      'hi',
    );
    expect(validateParameterValue(def({ name: 'p', paramType: 'STRING' }), 42)).toBe(
      '42',
    );
  });

  it('parses and validates NUMBER values', () => {
    const p = def({ name: 'n', paramType: 'NUMBER' });
    expect(validateParameterValue(p, '42')).toBe(42);
    expect(validateParameterValue(p, 3.14)).toBe(3.14);
    expect(validateParameterValue(p, ' 7 ')).toBe(7);
  });

  it('rejects non-numeric NUMBER values', () => {
    const p = def({ name: 'n', paramType: 'NUMBER' });
    expect(() => validateParameterValue(p, 'abc')).toThrow(ParameterResolutionError);
    expect(() => validateParameterValue(p, 'NaN')).toThrow(ParameterResolutionError);
    expect(() => validateParameterValue(p, Infinity)).toThrow(
      ParameterResolutionError,
    );
  });

  it('normalizes DATE values to YYYY-MM-DD', () => {
    const p = def({ name: 'd', paramType: 'DATE' });
    expect(validateParameterValue(p, '2024-03-05')).toBe('2024-03-05');
    expect(validateParameterValue(p, '2024-03-05T10:30:00Z')).toBe('2024-03-05');
    expect(validateParameterValue(p, new Date(Date.UTC(2024, 2, 5)))).toBe(
      '2024-03-05',
    );
  });

  it('rejects malformed and impossible DATE values', () => {
    const p = def({ name: 'd', paramType: 'DATE' });
    expect(() => validateParameterValue(p, '05/03/2024')).toThrow(
      ParameterResolutionError,
    );
    expect(() => validateParameterValue(p, '2024-13-01')).toThrow(
      ParameterResolutionError,
    );
    // 2024 is a leap year, so Feb 31 is not a real date.
    expect(() => validateParameterValue(p, '2024-02-31')).toThrow(
      ParameterResolutionError,
    );
  });

  it('splits LIST values into arrays', () => {
    const p = def({ name: 'l', paramType: 'LIST' });
    expect(validateParameterValue(p, 'a,b,c')).toEqual(['a', 'b', 'c']);
    expect(validateParameterValue(p, ' a , b ,c ')).toEqual(['a', 'b', 'c']);
    expect(validateParameterValue(p, ['x', 'y'])).toEqual(['x', 'y']);
    // empty members are dropped
    expect(validateParameterValue(p, 'a,,b,')).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// resolveParametersForDefinitions
// ---------------------------------------------------------------------------

describe('resolveParametersForDefinitions', () => {
  it('resolves all four parameter types from supplied values', () => {
    const defs = [
      def({ name: 's', paramType: 'STRING' }),
      def({ name: 'n', paramType: 'NUMBER' }),
      def({ name: 'd', paramType: 'DATE' }),
      def({ name: 'l', paramType: 'LIST' }),
    ];
    const { resolved, missing } = resolveParametersForDefinitions(defs, {
      s: 'east',
      n: '100',
      d: '2024-01-15',
      l: 'a,b',
    });
    expect(missing).toEqual([]);
    expect(resolved).toEqual({
      s: 'east',
      n: 100,
      d: '2024-01-15',
      l: ['a', 'b'],
    });
  });

  it('applies default values when a parameter is not supplied', () => {
    const defs = [
      def({ name: 'region', paramType: 'STRING', defaultValue: 'WEST' }),
      def({ name: 'limit', paramType: 'NUMBER', defaultValue: '50' }),
    ];
    const { resolved, missing } = resolveParametersForDefinitions(defs, {});
    expect(missing).toEqual([]);
    expect(resolved).toEqual({ region: 'WEST', limit: 50 });
  });

  it('lets a supplied value override the default', () => {
    const defs = [def({ name: 'region', defaultValue: 'WEST' })];
    const { resolved } = resolveParametersForDefinitions(defs, { region: 'EAST' });
    expect(resolved).toEqual({ region: 'EAST' });
  });

  it('reports required parameters that have no value and no default', () => {
    const defs = [
      def({ name: 'a', isRequired: true }),
      def({ name: 'b', isRequired: true, defaultValue: 'x' }),
      def({ name: 'c', isRequired: false }),
    ];
    const { resolved, missing } = resolveParametersForDefinitions(defs, {});
    expect(missing).toEqual(['a']);
    // required-with-default is satisfied; optional-without is simply omitted.
    expect(resolved).toEqual({ b: 'x' });
  });

  it('treats empty / whitespace strings as not supplied', () => {
    const defs = [
      def({ name: 'a', isRequired: true }),
      def({ name: 'b', defaultValue: 'fallback' }),
    ];
    const { resolved, missing } = resolveParametersForDefinitions(defs, {
      a: '   ',
      b: '',
    });
    expect(missing).toEqual(['a']);
    expect(resolved).toEqual({ b: 'fallback' });
  });

  it('omits optional parameters with neither value nor default', () => {
    const defs = [def({ name: 'opt', isRequired: false })];
    const { resolved, missing } = resolveParametersForDefinitions(defs, {});
    expect(missing).toEqual([]);
    expect(resolved).toEqual({});
  });

  it('ignores supplied values that are not declared parameters', () => {
    const defs = [def({ name: 'known' })];
    const { resolved } = resolveParametersForDefinitions(defs, {
      known: 'yes',
      stray: 'ignored',
    });
    expect(resolved).toEqual({ known: 'yes' });
  });

  it('propagates a type-cast failure on a supplied value', () => {
    const defs = [def({ name: 'n', paramType: 'NUMBER' })];
    expect(() =>
      resolveParametersForDefinitions(defs, { n: 'not-a-number' }),
    ).toThrow(ParameterResolutionError);
  });

  it('propagates a type-cast failure on a bad default value', () => {
    const defs = [def({ name: 'd', paramType: 'DATE', defaultValue: 'nope' })];
    expect(() => resolveParametersForDefinitions(defs, {})).toThrow(
      ParameterResolutionError,
    );
  });
});
