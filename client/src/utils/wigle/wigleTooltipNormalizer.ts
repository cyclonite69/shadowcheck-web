import type { WiglePageNetwork } from '../../api/wigleApi';

export interface NormalizedWigleTooltip {
  ssid: string;
  bssid: string;
  capabilities: string | null;
  frequency: number | null;
  channel: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  lastUpdated: string | null;
  trilateratedLat: number | null;
  trilateratedLon: number | null;
  displayCoordinateSource: string | null;
  manufacturer: string | null;
  city: string | null;
  region: string | null;
  localMatchExists: boolean;
  localObservationCount: number | null;
  localFirstSeen: string | null;
  localLastSeen: string | null;
  wigleObservationCount: number | null;
  publicNonstationaryFlag: boolean;
  publicSsidVariantFlag: boolean;
  wiglePrecisionWarning: boolean;
  source: 'wigle-v2' | 'wigle-v3';
  recentSsid: string | null;
  recentChannel: number | null;
  recentFrequency: number | null;
  recentAccuracy: number | null;
  address: string | null;
}

const pickFirst = (...values: Array<unknown>): unknown => {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const normalizeText = (value: unknown, fallback: string): string => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
};

export const normalizeWigleTooltipData = (raw: WiglePageNetwork): NormalizedWigleTooltip => {
  const inferredSource =
    raw.wigle_source === 'wigle-v2' || raw.wigle_source === 'wigle-v3'
      ? raw.wigle_source
      : raw.observed_at
        ? 'wigle-v3'
        : 'wigle-v2';

  const displayLat = toNumberOrNull(pickFirst(raw.display_lat, raw.trilat, raw.latitude));
  const displayLon = toNumberOrNull(
    pickFirst(raw.display_lon, raw.trilong, raw.trilon, raw.longitude)
  );

  const cityText = normalizeText(pickFirst(raw.city), '');
  const regionText = normalizeText(pickFirst(raw.region), '');

  return {
    ssid: normalizeText(pickFirst(raw.ssid, raw.name), '(hidden)'),
    bssid: normalizeText(pickFirst(raw.bssid, raw.netid), 'UNKNOWN'),
    capabilities:
      normalizeText(pickFirst(raw.capabilities, raw.encryption), '').toUpperCase() || null,
    frequency: toNumberOrNull(raw.frequency),
    channel: toNumberOrNull(raw.channel),
    firstSeen: (inferredSource === 'wigle-v3'
      ? pickFirst(raw.wigle_v3_first_seen, raw.first_seen, raw.firsttime)
      : pickFirst(raw.wigle_v2_firsttime, raw.firsttime)) as string | null,
    lastSeen: (inferredSource === 'wigle-v3'
      ? pickFirst(raw.wigle_v3_last_seen, raw.last_seen, raw.lasttime)
      : pickFirst(raw.wigle_v2_lasttime, raw.lasttime)) as string | null,
    lastUpdated: (inferredSource === 'wigle-v3'
      ? pickFirst(raw.lastupdt, raw.last_update, raw.observed_at)
      : pickFirst(raw.wigle_v2_lastupdt, raw.lastupdt)) as string | null,
    trilateratedLat: displayLat,
    trilateratedLon: displayLon,
    displayCoordinateSource:
      typeof raw.display_coordinate_source === 'string' ? raw.display_coordinate_source : null,
    manufacturer: (() => {
      const value = pickFirst(raw.manufacturer);
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text.length > 0 ? text : null;
    })(),
    city: cityText.length > 0 ? cityText : null,
    region: regionText.length > 0 ? regionText : null,
    localMatchExists: toBoolean(pickFirst(raw.localMatchExists, raw.wigle_match)),
    localObservationCount:
      inferredSource === 'wigle-v2'
        ? null
        : toNumberOrNull(pickFirst(raw.localObservationCount, raw.local_observations)),
    localFirstSeen:
      inferredSource === 'wigle-v2'
        ? null
        : ((pickFirst(raw.local_first_seen) as string | null) ?? null),
    localLastSeen:
      inferredSource === 'wigle-v2'
        ? null
        : ((pickFirst(raw.local_last_seen) as string | null) ?? null),
    wigleObservationCount: toNumberOrNull(raw.wigle_v3_observation_count),
    publicNonstationaryFlag: toBoolean(raw.public_nonstationary_flag),
    publicSsidVariantFlag: toBoolean(raw.public_ssid_variant_flag),
    wiglePrecisionWarning: toBoolean(raw.wigle_precision_warning),
    source: inferredSource,
    recentSsid: (() => {
      const v = normalizeText(pickFirst(raw.recent_ssid), '');
      return v.length > 0 ? v : null;
    })(),
    recentChannel: toNumberOrNull(raw.recent_channel),
    recentFrequency: toNumberOrNull(raw.recent_frequency),
    recentAccuracy: toNumberOrNull(raw.recent_accuracy),
    address: (() => {
      const v = normalizeText(pickFirst(raw.geocoded_address), '');
      return v.length > 0 ? v : null;
    })(),
  };
};
