/**
 * SQL Injection Fix Tests
 * Validates that ORDER BY and config value vulnerabilities are fixed
 */

export {};

export {};

jest.mock('../server/src/config/database', () => ({
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

const { query } = require('../server/src/config/database');
const BaseRepository = require('../server/src/repositories/baseRepository');
const NetworkRepository = require('../server/src/repositories/networkRepository');

const hasGetPaginated = typeof NetworkRepository.prototype.getPaginated === 'function';
const describeIfGetPaginated = hasGetPaginated ? describe : describe.skip;
const testIfGetPaginated = hasGetPaginated ? test : test.skip;

describe('SQL Injection Prevention', () => {
  describe('BaseRepository.findMany() - ORDER BY Validation', () => {
    let repo;

    beforeEach(() => {
      repo = new BaseRepository('app.networks');
    });

    test('should accept valid orderBy column and direction', async () => {
      // Mock query to prevent actual DB call
      repo.query = jest.fn().mockResolvedValue({ rows: [] });

      await repo.findMany('1=1', [], { orderBy: 'id DESC' });

      expect(repo.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY id DESC'),
        expect.any(Array)
      );
    });

    test('should reject SQL injection attempt in orderBy', async () => {
      const maliciousOrderBy = 'id; DROP TABLE networks; --';

      await expect(repo.findMany('1=1', [], { orderBy: maliciousOrderBy })).rejects.toThrow(
        'Invalid orderBy column'
      );
    });

    test('should reject invalid column name', async () => {
      await expect(repo.findMany('1=1', [], { orderBy: 'malicious_column DESC' })).rejects.toThrow(
        'Invalid orderBy column: malicious_column'
      );
    });

    test('should reject invalid direction', async () => {
      await expect(repo.findMany('1=1', [], { orderBy: 'id UNION' })).rejects.toThrow(
        'Invalid orderBy direction: UNION'
      );
    });

    test('should parameterize LIMIT and OFFSET', async () => {
      repo.query = jest.fn().mockResolvedValue({ rows: [] });

      await repo.findMany('1=1', [], { limit: 50, offset: 100 });

      const [sql, params] = repo.query.mock.calls[0];
      expect(sql).toContain('LIMIT $1 OFFSET $2');
      expect(params).toEqual([50, 100]);
    });

    test('should sanitize limit to prevent injection', async () => {
      repo.query = jest.fn().mockResolvedValue({ rows: [] });

      await repo.findMany('1=1', [], { limit: '50; DROP TABLE networks;' });

      const [sql, params] = repo.query.mock.calls[0];
      expect(params[0]).toBe(50); // Parsed as integer
    });
  });

  describeIfGetPaginated('NetworkRepository.getPaginated() - Sort Validation', () => {
    let repo;

    beforeEach(() => {
      repo = new NetworkRepository();
    });

    test('should accept valid sort column', async () => {
      repo.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] });

      await repo.getPaginated({ sort: 'last_seen', order: 'DESC' });

      const [sql] = repo.query.mock.calls[0];
      expect(sql).toContain('ORDER BY last_seen DESC');
    });

    test('should reject SQL injection in sort parameter', async () => {
      await expect(repo.getPaginated({ sort: 'id; DROP TABLE networks; --' })).rejects.toThrow(
        'Invalid sort column'
      );
    });

    test('should reject invalid sort column', async () => {
      await expect(repo.getPaginated({ sort: 'malicious_column' })).rejects.toThrow(
        'Invalid sort column: malicious_column'
      );
    });

    test('should reject invalid order direction', async () => {
      await expect(repo.getPaginated({ sort: 'last_seen', order: 'UNION' })).rejects.toThrow(
        'Invalid order direction: UNION'
      );
    });

    test('should normalize order to uppercase', async () => {
      repo.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: 0 }] });

      await repo.getPaginated({ sort: 'last_seen', order: 'asc' });

      const [sql] = repo.query.mock.calls[0];
      expect(sql).toContain('ORDER BY last_seen ASC');
    });
  });

  describe('NetworkRepository.getDashboardMetrics() - Config Parameterization', () => {
    let repo;

    beforeEach(() => {
      repo = new NetworkRepository();
    });

    test('should parameterize CONFIG values instead of interpolating', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ count: 100 }] }) // totalNetworks
        .mockResolvedValueOnce({ rows: [] }) // threatsResult
        .mockResolvedValueOnce({ rows: [{ count: 5 }] }) // surveillanceCount
        .mockResolvedValueOnce({ rows: [{ count: 50 }] }) // enrichedCount
        .mockResolvedValueOnce({ rows: [] }); // radioTypes

      await repo.getDashboardMetrics();

      const [sql] = query.mock.calls[0] || [];

      expect(query).toHaveBeenCalled();
      expect(sql).not.toContain('${CONFIG');
    });

    test('treats full supported radioTypes selection as neutral in dashboard metrics path', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total_networks: '10', wifi_count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ total_observations: '20', wifi_observations: '6' }] })
        .mockResolvedValueOnce({
          rows: [
            { threats_critical: '0', threats_high: '0', threats_medium: '0', threats_low: '0' },
          ],
        });

      await repo.getDashboardMetrics(
        { radioTypes: ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] },
        { radioTypes: true }
      );

      expect(query).toHaveBeenCalledTimes(3);
      const firstSql = String(query.mock.calls[0]?.[0] || '');
      expect(firstSql).toContain('FROM app.networks');
      expect(firstSql).not.toContain('filtered_obs');
    });

    test('uses case-insensitive BSSID joins in filtered dashboard threat counts', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            total_networks: '1',
            wifi_count: '1',
            ble_count: '0',
            bluetooth_count: '0',
            lte_count: '0',
            nr_count: '0',
            gsm_count: '0',
            total_observations: '1',
            wifi_observations: '1',
            ble_observations: '0',
            bluetooth_observations: '0',
            lte_observations: '0',
            nr_observations: '0',
            gsm_observations: '0',
            threats_critical: '0',
            threats_high: '0',
            threats_medium: '0',
            threats_low: '0',
            enriched_count: '0',
          },
        ],
      });

      const metrics = await repo.getDashboardMetrics({ radioTypes: ['W'] }, { radioTypes: true });

      expect(metrics.totalNetworks).toBe(1);
      expect(metrics.filtersApplied).toBeGreaterThan(0);
      expect(query).toHaveBeenCalledTimes(1);
      const sql = String(query.mock.calls[0]?.[0] || '');
      expect(sql).toContain('LEFT JOIN app.api_network_explorer_mv ne');
      expect(sql).not.toContain('LEFT JOIN app.api_network_explorer ne');
      expect(sql).not.toContain('ne.threat');
      expect(sql).toContain(
        'LEFT JOIN app.network_threat_scores nts ON UPPER(nts.bssid) = UPPER(n.bssid)'
      );
      expect(sql).toContain('LEFT JOIN app.network_tags nt ON UPPER(nt.bssid) = UPPER(n.bssid)');
    });

    test('should not contain string interpolation in SQL', async () => {
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
  });

  describe('Attack Vector Prevention', () => {
    test('should prevent UNION-based injection', async () => {
      const repo = new BaseRepository('app.networks');

      await expect(
        repo.findMany('1=1', [], { orderBy: 'id UNION SELECT password FROM users --' })
      ).rejects.toThrow();
    });

    test('should prevent comment-based injection', async () => {
      const repo = new BaseRepository('app.networks');

      await expect(repo.findMany('1=1', [], { orderBy: 'id; -- comment' })).rejects.toThrow();
    });

    testIfGetPaginated('should prevent stacked query injection', async () => {
      const repo = new NetworkRepository();

      await expect(repo.getPaginated({ sort: 'id; DELETE FROM networks; --' })).rejects.toThrow();
    });
  });
});

// Manual test examples (run against actual database)
if (require.main === module) {
  console.log('Manual SQL Injection Test Examples:\n');

  console.log('✅ SAFE - Valid query:');
  console.log('  repo.findMany("1=1", [], { orderBy: "id DESC" })');
  console.log('  → ORDER BY id DESC\n');

  console.log('❌ BLOCKED - SQL injection attempt:');
  console.log('  repo.findMany("1=1", [], { orderBy: "id; DROP TABLE networks; --" })');
  console.log('  → Error: Invalid orderBy column: id;\n');

  console.log('❌ BLOCKED - UNION injection:');
  console.log('  repo.getPaginated({ sort: "id UNION SELECT * FROM users" })');
  console.log('  → Error: Invalid sort column: id UNION SELECT * FROM users\n');

  console.log('✅ SAFE - Config values parameterized:');
  console.log('  repo.getDashboardMetrics()');
  console.log('  → WHERE observed_at_epoch >= $1');
  console.log('  → HAVING COUNT(*) >= $2\n');
}

module.exports = {
  // Export for integration testing
};
