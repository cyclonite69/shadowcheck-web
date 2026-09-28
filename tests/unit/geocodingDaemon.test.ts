/**
 * Geocoding Daemon Unit Tests
 *
 * Verifies the background geocoding daemon lifecycle, including start/stop,
 * loop execution, error handling, and adaptive sleeping.
 */

import {
  finalizeFailedRun,
  finalizeSuccessfulRun,
  getGeocodingDaemonStatus,
  runGeocodeDaemonLoop,
  startGeocodingDaemon,
  stopGeocodingDaemon,
} from '../../server/src/services/geocoding/daemonRuntime';

import {
  geocodeDaemon,
  getDaemonProviderRunOptions,
  loadPersistedDaemonConfig,
  normalizeDaemonConfig,
  persistDaemonConfig,
} from '../../server/src/services/geocoding/daemonState';

import { createRunSnapshot } from '../../server/src/services/geocoding/jobState';
import {
  ensureProviderReady,
  resolveProviderCredentials,
} from '../../server/src/services/geocoding/providerRuntime';
import { PROVIDER_DISABLED_ERROR_PREFIX } from '../../server/src/services/geocoding/providerErrors';
import logger from '../../server/src/logging/logger';

// Mock dependencies
jest.mock('../../server/src/logging/logger');
jest.mock('../../server/src/services/geocoding/daemonState', () => ({
  geocodeDaemon: {
    config: null,
    running: false,
    stopRequested: false,
    startedAt: undefined,
    lastTickAt: undefined,
    lastResult: undefined,
    lastError: undefined,
  },
  getDaemonProviderRunOptions: jest.fn(),
  loadPersistedDaemonConfig: jest.fn(),
  normalizeDaemonConfig: jest.fn(),
  persistDaemonConfig: jest.fn(),
}));
jest.mock('../../server/src/services/geocoding/jobState');
jest.mock('../../server/src/services/geocoding/providerRuntime');
jest.mock('../../server/src/services/geocoding/cacheStore', () => ({
  getActivePendingPrecisions: jest.fn().mockResolvedValue([]),
}));

