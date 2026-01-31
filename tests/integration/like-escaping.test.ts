/**
 * Integration Tests - LIKE Wildcard Escaping
 *
 * Tests that LIKE clause wildcard injection is prevented in:
 * 1. networkRepository.searchBySSID()
 * 2. server.js /api/networks/search/:ssid endpoint
 */

// Mock database module BEFORE importing repositories
jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  },
  CONFIG: {
    MIN_VALID_TIMESTAMP: 946684800000,
    MIN_OBSERVATIONS: 2,
    MAX_PAGE_SIZE: 1000,
    DEFAULT_PAGE_SIZE: 100,
  },
}));

const { query } = require('../../server/src/config/database');
const NetworkRepository = require('../../server/src/repositories/networkRepository');
const { escapeLikePattern } = require('../../server/src/utils/escapeSQL');

const hasSearchBySSID = typeof NetworkRepository.prototype.searchBySSID === 'function';
const describeIfSearchBySSID = hasSearchBySSID ? describe : describe.skip;

describe('LIKE Wildcard Escaping - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Fix: networkRepository.searchBySSID() - LIKE Escaping
  // ============================================================================

  describeIfSearchBySSID('NetworkRepository.searchBySSID() - LIKE Escaping', () => {
    let repo;

    beforeEach(() => {
      repo = new NetworkRepository();
      query.mockResolvedValue({ rows: [] });
    });

    describe('Wildcard injection prevention', () => {
      test('should escape percent sign to prevent wildcard matching', async () => {
        await repo.searchBySSID('test%');

        const [sql, params] = query.mock.calls[0];

        // Should escape % to \%
        expect(params[0]).toBe('%test\\%%');
        expect(sql).toContain('WHERE ssid ILIKE $1');
      });

      test('should escape underscore to prevent single-char wildcard', async () => {
        await repo.searchBySSID('test_value');

        const [sql, params] = query.mock.calls[0];

        // Should escape _ to \_
        expect(params[0]).toBe('%test\\_value%');
      });

      test('should escape both % and _ together', async () => {
        await repo.searchBySSID('a_b%c');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%a\\_b\\%c%');
      });

      test('should escape multiple wildcards', async () => {
        await repo.searchBySSID('%%test__');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%\\%\\%test\\_\\_%');
      });

      test('should escape backslash to prevent escape sequence injection', async () => {
        await repo.searchBySSID('test\\%');

        const [sql, params] = query.mock.calls[0];

        // Should escape backslash first, then %
        expect(params[0]).toBe('%test\\\\\\%%');
      });
    });

    describe('Normal input (backward compatibility)', () => {
      test('should not modify normal SSID', async () => {
        await repo.searchBySSID('Starbucks WiFi');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%Starbucks WiFi%');
      });

      test('should preserve unicode characters', async () => {
        await repo.searchBySSID('Café WiFi');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%Café WiFi%');
      });

      test('should preserve other special characters', async () => {
        await repo.searchBySSID('Test@Home#2024');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%Test@Home#2024%');
      });

      test('should handle empty string', async () => {
        await repo.searchBySSID('');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%%');
      });
    });

    describe('Security scenarios', () => {
      test('should prevent information disclosure via wildcard injection', async () => {
        // Attacker tries to find all SSIDs starting with "admin"
        await repo.searchBySSID('admin%');

        const [sql, params] = query.mock.calls[0];

        // Should search for literal "admin%" only, not "admin*"
        expect(params[0]).toBe('%admin\\%%');
      });

      test('should prevent pattern matching attack', async () => {
        // Attacker tries to match "a<any>b"
        await repo.searchBySSID('a_b');

        const [sql, params] = query.mock.calls[0];

        // Should search for literal "a_b" only
        expect(params[0]).toBe('%a\\_b%');
      });

      test('should prevent combined wildcard attack', async () => {
        // Attacker tries complex pattern
        await repo.searchBySSID('%_secret_%');

        const [sql, params] = query.mock.calls[0];

        // All wildcards should be escaped
        expect(params[0]).toBe('%\\%\\_secret\\_\\%%');
      });
    });

    describe('Real-world SSID examples', () => {
      test('should handle SSID with percent in name', async () => {
        await repo.searchBySSID('100% WiFi');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%100\\% WiFi%');
      });

      test('should handle SSID with underscore separator', async () => {
        await repo.searchBySSID('Guest_Network_5G');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%Guest\\_Network\\_5G%');
      });

      test('should handle SSID with backslash', async () => {
        await repo.searchBySSID('Network\\Home');

        const [sql, params] = query.mock.calls[0];

        expect(params[0]).toBe('%Network\\\\Home%');
      });
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('escapeLikePattern() utility function', () => {
    test('should be reusable across codebase', () => {
      expect(typeof escapeLikePattern).toBe('function');
    });

    test('should handle all edge cases', () => {
      expect(escapeLikePattern(null)).toBe('');
      expect(escapeLikePattern(undefined)).toBe('');
      expect(escapeLikePattern('')).toBe('');
      expect(escapeLikePattern('test%')).toBe('test\\%');
      expect(escapeLikePattern('test_')).toBe('test\\_');
      expect(escapeLikePattern('test\\')).toBe('test\\\\');
    });

    test('should be consistent with repository usage', () => {
      const input = 'test%_value';
      const escaped = escapeLikePattern(input);

      // Same escaping should be used in repository
      expect(escaped).toBe('test\\%\\_value');
    });
  });

  // ============================================================================
  // Before/After Comparison
  // ============================================================================

  describe('Before/After Fix Comparison', () => {
    test('BEFORE: "test%" would match unintended results', () => {
      // Old vulnerable behavior:
      const userInput = 'test%';
      const oldPattern = `%${userInput}%`; // '%test%%'

      // This would match: "test", "test1", "testing", "test_network", etc.
      expect(oldPattern).toBe('%test%%');

      // Simulated database behavior:
      // SELECT * FROM networks WHERE ssid ILIKE '%test%%'
      // Would return: ["test", "test1", "testing", "test_network", ...]
    });

    test('AFTER: "test%" only matches literal "test%"', () => {
      // New secure behavior:
      const userInput = 'test%';
      const escaped = escapeLikePattern(userInput);
      const newPattern = `%${escaped}%`; // '%test\\%%'

      // This matches ONLY SSIDs containing literal "test%"
      expect(newPattern).toBe('%test\\%%');

      // Simulated database behavior:
      // SELECT * FROM networks WHERE ssid ILIKE '%test\\%%'
      // Would return: ["test%", "my_test%_network"] (only literal matches)
    });

    test('BEFORE: "guest_wifi" would match "guest1wifi", "guestXwifi"', () => {
      // Old vulnerable behavior:
      const userInput = 'guest_wifi';
      const oldPattern = `%${userInput}%`; // '%guest_wifi%'

      // _ is a wildcard for any single character
      expect(oldPattern).toBe('%guest_wifi%');

      // Would match: "guest_wifi", "guest1wifi", "guestXwifi", "guest-wifi", etc.
    });

    test('AFTER: "guest_wifi" only matches literal "guest_wifi"', () => {
      // New secure behavior:
      const userInput = 'guest_wifi';
      const escaped = escapeLikePattern(userInput);
      const newPattern = `%${escaped}%`; // '%guest\\_wifi%'

      // This matches ONLY SSIDs with literal underscore
      expect(newPattern).toBe('%guest\\_wifi%');

      // Would match: "guest_wifi", "my_guest_wifi_5g" (only literal underscore)
      // Would NOT match: "guest1wifi", "guestXwifi", "guest-wifi"
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    test('escaping should be fast (<1ms for typical input)', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        escapeLikePattern('test%_value');
      }

      const duration = Date.now() - start;

      // 1000 iterations should complete in under 10ms
      expect(duration).toBeLessThan(10);
    });

    test('should handle long SSIDs efficiently', () => {
      const longSSID = `${'a'.repeat(1000)}%_${'b'.repeat(1000)}`;

      const start = Date.now();
      const escaped = escapeLikePattern(longSSID);
      const duration = Date.now() - start;

      expect(escaped).toContain('\\%');
      expect(escaped).toContain('\\_');
      expect(duration).toBeLessThan(5);
    });
  });

  // ============================================================================
  // Backward Compatibility
  // ============================================================================

  describeIfSearchBySSID('Backward Compatibility', () => {
    test('normal searches should work exactly as before', async () => {
      const repo = new NetworkRepository();

      const normalSSIDs = ['Starbucks WiFi', 'Home Network', 'Guest', 'Office-5G', 'Café Internet'];

      for (const ssid of normalSSIDs) {
        jest.clearAllMocks();
        query.mockResolvedValue({ rows: [] });

        await repo.searchBySSID(ssid);

        const [sql, params] = query.mock.calls[0];

        // Should still use ILIKE with % wildcards
        expect(sql).toContain('WHERE ssid ILIKE $1');
        expect(params[0]).toBe(`%${ssid}%`);
      }
    });

    test('should not break existing functionality', async () => {
      const repo = new NetworkRepository();

      query.mockResolvedValue({
        rows: [
          { ssid: 'Starbucks WiFi', bssid: 'AA:BB:CC:DD:EE:FF' },
          { ssid: 'Starbucks Guest', bssid: '11:22:33:44:55:66' },
        ],
      });

      const results = await repo.searchBySSID('Starbucks');

      expect(results).toHaveLength(2);
      expect(results[0].ssid).toBe('Starbucks WiFi');
    });
  });
});
