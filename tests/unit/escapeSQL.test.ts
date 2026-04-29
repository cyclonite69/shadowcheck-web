export {};

import { escapeLikePattern } from '../../server/src/utils/escapeSQL';

describe('escapeLikePattern', () => {
  test('returns empty string for null', () => {
    expect(escapeLikePattern(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(escapeLikePattern(undefined)).toBe('');
  });

  test('returns empty string for non-string input', () => {
    expect(escapeLikePattern(42)).toBe('');
    expect(escapeLikePattern({})).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(escapeLikePattern('')).toBe('');
  });

  test('escapes percent sign', () => {
    expect(escapeLikePattern('test%')).toBe('test\\%');
  });

  test('escapes underscore', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  test('escapes backslash first to avoid double-escaping', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });

  test('escapes multiple special characters', () => {
    expect(escapeLikePattern('a_b%c')).toBe('a\\_b\\%c');
  });

  test('leaves plain strings unchanged', () => {
    expect(escapeLikePattern('Starbucks')).toBe('Starbucks');
    expect(escapeLikePattern('Café WiFi')).toBe('Café WiFi');
  });
});
