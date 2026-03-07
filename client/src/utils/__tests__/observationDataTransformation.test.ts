import {
  groupObservationRowsByBssid,
  mapObservationApiRow,
} from '../observationDataTransformation';

describe('observationDataTransformation', () => {
  it('maps a valid API row into Observation', () => {
    const row = mapObservationApiRow({
      bssid: 'aa:bb:cc:dd:ee:ff',
      lat: '43.0',
      lon: -83.7,
      level: -48,
      time: '2026-03-07T00:00:00.000Z',
      radio_frequency: 2412,
      accuracy: '3.5',
      altitude: '201.2',
      obs_number: 7,
    });

    expect(row).not.toBeNull();
    expect(row?.bssid).toBe('AA:BB:CC:DD:EE:FF');
    expect(row?.lat).toBe(43);
    expect(row?.lon).toBe(-83.7);
    expect(row?.signal).toBe(-48);
    expect(row?.frequency).toBe(2412);
    expect(row?.acc).toBe(3.5);
    expect(row?.altitude).toBe(201.2);
    expect(row?.id).toBe(7);
  });

  it('returns null for invalid rows', () => {
    expect(mapObservationApiRow({ bssid: '', lat: 1, lon: 1 })).toBeNull();
    expect(mapObservationApiRow({ bssid: 'AA', lat: 'bad', lon: 1 })).toBeNull();
    expect(mapObservationApiRow({ bssid: 'AA', lat: 1, lon: 'bad' })).toBeNull();
  });

  it('groups rows by normalized BSSID and drops invalid rows', () => {
    const grouped = groupObservationRowsByBssid([
      { bssid: 'aa:aa:aa:aa:aa:aa', lat: 1, lon: 2, obs_number: 1 },
      { bssid: 'AA:AA:AA:AA:AA:AA', lat: 3, lon: 4, obs_number: 2 },
      { bssid: 'bb:bb:bb:bb:bb:bb', lat: 5, lon: 6, obs_number: 3 },
      { bssid: 'invalid', lat: 'x', lon: 6, obs_number: 4 },
    ] as any);

    expect(Object.keys(grouped)).toEqual(['AA:AA:AA:AA:AA:AA', 'BB:BB:BB:BB:BB:BB']);
    expect(grouped['AA:AA:AA:AA:AA:AA']).toHaveLength(2);
    expect(grouped['BB:BB:BB:BB:BB:BB']).toHaveLength(1);
  });
});
