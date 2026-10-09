export {};

const mockQuery = jest.fn();

jest.mock('../../../server/src/config/database', () => ({
  query: mockQuery,
}));

describe('alprRepository — fetchAlprCamerasGeoJSON', () => {
  let fetchAlprCamerasGeoJSON: (bbox?: [number, number, number, number]) => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('../../../server/src/config/database', () => ({ query: mockQuery }));
    ({ fetchAlprCamerasGeoJSON } = require('../../../server/src/repositories/alprRepository'));
  });

  it('returns the geojson from the first row', async () => {
    const expectedGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 12345,
          geometry: { type: 'Point', coordinates: [-122.4, 37.7] },
          properties: {
            id: '12345',
            osm_id: '12345',
            manufacturer: 'Flock Safety',
            direction: '90',
            camera_type: 'fixed',
            surveillance_zone: 'traffic',
            camera_mount: 'pole',
            operator: 'City of Oakland',
            electricity: 'solar',
          },
        },
      ],
    };
    mockQuery.mockResolvedValue({ rows: [{ geojson: expectedGeoJSON }] });

    const result = await fetchAlprCamerasGeoJSON();

    expect(result).toEqual(expectedGeoJSON);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain('alpr_cameras');
  });

  it('returns empty FeatureCollection when no rows', async () => {
    mockQuery.mockResolvedValue({ rows: [{ geojson: null }] });

    const result = await fetchAlprCamerasGeoJSON();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('returns empty FeatureCollection when rows array is empty', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await fetchAlprCamerasGeoJSON();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('propagates query errors', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(fetchAlprCamerasGeoJSON()).rejects.toThrow('DB connection failed');
  });

  it('uses a parameterless SQL query (no injection surface)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ geojson: { type: 'FeatureCollection', features: [] } }],
    });

    await fetchAlprCamerasGeoJSON();

    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs.length).toBe(1);
  });

  it('limits results to an optional parameterized bounding box', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ geojson: { type: 'FeatureCollection', features: [] } }],
    });
    const bbox: [number, number, number, number] = [-74.05, 40.65, -73.85, 40.85];

    await fetchAlprCamerasGeoJSON(bbox);

    expect(mockQuery.mock.calls[0][0]).toContain('ST_MakeEnvelope($1, $2, $3, $4, 4326)');
    expect(mockQuery.mock.calls[0][1]).toEqual(bbox);
  });
});
