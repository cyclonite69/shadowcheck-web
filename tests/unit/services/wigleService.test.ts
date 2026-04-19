import { 
  getWigleNetworkByBSSID, 
  getUserStats, 
  getWigleDatabase,
  getWigleDetail,
  getWigleObservations,
  getKmlPointsForMap
} from '../../../server/src/services/wigleService';
const { query } = require('../../../server/src/config/database');
const { fetchWigle } = require('../../../server/src/services/wigleClient');
const secretsManager = require('../../../server/src/services/secretsManager');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../server/src/services/wigleClient', () => ({
  fetchWigle: jest.fn(),
}));

jest.mock('../../../server/src/services/secretsManager', () => ({
  get: jest.fn(),
}));

describe('wigleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWigleNetworkByBSSID', () => {
    it('should throw if database query fails', async () => {
      query.mockRejectedValue(new Error('DB Error'));
      await expect(getWigleNetworkByBSSID('00:11:22:33:44:55')).rejects.toThrow('DB Error');
    });
  });

  describe('getWigleDatabase', () => {
    it('should throw if v2 count query fails', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) return Promise.reject(new Error('Count Error'));
        return Promise.resolve({ rows: [] });
      });
      await expect(getWigleDatabase({ includeTotal: true })).rejects.toThrow('Count Error');
    });

    it('should throw if v3 query fails', async () => {
      query.mockRejectedValue(new Error('V3 Error'));
      await expect(getWigleDatabase({ version: 'v3' })).rejects.toThrow('V3 Error');
    });
  });

  describe('getWigleDetail', () => {
    it('should throw if primary query fails', async () => {
      query.mockRejectedValue(new Error('Detail Error'));
      await expect(getWigleDetail('00:11')).rejects.toThrow('Detail Error');
    });
  });

  describe('getWigleObservations', () => {
    it('should throw if Promise.all fails due to one query failing', async () => {
      query.mockRejectedValue(new Error('Obs Error'));
      await expect(getWigleObservations('00:11')).rejects.toThrow('Obs Error');
    });
  });

  describe('getKmlPointsForMap', () => {
    it('should throw if count query fails when includeTotal is true', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) return Promise.reject(new Error('KML Count Error'));
        return Promise.resolve({ rows: [] });
      });
      await expect(getKmlPointsForMap({ includeTotal: true })).rejects.toThrow('KML Count Error');
    });
  });

  describe('getUserStats', () => {
    it('should throw if credentials are missing', async () => {
      secretsManager.get.mockReturnValue(null);
      await expect(getUserStats()).rejects.toThrow('WiGLE API credentials not configured');
    });

    it('should throw if fetchWigle returns non-ok response', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });
      await expect(getUserStats()).rejects.toThrow('Unauthorized');
    });

    it('should throw if fetchWigle returns non-ok response without message', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('JSON parse error')),
      });
      await expect(getUserStats()).rejects.toThrow('WiGLE API error: 500');
    });

    it('should throw if fetchWigle rejects', async () => {
      secretsManager.get.mockReturnValue('value');
      fetchWigle.mockRejectedValue(new Error('Network Timeout'));
      await expect(getUserStats()).rejects.toThrow('Network Timeout');
    });
  });
});
