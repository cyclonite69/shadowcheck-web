/**
 * Geocoding Types
 */

export type GeocodeMode = 'address-only' | 'poi-only' | 'both';
export type GeocodeProvider = 'mapbox' | 'nominatim' | 'overpass' | 'opencage' | 'locationiq';

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
  locationIqKey?: string;
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
  raw?: unknown;
};

export type GeocodeRow = {
  lat_round: number;
  lon_round: number;
  obs_count?: number;
  address?: string | null;
};
