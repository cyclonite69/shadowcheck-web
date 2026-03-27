const { adminQuery } = require('../adminDbService');

export {};

import type {
  GeocodeDaemonConfig,
  GeocodeMode,
  GeocodeProvider,
  GeocodeRunOptions,
  GeocodingDaemonStatus,
} from './types';

const GEOCODING_DAEMON_STATE_KEY = 'geocoding_daemon_config';

const geocodeDaemon: GeocodingDaemonStatus = {
  running: false,
  stopRequested: false,
  config: null,
};

const loadPersistedDaemonConfig = async (): Promise<GeocodeDaemonConfig | null> => {
  const result = await adminQuery('SELECT value FROM app.settings WHERE key = $1 LIMIT 1', [
    GEOCODING_DAEMON_STATE_KEY,
  ]);
  const row = result.rows[0];
  if (!row?.value) return null;
  if (typeof row.value === 'string') {
    try {
      return JSON.parse(row.value) as GeocodeDaemonConfig;
    } catch {
      return null;
    }
  }
  return row.value as GeocodeDaemonConfig;
};

const persistDaemonConfig = async (config: GeocodeDaemonConfig): Promise<void> => {
  await adminQuery(
    `
    INSERT INTO app.settings (key, value, description)
    VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = NOW()
  `,
    [
      GEOCODING_DAEMON_STATE_KEY,
      JSON.stringify(config),
      'Config and cursor state for continuous geocoding daemon',
    ]
  );
};

const normalizeDaemonConfig = (config: Partial<GeocodeDaemonConfig>): GeocodeDaemonConfig => {
  const provider = (config.provider || 'mapbox') as GeocodeProvider;
  const mode = (config.mode || 'address-only') as GeocodeMode;
  const limit = Math.max(1, Number(config.limit) || 250);
  const precision = Math.max(1, Number(config.precision) || 5);
  const perMinute = Math.max(
    1,
    Number(config.perMinute) ||
      (['nominatim', 'overpass', 'opencage', 'geocodio', 'locationiq'].includes(provider)
        ? 60
        : 200)
  );
  const loopDelayMs = Math.max(1000, Number(config.loopDelayMs) || 15000);
  const idleSleepMs = Math.max(loopDelayMs, Number(config.idleSleepMs) || 180000);
  const errorSleepMs = Math.max(1000, Number(config.errorSleepMs) || 60000);
  const providers = Array.isArray(config.providers) ? config.providers : [];

  return {
    provider,
    mode,
    limit,
    precision,
    perMinute,
    permanent: Boolean(config.permanent),
    loopDelayMs,
    idleSleepMs,
    errorSleepMs,
    providers,
    providerCursor: Math.max(0, Number(config.providerCursor) || 0),
  };
};

const getDaemonProviderRunOptions = (config: GeocodeDaemonConfig): GeocodeRunOptions => {
  const activeProviders = (config.providers || []).filter((item) => item && item.enabled !== false);
  if (!activeProviders.length) {
    return {
      provider: config.provider,
      mode: config.mode,
      precision: config.precision,
      limit: config.limit,
      perMinute: config.perMinute,
      permanent: config.permanent,
    };
  }

  const cursor = Math.max(0, Number(config.providerCursor) || 0) % activeProviders.length;
  const selected = activeProviders[cursor];
  config.providerCursor = (cursor + 1) % activeProviders.length;

  return {
    provider: selected.provider,
    mode: selected.mode || config.mode,
    precision: config.precision,
    limit: Math.max(1, Number(selected.limit) || config.limit),
    perMinute: Math.max(1, Number(selected.perMinute) || config.perMinute),
    permanent:
      selected.permanent !== undefined ? Boolean(selected.permanent) : Boolean(config.permanent),
  };
};

export {
  geocodeDaemon,
  getDaemonProviderRunOptions,
  loadPersistedDaemonConfig,
  normalizeDaemonConfig,
  persistDaemonConfig,
};
