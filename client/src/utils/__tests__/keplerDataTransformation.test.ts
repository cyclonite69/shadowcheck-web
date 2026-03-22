import {
  mapKeplerFeatureToNetworkData,
  mapKeplerGeoJsonToNetworkData,
} from '../keplerDataTransformation';

describe('keplerDataTransformation', () => {
  it('maps a valid feature into NetworkData with defaults', () => {
    const feature = {
      geometry: { coordinates: [-83.7, 43.0] },
      properties: {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'undertaker',
        type: 'W',
        signal: -48,
        frequency: 2412,
        observation_count: 7,
        notes: 'field note',
      },
    };

    const row = mapKeplerFeatureToNetworkData(feature as any);
    expect(row).not.toBeNull();
    expect(row?.position).toEqual([-83.7, 43.0]);
    expect(row?.bssid).toBe('AA:BB:CC:DD:EE:FF');
    expect(row?.ssid).toBe('undertaker');
    expect(row?.signal).toBe(-48);
    expect(row?.level).toBe(-48);
    expect(row?.frequency).toBe(2412);
    expect(row?.encryption).toBe('Unknown');
    expect(row?.lat).toBe(43.0);
    expect(row?.lon).toBe(-83.7);
    expect(row?.latitude).toBe(43.0);
    expect(row?.longitude).toBe(-83.7);
    expect(row?.observation_count).toBe(7);
    expect(row?.notes).toBe('field note');
  });

  it('returns null for invalid geometry', () => {
    expect(mapKeplerFeatureToNetworkData({ properties: {} } as any)).toBeNull();
    expect(
      mapKeplerFeatureToNetworkData({
        geometry: { coordinates: ['x', 'y'] },
        properties: {},
      } as any)
    ).toBeNull();
  });

  it('maps full geojson and filters invalid features', () => {
    const data = mapKeplerGeoJsonToNetworkData({
      features: [
        {
          geometry: { coordinates: [-83.7, 43.0] },
          properties: { bssid: 'ONE', signal: -50 },
        },
        {
          geometry: { coordinates: [] },
          properties: { bssid: 'TWO' },
        },
      ],
    } as any);

    expect(data).toHaveLength(1);
    expect(data[0].bssid).toBe('ONE');
  });
});
