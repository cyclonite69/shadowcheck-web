export {};

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/services/filterQueryBuilder', () => {
  return {
    __esModule: true,
    UniversalFilterQueryBuilder: jest.fn(),
    validateFilterPayload: jest.fn(),
  };
});

jest.mock('../../server/src/api/routes/v1/keplerHelpers', () => ({
  __esModule: true,
  buildKeplerDataGeoJson: jest.fn(),
  buildKeplerNetworksGeoJson: jest.fn(),
  buildKeplerObservationsGeoJson: jest.fn(),
}));

const keplerService = require('../../server/src/services/keplerService') as any;
const {
  checkHomeLocationExists,
  executeKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  getKeplerNetworks,
} = keplerService;
const { query } = require('../../server/src/config/database') as any;
const { UniversalFilterQueryBuilder, validateFilterPayload } =
  require('../../server/src/services/filterQueryBuilder') as any;
import {
  buildKeplerDataGeoJson,
  buildKeplerNetworksGeoJson,
  buildKeplerObservationsGeoJson,
} from '../../server/src/api/routes/v1/keplerHelpers';

describe('Kepler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (UniversalFilterQueryBuilder as any as jest.Mock).mockImplementation(function () {
      return {
        buildNetworkListQuery: jest.fn().mockReturnValue({ sql: 'SELECT networks', params: [] }),
        buildGeospatialQuery: jest.fn().mockReturnValue({ sql: 'SELECT geospatial', params: [] }),
      };
    });
    (buildKeplerDataGeoJson as jest.Mock).mockImplementation((rows) => ({
      type: 'FeatureCollection',
      features: rows,
    }));
    (buildKeplerNetworksGeoJson as jest.Mock).mockImplementation((rows) => ({
      type: 'FeatureCollection',
      features: rows,
    }));
    (buildKeplerObservationsGeoJson as jest.Mock).mockImplementation((rows) => ({
      type: 'FeatureCollection',
      features: rows,
    }));
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

    it('should return GeoJSON data', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'net1' }], rowCount: 1 });

      const result = await getKeplerData({}, {}, 10, 0);
      expect(result?.type).toBe('FeatureCollection');
      expect(result.features).toEqual([{ id: 'net1' }]);
      expect(buildKeplerDataGeoJson).toHaveBeenCalled();
    });
  });

  describe('getKeplerObservations', () => {
    it('should return observations GeoJSON', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'obs1' }], rowCount: 1 });

      const result = await getKeplerObservations({}, {}, 100);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toEqual([{ id: 'obs1' }]);
      expect(buildKeplerObservationsGeoJson).toHaveBeenCalled();
    });
  });

  describe('getKeplerNetworks', () => {
    it('should return network summaries GeoJSON', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({}); // SET LOCAL
      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'net_summary1' }], rowCount: 1 });

      const result = await getKeplerNetworks({}, {}, 10, 0);
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toEqual([{ id: 'net_summary1' }]);
      expect(buildKeplerNetworksGeoJson).toHaveBeenCalled();
    });
  });
});
