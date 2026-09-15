export {};

const mockQuery = jest.fn();

jest.mock('../../../server/src/config/database', () => ({
  query: mockQuery,
}));

describe('deflockRepository — fetchDeflockCamerasGeoJSON', () => {
  let fetchDeflockCamerasGeoJSON: () => Promise<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('../../../server/src/config/database', () => ({ query: mockQuery }));
    ({
      fetchDeflockCamerasGeoJSON,
    } = require('../../../server/src/repositories/deflockRepository'));
  });

  it('returns the geojson from the first row', async () => {
    const expectedGeoJSON = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          geometry: { type: 'Point', coordinates: [-87.6, 41.8] },
          properties: {
            id: 1,
            city: 'Chicago',
            state: 'IL',
            source: 'test',
            source_id: null,
            camera_type: null,
            agency: null,
            operator: null,
            name: null,
            address: null,
            street: null,
            housenumber: null,
            postcode: null,
            country: null,
            manufacturer: null,
            manufacturer_wikidata: null,
            direction: null,
            camera_mount: null,
            surveillance: null,
            surveillance_type: null,
            surveillance_zone: null,
            electricity: null,
            website: null,
          },
        },
      ],
    };
    mockQuery.mockResolvedValue({ rows: [{ geojson: expectedGeoJSON }] });

    const result = await fetchDeflockCamerasGeoJSON();

    expect(result).toEqual(expectedGeoJSON);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    // Should be a SELECT from app.deflock_cameras
    expect(mockQuery.mock.calls[0][0]).toContain('deflock_cameras');
  });

  it('returns empty FeatureCollection when no rows', async () => {
    mockQuery.mockResolvedValue({ rows: [{ geojson: null }] });

    const result = await fetchDeflockCamerasGeoJSON();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('returns empty FeatureCollection when rows array is empty', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const result = await fetchDeflockCamerasGeoJSON();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('propagates query errors', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    await expect(fetchDeflockCamerasGeoJSON()).rejects.toThrow('DB connection failed');
  });

  it('uses a parameterless SQL query (no injection surface)', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ geojson: { type: 'FeatureCollection', features: [] } }],
    });

    await fetchDeflockCamerasGeoJSON();

    // The query should have no parameters (second arg undefined or empty)
    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs.length).toBe(1); // only SQL string, no params
  });
});
