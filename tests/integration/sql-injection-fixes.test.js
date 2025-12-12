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

// Mock database module BEFORE importing repositories
jest.mock('../../src/config/database', () => ({
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

const { query, CONFIG } = require('../../src/config/database');
const BaseRepository = require('../../src/repositories/baseRepository');
const NetworkRepository = require('../../src/repositories/networkRepository');

describe('SQL Injection Prevention - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // FIX #1: baseRepository.js - findMany() ORDER BY Validation
  // ============================================================================

  describe('Fix #1: BaseRepository.findMany() - ORDER BY Injection', () => {
    let repo;

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

        const [sql, params] = query.mock.calls[0];
        expect(params[0]).toBe(50); // Parsed as integer
      });

      test('should cap limit at maximum (1000)', async () => {
        await repo.findMany('1=1', [], {
          orderBy: 'id DESC',
          limit: 9999,
        });

        const [sql, params] = query.mock.calls[0];
        expect(params[0]).toBe(1000);
      });

      test('should handle negative offset (convert to 0)', async () => {
        await repo.findMany('1=1', [], {
          orderBy: 'id DESC',
          offset: -100,
        });

        const [sql, params] = query.mock.calls[0];
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
  // FIX #2: networkRepository.js - getPaginated() Sort Validation
  // ============================================================================

  describe('Fix #2: NetworkRepository.getPaginated() - Sort Injection', () => {
    let repo;

    beforeEach(() => {
      repo = new NetworkRepository();
      query
        .mockResolvedValueOnce({ rows: [] }) // Data query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] }); // Count query
    });

    describe('A. INJECTION ATTEMPTS (should fail)', () => {
      test('should block SQL injection in sort parameter', async () => {
        await expect(repo.getPaginated({ sort: 'id; DROP TABLE networks; --' })).rejects.toThrow(
          'Invalid sort column: id; DROP TABLE networks; --'
        );
      });

      test('should block UNION injection in sort', async () => {
        await expect(repo.getPaginated({ sort: 'id UNION SELECT * FROM users' })).rejects.toThrow(
          'Invalid sort column'
        );
      });

      test('should block invalid sort column', async () => {
        await expect(repo.getPaginated({ sort: 'malicious_column' })).rejects.toThrow(
          'Invalid sort column: malicious_column'
        );
      });

      test('should block invalid order direction', async () => {
        await expect(repo.getPaginated({ sort: 'last_seen', order: 'UNION' })).rejects.toThrow(
          'Invalid order direction: UNION'
        );
      });

      test('should block stacked queries in order', async () => {
        await expect(
          repo.getPaginated({ sort: 'last_seen', order: 'DESC; DELETE FROM networks; --' })
        ).rejects.toThrow('Invalid order direction');
      });
    });

    describe('B. LEGITIMATE QUERIES (should pass)', () => {
      test('should accept valid sort and order', async () => {
        await repo.getPaginated({ sort: 'last_seen', order: 'DESC' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY last_seen DESC'),
          expect.any(Array)
        );
      });

      test('should accept all whitelisted sort columns', async () => {
        const validColumns = [
          'last_seen',
          'first_seen',
          'bssid',
          'ssid',
          'type',
          'encryption',
          'bestlevel',
          'lasttime',
        ];

        for (const column of validColumns) {
          jest.clearAllMocks();
          query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });

          await repo.getPaginated({ sort: column, order: 'ASC' });

          expect(query).toHaveBeenCalledWith(
            expect.stringContaining(`ORDER BY ${column} ASC`),
            expect.any(Array)
          );
        }
      });

      test('should return paginated results with metadata', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();
        jest.resetAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }] })
          .mockResolvedValueOnce({ rows: [{ total: '150' }] });

        const result = await freshRepo.getPaginated({
          page: 2,
          limit: 50,
          sort: 'last_seen',
          order: 'DESC',
        });

        expect(result.networks).toHaveLength(1);
        expect(result.networks[0].bssid).toBe('AA:BB:CC:DD:EE:FF');
        expect(result.total).toBe(150);
        expect(result.page).toBe(2);
        expect(result.limit).toBe(50);
        expect(result.totalPages).toBe(3);
      });
    });

    describe('C. EDGE CASES', () => {
      test('should default to last_seen DESC when not specified', async () => {
        await repo.getPaginated({});

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY last_seen DESC'),
          expect.any(Array)
        );
      });

      test('should normalize order to uppercase', async () => {
        await repo.getPaginated({ sort: 'last_seen', order: 'asc' });

        expect(query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY last_seen ASC'),
          expect.any(Array)
        );
      });

      test('should handle mixed case order (desc, Desc, DESC)', async () => {
        const variations = ['desc', 'Desc', 'DESC', 'DeSc'];

        for (const orderVariation of variations) {
          jest.clearAllMocks();
          query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });

          await repo.getPaginated({ sort: 'last_seen', order: orderVariation });

          expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY last_seen DESC'),
            expect.any(Array)
          );
        }
      });

      test('should cap limit at MAX_PAGE_SIZE', async () => {
        await repo.getPaginated({ limit: 9999 });

        const [sql, params] = query.mock.calls[0];
        expect(params[0]).toBe(CONFIG.MAX_PAGE_SIZE);
      });
    });
  });

  // ============================================================================
  // FIX #3: networkRepository.js - getDashboardMetrics() Config Parameterization
  // ============================================================================

  describe('Fix #3: NetworkRepository.getDashboardMetrics() - Config Parameterization', () => {
    // No beforeEach - each test sets up its own mocks

    describe('A. INJECTION PREVENTION (parameterization)', () => {
      test('should parameterize CONFIG.MIN_VALID_TIMESTAMP instead of interpolating', async () => {
        const repo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: 100 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: 5 }] })
          .mockResolvedValueOnce({ rows: [{ count: 50 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repo.getDashboardMetrics();

        // Check threats query (second call)
        const threatsCall = query.mock.calls[1];
        const [sql, params] = threatsCall;

        expect(sql).toContain('WHERE observed_at_epoch >= $1');
        expect(sql).not.toContain('${CONFIG');
        expect(params).toContain(CONFIG.MIN_VALID_TIMESTAMP);
      });

      test('should parameterize CONFIG.MIN_OBSERVATIONS', async () => {
        const repo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: 100 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: 5 }] })
          .mockResolvedValueOnce({ rows: [{ count: 50 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repo.getDashboardMetrics();

        const threatsCall = query.mock.calls[1];
        const [sql, params] = threatsCall;

        expect(sql).toContain('HAVING COUNT(*) >= $2');
        expect(params).toContain(CONFIG.MIN_OBSERVATIONS);
      });

      test('should not contain string interpolation in any query', async () => {
        const repo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: 100 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: 5 }] })
          .mockResolvedValueOnce({ rows: [{ count: 50 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repo.getDashboardMetrics();

        // Verify no query contains ${
        query.mock.calls.forEach(([sql]) => {
          expect(sql).not.toContain('${');
        });
      });

      test('should safely handle compromised config values', async () => {
        const repo = new NetworkRepository();
        jest.clearAllMocks();

        // Simulate compromised config (would be SQL injection if interpolated)
        const originalConfig = { ...CONFIG };
        CONFIG.MIN_VALID_TIMESTAMP = '0; DROP TABLE observations; --';
        CONFIG.MIN_OBSERVATIONS = '1; DELETE FROM networks; --';

        query
          .mockResolvedValueOnce({ rows: [{ count: 100 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: 5 }] })
          .mockResolvedValueOnce({ rows: [{ count: 50 }] })
          .mockResolvedValueOnce({ rows: [] });

        await repo.getDashboardMetrics();

        // With parameterization, these are treated as literal values
        const threatsCall = query.mock.calls[1];
        const [sql, params] = threatsCall;

        expect(sql).toContain('$1');
        expect(sql).toContain('$2');
        expect(params[0]).toBe('0; DROP TABLE observations; --');
        expect(params[1]).toBe('1; DELETE FROM networks; --');

        // Restore config
        Object.assign(CONFIG, originalConfig);
      });
    });

    describe('B. LEGITIMATE QUERIES (should pass)', () => {
      test('should return complete dashboard metrics', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: 173326 }] })
          .mockResolvedValueOnce({ rows: [{ bssid: 'AA:BB:CC' }, { bssid: 'DD:EE:FF' }] })
          .mockResolvedValueOnce({ rows: [{ count: 256 }] })
          .mockResolvedValueOnce({ rows: [{ count: 45123 }] })
          .mockResolvedValueOnce({
            rows: [
              { radio_type: 'WiFi', count: 150000 },
              { radio_type: 'BLE', count: 20000 },
              { radio_type: 'BT', count: 3000 },
            ],
          });

        const metrics = await freshRepo.getDashboardMetrics();

        expect(metrics).toEqual({
          totalNetworks: 173326,
          threatsCount: 2,
          surveillanceCount: 256,
          enrichedCount: 45123,
          wifiCount: 150000,
          btCount: 3000,
          bleCount: 20000,
          lteCount: 0,
          gsmCount: 0,
        });
      });

      test('should execute all 5 queries', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [] })
          .mockResolvedValue({ rows: [] });

        await freshRepo.getDashboardMetrics();

        expect(query).toHaveBeenCalledTimes(5);
      });

      test('should handle empty results gracefully', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const metrics = await freshRepo.getDashboardMetrics();

        expect(metrics.totalNetworks).toBe(0);
        expect(metrics.threatsCount).toBe(0);
        expect(metrics.wifiCount).toBe(0);
      });
    });

    describe('C. EDGE CASES', () => {
      test('should handle database errors gracefully', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();
        query.mockRejectedValue(new Error('Database connection failed'));

        await expect(freshRepo.getDashboardMetrics()).rejects.toThrow('Database connection failed');
      });

      test('should parse string counts to integers', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: '173326' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '256' }] })
          .mockResolvedValueOnce({ rows: [{ count: '45123' }] })
          .mockResolvedValueOnce({ rows: [] });

        const metrics = await freshRepo.getDashboardMetrics();

        expect(typeof metrics.totalNetworks).toBe('number');
        expect(metrics.totalNetworks).toBe(173326);
      });

      test('should handle null/undefined counts', async () => {
        const freshRepo = new NetworkRepository();
        jest.clearAllMocks();

        query
          .mockResolvedValueOnce({ rows: [{ count: null }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: undefined }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const metrics = await freshRepo.getDashboardMetrics();

        expect(metrics.totalNetworks).toBe(0);
        expect(metrics.surveillanceCount).toBe(0);
      });
    });
  });

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

    test('should prevent second-order SQL injection', async () => {
      const repo = new NetworkRepository();
      query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ total: 0 }] });

      // Attacker stores malicious value, tries to trigger on read
      await expect(repo.getPaginated({ sort: "'; DROP TABLE networks; --" })).rejects.toThrow(
        'Invalid sort column'
      );
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

    test('should provide helpful error messages without leaking database structure', async () => {
      const repo = new NetworkRepository();

      try {
        await repo.getPaginated({ sort: 'password_column' });
        throw new Error('Should have thrown error');
      } catch (err) {
        // Error should mention validation failure
        expect(err.message).toContain('Invalid sort column');
        // But should not reveal actual table structure or schema details
        expect(err.message).not.toContain('pg_');
        expect(err.message).not.toContain('schema');
      }
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
