export {};

import { UniversalFilterQueryBuilder } from '../../server/src/services/filterQueryBuilder';

const FILTER_CASES: Array<{
  name: string;
  filters: Record<string, unknown>;
  enabled: Record<string, boolean>;
}> = [
  { name: 'identity.ssid', filters: { ssid: 'AuditSSID' }, enabled: { ssid: true } },
  { name: 'identity.bssid', filters: { bssid: 'AA:BB:CC' }, enabled: { bssid: true } },
  {
    name: 'identity.manufacturer',
    filters: { manufacturer: 'Apple' },
    enabled: { manufacturer: true },
  },
  { name: 'radio.radioTypes', filters: { radioTypes: ['W'] }, enabled: { radioTypes: true } },
  {
    name: 'radio.frequencyBands',
    filters: { frequencyBands: ['5GHz'] },
    enabled: { frequencyBands: true },
  },
  { name: 'radio.channelMin', filters: { channelMin: 1 }, enabled: { channelMin: true } },
  { name: 'radio.channelMax', filters: { channelMax: 11 }, enabled: { channelMax: true } },
  { name: 'radio.rssiMin', filters: { rssiMin: -80 }, enabled: { rssiMin: true } },
  { name: 'radio.rssiMax', filters: { rssiMax: -40 }, enabled: { rssiMax: true } },
  {
    name: 'security.encryptionTypes',
    filters: { encryptionTypes: ['WPA2'] },
    enabled: { encryptionTypes: true },
  },
  {
    name: 'security.securityFlags',
    filters: { securityFlags: ['enterprise'] },
    enabled: { securityFlags: true },
  },
  {
    name: 'temporal.timeframe',
    filters: { timeframe: { type: 'relative', relativeWindow: '7d' } },
    enabled: { timeframe: true },
  },
  {
    name: 'quality.observationCountMin',
    filters: { observationCountMin: 5 },
    enabled: { observationCountMin: true },
  },
  {
    name: 'quality.observationCountMax',
    filters: { observationCountMax: 100 },
    enabled: { observationCountMax: true },
  },
  {
    name: 'quality.gpsAccuracyMax',
    filters: { gpsAccuracyMax: 100 },
    enabled: { gpsAccuracyMax: true },
  },
  {
    name: 'quality.excludeInvalidCoords',
    filters: { excludeInvalidCoords: true },
    enabled: { excludeInvalidCoords: true },
  },
  {
    name: 'quality.qualityFilter',
    filters: { qualityFilter: 'temporal' },
    enabled: { qualityFilter: true },
  },
  {
    name: 'spatial.boundingBox',
    filters: { boundingBox: { north: 40.9, south: 40.5, east: -73.7, west: -74.3 } },
    enabled: { boundingBox: true },
  },
  {
    name: 'spatial.radiusFilter',
    filters: { radiusFilter: { latitude: 40.7, longitude: -73.9, radiusMeters: 1000 } },
    enabled: { radiusFilter: true },
  },
  {
    name: 'spatial.distanceFromHomeMin',
    filters: { distanceFromHomeMin: 1 },
    enabled: { distanceFromHomeMin: true },
  },
  {
    name: 'spatial.distanceFromHomeMax',
    filters: { distanceFromHomeMax: 50 },
    enabled: { distanceFromHomeMax: true },
  },
  {
    name: 'threat.threatScoreMin',
    filters: { threatScoreMin: 60 },
    enabled: { threatScoreMin: true },
  },
  {
    name: 'threat.threatScoreMax',
    filters: { threatScoreMax: 80 },
    enabled: { threatScoreMax: true },
  },
  {
    name: 'threat.threatCategories',
    filters: { threatCategories: ['critical'] },
    enabled: { threatCategories: true },
  },
  {
    name: 'threat.stationaryConfidenceMin',
    filters: { stationaryConfidenceMin: 0.4 },
    enabled: { stationaryConfidenceMin: true },
  },
  {
    name: 'threat.stationaryConfidenceMax',
    filters: { stationaryConfidenceMax: 0.9 },
    enabled: { stationaryConfidenceMax: true },
  },
  { name: 'engagement.has_notes', filters: { has_notes: true }, enabled: { has_notes: true } },
  {
    name: 'engagement.tag_type',
    filters: { tag_type: ['threat', 'ignore'] },
    enabled: { tag_type: true },
  },
  {
    name: 'quality.wigle_v3_observation_count_min',
    filters: { wigle_v3_observation_count_min: 10 },
    enabled: { wigle_v3_observation_count_min: true },
  },
];

describe('UniversalFilterQueryBuilder audit harness', () => {
  test.each(FILTER_CASES)('%s generates SQL and metadata', ({ filters, enabled }) => {
    const builder = new UniversalFilterQueryBuilder(filters, enabled, { pageType: 'wigle' });
    const result = builder.buildNetworkListQuery();

    expect(typeof result.sql).toBe('string');
    expect(result.sql.length).toBeGreaterThan(0);
    expect(Array.isArray(result.params)).toBe(true);
    expect(Array.isArray(result.appliedFilters)).toBe(true);
    expect(Array.isArray(result.ignoredFilters)).toBe(true);
  });

  test('enabled without value is surfaced in ignoredFilters metadata', () => {
    const result = new UniversalFilterQueryBuilder({}, { ssid: true }).buildNetworkListQuery();
    expect(
      result.ignoredFilters.some(
        (f: { field: string; reason: string }) =>
          f.field === 'ssid' && f.reason === 'enabled_without_value'
      )
    ).toBe(true);
  });
});
