export {};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/services/filterQueryBuilder', () => {
  return {
    __esModule: true,
    UniversalFilterQueryBuilder: jest.fn(),
    validateFilterPayload: jest.fn(),
  };
});

const keplerService = require('../../../server/src/services/keplerService') as any;
const {
  checkHomeLocationExists,
  executeKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  getKeplerNetworks,
} = keplerService;
const { query } = require('../../../server/src/config/database') as any;
const { UniversalFilterQueryBuilder, validateFilterPayload } =
  require('../../../server/src/services/filterQueryBuilder') as any;

describe('Kepler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (UniversalFilterQueryBuilder as any as jest.Mock).mockImplementation(function () {
      return {
        buildNetworkListQuery: jest.fn().mockReturnValue({ sql: 'SELECT networks', params: [] }),
        buildGeospatialQuery: jest.fn().mockReturnValue({ sql: 'SELECT geospatial', params: [] }),
      };
    });
  });

  describe('checkHomeLocationExists', () => {
    it('should return true if home location exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
      const result = await checkHomeLocationExists();
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('should return false if home location does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });
      const result = await checkHomeLocationExists();
      expect(result).toBe(false);
    });

    it('should throw specific error if table is missing', async () => {
      const dbError = new Error('Relation does not exist') as any;
      dbError.code = '42P01';
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(checkHomeLocationExists()).rejects.toThrow(
        'Home location markers table is missing'
      );
    });

    it('should rethrow other database errors', async () => {
      const dbError = new Error('Connection timeout');
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(checkHomeLocationExists()).rejects.toThrow('Connection timeout');
    });
  });

  describe('executeKeplerQuery', () => {
    it('should set timeout and execute query', async () => {
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [1, 2], rowCount: 2 });

      const result = await executeKeplerQuery('SELECT *', [10]);
      expect(result.rows).toEqual([1, 2]);
      expect(query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '120000ms'");
      expect(query).toHaveBeenCalledWith('SELECT *', [10]);
    });
  });

  describe('getKeplerData', () => {
    it('should throw if validation fails', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: ['Invalid filter'] });
      await expect(getKeplerData({}, {}, 10, 0)).rejects.toEqual({
        status: 400,
        errors: ['Invalid filter'],
      });
    });

    it('should throw if home location missing but distance filters enabled', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 }); // checkHomeLocationExists

      const filters = {};
      const enabled = { distanceFromHomeMin: 1 };
      await expect(getKeplerData(filters, enabled, 10, 0)).rejects.toThrow(
        'Home location is required'
      );
    });

    it('should return GeoJSON FeatureCollection', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await getKeplerData({}, {}, 10, 0);
      expect(result?.type).toBe('FeatureCollection');
      expect(result.actualCounts).toBeDefined();
      expect(Array.isArray(result.features)).toBe(true);
    });
  });

  describe('getKeplerObservations', () => {
    it('should throw if validation fails', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: ['Invalid filter'] });
      await expect(getKeplerObservations({}, {}, 100)).rejects.toEqual({
        status: 400,
        errors: ['Invalid filter'],
      });
    });

    it('should throw if home location missing but distance filters enabled', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 }); // checkHomeLocationExists

      const filters = {};
      const enabled = { distanceFromHomeMax: 5000 };
      await expect(getKeplerObservations(filters, enabled, 100)).rejects.toThrow(
        'Home location is required'
      );
    });

    it('should return observations GeoJSON FeatureCollection', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await getKeplerObservations({}, {}, 100);
      expect(result.type).toBe('FeatureCollection');
      expect(result.actualCounts).toBeDefined();
      expect(Array.isArray(result.features)).toBe(true);
    });
  });

  describe('getKeplerNetworks', () => {
    it('should throw if validation fails', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: ['Invalid filter'] });
      await expect(getKeplerNetworks({}, {}, 10, 0)).rejects.toEqual({
        status: 400,
        errors: ['Invalid filter'],
      });
    });

    it('should throw if home location missing but distance filters enabled', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 }); // checkHomeLocationExists

      const filters = {};
      const enabled = { distanceFromHomeMin: 1 };
      await expect(getKeplerNetworks(filters, enabled, 10, 0)).rejects.toThrow(
        'Home location is required'
      );
    });

    it('should return network summaries GeoJSON FeatureCollection', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await getKeplerNetworks({}, {}, 10, 0);
      expect(result.type).toBe('FeatureCollection');
      expect(result.actualCounts).toBeDefined();
      expect(Array.isArray(result.features)).toBe(true);
    });
  });
});
