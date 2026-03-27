const logger = require('../../logging/logger');
const secretsManager = require('../secretsManager').default;

export {};

import type {
  GeocodeMode,
  GeocodeProvider,
  GeocodeProviderCredentials,
  GeocodeResult,
} from './types';
import { mapboxReverse } from './mapbox';
import {
  nominatimReverse,
  overpassPoi,
  opencageReverse,
  geocodioReverse,
  locationIqReverse,
} from './providers';

const PROVIDER_RATE_LIMIT_POLICY: Record<
  GeocodeProvider,
  { initialBackoffMs: number; maxBackoffMs: number }
> = {
  mapbox: { initialBackoffMs: 15000, maxBackoffMs: 120000 },
  nominatim: { initialBackoffMs: 60000, maxBackoffMs: 300000 },
  overpass: { initialBackoffMs: 60000, maxBackoffMs: 300000 },
  opencage: { initialBackoffMs: 30000, maxBackoffMs: 180000 },
  geocodio: { initialBackoffMs: 30000, maxBackoffMs: 180000 },
  locationiq: { initialBackoffMs: 30000, maxBackoffMs: 180000 },
};

const resolveProviderCredentials = async (
  provider: GeocodeProvider
): Promise<GeocodeProviderCredentials> => {
  if (provider === 'mapbox') {
    const mapboxToken =
      (await secretsManager.getSecret('mapbox_unlimited_api_key')) ||
      (await secretsManager.getSecret('mapbox_token'));
    return { mapboxToken: mapboxToken || undefined };
  }

  if (provider === 'opencage') {
    const opencageKey = await secretsManager.getSecret('opencage_api_key');
    return { opencageKey: opencageKey || undefined };
  }

  if (provider === 'geocodio') {
    const geocodioKey = await secretsManager.getSecret('geocodio_api_key');
    return { geocodioKey: geocodioKey || undefined };
  }

  if (provider === 'locationiq') {
    const locationIqKey = await secretsManager.getSecret('locationiq_api_key');
    return { locationIqKey: locationIqKey || undefined };
  }

  return {};
};

const ensureProviderReady = (
  provider: GeocodeProvider,
  credentials: GeocodeProviderCredentials
): void => {
  if (provider === 'mapbox' && !credentials.mapboxToken) {
    throw new Error('missing_key:mapbox');
  }
  if (provider === 'opencage' && !credentials.opencageKey) {
    throw new Error('missing_key:opencage');
  }
  if (provider === 'geocodio' && !credentials.geocodioKey) {
    throw new Error('missing_key:geocodio');
  }
  if (provider === 'locationiq' && !credentials.locationIqKey) {
    throw new Error('missing_key:locationiq');
  }
};

const calculateRateLimitBackoffMs = (
  provider: GeocodeProvider,
  consecutiveRateLimits: number
): number => {
  const policy = PROVIDER_RATE_LIMIT_POLICY[provider];
  const exponential = policy.initialBackoffMs * 2 ** Math.max(0, consecutiveRateLimits - 1);
  const capped = Math.min(policy.maxBackoffMs, exponential);
  const jitter = Math.floor(Math.random() * 1000);
  return capped + jitter;
};

const getProviderLabel = (provider: GeocodeProvider, permanent: boolean) => {
  if (provider === 'mapbox') {
    return permanent ? 'mapbox_v5_permanent' : 'mapbox_v5';
  }
  return provider;
};

const executeProviderLookup = async (
  provider: GeocodeProvider,
  mode: GeocodeMode,
  lat: number,
  lon: number,
  permanent: boolean,
  credentials: GeocodeProviderCredentials
): Promise<GeocodeResult> => {
  if (provider === 'mapbox') {
    return mapboxReverse(lat, lon, mode, permanent, credentials.mapboxToken);
  }
  if (provider === 'nominatim') {
    return nominatimReverse(lat, lon);
  }
  if (provider === 'overpass') {
    return overpassPoi(lat, lon);
  }
  if (provider === 'opencage') {
    return opencageReverse(lat, lon, credentials.opencageKey);
  }
  if (provider === 'geocodio') {
    return geocodioReverse(lat, lon, credentials.geocodioKey);
  }
  if (provider === 'locationiq') {
    return locationIqReverse(lat, lon, credentials.locationIqKey);
  }

  logger.warn('[Geocoding] Unsupported provider requested', { provider });
  return { ok: false, error: 'Unsupported provider' };
};

export {
  calculateRateLimitBackoffMs,
  ensureProviderReady,
  executeProviderLookup,
  getProviderLabel,
  resolveProviderCredentials,
};
