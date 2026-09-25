import { stripNullBytes } from '../../wigleDetailTransforms';

export type WigleV3ObservationRow = {
  netid: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  signal: number | null;
  observed_at: string;
  last_update: string | null;
  ssid: string | null;
  frequency: number | null;
  channel: number | null;
  encryption: string | null;
  noise: number | null;
  snr: number | null;
  month: string | null;
};

export type WigleV3NetworkDetailRow = {
  netid: string;
  name: string | null;
  type: string | null;
  comment: string | null;
  ssid: string | null;
  trilat: number | null;
  trilon: number | null;
  encryption: string | null;
  channel: number | null;
  bcninterval: number | null;
  freenet: string | null;
  dhcp: string | null;
  paynet: string | null;
  qos: number | null;
  first_seen: string | null;
  last_seen: string | null;
  last_update: string | null;
  street_address: string;
  location_clusters: string;
};

export type WigleApiCreditSnapshot = {
  remaining: number;
};

export type WigleApiCreditValidation = {
  hasCredit: boolean;
  message: string;
};

/** Normalize BSSID / netid / MAC values to uppercase for persistence. */
export const normalizeMacAddress = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed.toUpperCase();
};

const parseOptionalFloat = (value: unknown): number | null => {
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalInt = (value: unknown): number | null => {
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Resolve SSID for a v3 location using cluster fallback rules. */
export const resolveObservationSsid = (
  loc: Record<string, unknown>,
  cluster?: Record<string, unknown>,
  ssidOverride?: string | null
): string | null => {
  if (ssidOverride !== undefined) {
    return stripNullBytes(ssidOverride);
  }

  const locSsid = stripNullBytes(loc.ssid);
  if (locSsid && locSsid !== '?') {
    return locSsid;
  }

  return stripNullBytes(cluster?.clusterSsid ?? loc.ssid);
};

/** Map a WiGLE v3 API location object into `app.wigle_v3_observations` column shape. */
export const mapV3LocationToObservationRow = (
  netid: string,
  loc: Record<string, unknown>,
  cluster?: Record<string, unknown>,
  ssidOverride?: string | null
): WigleV3ObservationRow => {
  const normalizedNetid = normalizeMacAddress(netid);
  if (!normalizedNetid) {
    throw new Error('netid is required to map a v3 observation');
  }

  return {
    netid: normalizedNetid,
    latitude: parseFloat(String(loc.latitude)),
    longitude: parseFloat(String(loc.longitude)),
    altitude: parseOptionalFloat(loc.alt),
    accuracy: parseOptionalFloat(loc.accuracy),
    signal: parseOptionalInt(loc.signal),
    observed_at: String(loc.time),
    last_update: loc.lastupdt !== null && loc.lastupdt !== undefined ? String(loc.lastupdt) : null,
    ssid: resolveObservationSsid(loc, cluster, ssidOverride),
    frequency: parseOptionalInt(loc.frequency),
    channel: parseOptionalInt(loc.channel),
    encryption: stripNullBytes(loc.encryptionValue),
    noise: parseOptionalInt(loc.noise),
    snr: parseOptionalInt(loc.snr),
    month: loc.month !== null && loc.month !== undefined ? String(loc.month) : null,
  };
};

/** Flatten WiGLE v3 `locationClusters` into observation rows. */
export const mapV3ApiDetailObservationRows = (
  netid: string,
  locationClusters: unknown
): WigleV3ObservationRow[] => {
  if (!Array.isArray(locationClusters)) {
    return [];
  }

  const rows: WigleV3ObservationRow[] = [];
  for (const cluster of locationClusters) {
    if (!cluster || typeof cluster !== 'object' || !Array.isArray((cluster as any).locations)) {
      continue;
    }
    const clusterRecord = cluster as Record<string, unknown>;
    for (const loc of clusterRecord.locations as Record<string, unknown>[]) {
      rows.push(mapV3LocationToObservationRow(netid, loc, clusterRecord));
    }
  }
  return rows;
};

/** Map WiGLE v3 detail API JSON into `app.wigle_v3_network_details` column shape. */
export const mapV3ApiDetailToNetworkDetail = (
  data: Record<string, unknown>
): WigleV3NetworkDetailRow => {
  const netid = normalizeMacAddress(String(data.networkId ?? ''));
  if (!netid) {
    throw new Error('networkId is required to map v3 network detail');
  }

  const locationClusters = data.locationClusters;
  const firstCluster =
    Array.isArray(locationClusters) && locationClusters.length > 0
      ? (locationClusters[0] as Record<string, unknown>)
      : undefined;

  return {
    netid,
    name: stripNullBytes(data.name),
    type: stripNullBytes(data.type),
    comment: stripNullBytes(data.comment),
    ssid: stripNullBytes(firstCluster?.clusterSsid ?? data.name),
    trilat: parseOptionalFloat(data.trilateratedLatitude),
    trilon: parseOptionalFloat(data.trilateratedLongitude),
    encryption: stripNullBytes(data.encryption),
    channel: parseOptionalInt(data.channel),
    bcninterval: parseOptionalInt(data.bcninterval),
    freenet: stripNullBytes(data.freenet),
    dhcp: stripNullBytes(data.dhcp),
    paynet: stripNullBytes(data.paynet),
    qos: parseOptionalInt(data.bestClusterWiGLEQoS),
    first_seen:
      data.firstSeen !== null && data.firstSeen !== undefined ? String(data.firstSeen) : null,
    last_seen: data.lastSeen !== null && data.lastSeen !== undefined ? String(data.lastSeen) : null,
    last_update:
      data.lastUpdate !== null && data.lastUpdate !== undefined ? String(data.lastUpdate) : null,
    street_address: JSON.stringify(data.streetAddress ?? null),
    location_clusters: JSON.stringify(locationClusters ?? []),
  };
};

/** Parse WiGLE v2 stats JSON into a normalized credit snapshot. */
export const parseWigleStatsCreditSnapshot = (
  data: Record<string, unknown>
): WigleApiCreditSnapshot => ({
  remaining: Number(data?.estimatedApiQuotaRemaining ?? 0) || 0,
});

/** Convert a credit snapshot into the validation result used by enrichment use-cases. */
export const mapCreditSnapshotToValidation = (
  snapshot: WigleApiCreditSnapshot
): WigleApiCreditValidation => {
  if (snapshot.remaining === 0) {
    return { hasCredit: false, message: 'No API credit remaining (0 requests)' };
  }
  return { hasCredit: true, message: `${snapshot.remaining} requests available` };
};
