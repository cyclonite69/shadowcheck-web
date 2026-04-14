/**
 * Geocoding Daemon State Unit Tests
 */

import {
  geocodeDaemon,
  getDaemonProviderRunOptions,
  loadPersistedDaemonConfig,
  normalizeDaemonConfig,
  persistDaemonConfig,
} from '../../server/src/services/geocoding/daemonState';

import { adminQuery } from '../../server/src/services/adminDbService';

jest.mock('../../server/src/services/adminDbService');

describe('GeocodingDaemonState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeDaemonConfig', () => {
    it('should use defaults for empty config', () => {
      const config = normalizeDaemonConfig({});
      expect(config.provider).toBe('mapbox');
      expect(config.mode).toBe('address-only');
      expect(config.limit).toBe(250);
      expect(config.perMinute).toBe(200);
    });

    it('should enforce limits and constraints', () => {
      const config = normalizeDaemonConfig({
        limit: 0,
        perMinute: 0,
        loopDelayMs: 100,
        idleSleepMs: 50,
      });
      expect(config.limit).toBe(250);
      expect(config.perMinute).toBe(200);
      expect(config.loopDelayMs).toBe(1000);
      expect(config.idleSleepMs).toBe(1000);
    });

    it('should use provider-specific default perMinute for nominatim', () => {
      const config = normalizeDaemonConfig({ provider: 'nominatim' });
      expect(config.perMinute).toBe(60);
    });

    it('should preserve valid values', () => {
      const config = normalizeDaemonConfig({
        provider: 'opencage',
        limit: 500,
        perMinute: 30,
        loopDelayMs: 20000,
      });
      expect(config.provider).toBe('opencage');
      expect(config.limit).toBe(500);
      expect(config.perMinute).toBe(30);
      expect(config.loopDelayMs).toBe(20000);
    });
  });

  describe('loadPersistedDaemonConfig', () => {
    it('should load and parse config from DB', async () => {
      const mockValue = JSON.stringify({ provider: 'mapbox', limit: 100 });
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ value: mockValue }] });

      const config = await loadPersistedDaemonConfig();
      expect(config).toEqual({ provider: 'mapbox', limit: 100 });
    });

    it('should return null if not found', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const config = await loadPersistedDaemonConfig();
      expect(config).toBeNull();
    });

    it('should handle non-string values (already parsed)', async () => {
      const mockValue = { provider: 'mapbox' };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ value: mockValue }] });

      const config = await loadPersistedDaemonConfig();
      expect(config).toEqual(mockValue);
    });

    it('should handle JSON parse errors', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ value: '{invalid}' }] });
      const config = await loadPersistedDaemonConfig();
      expect(config).toBeNull();
    });
  });

  describe('persistDaemonConfig', () => {
    it('should save config to DB', async () => {
      const config = { provider: 'mapbox', limit: 100 } as any;
      await persistDaemonConfig(config);

      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.settings'), [
        'geocoding_daemon_config',
        JSON.stringify(config),
        expect.any(String),
      ]);
    });
  });

  describe('getDaemonProviderRunOptions', () => {
    it('should return base config if no additional providers', () => {
      const config = normalizeDaemonConfig({ provider: 'mapbox', limit: 100 });
      const options = getDaemonProviderRunOptions(config);

      expect(options.provider).toBe('mapbox');
      expect(options.limit).toBe(100);
    });

    it('should rotate through active providers', () => {
      const config = normalizeDaemonConfig({
        provider: 'mapbox',
        providers: [
          { provider: 'nominatim', enabled: true },
          { provider: 'opencage', enabled: true },
          { provider: 'mapbox', enabled: false },
        ],
      });

      // Tick 0: nominatim
      const options1 = getDaemonProviderRunOptions(config);
      expect(options1.provider).toBe('nominatim');
      expect(config.providerCursor).toBe(1);

      // Tick 1: opencage
      const options2 = getDaemonProviderRunOptions(config);
      expect(options2.provider).toBe('opencage');
      expect(config.providerCursor).toBe(0);

      // Tick 2: back to nominatim
      const options3 = getDaemonProviderRunOptions(config);
      expect(options3.provider).toBe('nominatim');
    });

    it('should override base options from provider config', () => {
      const config = normalizeDaemonConfig({
        limit: 100,
        providers: [{ provider: 'nominatim', limit: 50, enabled: true }],
      });

      const options = getDaemonProviderRunOptions(config);
      expect(options.provider).toBe('nominatim');
      expect(options.limit).toBe(50);
    });
  });
});
