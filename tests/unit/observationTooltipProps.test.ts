import { buildObservationTooltipProps } from '../../client/src/utils/geospatial/observationTooltipProps';

describe('buildObservationTooltipProps', () => {
  it('uses network fallbacks for frequency/channel and converts network home distance from meters', () => {
    const props = buildObservationTooltipProps({
      obs: {
        id: 3,
        bssid: '00:54:AF:77:0B:58',
        lat: 42.9905,
        lon: -83.6531,
        signal: -90,
        time: '2026-02-21T23:55:56.000Z',
        frequency: null,
      },
      network: {
        bssid: '00:54:AF:77:0B:58',
        ssid: 'Hotspot0B58',
        type: 'W',
        signal: -59,
        security: 'WPA2-P',
        frequency: 2452,
        channel: 9,
        observations: 15,
        latitude: 42.983460154002934,
        longitude: -83.77385562433273,
        distanceFromHome: 7693.14724072,
        accuracy: 13.1886329650879,
        lastSeen: '2026-02-21T23:55:56.000Z',
        timespanDays: 392,
        threat_score: 61.13,
        threat_level: 'HIGH',
        manufacturer: 'AUMOVIO Systems, Inc.',
        max_distance_meters: 9879.58093146,
      },
      threatLevel: 'HIGH',
      deltaMeters: 9853,
      timeSincePrior: '5m 12s',
      timeSincePriorMs: 312000,
      number: 3,
      color: '#fff',
    });

    expect(props.frequency).toBe(2452);
    expect(props.channel).toBe(9);
    expect(props.distance_from_home_km).toBeCloseTo(7.6931, 4);
    expect(props.max_distance_km).toBeCloseTo(9.8796, 4);
  });
});
