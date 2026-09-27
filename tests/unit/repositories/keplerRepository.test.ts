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

const { query, pool } = require('../../../server/src/config/database');
const keplerRepository = require('../../../server/src/repositories/keplerRepository');

describe('keplerRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('checkHomeLocationExists', () => {
    it('returns true when home marker exists', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      const result = await keplerRepository.checkHomeLocationExists();
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('returns false when no home marker exists', async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });
      const result = await keplerRepository.checkHomeLocationExists();
      expect(result).toBe(false);
    });

    it('throws custom error when app.location_markers table is missing (code 42P01)', async () => {
      const dbErr: any = new Error('relation does not exist');
      dbErr.code = '42P01';
      query.mockRejectedValueOnce(dbErr);

      await expect(keplerRepository.checkHomeLocationExists()).rejects.toThrow(
        'Home location markers table is missing (app.location_markers).'
      );
    });

    it('rethrows unexpected db errors', async () => {
      query.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(keplerRepository.checkHomeLocationExists()).rejects.toThrow('Connection failed');
    });
  });

  describe('executeKeplerQuery', () => {
    it('sets statement timeout and executes query', async () => {
      query
        .mockResolvedValueOnce({ rowCount: 0 }) // SET LOCAL
        .mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }], rowCount: 1 });

      const result = await keplerRepository.executeKeplerQuery('SELECT * FROM test', ['param1']);
      expect(query).toHaveBeenNthCalledWith(1, "SET LOCAL statement_timeout = '120000ms'");
      expect(query).toHaveBeenNthCalledWith(2, 'SELECT * FROM test', ['param1']);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('streamKeplerQuery', () => {
    it('completes normally: yields batches in order, commits, closes cursor, and releases client', async () => {
      const batch1 = [{ id: 1 }, { id: 2 }];
      const batch2 = [{ id: 3 }];
      const emptyBatch: any[] = [];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockResolvedValueOnce({ rows: batch1 }) // FETCH 2
        .mockResolvedValueOnce({ rows: batch2 }) // FETCH 2
        .mockResolvedValueOnce({ rows: emptyBatch }) // FETCH 2
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // COMMIT

      const chunksReceived: any[][] = [];
      const onChunk = jest.fn(async (rows) => {
        chunksReceived.push(rows);
      });

      const total = await keplerRepository.streamKeplerQuery(
        'SELECT * FROM app.observations',
        ['val'],
        2,
        onChunk
      );

      expect(total).toBe(3);
      expect(chunksReceived).toEqual([batch1, batch2]);
      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN READ ONLY');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'DECLARE kepler_cur NO SCROLL CURSOR FOR SELECT * FROM app.observations'
        ),
        ['val']
      );
      expect(mockClient.query).toHaveBeenCalledWith('FETCH 2 FROM kepler_cur');
      expect(mockClient.query).toHaveBeenCalledWith('CLOSE kepler_cur');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('handles early client abort mid-stream: closes cursor, rollbacks, and releases client', async () => {
      const ac = new AbortController();
      const batch1 = [{ id: 1 }, { id: 2 }];

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockResolvedValueOnce({ rows: batch1 }) // FETCH 2
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // ROLLBACK

      const onChunk = jest.fn(async (_rows) => {
        // Simulate client disconnect mid-stream
        ac.abort();
      });

      const total = await keplerRepository.streamKeplerQuery(
        'SELECT * FROM app.observations',
        [],
        2,
        onChunk,
        ac.signal
      );

      expect(total).toBe(2);
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('CLOSE kepler_cur');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
      // Ensure COMMIT was not called
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    });

    it('returns 0 immediately if signal is already aborted before query starts', async () => {
      const ac = new AbortController();
      ac.abort();

      const onChunk = jest.fn();
      const total = await keplerRepository.streamKeplerQuery(
        'SELECT 1',
        [],
        100,
        onChunk,
        ac.signal
      );

      expect(total).toBe(0);
      expect(onChunk).not.toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalledTimes(1);
      expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN READ ONLY');
    });

    it('handles query/fetch error: closes cursor, rollbacks, releases client, and rethrows', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL
        .mockResolvedValueOnce({}) // DECLARE CURSOR
        .mockRejectedValueOnce(new Error('Cursor fetch failed')) // FETCH throws
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // ROLLBACK

      const onChunk = jest.fn();

      await expect(
        keplerRepository.streamKeplerQuery('SELECT * FROM app.observations', [], 10, onChunk)
      ).rejects.toThrow('Cursor fetch failed');

      expect(mockClient.query).toHaveBeenCalledWith('CLOSE kepler_cur');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
