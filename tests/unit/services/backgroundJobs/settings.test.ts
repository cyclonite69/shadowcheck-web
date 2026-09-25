import {
  getResolvedJobConfig,
  hasJobConfigChanged,
  loadBackgroundJobConfigs,
} from '../../../../server/src/services/backgroundJobs/settings';
import { JOB_SETTING_KEYS } from '../../../../server/src/services/backgroundJobs/config';

// Mock the database config
jest.mock('../../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

const { query } = require('../../../../server/src/config/database');

describe('backgroundJobs/settings', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadBackgroundJobConfigs', () => {
    it('should parse string values and keep object values', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { key: 'backup_job_config', value: '{"enabled":true,"cron":"0 0 * * *"}' },
          { key: 'ml_scoring_job_config', value: { enabled: false, cron: '0 1 * * *' } },
        ],
      });

      const result = await loadBackgroundJobConfigs();

      expect(query).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        backup_job_config: { enabled: true, cron: '0 0 * * *' },
        ml_scoring_job_config: { enabled: false, cron: '0 1 * * *' },
      });
    });

    it('should handle empty rows', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await loadBackgroundJobConfigs();
      expect(result).toEqual({});
    });
  });

  describe('getResolvedJobConfig', () => {
    it('should return config for a valid jobName', () => {
      const configs = {
        [JOB_SETTING_KEYS['mlScoring']]: { enabled: true, cron: '0 * * * *' },
      };

      const config = getResolvedJobConfig(configs, 'mlScoring');
      expect(config).toEqual({ enabled: true, cron: '0 * * * *' });
    });
  });

  describe('hasJobConfigChanged', () => {
    const jobName = 'mlScoring';
    const key = JOB_SETTING_KEYS[jobName];

    it('should return true if previous config is missing', () => {
      const previousConfigs = {};
      const nextConfig = { enabled: true, cron: '0 * * * *' };

      expect(hasJobConfigChanged(previousConfigs, jobName, nextConfig)).toBe(true);
    });

    it('should return true if enabled state changed', () => {
      const previousConfigs = {
        [key]: { enabled: false, cron: '0 * * * *' },
      };
      const nextConfig = { enabled: true, cron: '0 * * * *' };

      expect(hasJobConfigChanged(previousConfigs, jobName, nextConfig)).toBe(true);
    });

    it('should return true if cron changed', () => {
      const previousConfigs = {
        [key]: { enabled: true, cron: '0 1 * * *' },
      };
      const nextConfig = { enabled: true, cron: '0 2 * * *' };

      expect(hasJobConfigChanged(previousConfigs, jobName, nextConfig)).toBe(true);
    });

    it('should return false if neither enabled state nor cron changed', () => {
      const previousConfigs = {
        [key]: { enabled: true, cron: '0 * * * *' },
      };
      const nextConfig = { enabled: true, cron: '0 * * * *' };

      expect(hasJobConfigChanged(previousConfigs, jobName, nextConfig)).toBe(false);
    });
  });
});
