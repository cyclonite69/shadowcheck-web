import type { WiglePageNetwork } from '../../api/wigleApi';

export interface NormalizedWigleTooltip {
  ssid: string;
  bssid: string;
  capabilities: string | null;
  frequency: number | null;
  channel: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  trilateratedLat: number | null;
  trilateratedLon: number | null;
  manufacturer: string | null;
  localMatchExists: boolean;
  localObservationCount: number | null;
  source: 'wigle-v2' | 'wigle-v3';
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

  return {
    ssid: normalizeText(pickFirst(raw.ssid, raw.name), '(hidden)'),
    bssid: normalizeText(pickFirst(raw.bssid, raw.netid), 'UNKNOWN'),
    capabilities:
      normalizeText(pickFirst(raw.capabilities, raw.encryption), '').toUpperCase() || null,
    frequency: toNumberOrNull(raw.frequency),
    channel: toNumberOrNull(raw.channel),
    firstSeen: raw.firsttime ?? null,
    lastSeen: (pickFirst(raw.lasttime, raw.lastupdt) as string | null) ?? null,
    trilateratedLat: toNumberOrNull(pickFirst(raw.trilat, raw.latitude)),
    trilateratedLon: toNumberOrNull(pickFirst(raw.trilong, raw.trilon, raw.longitude)),
    manufacturer: (() => {
      const value = pickFirst(raw.manufacturer);
      if (value === null || value === undefined) return null;
      const text = String(value).trim();
      return text.length > 0 ? text : null;
    })(),
    localMatchExists: toBoolean(pickFirst(raw.localMatchExists, raw.wigle_match)),
    localObservationCount: toNumberOrNull(
      pickFirst(raw.localObservationCount, raw.local_observations)
    ),
    source: inferredSource,
  };
};
