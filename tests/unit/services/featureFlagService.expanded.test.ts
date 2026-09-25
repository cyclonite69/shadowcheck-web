export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

// Re-require fresh module per test to reset module-level cache state
let featureFlagService: any;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  // Re-require after reset so cacheLoaded resets to false
  jest.mock('../../../server/src/config/database', () => ({ query: jest.fn() }));
  jest.mock('../../../server/src/logging/logger', () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }));
  featureFlagService = require('../../../server/src/services/featureFlagService');
});

describe('featureFlagService', () => {
  describe('getFlag', () => {
    test('returns default value before cache is loaded', () => {
      // admin_allow_ml_training defaults to true (env ?? 'true')
      expect(featureFlagService.getFlag('admin_allow_ml_training')).toBe(true);
    });

    test('returns false for flags that default to false', () => {
      expect(featureFlagService.getFlag('enable_background_jobs')).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    test('returns all flag keys before cache load', () => {
      const flags = featureFlagService.getAllFlags();
      expect(flags).toHaveProperty('admin_allow_docker');
      expect(flags).toHaveProperty('admin_allow_ml_training');
      expect(flags).toHaveProperty('enable_background_jobs');
      expect(flags).toHaveProperty('badge_studio');
      expect(flags).toHaveProperty('simple_rule_scoring_enabled');
      expect(flags).toHaveProperty('auto_geocode_on_import');
      expect(flags).toHaveProperty('dedupe_on_scan');
    });

    test('auto_geocode_on_import defaults to true', () => {
      expect(featureFlagService.getAllFlags().auto_geocode_on_import).toBe(true);
    });
  });

  describe('isDbBackedFlagKey', () => {
    test('returns true for valid flag keys', () => {
      expect(featureFlagService.isDbBackedFlagKey('enable_background_jobs')).toBe(true);
      expect(featureFlagService.isDbBackedFlagKey('admin_allow_docker')).toBe(true);
      expect(featureFlagService.isDbBackedFlagKey('badge_studio')).toBe(true);
    });

    test('returns false for unknown keys', () => {
      expect(featureFlagService.isDbBackedFlagKey('not_a_real_flag')).toBe(false);
      expect(featureFlagService.isDbBackedFlagKey('')).toBe(false);
    });
  });

  describe('refreshCache', () => {
    test('loads DB values into cache and returns them', async () => {
      const { query: mockQuery } = require('../../../server/src/config/database');
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'enable_background_jobs', value: 'true' },
          { key: 'badge_studio', value: 'true' },
          { key: 'admin_allow_docker', value: 'false' },
          { key: 'auto_geocode_on_import', value: 'false' },
        ],
      });

      const result = await featureFlagService.refreshCache();

      expect(result.enable_background_jobs).toBe(true);
      expect(result.badge_studio).toBe(true);
      expect(result.admin_allow_docker).toBe(false);
      expect(result.auto_geocode_on_import).toBe(false);
    });

    test('falls back to defaults when DB query fails', async () => {
      const { query: mockQuery } = require('../../../server/src/config/database');
      mockQuery.mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await featureFlagService.refreshCache();

      // Should not throw, should return defaults
      expect(result).toHaveProperty('enable_background_jobs');
      expect(result).toHaveProperty('admin_allow_ml_training');
    });

    test('coerces string "true"/"false" DB values correctly', async () => {
      const { query: mockQuery } = require('../../../server/src/config/database');
      mockQuery.mockResolvedValueOnce({
        rows: [
          { key: 'simple_rule_scoring_enabled', value: 'true' },
          { key: 'score_debug_logging', value: 'false' },
        ],
      });

      const result = await featureFlagService.refreshCache();
      expect(result.simple_rule_scoring_enabled).toBe(true);
      expect(result.score_debug_logging).toBe(false);
    });

    test('after refreshCache, getFlag returns DB-loaded value', async () => {
      const { query: mockQuery } = require('../../../server/src/config/database');
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'enable_background_jobs', value: 'true' }],
      });

      await featureFlagService.refreshCache();
      expect(featureFlagService.getFlag('enable_background_jobs')).toBe(true);
    });
  });
});