describe('GeocodingDaemon', () => {
  const originalOverpassEnabled = process.env.GEOCODING_OVERPASS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    (getDaemonProviderRunOptions as jest.Mock).mockReset();
    // Reset geocodeDaemon state manually because it's a shared object
    geocodeDaemon.config = null;
    geocodeDaemon.running = false;
    geocodeDaemon.stopRequested = false;
    geocodeDaemon.startedAt = undefined;
    geocodeDaemon.lastTickAt = undefined;
    geocodeDaemon.lastResult = undefined;
    geocodeDaemon.lastError = undefined;

    // Default mock for normalizeDaemonConfig
    (normalizeDaemonConfig as jest.Mock).mockImplementation((cfg) => ({
      provider: 'mapbox',
      loopDelayMs: 0,
      idleSleepMs: 0,
      errorSleepMs: 0,
      ...cfg,
    }));
    (ensureProviderReady as jest.Mock).mockImplementation((provider) => {
      if (provider === 'overpass' && process.env.GEOCODING_OVERPASS_ENABLED !== 'true') {
        throw new Error(`${PROVIDER_DISABLED_ERROR_PREFIX}overpass`);
      }
    });
  });

  afterEach(() => {
    if (originalOverpassEnabled === undefined) {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
    } else {
      process.env.GEOCODING_OVERPASS_ENABLED = originalOverpassEnabled;
    }
  });

  describe('startGeocodingDaemon', () => {
    it('should load persisted config and start the loop', async () => {
      const mockConfig = { provider: 'mapbox' };
      (loadPersistedDaemonConfig as jest.Mock).mockResolvedValueOnce(mockConfig);
      (resolveProviderCredentials as jest.Mock).mockResolvedValueOnce('mock-creds');

      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.stopRequested = true;
        return { processed: 0 };
      });

      const result = await startGeocodingDaemon({}, runGeocodeCacheUpdate);

      expect(result.started).toBe(true);
      // Wait a bit for the loop to start and finish
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(loadPersistedDaemonConfig).toHaveBeenCalled();
      expect(persistDaemonConfig).toHaveBeenCalled();
      expect(resolveProviderCredentials).toHaveBeenCalledWith('mapbox');
      expect(ensureProviderReady).toHaveBeenCalled();
    });

    it('should use provided config and override persisted config', async () => {
      (loadPersistedDaemonConfig as jest.Mock).mockResolvedValueOnce({ provider: 'nominatim' });
      const inputConfig = { provider: 'opencage' };

      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.stopRequested = true;
        return { processed: 0 };
      });
      await startGeocodingDaemon(inputConfig as any, runGeocodeCacheUpdate);

      expect(normalizeDaemonConfig).toHaveBeenCalledWith(expect.objectContaining(inputConfig));
      expect(geocodeDaemon.config?.provider).toBe('opencage');

      // Cleanup
      geocodeDaemon.stopRequested = true;
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should not start if already running', async () => {
      geocodeDaemon.running = true;
      const runGeocodeCacheUpdate = jest.fn();

      const result = await startGeocodingDaemon({}, runGeocodeCacheUpdate);

      expect(result.started).toBe(false);
      expect(runGeocodeCacheUpdate).not.toHaveBeenCalled();
    });
  });

  describe('stopGeocodingDaemon', () => {
    it('should set stopRequested if running', () => {
      geocodeDaemon.running = true;
      const result = stopGeocodingDaemon();
      expect(result.stopped).toBe(true);
      expect(geocodeDaemon.stopRequested).toBe(true);
    });

    it('should return stopped:false if not running', () => {
      geocodeDaemon.running = false;
      const result = stopGeocodingDaemon();
      expect(result.stopped).toBe(false);
    });
  });

  describe('getGeocodingDaemonStatus', () => {
    it('should return current status', async () => {
      geocodeDaemon.running = true;
      geocodeDaemon.config = { provider: 'mapbox' } as any;

      const status = await getGeocodingDaemonStatus();
      expect(status.running).toBe(true);
      expect(status.config).toEqual({ provider: 'mapbox' });
    });

    it('should load persisted config if current config is null', async () => {
      (loadPersistedDaemonConfig as jest.Mock).mockResolvedValueOnce({ provider: 'mapbox' });

      const status = await getGeocodingDaemonStatus();

      expect(loadPersistedDaemonConfig).toHaveBeenCalled();
      expect(status.config).toBeDefined();
    });

    it('should handle failure to load persisted config', async () => {
      geocodeDaemon.config = null;
      (loadPersistedDaemonConfig as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));

      const status = await getGeocodingDaemonStatus();

      expect(status.lastError).toBe('Load failed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load persisted daemon config for status'),
        expect.any(Object)
      );
    });
  });

  describe('runGeocodeDaemonLoop', () => {
    it('should execute loop and sleep based on results', async () => {
      geocodeDaemon.config = {
        provider: 'mapbox',
        loopDelayMs: 0,
        idleSleepMs: 0,
        errorSleepMs: 0,
      } as any;

      (getDaemonProviderRunOptions as jest.Mock).mockReturnValue({ provider: 'mapbox' });

      const runGeocodeCacheUpdate = jest
        .fn()
        .mockResolvedValueOnce({ processed: 10 })
        .mockImplementationOnce(async () => {
          geocodeDaemon.stopRequested = true;
          return { processed: 0 };
        });

      await runGeocodeDaemonLoop(runGeocodeCacheUpdate);

      expect(runGeocodeCacheUpdate).toHaveBeenCalledTimes(2);
      expect(geocodeDaemon.lastResult).toEqual({ processed: 0 });
      expect(geocodeDaemon.running).toBe(false);
    });

    it('should handle errors in the loop and enter error sleep', async () => {
      geocodeDaemon.config = {
        provider: 'mapbox',
        loopDelayMs: 0,
        idleSleepMs: 0,
        errorSleepMs: 0,
      } as any;

      (getDaemonProviderRunOptions as jest.Mock).mockReturnValue({ provider: 'mapbox' });

      const runGeocodeCacheUpdate = jest.fn().mockImplementationOnce(async () => {
        geocodeDaemon.stopRequested = true;
        throw new Error('Network Error');
      });

      await runGeocodeDaemonLoop(runGeocodeCacheUpdate);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('tick failed'),
        expect.any(Object)
      );
      expect(geocodeDaemon.lastError).toBe('Network Error');
    });

    it('should stop if config becomes missing', async () => {
      geocodeDaemon.config = { provider: 'mapbox' } as any;
      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.config = null;
        return { processed: 0 };
      });

      await runGeocodeDaemonLoop(runGeocodeCacheUpdate);
      expect(runGeocodeCacheUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not start if config is missing', async () => {
      geocodeDaemon.config = null;
      const runGeocodeCacheUpdate = jest.fn();

      await runGeocodeDaemonLoop(runGeocodeCacheUpdate);
      expect(runGeocodeCacheUpdate).not.toHaveBeenCalled();
    });
  });

  describe('startGeocodingDaemon', () => {
    it('should handle failure to load persisted config before start', async () => {
      (loadPersistedDaemonConfig as jest.Mock).mockRejectedValueOnce(new Error('Load error'));
      (resolveProviderCredentials as jest.Mock).mockResolvedValue('mock-creds');

      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.stopRequested = true;
        return { processed: 0 };
      });

      await startGeocodingDaemon({}, runGeocodeCacheUpdate);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load persisted daemon config before start'),
        expect.any(Object)
      );
      expect(normalizeDaemonConfig).toHaveBeenCalledWith({});
    });

    it('should ensure all enabled providers are ready', async () => {
      const config = {
        provider: 'mapbox',
        providers: [
          { provider: 'nominatim', enabled: true },
          { provider: 'opencage', enabled: false },
          { provider: 'geocodio' }, // default enabled
        ],
      };
      (loadPersistedDaemonConfig as jest.Mock).mockResolvedValueOnce({});
      (normalizeDaemonConfig as jest.Mock).mockReturnValue(config);
      (resolveProviderCredentials as jest.Mock).mockResolvedValue('creds');

      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.stopRequested = true;
        return { processed: 0 };
      });

      await startGeocodingDaemon(config as any, runGeocodeCacheUpdate);

      expect(resolveProviderCredentials).toHaveBeenCalledWith('mapbox');
      expect(resolveProviderCredentials).toHaveBeenCalledWith('nominatim');
      expect(resolveProviderCredentials).toHaveBeenCalledWith('geocodio');
      expect(resolveProviderCredentials).not.toHaveBeenCalledWith('opencage');
    });

    it('starts with a non-Overpass primary and skips only the disabled Overpass fallback', async () => {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
      const config = {
        provider: 'mapbox',
        mode: 'address-only',
        limit: 5,
        precision: 5,
        perMinute: 200,
        providers: [
          { provider: 'nominatim', enabled: true },
          { provider: 'overpass', enabled: true },
          { provider: 'geocodio', enabled: true },
        ],
        loopDelayMs: 0,
        idleSleepMs: 0,
        errorSleepMs: 0,
      };
      (normalizeDaemonConfig as jest.Mock).mockReturnValue(config);
      (resolveProviderCredentials as jest.Mock).mockResolvedValue({});
      const { getDaemonProviderRunOptions: getRealProviderRunOptions } = jest.requireActual(
        '../../server/src/services/geocoding/daemonState'
      );
      (getDaemonProviderRunOptions as jest.Mock).mockImplementation(getRealProviderRunOptions);
      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async () => {
        geocodeDaemon.stopRequested = true;
        return { processed: 1 };
      });

      const result = await startGeocodingDaemon(config as any, runGeocodeCacheUpdate);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(result.started).toBe(true);
      expect(ensureProviderReady).toHaveBeenCalledWith('mapbox', {});
      expect(ensureProviderReady).toHaveBeenCalledWith('nominatim', {});
      expect(ensureProviderReady).toHaveBeenCalledWith('overpass', {});
      expect(ensureProviderReady).toHaveBeenCalledWith('geocodio', {});
      expect(persistDaemonConfig).toHaveBeenCalledWith(config);
      expect(geocodeDaemon.config?.provider).toBe('mapbox');
      expect(geocodeDaemon.config?.providers?.map((item) => item.provider)).toEqual([
        'nominatim',
        'overpass',
        'geocodio',
      ]);
      expect(runGeocodeCacheUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'nominatim' })
      );
    });

    it('rejects a disabled Overpass primary before starting the daemon', async () => {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
      const config = {
        provider: 'overpass',
        providers: [{ provider: 'geocodio', enabled: true }],
      };
      (normalizeDaemonConfig as jest.Mock).mockReturnValue(config);
      (resolveProviderCredentials as jest.Mock).mockResolvedValue({});
      const runGeocodeCacheUpdate = jest.fn();

      await expect(startGeocodingDaemon(config as any, runGeocodeCacheUpdate)).rejects.toThrow(
        'provider_disabled:overpass'
      );

      expect(ensureProviderReady).toHaveBeenCalledTimes(1);
      expect(ensureProviderReady).toHaveBeenCalledWith('overpass', {});
      expect(persistDaemonConfig).not.toHaveBeenCalled();
      expect(geocodeDaemon.running).toBe(false);
      expect(runGeocodeCacheUpdate).not.toHaveBeenCalled();
    });

    it('does not suppress an unrelated optional fallback readiness failure', async () => {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
      const config = {
        provider: 'mapbox',
        providers: [
          { provider: 'overpass', enabled: true },
          { provider: 'geocodio', enabled: true },
        ],
      };
      (normalizeDaemonConfig as jest.Mock).mockReturnValue(config);
      (resolveProviderCredentials as jest.Mock).mockResolvedValue({});
      (ensureProviderReady as jest.Mock).mockImplementation((provider) => {
        if (provider === 'overpass') {
          throw new Error(`${PROVIDER_DISABLED_ERROR_PREFIX}overpass`);
        }
        if (provider === 'geocodio') {
          throw new Error('missing_key:geocodio');
        }
      });

      await expect(startGeocodingDaemon(config as any, jest.fn())).rejects.toThrow(
        'missing_key:geocodio'
      );

      expect(ensureProviderReady).toHaveBeenCalledWith('mapbox', {});
      expect(ensureProviderReady).toHaveBeenCalledWith('overpass', {});
      expect(ensureProviderReady).toHaveBeenCalledWith('geocodio', {});
      expect(persistDaemonConfig).not.toHaveBeenCalled();
    });

    it('does not dispatch disabled Overpass to serial daemon ticks', async () => {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
      const config = {
        provider: 'mapbox',
        mode: 'address-only',
        precision: 5,
        limit: 5,
        perMinute: 60,
        providers: [
          { provider: 'nominatim', enabled: true },
          { provider: 'overpass', enabled: true },
          { provider: 'geocodio', enabled: true },
        ],
        workers: 1,
        loopDelayMs: 0,
        idleSleepMs: 0,
        errorSleepMs: 0,
      };
      geocodeDaemon.config = config as any;
      const { getDaemonProviderRunOptions: getRealProviderRunOptions } = jest.requireActual(
        '../../server/src/services/geocoding/daemonState'
      );
      (getDaemonProviderRunOptions as jest.Mock).mockImplementation(getRealProviderRunOptions);
      const dispatchedProviders: string[] = [];
      const runGeocodeCacheUpdate = jest.fn().mockImplementation(async (options) => {
        dispatchedProviders.push(options.provider);
        if (dispatchedProviders.length === 4) {
          geocodeDaemon.stopRequested = true;
        }
        return { processed: 1 };
      });

      await runGeocodeDaemonLoop(runGeocodeCacheUpdate);

      expect(dispatchedProviders).toEqual(['nominatim', 'geocodio', 'nominatim', 'geocodio']);
      expect(config.providers.map((item) => item.provider)).toEqual([
        'nominatim',
        'overpass',
        'geocodio',
      ]);
    });

    it('does not dispatch disabled Overpass to parallel daemon workers', async () => {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
      const config = {
        provider: 'mapbox',
        mode: 'address-only',
        precision: 5,
        limit: 5,
        perMinute: 60,
        providers: [
          { provider: 'nominatim', enabled: true },
          { provider: 'overpass', enabled: true },
          { provider: 'geocodio', enabled: true },
        ],
        workers: 4,
        loopDelayMs: 0,
        idleSleepMs: 0,
        errorSleepMs: 0,
      };
      geocodeDaemon.config = config as any;
      (resolveProviderCredentials as jest.Mock).mockResolvedValue({});
      const { getDaemonProviderRunOptions: getRealProviderRunOptions } = jest.requireActual(
        '../../server/src/services/geocoding/daemonState'
      );
      (getDaemonProviderRunOptions as jest.Mock).mockImplementation(getRealProviderRunOptions);
      const dispatchedProviders: string[] = [];
      let activeWorkers = 0;
      let maxConcurrentWorkers = 0;
      let releaseWorkers: () => void = () => {};
      const allWorkersEntered = new Promise<void>((resolve) => {
        releaseWorkers = resolve;
      });
      (ensureProviderReady as jest.Mock).mockImplementation((provider) => {
        if (provider === 'overpass' && process.env.GEOCODING_OVERPASS_ENABLED !== 'true') {
          releaseWorkers();
          throw new Error(`${PROVIDER_DISABLED_ERROR_PREFIX}overpass`);
        }
      });
      const runInternal = jest.fn().mockImplementation(async (options) => {
        dispatchedProviders.push(options.provider);
        activeWorkers++;
        maxConcurrentWorkers = Math.max(maxConcurrentWorkers, activeWorkers);
        if (dispatchedProviders.length === 2) {
          geocodeDaemon.stopRequested = true;
          releaseWorkers();
        }
        await allWorkersEntered;
        activeWorkers--;
        return { processed: 1 };
      });

      await runGeocodeDaemonLoop(jest.fn(), runInternal);

      expect(dispatchedProviders).toHaveLength(4);
      expect(maxConcurrentWorkers).toBeGreaterThan(1);
      expect(dispatchedProviders).not.toContain('overpass');
      expect(dispatchedProviders).toEqual(
        expect.arrayContaining(['nominatim', 'nominatim', 'geocodio', 'geocodio'])
      );
      expect(dispatchedProviders.filter((provider) => provider === 'nominatim')).toHaveLength(2);
      expect(dispatchedProviders.filter((provider) => provider === 'geocodio')).toHaveLength(2);
      expect(config.providers.map((item) => item.provider)).toEqual([
        'nominatim',
        'overpass',
        'geocodio',
      ]);
    });
  });

  describe('Finalization Helpers', () => {
    it('finalizeSuccessfulRun should call createRunSnapshot', () => {
      const options = { provider: 'mapbox' } as any;
      const result = { processed: 10 } as any;

      finalizeSuccessfulRun(options, 123, 'start-time', result);

      expect(createRunSnapshot).toHaveBeenCalledWith(
        'completed',
        options,
        expect.objectContaining({
          id: 123,
          result,
        })
      );
    });

    it('finalizeFailedRun should call createRunSnapshot', () => {
      const options = { provider: 'mapbox' } as any;

      finalizeFailedRun(options, 123, 'start-time', 'some error');

      expect(createRunSnapshot).toHaveBeenCalledWith(
        'failed',
        options,
        expect.objectContaining({
          id: 123,
          error: 'some error',
        })
      );
    });
  });
});
