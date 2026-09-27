export {};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
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
  streamKeplerObservations,
  getKeplerNetworks,
} = keplerService;
const { query, pool } = require('../../../server/src/config/database') as any;
const logger = require('../../../server/src/logging/logger') as any;
const { UniversalFilterQueryBuilder, validateFilterPayload } =
  require('../../../server/src/services/filterQueryBuilder') as any;

describe('Kepler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
    (UniversalFilterQueryBuilder as any as jest.Mock).mockImplementation(() => {
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
      const dbError = new Error('Database connection failed');
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(checkHomeLocationExists()).rejects.toThrow('Database connection failed');
    });
  });

  describe('executeKeplerQuery', () => {
    it('should set timeout and execute query', async () => {
      (query as jest.Mock)
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({ rows: [{ bssid: 'test' }], rowCount: 1 });

      const result = await executeKeplerQuery('SELECT * FROM test', ['param']);
      expect(query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '120000ms'");
      expect(query).toHaveBeenCalledWith('SELECT * FROM test', ['param']);
      expect(result.rows).toHaveLength(1);
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

  describe('streamKeplerObservations', () => {
    let mockRes: any;

    beforeEach(() => {
      mockRes = {
        headersSent: false,
        writableEnded: false,
        writeHead: jest.fn(function (this: any) {
          this.headersSent = true;
        }),
        write: jest.fn().mockReturnValue(true),
        end: jest.fn(function (this: any) {
          this.writableEnded = true;
        }),
        destroy: jest.fn(function (this: any) {
          this.writableEnded = true;
        }),
        once: jest.fn(),
        removeListener: jest.fn(),
      };
    });

    it('should throw if validation fails', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: ['Invalid filter'] });
      await expect(streamKeplerObservations({}, {}, 100, mockRes)).rejects.toEqual({
        status: 400,
        errors: ['Invalid filter'],
      });
      expect(mockRes.writeHead).not.toHaveBeenCalled();
    });

    it('should throw if home location missing but distance filters enabled', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      (query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 }); // checkHomeLocationExists

      const filters = {};
      const enabled = { distanceFromHomeMax: 5000 };
      await expect(streamKeplerObservations(filters, enabled, 100, mockRes)).rejects.toThrow(
        'Home location is required'
      );
      expect(mockRes.writeHead).not.toHaveBeenCalled();
    });

    it('should stream GeoJSON FeatureCollection chunks and terminate with complete: true', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockResolvedValueOnce({
          rows: [
            { bssid: '00:11:22:33:44:55', lon: -122.4, lat: 37.7, ssid: 'TestNet', level: -70 },
          ],
        }) // FETCH batch 1
        .mockResolvedValueOnce({ rows: [] }) // FETCH batch 2 (empty)
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // COMMIT

      await streamKeplerObservations({}, {}, 100, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      });
      expect(mockRes.write).toHaveBeenCalledWith('{"type":"FeatureCollection","features":[');
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"type":"Feature"'));
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"complete":true'));
      expect(mockRes.end).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should stop cleanly if signal is aborted mid-stream', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      const ac = new AbortController();

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockImplementationOnce(async () => {
          ac.abort();
          return {
            rows: [{ bssid: '00:11:22:33:44:55', lon: -122.4, lat: 37.7 }],
          };
        })
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // ROLLBACK

      await streamKeplerObservations({}, {}, 100, mockRes, ac.signal);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.anything());
      expect(mockRes.write).not.toHaveBeenCalledWith(expect.stringContaining('"complete":true'));
      expect(mockRes.end).not.toHaveBeenCalled();
    });

    it('should maintain bounded listener count across multiple backpressure stalls', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      const { EventEmitter } = require('events');
      const compressionStream = new EventEmitter();

      let drainCount = 0;
      const backpressuringRes = new EventEmitter() as any;
      backpressuringRes.headersSent = false;
      backpressuringRes.writableEnded = false;
      backpressuringRes.writeHead = jest.fn();
      backpressuringRes.write = jest.fn(() => {
        // Return false to trigger backpressure
        drainCount++;
        setTimeout(() => {
          compressionStream.emit('drain');
        }, 1);
        return false;
      });
      backpressuringRes.end = jest.fn();
      backpressuringRes.on = jest.fn((type, listener) => {
        if (type === 'drain') {
          compressionStream.on(type, listener);
          return compressionStream;
        }
        return EventEmitter.prototype.on.call(backpressuringRes, type, listener);
      });

      // 15 batches of batchSize (10000) so streamKeplerQuery doesn't terminate early
      const singleRow = { bssid: '00:00:00:00:00:01', lon: 0, lat: 0 };
      const fullBatchRows = new Array(10000).fill(singleRow);

      let q = mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}); // DECLARE

      for (let i = 0; i < 15; i++) {
        q = q.mockResolvedValueOnce({ rows: fullBatchRows });
      }
      q.mockResolvedValueOnce({ rows: [] }) // FETCH empty
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // COMMIT

      await streamKeplerObservations({}, {}, 100, backpressuringRes);

      expect(drainCount).toBeGreaterThanOrEqual(15);
      // Verify that after streaming completes, listeners are completely cleaned up and never accumulated
      expect(compressionStream.listenerCount('drain')).toBe(0);
      expect(backpressuringRes.listenerCount('close')).toBe(0);
    });

    it('should log error server-side and destroy response on mid-stream cursor failure', async () => {
      (validateFilterPayload as jest.Mock).mockReturnValueOnce({ errors: [] });
      const dbErr = new Error('Database cursor query timed out');

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockRejectedValueOnce(dbErr) // FETCH error
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // ROLLBACK

      await streamKeplerObservations({}, {}, 100, mockRes);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Kepler observations mid-stream cursor failure: Database cursor query timed out'
        ),
        expect.objectContaining({ error: dbErr })
      );
      expect(mockRes.destroy).toHaveBeenCalledWith(dbErr);
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
