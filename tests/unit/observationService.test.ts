export {};

import {
  getHomeLocationForObservations,
  getObservationsByBSSID,
  checkWigleTableExists,
  getWigleObservationsByBSSID,
  getOurObservationCount,
  getWigleObservationsBatch,
} from '../../server/src/services/observationService';

const { query } = require('../../server/src/config/database');

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('Observation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHomeLocationForObservations', () => {
    it('should return lon/lat if home location exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ lon: -122.4194, lat: 37.7749 }],
      });

      const result = await getHomeLocationForObservations();
      expect(result).toEqual({ lon: -122.4194, lat: 37.7749 });
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('should return null if home location does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getHomeLocationForObservations();
      expect(result).toBeNull();
    });

    it('should return null on DB error', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

      const result = await getHomeLocationForObservations();
      expect(result).toBeNull();
    });
  });

  describe('getObservationsByBSSID', () => {
    it('should return observations with distance from home when home coordinates provided', async () => {
      const mockRows = [
        {
          id: 1,
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test',
          lat: 37.7,
          lon: -122.4,
          distance_from_home_km: 0.1,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getObservationsByBSSID('AA:BB:CC:DD:EE:FF', -122.4194, 37.7749);
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ST_Distance'), [
        -122.4194,
        37.7749,
        'AA:BB:CC:DD:EE:FF',
      ]);
    });

    it('should return observations without distance when home coordinates are null', async () => {
      const mockRows = [
        {
          id: 1,
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test',
          lat: 37.7,
          lon: -122.4,
          distance_from_home_km: null,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getObservationsByBSSID('AA:BB:CC:DD:EE:FF', null, null);
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.anything(), [null, null, 'AA:BB:CC:DD:EE:FF']);
    });
  });

  describe('checkWigleTableExists', () => {
    it('should return true if table exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ exists: true }],
      });

      const result = await checkWigleTableExists();
      expect(result).toBe(true);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('wigle_v3_observations'));
    });

    it('should return false if table does not exist', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ exists: false }],
      });

      const result = await checkWigleTableExists();
      expect(result).toBe(false);
    });
  });

  describe('getWigleObservationsByBSSID', () => {
    it('should return enriched WiGLE observations', async () => {
      const mockRows = [
        {
          bssid: 'AA:BB',
          lat: 37.7,
          lon: -122.4,
          is_matched: true,
          distance_from_our_center_m: 2.5,
        },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleObservationsByBSSID('AA:BB');
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('app.wigle_v3_observations'), [
        'AA:BB',
      ]);
    });
  });

  describe('getOurObservationCount', () => {
    it('should return count as number', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ count: '42' }],
      });

      const result = await getOurObservationCount('AA:BB');
      expect(result).toBe(42);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT(*)'), ['AA:BB']);
    });

    it('should return 0 if no results', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await getOurObservationCount('AA:BB');
      expect(result).toBe(0);
    });
  });

  describe('getWigleObservationsBatch', () => {
    it('should return batch of enriched WiGLE observations', async () => {
      const mockRows = [
        { bssid: 'AA:BB', lat: 37.7, lon: -122.4, is_matched: true },
        { bssid: 'CC:DD', lat: 37.8, lon: -122.5, is_matched: false },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockRows });

      const result = await getWigleObservationsBatch(['AA:BB', 'CC:DD']);
      expect(result).toEqual(mockRows);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ANY($1)'), [['AA:BB', 'CC:DD']]);
    });
  });
});
