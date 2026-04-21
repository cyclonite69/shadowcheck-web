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
  beforeEach(() => {
    jest.clearAllMocks();
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
