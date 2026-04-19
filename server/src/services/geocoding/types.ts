/**
 * Geocoding Types
 */

export type GeocodeMode = 'address-only' | 'poi-only' | 'both';
export type GeocodeProvider =
  | 'mapbox'
  | 'nominatim'
  | 'overpass'
  | 'opencage'
  | 'geocodio'
  | 'locationiq';

export type GeocodeRunOptions = {
  precision: number;
  limit: number;
  perMinute: number;
  provider: GeocodeProvider;
  mode: GeocodeMode;
  permanent?: boolean;
};

export type GeocodeProviderCredentials = {
  mapboxToken?: string;
  opencageKey?: string;
  geocodioKey?: string;
  locationIqKey?: string;
};

export type GeocodingDaemonProviderConfig = {
  provider: GeocodeProvider;
  mode?: GeocodeMode;
  limit?: number;
  perMinute?: number;
  permanent?: boolean;
  enabled?: boolean;
};

export type GeocodeDaemonConfig = GeocodeRunOptions & {
  idleSleepMs: number;
  loopDelayMs: number;
  errorSleepMs: number;
  providers?: GeocodingDaemonProviderConfig[];
  providerCursor?: number;
  workers?: number;
};

export type GeocodeResult = {
  ok: boolean;
  address?: string | null;
  poiName?: string | null;
  poiCategory?: string | null;
  featureType?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  confidence?: number | null;
  error?: string | null;
  raw?: unknown;
};

export type GeocodeRunSummary = {
  precision: number;
  mode: GeocodeMode;
  provider: string;
  processed: number;
  successful: number;
  poiHits: number;
  rateLimited: number;
  durationMs: number;
};

export type GeocodingRunSnapshot = {
  id?: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  provider: GeocodeProvider;
  mode: GeocodeMode;
  precision: number;
  limit: number;
  perMinute: number;
  permanent?: boolean;
  result?: GeocodeRunSummary;
  error?: string;
};

export type GeocodingProviderProbe = {
  provider: GeocodeProvider;
  mode: GeocodeMode;
  permanent?: boolean;
  lat?: number;
  lon?: number;
  precision?: number;
};

export type GeocodeRow = {
  lat_round: number;
  lon_round: number;
  obs_count?: number;
  address?: string | null;
};

export type GeocodingDaemonStatus = {
  running: boolean;
  stopRequested: boolean;
  config: GeocodeDaemonConfig | null;
  startedAt?: string;
  lastTickAt?: string;
  lastResult?: GeocodeRunSummary;
  lastError?: string;
};
