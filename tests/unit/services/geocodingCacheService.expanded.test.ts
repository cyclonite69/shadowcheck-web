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

jest.mock('../../../server/src/services/geocoding/providerRuntime', () => ({
  calculateRateLimitBackoffMs: jest.fn().mockReturnValue(1),
  ensureProviderReady: jest.fn(),
  executeProviderLookup: jest.fn(),
  getProviderLabel: jest.fn().mockReturnValue('mapbox'),
  resolveProviderCredentials: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../server/src/services/geocoding/cacheStore', () => ({
  fetchRows: jest.fn().mockResolvedValue([]),
  loadCacheStats: jest.fn().mockResolvedValue({ total: 0 }),
  seedAddressCandidates: jest.fn().mockResolvedValue(0),
  upsertGeocodeCacheBatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../server/src/services/geocoding/jobState', () => ({
  acquireGeocodingRunLock: jest.fn().mockResolvedValue(true),
  completeJobRun: jest.fn().mockResolvedValue(undefined),
  createJobRun: jest.fn().mockResolvedValue(1),
  createRunSnapshot: jest.fn().mockImplementation((_status, _opts, extra) => ({
    id: extra?.id ?? 1,
    startedAt: new Date().toISOString(),
    status: _status,
    result: null,
  })),
  failJobRun: jest.fn().mockResolvedValue(undefined),
  getProbeCoordinates: jest.fn().mockResolvedValue({ lat: 40.0, lon: -74.0 }),
  loadRecentJobHistory: jest.fn().mockResolvedValue([]),
  releaseGeocodingRunLock: jest.fn().mockResolvedValue(undefined),
  updateJobRunProgress: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../server/src/services/geocoding/daemonRuntime', () => ({
  finalizeFailedRun: jest.fn().mockReturnValue({}),
  finalizeSuccessfulRun: jest.fn().mockReturnValue({}),
  getGeocodingDaemonStatus: jest.fn().mockResolvedValue({}),
  startGeocodingDaemon: jest.fn().mockResolvedValue(undefined),
  stopGeocodingDaemon: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../server/src/services/geocoding/daemonState', () => ({
  geocodeDaemon: { config: { providers: [] } },
}));

const svc = require('../../../server/src/services/geocodingCacheService');
const { query } = require('../../../server/src/config/database');
const {
  acquireGeocodingRunLock,
  releaseGeocodingRunLock,
  failJobRun,
} = require('../../../server/src/services/geocoding/jobState');
const {
  fetchRows,
  upsertGeocodeCacheBatch,
} = require('../../../server/src/services/geocoding/cacheStore');
const {
  executeProviderLookup,
  resolveProviderCredentials,
} = require('../../../server/src/services/geocoding/providerRuntime');
const { finalizeFailedRun } = require('../../../server/src/services/geocoding/daemonRuntime');

const BASE_OPTS = {
  provider: 'mapbox' as const,
  mode: 'address-only' as const,
  precision: 5,
  limit: 5,
};

