export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  CONFIG: {
    MIN_VALID_TIMESTAMP: 946684800000,
    MIN_OBSERVATIONS: 2,
    MAX_PAGE_SIZE: 1000,
    DEFAULT_PAGE_SIZE: 100,
  },
}));

jest.mock('../../../server/src/logging/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Re-require fresh module per test to reset module-level cache state
let svc: ReturnType<typeof loadSvc>;
function loadSvc() {
  jest.resetModules();
  jest.mock('../../../server/src/config/database', () => ({
    query: jest.fn(),
  }));
  jest.mock('../../../server/src/logging/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }));
  return require('../../../server/src/services/featureFlagService');
}

describe('featureFlagService', () => {
  beforeEach(() => {
    svc = loadSvc();
  });

  describe('getFlag', () => {
    test('returns default value before cache is loaded', () => {
      // dedupe_on_scan default is true
      expect(svc.getFlag('dedupe_on_scan')).toBe(true);
    });

    test('returns default false for score_debug_logging', () => {
      expect(svc.getFlag('score_debug_logging')).toBe(false);
    });

    test('returns default true for auto_geocode_on_import', () => {
      expect(svc.getFlag('auto_geocode_on_import')).toBe(true);
    });
  });

  describe('getAllFlags', () => {
    test('returns object with all known keys before cache load', () => {
      const flags = svc.getAllFlags();
      expect(flags).toHaveProperty('dedupe_on_scan');
      expect(flags).toHaveProperty('score_debug_logging');
      expect(flags).toHaveProperty('auto_geocode_on_import');
      expect(flags).toHaveProperty('admin_allow_docker');
      expect(flags).toHaveProperty('enable_background_jobs');
    });

    test('returns a copy — mutations do not affect internal cache', () => {
      const flags = svc.getAllFlags();
      flags.dedupe_on_scan = false;
      expect(svc.getAllFlags().dedupe_on_scan).toBe(true);
    });
  });

  describe('isDbBackedFlagKey', () => {
    test('returns true for known keys', () => {
      expect(svc.isDbBackedFlagKey('dedupe_on_scan')).toBe(true);
      expect(svc.isDbBackedFlagKey('admin_allow_docker')).toBe(true);
      expect(svc.isDbBackedFlagKey('enable_background_jobs')).toBe(true);
    });

    test('returns false for unknown keys', () => {
      expect(svc.isDbBackedFlagKey('not_a_real_flag')).toBe(false);
      expect(svc.isDbBackedFlagKey('')).toBe(false);
    });
  });

  describe('DB_BACKED_FLAG_KEYS', () => {
    test('is an array of strings', () => {
      expect(Array.isArray(svc.DB_BACKED_FLAG_KEYS)).toBe(true);
      expect(svc.DB_BACKED_FLAG_KEYS.length).toBeGreaterThan(0);
      svc.DB_BACKED_FLAG_KEYS.forEach((k: string) => expect(typeof k).toBe('string'));
    });
  });

  describe('refreshCache', () => {
    test('updates flag value from DB row', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'dedupe_on_scan', value: false }],
      });
      await svc.refreshCache();
      expect(svc.getFlag('dedupe_on_scan')).toBe(false);
    });

    test('handles string "true" value from DB', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'score_debug_logging', value: 'true' }],
      });
      await svc.refreshCache();
      expect(svc.getFlag('score_debug_logging')).toBe(true);
    });

    test('handles string "false" value from DB', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'auto_geocode_on_import', value: 'false' }],
      });
      await svc.refreshCache();
      expect(svc.getFlag('auto_geocode_on_import')).toBe(false);
    });

    test('handles empty rows — keeps defaults', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      await svc.refreshCache();
      expect(svc.getFlag('dedupe_on_scan')).toBe(true);
    });

    test('handles null/empty string value — falls back to default', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'dedupe_on_scan', value: null }],
      });
      await svc.refreshCache();
      // null coerces to default (true)
      expect(svc.getFlag('dedupe_on_scan')).toBe(true);
    });

    test('logs warning and keeps cache on DB error', async () => {
      const { query } = require('../../../server/src/config/database');
      const logger = require('../../../server/src/logging/logger');
      (query as jest.Mock).mockRejectedValue(new Error('DB down'));
      await svc.refreshCache(); // should not throw
      expect(logger.warn).toHaveBeenCalled();
      // defaults still accessible
      expect(svc.getFlag('dedupe_on_scan')).toBe(true);
    });

    test('returns the current flag state as an object', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await svc.refreshCache();
      expect(result).toHaveProperty('dedupe_on_scan');
    });

    test('getAllFlags reflects updated values after refresh', async () => {
      const { query } = require('../../../server/src/config/database');
      (query as jest.Mock).mockResolvedValue({
        rows: [{ key: 'score_debug_logging', value: true }],
      });
      await svc.refreshCache();
      expect(svc.getAllFlags().score_debug_logging).toBe(true);
    });
  });
});
