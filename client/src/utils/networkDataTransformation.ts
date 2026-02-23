/**
 * Pure data transformation functions for network rows.
 * Extracted from useNetworkData.ts for independent testability and reuse.
 */

import { frequencyToChannel } from './mapHelpers';
import { formatSecurity } from './wigle/security';
import type { NetworkRow, ThreatInfo } from '../types/network';

// Infer network type from available data
export const inferNetworkType = (
  dbType: string | null,
  frequency: number | null,
  ssid: string | null,
  capabilities: string | null
): NetworkRow['type'] => {
  if (dbType && dbType !== '?' && dbType !== 'Unknown' && dbType !== null) {
    return dbType as NetworkRow['type'];
  }

  const ssidUpper = String(ssid || '').toUpperCase();
  const capUpper = String(capabilities || '').toUpperCase();

  // Frequency-based inference (most reliable)
  if (frequency) {
    if (frequency >= 2412 && frequency <= 2484) return 'W';
    if (frequency >= 5000 && frequency <= 5900) return 'W';
    if (frequency >= 5925 && frequency <= 7125) return 'W';
  }

  // Capability-based inference
  if (
    capUpper.includes('WPA') ||
    capUpper.includes('WEP') ||
    capUpper.includes('WPS') ||
    capUpper.includes('RSN') ||
    capUpper.includes('ESS') ||
    capUpper.includes('CCMP') ||
    capUpper.includes('TKIP')
  ) {
    return 'W';
  }

  // SSID-based inference
  if (ssidUpper.includes('5G') || capUpper.includes('NR')) return 'N';
  if (ssidUpper.includes('LTE') || ssidUpper.includes('4G')) return 'L';
  if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
    if (capUpper.includes('LOW ENERGY') || capUpper.includes('BLE')) return 'E';
    return 'B';
  }

  return '?';
};

// Calculate timespan in days
export const calculateTimespan = (first: string | null, last: string | null): number | null => {
  if (!first || !last) return null;
  const firstDate = new Date(first);
  const lastDate = new Date(last);
  if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) return null;
  const diffMs = lastDate.getTime() - firstDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

// Parse numeric fields that may come as strings
export const parseNumericField = (val: unknown): number | null => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseIntegerField = (val: unknown): number | null => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? Math.trunc(val) : null;
  }
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Map API row to NetworkRow
export const mapApiRowToNetwork = (row: any, idx: number): NetworkRow => {
  const securityValue = formatSecurity(row.capabilities, row.security);
  const bssidValue = (row.bssid || `unknown-${idx}`).toString().toUpperCase();
  const frequency = typeof row.frequency === 'number' ? row.frequency : null;
  const networkType = inferNetworkType(row.type, frequency, row.ssid, row.capabilities);
  const isWiFi = networkType === 'W';
  const threatPayload = row.threat && typeof row.threat === 'object' ? row.threat : {};
  const rawThreatScore = row.final_threat_score ?? threatPayload.score ?? 0;
  const rawThreatLevel = row.final_threat_level ?? threatPayload.level ?? 'NONE';

  // Build threat object from separate columns
  const threatScore =
    typeof rawThreatScore === 'number' ? rawThreatScore : parseFloat(String(rawThreatScore)) || 0;
  const threatLevel = String(rawThreatLevel || 'NONE').toUpperCase();
  const threatInfo: ThreatInfo = {
    score: threatScore / 100,
    level:
      (threatLevel as any) === 'CRITICAL'
        ? 'HIGH'
        : (threatLevel as 'NONE' | 'LOW' | 'MED' | 'HIGH'),
    summary: `Threat level: ${threatLevel}`,
    debug: {
      rule_score: row.rule_based_score ?? 0,
      ml_score: row.ml_threat_score ?? 0,
      evidence_weight: row.evidence_weight ?? 0,
      ml_boost: row.ml_boost ?? 0,
      features: row.features ?? {},
    },
  };

  const channelValue =
    typeof row.channel === 'number' ? row.channel : isWiFi ? frequencyToChannel(frequency) : null;

  return {
    bssid: bssidValue,
    ssid: row.ssid || '(hidden)',
    type: networkType,
    signal: typeof row.signal === 'number' ? row.signal : null,
    security: securityValue,
    frequency: frequency,
    channel: channelValue,
    observations: parseIntegerField(row.observations ?? row.obs_count) ?? 0,
    latitude: typeof row.lat === 'number' ? row.lat : null,
    longitude: typeof row.lon === 'number' ? row.lon : null,
    distanceFromHome: (() => {
      const distKm = parseNumericField(row.distance_from_home_km);
      return distKm !== null ? distKm * 1000 : null;
    })(),
    accuracy: parseNumericField(row.accuracy_meters),
    firstSeen: row.first_observed_at || null,
    lastSeen: row.last_observed_at || row.observed_at || null,
    timespanDays: calculateTimespan(row.first_observed_at, row.last_observed_at),
    threat: threatInfo,
    threat_score: threatScore,
    threat_level: threatLevel,
    threat_rule_score: parseNumericField(row.rule_based_score),
    threat_ml_score: parseNumericField(row.ml_threat_score),
    threat_ml_weight: null,
    threat_ml_boost: null,
    threatReasons: [],
    threatEvidence: [],
    stationaryConfidence: parseNumericField(row.stationary_confidence),
    manufacturer: row.manufacturer || null,
    min_altitude_m: parseNumericField(row.min_altitude_m),
    max_altitude_m: parseNumericField(row.max_altitude_m),
    altitude_span_m: parseNumericField(row.altitude_span_m),
    max_distance_meters: parseNumericField(row.max_distance_meters),
    last_altitude_m: parseNumericField(row.last_altitude_m),
    is_sentinel: typeof row.is_sentinel === 'boolean' ? row.is_sentinel : null,
    threat_tag: row.threat_tag ?? null,
    is_ignored: typeof row.is_ignored === 'boolean' ? row.is_ignored : null,
    notes_count: parseIntegerField(row.notes_count),
    all_tags: (() => {
      if (row.all_tags) return String(row.all_tags);
      const tags: string[] = [];
      if (row.threat_tag) tags.push(row.threat_tag);
      if (row.is_ignored) tags.push('ignored');
      return tags.length > 0 ? tags.join(',') : null;
    })(),
    wigle_v3_observation_count:
      parseIntegerField(row.wigle_v3_observation_count),
    wigle_v3_last_import_at: row.wigle_v3_last_import_at || null,
    rawLatitude:
      typeof row.raw_lat === 'number' ? row.raw_lat : typeof row.lat === 'number' ? row.lat : null,
    rawLongitude:
      typeof row.raw_lon === 'number' ? row.raw_lon : typeof row.lon === 'number' ? row.lon : null,
  };
};
