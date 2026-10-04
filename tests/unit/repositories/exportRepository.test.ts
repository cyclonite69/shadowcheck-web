export {};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(() => Promise.resolve(mockClient)),
  },
}));

jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

const db = require('../../../server/src/config/database');
const { adminQuery } = require('../../../server/src/services/adminDbService');
const repository = require('../../../server/src/repositories/exportRepository');

describe('exportRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.pool.connect.mockImplementation(() => Promise.resolve(mockClient));
  });

  it.each([
    ['queryObservationsForCSV', 'LIMIT 50000'],
    ['queryObservationsForJSON', 'LIMIT 20000'],
    ['queryNetworksForJSON', 'LIMIT 10000'],
    ['queryObservationsForGeoJSON', 'lat IS NOT NULL'],
  ])('returns rows from %s', async (method, sqlFragment) => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await expect(repository[method]()).resolves.toEqual([{ id: 1 }]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining(sqlFragment));
  });

  it('returns sorted app table names', async () => {
    adminQuery.mockResolvedValueOnce({
      rows: [{ tablename: 'networks' }, { tablename: 42 }],
    });

    await expect(repository.queryAppTableNames()).resolves.toEqual(['networks', '42']);
    expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining("schemaname = 'app'"));
  });

  it('quotes table identifiers for row counts', async () => {
    adminQuery.mockResolvedValueOnce({ rows: [{ count: '17' }] });

    await expect(repository.queryTableRowCount('odd"name')).resolves.toBe(17);
    expect(adminQuery).toHaveBeenCalledWith(
      'SELECT COUNT(*)::bigint AS count FROM "app"."odd""name"'
    );
  });

  it('returns zero for missing count rows', async () => {
    adminQuery.mockResolvedValueOnce({ rows: [] });

    await expect(repository.queryTableRowCount('networks')).resolves.toBe(0);
  });

  it('short-circuits non-positive table limits', async () => {
    await expect(repository.queryTableRows('networks', 0)).resolves.toEqual([]);
    await expect(repository.queryTableRows('networks', -1)).resolves.toEqual([]);
    expect(adminQuery).not.toHaveBeenCalled();
  });

  it('quotes table names and normalizes missing rows for table exports', async () => {
    adminQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: null });

    await expect(repository.queryTableRows('network"tags', 25)).resolves.toEqual([{ id: 1 }]);
    await expect(repository.queryTableRows('networks', 5)).resolves.toEqual([]);
    expect(adminQuery).toHaveBeenNthCalledWith(1, 'SELECT * FROM "app"."network""tags" LIMIT 25');
  });

  it('parameterizes KML BSSID selection', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ bssid: 'A' }] });

    await expect(repository.queryObservationsForKML(['A', 'B'])).resolves.toEqual([{ bssid: 'A' }]);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE bssid IN ($1,$2)'), [
      'A',
      'B',
    ]);
  });

  describe('acquireExportClient', () => {
    it('returns a connected pool client', async () => {
      const client = await repository.acquireExportClient();
      expect(client).toBe(mockClient);
      expect(db.pool.connect).toHaveBeenCalled();
    });
  });

  describe('streamObservationsForGeoJSON', () => {
    it('yields batches, closes cursor, commits, and releases client', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN READ ONLY
        .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
        .mockResolvedValueOnce({}) // SET LOCAL idle_in_transaction_session_timeout
        .mockResolvedValueOnce({}) // DECLARE cursor
        .mockResolvedValueOnce({
          rows: [{ bssid: '00:11:22:33:44:55' }, { bssid: 'AA:BB:CC:DD:EE:FF' }],
        }) // FETCH 1
        .mockResolvedValueOnce({ rows: [] }) // FETCH 2 (empty, end)
        .mockResolvedValueOnce({}) // CLOSE cursor
        .mockResolvedValueOnce({}); // COMMIT

      const batches: any[] = [];
      for await (const batch of repository.streamObservationsForGeoJSON(2)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN READ ONLY');
      expect(mockClient.query).toHaveBeenCalledWith("SET LOCAL statement_timeout = '300000ms'");
      expect(mockClient.query).toHaveBeenCalledWith(
        "SET LOCAL idle_in_transaction_session_timeout = '120s'"
      );
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DECLARE'));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('CLOSE'));
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('handles empty table cleanly and releases client', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
        .mockResolvedValueOnce({}) // SET LOCAL idle_in_transaction_session_timeout
        .mockResolvedValueOnce({}) // DECLARE
        .mockResolvedValueOnce({ rows: [] }) // FETCH 1 (empty)
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // COMMIT

      const batches: any[] = [];
      for await (const batch of repository.streamObservationsForGeoJSON(10)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back and releases client when aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const batches: any[] = [];
      for await (const batch of repository.streamObservationsForGeoJSON(
        10,
        abortController.signal
      )) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back and releases client on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
        .mockResolvedValueOnce({}) // SET LOCAL idle_in_transaction_session_timeout
        .mockRejectedValueOnce(new Error('Cursor declaration failed')); // DECLARE error

      await expect(async () => {
        for await (const _batch of repository.streamObservationsForGeoJSON(10)) {
          // should not reach here
        }
      }).rejects.toThrow('Cursor declaration failed');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('releases pool client and rolls back on early consumer break / client disconnect', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
        .mockResolvedValueOnce({}) // SET LOCAL idle_in_transaction_session_timeout
        .mockResolvedValueOnce({}) // DECLARE
        .mockResolvedValueOnce({ rows: [{ bssid: '00:11:22:33:44:55' }] }); // FETCH

      for await (const batch of repository.streamObservationsForGeoJSON(1)) {
        expect(batch).toHaveLength(1);
        break; // consumer aborts iteration (e.g. client disconnect)
      }

      expect(mockClient.release).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('accepts pre-acquired client connection and releases on completion', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET LOCAL statement_timeout
        .mockResolvedValueOnce({}) // SET LOCAL idle_in_transaction_session_timeout
        .mockResolvedValueOnce({}) // DECLARE
        .mockResolvedValueOnce({ rows: [] }) // FETCH (empty)
        .mockResolvedValueOnce({}) // CLOSE
        .mockResolvedValueOnce({}); // COMMIT

      const batches: any[] = [];
      for await (const batch of repository.streamObservationsForGeoJSON(mockClient, 50)) {
        batches.push(batch);
      }

      expect(batches).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
