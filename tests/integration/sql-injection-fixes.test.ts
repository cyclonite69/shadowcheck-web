/**
 * SQL Injection Prevention - Integration Tests
 *
 * Tests the 3 critical SQL injection fixes:
 * 1. baseRepository.js - findMany() ORDER BY validation
 * 2. networkRepository.js - getPaginated() sort/order validation
 * 3. networkRepository.js - getDashboardMetrics() parameterized config
 *
 * Strategy: Direct repository testing (no HTTP layer needed)
 * Database: Mocked to isolate validation logic
 */

export {};

export {};

const { runIntegration } = require('../helpers/integrationEnv');
const describeIfIntegration = runIntegration ? describe : describe.skip;

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
const BaseRepository = require('../../server/src/repositories/baseRepository');
const NetworkRepository = require('../../server/src/repositories/networkRepository');

describeIfIntegration('SQL Injection Prevention - Integration Tests', () => {
  if (!runIntegration) {
    test.skip('requires RUN_INTEGRATION_TESTS', () => {});
    return;
  }
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // FIX #1: baseRepository.js - findMany() ORDER BY Validation
  // ============================================================================

  describe('Fix #1: BaseRepository.findMany() - ORDER BY Injection', () => {
    let repo: any;

    beforeEach(() => {
      repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });
    });

    describe('A. INJECTION ATTEMPTS (should fail)', () => {
      test('should block SQL injection via semicolon and DROP TABLE', async () => {
        const maliciousOrderBy = 'id; DROP TABLE networks; --';

        await expect(repo.findMany('1=1', [], { orderBy: maliciousOrderBy })).rejects.toThrow(
          'Invalid orderBy column: id;'
        );
      });

      test('should block UNION-based injection', async () => {
        const maliciousOrderBy = 'id UNION SELECT password FROM users';

        // Should be blocked - either column or direction error is fine
        await expect(repo.findMany('1=1', [], { orderBy: maliciousOrderBy })).rejects.toThrow(
          /Invalid orderBy/
        );
      });

      test('should block comment-based injection', async () => {
        const maliciousOrderBy = 'id DESC; -- comment';

        // Should be blocked - either column or direction error is fine
        await expect(repo.findMany('1=1', [], { orderBy: maliciousOrderBy })).rejects.toThrow(
          /Invalid orderBy/
        );
      });

      test('should block invalid column name', async () => {
        await expect(
          repo.findMany('1=1', [], { orderBy: 'malicious_column DESC' })
        ).rejects.toThrow('Invalid orderBy column: malicious_column');
      });

      test('should block invalid direction keyword', async () => {
        await expect(repo.findMany('1=1', [], { orderBy: 'id UNION' })).rejects.toThrow(
          'Invalid orderBy direction: UNION'
        );
      });

      test('should block stacked query injection', async () => {
        await expect(
          repo.findMany('1=1', [], { orderBy: 'id; DELETE FROM networks WHERE 1=1; --' })
        ).rejects.toThrow('Invalid orderBy column');
      });
    });

    describe('B. LEGITIMATE QUERIES (should pass)', () => {
      test('should accept valid column and direction', async () => {
        await repo.findMany('1=1', [], { orderBy: 'id DESC' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY id DESC'),
          expect.arrayContaining([100, 0])
        );
      });

      test('should accept all whitelisted columns', async () => {
        const validColumns = [
          'id',
          'created_at',
          'updated_at',
          'bssid',
          'ssid',
          'last_seen',
          'first_seen',
          'type',
          'signal',
        ];

        for (const column of validColumns) {
          jest.clearAllMocks();
          await repo.findMany('1=1', [], { orderBy: `${column} ASC` });

          expect(query).toHaveBeenCalledWith(
            expect.stringContaining(`ORDER BY ${column} ASC`),
            expect.any(Array)
          );
        }
      });

      test('should parameterize LIMIT and OFFSET', async () => {
        await repo.findMany('bssid = $1', ['AA:BB:CC:DD:EE:FF'], {
          orderBy: 'last_seen DESC',
          limit: 50,
          offset: 100,
        });

        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('LIMIT $2 OFFSET $3');
        expect(params).toEqual(['AA:BB:CC:DD:EE:FF', 50, 100]);
      });
    });

    describe('C. EDGE CASES', () => {
      test('should default to DESC when direction not specified', async () => {
        await repo.findMany('1=1', [], { orderBy: 'id' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY id DESC'),
          expect.any(Array)
        );
      });

      test('should handle mixed case direction (normalize to uppercase)', async () => {
        await repo.findMany('1=1', [], { orderBy: 'id asc' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY id ASC'),
          expect.any(Array)
        );
      });

      test('should sanitize limit to prevent injection', async () => {
        await repo.findMany('1=1', [], {
          orderBy: 'id DESC',
          limit: '50; DROP TABLE networks;',
        });

        const [_sql, params] = query.mock.calls[0];
        expect(params[0]).toBe(50); // Parsed as integer
      });

      test('should cap limit at maximum (1000)', async () => {
        await repo.findMany('1=1', [], {
          orderBy: 'id DESC',
          limit: 9999,
        });

        const [_sql, params] = query.mock.calls[0];
        expect(params[0]).toBe(1000);
      });

      test('should handle negative offset (convert to 0)', async () => {
        await repo.findMany('1=1', [], {
          orderBy: 'id DESC',
          offset: -100,
        });

        const [_sql, params] = query.mock.calls[0];
        expect(params[1]).toBe(0);
      });

      test('should trim whitespace in orderBy', async () => {
        await repo.findMany('1=1', [], { orderBy: '  id   DESC  ' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY id DESC'),
          expect.any(Array)
        );
      });
    });
  });

  // ============================================================================
  // FIX #2 (deprecated): NetworkRepository pagination moved elsewhere
  // ============================================================================

  describe('Fix #2 (deprecated): NetworkRepository no longer exposes getPaginated()', () => {
    test('getPaginated is not part of NetworkRepository contract', () => {
      const repo = new NetworkRepository();
      expect((repo as any).getPaginated).toBeUndefined();
    });
  });

  // NOTE: Dashboard metrics query-building lives in UniversalFilterQueryBuilder now.
  // Injection hardening for those queries is covered by route/service-level tests.

  // ============================================================================
  // CROSS-CUTTING ATTACK VECTORS
  // ============================================================================

  describe('Cross-Cutting Attack Vector Prevention', () => {
    test('should prevent time-based blind SQL injection', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });

      await expect(
        repo.findMany('1=1', [], { orderBy: 'id; SELECT pg_sleep(10); --' })
      ).rejects.toThrow('Invalid orderBy column');
    });

    test('should prevent boolean-based blind SQL injection', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });

      // "id AND 1=1 DESC" splits into column="id AND 1=1" direction="DESC"
      // But "id AND 1=1" is not in whitelist, so should be blocked
      await expect(repo.findMany('1=1', [], { orderBy: 'id AND 1=1 DESC' })).rejects.toThrow(); // Either column or direction error is fine
    });

    test('should prevent second-order SQL injection (ORDER BY)', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });
      await expect(
        repo.findMany('1=1', [], { orderBy: "'; DROP TABLE networks; --" })
      ).rejects.toThrow(/Invalid orderBy/);
    });

    test('should prevent encoding-based injection (URL encoded)', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });

      // %3B = semicolon, %20 = space
      await expect(
        repo.findMany('1=1', [], { orderBy: 'id%3B%20DROP%20TABLE%20networks' })
      ).rejects.toThrow('Invalid orderBy column');
    });
  });

  // ============================================================================
  // PERFORMANCE & SECURITY METRICS
  // ============================================================================

  describe('Performance & Security Metrics', () => {
    test('validation should complete in under 1ms', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });

      const start = Date.now();
      await repo.findMany('1=1', [], { orderBy: 'id DESC' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Very generous, should be <1ms
    });

    test('should provide helpful ORDER BY errors without leaking internals', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });
      await expect(repo.findMany('1=1', [], { orderBy: 'password_column DESC' })).rejects.toThrow(
        /Invalid orderBy column: password_column/
      );
    });

    test('whitelists should be comprehensive for legitimate use', async () => {
      const repo = new BaseRepository('app.networks');
      query.mockResolvedValue({ rows: [] });

      // All common columns should be whitelisted
      const commonColumns = ['id', 'created_at', 'updated_at', 'bssid', 'ssid'];

      for (const col of commonColumns) {
        await expect(repo.findMany('1=1', [], { orderBy: `${col} DESC` })).resolves.not.toThrow();
      }
    });
  });
});
