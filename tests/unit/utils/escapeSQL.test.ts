import { escapeLikePattern } from '../../../server/src/utils/escapeSQL';

describe('escapeLikePattern', () => {
  it('should escape percent and underscore characters', () => {
    expect(escapeLikePattern('test%')).toBe('test\\%');
    expect(escapeLikePattern('a_b%c')).toBe('a\\_b\\%c');
  });

  it('should escape backslashes', () => {
    expect(escapeLikePattern('test\\')).toBe('test\\\\');
    expect(escapeLikePattern('a\\_b')).toBe('a\\\\\\_b');
  });

  it('should return empty string for null or non-string input', () => {
    expect(escapeLikePattern(null)).toBe('');
    expect(escapeLikePattern(undefined)).toBe('');
    expect(escapeLikePattern(123)).toBe('');
    expect(escapeLikePattern({})).toBe('');
  });

  it('should return empty string for empty string input', () => {
    expect(escapeLikePattern('')).toBe('');
  });

  it('should return unchanged string for normal input', () => {
    expect(escapeLikePattern('Starbucks')).toBe('Starbucks');
    expect(escapeLikePattern('Café WiFi')).toBe('Café WiFi');
  });

  describe('SQL Injection Fuzzing/Negative Tests', () => {
    it('should handle null bytes', () => {
      const input = 'test\0injection';
      // In PostgreSQL, null bytes in strings can be problematic, but escapeLikePattern
      // doesn't explicitly strip them. It should at least not crash.
      expect(escapeLikePattern(input)).toBe(input);
    });

    it('should handle comment sequences', () => {
      const input = "ssid' OR '1'='1' --";
      // This is safe if used with parameterized queries. 
      // escapeLikePattern only escapes LIKE wildcards.
      expect(escapeLikePattern(input)).toBe(input);
    });

    it('should handle multi-statement injections', () => {
      const input = "'; DROP TABLE networks; --";
      expect(escapeLikePattern(input)).toBe(input);
    });

    it('should handle combinations of wildcards and injection attempts', () => {
      const input = "admin%') OR 1=1; --";
      expect(escapeLikePattern(input)).toBe("admin\\%') OR 1=1; --");
    });
    
    it('should handle large input strings', () => {
      const input = '%'.repeat(1000) + '_'.repeat(1000) + '\\'.repeat(1000);
      const expected = '\\%'.repeat(1000) + '\\_'.repeat(1000) + '\\\\'.repeat(1000);
      expect(escapeLikePattern(input)).toBe(expected);
    });

    it('should handle unicode characters and wildcards', () => {
      const input = '📡 %_ 📡';
      expect(escapeLikePattern(input)).toBe('📡 \\%\\_ 📡');
    });
  });
});
