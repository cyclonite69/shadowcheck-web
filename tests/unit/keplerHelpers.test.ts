import { buildKeplerObservationsGeoJson } from '../../server/src/api/routes/v1/keplerHelpers';

describe('buildKeplerObservationsGeoJson', () => {
  it('includes explorer-style tooltip fields for observation features', () => {
    const geojson = buildKeplerObservationsGeoJson(
      [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNet',
          level: -58,
          lon: -83.697534,
          lat: 43.022067,
          time: '2026-04-04T03:00:00Z',
          manufacturer: 'Test Manufacturer',
          radio_type: 'W',
          radio_frequency: 2412,
          radio_capabilities: '[WPA2-PSK-CCMP][ESS]',
          device_id: 'dev-1',
          source_tag: 'local',
          altitude: 198,
          accuracy: 10,
          threat_level: 'MEDIUM',
          threat_score: 45.9,
          distance_from_home_km: 0.16,
          first_observed_at: '2026-01-01T00:00:00Z',
          last_observed_at: '2026-04-04T03:00:00Z',
          observations: 18,
          unique_days: 5,
          max_distance_meters: 10953.52,
          stationary_confidence: 0.25,
        },
      ],
      1
    ) as any;

    const props = geojson.features[0].properties;
    expect(props.observation_count).toBe(18);
    expect(props.obs_count).toBe(18);
    expect(props.unique_days).toBe(5);
    expect(props.max_distance_meters).toBe(10953.52);
    expect(props.max_distance_km).toBeCloseTo(10.95352, 5);
    expect(props.first_observed_at).toBe('2026-01-01T00:00:00Z');
    expect(props.last_observed_at).toBe('2026-04-04T03:00:00Z');
    expect(props.timespan_days).toBeGreaterThan(0);
    expect(props.stationary_confidence).toBe(0.25);
  });
});
