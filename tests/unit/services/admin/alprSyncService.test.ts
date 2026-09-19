import {
  syncAlprRegion,
  ALPR_REGIONS,
  ALPR_SYNC_LOCK_KEY,
} from '../../../../server/src/services/admin/alprSyncService';
import * as overpassClient from '../../../../src/alpr/overpassClient';
import * as alprSync from '../../../../src/alpr/alprSync';

jest.mock('../../../../src/alpr/overpassClient', () => ({
  fetchAlprElements: jest.fn(),
  elementsToRecords: jest.fn(),
}));

jest.mock('../../../../src/alpr/alprSync', () => ({
  ...jest.requireActual('../../../../src/alpr/alprSync'),
  upsertAlprBatch: jest.fn(),
  pruneStaleInBbox: jest.fn(),
}));

describe('alprSyncService', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ acquired: true }] });
        }
        if (sql.includes('pg_advisory_unlock')) {
          return Promise.resolve({ rows: [{ unlocked: true }] });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };
  });

  it('exports the ALPR_REGIONS array with 30 curated regions', () => {
    expect(Array.isArray(ALPR_REGIONS)).toBe(true);
    expect(ALPR_REGIONS.length).toBe(30);
    expect(ALPR_REGIONS.some((r) => r.id === 'seattle')).toBe(true);
  });

  it('throws an error for an unknown region ID before acquiring lock', async () => {
    await expect(syncAlprRegion(mockPool, 'atlantis')).rejects.toThrow(
      "Unknown ALPR region id: 'atlantis'"
    );
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('throws 409 error when Postgres advisory lock cannot be acquired', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) {
        return Promise.resolve({ rows: [{ acquired: false }] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await expect(syncAlprRegion(mockPool, 'seattle')).rejects.toThrow(
      'ALPR synchronization is already in progress'
    );
    expect(mockClient.release).toHaveBeenCalledTimes(1);
    // Did not attempt to unlock since it wasn't acquired
    expect(mockClient.query).not.toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      expect.anything()
    );
  });

  it('successfully syncs a region, acquiring and releasing advisory lock', async () => {
    const mockElements = [{ type: 'node', id: 12345, lat: 47.6, lon: -122.3, tags: {} }] as any;
    const mockRecords = [{ osmId: 12345, lat: 47.6, lon: -122.3, sourceProperties: {} }] as any;

    (overpassClient.fetchAlprElements as jest.Mock).mockResolvedValue(mockElements);
    (overpassClient.elementsToRecords as jest.Mock).mockReturnValue(mockRecords);
    (alprSync.upsertAlprBatch as jest.Mock).mockResolvedValue(1);

    const result = await syncAlprRegion(mockPool, 'seattle');

    expect(result.regionId).toBe('seattle');
    expect(result.regionLabel).toBe('Seattle');
    expect(result.upsertedCount).toBe(1);
    expect(result.prunedCount).toBe(0);
    expect(result.candidateCount).toBe(1);
    expect(typeof result.durationMs).toBe('number');

    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) AS acquired', [
      ALPR_SYNC_LOCK_KEY,
    ]);
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      ALPR_SYNC_LOCK_KEY,
    ]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('executes prune when prune is true and candidate records were returned', async () => {
    const mockElements = [{ type: 'node', id: 12345, lat: 47.6, lon: -122.3 }] as any;
    const mockRecords = [{ osmId: 12345, lat: 47.6, lon: -122.3, sourceProperties: {} }] as any;

    (overpassClient.fetchAlprElements as jest.Mock).mockResolvedValue(mockElements);
    (overpassClient.elementsToRecords as jest.Mock).mockReturnValue(mockRecords);
    (alprSync.upsertAlprBatch as jest.Mock).mockResolvedValue(1);
    (alprSync.pruneStaleInBbox as jest.Mock).mockResolvedValue(3);

    const result = await syncAlprRegion(mockPool, 'seattle', true);

    expect(result.regionId).toBe('seattle');
    expect(result.upsertedCount).toBe(1);
    expect(result.prunedCount).toBe(3);
    expect(alprSync.pruneStaleInBbox).toHaveBeenCalledTimes(1);
  });

  it('prune safety guard: skips prune when Overpass returns 0 records even if prune is true', async () => {
    (overpassClient.fetchAlprElements as jest.Mock).mockResolvedValue([]);
    (overpassClient.elementsToRecords as jest.Mock).mockReturnValue([]);
    (alprSync.upsertAlprBatch as jest.Mock).mockResolvedValue(0);

    const result = await syncAlprRegion(mockPool, 'seattle', true);

    expect(result.upsertedCount).toBe(0);
    expect(result.prunedCount).toBe(0);
    expect(alprSync.pruneStaleInBbox).not.toHaveBeenCalled();
  });

  it('always releases advisory lock and client when Overpass fetch fails', async () => {
    (overpassClient.fetchAlprElements as jest.Mock).mockRejectedValue(
      new Error('Overpass endpoint timed out')
    );

    await expect(syncAlprRegion(mockPool, 'seattle')).rejects.toThrow(
      'Overpass endpoint timed out'
    );
    expect(alprSync.upsertAlprBatch).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      ALPR_SYNC_LOCK_KEY,
    ]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('always releases advisory lock and client when database upsert fails', async () => {
    (overpassClient.fetchAlprElements as jest.Mock).mockResolvedValue([
      { type: 'node', id: 12345, lat: 47.6, lon: -122.3 },
    ]);
    (overpassClient.elementsToRecords as jest.Mock).mockReturnValue([
      { osmId: 12345, lat: 47.6, lon: -122.3, sourceProperties: {} },
    ]);
    (alprSync.upsertAlprBatch as jest.Mock).mockRejectedValue(new Error('database write failed'));

    await expect(syncAlprRegion(mockPool, 'seattle')).rejects.toThrow('database write failed');
    expect(mockClient.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [
      ALPR_SYNC_LOCK_KEY,
    ]);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('uses the shared lock key and the same checked-out client for the critical section', async () => {
    const mockElements = [{ type: 'node', id: 12345, lat: 47.6, lon: -122.3 }] as any;
    const mockRecords = [{ osmId: 12345, lat: 47.6, lon: -122.3, sourceProperties: {} }] as any;
    (overpassClient.fetchAlprElements as jest.Mock).mockResolvedValue(mockElements);
    (overpassClient.elementsToRecords as jest.Mock).mockReturnValue(mockRecords);
    (alprSync.upsertAlprBatch as jest.Mock).mockImplementation((client) => {
      expect(client).toBe(mockClient);
      return Promise.resolve(1);
    });

    await syncAlprRegion(mockPool, 'seattle');

    const queryClients = mockClient.query.mock.instances;
    expect(queryClients).toHaveLength(2);
    expect(ALPR_SYNC_LOCK_KEY).toBe(9191001);
  });
});
