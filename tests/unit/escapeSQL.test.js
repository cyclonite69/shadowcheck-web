/**
 * Unit Tests for SQL Escape Utilities
 * Tests LIKE pattern escaping to prevent wildcard injection
 */

const { escapeLikePattern } = require('../../src/utils/escapeSQL');

describe('escapeLikePattern()', () => {
  describe('Normal input (no special characters)', () => {
    test('should not modify normal SSID', () => {
      expect(escapeLikePattern('Starbucks WiFi')).toBe('Starbucks WiFi');
    });

    test('should not modify alphanumeric strings', () => {
      expect(escapeLikePattern('Network123')).toBe('Network123');
    });

    test('should preserve unicode characters', () => {
      expect(escapeLikePattern('Café WiFi')).toBe('Café WiFi');
    });

    test('should preserve special characters (not wildcards)', () => {
      expect(escapeLikePattern('Test@Home#2024')).toBe('Test@Home#2024');
    });
  });

  describe('Wildcard character escaping', () => {
    test('should escape percent sign', () => {
      expect(escapeLikePattern('test%')).toBe('test\\%');
    });

    test('should escape underscore', () => {
      expect(escapeLikePattern('test_value')).toBe('test\\_value');
    });

    test('should escape both % and _', () => {
      expect(escapeLikePattern('a_b%c')).toBe('a\\_b\\%c');
    });

    test('should escape multiple percent signs', () => {
      expect(escapeLikePattern('%%test%%')).toBe('\\%\\%test\\%\\%');
    });

    test('should escape multiple underscores', () => {
      expect(escapeLikePattern('__test__')).toBe('\\_\\_test\\_\\_');
    });

    test('should escape mixed wildcards', () => {
      expect(escapeLikePattern('%_test_%')).toBe('\\%\\_test\\_\\%');
    });
  });

  describe('Backslash escaping', () => {
    test('should escape backslash', () => {
      expect(escapeLikePattern('test\\value')).toBe('test\\\\value');
    });

    test('should escape already escaped percent', () => {
      expect(escapeLikePattern('test\\%')).toBe('test\\\\\\%');
    });

    test('should escape already escaped underscore', () => {
      expect(escapeLikePattern('test\\_')).toBe('test\\\\\\_');
    });

    test('should handle multiple backslashes', () => {
      expect(escapeLikePattern('test\\\\')).toBe('test\\\\\\\\');
    });
  });

  describe('Edge cases', () => {
    test('should return empty string for null', () => {
      expect(escapeLikePattern(null)).toBe('');
    });

    test('should return empty string for undefined', () => {
      expect(escapeLikePattern(undefined)).toBe('');
    });

    test('should return empty string for empty string', () => {
      expect(escapeLikePattern('')).toBe('');
    });

    test('should handle whitespace-only string', () => {
      expect(escapeLikePattern('   ')).toBe('   ');
    });

    test('should handle single character', () => {
      expect(escapeLikePattern('%')).toBe('\\%');
      expect(escapeLikePattern('_')).toBe('\\_');
      expect(escapeLikePattern('a')).toBe('a');
    });

    test('should return empty string for non-string input', () => {
      expect(escapeLikePattern(123)).toBe('');
      expect(escapeLikePattern({})).toBe('');
      expect(escapeLikePattern([])).toBe('');
    });
  });

  describe('Real-world SSID examples', () => {
    test('should handle SSID with percent in name', () => {
      expect(escapeLikePattern('100% WiFi')).toBe('100\\% WiFi');
    });

    test('should handle SSID with underscore separator', () => {
      expect(escapeLikePattern('Guest_Network_5G')).toBe('Guest\\_Network\\_5G');
    });

    test('should handle SSID with mixed special chars', () => {
      expect(escapeLikePattern('Test_%_Network')).toBe('Test\\_\\%\\_Network');
    });

    test('should handle SSID with backslash', () => {
      expect(escapeLikePattern('Network\\Home')).toBe('Network\\\\Home');
    });
  });

  describe('Security test cases', () => {
    test('should prevent wildcard injection attack', () => {
      // Attacker tries to match any SSID starting with "test"
      const maliciousInput = 'test%';
      const escaped = escapeLikePattern(maliciousInput);

      expect(escaped).toBe('test\\%');
      // When used in LIKE: '%test\\%%' will match literal "test%" only
    });

    test('should prevent single character wildcard injection', () => {
      // Attacker tries to match any single character
      const maliciousInput = 'test_';
      const escaped = escapeLikePattern(maliciousInput);

      expect(escaped).toBe('test\\_');
      // When used in LIKE: '%test\\_%' will match literal "test_" only
    });

    test('should prevent combined wildcard injection', () => {
      // Attacker tries complex pattern matching
      const maliciousInput = '%_admin_%';
      const escaped = escapeLikePattern(maliciousInput);

      expect(escaped).toBe('\\%\\_admin\\_\\%');
      // Matches literal "%_admin_%" only, not as wildcards
    });
  });

  describe('Integration with LIKE queries', () => {
    test('should create safe LIKE pattern for normal input', () => {
      const userInput = 'Starbucks';
      const escaped = escapeLikePattern(userInput);
      const pattern = `%${escaped}%`;

      expect(pattern).toBe('%Starbucks%');
      // Matches: "Starbucks", "Starbucks WiFi", "My Starbucks"
    });

    test('should create safe LIKE pattern for wildcard input', () => {
      const userInput = 'test%';
      const escaped = escapeLikePattern(userInput);
      const pattern = `%${escaped}%`;

      expect(pattern).toBe('%test\\%%');
      // Matches only SSIDs containing literal "test%"
      // Does NOT match "test", "test1", "testing", etc.
    });

    test('should create safe LIKE pattern for underscore input', () => {
      const userInput = 'guest_wifi';
      const escaped = escapeLikePattern(userInput);
      const pattern = `%${escaped}%`;

      expect(pattern).toBe('%guest\\_wifi%');
      // Matches only "guest_wifi"
      // Does NOT match "guestXwifi", "guest1wifi", etc.
    });
  });

  describe('Before/After behavior comparison', () => {
    test('BEFORE: "test%" would match "test", "test1", "testing"', () => {
      // Old behavior (vulnerable):
      const userInput = 'test%';
      const oldPattern = `%${userInput}%`; // '%test%%'

      // This would match ANY SSID containing "test" followed by anything
      expect(oldPattern).toBe('%test%%');
    });

    test('AFTER: "test%" only matches literal "test%"', () => {
      // New behavior (secure):
      const userInput = 'test%';
      const escaped = escapeLikePattern(userInput);
      const newPattern = `%${escaped}%`; // '%test\\%%'

      // This matches ONLY SSIDs containing literal "test%"
      expect(newPattern).toBe('%test\\%%');
    });

    test('BEFORE: "a_b" would match "a1b", "a2b", "axb"', () => {
      // Old behavior (vulnerable):
      const userInput = 'a_b';
      const oldPattern = `%${userInput}%`; // '%a_b%'

      // This would match ANY SSID with "a", any char, then "b"
      expect(oldPattern).toBe('%a_b%');
    });

    test('AFTER: "a_b" only matches literal "a_b"', () => {
      // New behavior (secure):
      const userInput = 'a_b';
      const escaped = escapeLikePattern(userInput);
      const newPattern = `%${escaped}%`; // '%a\\_b%'

      // This matches ONLY SSIDs containing literal "a_b"
      expect(newPattern).toBe('%a\\_b%');
    });
  });
});
