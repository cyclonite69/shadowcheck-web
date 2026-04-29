export {};

const { envFlag } = require('../../server/src/utils/envFlag');

describe('envFlag', () => {
  test('returns true for "true"', () => {
    expect(envFlag('true')).toBe(true);
  });

  test('returns true for "TRUE" (case-insensitive)', () => {
    expect(envFlag('TRUE')).toBe(true);
  });

  test('returns false for "false"', () => {
    expect(envFlag('false')).toBe(false);
  });

  test('returns false for "1" (not truthy — only "true" is)', () => {
    expect(envFlag('1')).toBe(false);
  });

  test('returns false for "yes"', () => {
    expect(envFlag('yes')).toBe(false);
  });

  test('returns the defaultValue when value is undefined', () => {
    expect(envFlag(undefined, false)).toBe(false);
    expect(envFlag(undefined, true)).toBe(true);
  });

  test('returns the defaultValue when value is null', () => {
    expect(envFlag(null, true)).toBe(true);
  });

  test('returns the defaultValue when value is empty string', () => {
    expect(envFlag('', true)).toBe(true);
  });

  test('defaults to false when no defaultValue provided', () => {
    expect(envFlag(undefined)).toBe(false);
  });
});