describe('geocodingCacheService — expanded', () => {
  beforeEach(() => {
    // resetMocks: true clears implementations — re-establish defaults
    acquireGeocodingRunLock.mockResolvedValue(true);
    releaseGeocodingRunLock.mockResolvedValue(undefined);
    fetchRows.mockResolvedValue([]);
    executeProviderLookup.mockResolvedValue({ ok: true, address: '123 Main St' });
    resolveProviderCredentials.mockResolvedValue({});

    const {
      completeJobRun,
      createJobRun,
      createRunSnapshot,
      failJobRun,
      getProbeCoordinates,
      loadRecentJobHistory,
      updateJobRunProgress,
    } = require('../../../server/src/services/geocoding/jobState');
    completeJobRun.mockResolvedValue(undefined);
    createJobRun.mockResolvedValue(1);
    createRunSnapshot.mockImplementation((_status: string, _opts: any, extra: any) => ({
      id: extra?.id ?? 1,
      startedAt: new Date().toISOString(),
      status: _status,
      result: null,
    }));
    failJobRun.mockResolvedValue(undefined);
    getProbeCoordinates.mockResolvedValue({ lat: 40.0, lon: -74.0 });
    loadRecentJobHistory.mockResolvedValue([]);
    updateJobRunProgress.mockResolvedValue(undefined);

    const {
      finalizeFailedRun: ffr,
      finalizeSuccessfulRun: fsr,
      getGeocodingDaemonStatus: gds,
    } = require('../../../server/src/services/geocoding/daemonRuntime');
    ffr.mockReturnValue({});
    fsr.mockReturnValue({});
    gds.mockResolvedValue({});

    const {
      loadCacheStats,
      seedAddressCandidates,
      upsertGeocodeCacheBatch: ucb,
    } = require('../../../server/src/services/geocoding/cacheStore');
    loadCacheStats.mockResolvedValue({ total: 0 });
    seedAddressCandidates.mockResolvedValue(0);
    ucb.mockResolvedValue(undefined);

    const {
      getProviderLabel,
      ensureProviderReady,
      calculateRateLimitBackoffMs: crlb,
    } = require('../../../server/src/services/geocoding/providerRuntime');
    getProviderLabel.mockReturnValue('mapbox');
    ensureProviderReady.mockReturnValue(undefined);
    crlb.mockReturnValue(1);
  });

  describe('startGeocodeCacheUpdate', () => {
    test('returns { started: false } when lock is not acquired', async () => {
      acquireGeocodingRunLock.mockResolvedValue(false);
      const result = await svc.startGeocodeCacheUpdate(BASE_OPTS);
      expect(result).toEqual({ started: false });
    });

    test('returns { started: true } when lock is acquired', async () => {
      const result = await svc.startGeocodeCacheUpdate(BASE_OPTS);
      expect(result).toEqual({ started: true });
    });

    test('releases lock and throws if credentials fail', async () => {
      resolveProviderCredentials.mockRejectedValue(new Error('no creds'));
      await expect(svc.startGeocodeCacheUpdate(BASE_OPTS)).rejects.toThrow('no creds');
      expect(releaseGeocodingRunLock).toHaveBeenCalled();
    });
  });

  describe('runGeocodeCacheUpdate', () => {
    test('returns summary with processed=0 when no rows', async () => {
      fetchRows.mockResolvedValue([]);
      const result = await svc.runGeocodeCacheUpdate(BASE_OPTS);
      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
    });

    test('throws job_already_running when lock not acquired', async () => {
      acquireGeocodingRunLock.mockResolvedValue(false);
      await expect(svc.runGeocodeCacheUpdate(BASE_OPTS)).rejects.toThrow('job_already_running');
    });

    test('processes rows and counts successful results', async () => {
      fetchRows.mockResolvedValue([
        { lat_round: 40.0, lon_round: -74.0 },
        { lat_round: 41.0, lon_round: -75.0 },
      ]);
      executeProviderLookup.mockResolvedValue({ ok: true, address: '123 Main St' });
      const result = await svc.runGeocodeCacheUpdate(BASE_OPTS);
      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
    });

    test('counts poiHits when result has poiName', async () => {
      fetchRows.mockResolvedValue([{ lat_round: 40.0, lon_round: -74.0 }]);
      executeProviderLookup.mockResolvedValue({ ok: true, poiName: 'Starbucks' });
      const result = await svc.runGeocodeCacheUpdate(BASE_OPTS);
      expect(result.poiHits).toBe(1);
    });

    test('counts rateLimited when rate_limit error thrown', async () => {
      fetchRows.mockResolvedValue([{ lat_round: 40.0, lon_round: -74.0 }]);
      executeProviderLookup.mockRejectedValue(new Error('rate_limit'));
      const result = await svc.runGeocodeCacheUpdate(BASE_OPTS);
      expect(result.rateLimited).toBe(1);
    });

    test('records failed attempt on generic provider error', async () => {
      fetchRows.mockResolvedValue([{ lat_round: 40.0, lon_round: -74.0 }]);
      executeProviderLookup.mockRejectedValue(new Error('timeout'));
      const result = await svc.runGeocodeCacheUpdate(BASE_OPTS);
      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(upsertGeocodeCacheBatch).toHaveBeenCalled();
    });

    test('calls failJobRun and rethrows on unexpected error', async () => {
      const {
        createJobRun,
        failJobRun: fjr,
      } = require('../../../server/src/services/geocoding/jobState');
      createJobRun.mockRejectedValue(new Error('DB exploded'));
      await expect(svc.runGeocodeCacheUpdate(BASE_OPTS)).rejects.toThrow('DB exploded');
      expect(fjr).toHaveBeenCalled();
      expect(releaseGeocodingRunLock).toHaveBeenCalled();
    });
  });

  describe('requeueFailedGeocoding', () => {
    test('returns count of requeued rows', async () => {
      query.mockResolvedValue({ rowCount: 5 });
      const count = await svc.requeueFailedGeocoding(5);
      expect(count).toBe(5);
    });

    test('returns 0 when no rows updated', async () => {
      query.mockResolvedValue({ rowCount: 0 });
      const count = await svc.requeueFailedGeocoding(5);
      expect(count).toBe(0);
    });

    test('returns 0 when rowCount is null', async () => {
      query.mockResolvedValue({ rowCount: null });
      const count = await svc.requeueFailedGeocoding(5);
      expect(count).toBe(0);
    });
  });

  describe('testGeocodingProvider', () => {
    test('throws when no coordinates available', async () => {
      const { getProbeCoordinates } = require('../../../server/src/services/geocoding/jobState');
      getProbeCoordinates.mockResolvedValue(null);
      await expect(
        svc.testGeocodingProvider({ provider: 'mapbox', mode: 'address-only' })
      ).rejects.toThrow('No valid coordinates available');
    });

    test('uses provided lat/lon directly', async () => {
      executeProviderLookup.mockResolvedValue({ ok: true });
      const result = await svc.testGeocodingProvider({
        provider: 'mapbox',
        mode: 'address-only',
        lat: 10,
        lon: 20,
      });
      expect(result.sample).toEqual({ lat: 10, lon: 20 });
      expect(executeProviderLookup).toHaveBeenCalledWith(
        'mapbox',
        'address-only',
        10,
        20,
        false,
        {}
      );
    });

    test('returns result shape with provider and mode', async () => {
      executeProviderLookup.mockResolvedValue({ ok: true, address: 'Test' });
      const result = await svc.testGeocodingProvider({
        provider: 'mapbox',
        mode: 'address-only',
        lat: 1,
        lon: 2,
      });
      expect(result).toHaveProperty('sample');
      expect(result).toHaveProperty('provider', 'mapbox');
      expect(result).toHaveProperty('mode', 'address-only');
      expect(result).toHaveProperty('result');
    });
  });

  describe('getGeocodingCacheStats', () => {
    test('returns stats object', async () => {
      const { loadCacheStats } = require('../../../server/src/services/geocoding/cacheStore');
      loadCacheStats.mockResolvedValue({ total: 42, precision: 5 });
      const stats = await svc.getGeocodingCacheStats(5);
      expect(stats).toHaveProperty('total', 42);
    });
  });
});
