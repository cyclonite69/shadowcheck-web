const courthouseRepository = require('../../../server/src/repositories/courthouseRepository');
const dbConfigCourthouse = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('courthouseRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch geojson successfully', async () => {
    const mockGeoJSON = { type: 'FeatureCollection', features: [] };
    (dbConfigCourthouse.query as jest.Mock).mockResolvedValue({ rows: [{ geojson: mockGeoJSON }] });

    const result = await courthouseRepository.fetchFederalCourthousesGeoJSON();

    expect(dbConfigCourthouse.query).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockGeoJSON);
  });

  it('should return default empty feature collection if no result', async () => {
    (dbConfigCourthouse.query as jest.Mock).mockResolvedValue({ rows: [] });

    const result = await courthouseRepository.fetchFederalCourthousesGeoJSON();

    expect(result).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
