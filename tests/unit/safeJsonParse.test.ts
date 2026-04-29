export {};

import { safeJsonParse } from '../../server/src/utils/safeJsonParse';

describe('safeJsonParse', () => {
  test('parses a valid JSON object', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  test('parses a valid JSON array', () => {
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  test('returns null for null input', () => {
    expect(safeJsonParse(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(safeJsonParse(undefined)).toBeNull();
  });

  test('returns null for non-string input', () => {
    expect(safeJsonParse(42)).toBeNull();
    expect(safeJsonParse({})).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(safeJsonParse('')).toBeNull();
  });

  test('returns null for a plain string (not object/array)', () => {
    expect(safeJsonParse('"hello"')).toBeNull();
    expect(safeJsonParse('hello')).toBeNull();
  });

  test('returns null for irreparably malformed JSON', () => {
    expect(safeJsonParse('{bad json')).toBeNull();
  });

  test('trims whitespace before parsing', () => {
    expect(safeJsonParse('  {"x":2}  ')).toEqual({ x: 2 });
  });
});
