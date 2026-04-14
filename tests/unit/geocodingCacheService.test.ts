/**
 * Geocoding Cache Service Unit Tests
 */

const geocodingCacheService = require('../../server/src/services/geocodingCacheService');

import {
  calculateRateLimitBackoffMs,
  ensureProviderReady,
  executeProviderLookup,
  getProviderLabel,
  resolveProviderCredentials,
} from '../../server/src/services/geocoding/providerRuntime';
import {
  fetchRows,
  loadCacheStats,
  seedAddressCandidates,
  upsertGeocodeCacheBatch,
} from '../../server/src/services/geocoding/cacheStore';
import {
  acquireGeocodingRunLock,
  completeJobRun,
  createJobRun,
  createRunSnapshot,
  failJobRun,
  getProbeCoordinates,
  loadRecentJobHistory,
  releaseGeocodingRunLock,
  updateJobRunProgress,
} from '../../server/src/services/geocoding/jobState';
import {
  finalizeFailedRun,
  finalizeSuccessfulRun,
  getGeocodingDaemonStatus,
  startGeocodingDaemon,
  stopGeocodingDaemon,
} from '../../server/src/services/geocoding/daemonRuntime';

import logger from '../../server/src/logging/logger';

// Mock all dependencies
jest.mock('../../server/src/logging/logger');
jest.mock('../../server/src/config/database');
jest.mock('../../server/src/services/geocoding/providerRuntime');
jest.mock('../../server/src/services/geocoding/cacheStore');
jest.mock('../../server/src/services/geocoding/jobState');
jest.mock('../../server/src/services/geocoding/daemonRuntime');

describe('GeocodingCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runGeocodeCacheUpdate', () => {
    const mockOptions = {
      provider: 'mapbox',
      mode: 'address-only',
      precision: 5,
      limit: 10,
    };

    it('should run update successfully', async () => {
      (acquireGeocodingRunLock as jest.Mock).mockResolvedValueOnce(true);
      (createJobRun as jest.Mock).mockResolvedValueOnce(123);
      (createRunSnapshot as jest.Mock).mockReturnValue({
        id: 123,
        startedAt: new Date().toISOString(),
      });
      (resolveProviderCredentials as jest.Mock).mockResolvedValueOnce({});
      (fetchRows as jest.Mock).mockResolvedValueOnce([{ lat_round: 1, lon_round: 2 }]);
      (executeProviderLookup as jest.Mock).mockResolvedValueOnce({
        ok: true,
        address: 'Test Address',
      });

      const result = await geocodingCacheService.runGeocodeCacheUpdate(mockOptions);

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(completeJobRun).toHaveBeenCalledWith(123, expect.any(Object));
      expect(releaseGeocodingRunLock).toHaveBeenCalled();
    });

    it('should throw error if job already running', async () => {
      (acquireGeocodingRunLock as jest.Mock).mockResolvedValueOnce(false);
      await expect(geocodingCacheService.runGeocodeCacheUpdate(mockOptions)).rejects.toThrow(
        'job_already_running'
      );
    });

    it('should handle provider errors and record attempt', async () => {
      (acquireGeocodingRunLock as jest.Mock).mockResolvedValueOnce(true);
      (createJobRun as jest.Mock).mockResolvedValueOnce(123);
      (createRunSnapshot as jest.Mock).mockReturnValue({
        id: 123,
        startedAt: new Date().toISOString(),
      });
      (fetchRows as jest.Mock).mockResolvedValueOnce([{ lat_round: 1, lon_round: 2 }]);
      (executeProviderLookup as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const result = await geocodingCacheService.runGeocodeCacheUpdate(mockOptions);

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(upsertGeocodeCacheBatch).toHaveBeenCalled();
    });

    it('should handle rate limits with backoff', async () => {
      (acquireGeocodingRunLock as jest.Mock).mockResolvedValueOnce(true);
      (createJobRun as jest.Mock).mockResolvedValueOnce(123);
      (createRunSnapshot as jest.Mock).mockReturnValue({
        id: 123,
        startedAt: new Date().toISOString(),
      });
      (fetchRows as jest.Mock).mockResolvedValueOnce([{ lat_round: 1, lon_round: 2 }]);
      (executeProviderLookup as jest.Mock).mockRejectedValueOnce(new Error('rate_limit'));
      (calculateRateLimitBackoffMs as jest.Mock).mockReturnValue(1);

      const result = await geocodingCacheService.runGeocodeCacheUpdate(mockOptions);

      expect(result.rateLimited).toBe(1);
      expect(calculateRateLimitBackoffMs).toHaveBeenCalled();
    });
  });

  describe('getGeocodingCacheStats', () => {
    it('should load and return stats', async () => {
      (loadRecentJobHistory as jest.Mock).mockResolvedValueOnce([]);
      (getGeocodingDaemonStatus as jest.Mock).mockResolvedValueOnce({});
      (loadCacheStats as jest.Mock).mockResolvedValueOnce({ total: 100 });

      const stats = await geocodingCacheService.getGeocodingCacheStats(5);
      expect(stats.total).toBe(100);
    });
  });

  describe('testGeocodingProvider', () => {
    it('should test provider with specific coords', async () => {
      (resolveProviderCredentials as jest.Mock).mockResolvedValueOnce({});
      (executeProviderLookup as jest.Mock).mockResolvedValueOnce({ ok: true });

      const result = await geocodingCacheService.testGeocodingProvider({
        provider: 'mapbox',
        mode: 'address-only',
        lat: 1,
        lon: 2,
      });

      expect(result.result.ok).toBe(true);
      expect(executeProviderLookup).toHaveBeenCalledWith(
        'mapbox',
        'address-only',
        1,
        2,
        false,
        expect.any(Object)
      );
    });

    it('should use probe coordinates if none provided', async () => {
      (getProbeCoordinates as jest.Mock).mockResolvedValueOnce({ lat: 3, lon: 4 });
      (resolveProviderCredentials as jest.Mock).mockResolvedValueOnce({});
      (executeProviderLookup as jest.Mock).mockResolvedValueOnce({ ok: true });

      await geocodingCacheService.testGeocodingProvider({
        provider: 'mapbox',
        mode: 'address-only',
      });

      expect(executeProviderLookup).toHaveBeenCalledWith(
        'mapbox',
        'address-only',
        3,
        4,
        false,
        expect.any(Object)
      );
    });
  });
});
