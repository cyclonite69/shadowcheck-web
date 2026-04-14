export {};

import {
  getCurrentHomeLocation,
  setHomeLocation,
  deleteHomeLocation,
  getAllLocationMarkers,
  getHomeLocationMarker,
  setHomeLocationMarker,
} from '../../server/src/services/homeLocationService';

const { query } = require('../../server/src/config/database');
const { adminQuery } = require('../../server/src/services/adminDbService');

jest.mock('../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/services/adminDbService', () => ({
  adminQuery: jest.fn(),
}));

describe('Home Location Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentHomeLocation', () => {
    it('should return the latest home location', async () => {
      const mockHome = { latitude: 37.7, longitude: -122.4, radius: 100, created_at: new Date() };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockHome] });

      const result = await getCurrentHomeLocation();
      expect(result).toEqual(mockHome);
      expect(query).toHaveBeenCalledWith(expect.stringContaining("marker_type = 'home'"));
    });

    it('should return null if no home location exists', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await getCurrentHomeLocation();
      expect(result).toBeNull();
    });
  });

  describe('setHomeLocation', () => {
    it('should delete existing and insert new home location', async () => {
      await setHomeLocation(37.7, -122.4, 150);
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE'));
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.location_markers'),
        ['home', 37.7, -122.4, 150]
      );
    });

    it('should use default radius if not provided', async () => {
      await setHomeLocation(37.7, -122.4);
      expect(adminQuery).toHaveBeenCalledWith(expect.anything(), ['home', 37.7, -122.4, 100]);
    });
  });

  describe('deleteHomeLocation', () => {
    it('should call DELETE on home markers', async () => {
      await deleteHomeLocation();
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM app.location_markers WHERE marker_type = 'home'")
      );
    });
  });

  describe('getAllLocationMarkers', () => {
    it('should return all markers', async () => {
      const mockMarkers = [
        { id: 1, marker_type: 'home' },
        { id: 2, marker_type: 'custom' },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockMarkers });

      const result = await getAllLocationMarkers();
      expect(result).toEqual(mockMarkers);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'));
    });
  });

  describe('getHomeLocationMarker', () => {
    it('should return single home marker', async () => {
      const mockHome = { id: 1, marker_type: 'home' };
      (query as jest.Mock).mockResolvedValueOnce({ rows: [mockHome] });

      const result = await getHomeLocationMarker();
      expect(result).toEqual(mockHome);
    });

    it('should return null if not found', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      const result = await getHomeLocationMarker();
      expect(result).toBeNull();
    });
  });

  describe('setHomeLocationMarker', () => {
    it('should replace home marker for specific device', async () => {
      const opts = {
        lat: 37.7,
        lng: -122.4,
        altGps: 10,
        altBaro: 5,
        devId: 'phone1',
        devType: 'mobile',
      };
      const mockCreated = { id: 99, ...opts };
      (adminQuery as jest.Mock).mockResolvedValueOnce({}); // DELETE
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockCreated] }); // INSERT

      const result = await setHomeLocationMarker(opts);
      expect(result).toEqual(mockCreated);
      expect(adminQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['phone1']);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.location_markers'),
        [37.7, -122.4, 10, 5, 'phone1', 'mobile']
      );
    });
  });
});
